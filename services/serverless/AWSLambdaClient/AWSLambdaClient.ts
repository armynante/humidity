import {
  LambdaClient,
  CreateFunctionCommand,
  UpdateFunctionCodeCommand,
  DeleteFunctionCommand,
  InvokeCommand,
  GetFunctionCommand,
  AddPermissionCommand,
  type FunctionConfiguration,
  type Runtime,
  RemovePermissionCommand,
  UpdateFunctionConfigurationCommand,
} from '@aws-sdk/client-lambda';
import {
  IAMClient,
  CreateRoleCommand,
  AttachRolePolicyCommand,
  DetachRolePolicyCommand,
  DeleteRoleCommand,
  GetRoleCommand,
  ListAttachedRolePoliciesCommand,
} from '@aws-sdk/client-iam';
import {
  APIGatewayClient,
  CreateRestApiCommand,
  GetResourcesCommand,
  CreateResourceCommand,
  PutMethodCommand,
  PutIntegrationCommand,
  CreateDeploymentCommand,
  DeleteRestApiCommand,
  GetRestApisCommand,
  PutRestApiCommand,
  UpdateMethodCommand,
  PutIntegrationResponseCommand,
  PutMethodResponseCommand,
} from '@aws-sdk/client-api-gateway';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import archiver from 'archiver';
import type { CreateFunctionConfig, FuncConfig } from '../../../types/services';
import type { Service } from '../../../types/config';

export class AWSLambdaClient {
  private lambdaClient: LambdaClient;
  private iamClient: IAMClient;
  private apiGatewayClient: APIGatewayClient;
  private region: string;
  private roleName: string;
  private roleArn: string | null;
  private apiId: string | null;

  constructor() {
    this.region = process.env.AMZ_REGION || '';
    this.roleName = 'LambdaExecutionRole';
    this.roleArn = null;
    this.apiId = null;

    const config = {
      region: this.region,
      credentials: {
        accessKeyId: process.env.AMZ_ID || '',
        secretAccessKey: process.env.AMZ_SEC || '',
      },
    };

    this.lambdaClient = new LambdaClient(config);
    this.iamClient = new IAMClient(config);
    this.apiGatewayClient = new APIGatewayClient(config);
  }

  async createRole(): Promise<void> {
    try {
      // First, try to get the role
      const getRoleCommand = new GetRoleCommand({ RoleName: this.roleName });
      const roleResponse = await this.iamClient.send(getRoleCommand);
      this.roleArn = roleResponse.Role?.Arn ?? null;
      console.log('IAM Role already exists, retrieved ARN');
    } catch (error: any) {
      // If the role doesn't exist, create it
      if (error.name === 'NoSuchEntityException') {
        const createRoleParams = {
          AssumeRolePolicyDocument: JSON.stringify({
            Version: '2012-10-17',
            Statement: [
              {
                Effect: 'Allow',
                Principal: {
                  Service: 'lambda.amazonaws.com',
                },
                Action: 'sts:AssumeRole',
              },
            ],
          }),
          RoleName: this.roleName,
        };

        const createRoleCommand = new CreateRoleCommand(createRoleParams);
        const response = await this.iamClient.send(createRoleCommand);
        this.roleArn = response.Role?.Arn ?? null;

        // Attach necessary policies
        const attachPolicyCommand = new AttachRolePolicyCommand({
          RoleName: this.roleName,
          PolicyArn:
            'arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole',
        });
        await this.iamClient.send(attachPolicyCommand);

        console.log('IAM Role created successfully');
      } else {
        console.error('Error checking/creating IAM Role:', error);
        throw error;
      }
    }
  }

  async deleteApiGateway(service: Service): Promise<void> {
    try {
      // Find the API ID
      const getApisCommand = new GetRestApisCommand({});
      const apisResponse = await this.apiGatewayClient.send(getApisCommand);
      const api = apisResponse.items?.find(
        (api) => api.name === `${service.internal_name}-api`,
      );

      if (!api || !api.id) {
        console.log(`No API found for function ${service.name}`);
        return;
      }

      // Delete the API
      const deleteApiCommand = new DeleteRestApiCommand({
        restApiId: service.apiId,
      });
      await this.apiGatewayClient.send(deleteApiCommand);

      console.log(`API Gateway for ${service.name} deleted successfully`);

      // Remove Lambda permission
      const removePermissionCommand = new RemovePermissionCommand({
        FunctionName: service.internal_name,
        StatementId: 'apigateway-' + service.apiId,
      });
      await this.lambdaClient.send(removePermissionCommand);

      console.log(
        `Removed API Gateway permission from Lambda function ${service.name}`,
      );
    } catch (error) {
      console.error('Error deleting API Gateway:', error);
      throw error;
    }
  }

