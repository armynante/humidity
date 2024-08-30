import fs from 'fs/promises';
import { randomUUID } from 'crypto';
import { DeployService } from '../../../services/humidity/deploy/DeployService';
import { ConfigInstance, DeployInstance } from '../../../cmd/main';
import type { Service } from '../../../types/config';
import ora from 'ora';
import { ServiceTable } from '../../../helpers/transformers';

export class AwsUploadService {
  async uploadService(serviceName: string): Promise<void> {
    const uploadSpinner = ora('Uploading payload...').start();

    try {
      // Find the service
      const payloadPath =
        DeployInstance.findService('aws_upload')?.fileLocation;
      if (!payloadPath) {
        uploadSpinner.fail('Service not found');
        return;
      }

      // Read the payload
      uploadSpinner.text = 'Reading payload...';
      const payload = await fs.readFile(payloadPath, 'utf-8');
      if (!payload) {
        uploadSpinner.fail('Payload not found');
        return;
      }

      // Deploy the service
      uploadSpinner.text = 'Deploying service...';
      const uuid = randomUUID();
      const internalName = serviceName + '-' + uuid;
      const lambdaConfig = await DeployInstance.deployService(
        'aws_upload',
        payload,
        internalName,
      );

      if (!lambdaConfig) {
        uploadSpinner.fail('Failed to deploy service');
        return;
      }

      // Update config
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

      // Render the service table
      console.log(ServiceTable(serviceConfig));
    } catch (error) {
      uploadSpinner.fail(`Error: ${(error as Error).message}`);
    }
  }
}

export const awsUploadService = new AwsUploadService();
