/**
 * Protocols (sync protocols) routes: list, create, update, delete per object.
 */
const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth, requireRole, requireObjectAccess } = require('../auth');

function getObjectId(req) {
  return req.params.objectId || '';
}

function getProtocolId(req) {
  return req.params.protocolId || req.params.id || '';
}

router.get('/:objectId/protocols', requireAuth, requireObjectAccess('objectId'), (req, res) => {
  const objectId = getObjectId(req);
  const list = db.getProtocols(objectId);
  res.json(list);
});

router.post(
  '/:objectId/protocols',
  requireAuth,
  requireObjectAccess('objectId'),
  requireRole('admin', 'inseminator'),
  (req, res) => {
    const objectId = getObjectId(req);
    const protocol = req.body || {};
    const created = db.createProtocol(objectId, protocol);
    res.status(201).json(created);
  }
);

router.put(
  '/:objectId/protocols/:protocolId',
  requireAuth,
  requireObjectAccess('objectId'),
  requireRole('admin', 'inseminator'),
  (req, res) => {
    const objectId = getObjectId(req);
    const protocolId = getProtocolId(req);
    if (!protocolId) return res.status(400).json({ error: 'protocolId обязателен' });
    const protocol = req.body || {};
    const updated = db.updateProtocol(objectId, protocolId, protocol);
    if (!updated) return res.status(404).json({ error: 'Протокол не найден' });
    res.json(updated);
  }
);

router.delete(
  '/:objectId/protocols/:protocolId',
  requireAuth,
  requireObjectAccess('objectId'),
  requireRole('admin', 'inseminator'),
  (req, res) => {
    const objectId = getObjectId(req);
    const protocolId = getProtocolId(req);
    if (!protocolId) return res.status(400).json({ error: 'protocolId обязателен' });
    const ok = db.deleteProtocol(objectId, protocolId);
    if (!ok) return res.status(404).json({ error: 'Протокол не найден' });
    res.status(204).send();
  }
);

module.exports = router;
