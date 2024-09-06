import axios, { AxiosError } from 'axios';
import { runCommand } from '../../../helpers/io.js';
import fs from 'node:fs/promises';
class DigitalOceanService {
    apiToken;
    apiBaseUrl = 'https://api.digitalocean.com/v2';
    constructor(apiToken) {
        this.apiToken = apiToken;
    }
    async apiRequest(method, endpoint, data) {
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
        }
        catch (error) {
            if (error instanceof AxiosError) {
                return [null, error.message];
            }
            return [null, 'An unknown error occurred'];
        }
    }
    // Docker-related methods
    async buildImage(imageName, tag, dockerfile) {
        await runCommand('docker', [
            'build',
            '-t',
            `${imageName}:${tag}`,
            '-f',
            dockerfile,
            '.',
        ]);
    }
    async pushImage(imageName, tag) {
        await runCommand('docker', ['push', `${imageName}:${tag}`]);
    }
    // App-related methods
    createDoAppSpec(appName, port, tag, repository) {
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
    async writeDoAppSpec(appName, appSpec, path) {
        try {
            await fs.writeFile(`${path}/${appName}.do-app-spec.yaml`, JSON.stringify(appSpec, null, 2));
            return [null, null];
        }
        catch (error) {
            return [null, 'An error occurred writing the spec file'];
        }
    }
    async createDoApp(spec) {
        try {
            const response = await axios.post('https://api.digitalocean.com/v2/apps', { spec }, {
                headers: { Authorization: `Bearer ${this.apiToken}` },
            });
            return [response.data.app, null];
        }
        catch (error) {
            // @ts-ignore
            return [null, error.message];
        }
    }
    async pollDoAppStatus(appId, pollPeriod) {
        const poll = async () => {
            const [data, error] = await this.apiRequest('get', `/apps/${appId}`);
            return error ? null : data;
        };
        let status = await poll();
        while (status && status.app && !status.app?.live_url) {
            await new Promise((resolve) => setTimeout(resolve, pollPeriod));
            status = await poll();
        }
        return [status, null];
    }
    async deleteDoApp(appId) {
        return this.apiRequest('delete', `/apps/${appId}`);
    }
    // Registry-related methods
    async getRepoManifests(repository, registry) {
        const [data, error] = await this.apiRequest('get', `/registry/${registry}/repositories/${repository}/digests`);
        if (error)
            return [null, error];
        const manifests = data.manifests.map((manifest) => manifest.digest);
        return [manifests, null];
    }
    async deleteDoManifest(repository, registry, sha) {
        return this.apiRequest('delete', `/registry/${registry}/repositories/${repository}/digests/${sha}`);
    }
    async deleteDoRegistryRepo(repository, registry) {
        const [manifests, err] = await this.getRepoManifests(repository, registry);
        if (err)
            return [null, err];
        for (const sha of manifests) {
            const [, error] = await this.deleteDoManifest(repository, registry, sha);
            if (error)
                return [null, error];
        }
        return [manifests, null];
    }
    async doGarbageCollection(registry) {
        return this.apiRequest('post', `/registry/${registry}/garbage-collection`);
    }
}
export default DigitalOceanService;
