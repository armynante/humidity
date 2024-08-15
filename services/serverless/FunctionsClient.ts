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
} from '@aws-sdk/client-api-gateway';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import archiver from 'archiver';

export class AWSLambdaClient {
  private lambdaClient: LambdaClient;
  private iamClient: IAMClient;
  private apiGatewayClient: APIGatewayClient;
  private region: string;
  private roleName: string;
  private roleArn: string | null;

  constructor(region: string, accessKeyId: string, secretAccessKey: string) {
    this.region = region;
    this.roleName = 'LambdaExecutionRole';
    this.roleArn = null;

    const config = {
      region: this.region,
      credentials: {
        accessKeyId: accessKeyId,
        secretAccessKey: secretAccessKey,
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

  async deleteApiGateway(functionName: string): Promise<void> {
    try {
      // Find the API ID
      const getApisCommand = new GetRestApisCommand({});
      const apisResponse = await this.apiGatewayClient.send(getApisCommand);
      const api = apisResponse.items?.find(
        (api) => api.name === `${functionName}-api`,
      );

      if (!api || !api.id) {
        console.log(`No API found for function ${functionName}`);
        return;
      }

      // Delete the API
      const deleteApiCommand = new DeleteRestApiCommand({ restApiId: api.id });
      await this.apiGatewayClient.send(deleteApiCommand);

      console.log(`API Gateway for ${functionName} deleted successfully`);

      // Remove Lambda permission
      const removePermissionCommand = new RemovePermissionCommand({
        FunctionName: functionName,
        StatementId: 'apigateway-test-2',
      });
      await this.lambdaClient.send(removePermissionCommand);

      console.log(
        `Removed API Gateway permission from Lambda function ${functionName}`,
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

  async tearDown(functionName: string): Promise<void> {
    try {
      await this.deleteApiGateway(functionName);
      await this.deleteFunction(functionName);
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
    name: string,
    code: string,
    handler: string = 'index.handler',
    runtime: Runtime = 'nodejs18.x',
  ): Promise<FunctionConfiguration | undefined> {
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
      } else {
        console.log('Creating new function...');
        const createParams = {
          Code: { ZipFile: zippedCode },
          FunctionName: name,
          Handler: handler,
          Role: this.roleArn,
          Runtime: runtime,
        };
        const createCommand = new CreateFunctionCommand(createParams);
        await this.lambdaClient.send(createCommand);
      }

      console.log('Lambda function created/updated successfully');

      // Wait for the function to become active
      await this.waitForFunctionActive(name);

      const getFunctionCommand = new GetFunctionCommand({ FunctionName: name });
      const response = await this.lambdaClient.send(getFunctionCommand);
      return response.Configuration;
    } catch (error) {
      console.error('Error creating/updating Lambda function:', error);
      throw error;
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

  async createApiGateway(functionName: string): Promise<string> {
    try {
      // Create API
      const createApiCommand = new CreateRestApiCommand({
        name: `${functionName}-api`,
        description: `API for ${functionName}`,
      });
      const apiResponse = await this.apiGatewayClient.send(createApiCommand);
      const apiId = apiResponse.id;

      if (!apiId) {
        throw new Error('Failed to create API');
      }

      // Get root resource ID
      const getResourcesCommand = new GetResourcesCommand({ restApiId: apiId });
      const resourcesResponse =
        await this.apiGatewayClient.send(getResourcesCommand);
      const rootResourceId = resourcesResponse.items?.[0].id;

      if (!rootResourceId) {
        throw new Error('Failed to get root resource ID');
      }

      // Create resource
      const createResourceCommand = new CreateResourceCommand({
        restApiId: apiId,
        parentId: rootResourceId,
        pathPart: functionName,
      });
      const resourceResponse = await this.apiGatewayClient.send(
        createResourceCommand,
      );
      const resourceId = resourceResponse.id;

      if (!resourceId) {
        throw new Error('Failed to create resource');
      }

      // Create methods (GET and POST)
      for (const method of ['GET', 'POST']) {
        // Create method
        const putMethodCommand = new PutMethodCommand({
          restApiId: apiId,
          resourceId: resourceId,
          httpMethod: method,
          authorizationType: 'NONE',
        });
        await this.apiGatewayClient.send(putMethodCommand);

        // Create integration
        const putIntegrationCommand = new PutIntegrationCommand({
          restApiId: apiId,
          resourceId: resourceId,
          httpMethod: method,
          type: 'AWS_PROXY',
          integrationHttpMethod: 'POST',
          uri: `arn:aws:apigateway:${this.region}:lambda:path/2015-03-31/functions/arn:aws:lambda:${this.region}:${await this.getAccountId()}:function:${functionName}/invocations`,
        });
        await this.apiGatewayClient.send(putIntegrationCommand);
      }

      // Deploy API
      const createDeploymentCommand = new CreateDeploymentCommand({
        restApiId: apiId,
        stageName: 'prod',
      });
      await this.apiGatewayClient.send(createDeploymentCommand);

      // Remove existing permission if it exists
      try {
        const removePermissionCommand = new RemovePermissionCommand({
          FunctionName: functionName,
          StatementId: 'apigateway-test-2',
        });
        await this.lambdaClient.send(removePermissionCommand);
        console.log(
          'Removed existing API Gateway permission from Lambda function',
        );
      } catch (error) {
        // If the permission doesn't exist, that's fine, we'll add it next
        console.log('No existing permission to remove');
      }

      // Add permission to Lambda function
      const addPermissionCommand = new AddPermissionCommand({
        FunctionName: functionName,
        StatementId: 'apigateway-test-2',
        Action: 'lambda:InvokeFunction',
        Principal: 'apigateway.amazonaws.com',
        SourceArn: `arn:aws:execute-api:${this.region}:${await this.getAccountId()}:${apiId}/*/*/${functionName}`,
      });
      await this.lambdaClient.send(addPermissionCommand);

      const apiUrl = `https://${apiId}.execute-api.${this.region}.amazonaws.com/prod/${functionName}`;
      console.log(`API Gateway created. URL: ${apiUrl}`);
      return apiUrl;
    } catch (error) {
      console.error('Error creating API Gateway:', error);
      throw error;
    }
  }

  private async getAccountId(): Promise<string> {
    if (!this.roleArn) {
      throw new Error('Role ARN is not available');
    }
    const arnParts = this.roleArn.split(':');
    return arnParts[4]; // Account ID is the 5th part of the ARN
  }
}
