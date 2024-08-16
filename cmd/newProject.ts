import { mkdir } from 'node:fs/promises';
import { select, input, confirm } from '@inquirer/prompts';
import {
  createNewProject,
  updateProject,
  viewProject,
} from '../helpers/config';
import chalk from 'chalk';
import DigitalOceanService from '../services/DigitalOceanClient/DigitalOceanClient';
import type {
  NewProjectQuestions,
  GHSecret,
  ProjectType,
} from '../types/config';
import type { DoAppSpec } from '../types/do';
import ora from 'ora';
import { projectTable } from '../helpers/transformers';
import { runCommand } from '../helpers/io';
import fs from 'node:fs/promises';
import {
  copyEsLintFiles,
  copyPrettierFiles,
  copyTsStarterFiles,
} from '../helpers/newProject';
import GitHub from '../helpers/github';

interface Config {
  GH_TOKEN: string;
  GH_USERNAME: string;
  DO_API_TOKEN: string;
  DO_REGISTRY_NAME: string;
}

const getConfig = (): Config => {
  const requiredEnvVars = [
    'GH_TOKEN',
    'GH_USERNAME',
    'DO_API_TOKEN',
    'DO_REGISTRY_NAME',
  ];
  const missingVars = requiredEnvVars.filter(
    (varName) => !process.env[varName],
  );

  if (missingVars.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingVars.join(', ')}`,
    );
  }

  return {
    GH_TOKEN: process.env.GH_TOKEN!,
    GH_USERNAME: process.env.GH_USERNAME!,
    DO_API_TOKEN: process.env.DO_API_TOKEN!,
    DO_REGISTRY_NAME: process.env.DO_REGISTRY_NAME!,
  };
};

const createProject = async () => {
  try {
    const config = getConfig();
    const doService = new DigitalOceanService(config.DO_API_TOKEN);

    const projectDetails = await gatherProjectDetails();
    const newProject = await createAndSetupProject(projectDetails, config);
    await setupVersionControl(projectDetails, newProject, config);
    await setupCloudDeployment(projectDetails, newProject, doService, config);

    displayProjectSummary(newProject);
  } catch (error) {
    console.error(
      chalk.red('An error occurred while creating the project:'),
      error,
    );
  }
};

const gatherProjectDetails = async (): Promise<NewProjectQuestions> => {
  const projectPath = process.cwd();

  const projectType: ProjectType = await select({
    message: 'What type of project do you want to make?',
    choices: [
      { name: 'TypeScript ExpressJS server', value: 'ts_express' },
      { name: 'Go Fiber server', value: 'go_fiber' },
    ],
  });

  let buildTool = null;
  let prettier = false;
  let eslint = false;

  if (projectType === 'ts_express') {
    buildTool = await select({
      message: 'Choose a build tool',
      choices: [{ name: 'pnpm', value: 'pnpm' }],
    });
    prettier = await confirm({ message: 'Do you want to use Prettier?' });
    eslint = await confirm({ message: 'Do you want to use ESLint?' });
  }

  const name = await input({
    message: 'Enter the name of your project in dashed case',
    required: true,
  });

  const description = await input({
    message: 'Enter a description for your project',
  });

  const createDir = await confirm({
    message:
      'Do you want to create a new folder for your project or use the current directory?',
  });

  const projectFullPath = createDir ? `${projectPath}/${name}` : process.cwd();

  const createGitRepo = await confirm({
    message: 'Do you want to create a Git repository?',
  });

  const createReadme = await confirm({
    message: 'Do you want to create a README.md?',
  });

  let createGHRepo = false;
  let createGHAction = false;

  if (createGitRepo) {
    createGHRepo = await confirm({
      message: 'Do you want to create a GitHub repository?',
    });
    createGHAction = await confirm({
      message:
        'Do you want to create a GitHub action workflow for auto-deploys?',
    });
  }

  const createDoApp = await confirm({
    message: 'Do you want to create a DigitalOcean App?',
  });

  return {
    name,
    projectPath: projectFullPath,
    description,
    createDir,
    createGitRepo,
    createReadme,
    createGHRepo,
    createGHAction,
    createDoApp,
    projectType,
    buildTool,
    prettier,
    eslint,
  };
};

const createAndSetupProject = async (
  details: NewProjectQuestions,
  config: Config,
) => {
  const spinner = ora(`Creating new project: ${details.name}`).start();
  const newProject = await createNewProject(details);
  spinner.succeed(`Project created: ${newProject.id}`);

  await createProjectStructure(details);
  await setupProjectFiles(details);

  return newProject;
};

const createProjectStructure = async (details: NewProjectQuestions) => {
  if (details.createDir) {
    await mkdir(details.projectPath, { recursive: true });
  }
};

const setupProjectFiles = async (details: NewProjectQuestions) => {
  const fileSpinner = ora('Setting up project files').start();

  try {
    if (details.projectType === 'ts_express') {
      await copyTsStarterFiles(details);
      if (details.prettier) await copyPrettierFiles(details);
      if (details.eslint) await copyEsLintFiles(details);
      if (details.buildTool) {
        fileSpinner.text = 'Building project';
        await runCommand(details.buildTool, ['install'], details.projectPath);
      }
    }

    if (details.createReadme) {
      const readme = `# ${details.name}\n\n${details.description}`;
      await fs.writeFile(`${details.projectPath}/README.md`, readme);
    }

    fileSpinner.succeed('Project files set up successfully');
  } catch (error) {
    fileSpinner.fail('Failed to set up project files');
    throw error;
  }
};

