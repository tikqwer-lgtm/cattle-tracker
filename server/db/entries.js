const { runSql, getSql, allSql, saveDb } = require('./core');

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
    cattleId: String(row.cattle_id != null ? row.cattle_id : '').trim(),
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
    lactationHistory: Array.isArray(lactationHistory) ? lactationHistory : [],
    stallYard: row.stall_yard != null && String(row.stall_yard) !== '' ? String(row.stall_yard) : '',
    stallRow: (function () {
      const v = row.stall_row;
      if (v === null || v === undefined || v === '') return '';
      const n = Number(v);
      return Number.isFinite(n) ? n : '';
    })(),
    stallPlace: (function () {
      const v = row.stall_place;
      if (v === null || v === undefined || v === '') return '';
      const n = Number(v);
      return Number.isFinite(n) ? n : '';
    })()
  };
}

function entryToRow(entry, objectId) {
  return {
    object_id: objectId,
    cattle_id: String(entry.cattleId != null ? entry.cattleId : '').trim(),
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
    lactation_history_json: JSON.stringify(entry.lactationHistory || []),
    stall_yard:
      entry.stallYard != null && String(entry.stallYard).trim() !== '' ? String(entry.stallYard).trim() : null,
    stall_row: (function () {
      const v = entry.stallRow;
      if (v === '' || v === undefined || v === null) return null;
      const n = parseInt(v, 10);
      return Number.isFinite(n) ? n : null;
    })(),
    stall_place: (function () {
      const v = entry.stallPlace;
      if (v === '' || v === undefined || v === null) return null;
      const n = parseInt(v, 10);
      return Number.isFinite(n) ? n : null;
    })()
  };
}

function getEntries(objectId, userId, role) {
  let sql = `SELECT * FROM entries WHERE object_id = ?`;
  const params = [objectId];
  // База (object) общая для всех авторизованных пользователей: оператор и просмотр
  // должны видеть все записи, иначе «Загрузить с сервера» даёт пустую копию и плодятся пустые объекты.
  sql += ` ORDER BY created_at DESC`;
  const rows = allSql(sql, params);
  return rows.map(rowToEntry);
}

function getEntry(objectId, cattleId, userId, role) {
  const row = getSql('SELECT * FROM entries WHERE object_id = ? AND cattle_id = ?', [objectId, cattleId]);
  if (!row) return null;
  return rowToEntry(row);
}

function insertEntryRow(r) {
  runSql(
    `INSERT INTO entries (
      object_id, cattle_id, nickname, "group", birth_date, lactation, calving_date,
      insemination_date, attempt_number, bull, inseminator, code, status, exit_date,
      dry_start_date, vwp, note, protocol_json, date_added, synced, user_id, last_modified_by,
      insemination_history_json, action_history_json, uzi_history_json, lactation_history_json,
      stall_yard, stall_row, stall_place, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    [
      r.object_id, r.cattle_id, r.nickname, r.group, r.birth_date, r.lactation, r.calving_date,
      r.insemination_date, r.attempt_number, r.bull, r.inseminator, r.code, r.status, r.exit_date,
      r.dry_start_date, r.vwp, r.note, r.protocol_json, r.date_added, r.synced, r.user_id, r.last_modified_by,
      r.insemination_history_json, r.action_history_json, r.uzi_history_json, r.lactation_history_json,
      r.stall_yard, r.stall_row, r.stall_place
    ]
  );
}

function createEntry(entry, objectId) {
  const r = entryToRow(entry, objectId);
  insertEntryRow(r);
  saveDb();
}

/**
 * Копирует записи между объектами одной БД одним saveDb — для мобильных и нестабильной сети
 * (сотни отдельных POST часто обрываются; пустая база с именем остаётся на сервере).
 */
function cloneEntriesToObject(sourceObjectId, targetObjectId, userId, username) {
  const rows = allSql('SELECT * FROM entries WHERE object_id = ? ORDER BY rowid', [sourceObjectId]);
  if (!rows || !rows.length) return 0;
  const uid = userId != null ? String(userId) : '';
  const uname = username != null ? String(username) : '';
  let n = 0;
  for (let i = 0; i < rows.length; i++) {
    const entry = rowToEntry(rows[i]);
    const cid = String(entry.cattleId != null ? entry.cattleId : '').trim();
    if (!cid) continue;
    if (entryExists(targetObjectId, cid)) continue;
    entry.userId = uid;
    entry.lastModifiedBy = uname;
    try {
      const r = entryToRow(entry, targetObjectId);
      insertEntryRow(r);
      n++;
    } catch (e) {
      console.warn('cloneEntriesToObject skip', cid, e.message);
    }
  }
  saveDb();
  return n;
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
      stall_yard = ?, stall_row = ?, stall_place = ?,
      updated_at = datetime('now')
    WHERE object_id = ? AND cattle_id = ?`,
    [
      r.nickname, r.group, r.birth_date, r.lactation, r.calving_date,
      r.insemination_date, r.attempt_number, r.bull, r.inseminator, r.code, r.status,
      r.exit_date, r.dry_start_date, r.vwp, r.note, r.protocol_json, r.date_added,
      r.synced, r.user_id, r.last_modified_by, r.insemination_history_json,
      r.action_history_json, r.uzi_history_json, r.lactation_history_json,
      r.stall_yard, r.stall_row, r.stall_place,
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

module.exports = {
  rowToEntry,
  entryToRow,
  getEntries,
  getEntry,
  createEntry,
  cloneEntriesToObject,
  updateEntry,
  deleteEntry,
  entryExists,
};
