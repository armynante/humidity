export declare class AwsUploadService {
    private logger;
    private payload?;
    constructor(payload?: string);
    up(serviceName: string): Promise<void>;
    down(serviceName: string): Promise<void>;
}
