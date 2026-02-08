/**
 * users.js — Многопользовательский режим (localStorage)
 */
(function (global) {
  'use strict';

  var USERS_KEY = 'cattleTracker_users';
  var CURRENT_USER_KEY = 'cattleTracker_currentUser';
  var currentUser = null;

  function simpleHash(str) {
    var h = 0;
    for (var i = 0; i < str.length; i++) {
      h = ((h << 5) - h) + str.charCodeAt(i) | 0;
    }
    return Math.abs(h).toString(36);
  }

  function loadUsers() {
    try {
      var raw = localStorage.getItem(USERS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function saveUsers(users) {
    try {
      localStorage.setItem(USERS_KEY, JSON.stringify(users || []));
    } catch (e) {}
  }

  function loadCurrentUser() {
    try {
      var raw = localStorage.getItem(CURRENT_USER_KEY);
      if (raw) {
        currentUser = JSON.parse(raw);
        return currentUser;
      }
    } catch (e) {}
    currentUser = null;
    return null;
  }

  function saveCurrentUser(user) {
    currentUser = user;
    try {
      if (user) {
        localStorage.setItem(CURRENT_USER_KEY, JSON.stringify({ id: user.id, username: user.username, role: user.role }));
      } else {
        localStorage.removeItem(CURRENT_USER_KEY);
      }
    } catch (e) {}
  }

  function registerUser(username, password, role) {
    if (!username || !password) return { ok: false, message: 'Введите логин и пароль' };
    username = String(username).trim();
    if (!username) return { ok: false, message: 'Логин не может быть пустым' };
    var users = loadUsers();
    if (users.some(function (u) { return u.username.toLowerCase() === username.toLowerCase(); })) {
      return { ok: false, message: 'Пользователь с таким логином уже есть' };
    }
    var id = 'u_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
    var newUser = { id: id, username: username, passwordHash: simpleHash(password), role: role || 'operator' };
    users.push(newUser);
    saveUsers(users);
    return { ok: true, user: { id: newUser.id, username: newUser.username, role: newUser.role } };
  }

  function loginUser(username, password) {
    if (!username || !password) return { ok: false, message: 'Введите логин и пароль' };
    var users = loadUsers();
    var user = users.find(function (u) { return u.username.toLowerCase() === String(username).trim().toLowerCase(); });
    if (!user || user.passwordHash !== simpleHash(password)) {
      return { ok: false, message: 'Неверный логин или пароль' };
    }
    var session = { id: user.id, username: user.username, role: user.role };
    saveCurrentUser(session);
    return { ok: true, user: session };
  }

  function logoutUser() {
    saveCurrentUser(null);
  }

  function getCurrentUser() {
    if (!currentUser) loadCurrentUser();
    return currentUser;
  }

  /**
   * Возвращает записи, видимые текущему пользователю (по userId или все для админа)
   */
  function getVisibleEntries(list) {
    if (!list || !Array.isArray(list)) return list || [];
    var user = getCurrentUser();
    if (!user) return list;
    if (user.role === 'admin') return list;
    return list.filter(function (e) {
      return !e.userId || e.userId === user.id;
    });
  }

  function canAdd() {
    var user = getCurrentUser();
    if (!user) return true;
    return user.role === 'admin' || user.role === 'operator';
  }

  function canEdit() {
    var user = getCurrentUser();
    if (!user) return true;
    return user.role === 'admin' || user.role === 'operator';
  }

  function canDelete() {
    var user = getCurrentUser();
    if (!user) return true;
    return user.role === 'admin' || user.role === 'operator';
  }

  var useApi = typeof global !== 'undefined' && global.CATTLE_TRACKER_USE_API && global.CattleTrackerApi;

  function getSavedServerBase() {
    try {
      var s = localStorage.getItem('cattleTracker_apiBase');
      return (s && (s = (s + '').trim())) ? s : '';
    } catch (e) { return ''; }
  }

  function saveServerBaseUrl() {
    var input = document.getElementById('serverApiBaseInput');
    var url = (input && input.value ? input.value : '').trim().replace(/\/$/, '');
    if (!url) {
      if (typeof showToast === 'function') showToast('Введите адрес сервера', 'error');
      else alert('Введите адрес сервера');
      return;
    }
    if (url.indexOf('http://') === 0 && url.indexOf('localhost') === -1 && url.indexOf('127.0.0.1') === -1) {
      if (!confirm('Для доступа из интернета рекомендуется HTTPS. Продолжить с HTTP?')) return;
    }
    try {
      localStorage.setItem('cattleTracker_apiBase', url);
      if (typeof showToast === 'function') showToast('Адрес сохранён. Перезагрузка…', 'info');
      location.reload();
    } catch (e) {
      if (typeof showToast === 'function') showToast('Ошибка сохранения', 'error');
      else alert('Ошибка сохранения');
    }
  }

  function initUsers() {
    var serverInput = document.getElementById('serverApiBaseInput');
    if (serverInput) serverInput.value = getSavedServerBase();
    if (useApi) {
      global.CattleTrackerApi.getCurrentUser().then(function (u) {
        currentUser = u || null;
        updateAuthBar();
      }).catch(function () {
        currentUser = null;
        updateAuthBar();
      });
      return;
    }
    loadCurrentUser();
    updateAuthBar();
  }

  function updateAuthBar() {
    var bar = document.getElementById('auth-bar');
    var span = document.getElementById('authBarUser');
    var user = getCurrentUser();
    if (bar && span) {
      if (user) {
        bar.style.display = 'flex';
        span.textContent = 'Пользователь: ' + (user.username || '') + ' (' + (user.role || '') + ')';
      } else {
        bar.style.display = 'none';
      }
    }
  }

  function showAuthLogin() {
    var loginForm = document.getElementById('authLoginForm');
    var regForm = document.getElementById('authRegisterForm');
    if (loginForm) loginForm.style.display = '';
    if (regForm) regForm.style.display = 'none';
  }
  function showAuthRegister() {
    var loginForm = document.getElementById('authLoginForm');
    var regForm = document.getElementById('authRegisterForm');
    if (loginForm) loginForm.style.display = 'none';
    if (regForm) regForm.style.display = '';
  }
  function handleLogin(ev) {
    if (ev && ev.preventDefault) ev.preventDefault();
    var username = document.getElementById('authUsername') && document.getElementById('authUsername').value;
    var password = document.getElementById('authPassword') && document.getElementById('authPassword').value;
    if (useApi) {
      global.CattleTrackerApi.login(username, password).then(function (data) {
        if (data && data.user) saveCurrentUser(data.user);
        if (typeof showToast === 'function') showToast('Вход выполнен', 'success'); else alert('Вход выполнен');
        updateAuthBar();
        if (typeof navigate === 'function') navigate('menu');
      }).catch(function (err) {
        var msg = (err && err.message) ? err.message : 'Ошибка входа';
        if (typeof showToast === 'function') showToast(msg, 'error'); else alert(msg);
      });
      return false;
    }
    var result = loginUser(username, password);
    if (result.ok) {
      if (typeof showToast === 'function') showToast('Вход выполнен', 'success'); else alert('Вход выполнен');
      updateAuthBar();
      if (typeof navigate === 'function') navigate('menu');
    } else {
      if (typeof showToast === 'function') showToast(result.message || 'Ошибка входа', 'error'); else alert(result.message || 'Ошибка входа');
    }
    return false;
  }
  function handleRegister(ev) {
    if (ev && ev.preventDefault) ev.preventDefault();
    var username = document.getElementById('regUsername') && document.getElementById('regUsername').value;
    var password = document.getElementById('regPassword') && document.getElementById('regPassword').value;
    var role = document.getElementById('regRole') && document.getElementById('regRole').value;
    if (useApi) {
      global.CattleTrackerApi.register(username, password, role).then(function (data) {
        if (typeof showToast === 'function') showToast('Регистрация успешна. Войдите.', 'success'); else alert('Регистрация успешна. Войдите.');
        showAuthLogin();
      }).catch(function (err) {
        var msg = (err && err.message) ? err.message : 'Ошибка';
        if (typeof showToast === 'function') showToast(msg, 'error'); else alert(msg);
      });
      return false;
    }
    var result = registerUser(username, password, role);
    if (result.ok) {
      if (typeof showToast === 'function') showToast('Регистрация успешна. Войдите.', 'success'); else alert('Регистрация успешна. Войдите.');
      showAuthLogin();
    } else {
      if (typeof showToast === 'function') showToast(result.message || 'Ошибка', 'error'); else alert(result.message || 'Ошибка');
    }
    return false;
  }
  function skipAuth() {
    if (typeof navigate === 'function') navigate('menu');
  }
  function handleLogout() {
    if (useApi) global.CattleTrackerApi.logout();
    saveCurrentUser(null);
    updateAuthBar();
    if (typeof showToast === 'function') showToast('Выход выполнен', 'info'); else alert('Выход выполнен');
    if (typeof navigate === 'function') navigate('menu');
  }

  if (typeof window !== 'undefined') {
    window.registerUser = registerUser;
    window.loginUser = loginUser;
    window.logoutUser = logoutUser;
    window.getCurrentUser = getCurrentUser;
    window.getVisibleEntries = getVisibleEntries;
    window.canAdd = canAdd;
    window.canEdit = canEdit;
    window.canDelete = canDelete;
    window.updateAuthBar = updateAuthBar;
    window.showAuthLogin = showAuthLogin;
    window.showAuthRegister = showAuthRegister;
    window.handleLogin = handleLogin;
    window.handleRegister = handleRegister;
    window.skipAuth = skipAuth;
    window.handleLogout = handleLogout;
    window.saveServerBaseUrl = saveServerBaseUrl;
    window.getSavedServerBase = getSavedServerBase;
  }

  if (typeof window !== 'undefined' && window.document) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initUsers);
    } else {
      initUsers();
    }
  }
})(typeof window !== 'undefined' ? window : this);
