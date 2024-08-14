import axios, { AxiosError, type AxiosResponse } from 'axios';
import type { DoAppSpec } from '../types/do';
import process from 'node:process';
import { runCommand } from './io';
import fs from 'node:fs/promises';

/**
 * Builds a Docker image
 * @param imageName The name of the image
 * @param tag The tag of the image. Usually 'latest'.
 * @param dockerfile The path to the Dockerfile
 */
export const buildImage = async (
  imageName: string,
  tag: string,
  dockerfile: string,
) => {
  await runCommand('docker', [
    'build',
    '-t',
    `${imageName}:${tag}`,
    '-f',
    dockerfile,
    '.',
  ]);
};

/**
 * Push a Docker image to a registry
 * @param imageName The name of the image
 * @param tag The tag of the image
 * @returns {Promise<string>} The output of the push command
 */
export const pushImage = async (imageName: string, tag: string) => {
  await runCommand('docker', ['push', `${imageName}:${tag}`]);
};

/**
 * Create a DigitalOcean App spec
 * @param appName The name of the app
 * @param port The port the app will listen on
 * @param tag The tag of the image to deploy. Usually 'latest'.
 * @param repository The name of the repository
 * @returns {DoAppSpec} The app spec
 * @example createDoAppSpec('my-app', 3000, 'latest', 'my-app')
 */
export const createDoAppSpec = (
  appName: string,
  port: number,
  tag: string,
  repository: string,
): DoAppSpec => {
  return {
    name: appName,
    region: 'nyc',
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
        http_port: port,
        image: {
          registry_type: 'DOCR',
          repository: repository,
          tag: tag,
          deploy_on_push: {
            enabled: true,
          },
        },
        instance_count: 1,
        instance_size_slug: 'apps-s-1vcpu-0.5gb',
      },
    ],
  };
};

/**
 * Write a DigitalOcean App spec to a file
 * @param appName The name of the app
 * @param appSpec The app spec to write
 * @returns {Promise<string | void>} An error message or void
 */
export const writeDoAppSpec = async (
  appName: string,
  appSpec: DoAppSpec,
  path: string,
): Promise<string | void> => {
  try {
    await fs.writeFile(
      `${path}/${appName}.do-app-spec.yaml`,
      JSON.stringify(appSpec, null, 2),
    );
  } catch (error) {
    console.error(error);
    return 'An error occurred writing the spec file';
  }
};

/**
 * Create a DigitalOcean App from a spec though the API
 * @param spec {DoAppSpec} The app spec
 * @returns {Promise<any>} The app object
 */
export const createDoApp = async (spec: DoAppSpec) => {
  try {
    const slug = { spec };
    const response = await axios.post(
      'https://api.digitalocean.com/v2/apps',
      slug,
      {
        headers: {
          Authorization: `Bearer ${process.env.DO_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
      },
    );
    return response.data;
  } catch (error) {
    console.error(error);
    return null;
  }
};

/**
 * Poll the DigitalOcean API until the app is live.
 * It should return a live URL in the app object returned
 * @param appId The ID of the app to poll
 * @returns {Promise<any>} The app status
 */
export const pollDoAppStatus = async (appId: string, pollPeriod: number) => {
  const poll = async () => {
    try {
      const response = await axios.get(
        `https://api.digitalocean.com/v2/apps/${appId}`,
        {
          headers: {
            Authorization: `Bearer ${process.env.DO_API_TOKEN}`,
          },
        },
      );
      return response.data;
    } catch (error) {
      console.error(error);
      return null;
    }
  };
  let status = await poll();
  while (status && status.app && !status.app?.live_url) {
    await new Promise((resolve) => setTimeout(resolve, pollPeriod));
    status = await poll();
  }
  return status;
};

/**
 * Delete a DigitalOcean App
 * @param appId The ID of the app to delete
 * @returns {Promise<[AxiosResponse["data"] | null, string | null]>} The response data or an error message
 */
export const deleteDoApp = async (
  appId: string,
): Promise<[AxiosResponse['data'] | null, string | null]> => {
  try {
    const { data } = await axios.delete(
      `https://api.digitalocean.com/v2/apps/${appId}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.DO_API_TOKEN}`,
        },
      },
    );
    return [data, null];
  } catch (error) {
    if (error instanceof AxiosError) {
      return [null, error.message];
    } else {
      return [null, 'An unknown error occurred'];
    }
  }
};

// Delete DO Registry Repository
export const getRepoManifests = async (
  repository: string,
  registry: string,
): Promise<[AxiosResponse['data'] | null, string | null]> => {
  try {
    const { data } = await axios.get(
      `https://api.digitalocean.com/v2/registry/${registry}/repositories/${repository}/digests`,
      {
        headers: {
          Authorization: `Bearer ${process.env.DO_API_TOKEN}`,
        },
      },
    );
    const manifests = data.manifests.map((manifest: Record<string, string>) => {
      return manifest.digest;
    });
    return [manifests, null];
  } catch (error) {
    if (error instanceof AxiosError) {
      return [null, error.message];
    } else {
      return [null, 'An unknown error occurred'];
    }
  }
};

// Delete DO Registry Repository by digest
export const deleteDoManifest = async (
  repository: string,
  registry: string,
  sha: string,
): Promise<[AxiosResponse['data'] | null, string | null]> => {
  try {
    const { data } = await axios.delete(
      `https://api.digitalocean.com/v2/registry/${registry}/repositories/${repository}/digests/${sha}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.DO_API_TOKEN}`,
        },
      },
    );
    return [data, null];
  } catch (error) {
    if (error instanceof AxiosError) {
      return [null, error.message];
    } else {
      return [null, 'An unknown error occurred'];
    }
  }
};

// loop through the manifests and delete them
export const deleteDoRegistryRepo = async (
  repository: string,
  registry: string,
): Promise<[AxiosResponse['data'] | null, string | null]> => {
  const [manifests, err] = await getRepoManifests(repository, registry);
  if (err) {
    return [null, err];
  }
  for (const sha of manifests) {
    const [, err] = await deleteDoManifest(repository, registry, sha);
    if (err) {
      return [null, err];
    }
  }
  return [manifests, null];
};

//run garbage collection on the DO registry
export const doGarbageCollection = async (
  registry: string,
): Promise<[AxiosResponse['data'] | null, string | null]> => {
  try {
    const { data } = await axios.post(
      `https://api.digitalocean.com/v2/registry/${registry}/garbage-collection`,
      {
        headers: {
          Authorization: `Bearer ${process.env.DO_API_TOKEN}`,
        },
      },
    );
    return [data, null];
  } catch (error) {
    if (error instanceof AxiosError) {
      return [null, error.message];
    } else {
      return [null, 'An unknown error occurred'];
    }
  }
};
