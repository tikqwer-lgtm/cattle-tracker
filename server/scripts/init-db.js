/**
 * Create SQLite schema: users, objects, entries.
 * Run: node scripts/init-db.js
 */
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const dbPath = path.join(dataDir, 'cattle.db');
const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'operator',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS objects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    object_id TEXT NOT NULL,
    cattle_id TEXT NOT NULL,
    nickname TEXT,
    "group" TEXT,
    birth_date TEXT,
    lactation TEXT,
    calving_date TEXT,
    insemination_date TEXT,
    attempt_number INTEGER DEFAULT 1,
    bull TEXT,
    inseminator TEXT,
    code TEXT,
    status TEXT,
    exit_date TEXT,
    dry_start_date TEXT,
    vwp INTEGER DEFAULT 60,
    note TEXT,
    protocol_json TEXT,
    date_added TEXT,
    synced INTEGER DEFAULT 0,
    user_id TEXT,
    last_modified_by TEXT,
    insemination_history_json TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(object_id, cattle_id),
    FOREIGN KEY (object_id) REFERENCES objects(id)
  );

  CREATE INDEX IF NOT EXISTS idx_entries_object ON entries(object_id);
  CREATE INDEX IF NOT EXISTS idx_entries_user ON entries(user_id);
`);

// Ensure default object exists (for migration compatibility)
const stmt = db.prepare("SELECT 1 FROM objects WHERE id = 'default'");
if (!stmt.get()) {
  db.prepare("INSERT INTO objects (id, name) VALUES ('default', 'Основная база')").run();
}

db.close();
console.log('DB initialized at', dbPath);
