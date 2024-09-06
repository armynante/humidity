import { GetObjectCommand, HeadObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client, } from '@aws-sdk/client-s3';
import fs from 'node:fs';
import * as sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import * as path from 'path';
export async function checkDbExistsInS3(s3, bucketName, dbFileName) {
    try {
        await s3.send(new HeadObjectCommand({ Bucket: bucketName, Key: dbFileName }));
        return true;
    }
    catch (error) {
        if (error.name === 'NotFound') {
            return false;
        }
        throw error;
    }
}
export async function downloadDbFromS3(s3, bucketName, dbFileName, localDbPath) {
    try {
        const params = {
            Bucket: bucketName,
            Key: dbFileName,
        };
        const { Body } = await s3.send(new GetObjectCommand(params));
        if (Body instanceof Buffer) {
            fs.writeFileSync(localDbPath, Body);
            console.log(`Database downloaded from S3 to ${localDbPath}`);
        }
    }
    catch (error) {
        console.log(`Error downloading database from S3: ${error}`);
        throw error;
    }
}
export async function uploadDbToS3(s3, bucketName, dbFileName, localDbPath) {
    try {
        const fileContent = fs.readFileSync(localDbPath);
        const params = {
            Bucket: bucketName,
            Key: dbFileName,
            Body: fileContent,
        };
        await s3.send(new PutObjectCommand(params));
        console.log(`Database uploaded to S3 from ${localDbPath}`);
    }
    catch (error) {
        console.log(`Error uploading database to S3: ${error}`);
        throw error;
    }
}
export async function initializeDb(localDbPath, driver) {
    const db = await open({
        filename: localDbPath,
        driver: sqlite3.Database,
    });
    // Create the migrations table if it doesn't exist
    await db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE
    )
  `);
    // await runMigrations(db, 'up');
    await db.close();
}
export async function downloadMigrationsFromS3(s3, bucketName, localDbPath) {
    try {
        const params = {
            Bucket: bucketName,
            Prefix: 'migrations/',
        };
        const { Contents } = await s3.send(new ListObjectsV2Command(params));
        if (Contents) {
            for (const object of Contents) {
                if (object.Key) {
                    const { Body } = await s3.send(new GetObjectCommand({ Bucket: bucketName, Key: object.Key }));
                    if (Body instanceof Buffer) {
                        const localPath = path.join(__dirname, object.Key);
                        fs.mkdirSync(path.dirname(localPath), { recursive: true });
                        fs.writeFileSync(localPath, Body);
                        console.log(`Migration file downloaded from S3 to ${localPath}`);
                    }
                    else if (Body !== undefined) {
                        const data = await Body.transformToByteArray();
                        const localPath = path.join(__dirname, object.Key);
                        fs.mkdirSync(path.dirname(localPath), { recursive: true });
                        fs.writeFileSync(localPath, data);
                        console.log(`Migration file downloaded from S3 to ${localPath}`);
                    }
                    else {
                        console.log('Body is undefined');
                    }
                }
            }
        }
    }
    catch (error) {
        console.log(`Error downloading migration files from S3: ${error}`);
        throw error;
    }
}
export async function runMigrations(db, direction, s3, bucketName, localDbPath) {
    await downloadMigrationsFromS3(s3, bucketName, localDbPath);
    const migrationsDir = path.join(__dirname, 'migrations');
    // Create the migrations directory if it doesn't exist
    if (!fs.existsSync(migrationsDir)) {
        fs.mkdirSync(migrationsDir);
    }
    const migrationFiles = fs.readdirSync(migrationsDir);
    console.log('Migration files:', migrationFiles);
    for (const file of migrationFiles) {
        const migrationName = path.parse(file).name;
        // Check if the migration has already been executed
        const existingMigration = await db.get('SELECT * FROM migrations WHERE name = ?', migrationName);
        if (direction === 'up' && !existingMigration) {
            const migration = await import(path.join(migrationsDir, file));
            await migration.up(db);
            // Insert the migration record into the migrations table
            await db.run('INSERT INTO migrations (name) VALUES (?)', migrationName);
        }
        else if (direction === 'down' && existingMigration) {
            const migration = await import(path.join(migrationsDir, file));
            await migration.down(db);
            // Remove the migration record from the migrations table
            await db.run('DELETE FROM migrations WHERE name = ?', migrationName);
        }
    }
}
export async function getDb(s3, bucketName, localDbPath) {
    const dbExists = await checkDbExistsInS3(s3, bucketName, localDbPath);
    if (dbExists) {
        await downloadDbFromS3(s3, bucketName, localDbPath, localDbPath);
    }
    else {
        throw new Error('Database not found in S3. Please initialize the database first.');
    }
    return open({
        filename: localDbPath,
        driver: sqlite3.Database,
    });
}
