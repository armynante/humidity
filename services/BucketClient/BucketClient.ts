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

interface BucketClientConfig {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
}

export class BucketClient {
  private s3Client: S3Client;
  public region: string;

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

  async createBucket(bucketName: string) {
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

  async listBuckets() {
    try {
      const { Buckets } = await this.s3Client.send(new ListBucketsCommand({}));
      if (Buckets && Buckets.length > 0) {
        const bucketNames = Buckets.map((bucket) => bucket.Name);
        console.log('Buckets:', bucketNames);
        return bucketNames;
      }
    } catch (error) {
      if (error instanceof S3ServiceException) {
        console.error(`Error listing buckets: ${error.message}`);
      } else {
        console.error('An unexpected error occurred:', error);
      }
    }
  }

  async deleteBucket(bucketName: string) {
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

  async uploadFile(
    bucketName: string,
    filePath: string,
    destination: string,
    progressCallback?: (transferred: number, total: number) => void,
  ) {
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

  async downloadFile(
    bucketName: string,
    filePath: string,
    destination: string,
  ) {
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

  async deleteFile(bucketName: string, filePath: string) {
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

  private showProgress(transferred: number, total: number, operation: string) {
    const percentage = (transferred / total) * 100;
    process.stdout.write(
      `\r${operation} progress: ${percentage.toFixed(2)}% (${transferred}/${total} bytes)`,
    );
  }
}
