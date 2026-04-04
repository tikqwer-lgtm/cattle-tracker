/** Фрагмент модуля синхронизации; фасад: ../sync.js */
function updateConnectionIndicator(connected) {
  var className = connected ? 'connection-indicator--connected' : 'connection-indicator--disconnected';
  var title = connected ? 'Подключено к серверу' : 'Сервер не подключён';
  var ids = ['connection-indicator-sync', 'connection-indicator-sync-connected', 'connection-indicator-global'];
  ids.forEach(function (id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.className = 'connection-indicator ' + className;
    el.setAttribute('aria-label', connected ? 'Подключено к серверу' : 'Сервер не подключён');
    el.title = title;
  });
  }

function updateSyncServerStatus(message, isError) {
  var el = document.getElementById('syncServerStatus');
  if (!el) return;
  el.textContent = message || '';
  el.className = 'sync-server-status' + (isError ? ' sync-server-status-error' : '');
}

/**
 * Обновить данные с сервера (режим API). Вызывается кнопкой «Обновить с сервера» и при событии online.
 */
function refreshFromServer() {
  if (typeof window === 'undefined' || !window.CATTLE_TRACKER_USE_API || !window.CattleTrackerApi || typeof window.loadLocally !== 'function') {
    return Promise.resolve();
  }
  updateSyncServerStatus('Обновление…');
  return window.loadLocally().then(function () {
    updateSyncServerStatus('Подключено к серверу: ' + (window.CattleTrackerApi.getBaseUrl ? window.CattleTrackerApi.getBaseUrl() : ''));
    updateConnectionIndicator(true);
    if (typeof updateList === 'function') updateList();
    if (typeof updateHerdStats === 'function') updateHerdStats();
    if (typeof updateViewList === 'function') updateViewList();
  }).catch(function (err) {
    var msg = (err && err.message) ? err.message : 'Ошибка подключения';
    updateSyncServerStatus('Ошибка: ' + msg, true);
    updateConnectionIndicator(false);
  });
}

/** Флаг: идёт ли синхронизация (чтобы не запускать повторно). */
var isSyncInProgress = false;

/**
 * Синхронизация текущей базы с сервером: отправить последние изменения на сервер (по уникальному cattleId — создать или обновить запись).
 */
function syncCurrentBaseToServer() {
  if (isSyncInProgress) return Promise.resolve();
  if (typeof window === 'undefined' || !window.CATTLE_TRACKER_USE_API || !window.CattleTrackerApi || typeof window.loadLocally !== 'function') {
    return Promise.resolve();
  }
  var objectId = typeof getCurrentObjectId === 'function' ? getCurrentObjectId() : '';
  if (!objectId) return Promise.resolve();
  var localEntries = (typeof window.entries !== 'undefined' && Array.isArray(window.entries)) ? window.entries : [];
  var total = localEntries.length;
  var progressBlock = document.getElementById('syncProgressBlock');
  var progressBar = document.getElementById('syncProgressBar');
  var progressLabel = document.getElementById('syncProgressLabel');
  var progressText = document.getElementById('syncProgressText');
  function setSyncButtonsDisabled(disabled) {
    document.querySelectorAll('.sync-current-base-btn').forEach(function (btn) { btn.disabled = disabled; });
  }
  function showSyncProgress(visible) {
    if (progressBlock) progressBlock.style.display = visible ? 'block' : 'none';
  }
  function setSyncProgress(current, label) {
    if (progressBar) {
      var pct = total ? Math.min(100, Math.round((current / total) * 100)) : 100;
      progressBar.style.width = pct + '%';
      progressBar.setAttribute('aria-valuenow', pct);
    }
    if (progressLabel && label !== undefined) progressLabel.textContent = label || 'Синхронизация…';
    if (progressText) progressText.textContent = current + ' / ' + total;
  }
  isSyncInProgress = true;
  setSyncButtonsDisabled(true);
  showSyncProgress(true);
  setSyncProgress(0, 'Синхронизация с сервером…');
  updateSyncServerStatus('Синхронизация с сервером…');
  function finish() {
    isSyncInProgress = false;
    setSyncButtonsDisabled(false);
    showSyncProgress(false);
  }
  return window.CattleTrackerApi.loadEntries(objectId).then(function (serverEntries) {
    var serverByCattleId = {};
    (serverEntries || []).forEach(function (e) {
      if (e && e.cattleId) serverByCattleId[e.cattleId] = e;
    });
    var index = 0;
    function next() {
      if (index >= localEntries.length) {
        if (typeof saveLocally === 'function') saveLocally();
        finish();
        return window.loadLocally().then(function () {
          updateSyncServerStatus('Подключено к серверу. Данные синхронизированы.');
          updateConnectionIndicator(true);
          if (typeof updateList === 'function') updateList();
          if (typeof updateHerdStats === 'function') updateHerdStats();
          if (typeof updateViewList === 'function') updateViewList();
        });
      }
      var entry = localEntries[index];
      var cattleId = (entry && entry.cattleId) ? String(entry.cattleId).trim() : '';
      if (!cattleId) { index++; setSyncProgress(index, 'Синхронизация…'); return next(); }
      var isUpdate = !!serverByCattleId[cattleId];
      var p = isUpdate
        ? window.CattleTrackerApi.updateEntry(objectId, cattleId, entry)
        : window.CattleTrackerApi.createEntry(objectId, entry);
      return p.then(function () {
        entry.synced = true;
        index++;
        setSyncProgress(index, 'Синхронизация…');
        return next();
      }).catch(function (err) {
        finish();
        updateSyncServerStatus('Ошибка: ' + (err && err.message ? err.message : ''), true);
      });
    }
    return next();
  }).catch(function (err) {
    finish();
    var msg = (err && err.message) ? err.message : 'Ошибка синхронизации';
    updateSyncServerStatus(msg, true);
    updateConnectionIndicator(false);
  });
}

