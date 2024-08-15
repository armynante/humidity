import { expect, test, mock, jest } from 'bun:test';
import { AWSLambdaClient } from './AWSLambdaClient';
import {
  LambdaClient,
  CreateFunctionCommand,
  UpdateFunctionCodeCommand,
  DeleteFunctionCommand,
  InvokeCommand,
  GetFunctionCommand,
  AddPermissionCommand,
  RemovePermissionCommand,
} from '@aws-sdk/client-lambda';
import {
  IAMClient,
  CreateRoleCommand,
  AttachRolePolicyCommand,
  GetRoleCommand,
  ListAttachedRolePoliciesCommand,
  DetachRolePolicyCommand,
  DeleteRoleCommand,
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

// Mock clients
const mockLambdaClient = {
  send: mock((command) => {
    if (command instanceof GetFunctionCommand) {
      return Promise.resolve({ Configuration: { State: 'Active' } });
    }
    if (command instanceof InvokeCommand) {
      return Promise.resolve({
        Payload: new TextEncoder().encode(
          JSON.stringify({ result: 'success' }),
        ),
      });
    }
    if (
      command instanceof CreateFunctionCommand ||
      command instanceof UpdateFunctionCodeCommand
    ) {
      return Promise.resolve({ State: 'Active' });
    }
    return Promise.resolve({});
  }),
} as unknown as LambdaClient;

const mockIAMClient = {
  send: mock((command) => {
    if (command instanceof GetRoleCommand) {
      return Promise.resolve({
        Role: { Arn: 'arn:aws:iam::123456789012:role/LambdaExecutionRole' },
      });
    }
    return Promise.resolve({});
  }),
} as unknown as IAMClient;

const mockAPIGatewayClient = {
  send: mock((command) => {
    if (command instanceof GetResourcesCommand) {
      return Promise.resolve({ items: [{ id: 'root-resource-id' }] });
    }
    if (command instanceof CreateRestApiCommand) {
      return Promise.resolve({ id: 'test-api-id' });
    }
    if (command instanceof CreateResourceCommand) {
      return Promise.resolve({ id: 'test-resource-id' });
    }
    return Promise.resolve({});
  }),
} as unknown as APIGatewayClient;

// Test configuration
const config = {
  region: 'us-west-2',
  accessKeyId: 'test-access-key',
  secretAccessKey: 'test-secret-key',
};

// Helper function to create a client with mocked AWS services
function createMockedClient() {
  const client = new AWSLambdaClient(
    config.region,
    config.accessKeyId,
    config.secretAccessKey,
  );
  // @ts-ignore - Replacing the clients with mocks
  client.lambdaClient = mockLambdaClient;
  // @ts-ignore
  client.iamClient = mockIAMClient;
  // @ts-ignore
  client.apiGatewayClient = mockAPIGatewayClient;
  return client;
}

test('AWSLambdaClient - createOrUpdateFunction (create new)', async () => {
  const client = createMockedClient();
  // @ts-ignore - Mocking private method
  client.functionExists = mock(() => Promise.resolve(false));
  // @ts-ignore - Mocking private method
  client.zipCode = mock(() => Promise.resolve(Buffer.from('mock zip')));
  // @ts-ignore - Mocking private method
  client.waitForFunctionActive = mock(() => Promise.resolve());

  const result = await client.createOrUpdateFunction(
    'test-function',
    'console.log("Hello, World!");',
  );

  expect(mockLambdaClient.send).toHaveBeenCalledWith(
    expect.any(CreateFunctionCommand),
  );
  expect(mockLambdaClient.send).not.toHaveBeenCalledWith(
    expect.any(UpdateFunctionCodeCommand),
  );
  expect(result).toEqual({ State: 'Active' });
}, 15000);

test('AWSLambdaClient - createOrUpdateFunction (update existing)', async () => {
  const client = createMockedClient();
  // @ts-ignore - Mocking private method
  client.functionExists = mock(() => Promise.resolve(true));
  // @ts-ignore - Mocking private method
  client.zipCode = mock(() => Promise.resolve(Buffer.from('mock zip')));
  // @ts-ignore - Mocking private method
  client.waitForFunctionActive = mock(() => Promise.resolve());

  const result = await client.createOrUpdateFunction(
    'test-function',
    'console.log("Hello, World!");',
  );

  expect(mockLambdaClient.send).toHaveBeenCalledWith(
    expect.any(UpdateFunctionCodeCommand),
  );
  expect(result).toEqual({ State: 'Active' });
}, 15000);

test('AWSLambdaClient - deleteFunction', async () => {
  const client = createMockedClient();
  // @ts-ignore - Mocking private method
  client.functionExists = mock(() => Promise.resolve(true));

  await client.deleteFunction('test-function');

  expect(mockLambdaClient.send).toHaveBeenCalledWith(
    expect.any(DeleteFunctionCommand),
  );
});

test('AWSLambdaClient - invokeFunction', async () => {
  const client = createMockedClient();
  const mockPayload = { key: 'value' };

  const result = await client.invokeFunction('test-function', mockPayload);

  expect(mockLambdaClient.send).toHaveBeenCalledWith(expect.any(InvokeCommand));
  expect(result).toEqual({ result: 'success' });
});

test('AWSLambdaClient - createApiGateway', async () => {
  const client = createMockedClient();
  // @ts-ignore - Mocking private method
  client.getAccountId = mock(() => Promise.resolve('123456789012'));

  const apiUrl = await client.createApiGateway('test-function');

  expect(mockAPIGatewayClient.send).toHaveBeenCalledWith(
    expect.any(CreateRestApiCommand),
  );
  expect(mockAPIGatewayClient.send).toHaveBeenCalledWith(
    expect.any(GetResourcesCommand),
  );
  expect(mockAPIGatewayClient.send).toHaveBeenCalledWith(
    expect.any(CreateResourceCommand),
  );
  expect(mockAPIGatewayClient.send).toHaveBeenCalledWith(
    expect.any(PutMethodCommand),
  );
  expect(mockAPIGatewayClient.send).toHaveBeenCalledWith(
    expect.any(PutIntegrationCommand),
  );
  expect(mockAPIGatewayClient.send).toHaveBeenCalledWith(
    expect.any(CreateDeploymentCommand),
  );
  expect(mockLambdaClient.send).toHaveBeenCalledWith(
    expect.any(AddPermissionCommand),
  );
  expect(apiUrl).toBe(
    'https://test-api-id.execute-api.us-west-2.amazonaws.com/prod/test-function',
  );
});

test('AWSLambdaClient - deleteApiGateway', async () => {
  const client = createMockedClient();
  // Mock the GetRestApisCommand to return an API
  mockAPIGatewayClient.send = mock((command) => {
    if (command instanceof GetRestApisCommand) {
      return Promise.resolve({
        items: [{ name: 'test-function-api', id: 'test-api-id' }],
      });
    }
    return Promise.resolve({});
  });

  await client.deleteApiGateway('test-function');

  expect(mockAPIGatewayClient.send).toHaveBeenCalledWith(
    expect.any(GetRestApisCommand),
  );
  expect(mockAPIGatewayClient.send).toHaveBeenCalledWith(
    expect.any(DeleteRestApiCommand),
  );
  expect(mockLambdaClient.send).toHaveBeenCalledWith(
    expect.any(RemovePermissionCommand),
  );
});

test('AWSLambdaClient - deleteRole', async () => {
  const client = createMockedClient();
  mockIAMClient.send = mock((command) => {
    if (command instanceof ListAttachedRolePoliciesCommand) {
      return Promise.resolve({
        AttachedPolicies: [
          {
            PolicyArn:
              'arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole',
          },
        ],
      });
    }
    return Promise.resolve({});
  });

  await client.deleteRole();

  expect(mockIAMClient.send).toHaveBeenCalledWith(
    expect.any(ListAttachedRolePoliciesCommand),
  );
  expect(mockIAMClient.send).toHaveBeenCalledWith(
    expect.any(DetachRolePolicyCommand),
  );
  expect(mockIAMClient.send).toHaveBeenCalledWith(
    expect.any(DeleteRoleCommand),
  );
});

test('AWSLambdaClient - tearDown', async () => {
  const client = createMockedClient();
  // @ts-ignore - Mocking methods
  client.deleteApiGateway = mock();
  // @ts-ignore
  client.deleteFunction = mock();
  // @ts-ignore
  client.deleteRole = mock();

  await client.tearDown('test-function');

  expect(client.deleteApiGateway).toHaveBeenCalledWith('test-function');
  expect(client.deleteFunction).toHaveBeenCalledWith('test-function');
  expect(client.deleteRole).toHaveBeenCalled();
});
