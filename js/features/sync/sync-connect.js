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
 * Отправить текущую базу на сервер (с синхронизацией записей).
 * Если уже подключён: текущая база есть на сервере — синхронизация; иначе — создание объекта и выгрузка.
 * Если не подключён — подключиться и после перезагрузки выгрузить базу.
 */
function sendToServer() {
  var useApi = typeof window !== 'undefined' && window.CATTLE_TRACKER_USE_API && window.CattleTrackerApi;
  if (useApi) {
    var currentId = typeof getCurrentObjectId === 'function' ? getCurrentObjectId() : '';
    var basesCache = typeof window.__getSyncBasesCache === 'function' ? window.__getSyncBasesCache() : null;
    var onServer = basesCache && basesCache.some(function (o) { return o.id === currentId; });
    if (onServer && currentId) {
      if (typeof window.syncCurrentBaseToServer === 'function') window.syncCurrentBaseToServer();
    } else {
      if (typeof window.uploadCurrentBaseToServer === 'function') window.uploadCurrentBaseToServer();
    }
    return;
  }
  try {
    localStorage.setItem('cattleTracker_uploadAfterConnect', '1');
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
 * Адрес для первого подключения: поле на экране «Синхронизация» или на экране входа (локальный блок), иначе последний успешный URL, иначе из сборки.
 */
function resolveConnectServerUrlForFirstConnect() {
  var input = document.getElementById('syncConnectServerUrlInput');
  var authInput = document.getElementById('authLocalConnectServerUrlInput');
  var fromField = input && String(input.value || '').trim();
  var fromAuth = authInput && String(authInput.value || '').trim();
  var def =
    typeof window !== 'undefined' && window.CATTLE_TRACKER_DEFAULT_SERVER_URL != null
      ? String(window.CATTLE_TRACKER_DEFAULT_SERVER_URL).trim()
      : '';
  var tryLast = '';
  try {
    tryLast = (localStorage.getItem('cattleTracker_lastConnectUrl') || '').trim();
  } catch (e) {}
  var raw = fromField || fromAuth || tryLast || def;
  return normalizeConnectServerUrl(raw);
}

/** Выйти из режима «ожидается вход на API» и выбрать другой узел (логин хранится на сервере). */
function switchToPickAnotherApiServer() {
  try {
    localStorage.removeItem('cattleTracker_useApiMode');
    localStorage.removeItem('cattleTracker_apiBase');
    localStorage.removeItem('cattleTracker_apiToken');
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
    try { localStorage.setItem('cattleTracker_uploadAfterConnect', '1'); } catch (e) {}
  }
  var url = resolveConnectServerUrlForFirstConnect();
  if (!url) {
    if (typeof showToast === 'function') {
      showToast('Укажите адрес API в поле ниже (http:// или https://) или задайте адрес по умолчанию в сборке.', 'error', 7000);
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
    function doConnect(syncAfter) {
      try {
        localStorage.setItem('cattleTracker_apiBase', url);
        try {
          localStorage.setItem('cattleTracker_lastConnectUrl', url);
        } catch (e2) {}
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
