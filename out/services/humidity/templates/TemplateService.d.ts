import { FileSystemWrapper } from '../../../helpers/filesystem.js';
import { Logger } from '../../../helpers/logger.js';
import type { TemplateType } from '../../../types/services';
import type { EnvKeys } from '../../../types/enums.js';
export declare class TemplateService {
    private templatesPath;
    private fs;
    private logger;
    constructor(fs: FileSystemWrapper, logger: Logger);
    createTemplate(templateName: string, templateDescription: string, shortName: string, requiredEnvs: EnvKeys[]): Promise<TemplateType>;
    private generateDeployClass;
    removeTemplate(templateId: string): Promise<void>;
    getTemplateById(templateId: string): Promise<TemplateType | null>;
    private updatePackageJson;
    getTemplatesPath(): string;
}
