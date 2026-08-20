/**
 * Права ролей и права конкретного пользователя.
 */
const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth, requireRole } = require('../auth');

function sendRoles(res) {
  res.json({ ok: true, roles: db.getRoleCapabilities() });
}

router.get('/role-capabilities', requireAuth, (req, res) => {
  sendRoles(res);
});

router.get('/admin/role-capabilities', requireAuth, (req, res) => {
  sendRoles(res);
});

router.put('/admin/role-capabilities', requireAuth, requireRole('admin'), (req, res) => {
  const body = req.body || {};
  const saved = db.setRoleCapabilities({
    inseminator: body.inseminator,
    service: body.service
  });
  res.json({ ok: true, roles: saved });
});

router.get('/admin/users/:id/capabilities', requireAuth, requireRole('admin'), (req, res) => {
  const user = db.findUserById(req.params.id);
  if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
  res.json({
    ok: true,
    overlay: db.getUserCapabilityOverlay(user.id),
    capabilities: db.getEffectiveUserCapabilities(user)
  });
});

router.put('/admin/users/:id/capabilities', requireAuth, requireRole('admin'), (req, res) => {
  const user = db.findUserById(req.params.id);
  if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
  const overlay = db.setUserCapabilityOverlay(user.id, req.body || {});
  res.json({
    ok: true,
    overlay: overlay,
    capabilities: db.getEffectiveUserCapabilities(user)
  });
});

module.exports = router;
