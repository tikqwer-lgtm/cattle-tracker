/**
 * Objects (bases) routes: list (with meta), create, update, delete (with password).
 */
const express = require('express');
const bcrypt = require('bcryptjs');
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
router.post('/import', requireAuth, requireRole('admin', 'manager'), (req, res) => {
  const body = req.body || {};
  const name = (body.name || '').trim() || 'Импортированная база';
  const entries = Array.isArray(body.entries) ? body.entries : [];
  const protocols = Array.isArray(body.protocols) ? body.protocols : [];
  const dupImport = db.findObjectIdWithDuplicateNameForCreator(name, req.user.id, null);
  if (dupImport) {
    return res.status(409).json({ error: 'У вас уже есть база с таким названием' });
  }
  const id = 'obj_' + Date.now();
  db.createObject(id, name, req.user.id);
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

router.post('/', requireAuth, requireRole('admin', 'manager', 'operator', 'viewer'), (req, res) => {
  const name = (req.body && req.body.name || 'Новая база').trim() || 'Новая база';
  const copyFromId = (req.body && req.body.copyFromObjectId != null)
    ? String(req.body.copyFromObjectId).trim()
    : '';
  const dup = db.findObjectIdWithDuplicateNameForCreator(name, req.user.id, null);
  if (dup) {
    return res.status(409).json({ error: 'У вас уже есть база с таким названием' });
  }
  const id = 'obj_' + Date.now();
  db.createObject(id, name, req.user.id);
  if (!copyFromId) {
    return res.status(201).json({ id, name, entriesCopied: 0 });
  }
  const src = db.getObjectById(copyFromId);
  if (!src) {
    db.deleteObject(id);
    return res.status(404).json({ error: 'Исходная база не найдена' });
  }
  const entriesCopied = db.cloneEntriesToObject(copyFromId, id, req.user.id, req.user.username);
  res.status(201).json({ id, name, entriesCopied });
});

router.put('/:id', requireAuth, requireRole('admin', 'manager', 'operator'), (req, res) => {
  const id = (req.params && req.params.id) || '';
  if (!id) return res.status(400).json({ error: 'id обязателен' });
  const name = (req.body && req.body.name != null) ? String(req.body.name).trim() : '';
  if (!name) return res.status(400).json({ error: 'name обязателен' });
  const existingRow = db.getObjectWithCreatedBy(id);
  if (!existingRow) return res.status(404).json({ error: 'Объект не найден' });
  const creatorId = existingRow.created_by != null && existingRow.created_by !== ''
    ? String(existingRow.created_by)
    : null;
  const dupRename = db.findObjectIdWithDuplicateNameForCreator(name, creatorId, id);
  if (dupRename) {
    return res.status(409).json({ error: 'У вас уже есть база с таким названием' });
  }
  const ok = db.updateObject(id, name);
  if (!ok) return res.status(404).json({ error: 'Объект не найден' });
  const obj = db.getObjectById(id);
  res.json({ id: obj.id, name: obj.name });
});

// Удаление базы: создатель или администратор/менеджер (с паролем своей учётной записи)
router.delete('/:id', requireAuth, (req, res) => {
  const id = (req.params && req.params.id) || '';
  if (!id) return res.status(400).json({ error: 'id обязателен' });
  if (id === 'default') return res.status(400).json({ error: 'Нельзя удалить базовый объект default' });
  const obj = db.getObjectById(id);
  if (!obj) return res.status(404).json({ error: 'Объект не найден' });
  const list = db.getObjectsWithMeta();
  const meta = list.find((o) => o.id === id);
  const createdById = (meta && meta.created_by) || null;
  const isElevated = req.user.role === 'admin' || req.user.role === 'manager';
  if (createdById && createdById !== req.user.id && !isElevated) {
    return res.status(403).json({ error: 'Удалить базу может только пользователь, который её создал' });
  }
  const password = (req.body && req.body.password) != null ? String(req.body.password) : '';
  if (!password) return res.status(400).json({ error: 'Введите пароль для подтверждения удаления' });
  const userRow = db.findUserByIdWithPassword(req.user.id);
  if (!userRow || !userRow.password_hash) return res.status(403).json({ error: 'Пользователь не найден' });
  if (!bcrypt.compareSync(password, userRow.password_hash)) {
    return res.status(401).json({ error: 'Неверный пароль' });
  }
  db.deleteObject(id);
  res.status(204).send();
});

module.exports = router;
