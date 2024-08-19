import { describe, expect, it, beforeEach, mock, spyOn } from 'bun:test';
import { ConfigService } from './ConfigService';
import fs from 'node:fs/promises';
import * as crypto from 'node:crypto';
import * as dotenv from 'dotenv';
import * as os from 'os';
import * as path from 'node:path';

describe('ConfigService', () => {
  let configService: ConfigService;
  const mockConfigPath = '/mock/home/.humidity/config.json';

  beforeEach(() => {
    // Mock homedir
    spyOn(os, 'homedir').mockReturnValue('/mock/home');

    // Mock fs.exists and fs.writeFile
    spyOn(fs, 'exists').mockImplementation(() => Promise.resolve(false));
    spyOn(fs, 'writeFile').mockImplementation(() => Promise.resolve());

    // Mock randomUUID
    spyOn(crypto, 'randomUUID').mockReturnValue(
      'a1479cc0-63d9-4203-a38a-00aa6882ee77',
    );
    configService = new ConfigService();
  });

  describe('createConfig', () => {
    it('should create a new config file if it does not exist', async () => {
      const [isNew, config] = await configService.init();

      expect(isNew).toBe(true);
      expect(config).toEqual({ projects: [], useEnvFile: false, envPath: '' });
      expect(fs.writeFile).toHaveBeenCalledWith(
        mockConfigPath,
        JSON.stringify(
          { projects: [], useEnvFile: false, envPath: '' },
          null,
          2,
        ),
      );
    });

    it('should load existing config if it exists', async () => {
      const mockConfig = {
        projects: [
          {
            name: 'Test Project',
            id: '0be0df3c-ca0b-4685-8ba4-78a3ac46e11d' as crypto.UUID,
            created: new Date().toISOString(),
            updated: new Date().toISOString(),
          },
        ],
        useEnvFile: true,
        envPath: '/path/to/env',
      };
      spyOn(fs, 'exists').mockImplementation(() => Promise.resolve(true));
      // @ts-ignore
      spyOn(fs, 'readFile').mockImplementation(() =>
        Promise.resolve(JSON.stringify(mockConfig)),
      );

      const [isNew, config] = await configService.init();

      expect(isNew).toBe(false);
      expect(config).toEqual(mockConfig);
      expect(fs.readFile).toHaveBeenCalledWith(mockConfigPath, 'utf-8');
    });
  });

  describe('createNewProject', () => {
    it('should create a new project and add it to the config', async () => {
      const mockConfig = { projects: [], useEnvFile: false, envPath: '' };
      spyOn(fs, 'exists').mockImplementation(() => Promise.resolve(true));
      // @ts-ignore
      spyOn(fs, 'readFile').mockImplementation(() =>
        Promise.resolve(Buffer.from(JSON.stringify(mockConfig))),
      );

      const newProject = await configService.createNewProject({
        name: 'new-project',
        projectType: 'ts_express',
        description: 'A new project',
        createDir: true,
        createGitRepo: true,
        createReadme: true,
        createGHRepo: true,
        createGHAction: true,
        createDoApp: true,
        projectPath: '/path/to/project',
        buildTool: 'npm',
        prettier: true,
        eslint: true,
      });

      expect(newProject).toEqual({
        name: 'new-project',
        id: 'a1479cc0-63d9-4203-a38a-00aa6882ee77',
        type: 'ts_express',
        description: 'A new project',
        created: expect.any(Date),
        updated: expect.any(Date),
      });
      expect(fs.writeFile).toHaveBeenCalled();
    });

    it('should throw an error if project name is not in dash-case', async () => {
      expect(
        await configService.createNewProject({
          name: 'New Project',
          projectType: 'ts_express',
          description: 'A new project',
          createDir: true,
          createGitRepo: true,
          createReadme: true,
          createGHRepo: true,
          createGHAction: true,
          createDoApp: true,
          projectPath: '/path/to/project',
          buildTool: 'npm',
          prettier: true,
          eslint: true,
        }),
      ).rejects.toThrow('Project name must be in dash-case');
    });
  });

  // Add more test cases for other methods...
});
