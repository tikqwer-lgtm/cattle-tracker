/** __users part 1 */
(function () {
  'use strict';
  var root = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this);
  var NS = root['__users'] = root['__users'] || {};
  var global = typeof window !== 'undefined' ? window : this;

  function simpleHash(str) {
    var h = 0;
    for (var i = 0; i < str.length; i++) {
      h = ((h << 5) - h) + str.charCodeAt(i) | 0;
    }
    return Math.abs(h).toString(36);
  }

  function loadUsers() {
    try {
      var raw = localStorage.getItem(globalThis['__users'].state.USERS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function saveUsers(users) {
    try {
      localStorage.setItem(globalThis['__users'].state.USERS_KEY, JSON.stringify(users || []));
    } catch (e) {}
  }

  function loadCurrentUser() {
    try {
      var raw = localStorage.getItem(globalThis['__users'].state.CURRENT_USER_KEY);
      if (raw) {
        globalThis['__users'].state.currentUser = JSON.parse(raw);
        return globalThis['__users'].state.currentUser;
      }
    } catch (e) {}
    globalThis['__users'].state.currentUser = null;
    return null;
  }

  function saveCurrentUser(user) {
    globalThis['__users'].state.currentUser = user;
    try {
      if (user) {
        localStorage.setItem(globalThis['__users'].state.CURRENT_USER_KEY, JSON.stringify({ id: user.id, username: user.username, role: user.role }));
      } else {
        localStorage.removeItem(globalThis['__users'].state.CURRENT_USER_KEY);
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
    addLastUsername(user.username);
    return { ok: true, user: session };
  }

  function getLastUsernames() {
    try {
      var raw = localStorage.getItem(globalThis['__users'].state.LAST_USERNAMES_KEY);
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
    list = list.slice(0, globalThis['__users'].state.MAX_LAST_USERNAMES);
    try {
      localStorage.setItem(globalThis['__users'].state.LAST_USERNAMES_KEY, JSON.stringify(list));
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
    if (useApi) {
      var api = global.CattleTrackerApi;
      var token = api && typeof api.getToken === 'function' ? api.getToken() : null;
      if (!token) {
        globalThis['__users'].state.currentUser = null;
        return null;
      }
      if (typeof global.isAuthLoggedIn === 'function' && !global.isAuthLoggedIn()) {
        return null;
      }
    }
    if (!globalThis['__users'].state.currentUser) loadCurrentUser();
    if (useApi) {
      var tok2 = global.CattleTrackerApi && typeof global.CattleTrackerApi.getToken === 'function'
        ? global.CattleTrackerApi.getToken() : null;
      if (!tok2) {
        globalThis['__users'].state.currentUser = null;
        return null;
      }
    }
    return globalThis['__users'].state.currentUser;
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
    return user.role === 'admin' || user.role === 'manager' || user.role === 'operator';
  }

  function canEdit() {
    var user = getCurrentUser();
    if (!user) return true;
    return user.role === 'admin' || user.role === 'manager' || user.role === 'operator';
  }

  function canDelete() {
    var user = getCurrentUser();
    if (!user) return true;
    return user.role === 'admin' || user.role === 'manager' || user.role === 'operator';
  }

  /**
   * Режим API: в главном меню админ видит все базы; оператор — одну «свою» (созданную им, иначе текущую/первую).
   * Экран «Синхронизация» по-прежнему получает полный список через API отдельно.
   */
  function filterObjectsListForRole(list) {
    if (!useApi || !list || !list.length) return list || [];
    var user = getCurrentUser();
    if (!user || user.role === 'admin' || user.role === 'manager' || user.role === 'viewer') return list;
    if (user.role !== 'operator') return list;
    var uid = String(user.id || '');
    var pend = global.CattleTrackerApi && global.CattleTrackerApi.PENDING_OBJECT_ID;
    var cur = typeof global.getCurrentObjectId === 'function' ? global.getCurrentObjectId() : '';
    if (pend && cur === pend) {
      var mineP = list.filter(function (o) {
        return o && String(o.created_by || '') === uid;
      });
      if (mineP.length >= 1) {
        mineP.sort(function (a, b) {
          return String(b.last_updated_at || b.lastUpdatedAt || '').localeCompare(String(a.last_updated_at || a.lastUpdatedAt || ''));
        });
        return [mineP[0]];
      }
      return list.length ? [list[0]] : list;
    }
    if (cur) {
      var curObj = list.find(function (o) { return o && o.id === cur; });
      if (curObj) return [curObj];
    }
    var mine = list.filter(function (o) {
      return o && String(o.created_by || '') === uid;
    });
    if (mine.length >= 1) {
      mine.sort(function (a, b) {
        return String(b.last_updated_at || b.lastUpdatedAt || '').localeCompare(String(a.last_updated_at || a.lastUpdatedAt || ''));
      });
      return [mine[0]];
    }
    var pick = list.find(function (o) { return o && o.id === cur; }) || list[0];
    return pick ? [pick] : list;
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


  // register functions
  NS.simpleHash = simpleHash;
  NS.loadUsers = loadUsers;
  NS.saveUsers = saveUsers;
  NS.loadCurrentUser = loadCurrentUser;
  NS.saveCurrentUser = saveCurrentUser;
  NS.registerUser = registerUser;
  NS.loginUser = loginUser;
  NS.getLastUsernames = getLastUsernames;
  NS.addLastUsername = addLastUsername;
  NS.getLoginUsernameList = getLoginUsernameList;
  NS.fillAuthUsernameList = fillAuthUsernameList;
  NS.initAuthUsernameSelect = initAuthUsernameSelect;
  NS.logoutUser = logoutUser;
  NS.getCurrentUser = getCurrentUser;
  NS.getVisibleEntries = getVisibleEntries;
  NS.canAdd = canAdd;
  NS.canEdit = canEdit;
  NS.canDelete = canDelete;
  NS.filterObjectsListForRole = filterObjectsListForRole;
  NS.getSavedServerBase = getSavedServerBase;
  NS.setConnectStatus = setConnectStatus;
  NS.saveServerBaseUrl = saveServerBaseUrl;
})();
export {};
