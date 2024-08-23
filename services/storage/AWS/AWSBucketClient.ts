import {
  DeleteObjectsCommand,
  ListObjectsV2Command,
  PutBucketCorsCommand,
  S3Client,
  type S3ClientConfig,
} from '@aws-sdk/client-s3';
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
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

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
  constructor() {
    this.region = process.env.AMZ_REGION || 'us-east-1';

    //set environment variables
    process.env.AWS_ACCESS_KEY_ID = process.env.AMZ_ID || '';
    process.env.AWS_SECRET_ACCESS_KEY = process.env.AMZ_SEC || '';

    const clientConfig: S3ClientConfig = {
      region: this.region,
      credentials: {
        accessKeyId: process.env.AMZ_ID!,
        secretAccessKey: process.env.AMZ_SEC!,
      },
    };

    this.s3Client = new S3Client(clientConfig);
    console.log('S3Client created');
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
      await this.setCORSConfiguration(bucketName, ['*']);
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
   * Empties an S3 bucket by deleting all objects within it.
   * @param {string} bucketName - The name of the bucket to empty.
   * @returns {Promise<void>}
   * @throws {Error} If emptying the bucket fails.
   */
  async emptyBucket(bucketName: string): Promise<void> {
    console.log(`Attempting to empty bucket: ${bucketName}`);

    try {
      let continuationToken: string | undefined;

      do {
        // List objects in the bucket
        const listCommand = new ListObjectsV2Command({
          Bucket: bucketName,
          ContinuationToken: continuationToken,
        });

        const listedObjects = await this.s3Client.send(listCommand);

        if (listedObjects.Contents && listedObjects.Contents.length > 0) {
          const deleteParams: {
            Bucket: string;
            Delete: { Objects: { Key: string }[] };
          } = {
            Bucket: bucketName,
            Delete: { Objects: [] },
          };

          listedObjects.Contents.forEach(({ Key }) => {
            if (Key) {
              deleteParams.Delete.Objects.push({ Key });
            }
          });

          // Delete objects
          const deleteCommand = new DeleteObjectsCommand(deleteParams);
          await this.s3Client.send(deleteCommand);

          console.log(`Deleted ${deleteParams.Delete.Objects.length} objects`);
        }

        continuationToken = listedObjects.NextContinuationToken;
      } while (continuationToken);

      console.log(`Successfully emptied bucket: ${bucketName}`);
    } catch (error) {
      console.error(`Error emptying bucket: ${error}`);
      throw error;
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
    fileName: string,
    fileContent: Buffer | Readable,
    contentType: string,
  ): Promise<void> {
    console.log(
      `Attempting to upload file: ${fileName} to bucket: ${bucketName}`,
    );
    try {
      let body: Buffer | Readable;
      if (Buffer.isBuffer(fileContent)) {
        body = fileContent;
      } else if (fileContent instanceof Readable) {
        // Convert stream to buffer for binary files
        const chunks = [];
        for await (const chunk of fileContent) {
          chunks.push(chunk);
        }
        body = Buffer.concat(chunks);
      } else {
        throw new Error('Invalid file content type');
      }

      const params = {
        Bucket: bucketName,
        Key: fileName,
        Body: body,
        ContentType: contentType,
        ContentDisposition: 'attachment', // This ensures the file is downloaded rather than displayed in the browser
      };

      const command = new PutObjectCommand(params);
      const response = await this.s3Client.send(command);

      console.log(`File uploaded successfully: ${fileName}`, response);

      // Verify the uploaded file
      const getObjectCommand = new GetObjectCommand({
        Bucket: bucketName,
        Key: fileName,
      });
      const { ContentLength, ContentType: uploadedContentType } =
        await this.s3Client.send(getObjectCommand);
      console.log(
        `Verified uploaded file: Size=${ContentLength}, Type=${uploadedContentType}`,
      );

      if (ContentLength !== body.length) {
        console.warn(
          `File size mismatch. Uploaded: ${ContentLength}, Original: ${body.length}`,
        );
      }
      if (uploadedContentType !== contentType) {
        console.warn(
          `Content type mismatch. Uploaded: ${uploadedContentType}, Original: ${contentType}`,
        );
      }
    } catch (error) {
      console.error('Error during file upload:', error);
      throw error;
    }
  }

  async getPresignedUploadUrl(
    bucket: string,
    key: string,
    contentType: string,
    expiresIn: number,
  ): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
    });

    // Create a pre-signed URL for the command
    const url = await getSignedUrl(this.s3Client, command, {
      expiresIn,
    });

    // Manually append the content-length query parameter
    const urlObject = new URL(url);

    return urlObject.toString();
  }

  /**
   * Sets CORS configuration for an existing S3 bucket.
   * @param {string} bucketName - The name of the bucket to configure.
   * @param {string[]} allowedOrigins - Array of allowed origins for CORS.
   * @returns {Promise<void>}
   * @throws {Error} If setting the CORS configuration fails.
   */
  private async setCORSConfiguration(
    bucketName: string,
    allowedOrigins: string[],
  ): Promise<void> {
    try {
      const corsConfig = {
        CORSRules: [
          {
            AllowedHeaders: ['*'],
            AllowedMethods: ['GET', 'PUT', 'POST', 'DELETE', 'HEAD'],
            AllowedOrigins: allowedOrigins,
            ExposeHeaders: ['ETag'],
            MaxAgeSeconds: 3000,
          },
        ],
      };

      const command = new PutBucketCorsCommand({
        Bucket: bucketName,
        CORSConfiguration: corsConfig,
      });

      await this.s3Client.send(command);
      console.log(
        `CORS configuration set successfully for bucket: ${bucketName}`,
      );
    } catch (error) {
      console.error(`Error setting CORS configuration: ${error}`);
      throw error;
    }
  }

  async downloadFile(
    bucketName: string,
    fileName: string,
  ): Promise<{ content: Buffer; contentType: string }> {
    console.log(
      `Attempting to download file: ${fileName} from bucket: ${bucketName}`,
    );
    try {
      const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: fileName,
      });

      const response = await this.s3Client.send(command);

      if (response.Body instanceof Readable) {
        const chunks = [];
        for await (const chunk of response.Body) {
          chunks.push(chunk);
        }
        const content = Buffer.concat(chunks);
        console.log(
          `File downloaded successfully: ${fileName}, Size: ${content.length}, Type: ${response.ContentType}`,
        );
        return {
          content,
          contentType: response.ContentType || 'application/octet-stream',
        };
      } else {
        throw new Error('Unexpected response body type');
      }
    } catch (error) {
      console.error('Error during file download:', error);
      throw error;
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
