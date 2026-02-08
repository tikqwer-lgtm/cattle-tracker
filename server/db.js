/**
 * Database access layer: users, objects, entries.
 * Entry format matches frontend getDefaultCowEntry().
 */
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const dbPath = path.join(dataDir, 'cattle.db');
const db = new Database(dbPath);

function initSchema() {
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
      nickname TEXT, "group" TEXT, birth_date TEXT, lactation TEXT, calving_date TEXT,
      insemination_date TEXT, attempt_number INTEGER DEFAULT 1, bull TEXT, inseminator TEXT,
      code TEXT, status TEXT, exit_date TEXT, dry_start_date TEXT, vwp INTEGER DEFAULT 60,
      note TEXT, protocol_json TEXT, date_added TEXT, synced INTEGER DEFAULT 0,
      user_id TEXT, last_modified_by TEXT, insemination_history_json TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(object_id, cattle_id),
      FOREIGN KEY (object_id) REFERENCES objects(id)
    );
    CREATE INDEX IF NOT EXISTS idx_entries_object ON entries(object_id);
    CREATE INDEX IF NOT EXISTS idx_entries_user ON entries(user_id);
  `);
  const stmt = db.prepare("SELECT 1 FROM objects WHERE id = 'default'");
  if (!stmt.get()) {
    db.prepare("INSERT INTO objects (id, name) VALUES ('default', 'Основная база')").run();
  }
}

function rowToEntry(row) {
  if (!row) return null;
  let protocol = { name: '', startDate: '' };
  let inseminationHistory = [];
  try {
    if (row.protocol_json) protocol = JSON.parse(row.protocol_json);
  } catch (_) {}
  try {
    if (row.insemination_history_json) inseminationHistory = JSON.parse(row.insemination_history_json);
  } catch (_) {}
  return {
    cattleId: row.cattle_id,
    nickname: row.nickname || '',
    group: row.group || '',
    birthDate: row.birth_date || '',
    lactation: row.lactation || '',
    calvingDate: row.calving_date || '',
    inseminationDate: row.insemination_date || '',
    attemptNumber: row.attempt_number ?? 1,
    bull: row.bull || '',
    inseminator: row.inseminator || '',
    code: row.code || '',
    status: row.status || '',
    exitDate: row.exit_date || '',
    dryStartDate: row.dry_start_date || '',
    vwp: row.vwp ?? 60,
    note: row.note || '',
    protocol,
    dateAdded: row.date_added || '',
    synced: Boolean(row.synced),
    userId: row.user_id || '',
    lastModifiedBy: row.last_modified_by || '',
    inseminationHistory: Array.isArray(inseminationHistory) ? inseminationHistory : []
  };
}

function entryToRow(entry, objectId) {
  return {
    object_id: objectId,
    cattle_id: (entry.cattleId || '').trim(),
    nickname: entry.nickname || '',
    group: entry.group || '',
    birth_date: entry.birthDate || '',
    lactation: entry.lactation || '',
    calving_date: entry.calvingDate || '',
    insemination_date: entry.inseminationDate || '',
    attempt_number: entry.attemptNumber ?? 1,
    bull: entry.bull || '',
    inseminator: entry.inseminator || '',
    code: entry.code || '',
    status: entry.status || '',
    exit_date: entry.exitDate || '',
    dry_start_date: entry.dryStartDate || '',
    vwp: entry.vwp ?? 60,
    note: entry.note || '',
    protocol_json: JSON.stringify(entry.protocol || { name: '', startDate: '' }),
    date_added: entry.dateAdded || '',
    synced: entry.synced ? 1 : 0,
    user_id: entry.userId || '',
    last_modified_by: entry.lastModifiedBy || '',
    insemination_history_json: JSON.stringify(entry.inseminationHistory || [])
  };
}

// Users
function createUser(id, username, passwordHash, role) {
  db.prepare(
    'INSERT INTO users (id, username, password_hash, role) VALUES (?, ?, ?, ?)'
  ).run(id, username, passwordHash, role || 'operator');
}

function findUserByUsername(username) {
  return db.prepare('SELECT * FROM users WHERE LOWER(username) = LOWER(?)').get(username);
}

function findUserById(id) {
  return db.prepare('SELECT id, username, role FROM users WHERE id = ?').get(id);
}

// Objects
function getObjects() {
  return db.prepare('SELECT id, name, created_at FROM objects ORDER BY created_at').all();
}

function getObjectById(id) {
  return db.prepare('SELECT id, name FROM objects WHERE id = ?').get(id);
}

function createObject(id, name) {
  db.prepare('INSERT INTO objects (id, name) VALUES (?, ?)').run(id, name);
}

// Entries (with optional filter by userId for non-admin)
function getEntries(objectId, userId, role) {
  let sql = `SELECT * FROM entries WHERE object_id = ?`;
  const params = [objectId];
  if (role !== 'admin' && userId) {
    sql += ` AND (user_id = ? OR user_id = '' OR user_id IS NULL)`;
    params.push(userId);
  }
  sql += ` ORDER BY created_at DESC`;
  const rows = db.prepare(sql).all(...params);
  return rows.map(rowToEntry);
}

function getEntry(objectId, cattleId, userId, role) {
  const row = db.prepare(
    'SELECT * FROM entries WHERE object_id = ? AND cattle_id = ?'
  ).get(objectId, cattleId);
  if (!row) return null;
  const entry = rowToEntry(row);
  if (role !== 'admin' && userId && entry.userId && entry.userId !== userId) return null;
  return entry;
}

function createEntry(entry, objectId) {
  const r = entryToRow(entry, objectId);
  db.prepare(`
    INSERT INTO entries (
      object_id, cattle_id, nickname, "group", birth_date, lactation, calving_date,
      insemination_date, attempt_number, bull, inseminator, code, status, exit_date,
      dry_start_date, vwp, note, protocol_json, date_added, synced, user_id, last_modified_by,
      insemination_history_json, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(
    r.object_id, r.cattle_id, r.nickname, r.group, r.birth_date, r.lactation, r.calving_date,
    r.insemination_date, r.attempt_number, r.bull, r.inseminator, r.code, r.status, r.exit_date,
    r.dry_start_date, r.vwp, r.note, r.protocol_json, r.date_added, r.synced, r.user_id, r.last_modified_by,
    r.insemination_history_json
  );
}

