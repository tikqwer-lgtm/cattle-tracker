/** Адрес сервера по умолчанию берётся из js/config.js (CATTLE_TRACKER_DEFAULT_SERVER_URL). */

/**
 * Синхронизация реализована через сервер API (Настройки → Войти → адрес сервера).
 * Кнопка «Подключиться к серверу» использует адрес из конфига (js/config.js), если задан.
 */

// --- Синхронизация с сервером API ---

/**
 * Проверяет, есть ли локальные записи с synced === false.
 */
function hasUnsyncedEntries() {
  var list = (typeof window.entries !== 'undefined' && Array.isArray(window.entries)) ? window.entries : [];
  return list.some(function (e) { return e && e.synced !== true; });
}

/**
 * Показывает модальное окно выбора действий при наличии несинхронизированных данных.
 * @param {function} onDone — вызывается после выбора (продолжить подключение).
 */
function showUnsyncedDataPrompt(onDone) {
  var count = 0;
  var list = (typeof window.entries !== 'undefined' && Array.isArray(window.entries)) ? window.entries : [];
  list.forEach(function (e) { if (e && e.synced !== true) count++; });

  var overlay = document.createElement('div');
  overlay.className = 'sync-replace-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-label', 'Несинхронизированные данные');
  overlay.innerHTML = '<div class="sync-replace-modal">' +
    '<h4>Несинхронизированные данные</h4>' +
    '<p>У вас есть <strong>' + count + '</strong> записей, не отправленных на сервер. Что сделать перед подключением?</p>' +
    '<div style="display:flex;flex-direction:column;gap:8px;">' +
    '<button type="button" class="action-btn" data-action="backup">Сохранить резервную копию</button>' +
    '<button type="button" class="action-btn" data-action="sync">Синхронизировать с сервером</button>' +
    '<button type="button" class="small-btn" data-action="skip">Пропустить</button>' +
    '</div></div>';

  overlay.querySelector('[data-action="backup"]').onclick = function () {
    if (typeof exportBackupToFile === 'function') exportBackupToFile();
    overlay.remove();
    document.body.style.overflow = '';
    onDone('backup');
  };
  overlay.querySelector('[data-action="sync"]').onclick = function () {
    overlay.remove();
    document.body.style.overflow = '';
    onDone('sync');
  };
  overlay.querySelector('[data-action="skip"]').onclick = function () {
    overlay.remove();
    document.body.style.overflow = '';
    onDone('skip');
  };
  overlay.addEventListener('click', function (e) { if (e.target === overlay) { overlay.remove(); document.body.style.overflow = ''; onDone('skip'); } });
  document.body.style.overflow = 'hidden';
  document.body.appendChild(overlay);
}

/**
 * Подключиться к серверу: взять адрес из конфига (CATTLE_TRACKER_DEFAULT_SERVER_URL),
 * проверить доступность, при наличии несинхронизированных данных — предложить действие,
 * сохранить в localStorage и перезагрузить.
 */
function connectToServer() {
  var url = (typeof window !== 'undefined' && window.CATTLE_TRACKER_DEFAULT_SERVER_URL != null)
    ? String(window.CATTLE_TRACKER_DEFAULT_SERVER_URL).trim().replace(/\/$/, '')
    : '';
  if (!url) {
    if (typeof showToast === 'function') showToast('Адрес сервера не задан в конфигурации.', 'error', 6000);
    return;
  }
  if (typeof showToast === 'function') showToast('Проверка подключения…', 'info');
  fetch(url + '/api/health').then(function (res) {
    if (!res.ok) {
      if (typeof showToast === 'function') showToast('Сервер недоступен (код ' + res.status + ')', 'error', 6000);
      return;
    }
    function doConnect(syncAfter) {
      try {
        localStorage.setItem('cattleTracker_apiBase', url);
        localStorage.setItem('cattleTracker_useApiMode', '1');
        if (syncAfter) localStorage.setItem('cattleTracker_syncAfterConnect', '1');
        if (typeof showToast === 'function') showToast('Подключено. Перезагрузка…', 'success');
        location.reload();
      } catch (e) {
        if (typeof showToast === 'function') showToast('Ошибка сохранения', 'error');
      }
    }
    if (hasUnsyncedEntries()) {
      showUnsyncedDataPrompt(function (choice) {
        doConnect(choice === 'sync');
      });
    } else {
      doConnect(false);
    }
  }).catch(function (err) {
    var reason = (err && err.message && err.message.indexOf('Failed to fetch') !== -1)
      ? 'Не удалось связаться с сервером'
      : (err && err.message ? err.message : 'нет связи');
    if (typeof showToast === 'function') showToast('Ошибка: ' + reason, 'error', 6000);
  });
}

