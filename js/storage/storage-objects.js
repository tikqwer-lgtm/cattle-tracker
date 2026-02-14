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
  if (typeof loadLocally === 'function') loadLocally();
  if (typeof updateHerdStats === 'function') updateHerdStats();
  if (typeof updateViewList === 'function') updateViewList();
  if (typeof window.CattleTrackerEvents !== 'undefined') {
    window.CattleTrackerEvents.emit('entries:updated', entries);
  }
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
  if (list.length === 0) list = [{ id: 'default', name: 'Основная база' }];
  saveObjectsList(list);
  try {
    localStorage.removeItem('cattleEntries_' + id);
  } catch (e) {}
  if (currentId === id) {
    var nextId = list[0] ? list[0].id : 'default';
    setCurrentObjectId(nextId);
    if (typeof loadLocally === 'function') loadLocally();
  }
  if (typeof updateHerdStats === 'function') updateHerdStats();
  if (typeof updateViewList === 'function') updateViewList();
  return Promise.resolve(true);
}

if (typeof window !== 'undefined') {
  window.addObject = addObject;
  window.updateObject = updateObject;
  window.deleteObject = deleteObject;
  window.replaceEntriesWith = replaceEntriesWith;
}
