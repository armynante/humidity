import { describe, expect, beforeEach, jest, it } from '@jest/globals';
import fs from 'fs/promises';
import axios from 'axios';
import DigitalOceanService from './DigitalOceanClient';
import { features } from 'process';
jest.mock('axios');
jest.mock('node:fs/promises');

describe('DigitalOceanService', () => {
  let service: DigitalOceanService;
  const mockApiToken = 'fake-api-token';

  beforeEach(() => {
    service = new DigitalOceanService(mockApiToken);
    jest.clearAllMocks();
  });

  describe('apiRequest method', () => {
    it('should make a successful API request', async () => {
      const mockResponse = { data: { id: '123', name: 'test-app' } };
      (axios as jest.Mocked<typeof axios>).mockResolvedValue(mockResponse);

      const [result, error] = await (service as any).apiRequest('get', '/apps');

      expect(result).toEqual(mockResponse.data);
      expect(error).toBeNull();
      expect(axios).toHaveBeenCalledWith({
        method: 'get',
        url: 'https://api.digitalocean.com/v2/apps',
        headers: {
          Authorization: `Bearer ${mockApiToken}`,
          'Content-Type': 'application/json',
        },
      });
    });

    it('should handle API request errors', async () => {
      const mockError = new Error('API Error');
      (axios as jest.Mocked<typeof axios>).mockRejectedValue(mockError);

      const [result, error] = await (service as any).apiRequest('get', '/apps');

      expect(result).toBeNull();
      expect(error).toBe('API Error');
    });
  });

  describe('writeDoAppSpec method', () => {
    it('should write app spec to file', async () => {
      const appName = 'test-app';
      const appSpec = {
        name: appName,
        region: 'nyc3',
        features: ['buildpack-stack=ubuntu-22'],
        ingress: {
          rules: [
            {
              component: {
                name: appName,
              },
              match: {
                path: {
                  prefix: '/',
                },
              },
            },
          ],
        },
        services: [
          {
            name: appName,
            http_port: 3000,
            image: {
              registry_type: 'DOCR',
              repository: 'appName',
              tag: 'latest',
              deploy_on_push: {
                enabled: true,
              },
            },
            instance_count: 1,
            instance_size_slug: 'apps-s-1vcpu-0.5gb',
          },
        ],
      };

      const testPath = '/test/path';

      (
        fs.writeFile as jest.MockedFunction<typeof fs.writeFile>
      ).mockResolvedValue(undefined);

      const [result, error] = await service.writeDoAppSpec(
        appName,
        appSpec,
        testPath,
      );

      expect(result).toBeNull();
      expect(error).toBeNull();
      expect(fs.writeFile).toHaveBeenCalledWith(
        `${testPath}/${appName}.do-app-spec.yaml`,
        JSON.stringify(appSpec, null, 2),
      );
    });
  });
});
