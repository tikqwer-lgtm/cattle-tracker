/** Фрагмент модуля синхронизации; фасад: ../sync.js */
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
    '<h4>Несохранённые на сервере данные</h4>' +
    '<p>У вас есть <strong>' + count + '</strong> записей, не отправленных на сервер. Что сделать перед подключением?</p>' +
    '<div style="display:flex;flex-direction:column;gap:8px;">' +
    '<button type="button" class="action-btn" data-action="backup">Сохранить резервную копию</button>' +
    '<button type="button" class="action-btn" data-action="upload">Выгрузить на сервер после подключения</button>' +
    '<button type="button" class="small-btn" data-action="skip">Пропустить</button>' +
    '</div></div>';

  overlay.querySelector('[data-action="backup"]').onclick = function () {
    if (typeof exportBackupToFile === 'function') exportBackupToFile();
    overlay.remove();
    document.body.style.overflow = '';
    onDone('backup');
  };
  overlay.querySelector('[data-action="upload"]').onclick = function () {
    overlay.remove();
    document.body.style.overflow = '';
    onDone('upload');
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
 * Выгрузить текущую базу на сервер: новый объект с именем или полная замена записей существующего объекта на сервере.
 * Если не подключён — подключиться и после перезагрузки повторить выгрузку.
 */
function sendToServer() {
  if (window.CATTLE_TRACKER_USE_API && typeof window.isMobile === 'function' && window.isMobile()) {
    if (typeof showToast === 'function') {
      showToast('На телефоне доступна только загрузка баз с сервера (кнопка «Загрузить» в списке).', 'info', 5000);
    }
    return;
  }
  var useApi = typeof window !== 'undefined' && window.CATTLE_TRACKER_USE_API && window.CattleTrackerApi;
  if (useApi) {
    var currentId = typeof getCurrentObjectId === 'function' ? getCurrentObjectId() : '';
    var basesCache = typeof window.__getSyncBasesCache === 'function' ? window.__getSyncBasesCache() : null;
    var onServer = basesCache && basesCache.some(function (o) { return o.id === currentId; });
    if (onServer && currentId) {
      if (typeof window.overwriteCurrentServerBaseWithLocal === 'function') window.overwriteCurrentServerBaseWithLocal();
    } else {
      if (typeof window.uploadCurrentBaseToServer === 'function') window.uploadCurrentBaseToServer();
    }
    return;
  }
  try {
    localStorage.setItem('cattleTracker_sendToServerAfterConnect', '1');
  } catch (e) {}
  connectToServer();
}

function normalizeConnectServerUrl(u) {
  var s = String(u || '').trim().replace(/\/$/, '');
  if (s.length >= 4 && s.slice(-4).toLowerCase() === '/api') {
    s = s.slice(0, -4).replace(/\/$/, '');
  }
  return s;
}

/**
 * Адрес для первого подключения: select сервера на auth → поле синхронизации → последний URL → каталог/сборка.
 */
function resolveConnectServerUrlForFirstConnect() {
  var select = document.getElementById('authServerSelect');
  if (select && select.value && typeof window.getCattleTrackerServerById === 'function') {
    var fromSelect = window.getCattleTrackerServerById(select.value);
    if (fromSelect && fromSelect.url) return normalizeConnectServerUrl(fromSelect.url);
  }
  var input = document.getElementById('syncConnectServerUrlInput');
  var fromField = input && String(input.value || '').trim();
  var def =
    typeof window !== 'undefined' && window.CATTLE_TRACKER_DEFAULT_SERVER_URL != null
      ? String(window.CATTLE_TRACKER_DEFAULT_SERVER_URL).trim()
      : '';
  var tryLast = '';
  try {
    tryLast = (localStorage.getItem('cattleTracker_lastConnectUrl') || '').trim();
  } catch (e) {}
  var raw = fromField || tryLast || def;
  return normalizeConnectServerUrl(raw);
}

/** Выйти из режима «ожидается вход на API» и выбрать другой узел (логин хранится на сервере). */
function switchToPickAnotherApiServer() {
  try {
    localStorage.removeItem('cattleTracker_useApiMode');
    localStorage.removeItem('cattleTracker_apiBase');
    localStorage.removeItem('cattleTracker_apiToken');
    localStorage.removeItem('cattleTracker_currentUser');
  } catch (e) {}
  location.reload();
}

/**
 * Подключиться к серверу: адрес из поля на экране «Синхронизация», иначе последний успешный URL, иначе CATTLE_TRACKER_DEFAULT_SERVER_URL.
 * Проверить доступность, при несинхронизированных данных — диалог, сохранить в localStorage и перезагрузить.
 * @param {{ uploadAfterConnect?: boolean }} [opts] — если uploadAfterConnect: true, после перезагрузки будет вызван uploadCurrentBaseToServer
 */
function connectToServer(opts) {
  if (opts && opts.uploadAfterConnect) {
    try { localStorage.setItem('cattleTracker_sendToServerAfterConnect', '1'); } catch (e) {}
  }
  var url = resolveConnectServerUrlForFirstConnect();
  if (!url) {
    if (typeof showToast === 'function') {
      showToast('Выберите сервер в списке на экране входа или укажите адрес в «Синхронизация».', 'error', 7000);
    }
    return;
  }
  if (!/^https?:\/\//i.test(url)) {
    if (typeof showToast === 'function') {
      showToast('Адрес должен начинаться с http:// или https:// — логин и пароль проверяются на выбранном сервере.', 'error', 7000);
    }
    return;
  }
  if (typeof showToast === 'function') showToast('Проверка подключения…', 'info');
  fetch(url + '/api/health').then(function (res) {
    if (!res.ok) {
      if (typeof showToast === 'function') showToast('Сервер недоступен (код ' + res.status + ')', 'error', 6000);
      return;
    }
    function doConnect(sendAfter) {
      try {
        localStorage.setItem('cattleTracker_apiBase', url);
        try {
          localStorage.setItem('cattleTracker_lastConnectUrl', url);
        } catch (e2) {}
        localStorage.setItem('cattleTracker_useApiMode', '1');
        if (sendAfter) {
          try { localStorage.setItem('cattleTracker_sendToServerAfterConnect', '1'); } catch (e3) {}
        }
        if (typeof showToast === 'function') showToast('Подключено. Перезагрузка…', 'success');
        location.reload();
      } catch (e) {
        if (typeof showToast === 'function') showToast('Ошибка сохранения', 'error');
      }
    }
    if (hasUnsyncedEntries()) {
      showUnsyncedDataPrompt(function (choice) {
        doConnect(choice === 'upload');
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
    localStorage.removeItem('cattleTracker_apiToken');
    localStorage.removeItem('cattleTracker_syncAfterConnect');
    localStorage.removeItem('cattleTracker_sendToServerAfterConnect');
    localStorage.removeItem('cattleTracker_uploadAfterConnect');
    if (typeof window.saveCurrentUser === 'function') window.saveCurrentUser(null);
    else if (typeof window.clearAuthSession === 'function') window.clearAuthSession();
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

function bindAdminSyncServerUrlControls() {
  var btn = document.getElementById('syncAdminServerUrlApplyBtn');
  if (!btn || btn.dataset.bound === '1') return;
  btn.dataset.bound = '1';
  btn.addEventListener('click', function () {
    applyAdminSyncServerUrl();
  });
}

/**
 * Смена URL API (только администратор, режим подключения к серверу): проверка /api/health, сохранение, сброс токена, перезагрузка.
 */
function applyAdminSyncServerUrl() {
  var useApi = typeof window !== 'undefined' && window.CATTLE_TRACKER_USE_API && window.CattleTrackerApi;
  if (!useApi) return;
  var user = typeof window.getCurrentUser === 'function' ? window.getCurrentUser() : null;
  if (!user || user.role !== 'admin') return;

  var input = document.getElementById('syncAdminServerUrlInput');
  if (!input) return;
  var api = window.CattleTrackerApi;
  var url = typeof api.normalizeApiBaseInput === 'function' ? api.normalizeApiBaseInput(input.value) : '';
  if (!url) {
    if (typeof showToast === 'function') showToast('Введите адрес (например https://сервер:3000)', 'error', 5000);
    return;
  }
  if (!/^https?:\/\//i.test(url)) {
    if (typeof showToast === 'function') showToast('Адрес должен начинаться с http:// или https://', 'error', 5000);
    return;
  }
  if (typeof showToast === 'function') showToast('Проверка подключения…', 'info');
  fetch(url + '/api/health')
    .then(function (res) {
      if (!res.ok) {
        if (typeof showToast === 'function') showToast('Сервер ответил с кодом ' + res.status, 'error', 6000);
        return;
      }
      if (typeof api.setToken === 'function') api.setToken(null);
      if (typeof api.setPersistedApiBase !== 'function' || !api.setPersistedApiBase(url)) {
        if (typeof showToast === 'function') showToast('Не удалось сохранить адрес', 'error');
        return;
      }
      try {
        localStorage.setItem('cattleTracker_useApiMode', '1');
      } catch (e) {}
      if (typeof showToast === 'function') showToast('Адрес сохранён. Перезагрузка…', 'success');
      setTimeout(function () {
        location.reload();
      }, 400);
    })
    .catch(function (err) {
      var reason =
        err && err.message && err.message.indexOf('Failed to fetch') !== -1
          ? 'Не удалось связаться с сервером'
          : err && err.message
            ? err.message
            : 'нет связи';
      if (typeof showToast === 'function') showToast('Ошибка: ' + reason, 'error', 6000);
    });
}

window.hasUnsyncedEntries = hasUnsyncedEntries;
window.showUnsyncedDataPrompt = showUnsyncedDataPrompt;
window.sendToServer = sendToServer;
window.connectToServer = connectToServer;
window.disconnectFromServer = disconnectFromServer;
window.bindAdminSyncServerUrlControls = bindAdminSyncServerUrlControls;
window.applyAdminSyncServerUrl = applyAdminSyncServerUrl;
window.switchToPickAnotherApiServer = switchToPickAnotherApiServer;

export {};
