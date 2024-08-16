import { select } from '@inquirer/prompts';
import chalk from 'chalk';
import { exit } from 'process';
import { displayLogo } from '../helpers/art';
import { checkConfigExists, loadConfigFromEnv } from '../helpers/config';
import createProject from '../cmd/newProject';
import listProjects from '../cmd/listProjects';
import { settings } from '../cmd/settings';
import type { ActionType } from '../types/commands';
import type { Config } from '../types/config';

const MENU_CHOICES: { name: string; value: ActionType }[] = [
  { name: 'Create a new project', value: 'new' },
  { name: 'List projects', value: 'ls' },
  { name: 'Deploy a service', value: 'deploy' },
  { name: 'Settings', value: 'settings' },
  { name: 'Function Test', value: 'test' },
  { name: 'Exit', value: 'exit' },
];

type ActionHandler = (config: Config | null) => Promise<void> | void;

const ACTION_HANDLERS: Record<ActionType, ActionHandler> = {
  settings: async (config) => {
    if (config === null) {
      console.log(
        chalk.yellow('No existing configuration. Creating a new one.'),
      );
      return showErrorAndExit('No existing configuration. Creating a new one.');
    }
    await settings(config);
  },
  new: async () => {
    console.log('Creating a new project...');
    await createProject();
  },
  ls: async () => {
    console.log('Listing projects...');
    await listProjects();
  },
  deploy: () => console.log('Deploying a service...'),
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

const loadConfig = async (): Promise<Config | null> => {
  const config = await checkConfigExists();
  if (config && config.useEnvFile) {
    await loadConfigFromEnv(config.envPath);
    return config;
  } else {
    console.log(
      chalk.yellow(' !!! No config file found. Running in limited mode. \n'),
    );
    return null;
  }
};

export const main = async (): Promise<void> => {
  displayLogo();

  const config = await loadConfig();

  const action = await select<ActionType>({
    message: 'What do you want to do?',
    choices: MENU_CHOICES,
  });

  const handler = ACTION_HANDLERS[action];
  await handler(config);
};
