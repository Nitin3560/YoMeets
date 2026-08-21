import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as schema from "./schema.js";

export type Storage = {
  sqlite: Database.Database;
  db: BetterSQLite3Database<typeof schema>;
};

const migrationsDir = fileURLToPath(new URL("../migrations", import.meta.url));

export function openStorage(path = "yomeets.sqlite"): Storage {
  const sqlite = new Database(path);
  sqlite.pragma("foreign_keys = ON");

  return {
    db: drizzle(sqlite, { schema }),
    sqlite
  };
}

export function runMigrations(storage: Storage) {
  const migrationPath = join(dirname(migrationsDir), "migrations/0000_initial_schema.sql");
  const sql = readFileSync(migrationPath, "utf8").replace(/--> statement-breakpoint/g, "");

  storage.sqlite.exec(sql);
}