  async deleteRole(): Promise<void> {
    try {
      // List attached policies
      const listPoliciesCommand = new ListAttachedRolePoliciesCommand({
        RoleName: this.roleName,
      });
      const listPoliciesResponse =
        await this.iamClient.send(listPoliciesCommand);

      // Detach all policies
      for (const policy of listPoliciesResponse.AttachedPolicies || []) {
        if (policy.PolicyArn) {
          const detachPolicyCommand = new DetachRolePolicyCommand({
            RoleName: this.roleName,
            PolicyArn: policy.PolicyArn,
          });
          await this.iamClient.send(detachPolicyCommand);
          console.log(`Detached policy: ${policy.PolicyArn}`);
        }
      }

      // Delete the role
      const deleteRoleCommand = new DeleteRoleCommand({
        RoleName: this.roleName,
      });
      await this.iamClient.send(deleteRoleCommand);
      console.log('IAM Role deleted successfully');
      this.roleArn = null;
    } catch (error) {
      console.error('Error deleting IAM Role:', error);
      throw error;
    }
  }
  private async zipCode(code: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lambda-'));
      const codePath = path.join(tempDir, 'index.js');
      fs.writeFileSync(codePath, code);

      const archivePath = path.join(tempDir, 'function.zip');
      const output = fs.createWriteStream(archivePath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', () => {
        const zipBuffer = fs.readFileSync(archivePath);
        fs.rmSync(tempDir, { recursive: true, force: true });
        resolve(zipBuffer);
      });

      archive.on('error', (err) => {
        reject(err);
      });

