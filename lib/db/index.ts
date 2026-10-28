import "server-only";

import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as sqliteVec from "sqlite-vec";
import * as schema from "./schema";
import { initSchema } from "./init";

type AppDatabase = BetterSQLite3Database<typeof schema>;

type DatabaseBundle = {
  sqlite: Database.Database;
  db: AppDatabase;
  path: string;
};

const globalForDb = globalThis as unknown as {
  __nianlunDb?: DatabaseBundle;
};

function createDatabase(): DatabaseBundle {
  const dataDir =
    process.env.LIFE_DATA_DIR ?? path.join(process.cwd(), "data");
  fs.mkdirSync(dataDir, { recursive: true });

  const dbPath = path.join(dataDir, "life.db");
  const sqlite = new Database(dbPath);

  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");
  sqlite.pragma("synchronous = NORMAL");

  sqliteVec.load(sqlite);
  initSchema(sqlite);

  return {
    sqlite,
    db: drizzle(sqlite, { schema }),
    path: dbPath,
  };
}

export const database = globalForDb.__nianlunDb ?? createDatabase();
if (process.env.NODE_ENV !== "production") {
  globalForDb.__nianlunDb = database;
}

export const { sqlite, db, path: databasePath } = database;
