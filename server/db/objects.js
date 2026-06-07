const { runSql, getSql, allSql, saveDb } = require('./core');

function getObjects() {
  return allSql('SELECT id, name, created_at FROM objects ORDER BY created_at');
}

function getRowVal(row, key) {
  if (row[key] !== undefined && row[key] !== null) return row[key];
  const lower = key.toLowerCase();
  for (const k of Object.keys(row)) {
    if (k.toLowerCase() === lower) return row[k];
  }
  return null;
}

/**
 * Returns objects with entries_count, last_updated_at, last_modified_by, created_by, created_by_username.
 */
function getObjectsWithMeta() {
  const sql = `
    SELECT o.id, o.name, o.created_at, o.created_by,
      (SELECT COUNT(*) FROM entries WHERE object_id = o.id) as entries_count,
      (SELECT updated_at FROM entries WHERE object_id = o.id ORDER BY updated_at DESC LIMIT 1) as last_updated_at,
      (SELECT last_modified_by FROM entries WHERE object_id = o.id ORDER BY updated_at DESC LIMIT 1) as last_modified_by,
      u.username as created_by_username
    FROM objects o
    LEFT JOIN users u ON u.id = o.created_by
    ORDER BY o.created_at
  `;
  return allSql(sql).map(row => {
    const id = getRowVal(row, 'id');
    const name = getRowVal(row, 'name');
    const entriesCount = getRowVal(row, 'entries_count');
    const lastUpdatedAt = getRowVal(row, 'last_updated_at');
    const lastModifiedBy = getRowVal(row, 'last_modified_by');
    const createdAt = getRowVal(row, 'created_at');
    const createdBy = getRowVal(row, 'created_by');
    const createdByUsername = getRowVal(row, 'created_by_username');
    return {
      id: id != null ? String(id) : '',
      name: name != null ? String(name) : '',
      created_at: createdAt != null ? String(createdAt) : null,
      created_by: createdBy != null ? String(createdBy) : null,
      created_by_username: createdByUsername != null ? String(createdByUsername) : null,
      entries_count: Number(entriesCount != null ? entriesCount : 0),
      last_updated_at: lastUpdatedAt != null ? String(lastUpdatedAt) : null,
      last_modified_by: lastModifiedBy != null ? String(lastModifiedBy) : null
    };
  });
}

function getObjectById(id) {
  return getSql('SELECT id, name FROM objects WHERE id = ?', [id]);
}

/** id, name, created_by — для проверки уникальности имени у создателя. */
function getObjectWithCreatedBy(id) {
  return getSql('SELECT id, name, created_by FROM objects WHERE id = ?', [id]);
}

/**
 * Другое id с тем же нормализованным именем у того же создателя (created_by).
 * Если createdByUserId null — проверка только среди объектов с created_by IS NULL (наследие).
 * excludeObjectId — не считать конфликтом сам объект (переименование).
 */
function findObjectIdWithDuplicateNameForCreator(name, createdByUserId, excludeObjectId) {
  const t = String(name || '').trim();
  if (!t) return null;
  const ex = excludeObjectId ? String(excludeObjectId) : '';
  const creatorStr = createdByUserId != null && createdByUserId !== '' ? String(createdByUserId) : null;
  let sql;
  let params;
  if (creatorStr) {
    sql = 'SELECT id FROM objects WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) AND created_by = ?';
    params = [t, creatorStr];
  } else {
    sql = 'SELECT id FROM objects WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) AND created_by IS NULL';
    params = [t];
  }
  if (ex) {
    sql += ' AND id != ?';
    params.push(ex);
  }
  const row = getSql(sql, params);
  return row && row.id != null ? String(row.id) : null;
}

function createObject(id, name, createdByUserId) {
  runSql('INSERT INTO objects (id, name, created_by) VALUES (?, ?, ?)', [id, name, createdByUserId || null]);
  saveDb();
}

function updateObject(id, name) {
  const obj = getObjectById(id);
  if (!obj) return false;
  runSql('UPDATE objects SET name = ? WHERE id = ?', [(name || obj.name).trim() || obj.name, id]);
  saveDb();
  return true;
}

function deleteObject(id) {
  const obj = getObjectById(id);
  if (!obj) return false;
  runSql('DELETE FROM entries WHERE object_id = ?', [id]);
  runSql('DELETE FROM protocols WHERE object_id = ?', [id]);
  runSql('DELETE FROM objects WHERE id = ?', [id]);
  saveDb();
  return true;
}

module.exports = {
  getObjects,
  getObjectsWithMeta,
  getObjectById,
  getObjectWithCreatedBy,
  findObjectIdWithDuplicateNameForCreator,
  createObject,
  updateObject,
  deleteObject,
};
