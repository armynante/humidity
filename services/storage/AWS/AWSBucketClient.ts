import { S3Client, type S3ClientConfig } from '@aws-sdk/client-s3';
import {
  CreateBucketCommand,
  ListBucketsCommand,
  DeleteBucketCommand,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { S3ServiceException } from '@aws-sdk/client-s3';
import fs from 'fs';
import { Readable } from 'stream';

/**
 * Configuration interface for the BucketClient.
 * @interface BucketClientConfig
 */
interface BucketClientConfig {
  /** AWS access key ID */
  accessKeyId: string;
  /** AWS secret access key */
  secretAccessKey: string;
  /** AWS region */
  region: string;
}

/**
 * A client for interacting with AWS S3 buckets.
 * @class BucketClient
 */
export class BucketClient {
  private s3Client: S3Client;
  public region: string;

  /**
   * Creates an instance of BucketClient.
   * @param {BucketClientConfig} config - The configuration object for the client.
   * @param {S3Client} [s3Client] - An optional pre-configured S3Client instance.
   */
  constructor(config: BucketClientConfig, s3Client?: S3Client) {
    this.region = config.region;
    if (s3Client) {
      this.s3Client = s3Client;
    } else {
      const clientConfig: S3ClientConfig = {
        region: config.region,
        credentials: {
          accessKeyId: config.accessKeyId,
          secretAccessKey: config.secretAccessKey,
        },
      };
      this.s3Client = new S3Client(clientConfig);
    }
  }

  /**
   * Creates a new S3 bucket.
   * @param {string} bucketName - The name of the bucket to create.
   * @returns {Promise<void>}
   * @throws {Error} If the bucket creation fails.
   */
  async createBucket(bucketName: string): Promise<void> {
    try {
      await this.s3Client.send(new CreateBucketCommand({ Bucket: bucketName }));
      console.log(`Bucket created successfully: ${bucketName}`);
    } catch (error: any) {
      if (
        error.name === 'BucketAlreadyExists' ||
        error.name === 'BucketAlreadyOwnedByYou'
      ) {
        console.log(`Bucket already exists: ${bucketName}`);
      } else {
        console.error(`Error creating bucket: ${error.message}`);
        throw error;
      }
    }
  }

  /**
   * Lists all S3 buckets in the account.
   * @returns {Promise<string[]>} An array of bucket names, or undefined if an error occurs.
   */
  async listBuckets() {
    try {
      const { Buckets } = await this.s3Client.send(new ListBucketsCommand({}));
      if (Buckets && Buckets.length > 0) {
        const bucketNames = Buckets.map((bucket) => bucket.Name);
        return bucketNames;
      } else {
        return [];
      }
    } catch (error) {
      if (error instanceof S3ServiceException) {
        console.error(`Error listing buckets: ${error.message}`);
      } else {
        console.error('An unexpected error occurred:', error);
      }
    }
  }

  /**
   * Deletes an S3 bucket.
   * @param {string} bucketName - The name of the bucket to delete.
   * @returns {Promise<void>}
   */
  async deleteBucket(bucketName: string): Promise<void> {
    try {
      await this.s3Client.send(new DeleteBucketCommand({ Bucket: bucketName }));
      console.log(`Bucket deleted successfully: ${bucketName}`);
    } catch (error) {
      if (error instanceof S3ServiceException) {
        console.error(`Error deleting bucket: ${error.message}`);
      } else {
        console.error('An unexpected error occurred:', error);
      }
    }
  }

  /**
   * Uploads a file to an S3 bucket.
   * @param {string} bucketName - The name of the bucket to upload to.
   * @param {string} filePath - The local path of the file to upload.
   * @param {string} destination - The S3 key (path) where the file will be stored.
   * @param {function} [progressCallback] - Optional callback to report upload progress.
   * @returns {Promise<void>}
   * @throws {Error} If the file upload fails.
   */
  async uploadFile(
    bucketName: string,
    filePath: string,
    destination: string,
    progressCallback?: (transferred: number, total: number) => void,
  ): Promise<void> {
    try {
      const fileContent = await fs.promises.readFile(filePath);
      const fileSize = (await fs.promises.stat(filePath)).size;

      const uploadParams = {
        Bucket: bucketName,
        Key: destination,
        Body: fileContent,
      };

      const command = new PutObjectCommand(uploadParams);
      await this.s3Client.send(command);

      if (progressCallback) {
        progressCallback(fileSize, fileSize);
      }

      console.log(`File uploaded successfully: ${filePath}`);
    } catch (error) {
      console.error('Error during file upload:', error);
      throw error;
    }
  }

  /**
   * Downloads a file from an S3 bucket.
   * @param {string} bucketName - The name of the bucket to download from.
   * @param {string} filePath - The S3 key (path) of the file to download.
   * @param {string} destination - The local path where the file will be saved.
   * @returns {Promise<void>}
   */
  async downloadFile(
    bucketName: string,
    filePath: string,
    destination: string,
  ): Promise<void> {
    try {
      const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: filePath,
      });

      const { Body, ContentLength } = await this.s3Client.send(command);

      if (Body instanceof Readable) {
        const writeStream = fs.createWriteStream(destination);
        let downloadedBytes = 0;

        Body.on('data', (chunk) => {
          downloadedBytes += chunk.length;
          this.showProgress(downloadedBytes, ContentLength || 0, 'Download');
        });

        Body.pipe(writeStream);

        await new Promise((resolve, reject) => {
          writeStream.on('finish', resolve);
          writeStream.on('error', reject);
        });

        console.log(`\nFile downloaded successfully: ${destination}`);
      }
    } catch (error) {
      if (error instanceof S3ServiceException) {
        console.error(`Error downloading file: ${error.message}`);
      } else {
        console.error(
          'An unexpected error occurred during file download:',
          error,
        );
      }
    }
  }

  /**
   * Deletes a file from an S3 bucket.
   * @param {string} bucketName - The name of the bucket containing the file.
   * @param {string} filePath - The S3 key (path) of the file to delete.
   * @returns {Promise<void>}
   */
  async deleteFile(bucketName: string, filePath: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: bucketName,
        Key: filePath,
      });

      await this.s3Client.send(command);
      console.log(`File deleted successfully: ${filePath}`);
    } catch (error) {
      if (error instanceof S3ServiceException) {
        console.error(`Error deleting file: ${error.message}`);
      } else {
        console.error('An unexpected error occurred:', error);
      }
    }
  }

  /**
   * Shows the progress of an operation.
   * @private
   * @param {number} transferred - The number of bytes transferred.
   * @param {number} total - The total number of bytes.
   * @param {string} operation - The name of the operation (e.g., 'Download', 'Upload').
   */
  private showProgress(
    transferred: number,
    total: number,
    operation: string,
  ): void {
    const percentage = (transferred / total) * 100;
    process.stdout.write(
      `\r${operation} progress: ${percentage.toFixed(2)}% (${transferred}/${total} bytes)`,
    );
  }
}
