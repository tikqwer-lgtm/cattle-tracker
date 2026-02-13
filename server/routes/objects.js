/**
 * Objects (bases) routes: list (with meta), create, update, delete.
 */
const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth, requireRole } = require('../auth');

router.get('/', requireAuth, (req, res) => {
  const list = db.getObjectsWithMeta();
  res.json(list);
});

router.post('/', requireAuth, requireRole('admin', 'operator'), (req, res) => {
  const name = (req.body && req.body.name || 'Новая база').trim() || 'Новая база';
  const id = 'obj_' + Date.now();
  db.createObject(id, name);
  res.status(201).json({ id, name });
});

router.put('/:id', requireAuth, requireRole('admin', 'operator'), (req, res) => {
  const id = (req.params && req.params.id) || '';
  if (!id) return res.status(400).json({ error: 'id обязателен' });
  const name = (req.body && req.body.name != null) ? String(req.body.name).trim() : '';
  if (!name) return res.status(400).json({ error: 'name обязателен' });
  const ok = db.updateObject(id, name);
  if (!ok) return res.status(404).json({ error: 'Объект не найден' });
  const obj = db.getObjectById(id);
  res.json({ id: obj.id, name: obj.name });
});

router.delete('/:id', requireAuth, requireRole('admin', 'operator'), (req, res) => {
  const id = (req.params && req.params.id) || '';
  if (!id) return res.status(400).json({ error: 'id обязателен' });
  const ok = db.deleteObject(id);
  if (!ok) return res.status(404).json({ error: 'Объект не найден' });
  res.status(204).send();
});

module.exports = router;
