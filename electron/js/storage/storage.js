// storage.js — фасад: реэкспорт и подмена при режиме API

var useApi = typeof window !== 'undefined' && window.CATTLE_TRACKER_USE_API && window.CattleTrackerApi;
if (useApi) {
  var _objectsCache = [];
  /** Счётчик переключений базы: отбрасывать устаревший ответ loadEntries после смены objectId. */
  var _loadLocallyGeneration = 0;
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

  function objectsListAfterHiddenFilter() {
    var list = _objectsCache.length ? _objectsCache.slice() : [];
    if (window.CattleTrackerApi && typeof window.CattleTrackerApi.filterObjectsListVisible === 'function') {
      list = window.CattleTrackerApi.filterObjectsListVisible(list);
    }
    return list;
  }

  function normalizeApiObjectSelectionForRole() {
    var list = objectsListAfterHiddenFilter();
    if (typeof window.filterObjectsListForRole === 'function') {
      list = window.filterObjectsListForRole(list);
    }
    var pend = window.CattleTrackerApi && window.CattleTrackerApi.PENDING_OBJECT_ID;
    if (!list || !list.length) {
      if (pend && typeof window.setCurrentObjectId === 'function') {
        window.setCurrentObjectId(pend);
      }
      return;
    }
    var cur = window.getCurrentObjectId();
    if (pend && cur === pend) return;
    var found = list.some(function (o) { return o && o.id === cur; });
    if (!found) window.setCurrentObjectId(list[0].id);
  }

  function loadObjectsFromApi() {
    return window.CattleTrackerApi.getObjectsList().then(function (list) {
      _objectsCache = list && list.length ? list : [];
      normalizeApiObjectSelectionForRole();
      return _objectsCache;
    });
  }
  window.getCurrentObjectId = function () { return window.CattleTrackerApi.getCurrentObjectId(); };
  window.setCurrentObjectId = function (id) { window.CattleTrackerApi.setCurrentObjectId(id); };
  window.getObjectsList = function () {
    var list = objectsListAfterHiddenFilter();
    if (typeof window.filterObjectsListForRole === 'function') {
      list = window.filterObjectsListForRole(list);
    }
    // Не подставлять фейковый default: иначе «Удалить/Скрыть» выглядит как «ничего не произошло».
    return list || [];
  };

  /** После скрытия/удаления базы — переключить текущую, если она пропала из списка. */
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
        if (pendingId) {
          window.setCurrentObjectId(pendingId);
        } else {
          window.setCurrentObjectId('default');
        }
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
      if (window.CattleTrackerObjectData && window.CattleTrackerObjectData.removeKeysForObject) {
        window.CattleTrackerObjectData.removeKeysForObject(id);
      }
      return loadObjectsFromApi().then(function () {
        var list = window.getObjectsList();
        var pendingId = window.CattleTrackerApi && window.CattleTrackerApi.PENDING_OBJECT_ID;
        if (currentId === id) {
          if (list.length) {
            window.switchToObject(list[0].id);
          } else if (pendingId) {
            window.setCurrentObjectId(pendingId);
            if (typeof window.loadLocally === 'function') window.loadLocally();
          }
        }
        if (typeof window.updateObjectSwitcher === 'function') window.updateObjectSwitcher();
      });
    });
  };

  window.switchToObject = function (objectId) {
    window.setCurrentObjectId(objectId);
    function afterLayers() {
      if (typeof window.updateHerdStats === 'function') window.updateHerdStats();
      if (typeof window.updateViewList === 'function') window.updateViewList();
      if (typeof window.CattleTrackerEvents !== 'undefined') {
        window.CattleTrackerEvents.emit('entries:updated', window.entries);
      }
    }
    var p = window.loadLocally();
    var layersP = function () {
      if (window.CattleTrackerObjectData && window.CattleTrackerObjectData.loadAllObjectLayers) {
        return window.CattleTrackerObjectData.loadAllObjectLayers(objectId);
      }
      return Promise.resolve();
    };
    if (p && typeof p.then === 'function') {
      return p.then(layersP).then(afterLayers);
    }
    return layersP().then(afterLayers);
  };

  function finishLoadEntriesUi() {
    var oid = window.getCurrentObjectId();
    var layersDone = window.CattleTrackerObjectData && window.CattleTrackerObjectData.loadAllObjectLayers
      ? window.CattleTrackerObjectData.loadAllObjectLayers(oid, { silent: true })
      : Promise.resolve();
    layersDone.then(function () {
      if (typeof window.ensureProtocolsLoaded === 'function') {
        try {
          window.ensureProtocolsLoaded(function () {});
        } catch (e) {}
      }
    });
    return window.entries;
  }

  window.loadLocally = function (opts) {
    opts = opts || {};
    var forceFromServer = opts.forceFromServer === true;
    var myGen = ++_loadLocallyGeneration;
    return loadObjectsFromApi().then(function () {
      if (myGen !== _loadLocallyGeneration) {
        return typeof window.entries !== 'undefined' ? window.entries : [];
      }
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
      if (myGen !== _loadLocallyGeneration || window.getCurrentObjectId() !== objectId) {
        return typeof window.entries !== 'undefined' ? window.entries : [];
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
          if (myGen !== _loadLocallyGeneration || window.getCurrentObjectId() !== objectId) {
            return Promise.resolve(typeof window.entries !== 'undefined' ? window.entries : []);
          }
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
        if (myGen !== _loadLocallyGeneration || window.getCurrentObjectId() !== objectId) {
          return typeof window.entries !== 'undefined' ? window.entries : [];
        }
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
        if (myGen === _loadLocallyGeneration && window.getCurrentObjectId() === objectId) {
          // Не затираем entries в [] при сбое сети — оставляем кэш или текущий список
          var cached = typeof readApiEntriesCache === 'function' ? readApiEntriesCache(objectId) : null;
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
          }
        }
        throw err;
      });
    });
  };

  window.saveLocally = function () { /* no-op when API */ };

  function refreshEntriesUiAfterMutation() {
    if (typeof window.updateList === 'function') window.updateList();
    if (typeof window.updateViewList === 'function') window.updateViewList();
    if (typeof window.updateHerdStats === 'function') window.updateHerdStats();
  }

  function rejectPreviewApi() {
    if (typeof window.rejectIfPreviewMutation === 'function' && window.rejectIfPreviewMutation()) {
      if (typeof window.previewBlockedError === 'function') return Promise.reject(window.previewBlockedError());
      var e = new Error('Режим просмотра: изменения отключены');
      e.alreadyToasted = true;
      return Promise.reject(e);
    }
    return null;
  }

  function createEntryViaApi(entry) {
    var blocked = rejectPreviewApi();
    if (blocked) return blocked;
    var objectId = window.getCurrentObjectId();
    var pendingId = window.CattleTrackerApi && window.CattleTrackerApi.PENDING_OBJECT_ID;
    if (pendingId && objectId === pendingId) {
      return Promise.reject(new Error('Сначала выберите базу в разделе «Синхронизация»'));
    }
    return window.CattleTrackerApi.createEntry(objectId, entry).then(function (created) {
      if (typeof window.upsertEntryInStore === 'function') {
        window.upsertEntryInStore(created && created.cattleId ? created : entry);
      }
      refreshEntriesUiAfterMutation();
      return window.loadLocally({ forceFromServer: true }).then(function () {
        refreshEntriesUiAfterMutation();
        return window.entries;
      }).catch(function (err) {
        console.warn('createEntryViaApi: перезагрузка после создания не удалась, оставляем локальную копию', err);
        refreshEntriesUiAfterMutation();
        return window.entries;
      });
    });
  }
  function updateEntryViaApi(cattleId, entry, opts) {
    var blockedUpd = rejectPreviewApi();
    if (blockedUpd) return blockedUpd;
    var skipReload = opts && opts.skipReload === true;
    var objectId = window.getCurrentObjectId();
    return window.CattleTrackerApi.updateEntry(objectId, cattleId, entry).then(function () {
      if (skipReload) return Promise.resolve();
      return window.loadLocally({ forceFromServer: true });
    });
  }
  function deleteEntryViaApi(cattleId) {
    var blockedDel = rejectPreviewApi();
    if (blockedDel) return blockedDel;
    var objectId = window.getCurrentObjectId();
    return window.CattleTrackerApi.deleteEntry(objectId, cattleId).then(function () {
      return window.loadLocally({ forceFromServer: true });
    });
  }
  window.createEntryViaApi = createEntryViaApi;
  window.updateEntryViaApi = updateEntryViaApi;
  window.deleteEntryViaApi = deleteEntryViaApi;

  /**
   * Сохраняет результаты Excel-импорта на сервер (создание + обновление), одна перезагрузка в конце.
   * @returns {Promise<string[]>} список ошибок по cattleId (пустой при полном успехе)
   */
  function persistImportEntriesToApi(createdEntries, updatedEntries, onProgress) {
    var objectId = window.getCurrentObjectId();
    var pendingId = window.CattleTrackerApi && window.CattleTrackerApi.PENDING_OBJECT_ID;
    if (pendingId && objectId === pendingId) {
      return Promise.reject(new Error('Сначала выберите базу в разделе «Синхронизация»'));
    }
    var api = window.CattleTrackerApi;
    if (!api || typeof api.createEntry !== 'function' || typeof api.updateEntry !== 'function') {
      return Promise.reject(new Error('API недоступен'));
    }
    var created = createdEntries || [];
    var updated = updatedEntries || [];
    var total = created.length + updated.length;
    var done = 0;
    var apiErrors = [];
    var report = function (label) {
      if (typeof onProgress === 'function') {
        onProgress(done, total, label || ('Сохранение на сервер: ' + done + ' из ' + total));
      }
    };
    report('Сохранение на сервер: 0 из ' + total);

    var chain = Promise.resolve();
    created.forEach(function (entry) {
      chain = chain.then(function () {
        return api.createEntry(objectId, entry).then(function (createdRow) {
          if (typeof window.upsertEntryInStore === 'function') {
            window.upsertEntryInStore(createdRow && createdRow.cattleId ? createdRow : entry);
          }
        }).catch(function (err) {
          apiErrors.push(String(entry.cattleId || '?') + ': ' + (err && err.message ? err.message : String(err)));
        }).then(function () {
          done++;
          report();
        });
      });
    });

    updated.forEach(function (entry) {
      if (!entry || !entry.cattleId) return;
      chain = chain.then(function () {
        return api.updateEntry(objectId, entry.cattleId, entry).catch(function (err) {
          apiErrors.push(String(entry.cattleId) + ': ' + (err && err.message ? err.message : String(err)));
        }).then(function () {
          done++;
          report();
        });
      });
    });

    return chain.then(function () {
      if (typeof onProgress === 'function') onProgress(total, total, 'Обновление списка…');
      return window.loadLocally({ forceFromServer: true }).then(function () {
        refreshEntriesUiAfterMutation();
        return apiErrors;
      });
    });
  }
  window.persistImportEntriesToApi = persistImportEntriesToApi;

  window.loadObjectsFromApi = loadObjectsFromApi;
  window.loadLocally = loadLocally;
}

export {};
