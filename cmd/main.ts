import { select } from '@inquirer/prompts';
import chalk from 'chalk';
import { exit } from 'process';
import { displayLogo } from '../helpers/art';
import createProject from '../cmd/newProject';
import listProjects from '../cmd/listProjects';
import { settings } from '../cmd/settings';
import type { ActionType } from '../types/commands';
import type { Config } from '../types/config';
import { ConfigService } from '../services/ConfigService/ConfigService';

const MENU_CHOICES: { name: string; value: ActionType }[] = [
  { name: 'Create a new project', value: 'new' },
  { name: 'List projects', value: 'ls' },
  { name: 'Deploy a service', value: 'deploy' },
  { name: 'Settings', value: 'settings' },
  { name: 'Function Test', value: 'test' },
  { name: 'Exit', value: 'exit' },
];

type ActionHandler = (
  config: Config | null,
  ConfigInstance: ConfigService,
) => Promise<void> | void;

const ACTION_HANDLERS: Record<ActionType, ActionHandler> = {
  settings: async (config, ConfigInstance) => {
    if (config === null) {
      console.log(
        chalk.yellow('No existing configuration. Creating a new one.'),
      );
      return showErrorAndExit('No existing configuration. Creating a new one.');
    }
    await settings(config, ConfigInstance);
  },
  new: async (_, ConfigInstance) => {
    console.log('Creating a new project...');
    await createProject(ConfigInstance);
  },
  ls: async (_, ConfigInstance) => {
    console.log('Listing projects...');
    await listProjects(ConfigInstance, true);
  },
  deploy: () => console.log('Deploying...'),
  test: () => console.log('Running function test...'),
  exit: () => {
    console.log('Exiting...');
    exit(0);
  },
};

const showErrorAndExit = (message: string): never => {
  console.log(chalk.whiteBright.bgRed.bold(message));
  exit(1);
};

export const main = async (): Promise<void> => {
  displayLogo();
  const ConfigInstance = new ConfigService();

  const [created, config] = await ConfigInstance.init();

  if (created) {
    console.log(
      chalk.green('New configuration created at ~/.humidity/config.json'),
    );
    console.log(
      chalk.yellow('Please update the configuration file with your settings.'),
    );
  }

  const action = await select<ActionType>({
    message: 'What do you want to do?',
    choices: MENU_CHOICES,
  });

  const handler = ACTION_HANDLERS[action];
  await handler(config, ConfigInstance as ConfigService);
};
