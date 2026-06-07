const { runSql, getSql, allSql, saveDb } = require('./core');

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
  getProtocols,
  getProtocolById,
  createProtocol,
  updateProtocol,
  deleteProtocol,
};
