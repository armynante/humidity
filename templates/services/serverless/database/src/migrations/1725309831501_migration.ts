
      import { Database } from 'sqlite';

      export async function up(db: Database): Promise<void> {
        await db.exec(`CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, email TEXT UNIQUE);`);
      }

      export async function down(db: Database): Promise<void> {
        await db.exec(`DROP TABLE users;`);
      }
    