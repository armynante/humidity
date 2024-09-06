import { randomUUID } from 'node:crypto';
import { ConfigInstance } from '../../../cmd/main';
import type { Service } from '../../../types/config';
import ora from 'ora';
import { ServiceTable } from '../../../helpers/transformers';
import { AWSLambdaClient } from '../../serverless/AWSLambdaClient/AWSLambdaClient';
import { BucketService } from '../../storage/AWS/AWSBucketService';
import { Logger } from '../../../helpers/logger';

export class AwsUploadService {
  private logger = new Logger('EXT_DEBUG', 'AwsUploadService');
  private payload?: string;

  constructor(payload?: string) {
    this.payload = payload;
  }

  async up(serviceName: string): Promise<void> {
    const uploadSpinner = ora('Deploying AWS Upload service...').start();

    try {
      // Deploy the service
      if (!this.payload) {
        uploadSpinner.fail('Service template not found');
        return;
      }

      const uuid = randomUUID();
      const internalName = serviceName + '-' + uuid;

      // Create the bucket
      const bucketClient = new BucketService();
      await bucketClient.createBucket(internalName);

      // Create the lambda function
      const awsLambdaClient = new AWSLambdaClient();
      const lambdaConfig = await awsLambdaClient.createOrUpdateFunction({
        name: internalName,
        code: this.payload,
      });

      if (!lambdaConfig) {
        uploadSpinner.fail('Failed to deploy service');
        this.logger.error('Failed to deploy service');
        return;
      }

      // Update config
      uploadSpinner.text = 'Updating config with uuid: ' + uuid;
      const serviceConfig: Service = {
        name: serviceName,
        internal_name: internalName,
        config: {
          ...lambdaConfig,
          bucketName: internalName,
        },
        url: lambdaConfig.url,
        id: uuid,
        apiId: lambdaConfig.apiId,
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        serviceType: 'aws_upload',
      };
      this.logger.debug('Service config', serviceConfig);

      await ConfigInstance.addService(serviceConfig);
      uploadSpinner.succeed('Service deployed successfully');

      // Render the service table
      console.log(ServiceTable(serviceConfig));
    } catch (error) {
      uploadSpinner.fail(`Error: ${(error as Error).message}`);
    }
  }

  async down(serviceName: string): Promise<void> {
    const destroySpinner = ora('Destroying AWS Upload service...').start();

    try {
      // Fetch the service configuration
      const service = await ConfigInstance.viewService(serviceName);
      if (!service) {
        destroySpinner.fail('Service not found');
        return;
      }

      destroySpinner.text = 'Removing Lambda function and API Gateway...';
      const awsLambdaClient = new AWSLambdaClient();
      await awsLambdaClient.tearDown(service);
      destroySpinner.text = 'Lambda function and API Gateway removed';

      // Delete the associated S3 bucket
      if (service.config.bucketName) {
        destroySpinner.text = `Deleting bucket: ${service.config.bucketName}...`;
        const bucketClient = new BucketService();
        await bucketClient.deleteBucket(service.config.bucketName);
        destroySpinner.text = `Bucket deleted: ${service.config.bucketName}`;
      }
      await ConfigInstance.deleteService(service.id);
      destroySpinner.succeed('Service destroyed successfully');
    } catch (error) {
      destroySpinner.fail(`Error: ${(error as Error).message}`);
    }
  }
}
