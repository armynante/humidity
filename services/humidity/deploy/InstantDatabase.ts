import fs from 'fs/promises';
import { randomUUID } from 'crypto';
import {
  DeployInstance,
  ConfigInstance,
  AWSBucketInstance,
} from '../../../cmd/main';
import type { Service } from '../../../types/config';
import ora from 'ora';
import { ServiceTable } from '../../../helpers/transformers';
import { Logger } from '../../../helpers/logger';

export class InstantDatabaseService {
  private logger = new Logger('EXT_DEBUG', 'InstantDatabaseService');

  async deployService(serviceName: string): Promise<void> {
    const deploySpinner = ora('Deploying Instant Database...').start();

    try {
      // Find the service
      const payloadPath =
        DeployInstance.findService('instant_database')?.fileLocation;
      if (!payloadPath) {
        deploySpinner.fail('Service template not found');
        return;
      }

      // Read the payload
      deploySpinner.text = 'Reading template...';
      const payload = await fs.readFile(payloadPath, 'utf-8');
      if (!payload) {
        deploySpinner.fail('Template not found');
        return;
      }

      // Create a bucket
      const bucketName = `instant-db-${randomUUID()}`;
      deploySpinner.text = `Creating bucket: ${bucketName}...`;
      await AWSBucketInstance.createBucket(bucketName);
      this.logger.info(`Bucket created: ${bucketName}`);

      // Deploy the service
      deploySpinner.text = 'Deploying database service...';
      const uuid = randomUUID();
      const internalName = serviceName + '-' + uuid;
      const lambdaConfig = await DeployInstance.deployService(
        'instant_database',
        payload,
        internalName,
      );

      if (!lambdaConfig) {
        deploySpinner.fail('Failed to deploy database service');
        return;
      }

      // Update config
      deploySpinner.text = 'Updating config with uuid: ' + uuid;
      const serviceConfig: Service = {
        name: serviceName,
        internal_name: internalName,
        config: { ...lambdaConfig, bucketName },
        url: lambdaConfig.url,
        id: uuid,
        apiId: lambdaConfig.apiId,
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        serviceType: 'instant_database',
      };

      await ConfigInstance.addService(serviceConfig);
      deploySpinner.succeed('Instant Database service deployed successfully');

      // Render the service table
      console.log(ServiceTable(serviceConfig));
    } catch (error) {
      deploySpinner.fail(`Error: ${(error as Error).message}`);
    }
  }

  async destroyService(serviceId: string): Promise<void> {
    const destroySpinner = ora(
      'Destroying Instant Database service...',
    ).start();

    try {
      // Fetch the service configuration
      const service = await ConfigInstance.viewService(serviceId);
      if (!service) {
        destroySpinner.fail('Service not found');
        return;
      }

      // Destroy the Lambda function and API Gateway
      destroySpinner.text = 'Removing Lambda function and API Gateway...';
      await DeployInstance.destroyService(service, 'instant_database');

      // Delete the associated S3 bucket
      if (service.config.bucketName) {
        destroySpinner.text = `Deleting bucket: ${service.config.bucketName}...`;
        await AWSBucketInstance.deleteBucket(service.config.bucketName);
        this.logger.info(`Bucket deleted: ${service.config.bucketName}`);
        destroySpinner.succeed(`Bucket deleted: ${service.config.bucketName}`);
      }

      // Remove the service from the configuration
      destroySpinner.text = 'Updating configuration...';
      await ConfigInstance.deleteService(serviceId);

      destroySpinner.succeed('Instant Database service destroyed successfully');
    } catch (error) {
      destroySpinner.fail(`Error: ${(error as Error).message}`);
    }
  }
}

export const instantDatabaseService = new InstantDatabaseService();
