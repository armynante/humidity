import fs from 'fs/promises';
import { randomUUID } from 'crypto';
import { ConfigInstance } from '../../../cmd/main';
import type { Service } from '../../../types/config';
import ora from 'ora';
import { ServiceTable } from '../../../helpers/transformers';
import { Logger } from '../../../helpers/logger';
import { AWSLambdaClient } from '../../serverless/AWSLambdaClient/AWSLambdaClient';
import { BucketService } from '../../storage/AWS/AWSBucketService';

export class InstantDatabaseService {
  private logger = new Logger('EXT_DEBUG', 'InstantDatabaseService');

  constructor(private payload?: string) {
    this.payload = payload;
  }

  async up(serviceName: string): Promise<void> {
    const deploySpinner = ora('Deploying Instant Database...').start();

    try {
      // Find the service
      if (!this.payload) {
        deploySpinner.fail('Service template not found');
        return;
      }

      // Create a uuid
      const uuid = randomUUID();
      const internalName = serviceName + '-' + uuid;

      // Create a bucket
      deploySpinner.text = `Creating bucket: ${internalName}...`;
      const bucketClient = new BucketService();
      await bucketClient.createBucket(internalName);
      deploySpinner.succeed(`Bucket created: ${internalName}`);

      // Deploy the service
      const awsLambdaClient = new AWSLambdaClient();
      const lambdaConfig = await awsLambdaClient.createOrUpdateFunction({
        name: internalName,
        code: this.payload,
      });

      // Create config
      deploySpinner.text = 'Updating config with uuid: ' + uuid;
      const serviceConfig: Service = {
        name: serviceName,
        internal_name: internalName,
        config: { ...lambdaConfig, internalName },
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

  async down(serviceId: string): Promise<void> {
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
      const awsLambdaClient = new AWSLambdaClient();
      await awsLambdaClient.tearDown(service);
      destroySpinner.text = 'Lambda function and API Gateway removed';

      // Delete the associated S3 bucket
      if (service.config.bucketName) {
        destroySpinner.text = `Deleting bucket: ${service.config.bucketName}...`;
        const bucketClient = new BucketService();
        await bucketClient.deleteBucket(service.config.bucketName);
        this.logger.info(`Bucket deleted: ${service.config.bucketName}`);
        destroySpinner.text = `Bucket deleted: ${service.config.bucketName}`;
      } else {
        destroySpinner.fail('Bucket name not found');
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
