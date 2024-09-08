import { mkdir } from 'node:fs/promises';
import { select, input, confirm } from '@inquirer/prompts';
import chalk from 'chalk';
import DigitalOceanService from '../services/compute/DigitalOceanClient/DigitalOceanClient.js';
import { EnvKeys } from '../types/enums.js';
import ora from 'ora';
import { projectTable } from '../helpers/transformers.js';
import { runCommand } from '../helpers/io.js';
import fs from 'node:fs/promises';
import { copyTsStarterFiles, } from '../helpers/newProject.js';
import GitHub from '../helpers/github.js';
import { ConfigInstance, logger } from './main.js';
import { Logger } from '../helpers/logger.js';
import dotenv from 'dotenv';
dotenv.config();
const createProject = async () => {
    try {
        const projectDetails = await gatherProjectDetails();
        const newProject = await createAndSetupProject(projectDetails);
        await setupVersionControl(projectDetails, newProject);
        await setupCloudDeployment(projectDetails, newProject);
        await displayProjectSummary(newProject);
    }
    catch (error) {
        console.error(chalk.red('An error occurred while creating the project:'), error);
    }
};
const gatherProjectDetails = async () => {
    const projectPath = process.cwd();
    const projectType = await select({
        message: 'What type of project do you want to make?',
        choices: [
            { name: 'TypeScript ExpressJS server', value: 'ts_express' },
            { name: 'Go Fiber server', value: 'go_fiber' },
            { name: 'Exit', value: 'exit' },
        ],
    });
    if (projectType === 'exit') {
        console.log('Exiting project creation');
        process.exit(0);
    }
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
        message: 'Do you want to create a new folder for your project or use the current directory?',
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
            message: 'Do you want to create a GitHub action workflow for auto-deploys?',
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
const createAndSetupProject = async (details) => {
    const spinner = ora(`Creating new project: ${details.name}`).start();
    const newProject = await ConfigInstance.createNewProject(details);
    spinner.succeed(`Project created: ${newProject.id}`);
    await createProjectStructure(details);
    await setupProjectFiles(details);
    return newProject;
};
const createProjectStructure = async (details) => {
    if (details.createDir) {
        await mkdir(details.projectPath, { recursive: true });
    }
};
const setupProjectFiles = async (details) => {
    const fileSpinner = ora('Setting up project files').start();
    try {
        if (details.projectType === 'ts_express') {
            await copyTsStarterFiles(details, ['Dockerfile', 'nodemon.json', 'src/index.ts', 'tsconfig.json', 'package.json']);
            if (details.prettier)
                await copyTsStarterFiles(details, ['.prettierrc', '.prettierignore']);
            if (details.eslint)
                await copyTsStarterFiles(details, ['.eslintignore', 'eslint.config.js']);
            if (details.buildTool) {
                fileSpinner.text = 'Building project';
                await runCommand(details.buildTool, ['install'], details.projectPath);
            }
        }
        if (details.createReadme) {
            const readme = `# ${details.name}\n\n${details.description} \n **Created with the Humidity CLI**`;
            await fs.writeFile(`${details.projectPath}/README.md`, readme);
        }
        fileSpinner.succeed('Project files set up successfully');
    }
    catch (error) {
        logger.error('Failed to set up project files');
        fileSpinner.fail('Failed to set up project files');
        throw error;
    }
};
const setupVersionControl = async (details, newProject) => {
    if (details.createGitRepo) {
        const gitSpinner = ora('Setting up version control\n').start();
        try {
            await runCommand('git', ['init'], details.projectPath);
            if (details.createGHRepo) {
                // Check if the user has a GitHub token
                const config = await ConfigInstance.load();
                const [validFile, missingEnvVars] = await ConfigInstance.validateEnvFile([
                    // @ts-ignore
                    EnvKeys.GH_USERNAME,
                    // @ts-ignore
                    EnvKeys.GH_TOKEN,
                ]);
                if (!validFile &&
                    missingEnvVars.includes(EnvKeys.GH_USERNAME) &&
                    missingEnvVars.includes(EnvKeys.GH_TOKEN)) {
                    console.log(chalk.yellow('Please set the GH_USERNAME and GH_TOKEN in your .env file to continue'));
                    return;
                }
                const GH_USERNAME = process.env.GH_USERNAME;
                const GH_TOKEN = process.env.GH_TOKEN;
                const GH = new GitHub(GH_TOKEN, GH_USERNAME);
                const { data: repo } = await GH.createRepo(details.name);
                await ConfigInstance.updateProject(newProject.id, {
                    gitHubRepo: repo.html_url,
                });
                if (details.createGHAction) {
                    await setupGitHubAction(details, GH, repo);
                }
                // Add .gitignore
                await fs.writeFile(`${details.projectPath}/.gitignore`, 'node_modules\n.env');
                // Add remote and push
                await runCommand('git', ['remote', 'add', 'origin', repo.html_url], details.projectPath);
                await runCommand('git', ['add', '.'], details.projectPath);
                await runCommand('git', ['commit', '-m', '"Initial commit"'], details.projectPath);
                await runCommand('git', ['push', '-u', 'origin', 'main'], details.projectPath);
            }
            gitSpinner.succeed('Version control set up successfully');
        }
        catch (error) {
            gitSpinner.fail('Failed to set up version control');
            throw error;
        }
    }
};
const setupGitHubAction = async (details, GH, repo) => {
    const actionSpinner = ora('Setting up GitHub Action').start();
    try {
        const mainYml = GH.makeGhActionFile();
        await mkdir(`${details.projectPath}/.github/workflows`, {
            recursive: true,
        });
        await fs.writeFile(`${details.projectPath}/.github/workflows/main.yml`, mainYml);
        const secrets = [
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
    }
    catch (error) {
        actionSpinner.fail('Failed to set up GitHub Action');
        throw error;
    }
};
const setupCloudDeployment = async (details, newProject) => {
    if (details.createDoApp) {
        const doSpinner = ora('Setting up DigitalOcean App').start();
        // Check if the user has a DigitalOcean token
        const config = await ConfigInstance.load();
        const validEnvs = ConfigInstance.checkEnvVars([
            // @ts-ignore
            EnvKeys.DO_API_TOKEN,
            // @ts-ignore
            EnvKeys.DO_REGISTRY_NAME,
        ]);
        if (validEnvs !== true) {
            const logger = new Logger('EXT_DEBUG', 'New Project');
            logger.error('Missing required environment variables');
            logger.error(
            // @ts-ignore
            `The following environment variables are required: ${validEnvs.join(', ')}`);
            return;
        }
        const DO_API_TOKEN = process.env.DO_API_TOKEN;
        const DO_REGISTRY_NAME = process.env.DO_REGISTRY_NAME;
        const doService = new DigitalOceanService(DO_API_TOKEN);
        try {
            // Build and push Docker image
            logger.extInfo('Building and pushing Docker image');
            await runCommand('docker', [
                'build',
                '-t',
                `registry.digitalocean.com/${DO_REGISTRY_NAME}/${details.name}:latest`,
                '.',
            ], details.projectPath);
            logger.extInfo('Docker image built');
            await runCommand('docker', [
                'push',
                `registry.digitalocean.com/${DO_REGISTRY_NAME}/${details.name}:latest`,
            ], details.projectPath);
            logger.extInfo('Docker image pushed');
            // Create and deploy DO App
            const spec = doService.createDoAppSpec(details.name, 3000, 'latest', details.name);
            await doService.writeDoAppSpec(details.name, spec, details.projectPath);
            logger.extInfo('DigitalOcean App spec written');
            const [createAppResponse, createAppError] = await doService.createDoApp(spec);
            logger.extInfo('Creating DigitalOcean App');
            logger.extInfo('DigitalOcean App created, proceeding with setup');
            if (createAppError || !createAppResponse) {
                throw new Error(`Failed to create DigitalOcean App: ${createAppError}`);
            }
            const appId = createAppResponse.id;
            if (!appId) {
                throw new Error('Failed to get app ID from DigitalOcean response');
            }
            const [appStatus, pollError] = await doService.pollDoAppStatus(appId, 5000);
            if (pollError || !appStatus) {
                throw new Error(`Failed to poll DigitalOcean App status: ${pollError}`);
            }
            await fs.writeFile(`${details.projectPath}/do-config.json`, JSON.stringify(appStatus, null, 2));
            await ConfigInstance.updateProject(newProject.id, {
                do_link: appStatus.app.live_url,
                do_app_id: appStatus.app.id,
                do_config: spec,
            });
            doSpinner.succeed(`DigitalOcean App created: ${appStatus.app.live_url}`);
        }
        catch (error) {
            doSpinner.fail('Failed to set up DigitalOcean App');
            throw error;
        }
    }
};
const displayProjectSummary = async (project) => {
    const updatedProject = await ConfigInstance.viewProject(project.id);
    const table = projectTable(updatedProject);
    console.log(table);
};
export default createProject;
