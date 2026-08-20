/**
 * Сетка стойломест по дворам: GET/PUT JSON на объект (базу).
 */
const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth, requireAnyCapability, requireObjectAccess } = require('../auth');

function getObjectId(req) {
  return req.params.objectId || '';
}

router.get('/:objectId/stall-layout', requireAuth, requireObjectAccess('objectId'), (req, res) => {
  const objectId = getObjectId(req);
  res.json(db.getStallLayout(objectId));
});

router.put(
  '/:objectId/stall-layout',
  requireAuth,
  requireObjectAccess('objectId'),
  requireAnyCapability('inventory'),
  (req, res) => {
    const objectId = getObjectId(req);
    const layout = req.body || {};
    const saved = db.putStallLayout(objectId, layout);
    res.json(saved);
  }
);

module.exports = router;
