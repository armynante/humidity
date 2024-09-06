import * as Minio from 'minio';
import fs from 'fs';
import { Transform } from 'node:stream';
export class BucketClient {
    minioClient;
    region;
    // @ts-ignore
    secretKey;
    // @ts-ignore
    accessKey;
    constructor({ accessKey, secretKey, region }) {
        this.minioClient = new Minio.Client({
            endPoint: `${region}.digitaloceanspaces.com`,
            region,
            accessKey,
            secretKey,
            useSSL: true,
        });
        this.region = region;
        this.secretKey = secretKey;
        this.accessKey = accessKey;
    }
    async createBucket(bucketName) {
        try {
            const exists = await this.minioClient.bucketExists(bucketName);
            if (exists) {
                console.log(`Bucket already exists: ${bucketName}`);
                return;
            }
            await this.minioClient.makeBucket(bucketName, this.region);
            console.log(`Bucket created successfully: ${bucketName}`);
        }
        catch (error) {
            console.error(error);
        }
    }
    async listBuckets() {
        try {
            const buckets = await this.minioClient.listBuckets();
            let bucketNames = [];
            if (buckets.length > 0) {
                bucketNames = buckets.map((bucket) => bucket.name);
                console.log('Buckets:', bucketNames);
            }
        }
        catch (error) {
            console.error(error);
        }
    }
    async deleteBucket(bucketName) {
        try {
            const exists = await this.minioClient.bucketExists(bucketName);
            if (!exists) {
                console.log(`Bucket does not exist: ${bucketName}`);
                return;
            }
            await this.minioClient.removeBucket(bucketName);
            console.log(`Bucket deleted successfully: ${bucketName}`);
        }
        catch (error) {
            console.error(error);
        }
    }
    async uploadFile(bucketName, filePath, destination, progressCallback) {
        try {
            const fileSize = fs.statSync(filePath).size;
            let uploadedBytes = 0;
            const fileStream = fs.createReadStream(filePath);
            const progressStream = new Transform({
                transform(chunk, _, callback) {
                    uploadedBytes += chunk.length;
                    if (progressCallback) {
                        progressCallback(uploadedBytes, fileSize);
                    }
                    callback(null, chunk); // Pass the chunk along unmodified
                },
            });
            const uploadStream = fileStream.pipe(progressStream);
            await this.minioClient.putObject(bucketName, destination, uploadStream);
            console.log(`\nFile uploaded successfully: ${filePath}`);
        }
        catch (error) {
            console.error('Error during file upload:', error);
        }
    }
    async downloadFile(bucketName, filePath, destination) {
        try {
            const objectStat = await this.minioClient.statObject(bucketName, filePath);
            const fileSize = objectStat.size;
            let downloadedBytes = 0;
            const stream = await this.minioClient.getObject(bucketName, filePath);
            const fileStream = fs.createWriteStream(destination);
            stream.on('data', (chunk) => {
                downloadedBytes += chunk.length;
                this.showProgress(downloadedBytes, fileSize, 'Download');
            });
            stream.pipe(fileStream);
            fileStream.on('finish', () => {
                console.log(`\nFile downloaded successfully: ${destination}`);
            });
            stream.on('end', () => {
                fileStream.end();
            });
        }
        catch (error) {
            console.error(error);
        }
    }
    async deleteFile(bucketName, filePath) {
        try {
            await this.minioClient.removeObject(bucketName, filePath);
            console.log(`File deleted successfully: ${filePath}`);
        }
        catch (error) {
            console.error(error);
        }
    }
    showProgress(transferred, total, operation) {
        const percentage = (transferred / total) * 100;
        process.stdout.write(`\r${operation} progress: ${percentage.toFixed(2)}% (${transferred}/${total} bytes)`);
    }
}