/**
 * Отключиться от сервера: удалить адрес из localStorage и перезагрузить (режим локальных данных).
 */
function doDisconnect() {
  try {
    var list = (typeof window.entries !== 'undefined' && Array.isArray(window.entries)) ? window.entries : [];
    list.forEach(function (e) { if (e) e.synced = false; });
    if (typeof saveLocally === 'function') saveLocally();
    localStorage.removeItem('cattleTracker_apiBase');
    localStorage.removeItem('cattleTracker_useApiMode');
    localStorage.removeItem('cattleTracker_syncAfterConnect');
    if (typeof window.saveCurrentUser === 'function') window.saveCurrentUser(null);
    if (typeof showToast === 'function') showToast('Отключение… Перезагрузка.', 'info');
    location.reload();
  } catch (e) {
    if (typeof showToast === 'function') showToast('Ошибка', 'error');
  }
}

function disconnectFromServer() {
  if (typeof showConfirmModal === 'function') {
    showConfirmModal('Отключиться от сервера? Данные останутся локально и будут помечены как несинхронизированные.').then(function (ok) {
      if (!ok) return;
      doDisconnect();
    });
    return;
  }
  if (!confirm('Отключиться от сервера? Данные останутся локально и будут помечены как несинхронизированные.')) return;
  doDisconnect();
}

/**
 * Обновляет индикатор подключения (лампочка) на экране Синхронизация и в шапке.
 * @param {boolean} connected - true: зелёный, false: красный
 */
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

