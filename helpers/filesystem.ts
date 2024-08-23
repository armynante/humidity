import fs from 'fs/promises';
import { constants, Stats, type MakeDirectoryOptions } from 'fs';
import path from 'path';

export class FileSystemWrapper {
  async readFile(filePath: string, encoding: BufferEncoding): Promise<string> {
    return fs.readFile(filePath, { encoding });
  }

  async writeFile(filePath: string, data: string): Promise<void> {
    await fs.writeFile(filePath, data, { encoding: 'utf8' });
  }

  async exists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath, constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  async rm(
    filePath: string,
    options: { recursive: boolean; force: boolean },
  ): Promise<void> {
    if (options.force) {
      try {
        await fs.rm(filePath, { recursive: options.recursive, force: true });
      } catch {
        // Ignore errors
      }
    } else {
      await fs.rm(filePath, { recursive: options.recursive, force: false });
    }
  }

  async mkdir(dirPath: string, options?: MakeDirectoryOptions): Promise<void> {
    await fs.mkdir(dirPath, options);
  }

  async readdir(dirPath: string): Promise<string[]> {
    return fs.readdir(dirPath);
  }

  async stat(filePath: string): Promise<Stats> {
    return fs.stat(filePath);
  }

  async unlink(filePath: string): Promise<void> {
    await fs.unlink(filePath);
  }

  async rename(oldPath: string, newPath: string): Promise<void> {
    await fs.rename(oldPath, newPath);
  }

  async copyFile(src: string, dest: string): Promise<void> {
    await fs.copyFile(src, dest);
  }

  resolvePath(...pathSegments: string[]): string {
    return path.resolve(...pathSegments);
  }

  joinPath(...pathSegments: string[]): string {
    return path.join(...pathSegments);
  }

  dirname(filePath: string): string {
    return path.dirname(filePath);
  }

  basename(filePath: string): string {
    return path.basename(filePath);
  }
}
