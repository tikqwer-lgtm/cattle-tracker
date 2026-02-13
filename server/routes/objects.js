/**
 * Objects (bases) routes: list, create.
 */
const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth, requireRole } = require('../auth');

router.get('/', requireAuth, (req, res) => {
  const list = db.getObjects();
  res.json(list.map(o => ({ id: o.id, name: o.name, created_at: o.created_at || null })));
});

router.post('/', requireAuth, requireRole('admin', 'operator'), (req, res) => {
  const name = (req.body && req.body.name || 'Новая база').trim() || 'Новая база';
  const id = 'obj_' + Date.now();
  db.createObject(id, name);
  res.status(201).json({ id, name });
});

module.exports = router;
