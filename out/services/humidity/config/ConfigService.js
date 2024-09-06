// config-service.ts
import { homedir } from 'os';
import path from 'path';
import { randomUUID } from 'node:crypto';
import * as dotenv from 'dotenv';
import { ConfigSchema, RequiredEnvsSchema } from '../../../schemas/config.js';
import { FileSystemWrapper } from '../../../helpers/filesystem.js';
import { Logger } from '../../../helpers/logger.js';
import confirm from '@inquirer/confirm';
export class ConfigService {
    config = null;
    configPath;
    envPath;
    fs;
    logger;
    constructor(fs, logger) {
        this.configPath = path.join(homedir(), '.humidity', 'config.json');
        this.envPath = path.join(homedir(), '.humidity', '.env.humidity');
        this.fs = fs;
        this.logger = new Logger('EXT_DEBUG', 'ConfigService');
    }
    async loadConfig() {
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
        }
        catch (error) {
            this.logger.error('Error loading config', error);
            throw error;
        }
    }
    // load templates
    async loadTemplates() {
        const currentFileURL = import.meta.url;
        const currentFilePath = await this.fs.fileURLToPath(currentFileURL);
        const templatesFilePath = this.fs.joinPath(this.fs.dirname(currentFilePath), 'templates.json');
        try {
            const templateFile = await this.fs.readFile(templatesFilePath, 'utf-8');
            this.logger.extInfo('Templates loaded');
            return JSON.parse(templateFile);
        }
        catch (error) {
            // @ts-ignore
            if (error.code === 'ENOENT') {
                // If the file doesn't exist, create it with an empty array
                await this.fs.writeFile(templatesFilePath, JSON.stringify([], null, 2));
                this.logger.extInfo('Templates file created');
                return [];
            }
            else {
                throw error;
            }
        }
    }
    async initializeConfig() {
        const templates = await this.loadTemplates();
        return {
            projects: [],
            useEnvFile: false,
            envPath: '',
            services: [],
            templates: templates,
        };
    }
    async loadConfigFromEnv(envPath) {
        const resolvedPath = envPath.replace('~', homedir());
        const absolutePath = path.resolve(resolvedPath);
        dotenv.config({ path: absolutePath });
    }
    async load(reload = false) {
        if (!this.config || reload) {
            this.logger.info('Loading config...');
            await this.loadConfig();
        }
        return this.config;
    }
    async validateEnvFile(keysToCheck) {
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
            const keysToCheckObject = keysToCheck.reduce((acc, key) => {
                // @ts-ignore
                acc[key] = true;
                return acc;
            }, {});
            const partialSchema = RequiredEnvsSchema.pick(keysToCheckObject);
            const result = partialSchema.safeParse(envs);
            if (result.success) {
                return [true, []];
            }
            else {
                const missingKeys = result.error.issues.map((issue) => issue.path[0]);
                return [false, missingKeys];
            }
        }
        catch (error) {
            this.logger.error('Error validating env file', error);
            throw error;
        }
    }
    checkEnvVars(requiredEnvVars) {
        const missingVars = requiredEnvVars.filter((envVar) => !process.env[envVar]);
        if (missingVars.length > 0) {
            return missingVars;
        }
        return true;
    }
    async buildEnvFile(envPath, envs) {
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
        }
        catch (error) {
            this.logger.error('Error building env file', error);
            throw error;
        }
    }
    getTemplates() {
        if (!this.config) {
            throw new Error('Config does not exist');
        }
        return this.config.templates;
    }
    async init() {
        try {
            const exists = await this.fs.exists(this.configPath);
            if (exists) {
                this.logger.extInfo('Config already exists');
                await this.loadConfig();
                return [false, this.config];
            }
            const createNewConfig = await confirm({
                message: 'Config does not exist. Create new config at ' + this.configPath,
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
        }
        catch (error) {
            this.logger.error('Error initializing config', error);
            throw error;
        }
    }
    async createNewProject(np) {
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
        const newProject = {
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
    async updateProject(projectId, updates) {
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
    async getTemplateById(templateId) {
        await this.load();
        if (!this.config) {
            throw new Error('Config does not exist');
        }
        return this.config.templates.find((t) => t.id === templateId) || null;
    }
    async updateConfig(updates) {
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
    async addTemplate(template) {
        await this.load();
        if (!this.config) {
            throw new Error('Config does not exist');
        }
        this.config.templates.push(template);
        const currentFileURL = import.meta.url;
        const currentFilePath = await this.fs.fileURLToPath(currentFileURL);
        const templatesFilePath = this.fs.joinPath(this.fs.dirname(currentFilePath), 'templates.json');
        await this.fs.writeFile(templatesFilePath, JSON.stringify(this.config.templates, null, 2));
        await this.saveConfig();
    }
    async removeTemplate(templateId) {
        await this.load();
        if (!this.config) {
            throw new Error('Config does not exist');
        }
        this.config.templates = this.config.templates.filter((t) => t.id !== templateId);
        const currentFileURL = import.meta.url;
        const currentFilePath = await this.fs.fileURLToPath(currentFileURL);
        const templatesFilePath = this.fs.joinPath(this.fs.dirname(currentFilePath), 'templates.json');
        await this.fs.writeFile(templatesFilePath, JSON.stringify(this.config.templates, null, 2));
        await this.saveConfig();
    }
    async addService(service) {
        await this.load();
        if (!this.config) {
            throw new Error('Config does not exist');
        }
        this.config.services.push(service);
        await this.saveConfig();
    }
    async listServices() {
        await this.load();
        if (!this.config) {
            throw new Error('Config does not exist');
        }
        return this.config.services;
    }
    async viewService(id) {
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
    async deleteService(id) {
        await this.load();
        if (!this.config) {
            throw new Error('Config does not exist');
        }
        this.config.services = this.config.services.filter((s) => s.id !== id);
        await this.saveConfig();
    }
    async listProjects(reloadConf = false) {
        await this.load(reloadConf);
        if (!this.config) {
            throw new Error('Config does not exist');
        }
        return this.config.projects;
    }
    async viewProject(projectId) {
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
    async deleteProject(projectId) {
        await this.load();
        if (!this.config) {
            throw new Error('Config does not exist');
        }
        this.config.projects = this.config.projects.filter((p) => p.id !== projectId);
        await this.saveConfig();
    }
    async saveConfig() {
        await this.fs.writeFile(this.configPath, JSON.stringify(this.config, null, 2));
    }
}
