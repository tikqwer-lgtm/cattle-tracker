/** __users part 2 */
(function () {
  'use strict';
  var root = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this);
  var NS = root['__users'] = root['__users'] || {};
  var global = typeof window !== 'undefined' ? window : this;
  var useApi = typeof global !== 'undefined' && global.CATTLE_TRACKER_USE_API && global.CattleTrackerApi;

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
        globalThis['__users'].skipAuth();
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

  function updateAuthSessionStatusUi() {
    var el = document.getElementById('auth-session-status');
    if (!el) return;
    if (!useApi) {
      el.hidden = true;
      el.textContent = '';
      el.className = 'auth-session-status';
      return;
    }
    el.hidden = false;
    var session = typeof global.getAuthSessionStatus === 'function' ? global.getAuthSessionStatus() : null;
    var status = session && session.status ? session.status : 'unknown';
    var base = globalThis['__users'].getSavedServerBase() || (global.CattleTrackerApi && global.CattleTrackerApi.getBaseUrl ? global.CattleTrackerApi.getBaseUrl() : '');
    var baseLine = base ? 'Сервер: ' + base : 'Сервер не указан';
    var msg = baseLine;
    var cls = 'auth-session-status';
    if (status === 'loggedIn' && session.user) {
      msg += '\nВход выполнен: ' + (session.user.username || '') + ' (' + (session.user.role || '') + ')';
      cls += ' auth-session-status--ok';
    } else if (status === 'sessionExpired') {
      msg += '\nСессия истекла — введите пароль снова';
      cls += ' auth-session-status--warn';
      var input = document.getElementById('authUsername');
      if (input && session.lastUsername && !input.value) input.value = session.lastUsername;
    } else if (status === 'serverOnly') {
      msg += '\nСервер подключён — требуется вход';
      cls += ' auth-session-status--info';
    } else if (status === 'offline') {
      msg += '\nНет связи с сервером — вход не проверен';
      cls += ' auth-session-status--warn';
    } else if (status === 'unknown') {
      msg += '\nПроверка входа…';
      cls += ' auth-session-status--pending';
    }
    el.textContent = msg;
    el.className = cls;
  }

  function initUsers() {
    var localBlock = document.getElementById('auth-local-block');
    var serverBlock = document.getElementById('auth-server-block');
    if (localBlock) localBlock.style.display = useApi ? 'none' : '';
    if (serverBlock) serverBlock.style.display = useApi ? '' : 'none';
    globalThis['__users'].initAuthUsernameSelect();
    bindAuthControls();
    if (useApi && typeof initRegisterUsernameCheck === 'function') {
      initRegisterUsernameCheck();
    }
    updateAuthSessionStatusUi();
    var authScreen = document.getElementById('auth-screen');
    if (authScreen && authScreen.classList.contains('active')) {
      setTimeout(focusAuthForm, 0);
    }
    if (!useApi) {
      globalThis['__users'].loadCurrentUser();
      updateAuthBar();
    }
  }

  function updateAuthBar() {
    var bar = document.getElementById('auth-bar');
    var span = document.getElementById('authBarUser');
    var user = null;
    if (useApi) {
      if (typeof global.isAuthLoggedIn === 'function' && global.isAuthLoggedIn()) {
        var session = typeof global.getAuthSessionStatus === 'function' ? global.getAuthSessionStatus() : null;
        user = session && session.user ? session.user : globalThis['__users'].getCurrentUser();
      }
    } else {
      user = globalThis['__users'].getCurrentUser();
    }
    if (bar && span) {
      if (user) {
        bar.style.display = 'flex';
        span.textContent = 'Вошли: ' + (user.username || '') + ' (' + (user.role || '') + ')';
      } else {
        bar.style.display = 'none';
      }
    }
    var adminSection = document.getElementById('admin-menu-section');
    if (adminSection) {
      var showAdmin =
        user &&
        typeof globalThis['__users'].hasCapability === 'function' &&
        globalThis['__users'].hasCapability('adminUsersRoles', user) &&
        (typeof window !== 'undefined' && window.CATTLE_TRACKER_USE_API);
      adminSection.style.display = showAdmin ? '' : 'none';
    }
    var adminServerUrlSection = document.getElementById('sync-admin-server-url-section');
    if (adminServerUrlSection) {
      var showAdminUrl =
        user && (user.role === 'admin' || user.role === 'manager') && typeof window !== 'undefined' && window.CATTLE_TRACKER_USE_API;
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
    var actionsSection = document.getElementById('menu-section-actions');
    if (actionsSection) {
      var showActions = !user || globalThis['__users'].hasCapability('eventsInput', user);
      actionsSection.style.display = showActions ? '' : 'none';
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
      var serverBlock = document.getElementById('auth-server-block');
      var serverVisible = serverBlock && serverBlock.style.display !== 'none';
      if (!serverVisible) {
        var localIn = document.getElementById('authLocalConnectServerUrlInput');
        if (localIn) {
          localIn.focus({ preventScroll: false });
          return;
        }
      }
      var regForm = document.getElementById('authRegisterForm');
      var regVisible = regForm && regForm.style.display !== 'none';
      var el = regVisible
        ? document.getElementById('regUsername')
        : (document.getElementById('authPassword') || document.getElementById('authUsername'));
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
      if (NS.state.loginInProgress) return false;
      var form = document.getElementById('authLoginForm');
      var submitBtn = form && form.querySelector('button[type="submit"]');
      NS.state.loginInProgress = true;
      if (submitBtn) submitBtn.disabled = true;
      global.CattleTrackerApi.login(username, password).then(function (data) {
        NS.state.loginInProgress = false;
        if (submitBtn) submitBtn.disabled = false;
        if (data && data.user) {
          globalThis['__users'].saveCurrentUser(data.user);
          globalThis['__users'].addLastUsername(data.user.username || username);
          if (typeof global.setSessionLoggedIn === 'function') global.setSessionLoggedIn(data.user);
        }
        if (typeof showToast === 'function') showToast('Вход выполнен', 'success'); else alert('Вход выполнен');
        updateAuthBar();
        updateAuthSessionStatusUi();
        var loadAndShow = function () {
          if (typeof window.loadObjectsFromApi !== 'function' || typeof window.getCurrentObjectId !== 'function' || typeof window.setCurrentObjectId !== 'function') {
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
            return Promise.resolve();
          }
          return window.loadObjectsFromApi().then(function (list) {
            list = list || [];
            var cid = window.getCurrentObjectId();
            var pend = global.CattleTrackerApi && global.CattleTrackerApi.PENDING_OBJECT_ID;
            if (list.length > 0 && pend && cid !== pend && !list.some(function (o) { return o.id === cid; })) {
              window.setCurrentObjectId(pend);
            }
            if (typeof window.loadLocally === 'function') {
              return window.loadLocally().then(function () {
                if (typeof window.updateHerdStats === 'function') window.updateHerdStats();
                if (typeof window.updateViewList === 'function') window.updateViewList();
                if (typeof navigate === 'function') navigate('menu');
              });
            }
            if (typeof navigate === 'function') navigate('menu');
          }).catch(function () {
            if (typeof navigate === 'function') navigate('menu');
          });
        };
        loadAndShow();
      }).catch(function (err) {
        NS.state.loginInProgress = false;
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
    var result = globalThis['__users'].loginUser(username, password);
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

  // register functions
  NS.bindAuthControls = bindAuthControls;
  NS.getDefaultLocalUsername = getDefaultLocalUsername;
  NS.updateAuthSessionStatusUi = updateAuthSessionStatusUi;
  NS.initUsers = initUsers;
  NS.updateAuthBar = updateAuthBar;
  NS.initRegisterUsernameCheck = initRegisterUsernameCheck;
  NS.focusAuthForm = focusAuthForm;
  NS.showAuthLogin = showAuthLogin;
  NS.showAuthRegister = showAuthRegister;
  NS.handleLogin = handleLogin;
})();
export {};
