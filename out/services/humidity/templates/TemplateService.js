import path from 'path';
import { FileSystemWrapper } from '../../../helpers/filesystem.js';
import { Logger } from '../../../helpers/logger.js';
import { randomUUID } from 'node:crypto';
import { ConfigInstance } from '../../../cmd/main.js';
import { createDeployTemplate } from './blankDeployClass.js';
export class TemplateService {
    templatesPath;
    fs;
    logger;
    constructor(fs, logger) {
        this.templatesPath = path.join('.', 'templates', 'services', 'serverless');
        this.fs = fs;
        this.logger = logger;
    }
    async createTemplate(templateName, templateDescription, shortName, requiredEnvs) {
        try {
            const templatePath = path.join(this.templatesPath, shortName);
            const srcPath = path.join(templatePath, 'src');
            // Create template directory and src subdirectory
            await this.fs.mkdir(srcPath, { recursive: true });
            // Create a basic index.ts file in the src directory
            const indexPath = path.join(srcPath, 'index.ts');
            await this.fs.writeFile(indexPath, 'console.log("Hello from ' + templateName + '");');
            this.logger.info(`Template files for "${templateName}" created successfully.`);
            // Generate the deploy class
            const fileName = await this.generateDeployClass(shortName);
            // Create a template object and save it to the config
            const template = {
                name: templateName,
                id: randomUUID(),
                description: templateDescription,
                requiredKeys: requiredEnvs,
                fileLocation: templatePath,
                internal_name: shortName,
                deploy_file_location: path.join('.', 'services', 'humidity', 'deploy', fileName),
            };
            // Insert the template into the config
            await ConfigInstance.addTemplate(template);
            // Update package.json with esbuild command
            await this.updatePackageJson(shortName, 'add');
            return template;
        }
        catch (error) {
            this.logger.error(`Error creating template "${templateName}"`, error);
            throw error;
        }
    }
    async generateDeployClass(templateName) {
        const { payload, fileName } = createDeployTemplate(templateName);
        // create the file
        const deployPath = path.join('.', 'services', 'humidity', 'deploy', fileName);
        await this.fs.writeFile(deployPath, payload);
        return fileName;
    }
    async removeTemplate(templateId) {
        try {
            const template = await ConfigInstance.getTemplateById(templateId);
            if (!template) {
                this.logger.warn(`Template "${templateId}" does not exist.`);
                return;
            }
            const templatePath = path.join(this.templatesPath, template.internal_name);
            // Check if the template directory exists
            if (await this.fs.exists(templatePath)) {
                // Remove the template directory and all its contents
                await ConfigInstance.removeTemplate(templateId);
                await this.fs.rm(templatePath, { recursive: true, force: true });
                this.logger.info(`Template "${template.name}" removed successfully.`);
                // Update package.json to remove the esbuild command
                await this.updatePackageJson(template.internal_name, 'remove');
                // Remove the deploy.ts file
                await this.fs.rm(template.deploy_file_location, {
                    recursive: true,
                    force: true,
                });
            }
            else {
                this.logger.warn(`Template "${template.name}" does not exist.`);
            }
        }
        catch (error) {
            this.logger.error(`Error removing template "${templateId}"`, error);
            throw error;
        }
    }
    async getTemplateById(templateId) {
        return ConfigInstance.getTemplateById(templateId);
    }
    async updatePackageJson(templateName, action) {
        const packageJsonPath = path.join(process.cwd(), 'package.json');
        try {
            const packageJsonContent = await this.fs.readFile(packageJsonPath, 'utf-8');
            const packageJson = JSON.parse(packageJsonContent);
            if (!packageJson.scripts) {
                packageJson.scripts = {};
            }
            if (action === 'add') {
                // Add or update the esbuild command
                packageJson.scripts[`bundle:${templateName}`] =
                    `esbuild templates/services/serverless/${templateName}/src/index.ts --bundle --platform=node --target=node14 --outfile=templates/services/serverless/${templateName}/bundle.js`;
                this.logger.info(`package.json updated with esbuild command for "${templateName}".`);
                packageJson.scripts[`dev:${templateName}`] =
                    `bun run templates/services/serverless/${templateName}/src/index.ts`;
                this.logger.info(`package.json updated with dev command for "${templateName}".`);
            }
            else if (action === 'remove') {
                // Remove the esbuild command
                if (packageJson.scripts[`bundle:${templateName}`]) {
                    delete packageJson.scripts[`bundle:${templateName}`];
                    this.logger.info(`Esbuild command for "${templateName}" removed from package.json.`);
                    delete packageJson.scripts[`dev:${templateName}`];
                    this.logger.info(`Dev command for "${templateName}" removed from package.json.`);
                }
                else {
                    this.logger.warn(`Esbuild command for "${templateName}" not found in package.json.`);
                }
            }
            // Write the updated package.json
            await this.fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));
        }
        catch (error) {
            this.logger.error('Error updating package.json', error);
            throw error;
        }
    }
    getTemplatesPath() {
        return this.templatesPath;
    }
}
