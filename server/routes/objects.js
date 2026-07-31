/**
 * Objects (bases) routes: list (with meta), create, update, delete.
 */
const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth, requireRole, isAppAdminRole, requireObjectAccess } = require('../auth');

router.get('/', requireAuth, (req, res) => {
  const list = db.getObjectsWithMetaForUser
    ? db.getObjectsWithMetaForUser(req.user.id, req.user.role)
    : db.getObjectsWithMeta();
  res.json(list);
});

router.get('/:id/profile', requireAuth, requireObjectAccess('id'), (req, res) => {
  const objectId = String(req.params.id || '').trim();
  const profile = db.getObjectProfile(objectId);
  res.json(profile != null ? profile : {});
});

router.put('/:id/profile', requireAuth, requireObjectAccess('id'), requireRole('admin'), (req, res) => {
  const objectId = String(req.params.id || '').trim();
  if (!db.putObjectProfile(objectId, req.body)) return res.status(500).json({ error: 'Ошибка сохранения' });
  res.json(db.getObjectProfile(objectId) || {});
});

router.get('/:id/farm-settings', requireAuth, requireObjectAccess('id'), (req, res) => {
  const objectId = String(req.params.id || '').trim();
  res.json(db.getFarmSettings(objectId));
});

router.put('/:id/farm-settings', requireAuth, requireObjectAccess('id'), requireRole('admin'), (req, res) => {
  const objectId = String(req.params.id || '').trim();
  if (!db.putFarmSettings(objectId, req.body)) return res.status(500).json({ error: 'Ошибка сохранения' });
  res.json(db.getFarmSettings(objectId));
});

router.get('/:id/export', requireAuth, requireObjectAccess('id'), (req, res) => {
  const objectId = req.params.id || '';
  const obj = db.getObjectById(objectId);
  const entries = db.getEntries(objectId, req.user.id, req.user.role);
  const protocols = db.getProtocols(objectId);
  res.json({
    object: { id: obj.id, name: obj.name },
    entries,
    protocols,
    stall_layout: db.getStallLayout(objectId),
    profile: db.getObjectProfile(objectId),
    farm_settings: db.getFarmSettings(objectId),
    farm_card: db.getFarmCardBundle(objectId)
  });
});

router.post('/import', requireAuth, requireRole('admin'), (req, res) => {
  const body = req.body || {};
  const name = (body.name || '').trim() || 'Импортированная база';
  const entries = Array.isArray(body.entries) ? body.entries : [];
  const protocols = Array.isArray(body.protocols) ? body.protocols : [];
  const stallLayout = body.stall_layout != null ? body.stall_layout : (body.object && body.object.stall_layout);
  const profile = body.profile != null ? body.profile : body.farm_card;
  const farmSettings = body.farm_settings;
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
  if (stallLayout && typeof stallLayout === 'object') {
    try {
      db.putStallLayout(id, stallLayout);
    } catch (e) {
      console.warn('Import stall_layout skip:', e.message);
    }
  }
  if (profile && typeof profile === 'object') {
    try {
      db.putObjectProfile(id, profile);
    } catch (e) {
      console.warn('Import profile skip:', e.message);
    }
  }
  if (farmSettings && typeof farmSettings === 'object') {
    try {
      db.putFarmSettings(id, farmSettings);
    } catch (e) {
      console.warn('Import farm_settings skip:', e.message);
    }
  }
  res.status(201).json({ id, name });
});

router.post('/', requireAuth, requireRole('admin'), (req, res) => {
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
  try {
    db.cloneObjectLayers(copyFromId, id);
  } catch (e) {
    console.warn('copy object layers skip:', e.message);
  }
  res.status(201).json({ id, name, entriesCopied });
});

router.put('/:id', requireAuth, requireObjectAccess('id'), requireRole('admin'), (req, res) => {
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

router.delete('/:id', requireAuth, requireRole('admin'), (req, res) => {
  const id = (req.params && req.params.id) || '';
  if (!id) return res.status(400).json({ error: 'id обязателен' });
  if (id === 'default') return res.status(400).json({ error: 'Нельзя удалить базовый объект default' });
  const obj = db.getObjectById(id);
  if (!obj) return res.status(404).json({ error: 'Объект не найден' });
  if (!isAppAdminRole(req.user.role)) {
    return res.status(403).json({ error: 'Удалить базу на сервере может только администратор' });
  }
  db.deleteObject(id);
  res.status(204).send();
});

module.exports = router;
