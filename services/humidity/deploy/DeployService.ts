// @ts-ignore
import { EnvKeys, type Service } from '../../../types/config.d.ts';
import { AWSLambdaClient } from '../../serverless/AWSLambdaClient/AWSLambdaClient';
import {
  type CreateFunctionConfig,
  type ServiceType,
} from '../../../types/services';

import { BucketClient } from '../../storage/AWS/AWSBucketClient';

export class DeployService {
  private services: ServiceType[];
  private awsClient: AWSLambdaClient | null;
  private bucketClient: BucketClient | null;

  constructor() {
    this.awsClient = null;
    this.bucketClient = null;
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

  private async initBucketClient() {
    if (!this.bucketClient) {
      // const config = {
      //   accessKeyId: process.env.AMZ_ID || '',
      //   secretAccessKey: process.env.AMZ_SEC || '',
      //   region: process.env.AMZ_REGION || '',
      // };
      this.bucketClient = new BucketClient();
    }
  }

  private async deployAWSUploadService(payload: string, name: string) {
    // deploy the AWS upload service
    if (!this.awsClient) {
      await this.initAWSClient();
    }

    if (!this.bucketClient) {
      await this.initBucketClient();
    }

    try {
      const buckets = await this.bucketClient!.listBuckets();
      if (!buckets || !buckets.includes(name)) {
        await this.bucketClient!.createBucket(name);
        console.log(`Bucket ${name} created successfully.`);
      } else {
        console.log(`Bucket ${name} already exists.`);
      }
    } catch (error) {
      console.error(`Error managing bucket: ${error}`);
      throw new Error('Failed to manage bucket');
    }

    // create the lambda function
    const FuncConfig: CreateFunctionConfig = {
      name,
      code: payload,
      environment: {
        AMZ_REGION: process.env.AMZ_REGION || '',
        AMZ_ID: process.env.AMZ_ID || '',
        AMZ_SEC: process.env.AMZ_SEC || '',
        BUCKET_NAME: name,
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
    const AMZ_REGION = process.env.AWS_REGION;
    const AMZ_ID = process.env.AMZ_ID;
    const AMZ_SEC = process.env.AMZ_SEC;

    if (!AMZ_REGION || !AMZ_ID || !AMZ_SEC) {
      throw new Error('AWS credentials not found');
    }
    if (!this.awsClient) {
      this.awsClient = new AWSLambdaClient(AMZ_REGION, AMZ_ID, AMZ_SEC);
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

  async destroyService(service: Service, serviceType: string) {
    try {
      if (!this.awsClient) {
        await this.initAWSClient();
      }
      if (!this.bucketClient) {
        await this.initBucketClient();
      }
      // destroy the service
      switch (serviceType) {
        case 'aws_upload': {
          // delete the bucket
          await this.bucketClient!.deleteBucket(service.internal_name);
          return this.awsClient!.tearDown(service);
        }
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
