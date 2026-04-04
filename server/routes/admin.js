/**
 * Admin routes: list/delete users (admin only), reports (submit + list/delete for admin).
 * APK на сервер — см. routes/admin-mobile-apk.js (монтирование /api/admin).
 */
const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth, requireRole } = require('../auth');

// --- Users (admin only) ---
router.get('/admin/users', requireAuth, requireRole('admin'), (req, res) => {
  const users = db.getAllUsers();
  res.json({ ok: true, users });
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
  const newRole = req.body && req.body.role != null ? String(req.body.role).trim() : '';
  const result = db.updateUserRole(targetId, newRole);
  if (!result.ok) {
    return res.status(400).json({ error: result.error || 'Не удалось обновить роль' });
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