/**
 * Проверка доступности сервера (GET /api/health) и обновление статуса на экране синхронизации.
 */
function updateSyncServerStatusFromHealth() {
  if (typeof window === 'undefined' || !window.CATTLE_TRACKER_USE_API || !window.CattleTrackerApi) {
    updateConnectionIndicator(false);
    return;
  }
  var base = window.CattleTrackerApi.getBaseUrl ? window.CattleTrackerApi.getBaseUrl() : '';
  if (!base) {
    updateConnectionIndicator(false);
    return;
  }
  updateSyncServerStatus('Проверка…');
  fetch(base + '/api/health').then(function (res) {
    if (res.ok) {
      updateSyncServerStatus('Подключено к серверу: ' + base);
      updateConnectionIndicator(true);
    } else {
      updateSyncServerStatus('Ошибка подключения (код ' + res.status + ')', true);
      updateConnectionIndicator(false);
    }
  }).catch(function (err) {
    updateSyncServerStatus('Ошибка: ' + (err && err.message ? err.message : 'нет связи'), true);
    updateConnectionIndicator(false);
  });
}

/**
 * Прогресс импорта базы с сервера (новая копия): тот же блок, что и при синхронизации.
 */
function setServerBaseImportProgressVisible(visible) {
  var block = document.getElementById('syncProgressBlock');
  var bar = document.getElementById('syncProgressBar');
  if (block) block.style.display = visible ? 'block' : 'none';
  if (!visible && bar) {
    bar.style.width = '0%';
    bar.setAttribute('aria-valuenow', '0');
  }
}

/**
 * @param {number} current — сколько записей уже отправлено (или 0 на этапе чтения)
 * @param {number} total — всего записей для копирования; 0 = неизвестно / этап без доли
 * @param {string} [label]
 */
function setServerBaseImportProgress(current, total, label) {
  var bar = document.getElementById('syncProgressBar');
  var progressLabel = document.getElementById('syncProgressLabel');
  var progressText = document.getElementById('syncProgressText');
  var pct = 0;
  if (total > 0) {
    pct = Math.min(100, Math.round((current / total) * 100));
  } else if (label && String(label).indexOf('Чтение') !== -1) {
    pct = 8;
  }
  if (bar) {
    bar.style.width = pct + '%';
    bar.setAttribute('aria-valuenow', pct);
  }
  if (progressLabel && label !== undefined && label !== null) progressLabel.textContent = label;
  if (progressText) {
    progressText.textContent = total > 0 ? (current + ' / ' + total) : '—';
  }
}

function setSyncBasesImportButtonsDisabled(disabled) {
  document.querySelectorAll('.sync-base-import-btn').forEach(function (btn) {
    btn.disabled = !!disabled;
  });
}

window.updateConnectionIndicator = updateConnectionIndicator;
window.updateSyncServerStatus = updateSyncServerStatus;
window.refreshFromServer = refreshFromServer;
window.syncCurrentBaseToServer = syncCurrentBaseToServer;
window.updateSyncServerStatusFromHealth = updateSyncServerStatusFromHealth;
window.setServerBaseImportProgressVisible = setServerBaseImportProgressVisible;
window.setServerBaseImportProgress = setServerBaseImportProgress;
window.setSyncBasesImportButtonsDisabled = setSyncBasesImportButtonsDisabled;

export {};
