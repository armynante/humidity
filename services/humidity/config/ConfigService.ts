import { homedir } from 'os';
import type {
  Config,
  NewProjectQuestions,
  Project,
  RequiredEnvs,
  Service,
} from '../../../types/config';
import path, { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import * as dotenv from 'dotenv';
import { any, z } from 'zod';
import type { UUID } from 'crypto';
import { mkdir } from 'fs/promises';
import internal from 'stream';

const uuidRegex =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[4][0-9a-fA-F]{3}-[89AB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/i;

const ProjectSchema = z.object({
  name: z.string(),
  id: z.string().refine((id): id is UUID => uuidRegex.test(id), {
    message: 'Invalid UUID',
  }),
  type: z.string().optional(),
  description: z.string().optional(),
  created: z.date().or(z.string()),
  updated: z.date().or(z.string()),
  gitHubRepo: z.string().optional(),
  do_link: z.string().optional(),
  do_app_id: z.string().optional(),
  do_config: z.any().optional(),
});

const RequiredEnvsSchema = z.object({
  GH_USERNAME: z.string().min(1),
  GH_TOKEN: z.string().min(1),
  DO_REGISTRY_NAME: z.string().min(1),
  DO_API_TOKEN: z.string().min(1),
  DO_SPACES_REGION: z.string().min(1),
  DO_SPACES_ACCESS_KEY: z.string().min(1),
  DO_SPACES_SECRET_KEY: z.string().min(1),
  AMZ_ID: z.string().min(1),
  AMZ_SEC: z.string().min(1),
  AMZ_REGION: z.string().min(1),
});

const ServiceSchema = z.object({
  name: z.string(),
  id: z.string().refine((id): id is UUID => uuidRegex.test(id), {
    message: 'Invalid UUID',
  }),
  internal_name: z.string(),
  config: z.record(z.any()),
  url: z.string(),
  updated: z.date().or(z.string()),
  created: z.date().or(z.string()),
  serviceType: z.string(),
  apiId: z.string(),
});

const ConfigSchema = z.object({
  projects: z.array(ProjectSchema),
  useEnvFile: z.boolean(),
  envPath: z.string(),
  services: z.array(ServiceSchema),
});

/**
 * Service for managing configuration and projects.
 */
export class ConfigService {
  private config: Config | null = null;
  private configPath: string;
  private envPath: string;

  /**
   * Creates an instance of ConfigService.
   */
  constructor() {
    this.configPath = join(homedir(), '.humidity/config.json');
    this.envPath = join(homedir(), '.humidity/.env.humidity');
  }

  /**
   * Loads the configuration from the config file.
   * @throws {Error} If the config file is invalid or doesn't exist.
   */
  private async loadConfig(): Promise<void> {
    const file = await fs.exists(this.configPath);
    if (file) {
      let conf = await fs.readFile(this.configPath, 'utf-8');
      const parsedConfig = ConfigSchema.safeParse(JSON.parse(conf));
      if (parsedConfig.success) {
        this.config = parsedConfig.data;
      } else {
        console.error(parsedConfig.error.errors);
        throw new Error('Invalid config file');
      }

      if (this.config.useEnvFile) {
        await this.loadConfigFromEnv(this.config.envPath);
      }
    } else {
      throw new Error('Config file does not exist');
    }
  }

  /**
   * Initializes a new configuration object.
   * @returns {Config} The initialized configuration object.
   */
  private initializeConfig(): Config {
    return {
      projects: [],
      useEnvFile: false,
      envPath: '',
      services: [],
    } as Config;
  }

  /**
   * Loads configuration from an environment file.
   * @param {string} envPath - The path to the environment file.
   */
  async loadConfigFromEnv(envPath: string): Promise<void> {
    const resolvedPath = envPath.replace('~', os.homedir());
    const absolutePath = path.resolve(resolvedPath);
    dotenv.config({ path: absolutePath });
  }

  /**
   * Checks if the configuration file exists.
   * @returns {Promise<Config>} True if the config file exists, false otherwise.
   */
  async load(reload?: boolean): Promise<Config> {
    if (!this.config || reload) {
      console.log('Loading config...');
      await this.loadConfig();
    }
    return this.config as Config;
  }

  /**
   * Validates the environment file.
   * @param {string} envPath - The path to the environment file.
   * @param {(keyof RequiredEnvs)[]} [keysToCheck] - Optional array of keys to check.
   * @returns {Promise<[boolean, (keyof RequiredEnvs)[]]>} A tuple containing a boolean indicating validity and an array of missing keys.
   */
  async validateEnvFile(
    keysToCheck?: (keyof RequiredEnvs)[],
  ): Promise<[boolean, (keyof RequiredEnvs)[]]> {
    const envFile = await fs.exists(this.envPath);
    if (!envFile) {
      return [false, []];
    }

    const envContent = await fs.readFile(this.envPath, 'utf-8');
    const envs = dotenv.parse(envContent);

    if (!keysToCheck || keysToCheck.length === 0) {
      return [true, []];
    }

    const partialSchema = z.object(
      keysToCheck.reduce(
        (acc, key) => {
          acc[key] = RequiredEnvsSchema.shape[key];
          return acc;
        },
        {} as { [K in keyof RequiredEnvs]: z.ZodTypeAny },
      ),
    );

    const result = partialSchema.safeParse(envs);

    if (result.success) {
      return [true, []];
    } else {
      const missingKeys = result.error.issues.map(
        (issue) => issue.path[0] as keyof RequiredEnvs,
      );
      return [false, missingKeys];
    }
  }

  /**
   * Builds an environment file with the provided environment variables.
   * @param {string} envPath - The path where the environment file should be created.
   * @param {RequiredEnvs} envs - The environment variables to include in the file.
   * @throws {Error} If there's an error building the env file or if invalid environment variables are provided.
   */
  async buildEnvFile(envPath: string, envs: RequiredEnvs): Promise<void> {
    try {
      const resolvedPath = envPath.replace('~', os.homedir());
      const absolutePath = path.resolve(resolvedPath);

      // Validate envs before writing
      const validationResult = RequiredEnvsSchema.partial().safeParse(envs);
      if (!validationResult.success) {
        throw new Error('Invalid environment variables provided');
      }

      const envFile = Object.entries(envs)
        .filter(
          ([, value]) => value !== undefined && value !== null && value !== '',
        )
        .map(([key, value]) => `${key}=${value}`)
        .join('\n');

      await fs.writeFile(absolutePath, envFile);
    } catch (error) {
      console.error('Error building env file:', error);
      throw error;
    }
  }

  /**
   * Creates a new configuration file if one doesn't exist or loads the existing one.
   * @returns {Promise<[boolean, Config]>} A tuple containing a boolean indicating if a new config was generated and the created configuration.
   *
   */
  async init(): Promise<[boolean, Config]> {
    const exists = await fs.exists(this.configPath);
    if (exists) {
      console.log('Config already exists...');

      await this.loadConfig();
      if (!this.config) {
        throw new Error('Config does not exist');
      }
      return [false, this.config];
    }
    console.log('Writing config...');
    this.config = this.initializeConfig();
    await mkdir(join(homedir(), '.humidity'), { recursive: true });
    await fs.writeFile(this.configPath, JSON.stringify(this.config, null, 2));
    console.log(`Config created at ${this.configPath}`);
    return [true, this.config];
  }

  /**
   * Creates a new project and adds it to the configuration.
   * @param {NewProjectQuestions} np - The new project details.
   * @returns {Promise<Project>} The newly created project.
   * @throws {Error} If the project name is not in dash-case or if the config doesn't exist.
   */
  async createNewProject(np: NewProjectQuestions): Promise<Project> {
    if (!np.name.match(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)) {
      throw new Error('Project name must be in dash-case');
    }
    await this.loadConfig();
    if (!this.config) {
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
    this.config.projects.push(newProject);
    await this.saveConfig();
    return newProject;
  }

  /**
   * Updates an existing project.
   * @param {string} projectId - The ID of the project to update.
   * @param {Partial<Project>} updates - The updates to apply to the project.
   * @returns {Promise<Project>} The updated project.
   * @throws {Error} If the config doesn't exist or if the project is not found.
   */
  async updateProject(
    projectId: string,
    updates: Partial<Project>,
  ): Promise<Project> {
    await this.loadConfig();
    if (!this.config) {
      throw new Error('Config does not exist');
    }
    const project = this.config.projects.find((p) => p.id === projectId);
    if (!project) {
      throw new Error('Project not found');
    }
    project.updated = new Date();
    Object.assign(project, updates);
    await this.saveConfig();
    return project;
  }

  /**
   * Updates the configuration.
   * @param {Partial<Config>} updates - The updates to apply to the configuration.
   * @returns {Promise<[Partial<Config> | null, string | null]>} A tuple containing the updated config (or null) and an error message (or null).
   */
  async updateConfig(
    updates: Partial<Config>,
  ): Promise<[Partial<Config> | null, string | null]> {
    await this.loadConfig();
    if (!this.config) {
      return [null, 'Config does not exist'];
    }
    this.config.projects.forEach((p) => {
      p.updated = new Date();
    });
    Object.assign(this.config, updates);
    await this.saveConfig();
    return [this.config, null];
  }

  /**
   * Adds a new service to the configuration.
   * @param {Service} service - The service to add.
   * @throws {Error} If the config doesn't exist.
   */
  async addService(service: Service): Promise<void> {
    await this.loadConfig();
    if (!this.config) {
      throw new Error('Config does not exist');
    }
    this.config.services.push(service);
    await this.saveConfig();
  }

  /**
   * Lists all services in the configuration.
   * @returns {Promise<Service[]>} An array of all services.
   * @throws {Error} If the config doesn't exist.
   */
  async listServices(): Promise<Service[]> {
    await this.loadConfig();
    if (!this.config) {
      throw new Error('Config does not exist');
    }
    return this.config.services;
  }

  /**
   * Retrieves a specific service by its name.
   * @param {string} serviceName - The name of the service to retrieve.
   * @returns {Promise<Service>} The requested service.
   * @throws {Error} If the config doesn't exist or if the service is not found.
   */

  async viewService(id: string): Promise<Service> {
    await this.loadConfig();
    if (!this.config) {
      throw new Error('Config does not exist');
    }
    const service = this.config.services.find((s) => s.id === id);
    if (!service) {
      throw new Error('Service not found');
    }
    return service;
  }

  /**
   * Deletes a service from the configuration.
   * @param {string} id - The id of the service to delete.
   * @throws {Error} If the config doesn't exist or if the service is not found.
   */
  async deleteService(id: string): Promise<void> {
    await this.loadConfig();
    if (!this.config) {
      throw new Error('Config does not exist');
    }
    const serviceIndex = this.config.services.findIndex((s) => s.id === id);
    if (serviceIndex === -1) {
      throw new Error('Service not found');
    }
    this.config.services.splice(serviceIndex, 1);
    await this.saveConfig();
  }

  /**
   * Lists all projects in the configuration.
   * @returns {Promise<Project[]>} An array of all projects.
   * @throws {Error} If the config doesn't exist.
   */
  async listProjects(reloadConf?: boolean): Promise<Project[]> {
    await this.load(reloadConf === true);
    if (!this.config) {
      throw new Error('Config does not exist');
    }
    return this.config.projects;
  }

  /**
   * Retrieves a specific project by its ID.
   * @param {string} projectId - The ID of the project to retrieve.
   * @returns {Promise<Project>} The requested project.
   * @throws {Error} If the config doesn't exist or if the project is not found.
   */
  async viewProject(projectId: string): Promise<Project> {
    await this.loadConfig();
    if (!this.config) {
      throw new Error('Config does not exist');
    }
    const project = this.config.projects.find((p) => p.id === projectId);
    if (!project) {
      throw new Error('Project not found');
    }
    return project;
  }

  /**
   * Deletes a project from the configuration.
   * @param {string} projectId - The ID of the project to delete.
   * @throws {Error} If the config doesn't exist or if the project is not found.
   */
  async deleteProject(projectId: string): Promise<void> {
    await this.loadConfig();
    if (!this.config) {
      throw new Error('Config does not exist');
    }
    const projectIndex = this.config.projects.findIndex(
      (p) => p.id === projectId,
    );
    if (projectIndex === -1) {
      throw new Error('Project not found');
    }
    this.config.projects.splice(projectIndex, 1);
    await this.saveConfig();
  }

  /**
   * Saves the current configuration to the config file.
   */
  private async saveConfig(): Promise<void> {
    await fs.writeFile(this.configPath, JSON.stringify(this.config, null, 2));
  }
}
