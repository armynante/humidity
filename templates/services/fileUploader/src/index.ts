import express from 'express';
import multer from 'multer';
import path from 'path';
import { BucketClient } from './BucketClient';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = 3000;

const upload = multer({ dest: 'uploads/' });

const { DO_SPACES_ACCESS_KEY, DO_SPACES_SECRET_KEY, DO_SPACES_REGION } =
  process.env as {
    DO_SPACES_ACCESS_KEY: string;
    DO_SPACES_SECRET_KEY: string;
    DO_SPACES_REGION: string;
  };

const bucketClient = new BucketClient({
  accessKey: DO_SPACES_ACCESS_KEY,
  secretKey: DO_SPACES_SECRET_KEY,
  region: DO_SPACES_REGION,
});

const SPACE_NAME = 'humidity-demo-bucket-12345';

// Serve static files for the HTML page
app.use(express.static(path.join(__dirname, '../public')));

// Handle file upload from HTML page
app.post('/upload', upload.single('file'), async (req, res) => {
  const file = req.file;
  if (!file) {
    return res.status(400).send('No file uploaded.');
  }

  const filePath = path.resolve(file.path);
  const destination = `uploads/${file.filename}`;

  try {
    // Upload the file using BucketClient
    await bucketClient.uploadFile(SPACE_NAME, filePath, destination);
    res.send('File uploaded successfully.');
  } catch (error) {
    console.error(error);
    res.status(500).send('File upload failed.');
  }
});

app.get('/list-files', async (req, res) => {
  const { bucketName, prefix } = req.query;

  if (!bucketName || !prefix) {
    return res
      .status(400)
      .json({ error: 'bucketName and prefix are required' });
  }

  try {
    const objectsList = await bucketClient.listFiles(
      bucketName as string,
      prefix as string,
    );
    res.json(objectsList);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to list files' });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
