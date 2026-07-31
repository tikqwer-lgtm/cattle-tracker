// storage-objects.js — объекты/базы, текущий объект, миграция.
// Единственное место объявления массива записей (entries). Замена содержимого — через replaceEntriesWith().

var OBJECTS_KEY = 'cattleTracker_objects';
var CURRENT_OBJECT_KEY = 'cattleTracker_currentObject';

let entries = [];
if (typeof window !== 'undefined') window.entries = entries;

/**
 * Заменяет содержимое массива записей и синхронизирует с window.entries.
 * Единая точка замены (вместо прямого присваивания entries = ...).
 * @param {Array} arr - новый массив записей (или пустой массив)
 */
function replaceEntriesWith(arr) {
  entries.length = 0;
  if (arr && Array.isArray(arr) && arr.length > 0) {
    for (var i = 0; i < arr.length; i++) entries.push(arr[i]);
  }
  if (typeof window !== 'undefined') window.entries = entries;
}

/**
 * Добавляет или заменяет запись в локальном массиве (офлайн и оптимистично после API).
 * @param {Object} entry
 * @returns {boolean} true если запись новая
 */
function upsertEntryInStore(entry) {
  if (!entry || entry.cattleId == null || String(entry.cattleId).trim() === '') return false;
  var id = String(entry.cattleId).trim();
  var list = entries.slice();
  var replaced = false;
  for (var i = 0; i < list.length; i++) {
    if (list[i] && String(list[i].cattleId).trim() === id) {
      list[i] = entry;
      replaced = true;
      break;
    }
  }
  if (!replaced) list.unshift(entry);
  replaceEntriesWith(list);
  if (typeof window !== 'undefined') {
    var oid = typeof window.getCurrentObjectId === 'function' ? window.getCurrentObjectId() : '';
    var pend = window.CattleTrackerApi && window.CattleTrackerApi.PENDING_OBJECT_ID;
    if (oid && (!pend || oid !== pend) && typeof window.writeApiEntriesCache === 'function') {
      try { window.writeApiEntriesCache(oid, entries); } catch (e) {}
    }
    if (typeof window.CattleTrackerEvents !== 'undefined') {
      try { window.CattleTrackerEvents.emit('entries:updated', entries); } catch (e) {}
    }
  }
  return !replaced;
}

function getCurrentObjectId() {
  try {
    var id = localStorage.getItem(CURRENT_OBJECT_KEY);
    return id && id.trim() ? id : 'default';
  } catch (e) {
    return 'default';
  }
}

function setCurrentObjectId(id) {
  if (!id || !id.trim()) id = 'default';
  try {
    localStorage.setItem(CURRENT_OBJECT_KEY, id.trim());
  } catch (e) {
    console.warn('setCurrentObjectId:', e);
  }
}

function getStorageKey() {
  return 'cattleEntries_' + getCurrentObjectId();
}

function getObjectsList() {
  try {
    var raw = localStorage.getItem(OBJECTS_KEY);
    if (raw) {
      var list = JSON.parse(raw);
      if (Array.isArray(list) && list.length > 0) return list;
    }
  } catch (e) {}
  return null;
}

function saveObjectsList(list) {
  try {
    localStorage.setItem(OBJECTS_KEY, JSON.stringify(list));
  } catch (e) {
    console.warn('saveObjectsList:', e);
  }
}

function ensureObjectsAndMigration() {
  var list = getObjectsList();
  if (list && list.length > 0) return;
  var legacyKey = 'cattleEntries';
  var legacyData = localStorage.getItem(legacyKey);
  var defaultId = 'default';
  var newList = [{ id: defaultId, name: 'Основная база' }];
  if (legacyData) {
    try {
      localStorage.setItem('cattleEntries_' + defaultId, legacyData);
    } catch (e) {}
  }
  saveObjectsList(newList);
  setCurrentObjectId(defaultId);
}

function switchToObject(objectId) {
  setCurrentObjectId(objectId);
  function afterLayers() {
    if (typeof window.updateHerdStats === 'function') window.updateHerdStats();
    if (typeof window.updateViewList === 'function') window.updateViewList();
    if (typeof window.CattleTrackerEvents !== 'undefined') {
      window.CattleTrackerEvents.emit('entries:updated', entries);
    }
  }
  var loadP = typeof window.loadLocally === 'function' ? window.loadLocally() : null;
  var layersP = function () {
    if (typeof window.CattleTrackerObjectData !== 'undefined' && window.CattleTrackerObjectData.loadAllObjectLayers) {
      return window.CattleTrackerObjectData.loadAllObjectLayers(objectId);
    }
    return Promise.resolve();
  };
  if (loadP && typeof loadP.then === 'function') {
    return loadP.then(layersP).then(afterLayers);
  }
  return layersP().then(afterLayers);
}

function addObject(name) {
  var list = getObjectsList();
  if (!list) list = [{ id: 'default', name: 'Основная база' }];
  var id = 'obj_' + Date.now();
  list.push({ id: id, name: (name || 'Новая база').trim() });
  saveObjectsList(list);
  switchToObject(id);
  return id;
}

function updateObject(id, payload) {
  var list = getObjectsList();
  if (!list) return Promise.resolve(false);
  var name = (payload && payload.name != null) ? String(payload.name).trim() : '';
  if (!name) return Promise.resolve(false);
  var idx = list.findIndex(function (o) { return o.id === id; });
  if (idx === -1) return Promise.resolve(false);
  list[idx].name = name;
  saveObjectsList(list);
  return Promise.resolve(true);
}

function deleteObject(id) {
  var list = getObjectsList();
  if (!list) return Promise.resolve(false);
  var idx = list.findIndex(function (o) { return o.id === id; });
  if (idx === -1) return Promise.resolve(false);
  var currentId = getCurrentObjectId();
  list.splice(idx, 1);
  saveObjectsList(list);
  try {
    localStorage.removeItem('cattleEntries_' + id);
    if (typeof window.CattleTrackerObjectData !== 'undefined' && window.CattleTrackerObjectData.removeKeysForObject) {
      window.CattleTrackerObjectData.removeKeysForObject(id);
    }
  } catch (e) {}
  if (currentId === id) {
    if (list[0]) {
      setCurrentObjectId(list[0].id);
      if (typeof window.loadLocally === 'function') window.loadLocally();
    } else {
      setCurrentObjectId('');
      if (typeof window !== 'undefined') window.entries = [];
    }
  }
  if (typeof window.updateHerdStats === 'function') window.updateHerdStats();
  if (typeof window.updateViewList === 'function') window.updateViewList();
  return Promise.resolve(true);
}

if (typeof window !== 'undefined') {
  window.getCurrentObjectId = getCurrentObjectId;
  window.setCurrentObjectId = setCurrentObjectId;
  window.getObjectsList = getObjectsList;
  window.getStorageKey = getStorageKey;
  window.ensureObjectsAndMigration = ensureObjectsAndMigration;
  window.switchToObject = switchToObject;
  window.addObject = addObject;
  window.updateObject = updateObject;
  window.deleteObject = deleteObject;
  window.replaceEntriesWith = replaceEntriesWith;
  window.upsertEntryInStore = upsertEntryInStore;
}
export {};
