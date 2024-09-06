// config-service.ts

import { homedir } from 'os';
import path from 'path';
import { randomUUID } from 'node:crypto';
import * as dotenv from 'dotenv';
import type {
  Config,
  NewProjectQuestions,
  Project,
  RequiredEnvs,
  Service,
} from '../../../types/config';
import { ConfigSchema, RequiredEnvsSchema } from '../../../schemas/config';
import { FileSystemWrapper } from '../../../helpers/filesystem';
import { Logger } from '../../../helpers/logger';
import type { TemplateType } from '../../../types/services';
import confirm from '@inquirer/confirm';

export class ConfigService {
  private config: Config | null = null;
  private configPath: string;
  private envPath: string;
  private fs: FileSystemWrapper;
  private logger: Logger;
  constructor(fs: FileSystemWrapper, logger: Logger) {
    this.configPath = path.join(homedir(), '.humidity', 'config.json');
    this.envPath = path.join(homedir(), '.humidity', '.env.humidity');
    this.fs = fs;
    this.logger = new Logger('EXT_DEBUG', 'ConfigService');
  }

  private async loadConfig(): Promise<void> {
    try {
      const configExists = await this.fs.exists(this.configPath);
      if (!configExists) {
        throw new Error('Config file does not exist');
      }

      const confContent = await this.fs.readFile(this.configPath, 'utf-8');
      const parsedConfig = ConfigSchema.safeParse(JSON.parse(confContent));

      if (!parsedConfig.success) {
        this.logger.error('Invalid config file', parsedConfig.error);
        throw new Error('Invalid config file');
      }

      this.config = parsedConfig.data;

      if (this.config.useEnvFile) {
        await this.loadConfigFromEnv(this.config.envPath);
      }
    } catch (error) {
      this.logger.error('Error loading config', error);
      throw error;
    }
  }

  // load templates
  private async loadTemplates(): Promise<TemplateType[]> {
    const templateFile = await this.fs.readFile(
      path.join(__dirname, 'templates.json'),
      'utf-8',
    );
    this.logger.extInfo('Templates loaded');
    return JSON.parse(templateFile);
  }

  private async initializeConfig(): Promise<Config> {
    const templates = await this.loadTemplates();
    return {
      projects: [],
      useEnvFile: false,
      envPath: '',
      services: [],
      templates: templates,
    };
  }

  async loadConfigFromEnv(envPath: string): Promise<void> {
    const resolvedPath = envPath.replace('~', homedir());
    const absolutePath = path.resolve(resolvedPath);
    dotenv.config({ path: absolutePath });
  }

  async load(reload = false): Promise<Config> {
    if (!this.config || reload) {
      this.logger.info('Loading config...');
      await this.loadConfig();
    }
    return this.config as Config;
  }

  async validateEnvFile(
    keysToCheck?: (keyof RequiredEnvs)[],
  ): Promise<[boolean, (keyof RequiredEnvs)[]]> {
    try {
      const envExists = await this.fs.exists(this.envPath);
      if (!envExists) {
        return [false, []];
      }

      const envContent = await this.fs.readFile(this.envPath, 'utf-8');
      const envs = dotenv.parse(envContent);

      if (!keysToCheck || keysToCheck.length === 0) {
        return [true, []];
      }

      // Create an object with the keys to check
      const keysToCheckObject: Partial<Record<keyof RequiredEnvs, boolean>> =
        keysToCheck.reduce((acc, key) => {
          // @ts-ignore
          acc[key] = true;
          return acc;
        }, {});

      const partialSchema = RequiredEnvsSchema.pick(keysToCheckObject);
      const result = partialSchema.safeParse(envs);

      if (result.success) {
        return [true, []];
      } else {
        const missingKeys = result.error.issues.map(
          (issue) => issue.path[0] as keyof RequiredEnvs,
        );
        return [false, missingKeys];
      }
    } catch (error) {
      this.logger.error('Error validating env file', error);
      throw error;
    }
  }

  checkEnvVars(requiredEnvVars: (keyof RequiredEnvs)[]): boolean | string[] {
    const missingVars = requiredEnvVars.filter(
      (envVar) => !process.env[envVar],
    );
    if (missingVars.length > 0) {
      return missingVars;
    }

    return true;
  }

  async buildEnvFile(envPath: string, envs: RequiredEnvs): Promise<void> {
    try {
      const resolvedPath = envPath.replace('~', homedir());
      const absolutePath = path.resolve(resolvedPath);

      const validationResult = RequiredEnvsSchema.partial().safeParse(envs);
      if (!validationResult.success) {
        throw new Error('Invalid environment variables provided');
      }

      const envFile = Object.entries(envs)
        .filter(([, value]) => value != null && value !== '')
        .map(([key, value]) => `${key}=${value}`)
        .join('\n');

      await this.fs.writeFile(absolutePath, envFile);
    } catch (error) {
      this.logger.error('Error building env file', error);
      throw error;
    }
  }

  getTemplates(): TemplateType[] {
    if (!this.config) {
      throw new Error('Config does not exist');
    }
    return this.config.templates;
  }

