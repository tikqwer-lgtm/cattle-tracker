const { runSql, getSql, saveDb } = require('./core');
const { getObjectById } = require('./objects');

const DEFAULT_STALL_LAYOUT = { yards: {} };

function getStallLayout(objectId) {
  const row = getSql('SELECT stall_layout_json FROM objects WHERE id = ?', [objectId]);
  if (!row || row.stall_layout_json == null || String(row.stall_layout_json).trim() === '') {
    return { ...DEFAULT_STALL_LAYOUT, yards: {} };
  }
  try {
    const parsed = JSON.parse(row.stall_layout_json);
    if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_STALL_LAYOUT, yards: {} };
    if (!parsed.yards || typeof parsed.yards !== 'object') parsed.yards = {};
    return parsed;
  } catch (_) {
    return { ...DEFAULT_STALL_LAYOUT, yards: {} };
  }
}

function putStallLayout(objectId, layout) {
  const obj = getObjectById(objectId);
  if (!obj) return null;
  const yards = layout && layout.yards && typeof layout.yards === 'object' ? layout.yards : {};
  const normalized = { yards: {} };
  for (const k of Object.keys(yards)) {
    const key = String(k).trim();
    if (!key) continue;
    const y = yards[k];
    if (!y || typeof y !== 'object') continue;
    let rows = parseInt(y.rows, 10);
    let cols = parseInt(y.cols, 10);
    if (!Number.isFinite(rows) || rows < 1) rows = 1;
    if (rows > 200) rows = 200;
    if (!Number.isFinite(cols) || cols < 1) cols = 1;
    if (cols > 200) cols = 200;
    normalized.yards[key] = { rows, cols };
  }
  const json = JSON.stringify(normalized);
  runSql('UPDATE objects SET stall_layout_json = ? WHERE id = ?', [json, objectId]);
  saveDb();
  return normalized;
}

module.exports = {
  getStallLayout,
  putStallLayout,
};
