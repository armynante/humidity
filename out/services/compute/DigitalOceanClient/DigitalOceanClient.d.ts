import type { DoAppSpec } from '../../../types/do';
type ApiResponse<T> = [T | null, string | null];
declare class DigitalOceanService {
    private apiToken;
    private apiBaseUrl;
    constructor(apiToken: string);
    private apiRequest;
    buildImage(imageName: string, tag: string, dockerfile: string): Promise<void>;
    pushImage(imageName: string, tag: string): Promise<void>;
    createDoAppSpec(appName: string, port: number, tag: string, repository: string): DoAppSpec;
    writeDoAppSpec(appName: string, appSpec: DoAppSpec, path: string): Promise<ApiResponse<string>>;
    createDoApp(spec: DoAppSpec): Promise<any[]>;
    pollDoAppStatus(appId: string, pollPeriod: number): Promise<any[]>;
    deleteDoApp(appId: string): Promise<ApiResponse<any>>;
    getRepoManifests(repository: string, registry: string): Promise<ApiResponse<string[]>>;
    deleteDoManifest(repository: string, registry: string, sha: string): Promise<ApiResponse<any>>;
    deleteDoRegistryRepo(repository: string, registry: string): Promise<ApiResponse<string[]>>;
    doGarbageCollection(registry: string): Promise<ApiResponse<any>>;
}
export default DigitalOceanService;
