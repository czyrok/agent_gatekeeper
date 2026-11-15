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
`)
