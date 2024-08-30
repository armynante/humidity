// @ts-ignore
import { EnvKeys, type Service } from '../../../types/config.d.ts';
import { AWSLambdaClient } from '../../serverless/AWSLambdaClient/AWSLambdaClient';
import {
  type CreateFunctionConfig,
  type ServiceType,
  type TemplateType,
} from '../../../types/services';
import { AWSBucketInstance, ConfigInstance } from '../../../cmd/main';
import { InstantDatabaseService } from './InstantDatabase.ts';

export class DeployService {
  private awsClient: AWSLambdaClient | null;
  private bucketClient: typeof AWSBucketInstance | null;

  constructor() {
    this.awsClient = null;
    this.bucketClient = AWSBucketInstance;
  }

  private async deployAWSUploadService(payload: string, name: string) {
    // deploy the AWS upload service
    if (!this.awsClient) {
      await this.initAWSClient();
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
    const templates = ConfigInstance.getTemplates();
    return templates.find((s) => s.internal_name === service);
  };

  async deployService(service: string, payload: string, name: string) {
    // deploy the service
    switch (service) {
      case 'aws_upload':
        return this.deployAWSUploadService(payload, name);
      case 'instant_database':
        const dbService = new InstantDatabaseService();
        return dbService.deployService(name);
      default:
        throw new Error('Invalid service');
    }
  }

  async destroyService(service: Service, serviceType: string) {
    try {
      if (!this.awsClient) {
        await this.initAWSClient();
      }

      // destroy the service
      switch (serviceType) {
        case 'aws_upload': {
          // delete the bucket
          await this.bucketClient!.emptyBucket(service.internal_name);
          await this.bucketClient!.deleteBucket(service.internal_name);
          return this.awsClient!.tearDown(service);
        }
        case 'instant_database': {
          const dbService = new InstantDatabaseService();
          return dbService.destroyService(service.internal_name);
        }
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
    return ConfigInstance.getTemplates();
  }
}
