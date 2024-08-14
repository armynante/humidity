import { homedir } from 'os';
import type {
  Config,
  NewProjectQuestions,
  Project,
  RequiredEnvs,
  RequiredEnvsSet,
} from '../types/config';
import path, { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import * as dotenv from 'dotenv';

/**
 * Initializes a blank config object
 * @returns {Config} The config object
 */
export const initializeConfig = (): Config => {
  const config = {
    projects: [] as Project[],
  } as Config;
  return config;
};

/**
 * Loads the config file from the .env file
 * @param envPath The path to the .env file
 *
 */
export const loadConfigFromEnv = async (envPath: string): Promise<void> => {
  const resolvedPath = envPath.replace('~', os.homedir());
  const absolutePath = path.resolve(resolvedPath);
  dotenv.config({ path: absolutePath });
};

/**
 * Checks if the config file exists
 * @returns {Promise<Config | false>} The config file or false if it doesn't exist
 */
export const checkConfigExists = async (): Promise<Config | false> => {
  const filePath = join(homedir(), '.humidity/config.json');
  const file = Bun.file(filePath);
  if (await file.exists()) {
    return file.json();
  } else {
    return false;
  }
};

/**
 * Build the .env.humidity file
 * @param envPath The path to the .env.humidity file
 * @param envs The environment variables to write
 * @returns {Promise<void>}
 */
export const buildEnvFile = async (
  envPath: string,
  envs: RequiredEnvs,
): Promise<void> => {
  try {
    const exampleEnvPath = join(
      __dirname,
      '../templates/.env.humidity.example',
    );
    const resolvedPath = envPath.replace('~', os.homedir());
    const absolutePath = path.resolve(resolvedPath);
    // create the .env file using the envs object using node fs
    const envFile = `GH_USERNAME=${envs.GH_USERNAME}\nGH_TOKEN=${envs.GH_TOKEN}\nDO_REGISTRY_NAME=${envs.DO_REGISTRY_NAME}\nDO_API_TOKEN=${envs.DO_API_TOKEN}\nDO_SPACES_REGION=${envs.DO_SPACES_REGION}\nDO_SPACES_API_KEY=${envs.DO_SPACES_ACCESS_KEY}\nDO_SPACES_SECRET_KEY=${envs.DO_SPACES_SECRET_KEY}`;
    await fs.writeFile(absolutePath, envFile);
  } catch (error) {
    console.error(error);
  }
};

/**
 * Validate the .env.humidity file
 * The function checks if the required environment variables are present
 * and returns a set of missing environment variables
 * @param envPath The path to the .env.humidity file
 * @returns {Promise<[boolean, RequiredEnvsSet]>}
 */
export const validateEnvFile = async (
  envPath: string,
): Promise<[boolean, RequiredEnvsSet]> => {
  const envFile = await fs.exists(envPath);
  if (!envFile) {
    throw new Error('Env file does not exist');
  }
  let missingEnvSet: RequiredEnvsSet = {
    GH_USERNAME: true,
    GH_TOKEN: true,
    DO_REGISTRY_NAME: true,
    DO_API_TOKEN: true,
  };
  const envs = dotenv.parse(await fs.readFile(envPath));
  const missingEnvs = Object.keys(missingEnvSet).filter(
    (env) => !envs[env],
  ) as (keyof RequiredEnvsSet)[];

  missingEnvs.forEach((env) => {
    missingEnvSet[env] = false;
  });
  const isMissing = missingEnvs.length > 0;
  return [isMissing, missingEnvSet];
};

/**
 * Creates a blank config file in the user's home directory
 * @returns {Promise<Config>} The created config
 */
export const createConfig = async (): Promise<Config> => {
  const filePath = join(homedir(), '.humidity/config.json');
  const exists = await fs.exists(filePath);
  if (!exists) {
    throw new Error('Config file already exists');
  }
  console.log('Writing config...');
  const config = initializeConfig();
  await fs.writeFile(filePath, JSON.stringify(config, null, 2));
  console.log(`Config created at ${filePath}`);
  return config;
};

/**
 * Creates a project object and saves it
 * to the config file
 * @param projectName The name of the project
 * @param type Go, Python, TypeScript, etc.
 * @param description Project description
 * @returns {Promise<Project>} The created project
 */
export const createNewProject = async (
  np: NewProjectQuestions,
): Promise<Project> => {
  // check if the name is in dash-case
  if (!np.name.match(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)) {
    throw new Error('Project name must be in dash-case');
  }
  const config = await checkConfigExists();
  if (!config) {
    throw new Error('Config does not exist');
  }
  const newProject = {
    name: np.name,
    id: randomUUID(),
    type: np.projectType,
    description: np.description || '',
    created: new Date(),
    updated: new Date(),
  } as Project;
  // add the project to the config
  config.projects.push(newProject);
  // write the config
  const filePath = join(homedir(), '.humidity/config.json');
  await fs.writeFile(filePath, JSON.stringify(config, null, 2));
  return newProject;
};

/**
 * Updates a project in the config file
 * @param projectId The ID of the project to update
 * @param updates The updates to apply to the project
 * @returns {Promise<Project>} The updated project
 */
export const updateProject = async (
  projectId: string,
  updates: Partial<Project>,
): Promise<Project> => {
  const config = await checkConfigExists();
  if (!config) {
    throw new Error('Config does not exist');
  }
  const project = config.projects.find((p) => p.id === projectId);
  if (!project) {
    throw new Error('Project not found');
  }
  // update the updated at date
  project.updated = new Date();
  // update the project
  Object.assign(project, updates);
  // write the config
  const filePath = join(homedir(), '.humidity/config.json');
  await fs.writeFile(filePath, JSON.stringify(config, null, 2));
  return project;
};

/**
 * Update the config with settings
 * The updates to apply to the config with a partial object
 * @param updates {Partial<Config>}
 * @returns {Promise<Config>} The updated config
 */
export const updateConfig = async (
  updates: Partial<Config>,
): Promise<[Partial<Config> | null, string | null]> => {
  const config = await checkConfigExists();
  let error = null;
  if (!config) {
    return [null, 'Config does not exist'];
  }
  // update the updated at date
  config.projects.forEach((p) => {
    p.updated = new Date();
  });
  // update the config
  Object.assign(config, updates);
  // write the config
  const filePath = join(homedir(), '.humidity/config.json');
  await fs.writeFile(filePath, JSON.stringify(config, null, 2));
  return [config, error];
};

/**
 * Lists all projects in the config file
 * @returns {Promise<Project[]>} An array of projects
 */
export const listProjects = async (): Promise<Project[]> => {
  const config = await checkConfigExists();
  if (!config) {
    throw new Error('Config does not exist');
  }
  return config.projects;
};

/**
 * Loads a project from the config file
 * @param projectId The ID of the project to view
 * @returns {Promise<Project>} The project
 */
export const viewProject = async (projectId: string): Promise<Project> => {
  const config = await checkConfigExists();
  if (!config) {
    throw new Error('Config does not exist');
  }
  const project = config.projects.find((p) => p.id === projectId);
  if (!project) {
    throw new Error('Project not found');
  }
  return project;
};

/**
 * Deletes a project from the config file
 * @param projectId The ID of the project to delete
 */
export const deleteProject = async (projectId: string) => {
  const config = await checkConfigExists();
  if (!config) {
    throw new Error('Config does not exist');
  }
  const projectIndex = config.projects.findIndex((p) => p.id === projectId);
  if (projectIndex === -1) {
    throw new Error('Project not found');
  }
  config.projects.splice(projectIndex, 1);
  // write the config
  const filePath = join(homedir(), '.humidity/config.json');
  await fs.writeFile(filePath, JSON.stringify(config, null, 2));
};
