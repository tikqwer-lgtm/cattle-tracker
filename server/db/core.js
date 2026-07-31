/**
 * Database core: sql.js connection, schema, migrations, SQL helpers.
 */
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const dbPath = path.join(dataDir, 'cattle.db');

let db = null;
let SQL = null;

function saveDb() {
  if (!db) return;
  try {
    const data = db.export();
    fs.writeFileSync(dbPath, Buffer.from(data));
  } catch (e) {
    console.error('db save error:', e.message);
  }
}

function runSql(sql, params) {
  const stmt = db.prepare(sql);
  try {
    if (params && params.length) stmt.bind(params);
    stmt.step();
  } finally {
    stmt.free();
  }
}

function getSql(sql, params) {
  const stmt = db.prepare(sql);
  try {
    if (params && params.length) stmt.bind(params);
    return stmt.step() ? stmt.getAsObject() : null;
  } finally {
    stmt.free();
  }
}

function allSql(sql, params) {
  const stmt = db.prepare(sql);
  try {
    if (params && params.length) stmt.bind(params);
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    return rows;
  } finally {
    stmt.free();
  }
}

async function initDb() {
  const initSqlJs = require('sql.js');
  SQL = await initSqlJs();
  let buffer = null;
  if (fs.existsSync(dbPath)) buffer = fs.readFileSync(dbPath);
  db = buffer && buffer.length > 0 ? new SQL.Database(buffer) : new SQL.Database();
  return db;
}

