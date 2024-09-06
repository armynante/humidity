import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express';
import morgan from 'morgan';
import serverless from 'serverless-http';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { Database } from 'sqlite';
import dotenv from 'dotenv';
import { getDb, initializeDb, runMigrations, uploadDbToS3 } from './helpers';
import type { CustomRequest } from './helpers';
import * as sqlite3 from 'sqlite3';

dotenv.config();

const app = express();

// Configure morgan middleware for logging
app.use(morgan('combined'));

app.use(express.json());

const s3 = new S3Client({ region: process.env.REGION });

// const BUCKET_NAME = process.env.BUCKET_NAME!;
const BUCKET_NAME = 'instantdbtest';
const DB_FILE_NAME = process.env.DB_FILE_NAME || 'db.sqlite;';
const LOCAL_DB_PATH = process.env.LOCAL_DB_PATH || 'db.sqlite';

if (!BUCKET_NAME || !DB_FILE_NAME || !LOCAL_DB_PATH) {
  throw new Error('Missing environment variables');
}

// Middleware to handle database connections
app.use(async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = await getDb(s3, BUCKET_NAME, LOCAL_DB_PATH);
    (req as unknown as CustomRequest).db = db;
    res.on('finish', async () => {
      await db.close();
      await uploadDbToS3(s3, BUCKET_NAME, DB_FILE_NAME, LOCAL_DB_PATH);
    });
    next();
  } catch (error) {
    next(error);
  }
});

// Initialization endpoint
app.post('/initialize', async (req, res) => {
  try {
    await initializeDb(LOCAL_DB_PATH, sqlite3);
    await uploadDbToS3(s3, BUCKET_NAME, DB_FILE_NAME, LOCAL_DB_PATH);
    res.json({ message: 'Database initialized successfully' });
  } catch (error) {
    console.error('Error initializing database:', error);
    res.status(500).json({ error: 'Failed to initialize database' });
  }
});

// Route to get all tables
app.get('/tables', async (req: Request, res: Response) => {
  const db: Database | undefined = (req as unknown as CustomRequest).db;
  if (!db) {
    return res.status(500).json({ error: 'Database connection not found' });
  }
  const tables = await db.all(
    "SELECT name FROM sqlite_master WHERE type='table'",
  );
  res.json(tables);
});

// Route to run migrations
app.post('/migrations/:direction', async (req: Request, res: Response) => {
  const db = (req as unknown as CustomRequest).db;
  if (!db) {
    return res.status(500).json({ error: 'Database connection not found' });
  }

  const { direction } = req.params;
  if (direction !== 'up' && direction !== 'down') {
    return res.status(400).json({ error: 'Invalid migration direction' });
  }

  try {
    await runMigrations(db, direction, s3, BUCKET_NAME, LOCAL_DB_PATH);
    res.json({ message: `Migrations ${direction} completed successfully` });
  } catch (error) {
    console.error(`Error running migrations ${direction}:`, error);
    res.status(500).json({
      error: `Failed to run migrations ${direction}`,
      details: (error as Error).message,
    });
  }
});

// Route to find resources
app.get('/resource/:resource', async (req: Request, res: Response) => {
  const db: Database | undefined = (req as unknown as CustomRequest).db;
  if (!db) {
    return res.status(500).json({ error: 'Database connection not found' });
  }

  const { resource } = req.params;
  const filter = req.query;

  try {
    let query = `SELECT * FROM ${resource}`;
    let params: any[] = [];

    if (Object.keys(filter).length > 0) {
      query += ` WHERE ${Object.keys(filter)
        .map((key) => `${key} = ?`)
        .join(' AND ')}`;
      params = Object.values(filter);
    }

    const result = await db.all(query, params);
    res.json(result);
  } catch (error) {
    console.error(`Error finding ${resource}:`, error);
    res.status(500).json({ error: `Failed to find ${resource}` });
  }
});

