import fs from 'fs/promises';
import { constants, Stats } from 'fs';
import path from 'path';
export class FileSystemWrapper {
    async readFile(filePath, encoding) {
        return fs.readFile(filePath, { encoding });
    }
    async writeFile(filePath, data) {
        await fs.writeFile(filePath, data, { encoding: 'utf8' });
    }
    async exists(filePath) {
        try {
            await fs.access(filePath, constants.F_OK);
            return true;
        }
        catch {
            return false;
        }
    }
    async rm(filePath, options) {
        if (options.force) {
            try {
                await fs.rm(filePath, { recursive: options.recursive, force: true });
            }
            catch {
                // Ignore errors
            }
        }
        else {
            await fs.rm(filePath, { recursive: options.recursive, force: false });
        }
    }
    async mkdir(dirPath, options) {
        await fs.mkdir(dirPath, options);
    }
    async readdir(dirPath) {
        return fs.readdir(dirPath);
    }
    async stat(filePath) {
        return fs.stat(filePath);
    }
    async unlink(filePath) {
        await fs.unlink(filePath);
    }
    async rename(oldPath, newPath) {
        await fs.rename(oldPath, newPath);
    }
    async copyFile(src, dest) {
        await fs.copyFile(src, dest);
    }
    resolvePath(...pathSegments) {
        return path.resolve(...pathSegments);
    }
    joinPath(...pathSegments) {
        return path.join(...pathSegments);
    }
    dirname(filePath) {
        return path.dirname(filePath);
    }
    basename(filePath) {
        return path.basename(filePath);
    }
}
