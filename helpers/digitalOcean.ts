import axios, { AxiosError, type AxiosResponse } from 'axios';
import type { DoAppSpec } from '../types/do';
import { runCommand } from './io';
import fs from 'node:fs/promises';

type ApiResponse<T> = [T | null, string | null];

class DigitalOceanService {
  private apiToken: string;
  private apiBaseUrl: string = 'https://api.digitalocean.com/v2';

  constructor(apiToken: string) {
    this.apiToken = apiToken;
  }

  private async apiRequest<T>(
    method: 'get' | 'post' | 'delete',
    endpoint: string,
    data?: any,
  ): Promise<ApiResponse<T>> {
    try {
      const { data: responseData } = await axios({
        method,
        url: `${this.apiBaseUrl}${endpoint}`,
        data,
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json',
        },
      });
      return [responseData, null];
    } catch (error) {
      if (error instanceof AxiosError) {
        return [null, error.message];
      }
      return [null, 'An unknown error occurred'];
    }
  }

  // Docker-related methods
  async buildImage(
    imageName: string,
    tag: string,
    dockerfile: string,
  ): Promise<void> {
    await runCommand('docker', [
      'build',
      '-t',
      `${imageName}:${tag}`,
      '-f',
      dockerfile,
      '.',
    ]);
  }

  async pushImage(imageName: string, tag: string): Promise<void> {
    await runCommand('docker', ['push', `${imageName}:${tag}`]);
  }

  // App-related methods
  createDoAppSpec(
    appName: string,
    port: number,
    tag: string,
    repository: string,
  ): DoAppSpec {
    return {
      name: appName,
      region: 'nyc',
      features: ['buildpack-stack=ubuntu-22'],
      ingress: {
        rules: [
          {
            component: { name: appName },
            match: { path: { prefix: '/' } },
          },
        ],
      },
      services: [
        {
          name: appName,
          http_port: port,
          image: {
            registry_type: 'DOCR',
            repository: repository,
            tag: tag,
            deploy_on_push: { enabled: true },
          },
          instance_count: 1,
          instance_size_slug: 'apps-s-1vcpu-0.5gb',
        },
      ],
    };
  }

  async writeDoAppSpec(
    appName: string,
    appSpec: DoAppSpec,
    path: string,
  ): Promise<ApiResponse<string>> {
    try {
      await fs.writeFile(
        `${path}/${appName}.do-app-spec.yaml`,
        JSON.stringify(appSpec, null, 2),
      );
      return [null, null];
    } catch (error) {
      return [null, 'An error occurred writing the spec file'];
    }
  }

  async createDoApp(spec: DoAppSpec) {
    try {
      const response = await axios.post(
        'https://api.digitalocean.com/v2/apps',
        { spec },
        {
          headers: { Authorization: `Bearer ${this.apiToken}` },
        },
      );
      return [response.data.app, null];
    } catch (error) {
      // @ts-ignore
      return [null, error.message];
    }
  }

  async pollDoAppStatus(appId: string, pollPeriod: number) {
    const poll = async () => {
      const [data, error] = await this.apiRequest<any>('get', `/apps/${appId}`);
      return error ? null : data;
    };

    let status = await poll();
    while (status && status.app && !status.app?.live_url) {
      await new Promise((resolve) => setTimeout(resolve, pollPeriod));
      status = await poll();
    }
    return [status, null];
  }

  async deleteDoApp(appId: string): Promise<ApiResponse<any>> {
    return this.apiRequest<any>('delete', `/apps/${appId}`);
  }

  // Registry-related methods
  async getRepoManifests(
    repository: string,
    registry: string,
  ): Promise<ApiResponse<string[]>> {
    const [data, error] = await this.apiRequest<any>(
      'get',
      `/registry/${registry}/repositories/${repository}/digests`,
    );
    if (error) return [null, error];
    const manifests = data.manifests.map(
      (manifest: Record<string, string>) => manifest.digest,
    );
    return [manifests, null];
  }

  async deleteDoManifest(
    repository: string,
    registry: string,
    sha: string,
  ): Promise<ApiResponse<any>> {
    return this.apiRequest<any>(
      'delete',
      `/registry/${registry}/repositories/${repository}/digests/${sha}`,
    );
  }

  async deleteDoRegistryRepo(
    repository: string,
    registry: string,
  ): Promise<ApiResponse<string[]>> {
    const [manifests, err] = await this.getRepoManifests(repository, registry);
    if (err) return [null, err];

    for (const sha of manifests!) {
      const [, error] = await this.deleteDoManifest(repository, registry, sha);
      if (error) return [null, error];
    }

    return [manifests, null];
  }

  async doGarbageCollection(registry: string): Promise<ApiResponse<any>> {
    return this.apiRequest<any>(
      'post',
      `/registry/${registry}/garbage-collection`,
    );
  }
}

export default DigitalOceanService;