const setupVersionControl = async (
  details: NewProjectQuestions,
  newProject: any,
  config: Config,
) => {
  if (details.createGitRepo) {
    const gitSpinner = ora('Setting up version control').start();

    try {
      await runCommand('git', ['init'], details.projectPath);

      if (details.createGHRepo) {
        const GH = new GitHub(config.GH_TOKEN, config.GH_USERNAME);
        const { data: repo } = await GH.createRepo(details.name);
        await updateProject(newProject.id, { gitHubRepo: repo.html_url });

        if (details.createGHAction) {
          await setupGitHubAction(details, GH, repo);
        }

        // Add remote and push
        await runCommand(
          'git',
          ['remote', 'add', 'origin', repo.html_url],
          details.projectPath,
        );
        await runCommand('git', ['add', '.'], details.projectPath);
        await runCommand(
          'git',
          ['commit', '-m', '"Initial commit"'],
          details.projectPath,
        );
        await runCommand(
          'git',
          ['push', '-u', 'origin', 'main'],
          details.projectPath,
        );
      }

      gitSpinner.succeed('Version control set up successfully');
    } catch (error) {
      gitSpinner.fail('Failed to set up version control');
      throw error;
    }
  }
};

const setupGitHubAction = async (
  details: NewProjectQuestions,
  GH: GitHub,
  repo: any,
) => {
  const actionSpinner = ora('Setting up GitHub Action').start();

  try {
    const mainYml = GH.makeGhActionFile();
    await mkdir(`${details.projectPath}/.github/workflows`, {
      recursive: true,
    });
    await fs.writeFile(
      `${details.projectPath}/.github/workflows/main.yml`,
      mainYml,
    );

    const secrets: GHSecret[] = [
      {
        repo: details.name,
        secret_name: 'DO_REPO_NAME',
        encrypted_value: details.name,
      },
      {
        repo: details.name,
        secret_name: 'DO_REGISTRY_NAME',
        encrypted_value: process.env.DO_REGISTRY_NAME || '',
      },
      {
        repo: details.name,
        secret_name: 'DIGITALOCEAN_ACCESS_TOKEN',
        encrypted_value: process.env.DO_API_TOKEN || '',
      },
    ];

    for (const secret of secrets) {
      await GH.uploadRepoSecret(secret);
    }

    actionSpinner.succeed('GitHub Action set up successfully');
  } catch (error) {
    actionSpinner.fail('Failed to set up GitHub Action');
    throw error;
  }
};

const setupCloudDeployment = async (
  details: NewProjectQuestions,
  newProject: any,
  doService: DigitalOceanService,
  config: Config,
) => {
  if (details.createDoApp) {
    const doSpinner = ora('Setting up DigitalOcean App').start();

    try {
      // Build and push Docker image
      await runCommand(
        'docker',
        [
          'build',
          '-t',
          `registry.digitalocean.com/${config.DO_REGISTRY_NAME}/${details.name}:latest`,
          '.',
        ],
        details.projectPath,
      );

      await runCommand(
        'docker',
        [
          'push',
          `registry.digitalocean.com/${config.DO_REGISTRY_NAME}/${details.name}:latest`,
        ],
        details.projectPath,
      );

      // Create and deploy DO App
      const spec: DoAppSpec = doService.createDoAppSpec(
        details.name,
        3000,
        'latest',
        details.name,
      );
      await doService.writeDoAppSpec(details.name, spec, details.projectPath);

      const [createAppResponse, createAppError] =
        await doService.createDoApp(spec);
      if (createAppError || !createAppResponse) {
        throw new Error(`Failed to create DigitalOcean App: ${createAppError}`);
      }

      const appId = createAppResponse.id;
      if (!appId) {
        throw new Error('Failed to get app ID from DigitalOcean response');
      }

      const [appStatus, pollError] = await doService.pollDoAppStatus(
        appId,
        5000,
      );
      if (pollError || !appStatus) {
        throw new Error(`Failed to poll DigitalOcean App status: ${pollError}`);
      }

      await fs.writeFile(
        `${details.projectPath}/do-config.json`,
        JSON.stringify(appStatus, null, 2),
      );

      await updateProject(newProject.id, {
        do_link: appStatus.app.live_url,
        do_app_id: appStatus.app.id,
        do_config: spec,
      });

      doSpinner.succeed(`DigitalOcean App created: ${appStatus.app.live_url}`);
    } catch (error) {
      doSpinner.fail('Failed to set up DigitalOcean App');
      throw error;
    }
  }
};

const displayProjectSummary = async (project: any) => {
  const updatedProject = await viewProject(project.id);
  const table = projectTable(updatedProject);
  console.log(table);
};

export default createProject;
