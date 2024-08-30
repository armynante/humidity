import {
  EnvKeys,
  type RequiredEnvs,
  type Service,
  // @ts-ignore
} from '../../../types/config.d.ts';
import { AWSLambdaClient } from '../../serverless/AWSLambdaClient/AWSLambdaClient';
import { type CreateFunctionConfig } from '../../../types/services';
import { ConfigInstance } from '../../../cmd/main';
import { InstantDatabaseService } from './InstantDatabase.ts';
import { FileSystem } from '../../../cmd/main';
import { AwsUploadService } from './AWSUpload.ts';
export class DeployService {
  // Look up the service in the config and returns the template
  findServiceTemplateByInternalName = (serviceName: string | undefined) => {
    if (!serviceName) {
      throw new Error('No service provided');
    }
    const templates = ConfigInstance.getTemplates();
    return templates.find((s) => s.internal_name === serviceName);
  };

  // Find the service, read the payload, and deploy the service
  async deployService(service: string, name: string) {
    const template = this.findServiceTemplateByInternalName(service);
    if (!template) {
      throw new Error('Service template not found');
    }
    const payload = await FileSystem.readFile(template.fileLocation, 'utf-8');
    if (!payload) {
      throw new Error('Template not found');
    }

    // Pull list of required environment variables
    const requiredEnvVars = template.requiredKeys as (keyof RequiredEnvs)[];

    // Check if the required environment variables are set
    const validEnvs = ConfigInstance.checkEnvVars(requiredEnvVars);

    if (!validEnvs) {
      throw new Error('Missing required environment variables');
    }

    // deploy the service
    switch (service) {
      case 'aws_upload':
        const awsUploadService = new AwsUploadService(payload);
        return awsUploadService.up(name);
      case 'instant_database':
        const dbService = new InstantDatabaseService(payload);
        return dbService.up(name);
      default:
        throw new Error('Invalid service');
    }
  }

  async destroyService(service: Service) {
    try {
      // check if the service is exists
      const serviceConfig = await ConfigInstance.viewService(service.id);

      // destroy the service
      switch (serviceConfig.serviceType) {
        case 'aws_upload': {
          const awsUploadService = new AwsUploadService();
          return awsUploadService.down(service.id);
        }
        case 'instant_database': {
          const dbService = new InstantDatabaseService();
          return dbService.down(service.id);
        }
        default:
          throw new Error('Invalid service');
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
