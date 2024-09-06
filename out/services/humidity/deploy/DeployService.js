import { ConfigInstance } from '../../../cmd/main.js';
import { InstantDatabaseService } from './InstantDatabase.js';
import { FileSystem } from '../../../cmd/main.js';
import { AwsUploadService } from './AWSUpload.js';
import { Logger } from '../../../helpers/logger.js';
export class DeployService {
    // Logger for the deployment service
    logger = new Logger('EXT_DEBUG', 'DeployService');
    // Look up the service in the config and returns the template
    findServiceTemplateByInternalName = (serviceName) => {
        if (!serviceName) {
            throw new Error('No service provided');
        }
        const templates = ConfigInstance.getTemplates();
        return templates.find((s) => s.internal_name === serviceName);
    };
    // Find the service, read the payload, and deploy the service
    async deployService(service, name) {
        const template = this.findServiceTemplateByInternalName(service);
        if (!template) {
            throw new Error('Service template not found');
        }
        const payload = await FileSystem.readFile(template.fileLocation, 'utf-8');
        if (!payload) {
            throw new Error('Template not found');
        }
        // Pull list of required environment variables
        const requiredEnvVars = template.requiredKeys;
        // Check if the required environment variables are set
        const validEnvs = ConfigInstance.checkEnvVars(requiredEnvVars);
        this.logger.extInfo('Checking environment variables...');
        if (validEnvs !== true) {
            this.logger.error('Missing required environment variables');
            this.logger.error('The following environment variables are required: ' +
                requiredEnvVars.join(', '));
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
    async destroyService(service) {
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
        }
        catch (error) {
            console.error(error);
            return;
        }
    }
    listServices() {
        // read the services from the services directory
        return ConfigInstance.getTemplates();
    }
}
