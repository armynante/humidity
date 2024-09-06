import type { Service } from '../../../types/config';
export declare class DeployService {
    private logger;
    findServiceTemplateByInternalName: (serviceName: string | undefined) => import("../../../types/services").TemplateType | undefined;
    deployService(service: string, name: string): Promise<void>;
    destroyService(service: Service): Promise<void>;
    listServices(): import("../../../types/services").TemplateType[];
}
