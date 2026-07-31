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
  requireRole('admin'),
  (req, res) => {
    const objectId = String(req.params.objectId || '').trim();
    const result = db.replaceFarmCardBundle(objectId, req.body);
    if (!result.ok) {
      return res.status(400).json({ error: result.error || 'Ошибка сохранения' });
    }
    res.json(db.getFarmCardBundle(objectId));
  }
);

module.exports = router;
