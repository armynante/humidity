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
} from '../helpers/digitalOcean';
import type { GHSecret, NewProjectQuestions } from '../types/config';
import ora from 'ora';
import { projectTable } from '../helpers/transformers';
import process from 'node:process';
import Bun from 'bun';

const GitHubToken = process.env.GH_TOKEN;

const createProject = async () => {
  // Ask what the user wants to do
  // Create a new TS Project

  const p: NewProjectQuestions = {
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
    const docker = Bun.file('./sampleTSProject/Dockerfile');
    const ignore = Bun.file('./sampleTSProject/.gitignore');
    const src = Bun.file('./sampleTSProject/bundle.mjs');
    const tsconfig = Bun.file('./sampleTSProject/tsconfig.json');
    await Bun.write(`${p.projectPath}/Dockerfile`, docker);
    await Bun.write(`${p.projectPath}/.gitignore`, ignore);
    await Bun.write(`${p.projectPath}/bundle.mjs`, src);
    await Bun.write(`${p.projectPath}/tsconfig.json`, tsconfig);
    fileSpinner.succeed('Files copied to project directory');
  }

  // Create the Git repository
  if (p.createGitRepo) {
    const gitRepoSpinner = ora('Creating Git repository').start();
    const proc = Bun.spawn(['git', 'init'], {
      cwd: p.projectPath,
    });
    const output = await Bun.readableStreamToText(proc.stdout);
    gitRepoSpinner.text = output;
    gitRepoSpinner.succeed('Git repository created');
  }

  // Create the README.md
  if (p.createReadme) {
    const readme = `# ${p.name}\n\n${p.description}`;
    const readmeSpinner = ora('Creating README.md').start();
    await Bun.write(`${p.projectPath}/README.md`, readme);
    readmeSpinner.succeed('README.md created');
  }

  // Create the GitHub repository
  if (p.createGHRepo) {
    if (!GitHubToken) {
      console.error(chalk.redBright.bold('GitHub token not found'));
      return;
    }
    const GH = new GitHub(GitHubToken, 'armynante');
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
      await Bun.write(`${p.projectPath}/.github/workflows/main.yml`, mainYml);

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
      const procZero = Bun.spawn(
        ['git', 'remote', 'add', 'origin', repo.html_url],
        {
          cwd: p.projectPath,
        },
      );
      actionSpinner.text = await Bun.readableStreamToText(procZero.stdout);

      // Commit the changes
      actionSpinner.text = 'Committing changes';
      const proc = Bun.spawn(['git', 'add', '.'], {
        cwd: p.projectPath,
      });

      actionSpinner.text = await Bun.readableStreamToText(proc.stdout);
      actionSpinner.text = 'Committing changes';
      const proc2 = Bun.spawn(['git', 'commit', '-m', '"Initial commit"'], {
        cwd: p.projectPath,
      });
      actionSpinner.text = await Bun.readableStreamToText(proc2.stdout);

      actionSpinner.text = 'Pushing changes';
      const proc3 = Bun.spawn(['git', 'push', '-u', 'origin', 'main'], {
        cwd: p.projectPath,
      });
      actionSpinner.text = await Bun.readableStreamToText(proc3.stdout);
      actionSpinner.succeed('GitHub action workflow created and pushed');
    }
  }

  // Create the DigitalOcean App
  if (p.createDoApp) {
    const doAppSpinner = ora('Creating DigitalOcean App').start();
    // build the image
    const proc = Bun.spawn(
      [
        'docker',
        'build',
        '-t',
        `registry.digitalocean.com/humidresearch/${p.name}:latest`,
        '.',
      ],
      {
        cwd: p.projectPath,
      },
    );
    doAppSpinner.text = await Bun.readableStreamToText(proc.stdout);
    doAppSpinner.text = 'Built Docker image';

    // push the image
    doAppSpinner.text = 'Pushing Docker image';
    const proc2 = Bun.spawn(
      [
        'docker',
        'push',
        `registry.digitalocean.com/humidresearch/${p.name}:latest`,
      ],
      {
        cwd: p.projectPath,
      },
    );
    doAppSpinner.text = await Bun.readableStreamToText(proc2.stdout);
    doAppSpinner.text = 'Pushed Docker image';

    // Create the DO App spec
    doAppSpinner.text = 'Creating DO App spec';
    const spec = createDoAppSpec(p.name, 3000, 'latest', p.name);
    doAppSpinner.text = 'Writing DO App spec';
    await Bun.write(
      `${p.projectPath}/${p.name}.spec.yaml`,
      JSON.stringify(spec, null, 2),
    );
    doAppSpinner.text = 'Creating the DO App. Waiting for response...';
    const specResp = await createDoApp(spec);

    // Poll the DO API for the status of the app for the link
    const appStatus = await pollDoAppStatus(specResp.app.id, 5000);
    doAppSpinner.text = 'Created DO App. Writing config...';

    // Write the DO config to a file
    await Bun.write(
      `${p.projectPath}/do-config.json`,
      JSON.stringify(appStatus, null, 2),
    );
    doAppSpinner.succeed(`Created DigitalOcean App: ${appStatus.app.live_url}`);
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