// Route to create a new resource
app.post('/resource/:resource', async (req: Request, res: Response) => {
  const db: Database | undefined = (req as unknown as CustomRequest).db;
  if (!db) {
    return res.status(500).json({ error: 'Database connection not found' });
  }

  const { resource } = req.params;
  const data = req.body;

  try {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map(() => '?').join(', ');

    const query = `INSERT INTO ${resource} (${keys.join(', ')}) VALUES (${placeholders})`;
    await db.run(query, values);

    res.status(201).json({ message: `${resource} created successfully` });
  } catch (error) {
    console.error(`Error creating ${resource}:`, error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// Error handling middleware
app.use(
  (
    err: Error,
    req: Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  },
);

// Export the serverless handler
// export const handler = serverless(app);
export default app;

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});

// Route to create a new migration file
app.post('/migrations', async (req: Request, res: Response) => {
  const { up, down } = req.body;

  if (!up || !down) {
    return res.status(400).json({ error: 'Missing up or down SQL code' });
  }

  try {
    const timestamp = Date.now();
    const fileName = `${timestamp}_migration.ts`;
    const fileContent = `
      import { Database } from 'sqlite';

      export async function up(db: Database): Promise<void> {
        await db.exec(\`${up}\`);
      }

      export async function down(db: Database): Promise<void> {
        await db.exec(\`${down}\`);
      }
    `;

    const s3Key = `migrations/${fileName}`;

    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: s3Key,
        Body: fileContent,
        ContentType: 'application/typescript',
      }),
    );

    res.status(201).json({ message: 'Migration file created successfully' });
  } catch (error) {
    console.error('Error creating migration file:', error);
    res.status(500).json({ error: 'Failed to create migration file' });
  }
});

// Route to refresh the database
app.post('/refresh', async (req: Request, res: Response) => {
  const db: Database | undefined = (req as unknown as CustomRequest).db;
  if (!db) {
    return res.status(500).json({ error: 'Database connection not found' });
  }

  const { bucketName } = req.body;

  if (bucketName !== BUCKET_NAME) {
    return res.status(400).json({ error: 'Invalid bucket name' });
  }

  try {
    // Drop all tables
    const tables = await db.all(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
    );
    for (const table of tables) {
      await db.run(`DROP TABLE IF EXISTS ${table.name}`);
    }

    // Run migrations
    await runMigrations(db, 'up', s3, BUCKET_NAME, LOCAL_DB_PATH);

    // Upload the updated database to S3
    await uploadDbToS3(s3, BUCKET_NAME, DB_FILE_NAME, LOCAL_DB_PATH);

    res.json({ message: 'Database refreshed successfully' });
  } catch (error) {
    console.error('Error refreshing database:', error);
    res.status(500).json({ error: 'Failed to refresh database' });
  }
});

// Route to get all migrations
app.get('/migrations', async (req: Request, res: Response) => {
  const db: Database | undefined = (req as unknown as CustomRequest).db;
  if (!db) {
    return res.status(500).json({ error: 'Database connection not found' });
  }

  try {
    const migrations = await db.all('SELECT * FROM migrations');
    res.json(migrations);
  } catch (error) {
    console.error('Error getting migrations:', error);
    res.status(500).json({ error: 'Failed to get migrations' });
  }
});

// Route to delete a migration
app.delete('/migrations/:name', async (req: Request, res: Response) => {
  const db: Database | undefined = (req as unknown as CustomRequest).db;
  if (!db) {
    return res.status(500).json({ error: 'Database connection not found' });
  }

  const { name } = req.params;

  try {
    // Check if the migration exists
    const migration = await db.get(
      'SELECT * FROM migrations WHERE name = ?',
      name,
    );
    if (!migration) {
      return res.status(404).json({ error: 'Migration not found' });
    }

    // Delete the migration record from the migrations table
    await db.run('DELETE FROM migrations WHERE name = ?', name);

    // Delete the migration file from S3
    await s3.send(
      new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: `migrations/${name}.ts`,
      }),
    );

    res.json({ message: 'Migration deleted successfully' });
  } catch (error) {
    console.error('Error deleting migration:', error);
    res.status(500).json({ error: 'Failed to delete migration' });
  }
});
