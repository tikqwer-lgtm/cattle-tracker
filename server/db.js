/**
 * Database access layer: users, objects, entries.
 * Uses sql.js (pure JS, no native build) for compatibility on Windows without Visual Studio.
 */
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, 'data');
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
  migrateObjectsCreatedBy();
  saveDb();
}

/** Добавить колонку created_by в objects (автор базы для удаления по паролю). */
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

/** История действий, УЗИ и архив лактаций (клиент pushActionHistory / API). */
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

function rowToEntry(row) {
  if (!row) return null;
  let protocol = { name: '', startDate: '' };
  let inseminationHistory = [];
  let actionHistory = [];
  let uziHistory = [];
  let lactationHistory = [];
  try {
    if (row.protocol_json) protocol = JSON.parse(row.protocol_json);
  } catch (_) {}
  try {
    if (row.insemination_history_json) inseminationHistory = JSON.parse(row.insemination_history_json);
  } catch (_) {}
  try {
    if (row.action_history_json) actionHistory = JSON.parse(row.action_history_json);
  } catch (_) {}
  try {
    if (row.uzi_history_json) uziHistory = JSON.parse(row.uzi_history_json);
  } catch (_) {}
  try {
    if (row.lactation_history_json) lactationHistory = JSON.parse(row.lactation_history_json);
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
    updatedAt: row.updated_at || '',
    inseminationHistory: Array.isArray(inseminationHistory) ? inseminationHistory : [],
    actionHistory: Array.isArray(actionHistory) ? actionHistory : [],
    uziHistory: Array.isArray(uziHistory) ? uziHistory : [],
    lactationHistory: Array.isArray(lactationHistory) ? lactationHistory : []
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
    insemination_history_json: JSON.stringify(entry.inseminationHistory || []),
    action_history_json: JSON.stringify(entry.actionHistory || []),
    uzi_history_json: JSON.stringify(entry.uziHistory || []),
    lactation_history_json: JSON.stringify(entry.lactationHistory || [])
  };
}

function createUser(id, username, passwordHash, role) {
  runSql(
    'INSERT INTO users (id, username, password_hash, role) VALUES (?, ?, ?, ?)',
    [id, username, passwordHash, role || 'operator']
  );
  saveDb();
}

function countUsers() {
  const row = getSql('SELECT COUNT(*) as c FROM users');
  return row && row.c != null ? Number(row.c) : 0;
}

function countAdmins() {
  const row = getSql('SELECT COUNT(*) as c FROM users WHERE role = ?', ['admin']);
  return row && row.c != null ? Number(row.c) : 0;
}

function updateUserRole(targetId, newRole) {
  const allowed = ['admin', 'operator', 'viewer'];
  if (!allowed.includes(newRole)) {
    return { ok: false, error: 'Недопустимая роль' };
  }
  const target = findUserById(targetId);
  if (!target) return { ok: false, error: 'Пользователь не найден' };
  if (target.role === newRole) return { ok: true };
  if (target.role === 'admin' && newRole !== 'admin' && countAdmins() <= 1) {
    return { ok: false, error: 'Нельзя снять последнего администратора' };
  }
  runSql('UPDATE users SET role = ? WHERE id = ?', [newRole, targetId]);
  saveDb();
  return { ok: true };
}

function findUserByUsername(username) {
  return getSql('SELECT * FROM users WHERE LOWER(username) = LOWER(?)', [username]);
}

function findUserById(id) {
  return getSql('SELECT id, username, role FROM users WHERE id = ?', [id]);
}

/** Для проверки пароля при удалении базы (только в auth/objects). */
function findUserByIdWithPassword(id) {
  return getSql('SELECT id, username, role, password_hash FROM users WHERE id = ?', [id]);
}

function getAllUsers() {
  return allSql('SELECT id, username, role, created_at FROM users ORDER BY created_at');
}

function deleteUser(id) {
  const user = findUserById(id);
  if (!user) return false;
  runSql('DELETE FROM users WHERE id = ?', [id]);
  saveDb();
  return true;
}

/** Смена пароля по логину (без проверки старого). Для восстановления доступа на своём сервере. */
function setPasswordHashForUsername(username, passwordHash) {
  const row = findUserByUsername(username);
  if (!row || !row.id) return false;
  runSql('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, row.id]);
  saveDb();
  return true;
}

function createReport(userId, username, message, payloadJson) {
  const id = 'r_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
  runSql(
    'INSERT INTO reports (id, user_id, username, message, payload_json, created_at) VALUES (?, ?, ?, ?, ?, datetime(\'now\'))',
    [id, userId, username, message || '', payloadJson != null ? payloadJson : null]
  );
  saveDb();
  return getReportById(id);
}

function getReportById(id) {
  const row = getSql('SELECT id, user_id, username, message, payload_json, created_at FROM reports WHERE id = ?', [id]);
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    username: row.username,
    message: row.message || '',
    payload: row.payload_json,
    createdAt: row.created_at
  };
}

