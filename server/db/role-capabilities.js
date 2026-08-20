/**
 * Хранение переопределений прав ролей (осеменатор / сервис).
 */
const { getSql, runSql, saveDb } = require('./core');
const { mergeRoleCapabilities } = require('../lib/capabilities');

const KV_KEY = 'role_capabilities';

function ensureAppKvTable() {
  runSql(`
    CREATE TABLE IF NOT EXISTS app_kv (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
}

function readStoredRoleCapabilities() {
  ensureAppKvTable();
  const row = getSql('SELECT value FROM app_kv WHERE key = ?', [KV_KEY]);
  if (!row || row.value == null) return {};
  try {
    const parsed = JSON.parse(String(row.value));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (e) {
    return {};
  }
}

function getRoleCapabilities() {
  return mergeRoleCapabilities(readStoredRoleCapabilities());
}

function setRoleCapabilities(incoming) {
  const merged = mergeRoleCapabilities(incoming);
  ensureAppKvTable();
  const existing = getSql('SELECT key FROM app_kv WHERE key = ?', [KV_KEY]);
  const json = JSON.stringify({
    inseminator: merged.inseminator,
    service: merged.service
  });
  if (existing) {
    runSql('UPDATE app_kv SET value = ? WHERE key = ?', [json, KV_KEY]);
  } else {
    runSql('INSERT INTO app_kv (key, value) VALUES (?, ?)', [KV_KEY, json]);
  }
  saveDb();
  return merged;
}

module.exports = {
  ensureAppKvTable,
  getRoleCapabilities,
  setRoleCapabilities,
  readStoredRoleCapabilities
};
