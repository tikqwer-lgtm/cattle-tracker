/**
 * Хранение переопределений прав ролей (осеменатор / сервис).
 */
const { getSql, runSql, saveDb } = require('./core');
const { mergeRoleCapabilities, mergeUserCapabilities, pickEditable, normalizeRole } = require('../lib/capabilities');

const KV_KEY = 'role_capabilities';
const USER_KV_KEY = 'user_capabilities';

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

function readStoredUserCapabilitiesMap() {
  ensureAppKvTable();
  const row = getSql('SELECT value FROM app_kv WHERE key = ?', [USER_KV_KEY]);
  if (!row || row.value == null) return {};
  try {
    const parsed = JSON.parse(String(row.value));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (e) {
    return {};
  }
}

function writeStoredUserCapabilitiesMap(map) {
  ensureAppKvTable();
  const json = JSON.stringify(map && typeof map === 'object' ? map : {});
  const existing = getSql('SELECT key FROM app_kv WHERE key = ?', [USER_KV_KEY]);
  if (existing) {
    runSql('UPDATE app_kv SET value = ? WHERE key = ?', [json, USER_KV_KEY]);
  } else {
    runSql('INSERT INTO app_kv (key, value) VALUES (?, ?)', [USER_KV_KEY, json]);
  }
  saveDb();
}

function getUserCapabilityOverlay(userId) {
  const id = String(userId || '').trim();
  if (!id) return {};
  const map = readStoredUserCapabilitiesMap();
  const overlay = map[id];
  return overlay && typeof overlay === 'object' ? pickEditable(overlay) : {};
}

function setUserCapabilityOverlay(userId, incoming) {
  const id = String(userId || '').trim();
  if (!id) return {};
  const overlay = pickEditable(incoming);
  const map = readStoredUserCapabilitiesMap();
  map[id] = overlay;
  writeStoredUserCapabilitiesMap(map);
  return overlay;
}

function getEffectiveUserCapabilities(user) {
  const roles = getRoleCapabilities();
  const role = normalizeRole(user && user.role);
  if (role === 'admin') {
    const out = Object.assign({}, roles.inseminator);
    Object.keys(out).forEach(function (k) { out[k] = true; });
    out.adminUsersRoles = true;
    out.adminReleaseControls = true;
    out.createDeleteObjects = true;
    return out;
  }
  const roleCaps = roles[role] || roles.inseminator;
  return mergeUserCapabilities(roleCaps, getUserCapabilityOverlay(user && user.id));
}

module.exports = {
  ensureAppKvTable,
  getRoleCapabilities,
  setRoleCapabilities,
  readStoredRoleCapabilities,
  getUserCapabilityOverlay,
  setUserCapabilityOverlay,
  getEffectiveUserCapabilities
};
