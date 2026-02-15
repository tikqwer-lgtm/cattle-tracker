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

// Export object with entries and protocols (for transfer to another PC / backup)
router.get('/:id/export', requireAuth, (req, res) => {
  const objectId = req.params.id || '';
  if (!objectId) return res.status(400).json({ error: 'id обязателен' });
  const obj = db.getObjectById(objectId);
  if (!obj) return res.status(404).json({ error: 'Объект не найден' });
  const entries = db.getEntries(objectId, req.user.id, req.user.role);
  const protocols = db.getProtocols(objectId);
  res.json({
    object: { id: obj.id, name: obj.name },
    entries,
    protocols
  });
});

// Import object from export package (creates new object with entries and protocols)
router.post('/import', requireAuth, requireRole('admin', 'operator'), (req, res) => {
  const body = req.body || {};
  const name = (body.name || '').trim() || 'Импортированная база';
  const entries = Array.isArray(body.entries) ? body.entries : [];
  const protocols = Array.isArray(body.protocols) ? body.protocols : [];
  const id = 'obj_' + Date.now();
  db.createObject(id, name);
  for (const entry of entries) {
    try {
      db.createEntry(entry, id);
    } catch (e) {
      console.warn('Import entry skip:', e.message);
    }
  }
  for (const protocol of protocols) {
    try {
      db.createProtocol(id, protocol);
    } catch (e) {
      console.warn('Import protocol skip:', e.message);
    }
  }
  res.status(201).json({ id, name });
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
  if (id === 'default') return res.status(400).json({ error: 'Нельзя удалить базовый объект default' });
  db.deleteObject(id);
  // 204 в любом случае: объект удалён или его не было на сервере (создан только локально / уже удалён)
  res.status(204).send();
});

module.exports = router;