function initSchema() {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS objects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  db.run(`
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
  `);
  db.run(`CREATE INDEX IF NOT EXISTS idx_entries_object ON entries(object_id);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_entries_user ON entries(user_id);`);

  db.run(`
    CREATE TABLE IF NOT EXISTS protocols (
      id TEXT NOT NULL,
      object_id TEXT NOT NULL,
      name TEXT NOT NULL,
      steps_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (object_id, id),
      FOREIGN KEY (object_id) REFERENCES objects(id)
    );
  `);
  db.run(`CREATE INDEX IF NOT EXISTS idx_protocols_object ON protocols(object_id);`);

  db.run(`
    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      username TEXT NOT NULL,
      message TEXT NOT NULL,
      payload_json TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  db.run(`CREATE INDEX IF NOT EXISTS idx_reports_created ON reports(created_at);`);

  const row = getSql("SELECT 1 FROM objects WHERE id = 'default'");
  if (!row) {
    runSql("INSERT INTO objects (id, name) VALUES ('default', 'Основная база')");
  }
  migrateEntriesMetaColumns();
  migrateEntriesHistoryJsonColumns();
  migrateEntriesStallColumns();
  migrateObjectsCreatedBy();
  migrateObjectsStallLayout();
  migrateObjectsProfileFarmSettings();
  migrateUsersPasswordPlain();
  migrateUserObjectsAndInbox();
  try {
    const userObjects = require('./user-objects');
    userObjects.migrateUserRolesToCanonical();
  } catch (e) {
    console.error('migrate user roles:', e.message);
  }
  saveDb();
}

function migrateUserObjectsAndInbox() {
  db.run(`
    CREATE TABLE IF NOT EXISTS user_objects (
      user_id TEXT NOT NULL,
      object_id TEXT NOT NULL,
      assigned_at TEXT NOT NULL DEFAULT (datetime('now')),
      assigned_by TEXT,
      PRIMARY KEY (user_id, object_id),
      FOREIGN KEY (object_id) REFERENCES objects(id)
    );
  `);
  db.run(`CREATE INDEX IF NOT EXISTS idx_user_objects_user ON user_objects(user_id);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_user_objects_object ON user_objects(object_id);`);
  db.run(`
    CREATE TABLE IF NOT EXISTS user_inbox (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      payload_json TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      read_at TEXT
    );
  `);
  db.run(`CREATE INDEX IF NOT EXISTS idx_user_inbox_user ON user_inbox(user_id);`);

  // Однократный seed: если привязок ещё нет — дать всем не-админам доступ ко всем объектам (старое поведение «все видят всё»).
  try {
    const linkCount = getSql('SELECT COUNT(*) as c FROM user_objects');
    if (linkCount && Number(linkCount.c) === 0) {
      const users = allSql("SELECT id, role FROM users WHERE LOWER(role) NOT IN ('admin', 'manager')") || [];
      const objs = allSql('SELECT id FROM objects') || [];
      for (let i = 0; i < users.length; i++) {
        for (let j = 0; j < objs.length; j++) {
          runSql(
            "INSERT OR IGNORE INTO user_objects (user_id, object_id, assigned_at, assigned_by) VALUES (?, ?, datetime('now'), NULL)",
            [String(users[i].id), String(objs[j].id)]
          );
        }
      }
    }
  } catch (e) {
    console.error('seed user_objects:', e.message);
  }
}

function migrateUsersPasswordPlain() {
  const info = allSql('PRAGMA table_info(users)');
  const names = (info || []).map((r) => (r.name || '').toLowerCase());
  if (names.indexOf('password_plain') === -1) {
    try {
      runSql('ALTER TABLE users ADD COLUMN password_plain TEXT');
    } catch (e) {
      if (!/duplicate column/i.test(e.message)) console.error('migrate users password_plain:', e.message);
    }
  }
}

function migrateObjectsCreatedBy() {
  const info = allSql("PRAGMA table_info(objects)");
  const names = (info || []).map((r) => (r.name || '').toLowerCase());
  if (names.indexOf('created_by') === -1) {
    try {
      runSql('ALTER TABLE objects ADD COLUMN created_by TEXT');
    } catch (e) {
      if (!/duplicate column/i.test(e.message)) console.error('migrate objects created_by:', e.message);
    }
  }
}

/** Добавить колонки updated_at и last_modified_by в entries, если их нет (старые БД). */
function migrateEntriesMetaColumns() {
  const info = allSql("PRAGMA table_info(entries)");
  const names = (info || []).map((r) => (r.name || '').toLowerCase());
  if (names.indexOf('updated_at') === -1) {
    try {
      runSql('ALTER TABLE entries ADD COLUMN updated_at TEXT NOT NULL DEFAULT (datetime(\'now\'))');
    } catch (e) {
      if (!/duplicate column/i.test(e.message)) console.error('migrate updated_at:', e.message);
    }
  }
  if (names.indexOf('last_modified_by') === -1) {
    try {
      runSql('ALTER TABLE entries ADD COLUMN last_modified_by TEXT');
    } catch (e) {
      if (!/duplicate column/i.test(e.message)) console.error('migrate last_modified_by:', e.message);
    }
  }
}

/** Стойломесто: двор, ряд, место (координаты на карточке животного). */
function migrateEntriesStallColumns() {
  const info = allSql('PRAGMA table_info(entries)');
  const names = (info || []).map((r) => (r.name || '').toLowerCase());
  const add = [
    ['stall_yard', 'ALTER TABLE entries ADD COLUMN stall_yard TEXT'],
    ['stall_row', 'ALTER TABLE entries ADD COLUMN stall_row INTEGER'],
    ['stall_place', 'ALTER TABLE entries ADD COLUMN stall_place INTEGER']
  ];
  for (let i = 0; i < add.length; i++) {
    if (names.indexOf(add[i][0]) === -1) {
      try {
        runSql(add[i][1]);
      } catch (e) {
        if (!/duplicate column/i.test(e.message)) console.error('migrate ' + add[i][0] + ':', e.message);
      }
    }
  }
}

/** Сетка стойломест по дворам (JSON) на объекте (базе). */
function migrateObjectsStallLayout() {
  const info = allSql('PRAGMA table_info(objects)');
  const names = (info || []).map((r) => (r.name || '').toLowerCase());
  if (names.indexOf('stall_layout_json') === -1) {
    try {
      runSql('ALTER TABLE objects ADD COLUMN stall_layout_json TEXT');
    } catch (e) {
      if (!/duplicate column/i.test(e.message)) console.error('migrate objects stall_layout_json:', e.message);
    }
  }
}

/** Карточка хозяйства (profile) и справочники ИО/быки/препараты (farm_settings). */
function migrateObjectsProfileFarmSettings() {
  const info = allSql('PRAGMA table_info(objects)');
  const names = (info || []).map((r) => (r.name || '').toLowerCase());
  if (names.indexOf('profile_json') === -1) {
    try {
      runSql('ALTER TABLE objects ADD COLUMN profile_json TEXT');
    } catch (e) {
      if (!/duplicate column/i.test(e.message)) console.error('migrate objects profile_json:', e.message);
    }
  }
  if (names.indexOf('farm_settings_json') === -1) {
    try {
      runSql('ALTER TABLE objects ADD COLUMN farm_settings_json TEXT');
    } catch (e) {
      if (!/duplicate column/i.test(e.message)) console.error('migrate objects farm_settings_json:', e.message);
    }
  }
}

function parseJsonColumn(raw, fallback) {
  if (raw == null || String(raw).trim() === '') return fallback;
  try {
    const parsed = JSON.parse(raw);
    return parsed != null ? parsed : fallback;
  } catch (_) {
    return fallback;
  }
}

function normalizeVwpDays(raw) {
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n)) return 60;
  if (n < 30) return 30;
  if (n > 120) return 120;
  return n;
}

function migrateEntriesHistoryJsonColumns() {
  const info = allSql('PRAGMA table_info(entries)');
  const names = (info || []).map((r) => (r.name || '').toLowerCase());
  const add = [
    ['action_history_json', 'ALTER TABLE entries ADD COLUMN action_history_json TEXT'],
    ['uzi_history_json', 'ALTER TABLE entries ADD COLUMN uzi_history_json TEXT'],
    ['lactation_history_json', 'ALTER TABLE entries ADD COLUMN lactation_history_json TEXT']
  ];
  for (let i = 0; i < add.length; i++) {
    if (names.indexOf(add[i][0]) === -1) {
      try {
        runSql(add[i][1]);
      } catch (e) {
        if (!/duplicate column/i.test(e.message)) console.error('migrate ' + add[i][0] + ':', e.message);
      }
    }
  }
}

module.exports = {
  initDb,
  initSchema,
  saveDb,
  runSql,
  getSql,
  allSql,
  parseJsonColumn,
  normalizeVwpDays,
};
