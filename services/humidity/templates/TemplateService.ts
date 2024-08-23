import { homedir } from 'os';
import path from 'path';
import { FileSystemWrapper } from '../../../helpers/filesystem';
import { Logger } from '../../../helpers/logger';

export class TemplateService {
  private templatesPath: string;
  private fs: FileSystemWrapper;
  private logger: Logger;

  constructor(fs: FileSystemWrapper, logger: Logger) {
    this.templatesPath = path.join('.', 'templates', 'services', 'serverless');
    this.fs = fs;
    this.logger = logger;
  }

  async createTemplate(templateName: string): Promise<void> {
    try {
      const templatePath = path.join(this.templatesPath, templateName);
      const srcPath = path.join(templatePath, 'src');

      // Create template directory and src subdirectory
      await this.fs.mkdir(srcPath, { recursive: true });

      // Create a basic index.ts file in the src directory
      const indexPath = path.join(srcPath, 'index.ts');
      await this.fs.writeFile(
        indexPath,
        'console.log("Hello from ' + templateName + '");',
      );

      this.logger.info(`Template "${templateName}" created successfully.`);

      // Update package.json with esbuild command
      await this.updatePackageJson(templateName, 'add');
    } catch (error) {
      this.logger.error(`Error creating template "${templateName}"`, error);
      throw error;
    }
  }

  async removeTemplate(templateName: string): Promise<void> {
    try {
      const templatePath = path.join(this.templatesPath, templateName);

      // Check if the template directory exists
      if (await this.fs.exists(templatePath)) {
        // Remove the template directory and all its contents
        await this.fs.rm(templatePath, { recursive: true, force: true });
        this.logger.info(`Template "${templateName}" removed successfully.`);

        // Update package.json to remove the esbuild command
        await this.updatePackageJson(templateName, 'remove');
      } else {
        this.logger.warn(`Template "${templateName}" does not exist.`);
      }
    } catch (error) {
      this.logger.error(`Error removing template "${templateName}"`, error);
      throw error;
    }
  }

  private async updatePackageJson(
    templateName: string,
    action: 'add' | 'remove',
  ): Promise<void> {
    const packageJsonPath = path.join(process.cwd(), 'package.json');

    try {
      const packageJsonContent = await this.fs.readFile(
        packageJsonPath,
        'utf-8',
      );
      const packageJson = JSON.parse(packageJsonContent);

      if (!packageJson.scripts) {
        packageJson.scripts = {};
      }

      if (action === 'add') {
        // Add or update the esbuild command
        packageJson.scripts[`bundle:${templateName}`] =
          `esbuild templates/services/serverless/${templateName}/src/index.ts --bundle --platform=node --target=node14 --outfile=templates/services/serverless/${templateName}/bundle.js`;
        this.logger.info(
          `package.json updated with esbuild command for "${templateName}".`,
        );
      } else if (action === 'remove') {
        // Remove the esbuild command
        if (packageJson.scripts[`bundle:${templateName}`]) {
          delete packageJson.scripts[`bundle:${templateName}`];
          this.logger.info(
            `Esbuild command for "${templateName}" removed from package.json.`,
          );
        } else {
          this.logger.warn(
            `Esbuild command for "${templateName}" not found in package.json.`,
          );
        }
      }

      // Write the updated package.json
      await this.fs.writeFile(
        packageJsonPath,
        JSON.stringify(packageJson, null, 2),
      );
    } catch (error) {
      this.logger.error('Error updating package.json', error);
      throw error;
    }
  }

  getTemplatesPath(): string {
    return this.templatesPath;
  }
}