function updateEntry(objectId, cattleId, entry) {
  const r = entryToRow(entry, objectId);
  db.prepare(`
    UPDATE entries SET
      nickname = ?, "group" = ?, birth_date = ?, lactation = ?, calving_date = ?,
      insemination_date = ?, attempt_number = ?, bull = ?, inseminator = ?, code = ?, status = ?,
      exit_date = ?, dry_start_date = ?, vwp = ?, note = ?, protocol_json = ?, date_added = ?,
      synced = ?, user_id = ?, last_modified_by = ?, insemination_history_json = ?,
      updated_at = datetime('now')
    WHERE object_id = ? AND cattle_id = ?
  `).run(
    r.nickname, r.group, r.birth_date, r.lactation, r.calving_date,
    r.insemination_date, r.attempt_number, r.bull, r.inseminator, r.code, r.status,
    r.exit_date, r.dry_start_date, r.vwp, r.note, r.protocol_json, r.date_added,
    r.synced, r.user_id, r.last_modified_by, r.insemination_history_json,
    objectId, cattleId
  );
}

function deleteEntry(objectId, cattleId) {
  return db.prepare('DELETE FROM entries WHERE object_id = ? AND cattle_id = ?').run(objectId, cattleId);
}

function entryExists(objectId, cattleId) {
  return db.prepare('SELECT 1 FROM entries WHERE object_id = ? AND cattle_id = ?').get(objectId, cattleId);
}

module.exports = {
  initSchema,
  createUser,
  findUserByUsername,
  findUserById,
  getObjects,
  getObjectById,
  createObject,
  getEntries,
  getEntry,
  createEntry,
  updateEntry,
  deleteEntry,
  entryExists
};
