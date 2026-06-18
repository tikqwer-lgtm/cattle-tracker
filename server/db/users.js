const { runSql, getSql, allSql, saveDb } = require('./core');

function createUser(id, username, passwordHash, role, passwordPlain) {
  runSql(
    'INSERT INTO users (id, username, password_hash, role, password_plain) VALUES (?, ?, ?, ?, ?)',
    [id, username, passwordHash, role || 'lite', passwordPlain != null ? String(passwordPlain) : null]
  );
  saveDb();
}

function countUsers() {
  const row = getSql('SELECT COUNT(*) as c FROM users');
  return row && row.c != null ? Number(row.c) : 0;
}

function countAdmins() {
  const row = getSql('SELECT COUNT(*) as c FROM users WHERE role = ?', ['admin']);
  return row && row.c != null ? Number(row.c) : 0;
}

function updateUserRole(targetId, newRole) {
  const allowed = ['admin', 'lite', 'medium', 'pro', 'manager', 'operator', 'viewer'];
  if (!allowed.includes(newRole)) {
    return { ok: false, error: 'Недопустимая роль' };
  }
  const target = findUserById(targetId);
  if (!target) return { ok: false, error: 'Пользователь не найден' };
  if (target.role === newRole) return { ok: true };
  if (target.role === 'admin' && newRole !== 'admin' && newRole !== 'manager' && countAdmins() <= 1) {
    return { ok: false, error: 'Нельзя снять последнего администратора' };
  }
  runSql('UPDATE users SET role = ? WHERE id = ?', [newRole, targetId]);
  saveDb();
  return { ok: true };
}

function updateUserPassword(targetId, passwordHash, passwordPlain) {
  const target = findUserById(targetId);
  if (!target) return { ok: false, error: 'Пользователь не найден' };
  runSql('UPDATE users SET password_hash = ?, password_plain = ? WHERE id = ?', [
    passwordHash,
    passwordPlain != null ? String(passwordPlain) : null,
    targetId
  ]);
  saveDb();
  return { ok: true };
}

function findUserByUsername(username) {
  return getSql('SELECT * FROM users WHERE LOWER(username) = LOWER(?)', [username]);
}

function findUserById(id) {
  return getSql('SELECT id, username, role FROM users WHERE id = ?', [id]);
}

/** Для проверки пароля при удалении базы (только в auth/objects). */
function findUserByIdWithPassword(id) {
  return getSql('SELECT id, username, role, password_hash FROM users WHERE id = ?', [id]);
}

function getAllUsers() {
  return allSql('SELECT id, username, role, created_at, password_plain FROM users ORDER BY created_at');
}

function deleteUser(id) {
  const user = findUserById(id);
  if (!user) return false;
  runSql('DELETE FROM users WHERE id = ?', [id]);
  saveDb();
  return true;
}

/** Смена пароля по логину (без проверки старого). Для восстановления доступа на своём сервере. */
function setPasswordHashForUsername(username, passwordHash) {
  const row = findUserByUsername(username);
  if (!row || !row.id) return false;
  runSql('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, row.id]);
  saveDb();
  return true;
}

module.exports = {
  createUser,
  findUserByUsername,
  findUserById,
  findUserByIdWithPassword,
  getAllUsers,
  countUsers,
  countAdmins,
  updateUserRole,
  updateUserPassword,
  deleteUser,
  setPasswordHashForUsername,
};
