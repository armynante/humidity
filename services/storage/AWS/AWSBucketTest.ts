import { BucketClient } from './AWSBucketService';
import fs from 'fs';
import path from 'path';

interface BucketIntegrationConfig {
  key?: string;
  secret?: string;
  region?: string;
}

async function testBucketIntegration({
  key,
  secret,
  region,
}: BucketIntegrationConfig) {
  const KEY = key || process.env.AWS_ACCESS_KEY_ID || '';
  const SECRET = secret || process.env.AWS_SECRET_ACCESS_KEY || '';
  const REGION = region || process.env.AWS_REGION || '';

  console.log('Using AWS Region:', REGION);

  const client = new BucketClient({
    accessKeyId: KEY,
    secretAccessKey: SECRET,
    region: REGION,
  });

  const bucketName = 'test-bucket-' + Date.now();
  const fileName = 'test-file.txt';
  const fileContent = 'Hello, this is a test file for S3 bucket integration!';
  const localFilePath = path.join(__dirname, fileName);
  const downloadFilePath = path.join(__dirname, 'downloaded-' + fileName);

  try {
    // Create a test file
    fs.writeFileSync(localFilePath, fileContent);

    // Create bucket
    console.log('Creating bucket...');
    await client.createBucket(bucketName);

    // Upload file
    console.log('Uploading file...');
    await client.uploadFile(bucketName, localFilePath, fileName);

    // List buckets
    console.log('Listing buckets...');
    const buckets = await client.listBuckets();
    console.log('Buckets:', buckets);

    // Download file
    console.log('Downloading file...');
    await client.downloadFile(bucketName, fileName, downloadFilePath);

    // Verify downloaded content
    const downloadedContent = fs.readFileSync(downloadFilePath, 'utf-8');
    console.log('Downloaded content:', downloadedContent);
    console.assert(downloadedContent === fileContent, 'File content mismatch');

    // Delete file from bucket
    console.log('Deleting file from bucket...');
    await client.deleteFile(bucketName, fileName);

    // Delete bucket
    console.log('Deleting bucket...');
    await client.deleteBucket(bucketName);

    console.log('Bucket integration test completed successfully');
  } catch (error) {
    console.error('Error during bucket integration test:', error);
  } finally {
    // Clean up local files
    if (fs.existsSync(localFilePath)) fs.unlinkSync(localFilePath);
    if (fs.existsSync(downloadFilePath)) fs.unlinkSync(downloadFilePath);
  }
}

export default testBucketIntegration;
