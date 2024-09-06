import express from 'express';
import serverless from 'serverless-http';
import { BucketService } from '../../../../../services/storage/AWS/AWSBucketService.js';
// @ts-ignore
import {} from '../../../../../types/buckets';
import * as dotenv from 'dotenv';
dotenv.config();
const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
const AWS_REGION = process.env.AWS_REGION || '';
const AWS_KEY = process.env.AWS_KEY || '';
const AWS_SEC = process.env.AWS_SEC || '';
const BUCKET_NAME = process.env.BUCKET_NAME || '';
const clientConfig = {
    accessKeyId: AWS_KEY,
    secretAccessKey: AWS_SEC,
    region: AWS_REGION,
};
const bucketService = new BucketService();
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,OPTIONS,POST,PUT,DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});
app.post('*/getPresignedUrl', async (req, res) => {
    try {
        const { filename, contentType } = req.body;
        console.log('Request body:', req.body);
        // if (!filename || !contentType || !fileSize) {
        //   return res
        //     .status(400)
        //     .json({ error: 'Filename, content type, and file size are required' });
        // }
        // // Check if file size is within allowed limit (e.g., 100MB)
        // const maxFileSize = 100 * 1024 * 1024; // 100MB
        // if (fileSize > maxFileSize) {
        //   return res.status(400).json({
        //     error: `File size exceeds the maximum limit of ${maxFileSize / (1024 * 1024)}MB`,
        //   });
        // }
        const presignedUrl = await bucketService.getPresignedUploadUrl(BUCKET_NAME, filename, contentType, 300);
        console.log('Presigned URL:', presignedUrl);
        res.status(200).json({ presignedUrl });
    }
    catch (error) {
        console.error('Error generating presigned URL:', error);
        res.status(500).json({
            error: 'Error generating presigned URL',
            // @ts-ignore
            details: error.message,
        });
    }
});
app.get('*/download/:filename', async (req, res) => {
    try {
        const { filename } = req.params;
        const downloadedFile = await bucketService.downloadFile(BUCKET_NAME, filename);
        res.setHeader('Content-Type', downloadedFile.contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(downloadedFile.content);
    }
    catch (error) {
        console.error('Error downloading file:', error);
        res.status(500).json({ error: 'Error downloading file' });
    }
});
app.get('*/upload', (req, res) => {
    const html = `
  <!doctype html>
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>File Upload with Presigned URL</title>
      <style>
        .progress {
          width: 100%;
          background-color: #f3f3f3;
        }
        .progress-bar {
          width: 0;
          height: 30px;
          background-color: #4caf50;
          text-align: center;
          line-height: 30px;
          color: white;
        }
      </style>
    </head>
    <body>
      <h1>Upload a File</h1>
      <form id="uploadForm">
        <input type="file" id="fileInput" name="file" required />
        <button type="submit">Upload</button>
      </form>
      <div class="progress">
        <div class="progress-bar" id="progressBar">0%</div>
      </div>

      <script>
        document.getElementById('uploadForm').addEventListener('submit', async function(event) {
          event.preventDefault();

          const fileInput = document.getElementById('fileInput');
          const file = fileInput.files[0];
          console.log('Selected file:', file);
          console.log('Selected file:', file.name);

          if (!file) return;

          try {
            // Get presigned URL
            const response = await fetch('/prod/getPresignedUrl', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ filename: file.name, contentType: file.type })
            });
            console.log('Presigned URL response:');
            console.log(response);
            const { presignedUrl } = await response.json();

            // Upload file using presigned URL
            const xhr = new XMLHttpRequest();
            xhr.open('PUT', presignedUrl, true);
            xhr.setRequestHeader('Content-Type', file.type);

            xhr.upload.onprogress = function(event) {
              if (event.lengthComputable) {
                const percentComplete = (event.loaded / event.total) * 100;
                const progressBar = document.getElementById('progressBar');
                progressBar.style.width = percentComplete + '%';
                progressBar.textContent = percentComplete.toFixed(2) + '%';
              }
            };

            xhr.onload = function() {
              if (xhr.status === 200) {
                alert('File uploaded successfully!');
              } else {
                console.error('Error:', xhr.responseText);
                alert('File upload failed. ' + xhr.responseText);
              }
            };

            xhr.send(file);
          } catch (error) {
            console.error('Error:', error);
            alert('An error occurred during the upload process.');
          }
        });
      </script>
    </body>
  </html>
  `;
    res.send(html);
});
app.get('*/', (req, res) => {
    const api_instructions = 'GET /upload to see the upload form, POST to /getPresignedUrl to get a presigned URL for upload, GET to /download/{filename} to download a file';
    res.status(200).json({ instructions: api_instructions });
});
export const handler = serverless(app);
