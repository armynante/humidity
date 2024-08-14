import { mkdir } from 'node:fs/promises';
import { select, input, confirm } from '@inquirer/prompts';
import GitHub from '../helpers/github';
import {
  createNewProject,
  updateProject,
  viewProject,
} from '../helpers/config';
import chalk from 'chalk';
import {
  createDoApp,
  createDoAppSpec,
  pollDoAppStatus,
  writeDoAppSpec,
} from '../helpers/digitalOcean';
import type { GHSecret, NewProjectQuestions } from '../types/config';
import ora from 'ora';
import { projectTable } from '../helpers/transformers';
import { runCommand } from '../helpers/io';
import fs from 'node:fs/promises';

const GitHubToken = process.env.GH_TOKEN;

const createProject = async () => {
  // Ask what the user wants to do
  // Create a new TS Project

  let p: NewProjectQuestions = {
    name: '',
    projectPath: '',
    description: '',
    createDir: false,
    createGitRepo: false,
    createReadme: false,
    createGHRepo: false,
    createGHAction: false,
    createDoApp: false,
    projectType: null,
    buildTool: null,
    prettier: false,
    eslint: false,
  };

  // Get the current working directory
  const projectPath = process.cwd();

  // Ask the user some questions and store the answers
  p.projectType = await select({
    message: 'What type of project do you want to make?',
    choices: [
      { name: 'TypeScript ExpressJS server', value: 'ts_express' },
      { name: 'Go Fiber server', value: 'go_fiber' },
    ],
  });
  if (p.projectType === 'ts_express') {
    p.buildTool = await select({
      message: 'Choose a build tool',
      choices: [
        { name: 'pnpm', value: 'pnpm' },
        { name: 'yarn', value: 'yarn' },
        { name: 'npm', value: 'npm' },
      ],
    });
    p.prettier = await confirm({
      message: 'Do you want to use Prettier?',
    });
    p.eslint = await confirm({
      message: 'Do you want to use ESLint?',
    });
  }

  p.name = await input({
    message: 'Enter the name of your project in dashed case',
    required: true,
  });
  p.description = await input({
    message: 'Enter a description for your project',
  });
  p.createDir = await confirm({
    message:
      'Do you want to create a new folder for your project or use the current directory?',
  });
  p.projectPath = p.createDir ? `${projectPath}/${p.name}` : process.cwd();
  p.createGitRepo = await confirm({
    message: 'Do you want to create a Git repository?',
  });
  p.createReadme = await confirm({
    message: 'Do you want to create a README.md?',
  });
  if (p.createGitRepo) {
    p.createGHRepo = await confirm({
      message: 'Do you want to create a GitHub repository?',
    });
    p.createGHAction = await confirm({
      message:
        'Do you want to create a GitHub action workflow for auto-deploys?',
    });
  }
  p.createDoApp = await confirm({
    message: 'Do you want to create a DigitalOcean App?',
  });

  // Helper function to determine the color based on the boolean value
  function getColor(value: boolean) {
    return value ? chalk.greenBright.bold : chalk.redBright.bold;
  }

  function formatSummary(project: NewProjectQuestions): string {
    const labels = [
      'Name',
      'Description',
      'Path',
      'Create directory',
      'Create Git repo',
      'Create README',
      'Create GitHub repo',
      'Create GitHub action',
      'Create DO App',
      'Project type',
    ];

    const values = [
      project.name,
      project.description,
      project.projectPath,
      getColor(project.createDir)(project.createDir.toString()),
      getColor(project.createGitRepo)(project.createGitRepo.toString()),
      getColor(project.createReadme)(project.createReadme.toString()),
      getColor(project.createGHRepo)(project.createGHRepo.toString()),
      getColor(project.createGHAction)(project.createGHAction.toString()),
      getColor(project.createDoApp)(project.createDoApp.toString()),
      project.projectType,
      project.buildTool,
      project.prettier,
      project.eslint,
    ];

    const maxLength = labels.reduce(
      (max, label) => Math.max(max, label.length),
      0,
    );
    const formattedLines = labels.map(
      (label, i) => `${label.padStart(maxLength, ' ')}: ${values[i]}`,
    );
    const summaryHeader = '='.repeat(
      Math.max(...formattedLines.map((line) => line.length)),
    );

    return [
      summaryHeader,
      '//// Project Summary',
      summaryHeader,
      ...formattedLines,
      summaryHeader,
      '\n',
    ].join('\n');
  }
  console.log(formatSummary(p));

  // Confirm the project details
  const confirmProject = await confirm({ message: 'Does this look correct?' });

  if (!confirmProject) {
    console.log('Exiting...');
    return;
  }

  // Create the new project and store it in the config
  const spinner = ora(`Creating new project: ${p.name}`).start();
  const newProject = await createNewProject(p);
  spinner.succeed('Project created');
  spinner.stopAndPersist({
    prefixText: '🚀',
    text: `Project created: ${newProject.id}`,
  });

  // Create the project directory
  const createDirSpinner = ora('Creating project directory').start();
  if (p.createDir) {
    await mkdir(p.projectPath);
    createDirSpinner.succeed(`Created project directory: ${p.projectPath}`);
  } else {
    createDirSpinner.info(`Using the current directory: ${p.projectPath}`);
  }

  // copy sampleTSProject to the project directory
  if (p.projectType === 'ts_express') {
    const fileSpinner = ora('Copying files to project directory').start();
    try {
      const docker = await fs.readFile('./sampleTSProject/Dockerfile');
      const ignore = await fs.readFile('./sampleTSProject/.gitignore');
      const src = await fs.readFile('./sampleTSProject/bundle.mjs');
      const tsconfig = await fs.readFile('./sampleTSProject/tsconfig.json');
      const editorconfig = await fs.readFile('./sampleTSProject/.editorconfig');

      await fs.writeFile(`${p.projectPath}/Dockerfile`, docker);
      await fs.writeFile(`${p.projectPath}/.gitignore`, ignore);
      await fs.writeFile(`${p.projectPath}/bundle.mjs`, src);
      await fs.writeFile(`${p.projectPath}/tsconfig.json`, tsconfig);
      await fs.writeFile(`${p.projectPath}/.editorconfig`, editorconfig);

      if (p.prettier) {
        const prettier = await fs.readFile('./sampleTSProject/.prettierrc');
        const prettierignore = await fs.readFile(
          './sampleTSProject/.prettierignore',
        );
        await fs.writeFile(`${p.projectPath}/.prettierrc`, prettier);
        await fs.writeFile(`${p.projectPath}/.prettierignore`, prettierignore);
      }

      if (p.eslint) {
        const eslint = await fs.readFile('./sampleTSProject/eslint.config.js');
        const eslintignore = await fs.readFile(
          './sampleTSProject/.eslintignore',
        );
        await fs.writeFile(`${p.projectPath}/.eslint.config.js`, eslint);
        await fs.writeFile(`${p.projectPath}/.eslintignore`, eslintignore);
      }

      fileSpinner.succeed('Files copied to project directory');
    } catch (error) {
      fileSpinner.fail('Failed to copy files to project directory');
      console.error(error);
    }
  }
  // Initialize the project with the build tool
  if (p.buildTool) {
    const buildSpinner = ora('Initializing project').start();
    await runCommand(p.buildTool, ['init'], p.projectPath);
    buildSpinner.succeed('Project initialized');
  }

  // Create the Git repository
  if (p.createGitRepo) {
    const gitRepoSpinner = ora('Creating Git repository').start();
    await runCommand('git', ['init'], p.projectPath);
    gitRepoSpinner.succeed('Git repository created');
  }

  // Create the README.md
  if (p.createReadme) {
    const readme = `# ${p.name}\n\n${p.description}`;
    const readmeSpinner = ora('Creating README.md').start();
    await fs.writeFile(`${p.projectPath}/README.md`, readme);
    readmeSpinner.succeed('README.md created');
  }

  // Create the GitHub repository
  if (p.createGHRepo) {
    if (!GitHubToken) {
      console.error(chalk.redBright.bold('GitHub token not found'));
      return;
    }
    const GH_USERNAME = process.env.GH_USERNAME;
    if (!GH_USERNAME) {
      console.error(chalk.redBright.bold('GitHub username not found'));
      return;
    }
    const GH = new GitHub(GitHubToken, GH_USERNAME);
    const ghRepoSpinner = ora('Creating GitHub repository').start();
    const { data: repo } = await GH.createRepo(p.name);
    ghRepoSpinner.succeed(`GitHub repository created: ${repo.html_url}`);
    // update the project
    const updateSpinner = ora('Updating project').start();
    await updateProject(newProject.id, { gitHubRepo: repo.html_url });
    updateSpinner.succeed('Project updated with GitHub repo');

    // Create the GitHub action workflow
    if (p.createGHAction) {
      const actionSpinner = ora('Creating GitHub action workflow').start();
      const mainYml = GH.makeGhActionFile();
      actionSpinner.text = `Writing GitHub action workflow to ${p.projectPath}/.github/workflows/main.yml`;
      // create the .github/workflows directory
      await mkdir(`${p.projectPath}/.github/workflows`, { recursive: true });
      await fs.writeFile(
        `${p.projectPath}/.github/workflows/main.yml`,
        mainYml,
      );

      // Add DO_REGISTRY_USERNAME and DO_REGISTRY_TOKEN to the repo secrets
      actionSpinner.text = 'Adding DigitalOcean registry secrets';

      const doRepoNameSecret: GHSecret = {
        repo: p.name,
        secret_name: 'DO_REPO_NAME',
        encrypted_value: p.name,
      };

      const doRegistrySecret: GHSecret = {
        repo: p.name,
        secret_name: 'DO_REGISTRY_NAME',
        encrypted_value: process.env.DO_REGISTRY_NAME || '',
      };

      const doAccessTokenSecret: GHSecret = {
        repo: p.name,
        secret_name: 'DIGITALOCEAN_ACCESS_TOKEN',
        encrypted_value: process.env.DO_API_TOKEN || '',
      };

      await GH.uploadRepoSecret(doRepoNameSecret);
      actionSpinner.text = 'Added DO_REPO_NAME secret';
      await GH.uploadRepoSecret(doRegistrySecret);
      actionSpinner.text = 'Added DO_REGISTRY_NAME secret';
      await GH.uploadRepoSecret(doAccessTokenSecret);
      actionSpinner.text = 'Added DIGITALOCEAN_ACCESS TOKEN secret';

      // Add the remote
      actionSpinner.text = 'Adding GitHub remote';

      await runCommand(
        'git',
        ['remote', 'add', 'origin', repo.html_url],
        p.projectPath,
      );

      // Commit the changes
      actionSpinner.text = 'Adding files to commit';
      await runCommand('git', ['add', '.'], p.projectPath);

      actionSpinner.text = 'Committing changes';

      await runCommand(
        'git',
        ['commit', '-m', '"Initial commit"'],
        p.projectPath,
      );

      actionSpinner.text = 'Pushing changes';

      await runCommand('git', ['push', '-u', 'origin', 'main'], p.projectPath);
      actionSpinner.succeed('GitHub action workflow created and pushed');
    }
  }

  // Create the DigitalOcean App
  if (p.createDoApp) {
    const doAppSpinner = ora('Creating DigitalOcean App').start();
    // build the image
    await runCommand(
      'docker',
      [
        'build',
        '-t',
        `registry.digitalocean.com/humidresearch/${p.name}:latest`,
        '.',
      ],
      p.projectPath,
    );
    doAppSpinner.text = 'Built Docker image';

    // push the image
    doAppSpinner.text = 'Pushing Docker image';
    const DO_REGISTRY_NAME = process.env.DO_REGISTRY_NAME;
    if (!DO_REGISTRY_NAME) {
      console.error('DigitalOcean registry name not found');
      return;
    }
    await runCommand(
      'docker',
      [
        'push',
        `registry.digitalocean.com/${DO_REGISTRY_NAME}/${p.name}:latest`,
      ],
      p.projectPath,
    );
    doAppSpinner.text = 'Pushed Docker image';

    // Create the DO App spec
    doAppSpinner.text = 'Creating DO App spec';
    const spec = createDoAppSpec(p.name, 3000, 'latest', p.name);
    doAppSpinner.text = 'Writing DO App spec';
    await writeDoAppSpec(p.name, spec, p.projectPath);
    doAppSpinner.text = 'Creating the DO App. Waiting for response...';
    const specResp = await createDoApp(spec);
    // Poll the DO API for the status of the app for the link
    const appStatus = await pollDoAppStatus(specResp.app.id, 5000);
    doAppSpinner.text = 'Created DO App. Writing config...';

    // Write the DO config to a file
    await fs.writeFile(
      `${p.projectPath}/do-config.json`,
      JSON.stringify(appStatus, null, 2),
    );
    doAppSpinner.succeed(
      `Created DigitalOcean App: ${appStatus?.app?.live_url}`,
    );
    // Update the project
    const updateSpinner = ora('Updating project').start();
    await updateProject(newProject.id, {
      do_link: appStatus.app.live_url,
      do_app_id: appStatus.app.id,
      do_config: spec,
    });
    updateSpinner.succeed('Project updated with DO App');
    // Display The table
    const project = await viewProject(newProject.id);
    const table = projectTable(project);
    console.log(table);
  }
};

export default createProject;
