/**
 * Карточка хозяйства: GET/PUT снимка по objectId.
 */
const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth, requireRole } = require('../auth');

router.get('/:objectId/farm-card', requireAuth, (req, res) => {
  const objectId = String(req.params.objectId || '').trim();
  if (!objectId) return res.status(400).json({ error: 'objectId обязателен' });
  if (!db.getObjectById(objectId)) return res.status(404).json({ error: 'Объект не найден' });
  const bundle = db.getFarmCardBundle(objectId);
  res.json(bundle);
});

router.put('/:objectId/farm-card', requireAuth, requireRole('admin', 'pro', 'manager'), (req, res) => {
  const objectId = String(req.params.objectId || '').trim();
  if (!objectId) return res.status(400).json({ error: 'objectId обязателен' });
  if (!db.getObjectById(objectId)) return res.status(404).json({ error: 'Объект не найден' });
  const result = db.replaceFarmCardBundle(objectId, req.body);
  if (!result.ok) {
    return res.status(400).json({ error: result.error || 'Ошибка сохранения' });
  }
  res.json(db.getFarmCardBundle(objectId));
});

module.exports = router;
