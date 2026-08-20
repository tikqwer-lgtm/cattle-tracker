/**
 * Карточка хозяйства: GET/PUT снимка по objectId.
 */
const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth, requireAnyCapability, requireObjectAccess } = require('../auth');
const capLib = require('../lib/capabilities');

router.get('/:objectId/farm-card', requireAuth, requireObjectAccess('objectId'), (req, res) => {
  const objectId = String(req.params.objectId || '').trim();
  const bundle = db.getFarmCardBundle(objectId);
  res.json(bundle);
});

router.put(
  '/:objectId/farm-card',
  requireAuth,
  requireObjectAccess('objectId'),
  requireAnyCapability('farmCardSettings', 'farmCardEventsWrite'),
  (req, res) => {
    const objectId = String(req.params.objectId || '').trim();
    const userId = req.user && req.user.id != null ? String(req.user.id) : null;
    const matrix = db.getRoleCapabilities ? db.getRoleCapabilities() : null;
    const overlay = db.getUserCapabilityOverlay ? db.getUserCapabilityOverlay(req.user && req.user.id) : null;
    const eventsOnly = !capLib.userHasCapability(req.user, 'farmCardSettings', matrix, overlay);
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
