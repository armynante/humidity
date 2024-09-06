// This is a blank deploy class that can be used to create a new deploy class
// the serviceShortName is the name of the service that is being deployed and should be formatted as a snake case
// the payload is the code that is being deployed
export const createDeployTemplate = (serviceShortName) => {
    // Capitalize the first letter of the service name
    const upcasedServiceName = serviceShortName
        .split('-')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join('') + 'Service';
    const displayName = serviceShortName
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .split(' ')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join('');
    const payload = `
  import { randomUUID } from 'node:crypto';
  import { ConfigInstance } from '../../../cmd/main.js';
  import type { Service } from '../../../types/config';
  import ora from 'ora';
  import { ServiceTable } from '../../../helpers/transformers.js';
  import { AWSLambdaClient } from '../../serverless/AWSLambdaClient/AWSLambdaClient.js';
  import { BucketService } from '../../storage/AWS/AWSBucketService.js';
  import { Logger } from '../../../helpers/logger.js';
  export class ${upcasedServiceName}{
    private logger = new Logger('EXT_DEBUG', '${upcasedServiceName}');
    private payload?: string;

    constructor(payload?: string) {
      this.payload = payload;
    }

    async up(serviceName: string): Promise<void> {
      const uploadSpinner = ora('Deploying ${displayName}...').start();
      this.logger.info('Deploying ${displayName}');

      if (!this.payload) {
        uploadSpinner.fail('No payload provided');
        return;
      }

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
          this.logger.error('Error deploying ${displayName}');
          return;
        }

        // Update config
        uploadSpinner.text = 'Updating config with uuid: ' + uuid;
        const serviceConfig: Service = {
          name: '${displayName}',
          internal_name: internalName,
          config: {
            ...lambdaConfig,
            // Add the bucket name to the config if needed
            //bucketName: internalName,
          },
          url: lambdaConfig.url,
          id: uuid,
          apiId: lambdaConfig.apiId,
          created: new Date().toISOString(),
          updated: new Date().toISOString(),
          serviceType: '${serviceShortName}',
        };
      } catch (error) {
        this.logger.error('Error deploying ${serviceShortName}', error);
      }
    }
  };
`;
    return {
        payload,
        displayName,
        className: upcasedServiceName,
        serviceTypeName: serviceShortName,
        fileName: upcasedServiceName + '.ts',
    };
};
