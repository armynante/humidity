import { Readable } from 'stream';
/**
 * A client for interacting with AWS S3 buckets.
 * @class BucketClient
 */
export declare class BucketService {
    private s3Client;
    region: string;
    private logger;
    /**
     * Creates an instance of BucketClient.
     * @param {BucketClientConfig} config - The configuration object for the client.
     * @param {S3Client} [s3Client] - An optional pre-configured S3Client instance.
     */
    constructor();
    /**
     * Creates a new S3 bucket.
     * @param {string} bucketName - The name of the bucket to create.
     * @returns {Promise<void>}
     * @throws {Error} If the bucket creation fails.
     */
    createBucket(bucketName: string): Promise<void>;
    /**
     * Empties an S3 bucket by deleting all objects within it.
     * @param {string} bucketName - The name of the bucket to empty.
     * @returns {Promise<void>}
     * @throws {Error} If emptying the bucket fails.
     */
    emptyBucket(bucketName: string): Promise<void>;
    /**
     * Lists all S3 buckets in the account.
     * @returns {Promise<string[]>} An array of bucket names, or undefined if an error occurs.
     */
    listBuckets(): Promise<(string | undefined)[] | undefined>;
    /**
     * Deletes an S3 bucket.
     * @param {string} bucketName - The name of the bucket to delete.
     * @returns {Promise<void>}
     */
    deleteBucket(bucketName: string): Promise<void>;
    /**
     * Uploads a file to an S3 bucket.
     * @param {string} bucketName - The name of the bucket to upload to.
     * @param {string} filePath - The local path of the file to upload.
     * @param {string} destination - The S3 key (path) where the file will be stored.
     * @param {function} [progressCallback] - Optional callback to report upload progress.
     * @returns {Promise<void>}
     * @throws {Error} If the file upload fails.
     */
    uploadFile(bucketName: string, fileName: string, fileContent: Buffer | Readable, contentType: string): Promise<void>;
    getPresignedUploadUrl(bucket: string, key: string, contentType: string, expiresIn: number): Promise<string>;
    /**
     * Sets CORS configuration for an existing S3 bucket.
     * @param {string} bucketName - The name of the bucket to configure.
     * @param {string[]} allowedOrigins - Array of allowed origins for CORS.
     * @returns {Promise<void>}
     * @throws {Error} If setting the CORS configuration fails.
     */
    private setCORSConfiguration;
    downloadFile(bucketName: string, fileName: string): Promise<{
        content: Buffer;
        contentType: string;
    }>;
    /**
     * Deletes a file from an S3 bucket.
     * @param {string} bucketName - The name of the bucket containing the file.
     * @param {string} filePath - The S3 key (path) of the file to delete.
     * @returns {Promise<void>}
     */
    deleteFile(bucketName: string, filePath: string): Promise<void>;
    /**
     * Shows the progress of an operation.
     * @private
     * @param {number} transferred - The number of bytes transferred.
     * @param {number} total - The total number of bytes.
     * @param {string} operation - The name of the operation (e.g., 'Download', 'Upload').
     */
    private showProgress;
}
