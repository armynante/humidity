import { Stats, type MakeDirectoryOptions } from 'fs';
export declare class FileSystemWrapper {
    readFile(filePath: string, encoding: BufferEncoding): Promise<string>;
    writeFile(filePath: string, data: string): Promise<void>;
    exists(filePath: string): Promise<boolean>;
    rm(filePath: string, options: {
        recursive: boolean;
        force: boolean;
    }): Promise<void>;
    mkdir(dirPath: string, options?: MakeDirectoryOptions): Promise<void>;
    readdir(dirPath: string): Promise<string[]>;
    stat(filePath: string): Promise<Stats>;
    unlink(filePath: string): Promise<void>;
    rename(oldPath: string, newPath: string): Promise<void>;
    copyFile(src: string, dest: string): Promise<void>;
    resolvePath(...pathSegments: string[]): string;
    joinPath(...pathSegments: string[]): string;
    dirname(filePath: string): string;
    basename(filePath: string): string;
    fileURLToPath(fileURL: string): Promise<string>;
}
