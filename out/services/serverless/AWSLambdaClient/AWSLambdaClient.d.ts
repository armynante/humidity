import type { CreateFunctionConfig, FuncConfig } from '../../../types/services';
import type { Service } from '../../../types/config';
export declare class AWSLambdaClient {
    private lambdaClient;
    private iamClient;
    private apiGatewayClient;
    private region;
    private roleName;
    private roleArn;
    private apiId;
    constructor();
    createRole(): Promise<void>;
    deleteApiGateway(service: Service): Promise<void>;
    deleteRole(): Promise<void>;
    private zipCode;
    tearDown(service: Service): Promise<void>;
    private waitForFunctionActive;
    private functionExists;
    createOrUpdateFunction(config: CreateFunctionConfig): Promise<FuncConfig>;
    checkApiEndpoint(functionName: string): Promise<string | null>;
    deleteFunction(name: string): Promise<void>;
    invokeFunction(name: string, payload: Record<string, any>): Promise<any>;
    createAPIGateway(functionName: string): Promise<[string, string]>;
    private getAccountId;
}
