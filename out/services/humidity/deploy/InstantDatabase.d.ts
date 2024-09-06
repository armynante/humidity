export declare class InstantDatabaseService {
    private payload?;
    private logger;
    constructor(payload?: string | undefined);
    up(serviceName: string): Promise<void>;
    down(serviceId: string): Promise<void>;
}
