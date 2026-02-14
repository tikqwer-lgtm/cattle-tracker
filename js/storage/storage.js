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
  window.getCurrentObjectId = function () { return window.CattleTrackerApi.getCurrentObjectId(); };
  window.setCurrentObjectId = function (id) { window.CattleTrackerApi.setCurrentObjectId(id); };
  window.getObjectsList = function () { return _objectsCache.length ? _objectsCache : [{ id: 'default', name: 'Основная база' }]; };
  window.ensureObjectsAndMigration = function () { return loadObjectsFromApi(); };

  window.addObject = function (name) {
    return window.CattleTrackerApi.addObject(name).then(function (id) {
      return loadObjectsFromApi().then(function () {
        window.switchToObject(id);
        return id;
      });
    });
  };

  window.updateObject = function (id, payload) {
    return window.CattleTrackerApi.updateObject(id, payload || {}).then(function () {
      return loadObjectsFromApi();
    });
  };

  window.deleteObject = function (id) {
    var currentId = window.getCurrentObjectId();
    return window.CattleTrackerApi.deleteObject(id).then(function () {
      return loadObjectsFromApi().then(function () {
        var list = _objectsCache.length ? _objectsCache : [{ id: 'default', name: 'Основная база' }];
        if (currentId === id && list.length) {
          window.switchToObject(list[0].id);
        } else if (currentId === id) {
          window.setCurrentObjectId('default');
          if (typeof window.loadLocally === 'function') window.loadLocally();
        }
        if (typeof window.updateObjectSwitcher === 'function') window.updateObjectSwitcher();
      });
    });
  };

  window.switchToObject = function (objectId) {
    window.setCurrentObjectId(objectId);
    var p = window.loadLocally();
    if (p && typeof p.then === 'function') {
      p.then(function () {
        if (typeof window.updateHerdStats === 'function') window.updateHerdStats();
        if (typeof window.updateViewList === 'function') window.updateViewList();
        if (typeof window.CattleTrackerEvents !== 'undefined') {
          window.CattleTrackerEvents.emit('entries:updated', window.entries);
        }
      });
    } else {
      if (typeof window.updateHerdStats === 'function') window.updateHerdStats();
      if (typeof window.updateViewList === 'function') window.updateViewList();
      if (typeof window.CattleTrackerEvents !== 'undefined') {
        window.CattleTrackerEvents.emit('entries:updated', window.entries);
      }
    }
  };

  window.loadLocally = function () {
    return loadObjectsFromApi().then(function () {
      var objectId = window.getCurrentObjectId();
      return window.CattleTrackerApi.loadEntries(objectId).then(function (list) {
        if (typeof window.replaceEntriesWith === 'function') window.replaceEntriesWith(list || []); else { window.entries.length = 0; (list || []).forEach(function (e) { window.entries.push(e); }); if (typeof window !== 'undefined') window.entries = window.entries; }
        if (typeof window.CattleTrackerEvents !== 'undefined') {
          window.CattleTrackerEvents.emit('entries:updated', window.entries);
        }
        if (typeof window.updateList === 'function') window.updateList();
        return window.entries;
      }).catch(function (err) {
        console.error('Ошибка загрузки записей с API:', err);
        if (typeof window.replaceEntriesWith === 'function') window.replaceEntriesWith([]); else { window.entries.length = 0; if (typeof window !== 'undefined') window.entries = window.entries; }
        if (typeof window.updateList === 'function') window.updateList();
        throw err;
      });
    });
  };

  window.saveLocally = function () { /* no-op when API */ };

  function createEntryViaApi(entry) {
    var objectId = window.getCurrentObjectId();
    return window.CattleTrackerApi.createEntry(objectId, entry).then(function () {
      return window.loadLocally();
    });
  }
  function updateEntryViaApi(cattleId, entry) {
    var objectId = window.getCurrentObjectId();
    return window.CattleTrackerApi.updateEntry(objectId, cattleId, entry).then(function () {
      return window.loadLocally();
    });
  }
  function deleteEntryViaApi(cattleId) {
    var objectId = window.getCurrentObjectId();
    return window.CattleTrackerApi.deleteEntry(objectId, cattleId).then(function () {
      return window.loadLocally();
    });
  }
  window.createEntryViaApi = createEntryViaApi;
  window.updateEntryViaApi = updateEntryViaApi;
  window.deleteEntryViaApi = deleteEntryViaApi;
  window.loadObjectsFromApi = loadObjectsFromApi;
  window.loadLocally = loadLocally;
}

export {};
