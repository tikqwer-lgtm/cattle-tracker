/**
 * auth-session.js — единое состояние входа (профиль + JWT) в режиме API.
 */
(function (global) {
  'use strict';

  var CURRENT_USER_KEY = 'cattleTracker_currentUser';
  var LAST_USERNAMES_KEY = 'cattleTracker_lastUsernames';

  var _session = { status: 'unknown', user: null, lastUsername: null };
  var _restorePromise = null;
  var _401Handled = false;

  function useApiMode() {
    return !!(global.CATTLE_TRACKER_USE_API && global.CattleTrackerApi);
  }

  function getLastUsername() {
    try {
      var raw = localStorage.getItem(LAST_USERNAMES_KEY);
      var list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) && list[0] ? String(list[0]) : null;
    } catch (e) {
      return null;
    }
  }

  function getStaleUsername() {
    try {
      var raw = localStorage.getItem(CURRENT_USER_KEY);
      if (!raw) return null;
      var u = JSON.parse(raw);
      return u && u.username ? String(u.username) : null;
    } catch (e) {
      return null;
    }
  }

  function persistUser(user) {
    if (typeof global.saveCurrentUser === 'function') {
      global.saveCurrentUser(user);
    }
  }

  function getAuthSessionStatus() {
    return _session;
  }

  function clearAuthSession() {
    var api = global.CattleTrackerApi;
    if (api && typeof api.setToken === 'function') api.setToken(null);
    persistUser(null);
    _session = {
      status: useApiMode() ? 'serverOnly' : 'local',
      user: null,
      lastUsername: getLastUsername() || getStaleUsername()
    };
    if (typeof global.updateAuthBar === 'function') global.updateAuthBar();
    if (typeof global.updateAuthSessionStatusUi === 'function') global.updateAuthSessionStatusUi();
    if (typeof global.updateSyncAuthStatusUi === 'function') global.updateSyncAuthStatusUi();
  }

  function restoreLocalSession() {
    if (typeof global.getCurrentUser === 'function') {
      var u = global.getCurrentUser();
      _session = {
        status: u ? 'loggedIn' : 'local',
        user: u || null,
        lastUsername: u && u.username ? u.username : null
      };
      return Promise.resolve(_session);
    }
    _session = { status: 'local', user: null, lastUsername: null };
    return Promise.resolve(_session);
  }

  function doRestore() {
    if (!useApiMode()) {
      return restoreLocalSession();
    }

    var api = global.CattleTrackerApi;
    var token = typeof api.getToken === 'function' ? api.getToken() : null;

    if (!token) {
      var lastNoToken = getStaleUsername() || getLastUsername();
      persistUser(null);
      _session = {
        status: 'serverOnly',
        user: null,
        lastUsername: lastNoToken
      };
      if (typeof global.updateAuthSessionStatusUi === 'function') global.updateAuthSessionStatusUi();
      if (typeof global.updateSyncAuthStatusUi === 'function') global.updateSyncAuthStatusUi();
      return Promise.resolve(_session);
    }

    return api.getCurrentUser().then(function (user) {
      if (user && user.username) {
        persistUser(user);
        _session = { status: 'loggedIn', user: user, lastUsername: user.username };
      } else {
        if (typeof api.setToken === 'function') api.setToken(null);
        persistUser(null);
        _session = {
          status: 'sessionExpired',
          user: null,
          lastUsername: getStaleUsername() || getLastUsername()
        };
      }
      if (typeof global.updateAuthBar === 'function') global.updateAuthBar();
      if (typeof global.updateAuthSessionStatusUi === 'function') global.updateAuthSessionStatusUi();
      if (typeof global.updateSyncAuthStatusUi === 'function') global.updateSyncAuthStatusUi();
      return _session;
    }).catch(function (err) {
      if (err && err.status === 401) {
        var lastExpired = getStaleUsername() || getLastUsername();
        if (typeof api.setToken === 'function') api.setToken(null);
        persistUser(null);
        _session = {
          status: 'sessionExpired',
          user: null,
          lastUsername: lastExpired
        };
      } else {
        var cached = null;
        if (typeof global.getCurrentUser === 'function') cached = global.getCurrentUser();
        _session = {
          status: 'offline',
          user: cached,
          lastUsername: cached && cached.username ? cached.username : (getLastUsername() || null)
        };
      }
      if (typeof global.updateAuthBar === 'function') global.updateAuthBar();
      if (typeof global.updateAuthSessionStatusUi === 'function') global.updateAuthSessionStatusUi();
      if (typeof global.updateSyncAuthStatusUi === 'function') global.updateSyncAuthStatusUi();
      return _session;
    });
  }

  function restoreApiSession() {
    if (_restorePromise) return _restorePromise;
    _restorePromise = doRestore();
    return _restorePromise;
  }

  function handleApiUnauthorized() {
    if (_401Handled) return;
    _401Handled = true;
    var last = getStaleUsername() || getLastUsername();
    if (typeof global.CattleTrackerApi !== 'undefined' && global.CattleTrackerApi && typeof global.CattleTrackerApi.setToken === 'function') {
      global.CattleTrackerApi.setToken(null);
    }
    persistUser(null);
    _session = { status: 'sessionExpired', user: null, lastUsername: last };
    if (typeof global.updateAuthBar === 'function') global.updateAuthBar();
    if (typeof global.updateAuthSessionStatusUi === 'function') global.updateAuthSessionStatusUi();
    if (typeof global.updateSyncAuthStatusUi === 'function') global.updateSyncAuthStatusUi();
    if (typeof global.showToast === 'function') {
      global.showToast('Сессия истекла. Войдите снова.', 'error', 6000);
    }
    if (typeof global.navigate === 'function') global.navigate('auth');
    setTimeout(function () { _401Handled = false; }, 5000);
  }

  function isAuthLoggedIn() {
    return _session.status === 'loggedIn' && !!_session.user;
  }

  function setSessionLoggedIn(user) {
    if (!user) return;
    persistUser(user);
    _session = { status: 'loggedIn', user: user, lastUsername: user.username || null };
    _restorePromise = Promise.resolve(_session);
    if (typeof global.updateAuthSessionStatusUi === 'function') global.updateAuthSessionStatusUi();
    if (typeof global.updateSyncAuthStatusUi === 'function') global.updateSyncAuthStatusUi();
  }

  global.restoreApiSession = restoreApiSession;
  global.getAuthSessionStatus = getAuthSessionStatus;
  global.clearAuthSession = clearAuthSession;
  global.handleApiUnauthorized = handleApiUnauthorized;
  global.isAuthLoggedIn = isAuthLoggedIn;
  global.setSessionLoggedIn = setSessionLoggedIn;
})(typeof window !== 'undefined' ? window : this);
export {};