function getReports() {
  const rows = allSql('SELECT id, user_id, username, message, payload_json, created_at FROM reports ORDER BY created_at DESC');
  return (rows || []).map((row) => ({
    id: row.id,
    userId: row.user_id,
    username: row.username,
    message: row.message || '',
    payload: row.payload_json,
    createdAt: row.created_at
  }));
}

function deleteReport(id) {
  const report = getReportById(id);
  if (!report) return false;
  runSql('DELETE FROM reports WHERE id = ?', [id]);
  saveDb();
  return true;
}

function getObjects() {
  return allSql('SELECT id, name, created_at FROM objects ORDER BY created_at');
}

function getRowVal(row, key) {
  if (row[key] !== undefined && row[key] !== null) return row[key];
  const lower = key.toLowerCase();
  for (const k of Object.keys(row)) {
    if (k.toLowerCase() === lower) return row[k];
  }
  return null;
}

/**
 * Returns objects with entries_count, last_updated_at, last_modified_by, created_by, created_by_username.
 */
function getObjectsWithMeta() {
  const sql = `
    SELECT o.id, o.name, o.created_at, o.created_by,
      (SELECT COUNT(*) FROM entries WHERE object_id = o.id) as entries_count,
      (SELECT updated_at FROM entries WHERE object_id = o.id ORDER BY updated_at DESC LIMIT 1) as last_updated_at,
      (SELECT last_modified_by FROM entries WHERE object_id = o.id ORDER BY updated_at DESC LIMIT 1) as last_modified_by,
      u.username as created_by_username
    FROM objects o
    LEFT JOIN users u ON u.id = o.created_by
    ORDER BY o.created_at
  `;
  return allSql(sql).map(row => {
    const id = getRowVal(row, 'id');
    const name = getRowVal(row, 'name');
    const entriesCount = getRowVal(row, 'entries_count');
    const lastUpdatedAt = getRowVal(row, 'last_updated_at');
    const lastModifiedBy = getRowVal(row, 'last_modified_by');
    const createdAt = getRowVal(row, 'created_at');
    const createdBy = getRowVal(row, 'created_by');
    const createdByUsername = getRowVal(row, 'created_by_username');
    return {
      id: id != null ? String(id) : '',
      name: name != null ? String(name) : '',
      created_at: createdAt != null ? String(createdAt) : null,
      created_by: createdBy != null ? String(createdBy) : null,
      created_by_username: createdByUsername != null ? String(createdByUsername) : null,
      entries_count: Number(entriesCount != null ? entriesCount : 0),
      last_updated_at: lastUpdatedAt != null ? String(lastUpdatedAt) : null,
      last_modified_by: lastModifiedBy != null ? String(lastModifiedBy) : null
    };
  });
}

function getObjectById(id) {
  return getSql('SELECT id, name FROM objects WHERE id = ?', [id]);
}

function createObject(id, name, createdByUserId) {
  runSql('INSERT INTO objects (id, name, created_by) VALUES (?, ?, ?)', [id, name, createdByUserId || null]);
  saveDb();
}

function updateObject(id, name) {
  const obj = getObjectById(id);
  if (!obj) return false;
  runSql('UPDATE objects SET name = ? WHERE id = ?', [(name || obj.name).trim() || obj.name, id]);
  saveDb();
  return true;
}

function deleteObject(id) {
  const obj = getObjectById(id);
  if (!obj) return false;
  runSql('DELETE FROM entries WHERE object_id = ?', [id]);
  runSql('DELETE FROM protocols WHERE object_id = ?', [id]);
  runSql('DELETE FROM objects WHERE id = ?', [id]);
  saveDb();
  return true;
}

function getEntries(objectId, userId, role) {
  let sql = `SELECT * FROM entries WHERE object_id = ?`;
  const params = [objectId];
  if (role !== 'admin' && userId) {
    sql += ` AND (user_id = ? OR user_id = '' OR user_id IS NULL)`;
    params.push(userId);
  }
  sql += ` ORDER BY created_at DESC`;
  const rows = allSql(sql, params);
  return rows.map(rowToEntry);
}

function getEntry(objectId, cattleId, userId, role) {
  const row = getSql('SELECT * FROM entries WHERE object_id = ? AND cattle_id = ?', [objectId, cattleId]);
  if (!row) return null;
  const entry = rowToEntry(row);
  if (role !== 'admin' && userId && entry.userId && entry.userId !== userId) return null;
  return entry;
}

