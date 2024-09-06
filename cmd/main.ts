import { select } from '@inquirer/prompts';
import { exit } from 'process';
import { displayLogo } from '../helpers/art';
import createProject from './newProject';
import listProjects from '../cmd/listProjects';
import { settings } from '../cmd/settings';
import type { ActionType } from '../types/commands';
import { ConfigService } from '../services/humidity/config/ConfigService';
import { deploy } from './deployService';
import { FileSystemWrapper } from '../helpers/filesystem';
import { Logger } from '../helpers/logger';
import { TemplateService } from '../services/humidity/templates/TemplateService';
import { DeployService } from '../services/humidity/deploy/DeployService';
const MENU_CHOICES: { name: string; value: ActionType }[] = [
  { name: 'Create a new project ✨', value: 'new' },
  { name: 'Projects 🗂️', value: 'ls' },
  { name: 'Service templates 🛠️', value: 'services' },
  { name: 'Settings 📎', value: 'settings' },
  { name: 'Exit', value: 'exit' },
];

const ACTION_HANDLERS: Record<ActionType, any> = {
  settings: async () => {
    const config = await ConfigInstance.load();
    if (config === null) {
      logger.extWarn('No existing configuration. Creating a new one.');
    }
    await settings(config, ConfigInstance);
  },
  new: async () => {
    logger.extInfo('Creating a new project...');
    await createProject();
  },
  ls: async () => {
    logger.extInfo('Listing projects...');
    await listProjects(true);
  },
  services: async () => await deploy(),
  test: () => console.log('Running function test...'),
  exit: () => {
    console.log('Exiting...');
    exit(0);
  },
};

export const logger = new Logger('EXT_DEBUG');
export const FileSystem = new FileSystemWrapper();
export const ConfigInstance = new ConfigService(FileSystem, logger);
export const TemplateInstance = new TemplateService(FileSystem, logger);
export const DeployInstance = new DeployService();
export const main = async (): Promise<void> => {
  displayLogo();

  const [created, config] = await ConfigInstance.init();

  if (created) {
    logger.extInfo('Configuration file created successfully.');
    logger.extWarn('Please update the configuration file with your details.');
  }

  const action = await select<ActionType>({
    message: 'What do you want to do?',
    choices: MENU_CHOICES,
  });

  const handler = ACTION_HANDLERS[action];
  await handler(config, ConfigInstance as ConfigService);
};
