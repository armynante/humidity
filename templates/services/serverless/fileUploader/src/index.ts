import {
  type APIGatewayProxyHandler,
  type APIGatewayProxyResult,
  type APIGatewayProxyEvent,
} from 'aws-lambda';
import { BucketClient } from '../../../../../services/storage/AWS/AWSBucketClient';
// Import error with esbuild types
// @ts-ignore
import { type BucketClientConfig } from '../../../../../types/buckets.d.ts';
import * as dotenv from 'dotenv';

dotenv.config();

const AWS_REGION = process.env.AWS_REGION || '';
const AWS_KEY = process.env.AWS_KEY || '';
const AWS_SEC = process.env.AWS_SEC || '';

const clientConfig: BucketClientConfig = {
  accessKeyId: AWS_KEY,
  secretAccessKey: AWS_SEC,
  region: AWS_REGION,
};

const bucketService = new BucketClient(clientConfig);

export const handler: APIGatewayProxyHandler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  const httpMethod = event.httpMethod;
  const path = event.path;

  if (path === '/upload') {
    if (httpMethod === 'POST') {
      return await createFile(event);
    }
  } else if (path.startsWith('/file/')) {
    const fileKey = path.split('/').pop();
    if (fileKey) {
      if (httpMethod === 'DELETE') {
        return await deleteFile(event);
      }
    }
  } else {
    if (httpMethod === 'GET') {
      return {
        statusCode: 200,
        body: JSON.stringify('Hello from file uploader service'),
      };
    }
  }

  return {
    statusCode: 400,
    body: JSON.stringify('Invalid endpoint or method'),
  };
};

const createFile = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  try {
    const fileContent = Buffer.from(event.body || '', 'base64');
    const fileName = event.queryStringParameters?.filename;
    const filePath = event.queryStringParameters?.filepath || '/';

    if (!fileName) {
      throw new Error('Filename is required');
    }

    // Turn buffer into a string
    const payload = fileContent.toString('base64');

    await bucketService.uploadFile(fileName, payload, filePath);

    return {
      statusCode: 200,
      body: JSON.stringify(`File ${fileName} uploaded successfully`),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify(`Error uploading file: ${error}`),
    };
  }
};

const deleteFile = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  try {
    const bucketName = event.queryStringParameters?.bucket || '';
    const filePath = event.queryStringParameters?.filepath || '';

    if (!bucketName || !filePath) {
      throw new Error('Bucket and filepath are required');
    }

    await bucketService.deleteFile(bucketName, filePath);

    return {
      statusCode: 200,
      body: JSON.stringify(`File ${filePath} deleted successfully`),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify(`Error deleting file: ${error}`),
    };
  }
};