function createEntry(entry, objectId) {
  const r = entryToRow(entry, objectId);
  runSql(
    `INSERT INTO entries (
      object_id, cattle_id, nickname, "group", birth_date, lactation, calving_date,
      insemination_date, attempt_number, bull, inseminator, code, status, exit_date,
      dry_start_date, vwp, note, protocol_json, date_added, synced, user_id, last_modified_by,
      insemination_history_json, action_history_json, uzi_history_json, lactation_history_json, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    [
      r.object_id, r.cattle_id, r.nickname, r.group, r.birth_date, r.lactation, r.calving_date,
      r.insemination_date, r.attempt_number, r.bull, r.inseminator, r.code, r.status, r.exit_date,
      r.dry_start_date, r.vwp, r.note, r.protocol_json, r.date_added, r.synced, r.user_id, r.last_modified_by,
      r.insemination_history_json, r.action_history_json, r.uzi_history_json, r.lactation_history_json
    ]
  );
  saveDb();
}

function updateEntry(objectId, cattleId, entry) {
  const r = entryToRow(entry, objectId);
  runSql(
    `UPDATE entries SET
      nickname = ?, "group" = ?, birth_date = ?, lactation = ?, calving_date = ?,
      insemination_date = ?, attempt_number = ?, bull = ?, inseminator = ?, code = ?, status = ?,
      exit_date = ?, dry_start_date = ?, vwp = ?, note = ?, protocol_json = ?, date_added = ?,
      synced = ?, user_id = ?, last_modified_by = ?, insemination_history_json = ?,
      action_history_json = ?, uzi_history_json = ?, lactation_history_json = ?,
      updated_at = datetime('now')
    WHERE object_id = ? AND cattle_id = ?`,
    [
      r.nickname, r.group, r.birth_date, r.lactation, r.calving_date,
      r.insemination_date, r.attempt_number, r.bull, r.inseminator, r.code, r.status,
      r.exit_date, r.dry_start_date, r.vwp, r.note, r.protocol_json, r.date_added,
      r.synced, r.user_id, r.last_modified_by, r.insemination_history_json,
      r.action_history_json, r.uzi_history_json, r.lactation_history_json,
      objectId, cattleId
    ]
  );
  saveDb();
}

function deleteEntry(objectId, cattleId) {
  runSql('DELETE FROM entries WHERE object_id = ? AND cattle_id = ?', [objectId, cattleId]);
  saveDb();
}

function entryExists(objectId, cattleId) {
  return getSql('SELECT 1 FROM entries WHERE object_id = ? AND cattle_id = ?', [objectId, cattleId]);
}

function getProtocols(objectId) {
  const rows = allSql('SELECT id, object_id, name, steps_json, created_at FROM protocols WHERE object_id = ? ORDER BY id', [objectId]);
  return (rows || []).map((row) => {
    let steps = [];
    try {
      if (row.steps_json) steps = JSON.parse(row.steps_json);
    } catch (_) {}
    return {
      id: row.id,
      name: row.name || '',
      steps: Array.isArray(steps) ? steps : []
    };
  });
}

function getProtocolById(objectId, protocolId) {
  const row = getSql('SELECT id, object_id, name, steps_json, created_at FROM protocols WHERE object_id = ? AND id = ?', [objectId, protocolId]);
  if (!row) return null;
  let steps = [];
  try {
    if (row.steps_json) steps = JSON.parse(row.steps_json);
  } catch (_) {}
  return {
    id: row.id,
    name: row.name || '',
    steps: Array.isArray(steps) ? steps : []
  };
}

function createProtocol(objectId, protocol) {
  const id = String(protocol.id || ('p_' + Date.now()));
  const name = (protocol.name || '').trim() || 'Без названия';
  const steps = Array.isArray(protocol.steps) ? protocol.steps : [];
  const stepsJson = JSON.stringify(steps);
  runSql(
    'INSERT INTO protocols (id, object_id, name, steps_json, created_at) VALUES (?, ?, ?, ?, datetime(\'now\'))',
    [id, objectId, name, stepsJson]
  );
  saveDb();
  return getProtocolById(objectId, id);
}

function updateProtocol(objectId, protocolId, protocol) {
  const existing = getProtocolById(objectId, protocolId);
  if (!existing) return null;
  const name = (protocol.name != null ? String(protocol.name).trim() : null) || existing.name;
  const steps = Array.isArray(protocol.steps) ? protocol.steps : existing.steps;
  const stepsJson = JSON.stringify(steps);
  runSql('UPDATE protocols SET name = ?, steps_json = ? WHERE object_id = ? AND id = ?', [name, stepsJson, objectId, protocolId]);
  saveDb();
  return getProtocolById(objectId, protocolId);
}

function deleteProtocol(objectId, protocolId) {
  const existing = getProtocolById(objectId, protocolId);
  if (!existing) return false;
  runSql('DELETE FROM protocols WHERE object_id = ? AND id = ?', [objectId, protocolId]);
  saveDb();
  return true;
}

module.exports = {
  initDb,
  initSchema,
  createUser,
  findUserByUsername,
  findUserById,
  findUserByIdWithPassword,
  getAllUsers,
  countUsers,
  countAdmins,
  updateUserRole,
  deleteUser,
  setPasswordHashForUsername,
  createReport,
  getReportById,
  getReports,
  deleteReport,
  getObjects,
  getObjectsWithMeta,
  getObjectById,
  createObject,
  updateObject,
  deleteObject,
  getEntries,
  getEntry,
  createEntry,
  updateEntry,
  deleteEntry,
  entryExists,
  getProtocols,
  getProtocolById,
  createProtocol,
  updateProtocol,
  deleteProtocol
};
