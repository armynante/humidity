import express from 'express';
import serverless from 'serverless-http';
import { S3 } from 'aws-sdk';
import * as sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import * as fs from 'fs';

const app = express();
const s3 = new S3();

const BUCKET_NAME = 'your-s3-bucket-name';
const DB_FILE_NAME = 'your-database.db';
const LOCAL_DB_PATH = '/tmp/local_database.db';

async function checkDbExistsInS3(): Promise<boolean> {
  try {
    await s3.headObject({ Bucket: BUCKET_NAME, Key: DB_FILE_NAME }).promise();
    return true;
  } catch (error) {
    // @ts-ignore
    if (error.code === 'NotFound') {
      return false;
    }
    throw error;
  }
}

async function downloadDbFromS3(): Promise<void> {
  try {
    const params = {
      Bucket: BUCKET_NAME,
      Key: DB_FILE_NAME,
    };

    const { Body } = await s3.getObject(params).promise();
    if (Body instanceof Buffer) {
      fs.writeFileSync(LOCAL_DB_PATH, Body);
      console.log(`Database downloaded from S3 to ${LOCAL_DB_PATH}`);
    }
  } catch (error) {
    console.log(`Error downloading database from S3: ${error}`);
    throw error;
  }
}

async function uploadDbToS3(): Promise<void> {
  try {
    const fileContent = fs.readFileSync(LOCAL_DB_PATH);
    const params = {
      Bucket: BUCKET_NAME,
      Key: DB_FILE_NAME,
      Body: fileContent,
    };

    await s3.putObject(params).promise();
    console.log(`Database uploaded to S3 from ${LOCAL_DB_PATH}`);
  } catch (error) {
    console.log(`Error uploading database to S3: ${error}`);
    throw error;
  }
}

async function initializeDb(): Promise<void> {
  const db = await open({
    filename: LOCAL_DB_PATH,
    driver: sqlite3.Database,
  });
  await runMigrations(db);
  await db.close();
}

async function runMigrations(db: Database): Promise<void> {
  // Add your migration scripts here
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL
    )
  `);
}

async function getDb(): Promise<Database> {
  const dbExists = await checkDbExistsInS3();
  if (dbExists) {
    await downloadDbFromS3();
  } else {
    await initializeDb();
    await uploadDbToS3();
  }
  return open({
    filename: LOCAL_DB_PATH,
    driver: sqlite3.Database,
  });
}

// Middleware to handle database connections
app.use(async (req, res, next) => {
  try {
    const db = await getDb();
    req.db = db;
    res.on('finish', async () => {
      await db.close();
      await uploadDbToS3();
    });
    next();
  } catch (error) {
    next(error);
  }
});

// Initialization endpoint
app.post('/initialize', async (req, res) => {
  try {
    await initializeDb();
    await uploadDbToS3();
    res.json({ message: 'Database initialized successfully' });
  } catch (error) {
    console.error('Error initializing database:', error);
    res.status(500).json({ error: 'Failed to initialize database' });
  }
});

// Route to get all tables
app.get('/tables', async (req, res) => {
  const db: Database = req.db;
  const tables = await db.all(
    "SELECT name FROM sqlite_master WHERE type='table'",
  );
  res.json(tables);
});

// Route to run migrations
app.post('/run-migrations', async (req, res) => {
  const db: Database = req.db;
  await runMigrations(db);
  res.json({ message: 'Migrations completed successfully' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal Server Error' });
});

// Export the serverless handler
export const handler = serverless(app);
