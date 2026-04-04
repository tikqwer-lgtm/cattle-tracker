/**
 * users.js — Многопользовательский режим (localStorage)
 */
(function (global) {
  'use strict';

  var USERS_KEY = 'cattleTracker_users';
  var CURRENT_USER_KEY = 'cattleTracker_currentUser';
  var LAST_USERNAMES_KEY = 'cattleTracker_lastUsernames';
  var MAX_LAST_USERNAMES = 15;
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
    var newUser = { id: id, username: username, passwordHash: simpleHash(password), role: role || 'admin' };
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
    addLastUsername(user.username);
    return { ok: true, user: session };
  }

  function getLastUsernames() {
    try {
      var raw = localStorage.getItem(LAST_USERNAMES_KEY);
      var list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (e) { return []; }
  }

  function addLastUsername(username) {
    if (!username || typeof username !== 'string') return;
    var u = username.trim();
    if (!u) return;
    var list = getLastUsernames();
    list = list.filter(function (x) { return x !== u; });
    list.unshift(u);
    list = list.slice(0, MAX_LAST_USERNAMES);
    try {
      localStorage.setItem(LAST_USERNAMES_KEY, JSON.stringify(list));
    } catch (e) {}
  }

  /** Список логинов для выбора при входе: в локальном режиме — все пользователи, при API — недавно входившие. */
  function getLoginUsernameList() {
    if (typeof global !== 'undefined' && global.CATTLE_TRACKER_USE_API) {
      return getLastUsernames();
    }
    return loadUsers().map(function (u) { return u.username || ''; }).filter(Boolean);
  }

  function fillAuthUsernameList() {
    var select = document.getElementById('authUsernameSelect');
    var input = document.getElementById('authUsername');
    if (!select) return;
    var list = getLoginUsernameList();
    var current = select.value;
    select.innerHTML = '';
    var empty = document.createElement('option');
    empty.value = '';
    empty.textContent = '— Выберите из списка —';
    select.appendChild(empty);
    list.forEach(function (u) {
      var opt = document.createElement('option');
      opt.value = u;
      opt.textContent = u;
      select.appendChild(opt);
    });
    if (current && list.indexOf(current) !== -1) select.value = current;
    if (input && select.value) input.value = select.value;
  }

  function initAuthUsernameSelect() {
    var select = document.getElementById('authUsernameSelect');
    var input = document.getElementById('authUsername');
    if (!select || !input) return;
    fillAuthUsernameList();
    select.addEventListener('change', function () {
      if (select.value) input.value = select.value;
    });
  }

  function logoutUser() {
    saveCurrentUser(null);
  }

  function getCurrentUser() {
    if (!currentUser) loadCurrentUser();
    return currentUser;
  }

  /**
   * Возвращает записи, видимые текущему пользователю. Все авторизованные видят все записи.
   */
  function getVisibleEntries(list) {
    if (!list || !Array.isArray(list)) return list || [];
    return list;
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
  var loginInProgress = false;

  function getSavedServerBase() {
    try {
      var s = localStorage.getItem('cattleTracker_apiBase');
      return (s && (s = (s + '').trim())) ? s : '';
    } catch (e) { return ''; }
  }

  function setConnectStatus(html, isError) {
    var el = document.getElementById('syncConnectStatus');
    if (!el) return;
    el.innerHTML = html || '';
    el.className = 'sync-connect-status' + (isError ? ' sync-connect-status--error' : ' sync-connect-status--progress');
    if (!html) el.className = 'sync-connect-status';
  }

  function saveServerBaseUrl() {
    if (typeof window.connectToServer === 'function') {
      window.connectToServer();
    }
  }

  function bindAuthControls() {
    var connectionBtn = document.getElementById('app-header-connection-btn');
    if (connectionBtn && !connectionBtn.dataset.authBound) {
      connectionBtn.dataset.authBound = '1';
      connectionBtn.addEventListener('click', function () {
        var nav = (typeof global !== 'undefined' && global.navigate) || (typeof window !== 'undefined' && window.navigate);
        if (typeof nav === 'function') nav('sync');
      });
    }
    // Формы входа и регистрации уже обрабатываются через onsubmit в index.html (window.handleLogin/handleRegister).
    // Дублировать addEventListener('submit') не нужно — иначе окно подтверждения всплывает дважды.
    var skipBtn = document.getElementById('auth-skip-btn');
    if (skipBtn && !skipBtn.dataset.authBound) {
      skipBtn.dataset.authBound = '1';
      skipBtn.addEventListener('click', function () {
        skipAuth();
      });
    }
  }

  function getDefaultLocalUsername() {
    var g = typeof global !== 'undefined' ? global : (typeof window !== 'undefined' ? window : null);
    var api = g && (g.electronAPI || g.electronapi);
    if (api && typeof api.getOsUsername === 'function') {
      return api.getOsUsername().then(function (u) {
        return (u || 'local') + ' (ПК)';
      }).catch(function () { return 'local (ПК)'; });
    }
    return Promise.resolve('local (ПК)');
  }

  function initUsers() {
    var base = getSavedServerBase();
    var localBlock = document.getElementById('auth-local-block');
    var serverBlock = document.getElementById('auth-server-block');
    if (localBlock) localBlock.style.display = useApi ? 'none' : '';
    if (serverBlock) serverBlock.style.display = useApi ? '' : 'none';
    initAuthUsernameSelect();
    bindAuthControls();
    if (useApi && typeof initRegisterUsernameCheck === 'function') {
      initRegisterUsernameCheck();
    }
    var authScreen = document.getElementById('auth-screen');
    if (authScreen && authScreen.classList.contains('active')) {
      setTimeout(focusAuthForm, 0);
    }
    if (useApi) {
      global.CattleTrackerApi.getCurrentUser().then(function (u) {
        currentUser = u || null;
        updateAuthBar();
        var isElectron = typeof window !== 'undefined' && window.electronAPI;
        if (currentUser && typeof navigate === 'function' && !isElectron) {
          if (typeof window.loadLocally === 'function') {
            window.loadLocally().then(function () {
              if (typeof window.updateHerdStats === 'function') window.updateHerdStats();
              if (typeof window.updateViewList === 'function') window.updateViewList();
              navigate('menu');
            }).catch(function () { navigate('menu'); });
          } else {
            navigate('menu');
          }
        }
      }).catch(function () {
        currentUser = null;
        updateAuthBar();
      });
      return;
    }
    loadCurrentUser();
    updateAuthBar();
    // В Electron при запуске не переключаем на меню — показываем экран входа
    var isElectron = typeof window !== 'undefined' && window.electronAPI;
    if (getCurrentUser() && typeof navigate === 'function' && !isElectron) navigate('menu');
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
    var adminSection = document.getElementById('admin-menu-section');
    if (adminSection) {
      var showAdmin = user && user.role === 'admin' && (typeof window !== 'undefined' && window.CATTLE_TRACKER_USE_API);
      adminSection.style.display = showAdmin ? '' : 'none';
    }
    var adminServerUrlSection = document.getElementById('sync-admin-server-url-section');
    if (adminServerUrlSection) {
      var showAdminUrl =
        user && user.role === 'admin' && typeof window !== 'undefined' && window.CATTLE_TRACKER_USE_API;
      adminServerUrlSection.style.display = showAdminUrl ? '' : 'none';
    }
    var reportErrorBtn = document.getElementById('report-error-btn');
    if (reportErrorBtn) {
      var showReport = user && (typeof window !== 'undefined' && window.CATTLE_TRACKER_USE_API);
      reportErrorBtn.style.display = showReport ? '' : 'none';
    }
    var restoreInputBtn = document.getElementById('restore-input-btn');
    if (restoreInputBtn) {
      var showRestore =
        user &&
        typeof window !== 'undefined' &&
        window.electronAPI &&
        typeof window.electronAPI.requestHitTestWorkaround === 'function';
      restoreInputBtn.style.display = showRestore ? '' : 'none';
    }
    var elApi = typeof window !== 'undefined' && window.electronAPI;
    if (elApi && typeof elApi.setAuthenticatedForMenu === 'function') {
      try {
        elApi.setAuthenticatedForMenu(!!user);
      } catch (e) {}
    }
  }

  function initRegisterUsernameCheck() {
    var input = document.getElementById('regUsername');
    var checkEl = document.getElementById('authUsernameCheck');
    if (!input || !checkEl || !global.CattleTrackerApi || typeof global.CattleTrackerApi.checkUsername !== 'function') return;
    var debounceTimer = null;
    function doCheck() {
      var u = (input.value || '').trim();
      checkEl.textContent = '';
      checkEl.className = 'auth-username-check';
      if (!u) return;
      checkEl.textContent = 'Проверка…';
      global.CattleTrackerApi.checkUsername(u).then(function (data) {
        if ((input.value || '').trim() !== u) return;
        if (data.available) {
          checkEl.textContent = 'Логин свободен';
          checkEl.className = 'auth-username-check auth-username-free';
        } else {
          checkEl.textContent = 'Логин уже занят';
          checkEl.className = 'auth-username-check auth-username-taken';
        }
      }).catch(function () {
        if ((input.value || '').trim() !== u) return;
        checkEl.textContent = '';
        checkEl.className = 'auth-username-check';
      });
    }
    function scheduleCheck() {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(doCheck, 400);
    }
    input.addEventListener('input', scheduleCheck);
    input.addEventListener('blur', function () {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(doCheck, 150);
    });
  }

  /** Ставит фокус на первое поле видимой формы входа/регистрации (следующий тик, чтобы DOM был готов). */
  function focusAuthForm() {
    requestAnimationFrame(function () {
      var regForm = document.getElementById('authRegisterForm');
      var regVisible = regForm && regForm.style.display !== 'none';
      var el = regVisible
        ? document.getElementById('regUsername')
        : document.getElementById('authUsername');
      if (el) {
        el.focus({ preventScroll: false });
      }
    });
  }

  function showAuthLogin() {
    var loginForm = document.getElementById('authLoginForm');
    var regForm = document.getElementById('authRegisterForm');
    var checkEl = document.getElementById('authUsernameCheck');
    if (loginForm) loginForm.style.display = '';
    if (regForm) regForm.style.display = 'none';
    if (checkEl) { checkEl.textContent = ''; checkEl.className = 'auth-username-check'; }
    focusAuthForm();
  }
  function showAuthRegister() {
    var loginForm = document.getElementById('authLoginForm');
    var regForm = document.getElementById('authRegisterForm');
    var checkEl = document.getElementById('authUsernameCheck');
    if (loginForm) loginForm.style.display = 'none';
    if (regForm) regForm.style.display = '';
    if (checkEl) { checkEl.textContent = ''; checkEl.className = 'auth-username-check'; }
    focusAuthForm();
  }
  function handleLogin(ev) {
    if (ev && ev.preventDefault) ev.preventDefault();
    var username = document.getElementById('authUsername') && document.getElementById('authUsername').value;
    var password = document.getElementById('authPassword') && document.getElementById('authPassword').value;
    if (useApi) {
      if (loginInProgress) return false;
      var form = document.getElementById('authLoginForm');
      var submitBtn = form && form.querySelector('button[type="submit"]');
      loginInProgress = true;
      if (submitBtn) submitBtn.disabled = true;
      global.CattleTrackerApi.login(username, password).then(function (data) {
        loginInProgress = false;
        if (submitBtn) submitBtn.disabled = false;
        if (data && data.user) {
          saveCurrentUser(data.user);
          addLastUsername(data.user.username || username);
        }
        if (typeof showToast === 'function') showToast('Вход выполнен', 'success'); else alert('Вход выполнен');
        updateAuthBar();
        var loadAndShow = function () {
          if (typeof window.loadLocally === 'function') {
            return window.loadLocally().then(function () {
              if (typeof window.updateHerdStats === 'function') window.updateHerdStats();
              if (typeof window.updateViewList === 'function') window.updateViewList();
              if (typeof navigate === 'function') navigate('menu');
            }).catch(function () {
              if (typeof navigate === 'function') navigate('menu');
            });
          }
          if (typeof navigate === 'function') navigate('menu');
        };
        loadAndShow();
      }).catch(function (err) {
        loginInProgress = false;
        if (submitBtn) submitBtn.disabled = false;
        var msg = (err && err.message) ? err.message : 'Ошибка входа';
        if (err && err.status === 429) {
          msg = 'Слишком много попыток входа. Подождите 15 минут или нажмите «Без авторизации» для локальной работы.';
        }
        if (typeof showToast === 'function') showToast(msg, 'error'); else alert(msg);
        setTimeout(function () {
          requestAnimationFrame(function () {
            var pwdEl = document.getElementById('authPassword');
            if (pwdEl) {
              pwdEl.focus({ preventScroll: false });
            }
          });
        }, 300);
      });
      return false;
    }
    var result = loginUser(username, password);
    if (result.ok) {
      if (typeof showToast === 'function') showToast('Вход выполнен', 'success'); else alert('Вход выполнен');
      updateAuthBar();
      if (typeof navigate === 'function') navigate('menu');
    } else {
      if (typeof showToast === 'function') showToast(result.error || result.message || 'Ошибка входа', 'error'); else alert(result.error || result.message || 'Ошибка входа');
      setTimeout(function () {
        requestAnimationFrame(function () {
          var pwdEl = document.getElementById('authPassword');
          if (pwdEl) {
            pwdEl.focus({ preventScroll: false });
          }
        });
      }, 300);
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
      if (typeof showToast === 'function') showToast(result.error || result.message || 'Ошибка', 'error'); else alert(result.error || result.message || 'Ошибка');
    }
    return false;
  }
  function skipAuth() {
    var nav = (typeof global !== 'undefined' && global.navigate) || (typeof window !== 'undefined' && window.navigate);
    getDefaultLocalUsername().then(function (username) {
      saveCurrentUser({ id: 'local_operator', username: username, role: 'operator' });
      updateAuthBar();
      if (typeof nav === 'function') nav('menu');
    }).catch(function () {
      saveCurrentUser({ id: 'local_operator', username: 'operator(local)', role: 'operator' });
      updateAuthBar();
      if (typeof nav === 'function') nav('menu');
    });
  }
  function handleLogout() {
    if (useApi) global.CattleTrackerApi.logout();
    saveCurrentUser(null);
    updateAuthBar();
    if (typeof showToast === 'function') showToast('Выход выполнен', 'info'); else alert('Выход выполнен');
    if (typeof navigate === 'function') navigate('menu');
    setTimeout(function () {
      var el = document.getElementById('authPassword');
      if (el) el.focus();
    }, 200);
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
    window.focusAuthForm = focusAuthForm;
    window.handleLogin = handleLogin;
    window.handleRegister = handleRegister;
    window.skipAuth = skipAuth;
    window.handleLogout = handleLogout;
    window.saveServerBaseUrl = saveServerBaseUrl;
    window.getSavedServerBase = getSavedServerBase;
    window.initRegisterUsernameCheck = initRegisterUsernameCheck;
    window.fillAuthUsernameList = fillAuthUsernameList;
    window.bindAuthControls = bindAuthControls;
  }

  if (typeof window !== 'undefined' && window.document) {
    function runInit() {
      initUsers();
      setTimeout(initUsers, 150);
      setTimeout(initUsers, 600);
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', runInit);
    } else {
      runInit();
    }
  }
})(typeof window !== 'undefined' ? window : this);
export {};