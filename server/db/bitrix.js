/**
 * Bitrix24: настройки webhook и очередь ручного переноса правок из приложения.
 */
const { runSql, getSql, allSql, saveDb } = require('./core');

function ensureBitrixTables() {
  runSql(`
    CREATE TABLE IF NOT EXISTS bitrix_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL DEFAULT ''
    )
  `);
  runSql(`
    CREATE TABLE IF NOT EXISTS bitrix_pending_exports (
      id TEXT PRIMARY KEY,
      object_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      payload_json TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      created_by TEXT,
      resolved_at TEXT,
      resolved_by TEXT
    )
  `);
  try {
    runSql('CREATE INDEX IF NOT EXISTS idx_bitrix_pending_status ON bitrix_pending_exports(status)');
    runSql('CREATE INDEX IF NOT EXISTS idx_bitrix_pending_object ON bitrix_pending_exports(object_id)');
  } catch (_) {}
}

function getBitrixSetting(key) {
  ensureBitrixTables();
  const row = getSql('SELECT value FROM bitrix_settings WHERE key = ?', [String(key || '')]);
  return row && row.value != null ? String(row.value) : '';
}

function setBitrixSetting(key, value) {
  ensureBitrixTables();
  const k = String(key || '').trim();
  if (!k) return false;
  const v = value != null ? String(value) : '';
  runSql('DELETE FROM bitrix_settings WHERE key = ?', [k]);
  runSql('INSERT INTO bitrix_settings (key, value) VALUES (?, ?)', [k, v]);
  saveDb();
  return true;
}

function getWebhookUrl() {
  const fromDb = getBitrixSetting('webhook_url').trim();
  if (fromDb) return fromDb.replace(/\/?$/, '/');
  const fromEnv = process.env.BITRIX_WEBHOOK_URL ? String(process.env.BITRIX_WEBHOOK_URL).trim() : '';
  if (fromEnv) return fromEnv.replace(/\/?$/, '/');
  return '';
}

function setWebhookUrl(url) {
  const u = url != null ? String(url).trim() : '';
  return setBitrixSetting('webhook_url', u ? u.replace(/\/?$/, '/') : '');
}

function maskWebhookUrl(url) {
  const u = String(url || '').trim();
  if (!u) return '';
  // https://portal/rest/USER/CODE/ → show portal + rest/***/
  try {
    const m = u.match(/^(https?:\/\/[^/]+\/rest\/)(\d+)\/([^/]+)\/?$/i);
    if (m) return m[1] + m[2] + '/***/';
  } catch (_) {}
  if (u.length <= 24) return '***';
  return u.slice(0, 28) + '…***';
}

function createPendingExport(row) {
  ensureBitrixTables();
  const id = row.id || 'bxp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  runSql(
    `INSERT INTO bitrix_pending_exports
      (id, object_id, kind, payload_json, status, created_at, created_by)
     VALUES (?, ?, ?, ?, 'pending', datetime('now'), ?)`,
    [
      id,
      String(row.objectId || ''),
      String(row.kind || 'other'),
      JSON.stringify(row.payload != null ? row.payload : {}),
      row.createdBy != null ? String(row.createdBy) : null
    ]
  );
  saveDb();
  return getPendingExportById(id);
}

function getPendingExportById(id) {
  ensureBitrixTables();
  const row = getSql(
    `SELECT id, object_id, kind, payload_json, status, created_at, created_by, resolved_at, resolved_by
     FROM bitrix_pending_exports WHERE id = ?`,
    [id]
  );
  return row ? mapPendingRow(row) : null;
}

function mapPendingRow(row) {
  let payload = {};
  try {
    payload = row.payload_json ? JSON.parse(row.payload_json) : {};
  } catch (_) {
    payload = {};
  }
  return {
    id: row.id,
    objectId: row.object_id,
    kind: row.kind,
    payload: payload,
    status: row.status,
    createdAt: row.created_at,
    createdBy: row.created_by,
    resolvedAt: row.resolved_at,
    resolvedBy: row.resolved_by
  };
}

function listPendingExports(opts) {
  ensureBitrixTables();
  opts = opts || {};
  const status = opts.status != null ? String(opts.status) : 'pending';
  const objectId = opts.objectId != null ? String(opts.objectId).trim() : '';
  if (objectId && status) {
    return (allSql(
      `SELECT id, object_id, kind, payload_json, status, created_at, created_by, resolved_at, resolved_by
       FROM bitrix_pending_exports WHERE object_id = ? AND status = ? ORDER BY created_at DESC`,
      [objectId, status]
    ) || []).map(mapPendingRow);
  }
  if (objectId) {
    return (allSql(
      `SELECT id, object_id, kind, payload_json, status, created_at, created_by, resolved_at, resolved_by
       FROM bitrix_pending_exports WHERE object_id = ? ORDER BY created_at DESC`,
      [objectId]
    ) || []).map(mapPendingRow);
  }
  if (status) {
    return (allSql(
      `SELECT id, object_id, kind, payload_json, status, created_at, created_by, resolved_at, resolved_by
       FROM bitrix_pending_exports WHERE status = ? ORDER BY created_at DESC`,
      [status]
    ) || []).map(mapPendingRow);
  }
  return (allSql(
    `SELECT id, object_id, kind, payload_json, status, created_at, created_by, resolved_at, resolved_by
     FROM bitrix_pending_exports ORDER BY created_at DESC`
  ) || []).map(mapPendingRow);
}

function resolvePendingExport(id, status, resolvedBy) {
  ensureBitrixTables();
  const st = status === 'dismissed' ? 'dismissed' : 'done';
  const row = getPendingExportById(id);
  if (!row) return null;
  if (row.status !== 'pending') return row;
  runSql(
    `UPDATE bitrix_pending_exports
     SET status = ?, resolved_at = datetime('now'), resolved_by = ?
     WHERE id = ? AND status = 'pending'`,
    [st, resolvedBy != null ? String(resolvedBy) : null, id]
  );
  saveDb();
  return getPendingExportById(id);
}

function hasOpenPendingFor(objectId, matcher) {
  const list = listPendingExports({ objectId: objectId, status: 'pending' });
  for (let i = 0; i < list.length; i++) {
    if (matcher(list[i])) return true;
  }
  return false;
}

module.exports = {
  ensureBitrixTables,
  getBitrixSetting,
  setBitrixSetting,
  getWebhookUrl,
  setWebhookUrl,
  maskWebhookUrl,
  createPendingExport,
  getPendingExportById,
  listPendingExports,
  resolvePendingExport,
  hasOpenPendingFor
};