  async init(): Promise<[boolean, Config]> {
    try {
      const exists = await this.fs.exists(this.configPath);
      if (exists) {
        this.logger.extInfo('Config already exists');
        await this.loadConfig();
        return [false, this.config as Config];
      }
      const createNewConfig = await confirm({
        message:
          'Config does not exist. Create new config at ' + this.configPath,
      });
      if (!createNewConfig) {
        throw new Error('A config is required to continue');
      }
      this.logger.info('Creating new config');
      this.config = await this.initializeConfig();
      await this.fs.mkdir(path.dirname(this.configPath), { recursive: true });
      await this.saveConfig();
      this.logger.info(`Config created at ${this.configPath}`);
      return [true, this.config];
    } catch (error) {
      this.logger.error('Error initializing config', error);
      throw error;
    }
  }

  async createNewProject(np: NewProjectQuestions): Promise<Project> {
    if (!np.name.match(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)) {
      throw new Error('Project name must be in dash-case');
    }

    if (!np.projectType) {
      throw new Error('Project type must be provided');
    }

    await this.load();
    if (!this.config) {
      throw new Error('Config does not exist');
    }

    const newProject: Project = {
      name: np.name,
      id: randomUUID(),
      type: np.projectType,
      description: np.description || '',
      created: new Date(),
      updated: new Date(),
    };

    this.config.projects.push(newProject);
    await this.saveConfig();
    return newProject;
  }

  async updateProject(
    projectId: string,
    updates: Partial<Project>,
  ): Promise<Project> {
    await this.load();
    if (!this.config) {
      throw new Error('Config does not exist');
    }

    const project = this.config.projects.find((p) => p.id === projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    Object.assign(project, { ...updates, updated: new Date() });
    await this.saveConfig();
    return project;
  }

  async getTemplateById(templateId: string): Promise<TemplateType | null> {
    await this.load();
    if (!this.config) {
      throw new Error('Config does not exist');
    }
    return this.config.templates.find((t) => t.id === templateId) || null;
  }

  async updateConfig(
    updates: Partial<Config>,
  ): Promise<[Partial<Config> | null, string | null]> {
    await this.load();
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

  async addTemplate(template: TemplateType): Promise<void> {
    await this.load();
    if (!this.config) {
      throw new Error('Config does not exist');
    }
    this.config.templates.push(template);

    // Update the template.json file with the new template
    const templates = await this.loadTemplates();
    templates.push(template);
    await this.fs.writeFile(
      path.join(__dirname, 'templates.json'),
      JSON.stringify(templates, null, 2),
    );
    await this.saveConfig();
  }

  async removeTemplate(templateId: string): Promise<void> {
    await this.load();
    if (!this.config) {
      throw new Error('Config does not exist');
    }
    this.config.templates = this.config.templates.filter(
      (t) => t.id !== templateId,
    );
    // remove the template from the template.json file
    const templates = await this.loadTemplates();
    const updatedTemplates = templates.filter((t) => t.id !== templateId);
    await this.fs.writeFile(
      path.join(__dirname, 'templates.json'),
      JSON.stringify(updatedTemplates, null, 2),
    );
    await this.saveConfig();
  }

  async addService(service: Service): Promise<void> {
    await this.load();
    if (!this.config) {
      throw new Error('Config does not exist');
    }
    this.config.services.push(service);
    await this.saveConfig();
  }

  async listServices(): Promise<Service[]> {
    await this.load();
    if (!this.config) {
      throw new Error('Config does not exist');
    }
    return this.config.services;
  }

  async viewService(id: string): Promise<Service> {
    await this.load();
    if (!this.config) {
      throw new Error('Config does not exist');
    }
    const service = this.config.services.find((s) => s.id === id);
    if (!service) {
      throw new Error('Service not found');
    }
    return service;
  }

  async deleteService(id: string): Promise<void> {
    await this.load();
    if (!this.config) {
      throw new Error('Config does not exist');
    }
    this.config.services = this.config.services.filter((s) => s.id !== id);
    await this.saveConfig();
  }

  async listProjects(reloadConf = false): Promise<Project[]> {
    await this.load(reloadConf);
    if (!this.config) {
      throw new Error('Config does not exist');
    }
    return this.config.projects;
  }

  async viewProject(projectId: string): Promise<Project> {
    await this.load();
    if (!this.config) {
      throw new Error('Config does not exist');
    }
    const project = this.config.projects.find((p) => p.id === projectId);
    if (!project) {
      throw new Error('Project not found');
    }
    return project;
  }

  async deleteProject(projectId: string): Promise<void> {
    await this.load();
    if (!this.config) {
      throw new Error('Config does not exist');
    }
    this.config.projects = this.config.projects.filter(
      (p) => p.id !== projectId,
    );
    await this.saveConfig();
  }

  private async saveConfig(): Promise<void> {
    await this.fs.writeFile(
      this.configPath,
      JSON.stringify(this.config, null, 2),
    );
  }
}
