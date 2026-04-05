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
    if (!sid || sid === 'default') {
      return Promise.reject(new Error('Эту базу нельзя скрыть'));
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
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token);
      else localStorage.removeItem(TOKEN_KEY);
    } catch (e) {}
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
    try {
      sessionStorage.setItem(CURRENT_OBJECT_KEY, val);
      localStorage.setItem(CURRENT_OBJECT_KEY, val);
    } catch (e) {}
  }

  function updateObject(id, payload) {
    return request('PUT', '/api/objects/' + encodeURIComponent(id), payload || {});
  }

  function deleteObject(id) {
    return request('DELETE', '/api/objects/' + encodeURIComponent(id));
  }

  /** Удалить базу на сервере (только создатель). Пароль — подтверждение. */
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

  function login(username, password) {
    return request('POST', '/api/auth/login', { username: username, password: password }).then(function (data) {
      if (data.token) setToken(data.token);
      return data;
    });
  }

  function logout() {
    request('POST', '/api/auth/logout').catch(function () {});
    setToken(null);
  }

  function register(username, password, role) {
    return request('POST', '/api/auth/register', { username: username, password: password, role: role || 'operator' });
  }

  function updateUserRole(userId, role) {
    return request('PATCH', '/api/admin/users/' + encodeURIComponent(userId), { role: role });
  }

  function getCurrentUser() {
    return request('GET', '/api/auth/me').then(function (data) {
      return data.user || null;
    }).catch(function () {
      return null;
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

  function deleteUser(id) {
    return request('DELETE', '/api/admin/users/' + encodeURIComponent(id));
  }

  function submitReport(message, payload) {
    return request('POST', '/api/reports', { message: message, payload: payload || null });
  }

  function getReports() {
    return request('GET', '/api/reports').then(function (data) { return data.reports || []; });
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
    createEntry: createEntry,
    updateEntry: updateEntry,
    deleteEntry: deleteEntry,
    getProtocols: getProtocols,
    createProtocol: createProtocol,
    updateProtocol: updateProtocol,
    deleteProtocol: deleteProtocol,
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
    deleteUser: deleteUser,
    updateUserRole: updateUserRole,
    submitReport: submitReport,
    getReports: getReports,
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
