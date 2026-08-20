/**
 * Права ролей: GET для всех авторизованных, PUT только admin.
 */
const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth, requireRole } = require('../auth');

router.get('/role-capabilities', requireAuth, (req, res) => {
  res.json({ ok: true, roles: db.getRoleCapabilities() });
});

router.put('/admin/role-capabilities', requireAuth, requireRole('admin'), (req, res) => {
  const body = req.body || {};
  const saved = db.setRoleCapabilities({
    inseminator: body.inseminator,
    service: body.service
  });
  res.json({ ok: true, roles: saved });
});

module.exports = router;
