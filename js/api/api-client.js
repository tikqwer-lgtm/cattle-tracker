/**
 * api-client.js — слой обращения к Cattle Tracker API.
 * Используется когда включён режим API (CATTLE_TRACKER_USE_API + CATTLE_TRACKER_API_BASE).
 */
(function (global) {
  'use strict';

  var TOKEN_KEY = 'cattleTracker_apiToken';
  var CURRENT_OBJECT_KEY = 'cattleTracker_currentObject';
  /** Id баз, скрытых только на этом устройстве (не удаление на сервере). */
  var HIDDEN_OBJECTS_KEY = 'cattleTracker_hiddenObjectIds';
  /** Текущая база не выбрана — данные не грузим, выбор в «Синхронизация». */
  var PENDING_OBJECT_ID = '__pending_select__';

  function getHiddenObjectIds() {
    try {
      var raw = localStorage.getItem(HIDDEN_OBJECTS_KEY);
      var arr = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(arr)) return [];
      return arr.map(String).filter(Boolean);
    } catch (e) {
      return [];
    }
  }

  function filterObjectsListVisible(list) {
    var hidden = {};
    getHiddenObjectIds().forEach(function (id) { hidden[id] = true; });
    return (list || []).filter(function (o) { return o && o.id && !hidden[o.id]; });
  }

  /** Скрыть базу в списке на этом устройстве; на сервере объект не трогается. */
  function hideObjectLocal(id) {
    var sid = String(id || '').trim();
    if (!sid) {
      return Promise.reject(new Error('Не указана база'));
    }
    var map = {};
    getHiddenObjectIds().forEach(function (x) { map[x] = true; });
    map[sid] = true;
    try {
      localStorage.setItem(HIDDEN_OBJECTS_KEY, JSON.stringify(Object.keys(map)));
      return Promise.resolve();
    } catch (e) {
      return Promise.reject(new Error('Не удалось сохранить настройки'));
    }
  }

  function getBaseUrl() {
    var b = (global.CATTLE_TRACKER_API_BASE || '').trim().replace(/\/$/, '');
    // Если в настройках указали .../api, убираем хвост — пути в запросах уже с /api/...
    if (b.length >= 4 && b.slice(-4).toLowerCase() === '/api') {
      b = b.slice(0, -4).replace(/\/$/, '');
    }
    return b;
  }

  /** Нормализация ввода адреса API (без хвоста /api). */
  function normalizeApiBaseInput(s) {
    var u = String(s || '').trim().replace(/\/$/, '');
    if (u.length >= 4 && u.slice(-4).toLowerCase() === '/api') {
      u = u.slice(0, -4).replace(/\/$/, '');
    }
    return u;
  }

  /** Сохранить базовый URL в localStorage и в global (только http/https). */
  function setPersistedApiBase(url) {
    var u = normalizeApiBaseInput(url);
    if (!u || !/^https?:\/\//i.test(u)) return false;
    try {
      localStorage.setItem('cattleTracker_apiBase', u);
    } catch (e) {
      return false;
    }
    global.CATTLE_TRACKER_API_BASE = u;
    if (typeof global.mirrorMobileTelemetryConfig === 'function') {
      try {
        global.mirrorMobileTelemetryConfig();
      } catch (e2) {}
    }
    return true;
  }

  function getToken() {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch (e) {
      return null;
    }
  }

  function setToken(token) {
    var prev = null;
    try {
      prev = localStorage.getItem(TOKEN_KEY);
    } catch (e) {}
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token);
      else localStorage.removeItem(TOKEN_KEY);
    } catch (e) {}
    var next = token || '';
    var prevS = prev || '';
    if (next !== prevS && typeof global.clearAllApiEntriesCaches === 'function') {
      global.clearAllApiEntriesCaches();
    }
    if (typeof global.mirrorMobileTelemetryConfig === 'function') {
      try {
        global.mirrorMobileTelemetryConfig();
      } catch (e2) {}
    }
  }

  function request(method, path, body) {
    var base = getBaseUrl();
    if (!base) return Promise.reject(new Error('CATTLE_TRACKER_API_BASE не задан'));
    var opts = {
      method: method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (method === 'GET') opts.cache = 'no-cache';
    var token = getToken();
    if (token) opts.headers['Authorization'] = 'Bearer ' + token;
    if (body !== undefined) opts.body = JSON.stringify(body);
    return fetch(base + path, opts).then(function (res) {
      var contentType = res.headers.get('Content-Type') || '';
      var isJson = contentType.indexOf('application/json') !== -1;
      var isAdminOrReports = path.indexOf('/api/admin') !== -1 || path.indexOf('/api/reports') !== -1;
      var isProtocols = path.indexOf('/protocols') !== -1;
      var msg404 = isProtocols
        ? 'Протоколы синхронизации недоступны на этом сервере. Обновите сервер до актуальной версии.'
        : (isAdminOrReports ? 'Админ-панель и отчёты недоступны на этом сервере. Обновите сервер до актуальной версии.' : null);
      var next = function () {
        if (res.ok) return isJson ? res.json() : Promise.resolve(null);
        var msg = isJson ? null : 'Ошибка ' + res.status;
        return isJson ? res.json().then(function (data) {
          var e = new Error(data.message || data.error || 'Ошибка ' + res.status);
          e.status = res.status;
          if (res.status === 404 && msg404) e.message = msg404;
          if (res.status === 401 &&
            path.indexOf('/api/auth/login') === -1 &&
            path.indexOf('/api/auth/register') === -1 &&
            path.indexOf('/api/auth/me') === -1 &&
            typeof global.handleApiUnauthorized === 'function') {
            global.handleApiUnauthorized();
          }
          throw e;
        }) : (function () {
          var e = new Error(msg);
          e.status = res.status;
          if (res.status === 404 && msg404) e.message = msg404;
          return Promise.reject(e);
        })();
      };
      return next();
    }).catch(function (err) {
      if (err && err.message === 'Failed to fetch') {
        return Promise.reject(new Error('Сервер недоступен. Проверьте адрес API (Настройки → Войти) и что сервер запущен.'));
      }
      return Promise.reject(err);
    });
  }

  function loadEntries(objectId) {
    return request('GET', '/api/objects/' + encodeURIComponent(objectId) + '/entries').then(function (data) {
      if (Array.isArray(data)) return data;
      if (data && Array.isArray(data.entries)) return data.entries;
      return [];
    });
  }

  /**
   * GET записей с прогрессом скачивания тела ответа (для мобильных WebView).
   * @param {string} objectId
   * @param {function({loaded:number,total:number})} [onProgress] total может быть 0, если Length неизвестен
   */
  function loadEntriesWithProgress(objectId, onProgress) {
    return new Promise(function (resolve, reject) {
      var base = getBaseUrl();
      if (!base) return reject(new Error('CATTLE_TRACKER_API_BASE не задан'));
      var oid = String(objectId || '').trim();
      if (!oid) return reject(new Error('objectId обязателен'));
      var url = base + '/api/objects/' + encodeURIComponent(oid) + '/entries';
      var xhr = new XMLHttpRequest();
      xhr.open('GET', url, true);
      var token = getToken();
      if (token) xhr.setRequestHeader('Authorization', 'Bearer ' + token);
      xhr.setRequestHeader('Cache-Control', 'no-cache');
      xhr.onprogress = function (ev) {
        if (typeof onProgress === 'function') {
          onProgress({
            loaded: ev.loaded || 0,
            total: ev.lengthComputable ? ev.total : 0
          });
        }
      };
      xhr.onload = function () {
        if (xhr.status < 200 || xhr.status >= 300) {
          try {
            var j = JSON.parse(xhr.responseText || '{}');
            var e = new Error(j.message || j.error || 'Ошибка ' + xhr.status);
            e.status = xhr.status;
            return reject(e);
          } catch (x) {
            return reject(new Error('Ошибка ' + xhr.status));
          }
        }
        try {
          var data = JSON.parse(xhr.responseText || '[]');
          var list = Array.isArray(data) ? data : (data && Array.isArray(data.entries) ? data.entries : []);
          resolve(list);
        } catch (err) {
          reject(new Error('Некорректный ответ сервера'));
        }
      };
      xhr.onerror = function () {
        reject(new Error('Сервер недоступен. Проверьте адрес API (Настройки → Войти) и что сервер запущен.'));
      };
      xhr.send();
    });
  }

  function createEntry(objectId, entry) {
    return request('POST', '/api/objects/' + encodeURIComponent(objectId) + '/entries', entry);
  }

  function updateEntry(objectId, cattleId, entry) {
    return request('PUT', '/api/objects/' + encodeURIComponent(objectId) + '/entries/' + encodeURIComponent(cattleId), entry);
  }

  function deleteEntry(objectId, cattleId) {
    return request('DELETE', '/api/objects/' + encodeURIComponent(objectId) + '/entries/' + encodeURIComponent(cattleId));
  }

  function getObjectsList() {
    return request('GET', '/api/objects?_=' + Date.now());
  }

  function getCurrentObjectId() {
    try {
      var id = sessionStorage.getItem(CURRENT_OBJECT_KEY);
      if (id && id.trim()) return id.trim();
      id = localStorage.getItem(CURRENT_OBJECT_KEY);
      if (id && id.trim()) {
        sessionStorage.setItem(CURRENT_OBJECT_KEY, id.trim());
        return id.trim();
      }
      return 'default';
    } catch (e) {
      return 'default';
    }
  }

  function setCurrentObjectId(id) {
    var val = id === undefined || id === null || id === '' ? 'default' : String(id).trim();
    if (!val) val = 'default';
    var prev = getCurrentObjectId();
    try {
      sessionStorage.setItem(CURRENT_OBJECT_KEY, val);
      localStorage.setItem(CURRENT_OBJECT_KEY, val);
    } catch (e) {}
    if (val !== prev && typeof global.invalidateProtocolsForObjectSwitch === 'function') {
      global.invalidateProtocolsForObjectSwitch();
    }
  }

  function updateObject(id, payload) {
    return request('PUT', '/api/objects/' + encodeURIComponent(id), payload || {});
  }

  function deleteObject(id) {
    return request('DELETE', '/api/objects/' + encodeURIComponent(id));
  }

  /** Удалить базу на сервере (только администратор). Пароль — подтверждение. */
  function deleteObjectWithPassword(id, password) {
    return request('DELETE', '/api/objects/' + encodeURIComponent(id), { password: password || '' });
  }

  function getProtocols(objectId) {
    return request('GET', '/api/objects/' + encodeURIComponent(objectId) + '/protocols');
  }

  function createProtocol(objectId, protocol) {
    return request('POST', '/api/objects/' + encodeURIComponent(objectId) + '/protocols', protocol || {});
  }

  function updateProtocol(objectId, protocolId, protocol) {
    return request('PUT', '/api/objects/' + encodeURIComponent(objectId) + '/protocols/' + encodeURIComponent(protocolId), protocol || {});
  }

  function deleteProtocol(objectId, protocolId) {
    return request('DELETE', '/api/objects/' + encodeURIComponent(objectId) + '/protocols/' + encodeURIComponent(protocolId));
  }

  function getStallLayout(objectId) {
    return request('GET', '/api/objects/' + encodeURIComponent(objectId) + '/stall-layout');
  }

  function putStallLayout(objectId, layout) {
    return request('PUT', '/api/objects/' + encodeURIComponent(objectId) + '/stall-layout', layout || {});
  }

  function getObjectProfile(objectId) {
    return request('GET', '/api/objects/' + encodeURIComponent(objectId) + '/profile');
  }

  function putObjectProfile(objectId, profile) {
    return request('PUT', '/api/objects/' + encodeURIComponent(objectId) + '/profile', profile || {});
  }

  function getFarmSettings(objectId) {
    return request('GET', '/api/objects/' + encodeURIComponent(objectId) + '/farm-settings');
  }

  function putFarmSettings(objectId, settings) {
    return request('PUT', '/api/objects/' + encodeURIComponent(objectId) + '/farm-settings', settings || {});
  }

  function getFarmCard(objectId) {
    return request('GET', '/api/objects/' + encodeURIComponent(objectId) + '/farm-card');
  }

  function putFarmCard(objectId, bundle) {
    return request('PUT', '/api/objects/' + encodeURIComponent(objectId) + '/farm-card', bundle || {});
  }

  function getBitrixSettings() {
    return request('GET', '/api/admin/bitrix/settings');
  }

  function putBitrixSettings(body) {
    return request('PUT', '/api/admin/bitrix/settings', body || {});
  }

  function testBitrix(body) {
    return request('POST', '/api/admin/bitrix/test', body || {});
  }

  function searchBitrixCompanies(q) {
    var qs = q != null && String(q).trim() ? '?q=' + encodeURIComponent(String(q).trim()) : '';
    return request('GET', '/api/admin/bitrix/companies' + qs);
  }

  function getObjectBitrix(objectId) {
    return request('GET', '/api/objects/' + encodeURIComponent(objectId) + '/bitrix');
  }

  function putObjectBitrix(objectId, body) {
    return request('PUT', '/api/objects/' + encodeURIComponent(objectId) + '/bitrix', body || {});
  }

  function pullBitrixFarmCard(objectId, body) {
    return request('POST', '/api/admin/bitrix/pull/' + encodeURIComponent(objectId), body || {});
  }

  function listBitrixPending(opts) {
    opts = opts || {};
    var parts = [];
    if (opts.status != null) parts.push('status=' + encodeURIComponent(opts.status));
    if (opts.objectId) parts.push('objectId=' + encodeURIComponent(opts.objectId));
    var qs = parts.length ? '?' + parts.join('&') : '';
    return request('GET', '/api/admin/bitrix/pending' + qs);
  }

  function resolveBitrixPending(id, action) {
    return request('PATCH', '/api/admin/bitrix/pending/' + encodeURIComponent(id), {
      action: action || 'done'
    });
  }

  function geosuggest(text) {
    return request('GET', '/api/geosuggest?text=' + encodeURIComponent(String(text || '').trim()));
  }

  function exportObject(objectId) {
    return request('GET', '/api/objects/' + encodeURIComponent(objectId) + '/export');
  }

  function addObject(name) {
    return request('POST', '/api/objects', { name: (name || 'Новая база').trim() }).then(function (obj) {
      setCurrentObjectId(obj.id);
      return obj.id;
    });
  }

  /**
   * @param {string} name
   * @param {string} [copyFromObjectId] — если задан, сервер копирует записи в новый объект одним действием (надёжно для мобильных).
   */
  function createObject(name, copyFromObjectId) {
    var body = { name: (name || 'Новая база').trim() };
    if (copyFromObjectId != null && String(copyFromObjectId).trim()) {
      body.copyFromObjectId = String(copyFromObjectId).trim();
    }
    return request('POST', '/api/objects', body);
  }

  function applyAuthCapabilities(data) {
    if (data && data.roleCapabilities && typeof global.setRoleCapabilities === 'function') {
      global.setRoleCapabilities(data.roleCapabilities);
    }
    if (typeof global.setUserCapabilities === 'function') {
      global.setUserCapabilities(data && data.userCapabilities ? data.userCapabilities : null);
    }
  }

  function login(username, password) {
    return request('POST', '/api/auth/login', { username: username, password: password }).then(function (data) {
      if (data.token) setToken(data.token);
      applyAuthCapabilities(data);
      return data;
    });
  }

  function logout() {
    request('POST', '/api/auth/logout').catch(function () {});
    setToken(null);
    if (typeof global.setUserCapabilities === 'function') global.setUserCapabilities(null);
  }

  function register(username, password, role) {
    return request('POST', '/api/auth/register', { username: username, password: password, role: role || 'lite' });
  }

  function updateUserRole(userId, role) {
    return request('PATCH', '/api/admin/users/' + encodeURIComponent(userId), { role: role });
  }

  function updateUser(userId, patch) {
    return request('PATCH', '/api/admin/users/' + encodeURIComponent(userId), patch || {});
  }

  function createUser(username, password, role) {
    return request('POST', '/api/admin/users', {
      username: username,
      password: password,
      role: role || 'inseminator'
    });
  }

  function getUserObjects(userId) {
    return request('GET', '/api/admin/users/' + encodeURIComponent(userId) + '/objects').then(function (data) {
      return (data && data.objectIds) || [];
    });
  }

  function setUserObjects(userId, objectIds) {
    return request('PUT', '/api/admin/users/' + encodeURIComponent(userId) + '/objects', {
      objectIds: objectIds || []
    });
  }

  function getInbox(unreadOnly) {
    var q = unreadOnly ? '?unread=1' : '';
    return request('GET', '/api/me/inbox' + q).then(function (data) {
      return (data && data.items) || [];
    });
  }

  function markInboxRead(id) {
    return request('POST', '/api/me/inbox/' + encodeURIComponent(id) + '/read', {});
  }

  function getRegisterStatus() {
    return request('GET', '/api/auth/register-status').then(function (data) {
      return { allowed: !!(data && data.allowed) };
    }).catch(function () {
      return { allowed: false };
    });
  }

  function createAccessRequest(payload) {
    return request('POST', '/api/auth/access-request', payload || {});
  }

  function getAccessRequests(status) {
    var q = status ? ('?status=' + encodeURIComponent(status)) : '?status=pending';
    return request('GET', '/api/admin/access-requests' + q).then(function (data) {
      return (data && data.requests) || [];
    });
  }

  function resolveAccessRequest(id, status) {
    return request('PATCH', '/api/admin/access-requests/' + encodeURIComponent(id), { status: status || 'done' });
  }

  function getCurrentUser() {
    return request('GET', '/api/auth/me').then(function (data) {
      applyAuthCapabilities(data);
      return data.user || null;
    });
  }

  function checkUsername(username) {
    var u = (username || '').trim();
    if (!u) return Promise.resolve({ available: true });
    return request('GET', '/api/auth/check-username?username=' + encodeURIComponent(u)).catch(function (err) {
      if (err && err.status === 404) return { available: true };
      throw err;
    });
  }

  function getUsers() {
    return request('GET', '/api/admin/users').then(function (data) { return data.users || []; });
  }

  function applyRoleMatrix(data) {
    var roles = data && data.roles;
    if (roles && typeof global.setRoleCapabilities === 'function') {
      global.setRoleCapabilities(roles);
    }
    return roles;
  }

  function getRoleCapabilities() {
    return request('GET', '/api/admin/role-capabilities').then(applyRoleMatrix).catch(function (err) {
      if (err && err.status === 404) {
        return request('GET', '/api/role-capabilities').then(applyRoleMatrix);
      }
      throw err;
    });
  }

  function putRoleCapabilities(roles) {
    return request('PUT', '/api/admin/role-capabilities', roles || {}).then(function (data) {
      return applyRoleMatrix(data);
    });
  }

  function getUserCapabilities(userId) {
    return request('GET', '/api/admin/users/' + encodeURIComponent(userId) + '/capabilities');
  }

  function putUserCapabilities(userId, overlay) {
    return request('PUT', '/api/admin/users/' + encodeURIComponent(userId) + '/capabilities', overlay || {});
  }

  function deleteUser(id) {
    return request('DELETE', '/api/admin/users/' + encodeURIComponent(id));
  }

  function submitReport(message, payload) {
    return request('POST', '/api/reports', { message: message, payload: payload || null });
  }

  function getReports() {
    return request('GET', '/api/reports').then(function (data) { return data.reports || []; });
  }

  function acceptReportForAgent(id) {
    return request('PATCH', '/api/reports/' + encodeURIComponent(id), { accept: true });
  }

  function patchReportStatus(id, status) {
    return request('PATCH', '/api/reports/' + encodeURIComponent(id), { status: status });
  }

  function deleteReport(id) {
    return request('DELETE', '/api/reports/' + encodeURIComponent(id));
  }

  function listMobileApkFiles() {
    return request('GET', '/api/admin/mobile-apk/list');
  }

  function deleteMobileApkFile(filename) {
    return request('DELETE', '/api/admin/mobile-apk/' + encodeURIComponent(filename));
  }

  /**
   * Загрузка APK на сервер (multipart, поле apk).
   * @param {File|Blob} file
   * @param {string} [version]
   * @param {string} [nameOverride] имя файла, если передан Blob без .name
   */
  function uploadMobileApk(file, version, nameOverride) {
    var base = getBaseUrl();
    if (!base) return Promise.reject(new Error('CATTLE_TRACKER_API_BASE не задан'));
    var token = getToken();
    var fd = new FormData();
    var name = (nameOverride != null && String(nameOverride).trim())
      ? String(nameOverride).trim()
      : ((file && file.name) ? file.name : 'app.apk');
    fd.append('apk', file, name);
    if (version) fd.append('version', String(version).trim());
    var headers = {};
    if (token) headers['Authorization'] = 'Bearer ' + token;
    return fetch(base + '/api/admin/mobile-apk', { method: 'POST', headers: headers, body: fd }).then(function (res) {
      var contentType = res.headers.get('Content-Type') || '';
      var isJson = contentType.indexOf('application/json') !== -1;
      if (res.ok) return isJson ? res.json() : Promise.resolve({ ok: true });
      return isJson ? res.json().then(function (data) {
        var e = new Error(data.message || data.error || 'Ошибка ' + res.status);
        e.status = res.status;
        throw e;
      }) : Promise.reject(new Error('Ошибка ' + res.status));
    }).catch(function (err) {
      if (err && err.message === 'Failed to fetch') {
        return Promise.reject(new Error('Сервер недоступен. Проверьте адрес API и что сервер запущен.'));
      }
      return Promise.reject(err);
    });
  }

  var api = {
    PENDING_OBJECT_ID: PENDING_OBJECT_ID,
    getHiddenObjectIds: getHiddenObjectIds,
    filterObjectsListVisible: filterObjectsListVisible,
    hideObjectLocal: hideObjectLocal,
    getBaseUrl: getBaseUrl,
    normalizeApiBaseInput: normalizeApiBaseInput,
    setPersistedApiBase: setPersistedApiBase,
    getToken: getToken,
    setToken: setToken,
    loadEntries: loadEntries,
    loadEntriesWithProgress: loadEntriesWithProgress,
    createEntry: createEntry,
    updateEntry: updateEntry,
    deleteEntry: deleteEntry,
    getProtocols: getProtocols,
    createProtocol: createProtocol,
    updateProtocol: updateProtocol,
    deleteProtocol: deleteProtocol,
    getStallLayout: getStallLayout,
    putStallLayout: putStallLayout,
    getObjectProfile: getObjectProfile,
    putObjectProfile: putObjectProfile,
    getFarmSettings: getFarmSettings,
    putFarmSettings: putFarmSettings,
    getFarmCard: getFarmCard,
    putFarmCard: putFarmCard,
    getBitrixSettings: getBitrixSettings,
    putBitrixSettings: putBitrixSettings,
    testBitrix: testBitrix,
    searchBitrixCompanies: searchBitrixCompanies,
    getObjectBitrix: getObjectBitrix,
    putObjectBitrix: putObjectBitrix,
    pullBitrixFarmCard: pullBitrixFarmCard,
    listBitrixPending: listBitrixPending,
    resolveBitrixPending: resolveBitrixPending,
    geosuggest: geosuggest,
    exportObject: exportObject,
    getObjectsList: getObjectsList,
    getCurrentObjectId: getCurrentObjectId,
    setCurrentObjectId: setCurrentObjectId,
    addObject: addObject,
    createObject: createObject,
    updateObject: updateObject,
    deleteObject: deleteObject,
    deleteObjectWithPassword: deleteObjectWithPassword,
    login: login,
    logout: logout,
    register: register,
    getCurrentUser: getCurrentUser,
    checkUsername: checkUsername,
    getUsers: getUsers,
    getRoleCapabilities: getRoleCapabilities,
    putRoleCapabilities: putRoleCapabilities,
    getUserCapabilities: getUserCapabilities,
    putUserCapabilities: putUserCapabilities,
    deleteUser: deleteUser,
    updateUserRole: updateUserRole,
    updateUser: updateUser,
    createUser: createUser,
    getUserObjects: getUserObjects,
    setUserObjects: setUserObjects,
    getInbox: getInbox,
    markInboxRead: markInboxRead,
    getRegisterStatus: getRegisterStatus,
    createAccessRequest: createAccessRequest,
    getAccessRequests: getAccessRequests,
    resolveAccessRequest: resolveAccessRequest,
    submitReport: submitReport,
    getReports: getReports,
    acceptReportForAgent: acceptReportForAgent,
    patchReportStatus: patchReportStatus,
    deleteReport: deleteReport,
    listMobileApkFiles: listMobileApkFiles,
    deleteMobileApkFile: deleteMobileApkFile,
    uploadMobileApk: uploadMobileApk
  };

  if (typeof global !== 'undefined') {
    global.CattleTrackerApi = api;
  }
})(typeof window !== 'undefined' ? window : this);
export {};
