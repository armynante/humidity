import { S3Client } from '@aws-sdk/client-s3';
import * as sqlite3 from 'sqlite3';
import { Database } from 'sqlite';
export declare function checkDbExistsInS3(s3: S3Client, bucketName: string, dbFileName: string): Promise<boolean>;
export declare function downloadDbFromS3(s3: S3Client, bucketName: string, dbFileName: string, localDbPath: string): Promise<void>;
export declare function uploadDbToS3(s3: S3Client, bucketName: string, dbFileName: string, localDbPath: string): Promise<void>;
export declare function initializeDb(localDbPath: string, driver: typeof sqlite3): Promise<void>;
export declare function downloadMigrationsFromS3(s3: S3Client, bucketName: string, localDbPath: string): Promise<void>;
export declare function runMigrations(db: Database, direction: 'up' | 'down', s3: S3Client, bucketName: string, localDbPath: string): Promise<void>;
export declare function getDb(s3: S3Client, bucketName: string, localDbPath: string): Promise<Database>;
export interface CustomRequest extends Request {
    db?: Database;
}
