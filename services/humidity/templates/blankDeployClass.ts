// This is a blank deploy class that can be used to create a new deploy class
// the serviceName is the name of the service that is being deployed and should be formatted as a camel case string
// the payload is the code that is being deployed
export const createDeployTemplate = (serviceName: string) => {
  // Capitalize the first letter of the service name
  //check if name is camel case
  const isCamelCase = /^[a-z][a-zA-Z0-9]*$/.test(serviceName);
  if (!isCamelCase) {
    throw new Error('Service name must be in camel case');
  }
  const upcasedServiceName =
    serviceName.charAt(0).toUpperCase() + serviceName.slice(1) + 'Service';
  const snakedName = serviceName
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .toLowerCase();
  const displayName = serviceName
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  const payload = `
  import { randomUUID } from 'crypto';
  import { ConfigInstance } from '../../../cmd/main';
  import type { Service } from '../../../types/config';
  import ora from 'ora';
  import { ServiceTable } from '../../../helpers/transformers';
  import { AWSLambdaClient } from '../../serverless/AWSLambdaClient/AWSLambdaClient';
  import { BucketService } from '../../storage/AWS/AWSBucketService';
  import { Logger } from '../../../helpers/logger';
  export class ${upcasedServiceName}{
    private logger = new Logger('EXT_DEBUG', '${upcasedServiceName}');
    private payload?: string;

    constructor(payload?: string) {
      this.payload = payload;
    }

    async up(serviceName: string): Promise<void> {
      const uploadSpinner = ora('Deploying ${serviceName}...').start();
      this.logger.info('Deploying ${serviceName}');

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
            bucketName: internalName,
          },
          url: lambdaConfig.url,
          id: uuid,
          apiId: lambdaConfig.apiId,
          created: new Date().toISOString(),
          updated: new Date().toISOString(),
          serviceType: '${snakedName}',
        };
      } catch (error) {
        this.logger.error('Error deploying ${serviceName}', error);
      }
    }
  };
`;

  return {
    payload,
    displayName,
    className: upcasedServiceName,
    serviceTypeName: snakedName,
    fileName: upcasedServiceName + '.ts',
  };
};
