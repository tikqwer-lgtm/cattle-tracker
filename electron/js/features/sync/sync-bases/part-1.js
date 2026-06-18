/** __syncBases part 1 */
(function () {
  'use strict';
  var root = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this);
  var NS = root['__syncBases'] = root['__syncBases'] || {};
  var global = typeof window !== 'undefined' ? window : this;

function formatServerDate(isoStr) {
  if (!isoStr) return '—';
  var d = new Date(isoStr);
  if (isNaN(d.getTime())) return isoStr;
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

var syncBasesState = NS._syncState = NS._syncState || {
  data: [],
  sort: { key: 'name', dir: 'asc' },
  filterName: '',
  filterUser: ''
};
window.__getSyncBasesCache = function () { return syncBasesState.data; };
window.__setSyncBasesCache = function (list) { syncBasesState.data = list; };

/** На телефоне: только скачать с сервера под новым именем, без выгрузки/удаления/замены в другую базу. */
function isSyncMobileLimited() {
  return typeof window.isMobile === 'function' && window.isMobile();
}

/** Полномочия администратора для управления базами на сервере (удаление и т.п.). */
function isSyncUserElevated() {
  if (typeof window.getCurrentUser !== 'function') return false;
  var u = window.getCurrentUser();
  if (!u) return false;
  if (typeof window.isAppAdminRole === 'function' && window.isAppAdminRole(u)) return true;
  if (typeof window.hasCapability === 'function') {
    return window.hasCapability('adminUsersRoles', u);
  }
  var role = String(u.role || '').trim().toLowerCase();
  return role === 'admin' || role === 'manager';
}

function normalizeBaseName(s) {
  return String(s || '').trim().toLowerCase();
}

function maxEntryUpdatedIso(entries) {
  var m = '';
  (entries || []).forEach(function (e) {
    var t = e && (e.updated_at != null ? e.updated_at : e.updatedAt);
    if (t != null && String(t).trim() && String(t) > String(m)) m = String(t);
  });
  return m;
}

/**
 * Если у локальной базы с тем же названием записи новее метки сервера — запрос подтверждения.
 */
function confirmDownloadIfStale(sourceName, sourceDateRaw, targetId) {
  var targetList = typeof window.getObjectsList === 'function' ? window.getObjectsList() : [];
  var tMeta = (targetList || []).filter(function (o) { return o && o.id === targetId; })[0];
  var tName = (tMeta && tMeta.name) ? String(tMeta.name) : '';
  if (normalizeBaseName(tName) !== normalizeBaseName(sourceName)) return Promise.resolve(true);
  var cached = typeof window.readApiEntriesCache === 'function' ? window.readApiEntriesCache(targetId) : null;
  if (cached == null || !cached.length) return Promise.resolve(true);
  var localMax = maxEntryUpdatedIso(cached);
  var srv = String(sourceDateRaw || '').trim();
  if (!localMax || !srv || localMax <= srv) return Promise.resolve(true);
  var msg = 'У локальной базы «' + tName.replace(/</g, '&lt;') + '» данные новее, чем у копии на сервере. Всё равно загрузить с сервера и заменить локальные записи?';
  if (typeof showConfirmModal === 'function') return showConfirmModal(msg);
  return Promise.resolve(confirm(msg));
}

var _overwriteServerBusy = false;

/**
 * Полная замена записей на сервере для текущего objectId содержимым локальных window.entries.
 */
function overwriteCurrentServerBaseWithLocal() {
  if (!window.CATTLE_TRACKER_USE_API || !window.CattleTrackerApi) return Promise.resolve();
  if (_overwriteServerBusy) return Promise.resolve();
  var objectId = typeof getCurrentObjectId === 'function' ? getCurrentObjectId() : '';
  var pend = window.CattleTrackerApi && window.CattleTrackerApi.PENDING_OBJECT_ID;
  if (!objectId || (pend && objectId === pend)) {
    if (typeof showToast === 'function') showToast('Выберите базу', 'info');
    return Promise.resolve();
  }
  var localEntries = (typeof window.entries !== 'undefined' && Array.isArray(window.entries)) ? window.entries : [];
  var msg = 'Заменить на сервере все записи этой базы текущими локальными? Старые записи на сервере для этой базы будут удалены.';
  function runOverwrite() {
    _overwriteServerBusy = true;
    var progressBlock = document.getElementById('syncProgressBlock');
    var progressBar = document.getElementById('syncProgressBar');
    var progressLabel = document.getElementById('syncProgressLabel');
    var progressText = document.getElementById('syncProgressText');
    var statusEl = document.getElementById('syncServerStatus');
    function setBtns(disabled) {
      document.querySelectorAll('.sync-current-base-btn').forEach(function (btn) { btn.disabled = !!disabled; });
    }
    function showProg(on) {
      if (progressBlock) progressBlock.style.display = on ? 'block' : 'none';
    }
    function setProg(done, total, label) {
      var pct = total ? Math.min(100, Math.round((done / total) * 100)) : (done > 0 ? 50 : 0);
      if (progressBar) {
        progressBar.style.width = pct + '%';
        progressBar.setAttribute('aria-valuenow', pct);
      }
      if (progressLabel && label !== undefined) progressLabel.textContent = label;
      if (progressText) progressText.textContent = total ? (done + ' / ' + total) : '—';
    }
    globalThis['__syncBases'].setBtns(true);
    globalThis['__syncBases'].showProg(true);
    globalThis['__syncBases'].setProg(0, 0, 'Чтение сервера…');
    if (statusEl) { statusEl.textContent = 'Подготовка выгрузки…'; statusEl.className = 'sync-server-status'; }
    function finishOk() {
      _overwriteServerBusy = false;
      globalThis['__syncBases'].setBtns(false);
      globalThis['__syncBases'].showProg(false);
    }
    function finishErr(text) {
      globalThis['__syncBases'].finishOk();
      if (statusEl) { statusEl.textContent = text || 'Ошибка'; statusEl.className = 'sync-server-status sync-server-status-error'; }
      if (typeof showToast === 'function') showToast(text || 'Ошибка', 'error', 5000);
    }
    return window.CattleTrackerApi.loadEntries(objectId).then(function (rawServer) {
      var serverEntries = globalThis['__syncBases'].normalizeEntriesList(rawServer);
      var totalSteps = serverEntries.length + localEntries.length;
      var step = 0;
      function deleteNext(idx) {
        if (idx >= serverEntries.length) {
          var i = 0;
          function addNext() {
            if (i >= localEntries.length) {
              globalThis['__syncBases'].finishOk();
              if (statusEl) statusEl.textContent = 'Выгрузка на сервер завершена.';
              return (typeof window.loadLocally === 'function' ? window.loadLocally({ forceFromServer: true }) : Promise.resolve()).then(function () {
                if (typeof updateList === 'function') updateList();
                if (typeof updateHerdStats === 'function') updateHerdStats();
                if (typeof updateViewList === 'function') updateViewList();
                if (typeof window.renderSyncServerBasesList === 'function') window.globalThis['__syncBases'].renderSyncServerBasesList();
              });
            }
            var entry = localEntries[i];
            var cattleId = (entry && entry.cattleId) ? String(entry.cattleId).trim() : '';
            if (!cattleId) {
              i++;
              return globalThis['__syncBases'].addNext();
            }
            window.CattleTrackerApi.createEntry(objectId, entry).then(function () {
              if (entry) entry.synced = true;
              i++;
              step++;
              globalThis['__syncBases'].setProg(step, Math.max(1, totalSteps), 'Выгрузка на сервер…');
              return globalThis['__syncBases'].addNext();
            }).catch(function (err) {
              globalThis['__syncBases'].finishErr(err && err.message ? err.message : 'Ошибка выгрузки');
            });
          }
          return globalThis['__syncBases'].addNext();
        }
        var row = serverEntries[idx];
        var cid = row && row.cattleId ? String(row.cattleId).trim() : '';
        if (!cid) {
          globalThis['__syncBases'].deleteNext(idx + 1);
          return;
        }
        window.CattleTrackerApi.deleteEntry(objectId, cid).then(function () {
          idx++;
          step++;
          globalThis['__syncBases'].setProg(step, Math.max(1, totalSteps), 'Очистка старых записей на сервере…');
          globalThis['__syncBases'].deleteNext(idx);
        }).catch(function (err) {
          globalThis['__syncBases'].finishErr(err && err.message ? err.message : 'Ошибка удаления на сервере');
        });
      }
      globalThis['__syncBases'].deleteNext(0);
    }).catch(function (err) {
      globalThis['__syncBases'].finishErr(err && err.message ? err.message : 'Ошибка чтения с сервера');
    });
  }
  if (typeof showConfirmModal === 'function') {
    return showConfirmModal(msg).then(function (ok) {
      if (!ok) return Promise.resolve();
      return globalThis['__syncBases'].runOverwrite();
    });
  }
  if (!confirm(msg)) return Promise.resolve();
  return globalThis['__syncBases'].runOverwrite();
}

/**
 * Одна слот резервной копии перед загрузкой/заменой данных с сервера (старый снимок перезаписывается).
 * Ключ фиксированный — «файл с тем же именем» в смысле одного слота хранилища.
 */
var SYNC_PRE_LOAD_BACKUP_KEY = 'cattleTracker_syncPreLoadBackup';

function saveSnapshotBeforeServerOverwrite(objectId, objectName, entries, reason) {
  try {
    var oid = objectId != null ? String(objectId) : '';
    var name = (objectName != null && String(objectName).trim()) ? String(objectName).trim() : (oid || 'база');
    var arr = Array.isArray(entries) ? JSON.parse(JSON.stringify(entries)) : [];
    var payload = {
      objectId: oid,
      objectName: name,
      entries: arr,
      savedAt: new Date().toISOString(),
      reason: reason || ''
    };
    localStorage.setItem(SYNC_PRE_LOAD_BACKUP_KEY, JSON.stringify(payload));
  } catch (e) {}
}

function backupCurrentLocalBaseBeforeSwitch(reason) {
  if (!window.CATTLE_TRACKER_USE_API) return;
  var oid = typeof getCurrentObjectId === 'function' ? getCurrentObjectId() : '';
  var pend = window.CattleTrackerApi && window.CattleTrackerApi.PENDING_OBJECT_ID;
  if (!oid || (pend && oid === pend)) return;
  var list = typeof getObjectsList === 'function' ? getObjectsList() : [];
  var meta = (list || []).filter(function (o) { return o && o.id === oid; })[0];
  var name = (meta && (meta.name || meta.id)) ? String(meta.name || meta.id) : String(oid);
  var entries = (typeof window.entries !== 'undefined' && Array.isArray(window.entries)) ? window.entries : [];
  saveSnapshotBeforeServerOverwrite(oid, name, entries, reason);
}

/**
 * @param {{ forceFromServer?: boolean }} [opt] — после замены данных на сервере передать { forceFromServer: true }
 */
function afterServerImportRefresh(opt) {
  var force = opt && opt.forceFromServer === true;
  var p = typeof window.loadLocally === 'function'
    ? window.loadLocally(force ? { forceFromServer: true } : undefined)
    : Promise.resolve();
  return Promise.resolve(p).then(function () {
    var oid = typeof getCurrentObjectId === 'function' ? getCurrentObjectId() : 'default';
    var layersP = window.CattleTrackerObjectData && window.CattleTrackerObjectData.loadAllObjectLayers
      ? window.CattleTrackerObjectData.loadAllObjectLayers(oid, { silent: true })
      : Promise.resolve();
    return layersP;
  }).then(function () {
    if (typeof window.updateObjectSwitcher === 'function') window.updateObjectSwitcher();
    if (typeof window.updateHerdStats === 'function') window.updateHerdStats();
    if (typeof window.updateViewList === 'function') window.updateViewList();
  });
}

function getCurrentUsername() {
  if (typeof window.getCurrentUser === 'function') {
    var u = window.getCurrentUser();
    return u && u.username ? String(u.username) : '';
  }
  return '';
}

var _loadServerBaseImportBusy = false;

/**
 * Мобильный сценарий: открыть существующую базу на сервере без создания клона; скачивание с прогрессом.
 */
function openServerBaseOnMobile(sourceId, sourceName) {
  if (!window.CATTLE_TRACKER_USE_API || !window.CattleTrackerApi) return;
  if (typeof window.CattleTrackerApi.loadEntriesWithProgress !== 'function') {
    if (typeof showToast === 'function') showToast('Обновите приложение для загрузки с прогрессом', 'error');
    return;
  }
  if (_loadServerBaseImportBusy) {
    if (typeof showToast === 'function') showToast('Дождитесь завершения загрузки базы', 'info', 3000);
    return;
  }
  var statusEl = document.getElementById('syncServerStatus');
  _loadServerBaseImportBusy = true;
  if (typeof window.setSyncBasesImportButtonsDisabled === 'function') window.setSyncBasesImportButtonsDisabled(true);
  if (typeof window.setServerBaseImportProgressVisible === 'function') window.setServerBaseImportProgressVisible(true);
  if (typeof window.setServerBaseImportProgress === 'function') {
    window.setServerBaseImportProgress(0, 0, 'Скачивание записей…');
  }
  if (statusEl) {
    statusEl.textContent = 'Загрузка базы «' + String(sourceName || '').replace(/</g, '&lt;') + '»…';
    statusEl.className = 'sync-server-status';
  }

  backupCurrentLocalBaseBeforeSwitch('mobile-open');
  window.CattleTrackerApi.setCurrentObjectId(sourceId);
  window.CattleTrackerApi.loadEntriesWithProgress(sourceId, function (ev) {
    var t = ev.total || 0;
    var l = ev.loaded || 0;
    if (typeof window.setServerBaseImportProgress === 'function') {
      if (t > 0) window.setServerBaseImportProgress(l, t, 'Скачивание записей…');
      else window.setServerBaseImportProgress(l, 0, 'Скачивание записей…');
    }
  }).then(function (list) {
    list = list || [];
    if (typeof window.writeApiEntriesCache === 'function') window.writeApiEntriesCache(sourceId, list);
    if (typeof window.replaceEntriesWith === 'function') window.replaceEntriesWith(list);
    else {
      window.entries.length = 0;
      list.forEach(function (e) { window.entries.push(e); });
      if (typeof window !== 'undefined') window.entries = window.entries;
    }
    if (typeof window.CattleTrackerEvents !== 'undefined') {
      window.CattleTrackerEvents.emit('entries:updated', window.entries);
    }
    if (typeof window.updateList === 'function') window.updateList();
    if (typeof window.setServerBaseImportProgress === 'function') {
      var n = list.length;
      window.setServerBaseImportProgress(n > 0 ? n : 1, n > 0 ? n : 1, 'Готово');
    }
    if (statusEl) {
      statusEl.textContent = 'База «' + String(sourceName || '').replace(/</g, '&lt;') + '» загружена (' + list.length + ' записей).';
    }
    var oidMob = sourceId;
    var layersMob = window.CattleTrackerObjectData && window.CattleTrackerObjectData.loadAllObjectLayers
      ? window.CattleTrackerObjectData.loadAllObjectLayers(oidMob, { silent: true })
      : Promise.resolve();
    return layersMob.then(function () {
      if (typeof window.ensureProtocolsLoaded === 'function') {
        try { window.ensureProtocolsLoaded(function () {}); } catch (e) {}
      }
      if (typeof window.loadObjectsFromApi === 'function') return window.loadObjectsFromApi();
    });
  }).then(function () {
    if (typeof window.updateObjectSwitcher === 'function') window.updateObjectSwitcher();
    if (typeof window.updateHerdStats === 'function') window.updateHerdStats();
    if (typeof window.updateViewList === 'function') window.updateViewList();
    if (typeof window.renderSyncServerBasesList === 'function') window.globalThis['__syncBases'].renderSyncServerBasesList();
  }).catch(function (err) {
    var msg = err && err.message ? err.message : 'Ошибка загрузки';
    if (statusEl) {
      statusEl.textContent = 'Ошибка: ' + msg;
      statusEl.className = 'sync-server-status sync-server-status-error';
    }
    if (typeof showToast === 'function') showToast(msg, 'error', 6000);
  }).then(function () {
    _loadServerBaseImportBusy = false;
    if (typeof window.setSyncBasesImportButtonsDisabled === 'function') window.setSyncBasesImportButtonsDisabled(false);
    if (typeof window.setServerBaseImportProgressVisible === 'function') window.setServerBaseImportProgressVisible(false);
  });
}


  // register functions
  NS.formatServerDate = formatServerDate;
  NS.isSyncMobileLimited = isSyncMobileLimited;
  NS.isSyncUserElevated = isSyncUserElevated;
  NS.normalizeBaseName = normalizeBaseName;
  NS.maxEntryUpdatedIso = maxEntryUpdatedIso;
  NS.confirmDownloadIfStale = confirmDownloadIfStale;
  NS.overwriteCurrentServerBaseWithLocal = overwriteCurrentServerBaseWithLocal;
  NS.saveSnapshotBeforeServerOverwrite = saveSnapshotBeforeServerOverwrite;
  NS.backupCurrentLocalBaseBeforeSwitch = backupCurrentLocalBaseBeforeSwitch;
  NS.afterServerImportRefresh = afterServerImportRefresh;
  NS.getCurrentUsername = getCurrentUsername;
  NS.openServerBaseOnMobile = openServerBaseOnMobile;
})();
export {};
