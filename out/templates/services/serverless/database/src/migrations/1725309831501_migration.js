import { Database } from 'sqlite';
export async function up(db) {
    await db.exec(`CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, email TEXT UNIQUE);`);
}
export async function down(db) {
    await db.exec(`DROP TABLE users;`);
}