      archive.pipe(output);
      archive.file(codePath, { name: 'index.js' });
      archive.finalize();
    });
  }

  async tearDown(service: Service): Promise<void> {
    try {
      await this.deleteApiGateway(service);
      await this.deleteFunction(service.internal_name);
      await this.deleteRole();
      console.log('All resources have been deleted successfully');
    } catch (error) {
      console.error('Error during teardown:', error);
      throw error;
    }
  }

  private async waitForFunctionActive(
    name: string,
    maxWaitTime: number = 60000,
    checkInterval: number = 5000,
  ): Promise<void> {
    const startTime = Date.now();
    while (Date.now() - startTime < maxWaitTime) {
      try {
        const command = new GetFunctionCommand({ FunctionName: name });
        const response = await this.lambdaClient.send(command);
        if (response.Configuration?.State === 'Active') {
          console.log('Lambda function is now active');
          return;
        }
      } catch (error) {
        console.error('Error checking function state:', error);
      }
      await new Promise((resolve) => setTimeout(resolve, checkInterval));
    }
    throw new Error('Timeout waiting for function to become active');
  }

  private async functionExists(name: string): Promise<boolean> {
    try {
      const command = new GetFunctionCommand({ FunctionName: name });
      await this.lambdaClient.send(command);
      return true;
    } catch (error: any) {
      if (error.name === 'ResourceNotFoundException') {
        return false;
      }
      throw error;
    }
  }

  async createOrUpdateFunction(
    config: CreateFunctionConfig,
  ): Promise<FuncConfig> {
    const {
      name,
      code,
      handler = 'index.handler',
      runtime = 'nodejs18.x',
      environment = {},
    } = config;

    if (!this.roleArn) {
      await this.createRole();
      // Wait for a short time to ensure the role is ready
      await new Promise((resolve) => setTimeout(resolve, 10000));
    }

    if (!this.roleArn) {
      throw new Error(
        'Role ARN is not available. Failed to create or retrieve role.',
      );
    }

    try {
      const zippedCode = await this.zipCode(code);
      const exists = await this.functionExists(name);

      if (exists) {
        console.log('Function already exists. Updating...');
        const updateParams = {
          FunctionName: name,
          ZipFile: zippedCode,
        };
        const updateCommand = new UpdateFunctionCodeCommand(updateParams);
        await this.lambdaClient.send(updateCommand);

        // Update environment variables
        if (Object.keys(environment).length > 0) {
          console.log('Updating environment variables...');
          const updateEnvParams = {
            FunctionName: name,
            Timeout: 60,
            Environment: {
              Variables: environment,
            },
          };
          await this.lambdaClient.send(
            new UpdateFunctionConfigurationCommand(updateEnvParams),
          );
        }
      } else {
        console.log('Creating new function...');
        const createParams = {
          Code: { ZipFile: zippedCode },
          FunctionName: name,
          Handler: handler,
          Role: this.roleArn,
          Runtime: runtime,
          Environment: { Variables: environment },
        };
        const createCommand = new CreateFunctionCommand(createParams);
        await this.lambdaClient.send(createCommand);
      }

      console.log('Lambda function created/updated successfully');

      // Wait for the function to become active
      await this.waitForFunctionActive(name);

      const getFunctionCommand = new GetFunctionCommand({ FunctionName: name });
      const response = await this.lambdaClient.send(getFunctionCommand);
      if (!response.Configuration) {
        throw new Error('Failed to get function configuration');
      }

      // check if there is an api gateway
      const apiUrl = await this.checkApiEndpoint(name);
      if (apiUrl) {
        console.log('API Gateway already exists');
        return {
          ...response.Configuration,
          url: apiUrl,
          internal_name: name,
          apiId: this.apiId || '',
        };
      }

      // Create API Gateway
      console.log('Creating API Gateway...');
      const [newApiUrl, apiId] = await this.createAPIGateway(name);

      return {
        ...response.Configuration,
        url: newApiUrl,
        internal_name: name,
        apiId: apiId,
      };
    } catch (error) {
      console.error('Error creating/updating Lambda function:', error);
      throw error;
    }
  }

  async checkApiEndpoint(functionName: string): Promise<string | null> {
    try {
      const getApisCommand = new GetRestApisCommand({});
      const apisResponse = await this.apiGatewayClient.send(getApisCommand);
      const api = apisResponse.items?.find(
        (api) => api.name === `${functionName}-api`,
      );

      if (!api || !api.id) {
        return null;
      }
      this.apiId = api.id;
      const apiUrl = `https://${api.id}.execute-api.${this.region}.amazonaws.com/prod/${functionName}`;
      return apiUrl;
    } catch (error) {
      console.error('Error checking API endpoint:', error);
      return null;
    }
  }

  async deleteFunction(name: string): Promise<void> {
    try {
      const exists = await this.functionExists(name);
      if (!exists) {
        console.log(`Function ${name} does not exist. Skipping deletion.`);
        return;
      }
      const command = new DeleteFunctionCommand({ FunctionName: name });
      await this.lambdaClient.send(command);
      console.log(`Lambda function ${name} deleted successfully`);
    } catch (error) {
      console.error('Error deleting Lambda function:', error);
      throw error;
    }
  }

  async invokeFunction(
    name: string,
    payload: Record<string, any>,
  ): Promise<any> {
    const params = {
      FunctionName: name,
      Payload: JSON.stringify(payload),
    };

    try {
      const command = new InvokeCommand(params);
      const response = await this.lambdaClient.send(command);
      return JSON.parse(new TextDecoder().decode(response.Payload));
    } catch (error) {
      console.error('Error invoking Lambda function:', error);
      throw error;
    }
  }

  async createAPIGateway(functionName: string): Promise<[string, string]> {
    // Get the Lambda function ARN
    const getFunctionCommand = new GetFunctionCommand({
      FunctionName: functionName,
    });
    const lambdaFunction = await this.lambdaClient.send(getFunctionCommand);
    const lambdaArn = lambdaFunction.Configuration?.FunctionArn;

    if (!lambdaArn) {
      throw new Error('Failed to retrieve Lambda function ARN');
    }

    // Create API
    const createApiCommand = new CreateRestApiCommand({
      name: `${functionName}-api`,
      binaryMediaTypes: ['*/*'],
      endpointConfiguration: { types: ['REGIONAL'] },
    });
    const api = await this.apiGatewayClient.send(createApiCommand);

    // Get API root resource ID
    const getResourcesCommand = new GetResourcesCommand({
      restApiId: api.id!,
    });
    const resources = await this.apiGatewayClient.send(getResourcesCommand);
    const rootResourceId = resources.items![0].id;

    // Create resource
    // Create or get existing resource
    let resource;
    try {
      const createResourceCommand = new CreateResourceCommand({
        restApiId: api.id!,
        parentId: rootResourceId!,
        pathPart: '{proxy+}',
      });
      resource = await this.apiGatewayClient.send(createResourceCommand);
    } catch (error: any) {
      if (error.name === 'ConflictException') {
        console.log('Resource already exists, retrieving existing resource');
        const resources = await this.apiGatewayClient.send(getResourcesCommand);
        resource = resources.items!.find((r) => r.path === '/{proxy+}');
        if (!resource) {
          throw new Error('Could not find existing resource');
        }
      } else {
        throw error;
      }
    }

    // Create or update methods
    const methods = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'];
    for (const method of methods) {
      try {
        const putMethodCommand = new PutMethodCommand({
          restApiId: api.id!,
          resourceId: resource.id!,
          httpMethod: method,
          authorizationType: 'NONE',
        });
        await this.apiGatewayClient.send(putMethodCommand);
      } catch (error: any) {
        if (error.name !== 'ConflictException') {
          throw error;
        }
        console.log(`Method ${method} already exists, updating integration`);
      }

      const putIntegrationCommand = new PutIntegrationCommand({
        restApiId: api.id!,
        resourceId: resource.id!,
        httpMethod: method,
        type: 'AWS_PROXY',
        integrationHttpMethod: 'POST',
        uri: `arn:aws:apigateway:${this.region}:lambda:path/2015-03-31/functions/${lambdaArn}/invocations`,
        contentHandling: 'CONVERT_TO_BINARY',
      });
      await this.apiGatewayClient.send(putIntegrationCommand);

      const putMethodResponseCommand = new PutMethodResponseCommand({
        restApiId: api.id!,
        resourceId: resource.id!,
        httpMethod: method,
        statusCode: '200',
        responseModels: {
          'application/json': 'Empty',
        },
        responseParameters: {
          'method.response.header.Access-Control-Allow-Headers': true,
          'method.response.header.Access-Control-Allow-Methods': true,
          'method.response.header.Access-Control-Allow-Origin': true,
          'method.response.header.Content-Type': true,
        },
      });
      await this.apiGatewayClient.send(putMethodResponseCommand);

      const putIntegrationResponseCommand = new PutIntegrationResponseCommand({
        restApiId: api.id!,
        resourceId: resource.id!,
        httpMethod: method,
        statusCode: '200',
        responseTemplates: {
          'application/json': '',
        },
        responseParameters: {
          'method.response.header.Access-Control-Allow-Headers':
            "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
          'method.response.header.Access-Control-Allow-Methods':
            "'GET,OPTIONS,POST,PUT,DELETE'",
          'method.response.header.Access-Control-Allow-Origin': "'*'",
          'method.response.header.Content-Type':
            'integration.response.header.Content-Type',
        },
        contentHandling: 'CONVERT_TO_BINARY',
      });
      await this.apiGatewayClient.send(putIntegrationResponseCommand);
    }

    // Deploy API
    const createDeploymentCommand = new CreateDeploymentCommand({
      restApiId: api.id!,
      stageName: 'prod',
    });
    await this.apiGatewayClient.send(createDeploymentCommand);

    // Add permission for API Gateway to invoke Lambda
    const addPermissionCommand = new AddPermissionCommand({
      FunctionName: functionName,
      StatementId: `apigateway-${api.id}`,
      Action: 'lambda:InvokeFunction',
      Principal: 'apigateway.amazonaws.com',
      SourceArn: `arn:aws:execute-api:${this.region}:${await this.getAccountId()}:${api.id}/*/*`,
    });
    await this.lambdaClient.send(addPermissionCommand);

    return [
      `https://${api.id}.execute-api.${this.region}.amazonaws.com/prod/${functionName}`,
      api.id!,
    ];
  }

  private async getAccountId(): Promise<string> {
    if (!this.roleArn) {
      throw new Error('Role ARN is not available');
    }
    const arnParts = this.roleArn.split(':');
    return arnParts[4]; // Account ID is the 5th part of the ARN
  }
}
