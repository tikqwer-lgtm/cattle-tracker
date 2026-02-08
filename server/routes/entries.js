/**
 * Entries (cattle records) routes: list, get one, create, update, delete.
 */
const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth, requireRole } = require('../auth');

function getObjectId(req) {
  return req.params.objectId || '';
}

function getCattleId(req) {
  return req.params.cattleId || '';
}

router.get('/:objectId/entries', requireAuth, (req, res) => {
  const objectId = getObjectId(req);
  if (!objectId) return res.status(400).json({ error: 'objectId обязателен' });
  const obj = db.getObjectById(objectId);
  if (!obj) return res.status(404).json({ error: 'Объект не найден' });
  const entries = db.getEntries(objectId, req.user.id, req.user.role);
  res.json(entries);
});

router.get('/:objectId/entries/:cattleId', requireAuth, (req, res) => {
  const objectId = getObjectId(req);
  const cattleId = getCattleId(req);
  if (!objectId || !cattleId) return res.status(400).json({ error: 'objectId и cattleId обязательны' });
  const obj = db.getObjectById(objectId);
  if (!obj) return res.status(404).json({ error: 'Объект не найден' });
  const entry = db.getEntry(objectId, cattleId, req.user.id, req.user.role);
  if (!entry) return res.status(404).json({ error: 'Запись не найдена' });
  res.json(entry);
});

router.post('/:objectId/entries', requireAuth, requireRole('admin', 'operator'), (req, res) => {
  const objectId = getObjectId(req);
  if (!objectId) return res.status(400).json({ error: 'objectId обязателен' });
  const obj = db.getObjectById(objectId);
  if (!obj) return res.status(404).json({ error: 'Объект не найден' });
  const entry = req.body || {};
  const cattleId = (entry.cattleId || '').trim();
  if (!cattleId) return res.status(400).json({ error: 'cattleId обязателен' });
  if (db.entryExists(objectId, cattleId)) {
    return res.status(409).json({ error: 'Корова с таким номером уже существует' });
  }
  entry.userId = entry.userId || req.user.id;
  entry.lastModifiedBy = entry.lastModifiedBy || req.user.username;
  db.createEntry(entry, objectId);
  const created = db.getEntry(objectId, cattleId, req.user.id, req.user.role);
  res.status(201).json(created);
});

router.put('/:objectId/entries/:cattleId', requireAuth, requireRole('admin', 'operator'), (req, res) => {
  const objectId = getObjectId(req);
  const cattleId = getCattleId(req);
  if (!objectId || !cattleId) return res.status(400).json({ error: 'objectId и cattleId обязательны' });
  const obj = db.getObjectById(objectId);
  if (!obj) return res.status(404).json({ error: 'Объект не найден' });
  const existing = db.getEntry(objectId, cattleId, req.user.id, req.user.role);
  if (!existing) return res.status(404).json({ error: 'Запись не найдена' });
  const entry = req.body || {};
  entry.cattleId = cattleId;
  entry.userId = entry.userId || req.user.id;
  entry.lastModifiedBy = entry.lastModifiedBy || req.user.username;
  entry.dateAdded = existing.dateAdded;
  entry.synced = existing.synced;
  db.updateEntry(objectId, cattleId, entry);
  const updated = db.getEntry(objectId, cattleId, req.user.id, req.user.role);
  res.json(updated);
});

router.delete('/:objectId/entries/:cattleId', requireAuth, requireRole('admin', 'operator'), (req, res) => {
  const objectId = getObjectId(req);
  const cattleId = getCattleId(req);
  if (!objectId || !cattleId) return res.status(400).json({ error: 'objectId и cattleId обязательны' });
  const existing = db.getEntry(objectId, cattleId, req.user.id, req.user.role);
  if (!existing) return res.status(404).json({ error: 'Запись не найдена' });
  db.deleteEntry(objectId, cattleId);
  res.status(204).send();
});

module.exports = router;
