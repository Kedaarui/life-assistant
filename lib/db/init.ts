import type Database from "better-sqlite3";

/**
 * Idempotent schema bootstrap.
 *
 * The P0 schema is applied with plain DDL so a fresh checkout works without a
 * migration tool. Drizzle Kit is wired up for future migrations, but the app
 * must be able to start from zero on its own.
 */
export function initSchema(sqlite: Database.Database) {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS entries (
      id TEXT PRIMARY KEY,
      event_time INTEGER NOT NULL,
      event_time_end INTEGER,
      event_precision TEXT NOT NULL DEFAULT 'datetime',
      time_note TEXT,
      recorded_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      title TEXT,
      content_md TEXT NOT NULL,
      mood INTEGER,
      energy INTEGER,
      category TEXT NOT NULL DEFAULT 'other',
      event_type TEXT NOT NULL DEFAULT 'occurrence',
      importance INTEGER NOT NULL DEFAULT 3,
      outcome TEXT,
      follow_up_at INTEGER,
      location TEXT,
      sensitivity TEXT NOT NULL DEFAULT 'normal',
      source TEXT NOT NULL DEFAULT 'text',
      status TEXT NOT NULL DEFAULT 'active',
      deleted_at INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_entries_event_time ON entries(event_time);
    CREATE INDEX IF NOT EXISTS idx_entries_deleted ON entries(deleted_at);

    CREATE TABLE IF NOT EXISTS tags (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_tags_name ON tags(name);

    CREATE TABLE IF NOT EXISTS entry_tags (
      entry_id TEXT NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
      tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (entry_id, tag_id)
    );
    CREATE INDEX IF NOT EXISTS idx_entry_tags_tag ON entry_tags(tag_id);

    CREATE TABLE IF NOT EXISTS people (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      aliases TEXT,
      relation TEXT,
      notes TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS entry_people (
      entry_id TEXT NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
      person_id TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
      role TEXT,
      PRIMARY KEY (entry_id, person_id)
    );

    CREATE TABLE IF NOT EXISTS attachments (
      id TEXT PRIMARY KEY,
      entry_id TEXT NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
      path TEXT NOT NULL,
      mime TEXT,
      size INTEGER,
      transcript TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS chunks (
      id TEXT PRIMARY KEY,
      entry_id TEXT NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
      seq INTEGER NOT NULL,
      text TEXT NOT NULL,
      tokens INTEGER,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_chunks_entry ON chunks(entry_id);

    CREATE TABLE IF NOT EXISTS memories (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      subject TEXT,
      predicate TEXT,
      object TEXT,
      confidence REAL NOT NULL DEFAULT 0.5,
      valid_from INTEGER,
      valid_to INTEGER,
      source_entry_ids TEXT NOT NULL DEFAULT '[]',
      superseded_by TEXT,
      status TEXT NOT NULL DEFAULT 'candidate',
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS profile_snapshots (
      id TEXT PRIMARY KEY,
      period_start INTEGER,
      period_end INTEGER,
      summary_md TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS summaries (
      id TEXT PRIMARY KEY,
      granularity TEXT NOT NULL,
      period_start INTEGER NOT NULL,
      period_end INTEGER NOT NULL,
      content_md TEXT NOT NULL,
      source_ids TEXT NOT NULL DEFAULT '[]',
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS goals (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      start_date INTEGER,
      target_date INTEGER,
      progress REAL NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS decisions (
      id TEXT PRIMARY KEY,
      entry_id TEXT REFERENCES entries(id) ON DELETE SET NULL,
      question TEXT NOT NULL,
      options TEXT,
      choice TEXT,
      rationale TEXT,
      expected_outcome TEXT,
      review_date INTEGER,
      actual_outcome TEXT,
      status TEXT NOT NULL DEFAULT 'open',
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      title TEXT,
      mode TEXT NOT NULL DEFAULT 'companion',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      citations TEXT,
      model TEXT,
      tokens_in INTEGER,
      tokens_out INTEGER,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      payload TEXT,
      run_at INTEGER,
      attempts INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      created_at INTEGER NOT NULL
    );
  `);

  // Migrate databases created before P2.
  ensureColumn(
    sqlite,
    "entries",
    "event_precision",
    "event_precision TEXT NOT NULL DEFAULT 'datetime'",
  );
  ensureColumn(sqlite, "entries", "time_note", "time_note TEXT");
  ensureColumn(
    sqlite,
    "entries",
    "category",
    "category TEXT NOT NULL DEFAULT 'other'",
  );
  ensureColumn(
    sqlite,
    "entries",
    "event_type",
    "event_type TEXT NOT NULL DEFAULT 'occurrence'",
  );
  ensureColumn(
    sqlite,
    "entries",
    "importance",
    "importance INTEGER NOT NULL DEFAULT 3",
  );
  ensureColumn(sqlite, "entries", "outcome", "outcome TEXT");
  ensureColumn(sqlite, "entries", "follow_up_at", "follow_up_at INTEGER");
  sqlite.exec(`
    CREATE INDEX IF NOT EXISTS idx_entries_event_end ON entries(event_time_end);
    CREATE INDEX IF NOT EXISTS idx_entries_category ON entries(category);
    CREATE INDEX IF NOT EXISTS idx_entries_event_type ON entries(event_type);
    CREATE INDEX IF NOT EXISTS idx_entries_importance ON entries(importance);
    CREATE INDEX IF NOT EXISTS idx_entries_follow_up ON entries(follow_up_at);
  `);

  // The P0/P1 vector table had no metadata columns. It was never populated,
  // so recreating it is safe and lets us filter by time inside sqlite-vec.
  const existingVectors = sqlite
    .prepare(
      "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'chunk_vectors'",
    )
    .get() as { sql: string } | undefined;

  if (existingVectors && !existingVectors.sql.includes("entry_id")) {
    sqlite.exec("DROP TABLE chunk_vectors");
  }

  sqlite.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS chunk_vectors USING vec0(
      chunk_id TEXT PRIMARY KEY,
      entry_id TEXT,
      event_time FLOAT,
      event_time_end FLOAT,
      embedding FLOAT[1024]
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
      chunk_id UNINDEXED,
      entry_id UNINDEXED,
      text,
      tokenize='trigram'
    );
  `);
}

function ensureColumn(
  sqlite: Database.Database,
  table: string,
  column: string,
  definition: string,
) {
  const columns = sqlite
    .prepare(`PRAGMA table_info(${table})`)
    .all() as { name: string }[];

  if (!columns.some((item) => item.name === column)) {
    sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
  }
}
