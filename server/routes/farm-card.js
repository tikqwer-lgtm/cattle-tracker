/**
 * Карточка хозяйства: GET/PUT снимка по objectId.
 */
const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth, requireRole, requireObjectAccess } = require('../auth');

router.get('/:objectId/farm-card', requireAuth, requireObjectAccess('objectId'), (req, res) => {
  const objectId = String(req.params.objectId || '').trim();
  const bundle = db.getFarmCardBundle(objectId);
  res.json(bundle);
});

router.put(
  '/:objectId/farm-card',
  requireAuth,
  requireObjectAccess('objectId'),
  requireRole('admin', 'service'),
  (req, res) => {
    const objectId = String(req.params.objectId || '').trim();
    const userId = req.user && req.user.id != null ? String(req.user.id) : null;
    const role = db.normalizeAppRole ? db.normalizeAppRole(req.user.role) : req.user.role;
    const eventsOnly = role === 'service';
    const result = db.replaceFarmCardBundle(objectId, req.body, {
      userId: userId,
      eventsOnly: eventsOnly,
      enqueueBitrix: !eventsOnly
    });
    if (!result.ok) {
      return res.status(400).json({ error: result.error || 'Ошибка сохранения' });
    }
    const bundle = db.getFarmCardBundle(objectId);
    if (result.pendingCreated && result.pendingCreated.length) {
      bundle._bitrixPendingCreated = result.pendingCreated.length;
    }
    res.json(bundle);
  }
);

module.exports = router;
