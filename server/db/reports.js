const { runSql, getSql, allSql, saveDb } = require('./core');
const { payloadAfterAccept, payloadAfterRevision, reportKind } = require('../lib/report-payload');
const { addInbox } = require('./user-objects');

const REPORT_STATUSES = ['new', 'done', 'skipped'];

function mapReportRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    username: row.username,
    message: row.message || '',
    payload: row.payload_json,
    status: row.status || 'new',
    createdAt: row.created_at
  };
}

function createReport(userId, username, message, payloadJson) {
  const id = 'r_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
  runSql(
    'INSERT INTO reports (id, user_id, username, message, payload_json, status, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime(\'now\'))',
    [id, userId, username, message || '', payloadJson != null ? payloadJson : null, 'new']
  );
  saveDb();
  return getReportById(id);
}

function getReportById(id) {
  const row = getSql(
    'SELECT id, user_id, username, message, payload_json, status, created_at FROM reports WHERE id = ?',
    [id]
  );
  return mapReportRow(row);
}

function getReports() {
  const rows = allSql(
    'SELECT id, user_id, username, message, payload_json, status, created_at FROM reports ORDER BY created_at DESC'
  );
  return (rows || []).map(mapReportRow);
}

function updateReportStatus(id, status) {
  const st = String(status || '').trim().toLowerCase();
  if (REPORT_STATUSES.indexOf(st) === -1) {
    return { ok: false, error: 'status: new, done или skipped' };
  }
  const report = getReportById(id);
  if (!report) return { ok: false, error: 'Отчёт не найден' };
  runSql('UPDATE reports SET status = ? WHERE id = ?', [st, id]);
  saveDb();
  return { ok: true, report: getReportById(id) };
}

function acceptReportForAgent(id) {
  const report = getReportById(id);
  if (!report) return { ok: false, error: 'Отчёт не найден' };
  if (reportKind(report.payload) === 'improvement' && String(report.status || 'new') === 'new') {
    return { ok: true, report: report };
  }
  const pl = payloadAfterAccept(report.payload);
  runSql('UPDATE reports SET payload_json = ?, status = ? WHERE id = ?', [
    JSON.stringify(pl),
    'new',
    id
  ]);
  saveDb();
  return { ok: true, report: getReportById(id) };
}

function returnReportForRevision(id) {
  const report = getReportById(id);
  if (!report) return { ok: false, error: 'Отчёт не найден' };
  const pl = payloadAfterRevision(report.payload);
  runSql('UPDATE reports SET payload_json = ?, status = ? WHERE id = ?', [
    JSON.stringify(pl),
    'skipped',
    id
  ]);
  saveDb();
  if (report.userId) {
    addInbox(report.userId, 'report_revision', {
      message: report.message || '',
      reportId: id
    });
    saveDb();
  }
  return { ok: true, report: getReportById(id) };
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
  updateReportStatus,
  acceptReportForAgent,
  returnReportForRevision,
  deleteReport,
};
