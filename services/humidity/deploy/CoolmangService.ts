
  import { randomUUID } from 'crypto';
  import { ConfigInstance } from '../../../cmd/main';
  import type { Service } from '../../../types/config';
  import ora from 'ora';
  import { ServiceTable } from '../../../helpers/transformers';
  import { AWSLambdaClient } from '../../serverless/AWSLambdaClient/AWSLambdaClient';
  import { BucketService } from '../../storage/AWS/AWSBucketService';
  import { Logger } from '../../../helpers/logger';
  export class CoolmangService{
    private logger = new Logger('EXT_DEBUG', 'CoolmangService');
    private payload?: string;

    constructor(payload?: string) {
      this.payload = payload;
    }

    async up(serviceName: string): Promise<void> {
      const uploadSpinner = ora('Deploying coolmang...').start();
      this.logger.info('Deploying coolmang');

      try {
        const uuid = randomUUID();
        const internalName = serviceName + '-' + uuid;

        // Create a bucket if needed
        // const bucketClient = new BucketService();
        // await bucketClient.createBucket(internalName);

        // Create the lambda function
        const awsLambdaClient = new AWSLambdaClient();
        const lambdaConfig = await awsLambdaClient.createOrUpdateFunction({
          name: internalName,
          code: this.payload,
        });

        if (!lambdaConfig) {
          uploadSpinner.fail('Failed to deploy service');
          this.logger.error('Error deploying Coolmang');
          return;
        }

        // Update config
        uploadSpinner.text = 'Updating config with uuid: ' + uuid;
        const serviceConfig: Service = {
          name: Coolmang,
          internal_name: internalName,
          config: {
            ...lambdaConfig,
            // Add the bucket name to the config if needed
            bucketName: internalName,
          },
          url: lambdaConfig.url,
          id: uuid,
          apiId: lambdaConfig.apiId,
          created: new Date().toISOString(),
          updated: new Date().toISOString(),
          serviceType: 'coolmang',
        };
      } catch (error) {
        this.logger.error('Error deploying coolmang', error);
      }
    }
  };
