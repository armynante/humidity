import { select } from '@inquirer/prompts';
import { exit } from 'process';
import { displayLogo } from '../helpers/art.js';
import createProject from './newProject.js';
import listProjects from '../cmd/listProjects.js';
import { settings } from '../cmd/settings.js';
import { ConfigService } from '../services/humidity/config/ConfigService.js';
import { deploy } from './deployService.js';
import { FileSystemWrapper } from '../helpers/filesystem.js';
import { Logger } from '../helpers/logger.js';
import { TemplateService } from '../services/humidity/templates/TemplateService.js';
import { DeployService } from '../services/humidity/deploy/DeployService.js';
const MENU_CHOICES = [
    { name: 'Create a new project ✨', value: 'new' },
    { name: 'Projects 🗂️', value: 'ls' },
    { name: 'Service templates 🛠️', value: 'services' },
    { name: 'Settings 📎', value: 'settings' },
    { name: 'Exit', value: 'exit' },
];
const ACTION_HANDLERS = {
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
export const main = async () => {
    displayLogo();
    const [created, config] = await ConfigInstance.init();
    if (created) {
        logger.extInfo('Configuration file created successfully.');
        logger.extWarn('Please update the configuration file with your details.');
    }
    const action = await select({
        message: 'What do you want to do?',
        choices: MENU_CHOICES,
    });
    const handler = ACTION_HANDLERS[action];
    await handler(config, ConfigInstance);
};
