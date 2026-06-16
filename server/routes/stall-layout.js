/**
 * Сетка стойломест по дворам: GET/PUT JSON на объект (базу).
 */
const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth, requireRole } = require('../auth');

function getObjectId(req) {
  return req.params.objectId || '';
}

router.get('/:objectId/stall-layout', requireAuth, (req, res) => {
  const objectId = getObjectId(req);
  if (!objectId) return res.status(400).json({ error: 'objectId обязателен' });
  const obj = db.getObjectById(objectId);
  if (!obj) return res.status(404).json({ error: 'Объект не найден' });
  res.json(db.getStallLayout(objectId));
});

router.put('/:objectId/stall-layout', requireAuth, requireRole('admin', 'pro', 'medium', 'lite', 'manager', 'operator'), (req, res) => {
  const objectId = getObjectId(req);
  if (!objectId) return res.status(400).json({ error: 'objectId обязателен' });
  const obj = db.getObjectById(objectId);
  if (!obj) return res.status(404).json({ error: 'Объект не найден' });
  const layout = req.body || {};
  const saved = db.putStallLayout(objectId, layout);
  res.json(saved);
});

module.exports = router;
