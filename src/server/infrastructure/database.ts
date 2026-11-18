import { DatabaseSync } from "node:sqlite"

export const database = new DatabaseSync(process.env.DATABASE_PATH ?? "gatekeeper.db")

database.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS egress_requests (
    id TEXT PRIMARY KEY,
    workspace TEXT NOT NULL,
    host TEXT NOT NULL,
    reason TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    decided_at TEXT
  );
  CREATE INDEX IF NOT EXISTS egress_requests_lookup ON egress_requests (workspace, host, created_at);
  CREATE TABLE IF NOT EXISTS operator_questions (
    id TEXT PRIMARY KEY,
    workspace TEXT NOT NULL,
    item_key TEXT NOT NULL,
    item_name TEXT NOT NULL,
    item_url TEXT NOT NULL,
    question TEXT NOT NULL,
    status TEXT NOT NULL,
    answer TEXT,
    created_at TEXT NOT NULL,
    answered_at TEXT
  );
  CREATE INDEX IF NOT EXISTS operator_questions_lookup ON operator_questions (workspace, status, created_at);
`)
