/**
 * Admin routes: list/delete users (admin only), reports (submit + list/delete for admin).
 * APK на сервер — см. routes/admin-mobile-apk.js (монтирование /api/admin).
 */
const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const db = require('../db');
const { requireAuth, requireRole } = require('../auth');

const ALLOWED_ROLES = ['admin', 'lite', 'medium', 'pro', 'manager', 'operator', 'viewer'];

// --- Users (admin only) ---
router.get('/admin/users', requireAuth, requireRole('admin'), (req, res) => {
  const users = db.getAllUsers();
  res.json({ ok: true, users });
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
  let assignRole = String(role || 'lite').trim();
  if (!ALLOWED_ROLES.includes(assignRole)) assignRole = 'lite';
  const id = 'u_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
  const passwordHash = bcrypt.hashSync(p, 10);
  db.createUser(id, u, passwordHash, assignRole, p);
  res.status(201).json({
    ok: true,
    user: { id, username: u, role: assignRole, created_at: null, password_plain: p }
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

// --- Reports: any authenticated user can submit ---
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

// --- Reports: admin only ---
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
