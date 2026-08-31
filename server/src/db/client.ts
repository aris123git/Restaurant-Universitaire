import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { config } from "../config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;
  const dir = path.dirname(config.dbPath);
  fs.mkdirSync(dir, { recursive: true });
  db = new Database(config.dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  db.exec(schema);
  return db;
}

export function closeDb(): void {
  db?.close();
  db = null;
}

export function withTransaction<T>(fn: (database: Database.Database) => T): T {
  const database = getDb();
  const run = database.transaction(fn);
  return run(database);
}
