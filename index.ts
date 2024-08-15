import { select, confirm } from '@inquirer/prompts';
import { displayLogo } from './helpers/art';
import createProject from './cmd/newProject';
import listProjects from './cmd/listProjects';
import { exit } from 'process';
import {
  checkConfigExists,
  createConfig,
  loadConfigFromEnv,
  validateEnvFile,
} from './helpers/config';
import chalk from 'chalk';
import { settings } from './cmd/settings';
import { AWSLambdaClient } from './services/serverless/AWSLambdaClient/AWSLambdaClient';
import axios, { AxiosError } from 'axios';
import testBucketIntegration from './services/serverless/BucketClient/bucketTest';

// Shows CLI logo
displayLogo();

// Load environment variables from .env file
const config = await checkConfigExists();
if (config && config.useEnvFile) {
  await loadConfigFromEnv(config.envPath);
} else {
  console.log(
    chalk.whiteBright.bgRed.bold(
      ' !!! No config file found. Please run the setup command \n',
    ),
  );
}

const whatToDo = await select({
  message: 'What do you want to do?',
  choices: [
    { name: 'Create a new project', value: 'new' },
    { name: 'List projects', value: 'ls' },
    { name: 'Deploy a service', value: 'deploy' },
    { name: 'Settings', value: 'settings' },
    { name: 'Function Test', value: 'test' },
    { name: 'Exit', value: 'exit' },
  ],
});

if (whatToDo !== 'settings') {
  if (!config) {
    console.log(
      chalk.whiteBright.bgRed.bold(
        ' !!! No config file found. Please run the setup command \n',
      ),
    );
    exit(1);
  }
}

switch (whatToDo) {
  case 'settings': {
    await settings(config);
    break;
  }
  case 'new':
    console.log('Creating a new project...');
    await createProject();
    break;
  case 'ls':
    console.log('Listing projects...');
    await listProjects();
    break;
  case 'deploy':
    console.log('Deploying a service...');
    break;
  case 'exit':
    console.log('Exiting...');
    exit(0);
    break;
  default:
    console.log('Invalid choice');
    exit(1);
}
