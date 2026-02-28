/**
 * api-client.js — слой обращения к Cattle Tracker API.
 * Используется когда включён режим API (CATTLE_TRACKER_USE_API + CATTLE_TRACKER_API_BASE).
 */
(function (global) {
  'use strict';

  var TOKEN_KEY = 'cattleTracker_apiToken';
  var CURRENT_OBJECT_KEY = 'cattleTracker_currentObject';

  function getBaseUrl() {
    return (global.CATTLE_TRACKER_API_BASE || '').replace(/\/$/, '');
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
      var next = function () {
        if (res.ok) return isJson ? res.json() : Promise.resolve(null);
        var msg = isJson ? null : 'Ошибка ' + res.status;
        return isJson ? res.json().then(function (data) {
          var e = new Error(data.message || data.error || 'Ошибка ' + res.status);
          e.status = res.status;
          throw e;
        }) : (function () { var e = new Error(msg); e.status = res.status; return Promise.reject(e); })();
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
    return request('GET', '/api/objects/' + encodeURIComponent(objectId) + '/entries');
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
    var val = (id || 'default').trim();
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

  function createObject(name) {
    return request('POST', '/api/objects', { name: (name || 'Новая база').trim() });
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
    return request('POST', '/api/auth/register', { username: username, password: password, role: role || 'admin' });
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
    return request('GET', '/api/admin/users').then(function (data) { return data.users || []; }).catch(function (err) {
      if (err && err.status === 404) return [];
      throw err;
    });
  }

  function deleteUser(id) {
    return request('DELETE', '/api/admin/users/' + encodeURIComponent(id));
  }

  function submitReport(message, payload) {
    return request('POST', '/api/reports', { message: message, payload: payload || null });
  }

  function getReports() {
    return request('GET', '/api/reports').then(function (data) { return data.reports || []; }).catch(function (err) {
      if (err && err.status === 404) return [];
      throw err;
    });
  }

  function deleteReport(id) {
    return request('DELETE', '/api/reports/' + encodeURIComponent(id));
  }

  var api = {
    getBaseUrl: getBaseUrl,
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
    login: login,
    logout: logout,
    register: register,
    getCurrentUser: getCurrentUser,
    checkUsername: checkUsername,
    getUsers: getUsers,
    deleteUser: deleteUser,
    submitReport: submitReport,
    getReports: getReports,
    deleteReport: deleteReport
  };

  if (typeof global !== 'undefined') {
    global.CattleTrackerApi = api;
  }
})(typeof window !== 'undefined' ? window : this);
export {};
