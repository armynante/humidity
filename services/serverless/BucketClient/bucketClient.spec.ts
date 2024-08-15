import { expect, test, mock, jest } from 'bun:test';
import { BucketClient } from './BucketClient';
import {
  S3Client,
  CreateBucketCommand,
  ListBucketsCommand,
  DeleteBucketCommand,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import fs from 'fs';
import { Readable, Writable } from 'stream';

// Mock S3Client
const mockS3Client = {
  send: mock((command) => {
    if (command instanceof ListBucketsCommand) {
      return Promise.resolve({ Buckets: [{ Name: 'test-bucket' }] });
    }
    if (command instanceof GetObjectCommand) {
      const mockStream = new Readable({
        read() {
          this.push('mock file content');
          this.push(null);
        },
      });
      return Promise.resolve({ Body: mockStream, ContentLength: 17 });
    }
    return Promise.resolve({});
  }),
} as unknown as S3Client;

// Test configuration
const config = {
  region: 'us-west-2',
  accessKeyId: 'test-access-key',
  secretAccessKey: 'test-secret-key',
};

// Helper function to create a client with mocked S3 service
function createMockedClient() {
  return new BucketClient(config, mockS3Client);
}

test('BucketClient - createBucket', async () => {
  const client = createMockedClient();
  await client.createBucket('test-bucket');

  expect(mockS3Client.send).toHaveBeenCalledWith(
    expect.any(CreateBucketCommand),
  );
});

test('BucketClient - listBuckets', async () => {
  const client = createMockedClient();
  const buckets = await client.listBuckets();

  expect(mockS3Client.send).toHaveBeenCalledWith(
    expect.any(ListBucketsCommand),
  );
  expect(buckets).toEqual(['test-bucket']);
});

test('BucketClient - deleteBucket', async () => {
  const client = createMockedClient();
  await client.deleteBucket('test-bucket');

  expect(mockS3Client.send).toHaveBeenCalledWith(
    expect.any(DeleteBucketCommand),
  );
});

test('BucketClient - uploadFile', async () => {
  const client = createMockedClient();
  const mockFileContent = Buffer.from('mock file content');
  const mockReadFile = mock(() => Promise.resolve(mockFileContent));
  const mockStat = mock(() =>
    Promise.resolve({ size: mockFileContent.length }),
  );

  // Mock fs.promises methods
  const originalFsPromises = fs.promises;
  fs.promises = {
    ...originalFsPromises,
    readFile: mockReadFile,
    stat: mockStat,
  } as any;

  await client.uploadFile('test-bucket', 'local/path.txt', 'remote/path.txt');

  expect(mockS3Client.send).toHaveBeenCalledWith(expect.any(PutObjectCommand));
  expect(mockReadFile).toHaveBeenCalledWith('local/path.txt');
  expect(mockStat).toHaveBeenCalledWith('local/path.txt');

  // Restore original fs.promises
  fs.promises = originalFsPromises;
});

test('BucketClient - downloadFile', async () => {
  const client = createMockedClient();
  let writtenData = '';
  const mockWriteStream = new Writable({
    write(chunk, encoding, callback) {
      writtenData += chunk.toString();
      callback();
    },
  });
  const mockCreateWriteStream = mock(() => mockWriteStream);

  // Mock fs.createWriteStream
  const originalCreateWriteStream = fs.createWriteStream;
  fs.createWriteStream = mockCreateWriteStream as any;

  // Mock console.log to suppress output during test
  const originalConsoleLog = console.log;
  console.log = mock(() => {});

  await client.downloadFile('test-bucket', 'remote/path.txt', 'local/path.txt');

  expect(mockS3Client.send).toHaveBeenCalledWith(expect.any(GetObjectCommand));
  expect(mockCreateWriteStream).toHaveBeenCalledWith('local/path.txt');
  expect(writtenData).toBe('mock file content');

  // Restore original fs.createWriteStream and console.log
  fs.createWriteStream = originalCreateWriteStream;
  console.log = originalConsoleLog;
});

test('BucketClient - deleteFile', async () => {
  const client = createMockedClient();
  await client.deleteFile('test-bucket', 'remote/path.txt');

  expect(mockS3Client.send).toHaveBeenCalledWith(
    expect.any(DeleteObjectCommand),
  );
});
