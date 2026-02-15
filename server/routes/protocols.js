/**
 * Protocols (sync protocols) routes: list, create, update, delete per object.
 */
const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth, requireRole } = require('../auth');

function getObjectId(req) {
  return req.params.objectId || '';
}

function getProtocolId(req) {
  return req.params.protocolId || req.params.id || '';
}

router.get('/:objectId/protocols', requireAuth, (req, res) => {
  const objectId = getObjectId(req);
  if (!objectId) return res.status(400).json({ error: 'objectId обязателен' });
  const obj = db.getObjectById(objectId);
  if (!obj) return res.status(404).json({ error: 'Объект не найден' });
  const list = db.getProtocols(objectId);
  res.json(list);
});

router.post('/:objectId/protocols', requireAuth, requireRole('admin', 'operator'), (req, res) => {
  const objectId = getObjectId(req);
  if (!objectId) return res.status(400).json({ error: 'objectId обязателен' });
  const obj = db.getObjectById(objectId);
  if (!obj) return res.status(404).json({ error: 'Объект не найден' });
  const protocol = req.body || {};
  const created = db.createProtocol(objectId, protocol);
  res.status(201).json(created);
});

router.put('/:objectId/protocols/:protocolId', requireAuth, requireRole('admin', 'operator'), (req, res) => {
  const objectId = getObjectId(req);
  const protocolId = getProtocolId(req);
  if (!objectId || !protocolId) return res.status(400).json({ error: 'objectId и protocolId обязательны' });
  const obj = db.getObjectById(objectId);
  if (!obj) return res.status(404).json({ error: 'Объект не найден' });
  const protocol = req.body || {};
  const updated = db.updateProtocol(objectId, protocolId, protocol);
  if (!updated) return res.status(404).json({ error: 'Протокол не найден' });
  res.json(updated);
});

router.delete('/:objectId/protocols/:protocolId', requireAuth, requireRole('admin', 'operator'), (req, res) => {
  const objectId = getObjectId(req);
  const protocolId = getProtocolId(req);
  if (!objectId || !protocolId) return res.status(400).json({ error: 'objectId и protocolId обязательны' });
  const obj = db.getObjectById(objectId);
  if (!obj) return res.status(404).json({ error: 'Объект не найден' });
  const ok = db.deleteProtocol(objectId, protocolId);
  if (!ok) return res.status(404).json({ error: 'Протокол не найден' });
  res.status(204).send();
});

module.exports = router;
