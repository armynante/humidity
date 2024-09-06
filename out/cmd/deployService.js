import ora from 'ora';
import { exit } from 'node:process';
import { select, input, checkbox } from '@inquirer/prompts';
import chalk from 'chalk';
import { ServiceTable } from '../helpers/transformers.js';
import { DeployInstance, TemplateInstance, ConfigInstance } from './main.js';
import { listEnvs } from '../helpers/config.js';
const MENU_CHOICES = [
    { name: 'Deploy a service using a template', value: 'upload' },
    { name: 'List deployed services', value: 'list' },
    { name: 'Create a new template', value: 'create_template' },
    { name: 'Destroy a template', value: 'destroy_template' },
    { name: 'Exit', value: 'exit_program' },
];
const handleCreateTemplate = async () => {
    const createSpinner = ora('Creating template...');
    try {
        const templateName = await input({
            message: 'Enter a name for the new template like "My Cool Service":',
            validate: (name) => name.length > 0 || 'Please enter a name',
        });
        const templateDescription = await input({
            message: 'Enter a description for the new template:',
            validate: (description) => description.length > 0 || 'Please enter a description',
        });
        // Default to the template name to dash case
        const shortNameDefault = templateName.replace(/ /g, '-').toLowerCase();
        // Validate the short name to make sure it only contains letters, numbers, and underscores, and is in snake case and not empty
        const shortName = await input({
            message: 'Enter a short name for the new template:',
            default: shortNameDefault,
            validate: (name) => {
                if (name.length === 0) {
                    return 'Please enter a name';
                }
                if (!name.match(/^[a-z0-9-]+$/)) {
                    return 'Please enter a name in snake case';
                }
                return true;
            },
        });
        const templateKeyOptions = listEnvs();
        const templateKeys = await checkbox({
            message: 'Select the environment variables for the template:',
            choices: templateKeyOptions.map((key) => ({
                name: key,
                value: key,
            })),
        });
        createSpinner.start();
        await TemplateInstance.createTemplate(templateName, templateDescription, shortName, 
        // @ts-ignore
        templateKeys);
        createSpinner.succeed(`Template "${templateName}" created successfully`);
    }
    catch (error) {
        createSpinner.fail(`Failed to create template: ${error.message}`);
    }
    exit(0);
};
const handleDestroyTemplate = async () => {
    try {
        const templates = ConfigInstance.getTemplates();
        if (templates.length === 0) {
            console.log(chalk.yellow('No templates found.'));
            return;
        }
        const templateToDestroy = await select({
            message: 'Select a template to destroy:',
            choices: [
                ...templates.map((template) => ({
                    name: template.name,
                    value: template.id,
                })),
                { name: 'Cancel', value: 'cancel' },
            ],
        });
        if (templateToDestroy === 'cancel') {
            console.log('Operation cancelled.');
            return;
        }
        const template = await TemplateInstance.getTemplateById(templateToDestroy);
        if (!template) {
            console.log(chalk.red('Template not found'));
            return;
        }
        const confirmDestroy = await select({
            message: `Are you sure you want to destroy the template "${template.name}"?`,
            choices: [
                { name: 'Yes', value: true },
                { name: 'No', value: false },
            ],
        });
        if (!confirmDestroy) {
            console.log('Template destruction cancelled.');
            return;
        }
        const destroySpinner = ora(`Destroying template "${template.name}"...`).start();
        await TemplateInstance.removeTemplate(templateToDestroy);
        destroySpinner.succeed(`Template "${templateToDestroy}" destroyed successfully`);
    }
    catch (error) {
        console.error(`Error listing or destroying templates: ${error.message}`);
    }
    exit(0);
};
const buildMenuChoices = (services) => {
    let options = [{ name: 'Exit', value: 'exit' }];
    const serviceOptions = services.map((service) => ({
        name: service.name,
        value: service.internal_name,
    }));
    return options.concat(serviceOptions);
};
const ACTION_HANDLERS = {
    create_template: handleCreateTemplate,
    destroy_template: handleDestroyTemplate,
    upload: async () => {
        try {
            const selected = await select({
                message: 'Select a service to deploy',
                choices: buildMenuChoices(DeployInstance.listServices()),
            });
            if (selected === 'exit') {
                return;
            }
            switch (selected) {
                case 'aws_upload': {
                    const serviceName = await input({
                        message: 'Enter a name for the upload service:',
                        validate: (name) => name.length > 0 || 'Please enter a name',
                        default: 'aws-upload',
                    });
                    await DeployInstance.deployService(selected, serviceName);
                    exit(0);
                    break;
                }
                case 'instant_database': {
                    const serviceName = await input({
                        message: 'Enter a name for the database service:',
                        validate: (name) => name.length > 0 || 'Please enter a name',
                        default: 'instant-database',
                    });
                    await DeployInstance.deployService(selected, serviceName);
                    exit(0);
                    break;
                }
            }
        }
        catch (error) {
            exit(1);
            return;
        }
    },
    list: async () => {
        try {
            const services = await ConfigInstance.listServices();
            console.log('Services:');
            if (!services || services.length === 0) {
                console.log(chalk.whiteBright.bgRed.bold('No projects found. Create a new project.'));
            }
            const servicePrompts = services.map((service) => ({
                name: service.name,
                value: service.id,
            }));
            const selectedService = await select({
                message: 'Select a service to view details or delete:',
                choices: [...servicePrompts, { name: 'Exit', value: 'exit' }],
            });
            if (selectedService === 'exit') {
                exit();
                return;
            }
            const service = await ConfigInstance.viewService(selectedService);
            if (!service) {
                console.log('Service not found');
                exit(1);
                return;
            }
            const action = await select({
                message: 'What do you want to do?',
                choices: [
                    { name: 'View details', value: 'details' },
                    { name: 'Delete service', value: 'delete' },
                    { name: 'Exit', value: 'exit' },
                ],
            });
            if (action === 'exit') {
                exit(0);
                return;
            }
            if (action === 'delete') {
                const confirm = await select({
                    message: `Are you sure you want to delete ${service.name}?`,
                    choices: [
                        { name: 'Yes', value: true },
                        { name: 'No', value: false },
                    ],
                });
                if (!confirm) {
                    console.log('Not deleting service');
                    exit(0);
                    return;
                }
                const deleteSpinner = ora('Deleting service...').start();
                await DeployInstance.destroyService(service);
                deleteSpinner.text = 'Service deleted';
                deleteSpinner.succeed('Config updated successfully');
                exit(0);
                return;
            }
            if (action === 'details') {
                console.log(ServiceTable(service));
                exit(0);
                return;
            }
        }
        catch (error) {
            console.error(error);
            exit(1);
            return;
        }
    },
    exit_program: () => {
        console.log('Exiting...');
        exit(0);
    },
};
export const deploy = async () => {
    const action = await select({
        message: 'What do you want to do?',
        choices: MENU_CHOICES,
    });
    // @ts-ignore
    const handler = ACTION_HANDLERS[action];
    return await handler();
};
