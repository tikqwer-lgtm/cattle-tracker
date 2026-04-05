// storage.js — фасад: реэкспорт и подмена при режиме API

var useApi = typeof window !== 'undefined' && window.CATTLE_TRACKER_USE_API && window.CattleTrackerApi;
if (useApi) {
  var _objectsCache = [];
  /** Локальный снимок записей по objectId (режим API); офлайн-приоритет до явного обновления с сервера. */
  var API_ENTRIES_CACHE_PREFIX = 'cattleTracker_apiEntries_';

  function readApiEntriesCache(objectId) {
    if (!objectId) return null;
    try {
      var raw = localStorage.getItem(API_ENTRIES_CACHE_PREFIX + objectId);
      if (raw === null || raw === undefined) return null;
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : null;
    } catch (e) {
      return null;
    }
  }

  function writeApiEntriesCache(objectId, entries) {
    if (!objectId) return;
    try {
      localStorage.setItem(API_ENTRIES_CACHE_PREFIX + objectId, JSON.stringify(entries || []));
    } catch (e) {
      console.warn('writeApiEntriesCache:', e.message);
    }
  }

  function removeApiEntriesCache(objectId) {
    if (!objectId) return;
    try {
      localStorage.removeItem(API_ENTRIES_CACHE_PREFIX + objectId);
    } catch (e) {}
  }

  function clearAllApiEntriesCaches() {
    try {
      var keys = [];
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf(API_ENTRIES_CACHE_PREFIX) === 0) keys.push(k);
      }
      keys.forEach(function (k) { try { localStorage.removeItem(k); } catch (e) {} });
    } catch (e) {}
  }

  window.readApiEntriesCache = readApiEntriesCache;
  window.writeApiEntriesCache = writeApiEntriesCache;
  window.removeApiEntriesCache = removeApiEntriesCache;
  window.clearAllApiEntriesCaches = clearAllApiEntriesCaches;

  function loadObjectsFromApi() {
    return window.CattleTrackerApi.getObjectsList().then(function (list) {
      _objectsCache = list && list.length ? list : [{ id: 'default', name: 'Основная база' }];
      return _objectsCache;
    });
  }
  window.getCurrentObjectId = function () { return window.CattleTrackerApi.getCurrentObjectId(); };
  window.setCurrentObjectId = function (id) { window.CattleTrackerApi.setCurrentObjectId(id); };
  window.getObjectsList = function () {
    var list = _objectsCache.length ? _objectsCache : [{ id: 'default', name: 'Основная база' }];
    if (window.CattleTrackerApi && typeof window.CattleTrackerApi.filterObjectsListVisible === 'function') {
      return window.CattleTrackerApi.filterObjectsListVisible(list);
    }
    return list;
  };

  /** После скрытия базы локально — переключить текущую, если она скрыта. */
  window.afterLocalHideObject = function (hiddenId) {
    return loadObjectsFromApi().then(function () {
      var list = window.getObjectsList();
      var cur = window.getCurrentObjectId();
      var pendingId = window.CattleTrackerApi && window.CattleTrackerApi.PENDING_OBJECT_ID;
      var lost = cur === hiddenId || !list.some(function (o) { return o.id === cur; });
      if (lost) {
        if (list.length) {
          window.switchToObject(list[0].id);
          return;
        }
        window.setCurrentObjectId(pendingId || 'default');
        return window.loadLocally();
      }
      return window.loadLocally();
    }).then(function () {
      if (typeof window.updateObjectSwitcher === 'function') window.updateObjectSwitcher();
      if (typeof window.updateHerdStats === 'function') window.updateHerdStats();
    });
  };
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
      removeApiEntriesCache(id);
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

  function finishLoadEntriesUi() {
    if (typeof window.ensureProtocolsLoaded === 'function') {
      try {
        window.ensureProtocolsLoaded(function () {});
      } catch (e) {}
    }
    return window.entries;
  }

  window.loadLocally = function (opts) {
    opts = opts || {};
    var forceFromServer = opts.forceFromServer === true;
    return loadObjectsFromApi().then(function () {
      var objectId = window.getCurrentObjectId();
      var pendingId = window.CattleTrackerApi && window.CattleTrackerApi.PENDING_OBJECT_ID;
      var visibleList = window.getObjectsList();
      var inVisible = visibleList.some(function (o) { return o.id === objectId; });
      if (objectId && objectId !== pendingId && !inVisible) {
        if (visibleList.length) {
          return window.switchToObject(visibleList[0].id);
        }
        window.setCurrentObjectId(pendingId);
        objectId = pendingId;
      }
      if (pendingId && objectId === pendingId) {
        if (typeof window.replaceEntriesWith === 'function') window.replaceEntriesWith([]);
        else { window.entries.length = 0; if (typeof window !== 'undefined') window.entries = window.entries; }
        if (typeof window.CattleTrackerEvents !== 'undefined') {
          window.CattleTrackerEvents.emit('entries:updated', window.entries);
        }
        if (typeof window.updateList === 'function') window.updateList();
        return window.entries;
      }
      if (!forceFromServer) {
        var cached = readApiEntriesCache(objectId);
        if (cached != null) {
          if (typeof window.replaceEntriesWith === 'function') window.replaceEntriesWith(cached);
          else {
            window.entries.length = 0;
            cached.forEach(function (e) { window.entries.push(e); });
            if (typeof window !== 'undefined') window.entries = window.entries;
          }
          if (typeof window.CattleTrackerEvents !== 'undefined') {
            window.CattleTrackerEvents.emit('entries:updated', window.entries);
          }
          if (typeof window.updateList === 'function') window.updateList();
          return Promise.resolve(finishLoadEntriesUi());
        }
      }
      return window.CattleTrackerApi.loadEntries(objectId).then(function (list) {
        writeApiEntriesCache(objectId, list || []);
        if (typeof window.replaceEntriesWith === 'function') window.replaceEntriesWith(list || []); else { window.entries.length = 0; (list || []).forEach(function (e) { window.entries.push(e); }); if (typeof window !== 'undefined') window.entries = window.entries; }
        if (typeof window.CattleTrackerEvents !== 'undefined') {
          window.CattleTrackerEvents.emit('entries:updated', window.entries);
        }
        if (typeof window.updateList === 'function') window.updateList();
        return window.entries;
      }).then(function () {
        return finishLoadEntriesUi();
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
      return window.loadLocally({ forceFromServer: true });
    });
  }
  function updateEntryViaApi(cattleId, entry) {
    var objectId = window.getCurrentObjectId();
    return window.CattleTrackerApi.updateEntry(objectId, cattleId, entry).then(function () {
      return window.loadLocally({ forceFromServer: true });
    });
  }
  function deleteEntryViaApi(cattleId) {
    var objectId = window.getCurrentObjectId();
    return window.CattleTrackerApi.deleteEntry(objectId, cattleId).then(function () {
      return window.loadLocally({ forceFromServer: true });
    });
  }
  window.createEntryViaApi = createEntryViaApi;
  window.updateEntryViaApi = updateEntryViaApi;
  window.deleteEntryViaApi = deleteEntryViaApi;
  window.loadObjectsFromApi = loadObjectsFromApi;
  window.loadLocally = loadLocally;
}

export {};