function formatServerDate(isoStr) {
  if (!isoStr) return '—';
  var d = new Date(isoStr);
  if (isNaN(d.getTime())) return isoStr;
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

var _syncBasesData = [];
var _syncBasesSort = { key: 'name', dir: 'asc' };
var _syncBasesFilterName = '';
var _syncBasesFilterUser = '';

function getCurrentUsername() {
  if (typeof window.getCurrentUser === 'function') {
    var u = window.getCurrentUser();
    return u && u.username ? String(u.username) : '';
  }
  return '';
}

function renderSyncBasesFilters() {
  var filterEl = document.getElementById('syncBasesFilter');
  if (!filterEl) return;
  filterEl.innerHTML =
    '<div class="sync-bases-filter-row">' +
    '<input type="text" id="syncFilterName" class="sync-filter-input" placeholder="Фильтр по названию" value="' + (_syncBasesFilterName || '').replace(/"/g, '&quot;') + '" />' +
    '<input type="text" id="syncFilterUser" class="sync-filter-input" placeholder="Фильтр по пользователю" value="' + (_syncBasesFilterUser || '').replace(/"/g, '&quot;') + '" />' +
    '</div>';
  var nameInp = document.getElementById('syncFilterName');
  var userInp = document.getElementById('syncFilterUser');
  function onFilter() {
    _syncBasesFilterName = (nameInp ? nameInp.value : '').trim().toLowerCase();
    _syncBasesFilterUser = (userInp ? userInp.value : '').trim().toLowerCase();
    renderSyncBasesTable();
  }
  if (nameInp) nameInp.addEventListener('input', onFilter);
  if (userInp) userInp.addEventListener('input', onFilter);
}

function renderSyncBasesTable() {
  var container = document.getElementById('syncServerBasesList');
  if (!container) return;
  var currentId = typeof getCurrentObjectId === 'function' ? getCurrentObjectId() : '';
  var currentUser = getCurrentUsername();
  var filtered = _syncBasesData.filter(function (obj) {
    var n = (obj.name || '').toLowerCase();
    var u = (obj._user || '').toLowerCase();
    if (_syncBasesFilterName && n.indexOf(_syncBasesFilterName) === -1) return false;
    if (_syncBasesFilterUser && u.indexOf(_syncBasesFilterUser) === -1) return false;
    return true;
  });
  var sk = _syncBasesSort.key;
  var sd = _syncBasesSort.dir === 'asc' ? 1 : -1;
  filtered.sort(function (a, b) {
    var va = '', vb = '';
    if (sk === 'name') { va = (a.name || '').toLowerCase(); vb = (b.name || '').toLowerCase(); }
    else if (sk === 'date') { va = a._dateRaw || ''; vb = b._dateRaw || ''; }
    else if (sk === 'user') { va = (a._user || '').toLowerCase(); vb = (b._user || '').toLowerCase(); }
    else if (sk === 'count') { return (a._count - b._count) * sd; }
    return va < vb ? -sd : (va > vb ? sd : 0);
  });

  var arrow = function (key) { return _syncBasesSort.key === key ? (_syncBasesSort.dir === 'asc' ? ' ▲' : ' ▼') : ''; };
  var html = '<table class="sync-bases-table"><thead><tr>' +
    '<th class="sync-sortable" data-sort="name">Название' + arrow('name') + '</th>' +
    '<th class="sync-sortable" data-sort="date">Дата изменения' + arrow('date') + '</th>' +
    '<th class="sync-sortable" data-sort="user">Пользователь' + arrow('user') + '</th>' +
    '<th class="sync-sortable" data-sort="count">Записей' + arrow('count') + '</th>' +
    '<th>Действия</th></tr></thead><tbody>';

  filtered.forEach(function (obj) {
    var safeName = (obj.name || '').replace(/</g, '&lt;').replace(/"/g, '&quot;');
    var safeId = String(obj.id).replace(/'/g, "\\'");
    var safeSrcName = String(obj.name || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
    var isOwner = currentUser && obj._user && obj._user.toLowerCase() === currentUser.toLowerCase();
    html += '<tr data-base-id="' + String(obj.id).replace(/"/g, '&quot;') + '">' +
      '<td data-label="Название">' + safeName + '</td>' +
      '<td data-label="Дата">' + obj._dateStr + '</td>' +
      '<td data-label="Пользователь">' + (obj._user || '—').replace(/</g, '&lt;') + '</td>' +
      '<td data-label="Записей">' + obj._count + '</td>' +
      '<td class="sync-bases-actions" data-label="Действия">' +
      '<button type="button" class="small-btn" onclick="showLoadBaseModal(\'' + safeId + '\', \'' + safeSrcName + '\')">Загрузить</button>' +
      (isOwner ? ' <button type="button" class="small-btn sync-current-base-btn" onclick="syncCurrentBaseToServer()">Синхронизировать</button>' : '') +
      '</td></tr>';
  });

  var currentOnServer = _syncBasesData.some(function (o) { return o.id === currentId; });
  if (!currentOnServer && currentId) {
    html += '<tr><td colspan="4">Текущая база не на сервере</td><td class="sync-bases-actions">' +
      '<button type="button" class="small-btn sync-current-base-btn" onclick="uploadCurrentBaseToServer()">Синхронизировать</button>' +
      '</td></tr>';
  }

  html += '</tbody></table>';
  if (filtered.length === 0 && _syncBasesData.length === 0 && !currentId) {
    container.innerHTML = '<p class="sync-empty">На сервере пока нет баз.</p>';
    return;
  }
  container.innerHTML = html;

  container.querySelectorAll('.sync-sortable').forEach(function (th) {
    th.style.cursor = 'pointer';
    th.addEventListener('click', function () {
      var key = th.getAttribute('data-sort');
      if (_syncBasesSort.key === key) {
        _syncBasesSort.dir = _syncBasesSort.dir === 'asc' ? 'desc' : 'asc';
      } else {
        _syncBasesSort.key = key;
        _syncBasesSort.dir = 'asc';
      }
      renderSyncBasesTable();
    });
  });
}

function renderSyncServerBasesList() {
  var container = document.getElementById('syncServerBasesList');
  if (!container || !window.CATTLE_TRACKER_USE_API || !window.CattleTrackerApi) return;
  container.innerHTML = '<p class="sync-loading">Загрузка списка…</p>';
  window.CattleTrackerApi.getObjectsList().then(function (list) {
    list = list || [];
    _syncBasesData = list.map(function (obj) {
      var dateRaw = obj.last_updated_at || obj.lastUpdatedAt || obj.created_at || '';
      var userRaw = obj.last_modified_by != null ? obj.last_modified_by : (obj.lastModifiedBy != null ? obj.lastModifiedBy : null);
      var rawCount = obj.entries_count != null ? obj.entries_count : obj.entriesCount;
      obj._dateRaw = dateRaw;
      obj._dateStr = formatServerDate(dateRaw);
      obj._user = (userRaw !== null && userRaw !== '') ? String(userRaw) : '';
      obj._count = (rawCount !== undefined && rawCount !== null && rawCount !== '') ? Number(rawCount) : 0;
      return obj;
    });
    renderSyncBasesFilters();
    renderSyncBasesTable();
  }).catch(function (err) {
    container.innerHTML = '<p class="sync-server-status-error">Ошибка загрузки списка: ' + (err && err.message ? err.message : '') + '</p>';
  });
}

/**
 * Показывает модалку выбора локальной базы для загрузки серверной базы.
 */
function showLoadBaseModal(sourceId, sourceName) {
  if (!window.CATTLE_TRACKER_USE_API || !window.CattleTrackerApi) return;
  var localObjects = typeof window.getObjectsList === 'function' ? (window.getObjectsList() || []) : [];

  var overlay = document.createElement('div');
  overlay.className = 'sync-replace-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-label', 'Загрузка базы');
  var optionsHtml = localObjects.map(function (o) {
    return '<option value="' + String(o.id).replace(/"/g, '&quot;') + '">' + (o.name || o.id).replace(/</g, '&lt;') + '</option>';
  }).join('');

  overlay.innerHTML = '<div class="sync-replace-modal">' +
    '<h4>Загрузить базу «' + String(sourceName || '').replace(/</g, '&lt;') + '»</h4>' +
    '<p>Выберите локальную базу для загрузки данных или создайте новую:</p>' +
    '<select id="syncLoadTargetSelect" class="sync-replace-select">' +
    '<option value="__new__">+ Создать новую базу</option>' +
    optionsHtml +
    '</select>' +
    '<div id="syncLoadNewNameWrap" style="margin-bottom:12px;">' +
    '<input type="text" id="syncLoadNewName" class="sync-replace-select" placeholder="Название новой базы" value="' + String(sourceName || '').replace(/"/g, '&quot;') + '" />' +
    '</div>' +
    '<div class="sync-replace-actions">' +
    '<button type="button" class="small-btn" data-action="cancel">Отмена</button> ' +
    '<button type="button" class="action-btn" data-action="load">Загрузить</button>' +
    '</div></div>';

  var select = overlay.querySelector('#syncLoadTargetSelect');
  var newNameWrap = overlay.querySelector('#syncLoadNewNameWrap');
  function toggleNewName() {
    if (newNameWrap) newNameWrap.style.display = select.value === '__new__' ? '' : 'none';
  }
  select.addEventListener('change', toggleNewName);
  toggleNewName();

  function close() { overlay.remove(); document.body.style.overflow = ''; }
  overlay.querySelector('[data-action="cancel"]').onclick = close;
  overlay.querySelector('[data-action="load"]').onclick = function () {
    var targetVal = select.value;
    if (targetVal === '__new__') {
      var newName = (document.getElementById('syncLoadNewName') || {}).value;
      if (!newName || !String(newName).trim()) {
        if (typeof showToast === 'function') showToast('Введите название базы', 'error');
        return;
      }
      close();
      loadServerBaseIntoNewObject(sourceId, String(newName).trim());
    } else {
      close();
      replaceServerBaseInObject(sourceId, targetVal);
    }
  };
  overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
  document.body.style.overflow = 'hidden';
  document.body.appendChild(overlay);
}

/**
 * Загрузить текущую базу (записи) на сервер: создать объект и отправить все записи.
 */
function uploadCurrentBaseToServer() {
  if (!window.CATTLE_TRACKER_USE_API || !window.CattleTrackerApi) return;
  var name = prompt('Название базы на сервере:', 'Текущая база');
  if (name === null || !String(name).trim()) return;
  name = String(name).trim();
  var statusEl = document.getElementById('syncServerStatus');
  var list = (typeof window.entries !== 'undefined' && Array.isArray(window.entries)) ? window.entries : [];
  if (statusEl) statusEl.textContent = 'Создание объекта на сервере…';
  window.CattleTrackerApi.createObject(name).then(function (newObj) {
    if (!list.length) {
      if (statusEl) statusEl.textContent = 'Объект «' + name + '» создан на сервере (записей 0).';
      renderSyncServerBasesList();
      if (typeof window.loadObjectsFromApi === 'function') window.loadObjectsFromApi();
      if (typeof window.loadLocally === 'function') window.loadLocally();
      if (typeof window.updateObjectSwitcher === 'function') window.updateObjectSwitcher();
      window.CattleTrackerApi.setCurrentObjectId(newObj.id);
      if (typeof window.loadLocally === 'function') window.loadLocally();
      return;
    }
    var i = 0;
    function next() {
      if (i >= list.length) {
        if (statusEl) statusEl.textContent = 'Готово: база «' + name + '» на сервере, записей ' + list.length + '.';
        renderSyncServerBasesList();
        if (typeof window.loadObjectsFromApi === 'function') window.loadObjectsFromApi();
        window.CattleTrackerApi.setCurrentObjectId(newObj.id);
        if (typeof window.loadLocally === 'function') window.loadLocally();
        if (typeof window.updateObjectSwitcher === 'function') window.updateObjectSwitcher();
        return;
      }
      window.CattleTrackerApi.createEntry(newObj.id, list[i]).then(function () { i++; next(); }).catch(function (err) {
        if (statusEl) { statusEl.textContent = 'Ошибка: ' + (err && err.message ? err.message : ''); statusEl.className = 'sync-server-status sync-server-status-error'; }
      });
    }
    next();
  }).catch(function (err) {
    if (statusEl) { statusEl.textContent = 'Ошибка: ' + (err && err.message ? err.message : ''); statusEl.className = 'sync-server-status sync-server-status-error'; }
  });
}

/**
 * Открыть модальное окно для ввода имени нового объекта при импорте с сервера.
 */
function showImportNewObjectModal(sourceId, sourceName) {
  var modal = document.getElementById('addObjectModal');
  var input = document.getElementById('addObjectNameInput');
  var titleEl = document.getElementById('addObjectModalTitle');
  var okBtn = document.getElementById('addObjectModalOkBtn');
  if (!modal || !input) return;
  modal.setAttribute('data-editing-id', '');
  modal.setAttribute('data-import-source-id', sourceId || '');
  if (titleEl) titleEl.textContent = 'Импорт в новый объект';
  if (okBtn) okBtn.textContent = 'Импортировать';
  input.value = (sourceName && String(sourceName).trim()) ? String(sourceName).trim() + ' (копия)' : 'Копия базы';
  modal.classList.add('active');
  modal.setAttribute('aria-hidden', 'false');
  modal.removeAttribute('hidden');
  setTimeout(function () { if (input) input.focus(); }, 0);
}

/**
 * Импорт базы с сервера в новый объект. name — если передан, не показывать prompt (уже введено в модалке).
 */
function loadServerBaseIntoNewObject(sourceId, name) {
  if (!window.CATTLE_TRACKER_USE_API || !window.CattleTrackerApi) return;
  if (name === undefined || name === null) {
    name = prompt('Название нового объекта:', 'Копия базы');
    if (name === null || !String(name).trim()) return;
  }
  name = String(name).trim();
  var statusEl = document.getElementById('syncServerStatus');
  if (statusEl) statusEl.textContent = 'Создание объекта и копирование записей…';
  window.CattleTrackerApi.createObject(name).then(function (newObj) {
    return window.CattleTrackerApi.loadEntries(sourceId).then(function (entries) {
      if (!entries || !entries.length) {
        if (statusEl) statusEl.textContent = 'Объект «' + name + '» создан (записей 0).';
        renderSyncServerBasesList();
        if (typeof window.loadLocally === 'function') window.loadLocally();
        return;
      }
      var i = 0;
      function next() {
        if (i >= entries.length) {
          if (statusEl) statusEl.textContent = 'Готово: объект «' + name + '», записей ' + entries.length + '.';
          renderSyncServerBasesList();
          if (typeof window.loadLocally === 'function') window.loadLocally();
          if (typeof window.updateObjectSwitcher === 'function') window.updateObjectSwitcher();
          return;
        }
        var entry = entries[i];
        window.CattleTrackerApi.createEntry(newObj.id, entry).then(function () { i++; next(); }).catch(function (err) {
          if (statusEl) statusEl.textContent = 'Ошибка: ' + (err && err.message ? err.message : ''); statusEl.className = 'sync-server-status sync-server-status-error';
        });
      }
      next();
    });
  }).catch(function (err) {
    if (statusEl) { statusEl.textContent = 'Ошибка: ' + (err && err.message ? err.message : ''); statusEl.className = 'sync-server-status sync-server-status-error'; }
  });
}

function showReplaceBaseModal(sourceId) {
  if (!window.CATTLE_TRACKER_USE_API || !window.CattleTrackerApi) return;
  window.CattleTrackerApi.getObjectsList().then(function (list) {
    var targets = list.filter(function (o) { return o.id !== sourceId; });
    if (!targets.length) { if (typeof showToast === 'function') showToast('Нет другого объекта для замены (нужна минимум ещё одна база).', 'info'); return; }
    var overlay = document.createElement('div');
    overlay.className = 'sync-replace-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-label', 'Выбор объекта для замены');
    var nameOpt = (list.filter(function (o) { return o.id === sourceId; })[0] || {}).name || sourceId;
    overlay.innerHTML = '<div class="sync-replace-modal">' +
      '<h4>Заменить данные в существующем объекте</h4>' +
      '<p>Источник: «' + String(nameOpt).replace(/</g, '&lt;') + '». Выберите объект, в котором заменить данные (текущие записи будут удалены):</p>' +
      '<select id="syncReplaceTargetSelect" class="sync-replace-select"></select>' +
      '<div class="sync-replace-actions">' +
      '<button type="button" class="small-btn" data-action="cancel">Отмена</button> ' +
      '<button type="button" class="action-btn" data-action="replace">Заменить</button>' +
      '</div></div>';
    var select = overlay.querySelector('#syncReplaceTargetSelect');
    targets.forEach(function (o) {
      var opt = document.createElement('option');
      opt.value = o.id;
      opt.textContent = o.name || o.id;
      select.appendChild(opt);
    });
    function close() {
      overlay.remove();
      document.body.style.overflow = '';
    }
    overlay.querySelector('[data-action="cancel"]').onclick = close;
    overlay.querySelector('[data-action="replace"]').onclick = function () {
      var targetId = select.value;
      if (!targetId) return;
      (typeof showConfirmModal === 'function' ? showConfirmModal('Заменить все данные в выбранном объекте? Текущие записи будут удалены.') : Promise.resolve(confirm('Заменить все данные в выбранном объекте? Текущие записи будут удалены.'))).then(function (ok) {
        if (!ok) return;
        close();
        replaceServerBaseInObject(sourceId, targetId);
      });
    };
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
    document.body.style.overflow = 'hidden';
    document.body.appendChild(overlay);
  }).catch(function (err) { if (typeof showToast === 'function') showToast('Ошибка: ' + (err && err.message ? err.message : ''), 'error'); else alert('Ошибка: ' + (err && err.message ? err.message : '')); });
}

function replaceServerBaseInObject(sourceId, targetId) {
  if (!window.CATTLE_TRACKER_USE_API || !window.CattleTrackerApi) return;
  var statusEl = document.getElementById('syncServerStatus');
  if (statusEl) statusEl.textContent = 'Загрузка и замена…';
  window.CattleTrackerApi.loadEntries(sourceId).then(function (sourceEntries) {
    return window.CattleTrackerApi.loadEntries(targetId).then(function (targetEntries) {
      var deleteNext = function (idx) {
        if (idx >= targetEntries.length) {
          var addNext = function (i) {
            if (i >= sourceEntries.length) {
              if (statusEl) statusEl.textContent = 'Готово: заменено записей ' + sourceEntries.length + '.';
              renderSyncServerBasesList();
              if (typeof window.loadLocally === 'function') window.loadLocally();
              return;
            }
            window.CattleTrackerApi.createEntry(targetId, sourceEntries[i]).then(function () { addNext(i + 1); }).catch(function (err) {
              if (statusEl) { statusEl.textContent = 'Ошибка: ' + (err && err.message ? err.message : ''); statusEl.className = 'sync-server-status sync-server-status-error'; }
            });
          };
          addNext(0);
          return;
        };
        window.CattleTrackerApi.deleteEntry(targetId, targetEntries[idx].cattleId).then(function () { deleteNext(idx + 1); }).catch(function (err) {
          if (statusEl) { statusEl.textContent = 'Ошибка удаления: ' + (err && err.message ? err.message : ''); statusEl.className = 'sync-server-status sync-server-status-error'; }
        });
      };
      deleteNext(0);
    });
  }).catch(function (err) {
    if (statusEl) { statusEl.textContent = 'Ошибка: ' + (err && err.message ? err.message : ''); statusEl.className = 'sync-server-status sync-server-status-error'; }
  });
}

function initSyncServerBlock() {
  var connectBlock = document.getElementById('sync-connect-block');
  var serverBlock = document.getElementById('sync-server-block');
  var useApi = typeof window !== 'undefined' && window.CATTLE_TRACKER_USE_API && window.CattleTrackerApi;
  if (connectBlock) connectBlock.style.display = useApi ? 'none' : '';
  if (serverBlock) serverBlock.style.display = useApi ? '' : 'none';
  if (useApi) {
    updateSyncServerStatusFromHealth();
    renderSyncServerBasesList();
    try {
      if (localStorage.getItem('cattleTracker_syncAfterConnect') === '1') {
        localStorage.removeItem('cattleTracker_syncAfterConnect');
        setTimeout(function () {
          if (typeof syncCurrentBaseToServer === 'function') syncCurrentBaseToServer();
        }, 1500);
      }
    } catch (e) {}
  } else {
    updateConnectionIndicator(false);
  }
}

if (typeof window !== 'undefined') {
  window.connectToServer = connectToServer;
  window.hasUnsyncedEntries = hasUnsyncedEntries;
  window.showUnsyncedDataPrompt = showUnsyncedDataPrompt;
  window.disconnectFromServer = disconnectFromServer;
  window.updateConnectionIndicator = updateConnectionIndicator;
  window.updateSyncServerStatus = updateSyncServerStatus;
  window.refreshFromServer = refreshFromServer;
  window.syncCurrentBaseToServer = syncCurrentBaseToServer;
  window.updateSyncServerStatusFromHealth = updateSyncServerStatusFromHealth;
  window.initSyncServerBlock = initSyncServerBlock;
  window.renderSyncServerBasesList = renderSyncServerBasesList;
  window.showLoadBaseModal = showLoadBaseModal;
  window.loadServerBaseIntoNewObject = loadServerBaseIntoNewObject;
  window.showReplaceBaseModal = showReplaceBaseModal;
  window.replaceServerBaseInObject = replaceServerBaseInObject;
  window.uploadCurrentBaseToServer = uploadCurrentBaseToServer;
  window.showImportNewObjectModal = showImportNewObjectModal;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSyncServerBlock);
  } else {
    initSyncServerBlock();
  }
}
export {};
