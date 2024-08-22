// Take a template and deploy it to a service

import type { ConfigService } from '../services/humidity/config/ConfigService';
import type { Config, Service } from '../types/config';
import { DeployService } from '../services/humidity/deploy/DeployService';
import { type ServiceType } from '../types/services';
import ora from 'ora';
import fs from 'fs/promises';
import { randomUUID } from 'crypto';
import { exit } from 'node:process';
import { select, input } from '@inquirer/prompts';
import chalk from 'chalk';
import { ServiceTable } from '../helpers/transformers';

const MENU_CHOICES: { name: string; value: string }[] = [
  { name: 'Deploy a service from a template', value: 'upload' },
  { name: 'List deployed services', value: 'list' },
  { name: 'Exit', value: 'exit_program' },
];

const buildMenuChoices = (services: ServiceType[]) => {
  let options = [{ name: 'Exit', value: 'exit' }];
  const serviceOptions = services.map((service) => ({
    name: service.name,
    value: service.value,
  }));
  return options.concat(serviceOptions);
};

type ActionHandler = (
  config: Config | null,
  ConfigInstance: ConfigService,
) => Promise<void> | void;

const Deploy = new DeployService();

const ACTION_HANDLERS: Record<string, ActionHandler> = {
  upload: async (config, ConfigInstance) => {
    try {
      const selected = await select({
        message: 'Select a service to deploy',
        choices: buildMenuChoices(Deploy.listServices()),
      });

      if (selected === 'exit') {
        return;
      }

      switch (selected) {
        case 'aws_upload': {
          const serviceName = await input({
            message: 'Enter a name for the upload service:',
            validate: (name: string) =>
              name.length > 0 || 'Please enter a name',
            default: 'aws_upload',
          });
          const uploadSpinner = ora('Uploading payload...').start();
          // Deploy the file upload service
          const payloadPath = Deploy.findService('aws_upload')?.fileLocation;
          if (!payloadPath) {
            uploadSpinner.fail('Service not found');
            return;
          }
          uploadSpinner.text = 'Reading payload...';
          const payload = await fs.readFile(payloadPath, 'utf-8');
          if (!payload) {
            uploadSpinner.fail('Payload not found');
            return;
          }
          uploadSpinner.text = 'Deploying service...';

          // Generate a random uuid for the service name to avoid conflicts
          const uuid = randomUUID();
          const internalName = serviceName + '-' + uuid;
          const lambdaConfig = await Deploy.deployService(
            'aws_upload',
            payload,
            internalName,
          );
          if (!lambdaConfig) {
            uploadSpinner.fail('Failed to deploy service');
            return;
          }
          uploadSpinner.text = 'Updating config with uuid: ' + uuid;
          const serviceConfig: Service = {
            name: serviceName,
            internal_name: internalName,
            config: lambdaConfig,
            url: lambdaConfig.url,
            id: uuid,
            apiId: lambdaConfig.apiId,
            created: new Date().toISOString(),
            updated: new Date().toISOString(),
            serviceType: 'aws_upload',
          };
          await ConfigInstance.addService(serviceConfig);
          uploadSpinner.succeed('Service deployed successfully');
          // render the service table
          console.log(ServiceTable(serviceConfig));
          exit(0);
          break;
        }
      }
    } catch (error) {
      console.error(error);
      exit(1);
      return;
    }
  },
  list: async (config, ConfigInstance) => {
    try {
      const services = await ConfigInstance.listServices();
      console.log('Services:');
      if (!services || services.length === 0) {
        console.log(
          chalk.whiteBright.bgRed.bold(
            'No projects found. Create a new project.',
          ),
        );
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
        await Deploy.destroyService(service, service.serviceType);
        deleteSpinner.text = 'Service deleted';
        await ConfigInstance.deleteService(selectedService);
        deleteSpinner.succeed('Config updated successfully');
        exit(0);
        return;
      }
      if (action === 'details') {
        console.log(ServiceTable(service));
        exit(0);
        return;
      }
    } catch (error) {
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

export const deploy = async (
  config: Config | null,
  confService: ConfigService,
): Promise<void> => {
  const action = await select({
    message: 'What do you want to do?',
    choices: MENU_CHOICES,
  });
  const handler = ACTION_HANDLERS[action];
  return await handler(config, confService as ConfigService);
};
