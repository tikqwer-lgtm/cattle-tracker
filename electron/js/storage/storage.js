// storage.js — фасад: реэкспорт и подмена при режиме API

var useApi = typeof window !== 'undefined' && window.CATTLE_TRACKER_USE_API && window.CattleTrackerApi;
if (useApi) {
  var _objectsCache = [];
  function loadObjectsFromApi() {
    return window.CattleTrackerApi.getObjectsList().then(function (list) {
      _objectsCache = list && list.length ? list : [{ id: 'default', name: 'Основная база' }];
      return _objectsCache;
    });
  }
  getCurrentObjectId = function () { return window.CattleTrackerApi.getCurrentObjectId(); };
  setCurrentObjectId = function (id) { window.CattleTrackerApi.setCurrentObjectId(id); };
  getObjectsList = function () { return _objectsCache.length ? _objectsCache : [{ id: 'default', name: 'Основная база' }]; };
  ensureObjectsAndMigration = function () { return loadObjectsFromApi(); };

  addObject = function (name) {
    return window.CattleTrackerApi.addObject(name).then(function (id) {
      return loadObjectsFromApi().then(function () {
        switchToObject(id);
        return id;
      });
    });
  };

  updateObject = function (id, payload) {
    return window.CattleTrackerApi.updateObject(id, payload || {}).then(function () {
      return loadObjectsFromApi();
    });
  };

  deleteObject = function (id) {
    var currentId = getCurrentObjectId();
    return window.CattleTrackerApi.deleteObject(id).then(function () {
      return loadObjectsFromApi().then(function () {
        var list = _objectsCache.length ? _objectsCache : [{ id: 'default', name: 'Основная база' }];
        if (currentId === id && list.length) {
          switchToObject(list[0].id);
        } else if (currentId === id) {
          setCurrentObjectId('default');
          if (typeof loadLocally === 'function') loadLocally();
        }
        if (typeof updateObjectSwitcher === 'function') updateObjectSwitcher();
      });
    });
  };

  switchToObject = function (objectId) {
    setCurrentObjectId(objectId);
    var p = loadLocally();
    if (p && typeof p.then === 'function') {
      p.then(function () {
        if (typeof updateHerdStats === 'function') updateHerdStats();
        if (typeof updateViewList === 'function') updateViewList();
        if (typeof window.CattleTrackerEvents !== 'undefined') {
          window.CattleTrackerEvents.emit('entries:updated', entries);
        }
      });
    } else {
      if (typeof updateHerdStats === 'function') updateHerdStats();
      if (typeof updateViewList === 'function') updateViewList();
      if (typeof window.CattleTrackerEvents !== 'undefined') {
        window.CattleTrackerEvents.emit('entries:updated', entries);
      }
    }
  };

  loadLocally = function () {
    return loadObjectsFromApi().then(function () {
      var objectId = getCurrentObjectId();
      return window.CattleTrackerApi.loadEntries(objectId).then(function (list) {
        entries.length = 0;
        (list || []).forEach(function (e) { entries.push(e); });
        if (typeof window !== 'undefined') window.entries = entries;
        if (typeof window.CattleTrackerEvents !== 'undefined') {
          window.CattleTrackerEvents.emit('entries:updated', entries);
        }
        if (typeof updateList === 'function') updateList();
        return entries;
      }).catch(function (err) {
        console.error('Ошибка загрузки записей с API:', err);
        entries.length = 0;
        if (typeof window !== 'undefined') window.entries = entries;
        if (typeof updateList === 'function') updateList();
        throw err;
      });
    });
  };

  saveLocally = function () { /* no-op when API */ };

  function createEntryViaApi(entry) {
    var objectId = getCurrentObjectId();
    return window.CattleTrackerApi.createEntry(objectId, entry).then(function () {
      return loadLocally();
    });
  }
  function updateEntryViaApi(cattleId, entry) {
    var objectId = getCurrentObjectId();
    return window.CattleTrackerApi.updateEntry(objectId, cattleId, entry).then(function () {
      return loadLocally();
    });
  }
  function deleteEntryViaApi(cattleId) {
    var objectId = getCurrentObjectId();
    return window.CattleTrackerApi.deleteEntry(objectId, cattleId).then(function () {
      return loadLocally();
    });
  }
  window.createEntryViaApi = createEntryViaApi;
  window.updateEntryViaApi = updateEntryViaApi;
  window.deleteEntryViaApi = deleteEntryViaApi;
  window.loadObjectsFromApi = loadObjectsFromApi;
  window.loadLocally = loadLocally;
}

window.checkDataIntegrity = checkDataIntegrity;
window.cleanAllEntries = cleanAllEntries;
window.forceCleanDamagedEntries = forceCleanDamagedEntries;
window.deleteAllData = deleteAllData;
window.getCurrentObjectId = getCurrentObjectId;
window.getObjectsList = getObjectsList;
window.switchToObject = switchToObject;
window.addObject = addObject;
window.updateObject = updateObject;
window.deleteObject = deleteObject;
window.ensureObjectsAndMigration = ensureObjectsAndMigration;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    entries: entries,
    saveLocally: saveLocally,
    loadLocally: loadLocally,
    getDefaultCowEntry: getDefaultCowEntry,
    checkDataIntegrity: checkDataIntegrity,
    cleanAllEntries: cleanAllEntries
  };
}
