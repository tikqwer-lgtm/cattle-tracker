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
 * Обновить список баз с сервера (без принудительной перезагрузки всех записей текущей базы).
 * Вызывается при событии online и кнопкой проверки связи там, где подключён refreshFromServer.
 */
function refreshFromServer() {
  if (typeof window === 'undefined' || !window.CATTLE_TRACKER_USE_API || !window.CattleTrackerApi) {
    return Promise.resolve();
  }
  updateSyncServerStatus('Обновление списка баз…');
  var p = typeof window.loadObjectsFromApi === 'function' ? window.loadObjectsFromApi() : Promise.resolve();
  return p.then(function () {
    var base = window.CattleTrackerApi.getBaseUrl ? window.CattleTrackerApi.getBaseUrl() : '';
    updateSyncServerStatus('Подключено к серверу: ' + base);
    updateConnectionIndicator(true);
    if (typeof window.renderSyncServerBasesList === 'function') window.renderSyncServerBasesList();
    if (typeof window.updateObjectSwitcher === 'function') window.updateObjectSwitcher();
  }).catch(function (err) {
    var msg = (err && err.message) ? err.message : 'Ошибка подключения';
    updateSyncServerStatus('Ошибка: ' + msg, true);
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
  } else if (label && String(label).indexOf('Скачивание') !== -1) {
    pct = current > 0 ? Math.min(88, 15 + Math.min(70, Math.floor(Math.log((current || 0) + 1) * 22))) : 12;
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
window.updateSyncServerStatusFromHealth = updateSyncServerStatusFromHealth;
window.setServerBaseImportProgressVisible = setServerBaseImportProgressVisible;
window.setServerBaseImportProgress = setServerBaseImportProgress;
window.setSyncBasesImportButtonsDisabled = setSyncBasesImportButtonsDisabled;

export {};
