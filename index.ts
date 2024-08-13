import { select, confirm } from '@inquirer/prompts';
import { displayLogo } from './helpers/art';
import * as dotenv from 'dotenv';
import createProject from './cmd/newProject';
import listProjects from './cmd/listProjects';
import { exit } from 'process';
import {
  checkConfigExists,
  createConfig,
  validateEnvFile,
} from './helpers/config';
import chalk from 'chalk';

// Shows CLI logo
displayLogo();

// Load environment variables from .env file
const [config, hasConfig] = await checkConfigExists();
console.log(config, hasConfig);
if (hasConfig && config!.useEnvFile) {
  dotenv.config({ path: [config!.envPath, '.env.humidiy'] });
  // Validate the .env file
  const [isMissing, missingEnvs] = await validateEnvFile(config!.envPath);
  console.log('Missing envs', missingEnvs);
  if (isMissing) {
    console.log(
      chalk.whiteBright.bgRed.bold(
        ' !!! Missing environment variables. Please update your .env file \n',
      ),
    );
    console.log(missingEnvs);
    exit(1);
  }
}

const whatToDo = await select({
  message: 'What do you want to do?',
  choices: [
    { name: 'Create a new project', value: 'new' },
    { name: 'List projects', value: 'ls' },
    { name: 'Deploy a service', value: 'deploy' },
    { name: 'Settings', value: 'settings' },
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
    console.log('Setting up...');
    const setup = await confirm({
      message: 'Do you want to create a config file in your home directory?',
    });
    if (setup) {
      console.log('Creating config file...');
      await createConfig();
    }
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
