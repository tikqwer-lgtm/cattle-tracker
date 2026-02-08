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
    var token = getToken();
    if (token) opts.headers['Authorization'] = 'Bearer ' + token;
    if (body !== undefined) opts.body = JSON.stringify(body);
    return fetch(base + path, opts).then(function (res) {
      var contentType = res.headers.get('Content-Type') || '';
      var isJson = contentType.indexOf('application/json') !== -1;
      var next = function () {
        if (res.ok) return isJson ? res.json() : Promise.resolve(null);
        return isJson ? res.json().then(function (data) {
          throw new Error(data.message || data.error || 'Ошибка ' + res.status);
        }) : Promise.reject(new Error('Ошибка ' + res.status));
      };
      return next();
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
    return request('GET', '/api/objects');
  }

  function getCurrentObjectId() {
    try {
      var id = sessionStorage.getItem(CURRENT_OBJECT_KEY);
      return id && id.trim() ? id : 'default';
    } catch (e) {
      return 'default';
    }
  }

  function setCurrentObjectId(id) {
    try {
      sessionStorage.setItem(CURRENT_OBJECT_KEY, (id || 'default').trim());
    } catch (e) {}
  }

  function addObject(name) {
    return request('POST', '/api/objects', { name: (name || 'Новая база').trim() }).then(function (obj) {
      setCurrentObjectId(obj.id);
      return obj.id;
    });
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

  function getCurrentUser() {
    return request('GET', '/api/auth/me').then(function (data) {
      return data.user || null;
    }).catch(function () {
      return null;
    });
  }

  var api = {
    getBaseUrl: getBaseUrl,
    getToken: getToken,
    setToken: setToken,
    loadEntries: loadEntries,
    createEntry: createEntry,
    updateEntry: updateEntry,
    deleteEntry: deleteEntry,
    getObjectsList: getObjectsList,
    getCurrentObjectId: getCurrentObjectId,
    setCurrentObjectId: setCurrentObjectId,
    addObject: addObject,
    login: login,
    logout: logout,
    register: register,
    getCurrentUser: getCurrentUser
  };

  if (typeof global !== 'undefined') {
    global.CattleTrackerApi = api;
  }
})(typeof window !== 'undefined' ? window : this);
