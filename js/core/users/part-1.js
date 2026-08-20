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
    var newUser = { id: id, username: username, passwordHash: simpleHash(password), role: role || 'inseminator' };
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
    clearPreviewRole();
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

  var PREVIEW_ROLE_KEY = 'cattleTracker_previewRole';
  var PREVIEW_ROLES = { admin: true, inseminator: true, service: true };

  function getPreviewStorage() {
    try {
      if (typeof sessionStorage !== 'undefined') return sessionStorage;
    } catch (e) {}
    return null;
  }

  /**
   * Канонические роли: admin | inseminator | service.
   * Старые коды мигрируются на лету (см. PERMISSIONS.md).
   */
  function getRealRole(user) {
    var u = user || getCurrentUser() || {};
    var role = String(u.role || '').trim().toLowerCase();
    if (!role) return 'inseminator';
    if (role === 'admin' || role === 'manager') return 'admin';
    if (role === 'service' || role === 'viewer') return 'service';
    if (
      role === 'inseminator' ||
      role === 'pro' ||
      role === 'medium' ||
      role === 'lite' ||
      role === 'operator'
    ) {
      return 'inseminator';
    }
    return 'inseminator';
  }

  function getStoredPreviewRole() {
    var store = getPreviewStorage();
    if (!store) return '';
    try {
      var v = String(store.getItem(PREVIEW_ROLE_KEY) || '').trim().toLowerCase();
      return PREVIEW_ROLES[v] ? v : '';
    } catch (e) {
      return '';
    }
  }

  function setPreviewRole(role) {
    var store = getPreviewStorage();
    var next = String(role || '').trim().toLowerCase();
    if (!PREVIEW_ROLES[next] || next === 'admin') {
      try {
        if (store) store.removeItem(PREVIEW_ROLE_KEY);
      } catch (e) {}
      return getUiRole();
    }
    if (getRealRole() !== 'admin') return getUiRole();
    try {
      if (store) store.setItem(PREVIEW_ROLE_KEY, next);
    } catch (e) {}
    return next;
  }

  function clearPreviewRole() {
    try {
      var store = getPreviewStorage();
      if (store) store.removeItem(PREVIEW_ROLE_KEY);
    } catch (e) {}
  }

  /** UI-роль: у admin может быть предпросмотр осеменатора / сервиса. */
  function getUiRole(user) {
    var real = getRealRole(user);
    if (real !== 'admin') return real;
    var preview = getStoredPreviewRole();
    if (preview && PREVIEW_ROLES[preview]) return preview;
    return 'admin';
  }

  function isRolePreviewMode(user) {
    return getRealRole(user) === 'admin' && getUiRole(user) !== 'admin';
  }

  function rejectIfPreviewMutation() {
    if (!isRolePreviewMode()) return false;
    if (typeof showToast === 'function') {
      showToast('Режим просмотра: изменения отключены', 'info');
    }
    return true;
  }

  function isAppAdminRole(user) {
    var u = user || getCurrentUser() || {};
    var role = String(u.role || '').trim().toLowerCase();
    if (role === 'manager') return true;
    return getRealRole(u) === 'admin';
  }

  /** Совместимость: эффективная роль для меню и прав = UI-роль. */
  function getEffectiveRole(user) {
    return getUiRole(user);
  }

  /** Синхронизировано с PERMISSIONS.md в корне проекта. */
  var CAPABILITY_MATRIX = {
    admin: {
      cards: true,
      eventsInput: true,
      serviceWorksInput: true,
      farmCardEventsWrite: true,
      workLists: true,
      stallMap: true,
      inventory: true,
      notifications: true,
      analytics: true,
      farmCardSettings: true,
      farmCardView: true,
      multiBase: true,
      adminUsersRoles: true,
      adminReleaseControls: true,
      createDeleteObjects: true
    },
    inseminator: {
      cards: true,
      eventsInput: true,
      serviceWorksInput: true,
      farmCardEventsWrite: false,
      workLists: true,
      stallMap: true,
      inventory: true,
      notifications: true,
      analytics: false,
      farmCardSettings: false,
      farmCardView: true,
      multiBase: true,
      adminUsersRoles: false,
      adminReleaseControls: false,
      createDeleteObjects: false
    },
    service: {
      cards: true,
      eventsInput: false,
      serviceWorksInput: true,
      farmCardEventsWrite: true,
      workLists: true,
      stallMap: true,
      inventory: false,
      notifications: true,
      analytics: false,
      farmCardSettings: false,
      farmCardView: true,
      multiBase: true,
      adminUsersRoles: false,
      adminReleaseControls: false,
      createDeleteObjects: false
    }
  };

  var _roleCapOverlay = null;

  function setRoleCapabilities(matrix) {
    if (!matrix || typeof matrix !== 'object') {
      _roleCapOverlay = null;
      return;
    }
    _roleCapOverlay = {
      inseminator: matrix.inseminator && typeof matrix.inseminator === 'object' ? matrix.inseminator : null,
      service: matrix.service && typeof matrix.service === 'object' ? matrix.service : null
    };
  }

  function getRoleCapabilities() {
    return _roleCapOverlay;
  }

  /** Временно скрыто в UI; модуль и capability оставляем, чтобы вернуть позже. */
  var PARKED_CAPABILITIES = { notifications: true };

  function hasCapability(capability, user) {
    var key = String(capability || '').trim();
    if (!key) return false;
    if (PARKED_CAPABILITIES[key]) return false;
    var role = getUiRole(user);
    if (role === 'admin') {
      var adminCaps = CAPABILITY_MATRIX.admin;
      return !!adminCaps[key];
    }
    var roleCaps = CAPABILITY_MATRIX[role] || CAPABILITY_MATRIX.inseminator;
    var overlay = _roleCapOverlay && _roleCapOverlay[role];
    if (overlay && Object.prototype.hasOwnProperty.call(overlay, key)) {
      return !!overlay[key];
    }
    return !!roleCaps[key];
  }

  function canInputServiceWorks(user) {
    return hasCapability('eventsInput', user) || hasCapability('serviceWorksInput', user);
  }

  function canAdd() {
    return hasCapability('cards') && hasCapability('eventsInput');
  }

  function canEdit() {
    return hasCapability('eventsInput');
  }

  function canDelete() {
    return hasCapability('eventsInput');
  }

  /**
   * Список объектов уже отфильтрован сервером (ACL). Клиент возвращает как есть.
   */
  function filterObjectsListForRole(list) {
    return list || [];
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
  NS.getRealRole = getRealRole;
  NS.getUiRole = getUiRole;
  NS.getEffectiveRole = getEffectiveRole;
  NS.setPreviewRole = setPreviewRole;
  NS.clearPreviewRole = clearPreviewRole;
  NS.isRolePreviewMode = isRolePreviewMode;
  NS.rejectIfPreviewMutation = rejectIfPreviewMutation;
  NS.isAppAdminRole = isAppAdminRole;
  NS.hasCapability = hasCapability;
  NS.setRoleCapabilities = setRoleCapabilities;
  NS.getRoleCapabilities = getRoleCapabilities;
  NS.canInputServiceWorks = canInputServiceWorks;
  NS.canAdd = canAdd;
  NS.canEdit = canEdit;
  NS.canDelete = canDelete;
  NS.filterObjectsListForRole = filterObjectsListForRole;
  NS.getSavedServerBase = getSavedServerBase;
  NS.setConnectStatus = setConnectStatus;
  NS.saveServerBaseUrl = saveServerBaseUrl;
})();
export {};
