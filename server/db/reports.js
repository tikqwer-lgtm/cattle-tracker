const { runSql, getSql, allSql, saveDb } = require('./core');

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

module.exports = {
  createReport,
  getReportById,
  getReports,
  deleteReport,
};
