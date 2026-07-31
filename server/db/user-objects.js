/**
 * Привязка пользователей к объектам (ACL) и inbox уведомлений.
 */
const { runSql, getSql, allSql, saveDb } = require('./core');

const CANONICAL_ROLES = ['admin', 'inseminator', 'service'];

/** Старые роли → новые. */
const ROLE_MIGRATION = {
  admin: 'admin',
  manager: 'admin',
  pro: 'inseminator',
  medium: 'inseminator',
  lite: 'inseminator',
  operator: 'inseminator',
  viewer: 'service',
  inseminator: 'inseminator',
  service: 'service',
};

function normalizeAppRole(role) {
  const r = String(role || '').trim().toLowerCase();
  if (ROLE_MIGRATION[r]) return ROLE_MIGRATION[r];
  if (CANONICAL_ROLES.includes(r)) return r;
  return 'inseminator';
}

function isAdminRole(role) {
  return normalizeAppRole(role) === 'admin';
}

function migrateUserRolesToCanonical() {
  const rows = allSql('SELECT id, role FROM users') || [];
  let changed = 0;
  for (let i = 0; i < rows.length; i++) {
    const id = rows[i].id;
    const oldRole = String(rows[i].role || '');
    const next = normalizeAppRole(oldRole);
    if (next !== oldRole) {
      runSql('UPDATE users SET role = ? WHERE id = ?', [next, id]);
      changed++;
    }
  }
  if (changed) saveDb();
  return changed;
}

function userHasObjectAccess(userId, role, objectId) {
  if (!objectId) return false;
  if (isAdminRole(role)) return true;
  const row = getSql(
    'SELECT 1 AS ok FROM user_objects WHERE user_id = ? AND object_id = ?',
    [String(userId), String(objectId)]
  );
  return !!(row && row.ok);
}

function getObjectIdsForUser(userId, role) {
  if (isAdminRole(role)) {
    return (allSql('SELECT id FROM objects ORDER BY created_at') || []).map((r) => String(r.id));
  }
  return (allSql('SELECT object_id FROM user_objects WHERE user_id = ?', [String(userId)]) || []).map(
    (r) => String(r.object_id)
  );
}

function getObjectsWithMetaForUser(userId, role) {
  const { getObjectsWithMeta } = require('./objects');
  const all = getObjectsWithMeta();
  if (isAdminRole(role)) return all;
  const allowed = new Set(getObjectIdsForUser(userId, role));
  return all.filter((o) => o && allowed.has(String(o.id)));
}

function getUserObjectIds(userId) {
  return (allSql('SELECT object_id FROM user_objects WHERE user_id = ? ORDER BY assigned_at', [
    String(userId),
  ]) || []).map((r) => String(r.object_id));
}

function addInbox(userId, type, payload) {
  const id = 'inbox_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
  runSql(
    'INSERT INTO user_inbox (id, user_id, type, payload_json, created_at) VALUES (?, ?, ?, ?, datetime(\'now\'))',
    [id, String(userId), String(type || 'info'), JSON.stringify(payload != null ? payload : {})]
  );
  return id;
}

/**
 * Полная замена набора объектов пользователя. Новые назначения → inbox object_assigned.
 */
function setUserObjects(userId, objectIds, assignedByUserId) {
  const uid = String(userId);
  const nextIds = Array.isArray(objectIds)
    ? objectIds.map((x) => String(x || '').trim()).filter(Boolean)
    : [];
  const uniq = [];
  const seen = {};
  for (let i = 0; i < nextIds.length; i++) {
    if (seen[nextIds[i]]) continue;
    seen[nextIds[i]] = true;
    uniq.push(nextIds[i]);
  }
  for (let i = 0; i < uniq.length; i++) {
    if (!getSql('SELECT id FROM objects WHERE id = ?', [uniq[i]])) {
      return { ok: false, error: 'Объект не найден: ' + uniq[i] };
    }
  }
  const prev = getUserObjectIds(uid);
  const prevSet = {};
  prev.forEach((id) => {
    prevSet[id] = true;
  });
  const nextSet = {};
  uniq.forEach((id) => {
    nextSet[id] = true;
  });

  runSql('DELETE FROM user_objects WHERE user_id = ?', [uid]);
  for (let i = 0; i < uniq.length; i++) {
    runSql(
      'INSERT INTO user_objects (user_id, object_id, assigned_at, assigned_by) VALUES (?, ?, datetime(\'now\'), ?)',
      [uid, uniq[i], assignedByUserId != null ? String(assignedByUserId) : null]
    );
  }

  const added = [];
  for (let i = 0; i < uniq.length; i++) {
    if (!prevSet[uniq[i]]) added.push(uniq[i]);
  }
  for (let i = 0; i < added.length; i++) {
    const obj = getSql('SELECT id, name FROM objects WHERE id = ?', [added[i]]);
    const name = obj && obj.name != null ? String(obj.name) : added[i];
    addInbox(uid, 'object_assigned', {
      objectId: added[i],
      objectName: name,
      assignedBy: assignedByUserId != null ? String(assignedByUserId) : null,
    });
  }
  saveDb();
  return { ok: true, objectIds: uniq, added };
}

function deleteUserObjectLinksForObject(objectId) {
  runSql('DELETE FROM user_objects WHERE object_id = ?', [String(objectId)]);
}

function deleteUserObjectLinksForUser(userId) {
  runSql('DELETE FROM user_objects WHERE user_id = ?', [String(userId)]);
  runSql('DELETE FROM user_inbox WHERE user_id = ?', [String(userId)]);
}

function getInboxForUser(userId, onlyUnread) {
  const uid = String(userId);
  const sql = onlyUnread
    ? 'SELECT id, user_id, type, payload_json, created_at, read_at FROM user_inbox WHERE user_id = ? AND read_at IS NULL ORDER BY created_at DESC'
    : 'SELECT id, user_id, type, payload_json, created_at, read_at FROM user_inbox WHERE user_id = ? ORDER BY created_at DESC LIMIT 50';
  const rows = allSql(sql, [uid]) || [];
  return rows.map((r) => {
    let payload = {};
    try {
      payload = r.payload_json ? JSON.parse(r.payload_json) : {};
    } catch (_) {
      payload = {};
    }
    return {
      id: String(r.id),
      type: String(r.type || ''),
      payload,
      created_at: r.created_at != null ? String(r.created_at) : null,
      read_at: r.read_at != null ? String(r.read_at) : null,
    };
  });
}

function markInboxRead(userId, inboxId) {
  const row = getSql('SELECT id FROM user_inbox WHERE id = ? AND user_id = ?', [
    String(inboxId),
    String(userId),
  ]);
  if (!row) return false;
  runSql('UPDATE user_inbox SET read_at = datetime(\'now\') WHERE id = ?', [String(inboxId)]);
  saveDb();
  return true;
}

module.exports = {
  CANONICAL_ROLES,
  ROLE_MIGRATION,
  normalizeAppRole,
  isAdminRole,
  migrateUserRolesToCanonical,
  userHasObjectAccess,
  getObjectIdsForUser,
  getObjectsWithMetaForUser,
  getUserObjectIds,
  setUserObjects,
  deleteUserObjectLinksForObject,
  deleteUserObjectLinksForUser,
  addInbox,
  getInboxForUser,
  markInboxRead,
};
