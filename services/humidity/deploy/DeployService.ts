// @ts-ignore
import { EnvKeys } from '../../../types/config.d.ts';
import { AWSLambdaClient } from '../../serverless/AWSLambdaClient/AWSLambdaClient';
import {
  type CreateFunctionConfig,
  type ServiceType,
} from '../../../types/services';
export class DeployService {
  private services: ServiceType[];
  private awsClient: AWSLambdaClient | null;

  constructor() {
    this.awsClient = null;
    this.services = [
      {
        name: 'AWS S3 File upload service',
        id: '981c3345-c5c9-4cbe-ac82-2f38d7d96eb7',
        description: 'Upload files to S3',
        fileLocation: 'templates/services/serverless/fileUploader/bundle.js',
        requiredKeys: [EnvKeys.AMZ_ID, EnvKeys.AMZ_SEC, EnvKeys.AMZ_REGION],
        value: 'aws_upload',
      },
      {
        name: 'DigitalOcean Spaces File upload service',
        id: '20508c1e-e7c7-48b4-9a35-c8a3ac2b71da',
        description: 'Upload files to DigitalOcean Spaces',
        fileLocation: 'services/storage/DigitalOcean/DOBucketClient.ts',
        requiredKeys: [
          EnvKeys.DO_SPACES_ACCESS_KEY,
          EnvKeys.DO_SPACES_SECRET_KEY,
          EnvKeys.DO_SPACES_REGION,
        ],
        value: 'do_upload',
      },
    ];
  }

  private async deployAWSUploadService(payload: string, name: string) {
    // deploy the AWS upload service
    if (!this.awsClient) {
      await this.initAWSClient();
    }
    // create the lambda function
    const FuncConfig: CreateFunctionConfig = {
      name,
      code: payload,
      environment: {
        AMZ_REGION: process.env.AMZ_REGION || '',
        AMZ_ID: process.env.AMZ_ID || '',
        AMZ_SEC: process.env.AMZ_SEC || '',
      },
    };
    const lambdaConfig =
      await this.awsClient!.createOrUpdateFunction(FuncConfig);

    // if there is no lambda config, throw an error
    if (!lambdaConfig) {
      throw new Error('Failed to deploy service');
    }
    return lambdaConfig;
  }

  private async initAWSClient() {
    // initialize the AWS client
    const AWS_REGION = process.env.AMZ_REGION;
    const AWS_KEY = process.env.AMZ_ID;
    const AWS_SEC = process.env.AMZ_SEC;

    if (!AWS_REGION || !AWS_KEY || !AWS_SEC) {
      throw new Error('AWS credentials not found');
    }
    if (!this.awsClient) {
      this.awsClient = new AWSLambdaClient(AWS_REGION, AWS_KEY, AWS_SEC);
    }
  }

  findService = (service: string) => {
    return this.services.find((s) => s.value === service);
  };

  async deployService(service: string, payload: string, name: string) {
    // deploy the service
    switch (service) {
      case 'aws_upload':
        return this.deployAWSUploadService(payload, name);
      case 'do_upload':
        throw new Error('Not implemented');
      default:
        throw new Error('Invalid service');
    }
  }

  async destroyService(serviceName: string, serviceType: string) {
    try {
      if (!this.awsClient) {
        await this.initAWSClient();
      }
      // destroy the service
      switch (serviceType) {
        case 'aws_upload':
          return this.awsClient!.tearDown(serviceName);
        case 'do_upload':
          throw new Error('Not implemented');
        default:
          this;
      }
    } catch (error) {
      console.error(error);
      return;
    }
  }

  listServices() {
    // read the services from the services directory
    return this.services;
  }
}
