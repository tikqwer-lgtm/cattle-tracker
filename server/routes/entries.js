/**
 * Entries (cattle records) routes: list, get one, create, update, delete.
 */
const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth, requireRole, requireObjectAccess } = require('../auth');

function getObjectId(req) {
  return req.params.objectId || '';
}

function getCattleId(req) {
  return req.params.cattleId || '';
}

router.get('/:objectId/entries', requireAuth, requireObjectAccess('objectId'), (req, res) => {
  const objectId = getObjectId(req);
  const entries = db.getEntries(objectId, req.user.id, req.user.role);
  res.json(entries);
});

router.get('/:objectId/entries/:cattleId', requireAuth, requireObjectAccess('objectId'), (req, res) => {
  const objectId = getObjectId(req);
  const cattleId = getCattleId(req);
  if (!cattleId) return res.status(400).json({ error: 'cattleId обязателен' });
  const entry = db.getEntry(objectId, cattleId, req.user.id, req.user.role);
  if (!entry) return res.status(404).json({ error: 'Запись не найдена' });
  res.json(entry);
});

router.post(
  '/:objectId/entries',
  requireAuth,
  requireObjectAccess('objectId'),
  requireRole('admin', 'inseminator'),
  (req, res) => {
    const objectId = getObjectId(req);
    const entry = req.body || {};
    const cattleId = String(entry.cattleId != null ? entry.cattleId : '').trim();
    if (!cattleId) return res.status(400).json({ error: 'cattleId обязателен' });
    if (db.entryExists(objectId, cattleId)) {
      return res.status(409).json({ error: 'Корова с таким номером уже существует' });
    }
    entry.userId = entry.userId || req.user.id;
    entry.lastModifiedBy = entry.lastModifiedBy || req.user.username;
    db.createEntry(entry, objectId);
    const created = db.getEntry(objectId, cattleId, req.user.id, req.user.role);
    res.status(201).json(created);
  }
);

router.put(
  '/:objectId/entries/:cattleId',
  requireAuth,
  requireObjectAccess('objectId'),
  requireRole('admin', 'inseminator'),
  (req, res) => {
    const objectId = getObjectId(req);
    const cattleId = getCattleId(req);
    if (!cattleId) return res.status(400).json({ error: 'cattleId обязателен' });
    const existing = db.getEntry(objectId, cattleId, req.user.id, req.user.role);
    if (!existing) return res.status(404).json({ error: 'Запись не найдена' });
    const entry = req.body || {};
    entry.cattleId = cattleId;
    entry.userId = entry.userId || req.user.id;
    entry.lastModifiedBy = entry.lastModifiedBy || req.user.username;
    entry.dateAdded = existing.dateAdded;
    if (entry.synced === undefined) entry.synced = existing.synced;
    db.updateEntry(objectId, cattleId, entry);
    const updated = db.getEntry(objectId, cattleId, req.user.id, req.user.role);
    res.json(updated);
  }
);

router.delete(
  '/:objectId/entries/:cattleId',
  requireAuth,
  requireObjectAccess('objectId'),
  requireRole('admin', 'inseminator'),
  (req, res) => {
    const objectId = getObjectId(req);
    const cattleId = getCattleId(req);
    if (!cattleId) return res.status(400).json({ error: 'cattleId обязателен' });
    const existing = db.getEntry(objectId, cattleId, req.user.id, req.user.role);
    if (!existing) return res.status(404).json({ error: 'Запись не найдена' });
    db.deleteEntry(objectId, cattleId);
    res.status(204).send();
  }
);

module.exports = router;
