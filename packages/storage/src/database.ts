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
  const initialMigrationPath = join(dirname(migrationsDir), "migrations/0000_initial_schema.sql");
  const meetingMigrationPath = join(dirname(migrationsDir), "migrations/0001_meeting_execution.sql");
  const canonicalMeetingMigrationPath = join(dirname(migrationsDir), "migrations/0002_canonical_meeting_model.sql");
  const hasInitialSchema = storage.sqlite
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'tasks'")
    .get();

  if (!hasInitialSchema) {
    const initialSql = readFileSync(initialMigrationPath, "utf8").replace(/--> statement-breakpoint/g, "");
    storage.sqlite.exec(initialSql);
  }

  const meetingSql = readFileSync(meetingMigrationPath, "utf8").replace(/--> statement-breakpoint/g, "");
  storage.sqlite.exec(meetingSql);
  const canonicalMeetingSql = readFileSync(canonicalMeetingMigrationPath, "utf8").replace(/--> statement-breakpoint/g, "");
  storage.sqlite.exec(canonicalMeetingSql);

  const segmentColumns = storage.sqlite.prepare("PRAGMA table_info(transcript_segments)").all() as Array<{ name: string }>;

  if (segmentColumns.length > 0 && !segmentColumns.some((column) => column.name === "sequence")) {
    storage.sqlite.exec("ALTER TABLE transcript_segments ADD COLUMN sequence integer NOT NULL DEFAULT 0");
  }

  const meetingColumns = storage.sqlite.prepare("PRAGMA table_info(meetings)").all() as Array<{ name: string }>;

  if (meetingColumns.length > 0 && !meetingColumns.some((column) => column.name === "audio_path")) {
    storage.sqlite.exec("ALTER TABLE meetings ADD COLUMN audio_path text");
  }
}
