/**
 * access-requests — заявки «забыл пароль» / «запросить логин».
 */
const { runSql, getSql, allSql, saveDb } = require('./core');

function ensureAccessRequestsTable() {
  runSql(`
    CREATE TABLE IF NOT EXISTS access_requests (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      username TEXT,
      contact TEXT,
      comment TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      resolved_at TEXT,
      resolved_by TEXT
    )
  `);
  try {
    runSql('CREATE INDEX IF NOT EXISTS idx_access_requests_status ON access_requests(status)');
  } catch (_) {}
}

function createAccessRequest(row) {
  ensureAccessRequestsTable();
  const id = row.id || ('ar_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8));
  runSql(
    'INSERT INTO access_requests (id, kind, username, contact, comment, status, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime(\'now\'))',
    [
      id,
      String(row.kind || '').trim(),
      row.username != null ? String(row.username).trim() : '',
      row.contact != null ? String(row.contact).trim() : '',
      row.comment != null ? String(row.comment).trim() : '',
      'pending'
    ]
  );
  saveDb();
  return getAccessRequestById(id);
}

function getAccessRequestById(id) {
  ensureAccessRequestsTable();
  return getSql(
    'SELECT id, kind, username, contact, comment, status, created_at, resolved_at, resolved_by FROM access_requests WHERE id = ?',
    [id]
  );
}

function listAccessRequests(status) {
  ensureAccessRequestsTable();
  if (status) {
    return allSql(
      'SELECT id, kind, username, contact, comment, status, created_at, resolved_at, resolved_by FROM access_requests WHERE status = ? ORDER BY created_at DESC',
      [String(status)]
    );
  }
  return allSql(
    'SELECT id, kind, username, contact, comment, status, created_at, resolved_at, resolved_by FROM access_requests ORDER BY created_at DESC'
  );
}

function countRecentAccessRequests(ipKey, windowMinutes) {
  ensureAccessRequestsTable();
  // ip stored in comment prefix is fragile; we rate-limit by username+kind in route instead.
  // Keep helper for username-based count:
  return 0;
}

function countPendingByUsername(username, kind, windowMinutes) {
  ensureAccessRequestsTable();
  const u = String(username || '').trim().toLowerCase();
  const k = String(kind || '').trim();
  const mins = Math.max(1, parseInt(windowMinutes, 10) || 60);
  const row = getSql(
    `SELECT COUNT(*) AS c FROM access_requests
     WHERE lower(username) = ? AND kind = ? AND status = 'pending'
       AND created_at >= datetime('now', ?)`,
    [u, k, '-' + mins + ' minutes']
  );
  return row && row.c != null ? Number(row.c) : 0;
}

function resolveAccessRequest(id, status, resolvedBy) {
  ensureAccessRequestsTable();
  const st = status === 'rejected' ? 'rejected' : 'done';
  const existing = getAccessRequestById(id);
  if (!existing) return null;
  runSql(
    'UPDATE access_requests SET status = ?, resolved_at = datetime(\'now\'), resolved_by = ? WHERE id = ?',
    [st, resolvedBy != null ? String(resolvedBy) : null, id]
  );
  saveDb();
  return getAccessRequestById(id);
}

module.exports = {
  ensureAccessRequestsTable,
  createAccessRequest,
  getAccessRequestById,
  listAccessRequests,
  countPendingByUsername,
  resolveAccessRequest,
};
