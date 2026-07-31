/**
 * Admin routes: users, object assignments, reports; me/inbox.
 */
const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const db = require('../db');
const { requireAuth, requireRole } = require('../auth');

const ALLOWED_ROLES = ['admin', 'inseminator', 'service'];

router.get('/admin/users', requireAuth, requireRole('admin'), (req, res) => {
  const users = db.getAllUsers();
  const withObjects = (users || []).map((u) => {
    const objectIds = u.role === 'admin' ? [] : db.getUserObjectIds(u.id);
    return Object.assign({}, u, { objectIds });
  });
  res.json({ ok: true, users: withObjects });
});

router.post('/admin/users', requireAuth, requireRole('admin'), (req, res) => {
  const { username, password, role } = req.body || {};
  const u = (username || '').trim();
  const p = password != null ? String(password) : '';
  if (!u || !p) {
    return res.status(400).json({ error: 'Введите логин и пароль' });
  }
  if (db.findUserByUsername(u)) {
    return res.status(400).json({ error: 'Пользователь с таким логином уже есть' });
  }
  let assignRole = db.normalizeAppRole(role || 'inseminator');
  if (!ALLOWED_ROLES.includes(assignRole)) assignRole = 'inseminator';
  const id = 'u_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
  const passwordHash = bcrypt.hashSync(p, 10);
  db.createUser(id, u, passwordHash, assignRole, p);
  res.status(201).json({
    ok: true,
    user: { id, username: u, role: assignRole, created_at: null, password_plain: p, objectIds: [] }
  });
});

router.delete('/admin/users/:id', requireAuth, requireRole('admin'), (req, res) => {
  const targetId = req.params.id;
  if (req.user.id === targetId) {
    return res.status(400).json({ error: 'Нельзя удалить самого себя' });
  }
  if (!db.deleteUser(targetId)) {
    return res.status(404).json({ error: 'Пользователь не найден' });
  }
  res.json({ ok: true });
});

router.patch('/admin/users/:id', requireAuth, requireRole('admin'), (req, res) => {
  const targetId = req.params.id;
  const body = req.body || {};
  const hasRole = body.role != null;
  const hasPassword = body.password != null && String(body.password).length > 0;
  if (!hasRole && !hasPassword) {
    return res.status(400).json({ error: 'Укажите role и/или password' });
  }
  if (hasRole) {
    const newRole = String(body.role).trim();
    const result = db.updateUserRole(targetId, newRole);
    if (!result.ok) {
      return res.status(400).json({ error: result.error || 'Не удалось обновить роль' });
    }
  }
  if (hasPassword) {
    const p = String(body.password);
    const passwordHash = bcrypt.hashSync(p, 10);
    const result = db.updateUserPassword(targetId, passwordHash, p);
    if (!result.ok) {
      return res.status(400).json({ error: result.error || 'Не удалось обновить пароль' });
    }
  }
  res.json({ ok: true });
});

router.get('/admin/users/:id/objects', requireAuth, requireRole('admin'), (req, res) => {
  const target = db.findUserById(req.params.id);
  if (!target) return res.status(404).json({ error: 'Пользователь не найден' });
  const objectIds = db.isAdminRole(target.role) ? db.getObjectIdsForUser(target.id, 'admin') : db.getUserObjectIds(target.id);
  res.json({ ok: true, userId: target.id, objectIds });
});

router.put('/admin/users/:id/objects', requireAuth, requireRole('admin'), (req, res) => {
  const target = db.findUserById(req.params.id);
  if (!target) return res.status(404).json({ error: 'Пользователь не найден' });
  if (db.isAdminRole(target.role)) {
    return res.status(400).json({ error: 'Администратору не нужно назначать объекты — доступ ко всем' });
  }
  const objectIds = req.body && Array.isArray(req.body.objectIds) ? req.body.objectIds : null;
  if (!objectIds) {
    return res.status(400).json({ error: 'Укажите objectIds (массив)' });
  }
  const result = db.setUserObjects(target.id, objectIds, req.user.id);
  if (!result.ok) {
    return res.status(400).json({ error: result.error || 'Не удалось сохранить' });
  }
  res.json({ ok: true, userId: target.id, objectIds: result.objectIds, added: result.added || [] });
});

router.get('/me/inbox', requireAuth, (req, res) => {
  const unreadOnly = String(req.query.unread || '') === '1' || String(req.query.unread || '') === 'true';
  const items = db.getInboxForUser(req.user.id, unreadOnly);
  res.json({ ok: true, items });
});

router.post('/me/inbox/:id/read', requireAuth, (req, res) => {
  if (!db.markInboxRead(req.user.id, req.params.id)) {
    return res.status(404).json({ error: 'Сообщение не найдено' });
  }
  res.json({ ok: true });
});

router.post('/reports', requireAuth, (req, res) => {
  const { message, payload } = req.body || {};
  const text = (message != null ? String(message) : '').trim();
  if (!text) {
    return res.status(400).json({ error: 'Введите сообщение' });
  }
  const payloadJson = payload != null ? JSON.stringify(payload) : null;
  const report = db.createReport(req.user.id, req.user.username, text, payloadJson);
  res.status(201).json({ ok: true, report });
});

router.get('/reports', requireAuth, requireRole('admin'), (req, res) => {
  const reports = db.getReports();
  res.json({ ok: true, reports });
});

router.delete('/reports/:id', requireAuth, requireRole('admin'), (req, res) => {
  if (!db.deleteReport(req.params.id)) {
    return res.status(404).json({ error: 'Отчёт не найден' });
  }
  res.json({ ok: true });
});

module.exports = router;
