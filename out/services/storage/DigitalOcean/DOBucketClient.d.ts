interface BucketClientConfig {
    accessKey: string;
    secretKey: string;
    region: string;
}
export declare class BucketClient {
    private minioClient;
    region: string;
    private secretKey;
    private accessKey;
    constructor({ accessKey, secretKey, region }: BucketClientConfig);
    createBucket(bucketName: string): Promise<void>;
    listBuckets(): Promise<void>;
    deleteBucket(bucketName: string): Promise<void>;
    uploadFile(bucketName: string, filePath: string, destination: string, progressCallback?: (transferred: number, total: number) => void): Promise<void>;
    downloadFile(bucketName: string, filePath: string, destination: string): Promise<void>;
    deleteFile(bucketName: string, filePath: string): Promise<void>;
    private showProgress;
}
export {};
