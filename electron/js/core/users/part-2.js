/** __users part 2 */
(function () {
  'use strict';
  var root = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this);
  var NS = root['__users'] = root['__users'] || {};
  var global = typeof window !== 'undefined' ? window : this;
  var useApi = typeof global !== 'undefined' && global.CATTLE_TRACKER_USE_API && global.CattleTrackerApi;

  function getSelectedAuthServer() {
    var select = document.getElementById('authServerSelect');
    if (select && select.value && typeof global.getCattleTrackerServerById === 'function') {
      return global.getCattleTrackerServerById(select.value);
    }
    var list = global.CATTLE_TRACKER_SERVERS;
    return list && list[0] ? list[0] : null;
  }

  function formatServerLabel(urlOrBase) {
    var byUrl = typeof global.getCattleTrackerServerByUrl === 'function'
      ? global.getCattleTrackerServerByUrl(urlOrBase)
      : null;
    if (byUrl && byUrl.name) return byUrl.name;
    var selected = getSelectedAuthServer();
    if (selected && selected.name) return selected.name;
    return urlOrBase ? String(urlOrBase) : '';
  }

  function fillAuthServerSelect() {
    var select = document.getElementById('authServerSelect');
    if (!select) return;
    var servers = Array.isArray(global.CATTLE_TRACKER_SERVERS) ? global.CATTLE_TRACKER_SERVERS : [];
    var prev = select.value;
    select.innerHTML = '';
    for (var i = 0; i < servers.length; i++) {
      var s = servers[i];
      if (!s || !s.id) continue;
      var opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = s.name || s.id;
      select.appendChild(opt);
    }
    var base = globalThis['__users'].getSavedServerBase
      ? globalThis['__users'].getSavedServerBase()
      : '';
    var matched = base && typeof global.getCattleTrackerServerByUrl === 'function'
      ? global.getCattleTrackerServerByUrl(base)
      : null;
    if (matched && matched.id) select.value = matched.id;
    else if (prev && select.querySelector('option[value="' + prev + '"]')) select.value = prev;
    else if (servers[0]) select.value = servers[0].id;
    updateAuthServerDisplay();
  }

  function updateAuthServerDisplay() {
    var nameEl = document.getElementById('auth-server-display-name');
    var connectedEl = document.getElementById('auth-connected-server-label');
    var server = getSelectedAuthServer();
    var name = server && server.name ? server.name : 'Сервер';
    if (nameEl) nameEl.textContent = name;
    if (connectedEl) {
      if (useApi) {
        connectedEl.hidden = false;
        connectedEl.textContent = 'Подключён к «' + name + '»';
      } else {
        connectedEl.hidden = true;
        connectedEl.textContent = '';
      }
    }
  }

  function ensureApiBaseFromAuthSelect() {
    var server = getSelectedAuthServer();
    var url = server && server.url ? String(server.url).trim().replace(/\/$/, '') : '';
    if (!url) {
      return Promise.reject(new Error('Выберите сервер'));
    }
    var api = global.CattleTrackerApi;
    if (api && typeof api.setPersistedApiBase === 'function') {
      if (!api.setPersistedApiBase(url)) {
        return Promise.reject(new Error('Некорректный адрес сервера'));
      }
    } else {
      global.CATTLE_TRACKER_API_BASE = url;
    }
    return fetch(url + '/api/health').then(function (res) {
      if (!res.ok) throw new Error('Сервер недоступен (код ' + res.status + ')');
      return url;
    });
  }

  function showAuthAccessRequestModal(kind) {
    var isForgot = kind === 'forgot_password';
    var title = isForgot ? 'Забыл пароль' : 'Запросить логин/пароль';
    var overlay = document.createElement('div');
    overlay.className = 'confirm-overlay auth-access-request-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.innerHTML =
      '<div class="confirm-modal confirm-modal--wide auth-access-request-modal">' +
      '<p class="confirm-modal-text" style="font-weight:600;">' + title + '</p>' +
      '<label for="authAccessUsername">Логин' + (isForgot ? ' *' : '') + '</label>' +
      '<input type="text" id="authAccessUsername" autocomplete="username" />' +
      '<label for="authAccessContact">Контакт (телефон / Telegram)</label>' +
      '<input type="text" id="authAccessContact" autocomplete="tel" />' +
      '<label for="authAccessComment">Комментарий</label>' +
      '<textarea id="authAccessComment" rows="3"></textarea>' +
      '<div class="confirm-modal-actions" style="margin-top:1rem;">' +
      '<button type="button" class="small-btn auth-access-cancel">Отмена</button>' +
      '<button type="button" class="btn primary auth-access-submit">Отправить</button>' +
      '</div></div>';
    document.body.appendChild(overlay);
    var usernameInput = overlay.querySelector('#authAccessUsername');
    var loginField = document.getElementById('authUsername');
    if (usernameInput && loginField && loginField.value) usernameInput.value = loginField.value;
    if (usernameInput) setTimeout(function () { usernameInput.focus(); }, 50);

    function close() {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }

    overlay.querySelector('.auth-access-cancel').addEventListener('click', close);
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) close();
    });
    overlay.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.preventDefault(); close(); }
    });
    overlay.querySelector('.auth-access-submit').addEventListener('click', function () {
      var username = (overlay.querySelector('#authAccessUsername').value || '').trim();
      var contact = (overlay.querySelector('#authAccessContact').value || '').trim();
      var comment = (overlay.querySelector('#authAccessComment').value || '').trim();
      if (isForgot && !username) {
        if (typeof showToast === 'function') showToast('Укажите логин', 'error');
        else alert('Укажите логин');
        return;
      }
      if (!username && !contact && !comment) {
        if (typeof showToast === 'function') showToast('Укажите логин, контакт или комментарий', 'error');
        else alert('Укажите логин, контакт или комментарий');
        return;
      }
      var submitBtn = overlay.querySelector('.auth-access-submit');
      if (submitBtn) submitBtn.disabled = true;
      ensureApiBaseFromAuthSelect()
        .then(function () {
          if (!global.CattleTrackerApi || typeof global.CattleTrackerApi.createAccessRequest !== 'function') {
            throw new Error('API недоступен');
          }
          return global.CattleTrackerApi.createAccessRequest({
            kind: isForgot ? 'forgot_password' : 'request_credentials',
            username: username,
            contact: contact,
            comment: comment
          });
        })
        .then(function () {
          close();
          var okMsg = 'Заявка отправлена администратору сервера. Новый пароль (или логин) сообщат отдельно.';
          if (typeof showToast === 'function') showToast(okMsg, 'success', 8000);
          else alert(okMsg);
        })
        .catch(function (err) {
          if (submitBtn) submitBtn.disabled = false;
          var msg = (err && err.message) ? err.message : 'Не удалось отправить заявку';
          if (typeof showToast === 'function') showToast(msg, 'error', 6000);
          else alert(msg);
        });
    });
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
        globalThis['__users'].skipAuth();
      });
    }
    var serverSelect = document.getElementById('authServerSelect');
    if (serverSelect && !serverSelect.dataset.authBound) {
      serverSelect.dataset.authBound = '1';
      serverSelect.addEventListener('change', function () {
        updateAuthServerDisplay();
        updateAuthSessionStatusUi();
      });
    }
    var requestBtn = document.getElementById('authRequestCredentialsBtn');
    if (requestBtn && !requestBtn.dataset.authBound) {
      requestBtn.dataset.authBound = '1';
      requestBtn.addEventListener('click', function () {
        showAuthAccessRequestModal('request_credentials');
      });
    }
    var forgotBtn = document.getElementById('authForgotPasswordBtn');
    if (forgotBtn && !forgotBtn.dataset.authBound) {
      forgotBtn.dataset.authBound = '1';
      forgotBtn.addEventListener('click', function () {
        showAuthAccessRequestModal('forgot_password');
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
    var label = formatServerLabel(base);
    var baseLine = label ? 'Сервер: ' + label : 'Сервер не указан';
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

  function updateRegisterAvailability() {
    if (!useApi || !global.CattleTrackerApi || typeof global.CattleTrackerApi.getRegisterStatus !== 'function') return;
    global.CattleTrackerApi.getRegisterStatus().then(function (st) {
      var allowed = !!(st && st.allowed);
      var regBtn = document.getElementById('auth-register-switch-btn');
      if (regBtn) regBtn.style.display = allowed ? '' : 'none';
      var bootstrapHint = document.getElementById('auth-register-bootstrap-hint');
      if (bootstrapHint) bootstrapHint.style.display = allowed ? '' : 'none';
      var regRoleWrap = document.getElementById('regRole');
      if (regRoleWrap && regRoleWrap.closest('label')) {
        regRoleWrap.closest('label').style.display = allowed ? 'none' : 'none';
      }
      if (!allowed) {
        var regForm = document.getElementById('authRegisterForm');
        var loginForm = document.getElementById('authLoginForm');
        if (regForm && loginForm && regForm.style.display !== 'none') {
          globalThis['__users'].showAuthLogin();
        }
      }
    }).catch(function () {
      var regBtn = document.getElementById('auth-register-switch-btn');
      if (regBtn) regBtn.style.display = 'none';
    });
  }

  function initUsers() {
    var localBlock = document.getElementById('auth-local-block');
    var serverBlock = document.getElementById('auth-server-block');
    if (localBlock) localBlock.style.display = useApi ? 'none' : '';
    if (serverBlock) serverBlock.style.display = useApi ? '' : 'none';
    fillAuthServerSelect();
    globalThis['__users'].initAuthUsernameSelect();
    bindAuthControls();
    if (useApi && typeof initRegisterUsernameCheck === 'function') {
      initRegisterUsernameCheck();
    }
    if (useApi) updateRegisterAvailability();
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

  function formatRoleLabel(user) {
    if (!user) return '';
    var role = typeof globalThis['__users'].getEffectiveRole === 'function'
      ? globalThis['__users'].getEffectiveRole(user)
      : String(user.role || 'lite').trim().toLowerCase();
    var labels = {
      admin: 'Админ',
      inseminator: 'Осеменатор',
      service: 'Сервис-специалист',
      lite: 'Осеменатор',
      medium: 'Осеменатор',
      pro: 'Осеменатор',
      viewer: 'Сервис-специалист'
    };
    return labels[role] || (role.charAt(0).toUpperCase() + role.slice(1));
  }

  function updateAuthBar() {
    var sessionEl = document.getElementById('menu-user-session');
    var bar = document.getElementById('auth-bar');
    var user = null;
    if (useApi) {
      if (typeof global.isAuthLoggedIn === 'function' && global.isAuthLoggedIn()) {
        var session = typeof global.getAuthSessionStatus === 'function' ? global.getAuthSessionStatus() : null;
        user = session && session.user ? session.user : globalThis['__users'].getCurrentUser();
      }
    } else {
      user = globalThis['__users'].getCurrentUser();
    }
    if (sessionEl) {
      if (user) {
        var roleLabel = formatRoleLabel(user);
        var login = (user.username || '').trim();
        sessionEl.textContent = roleLabel + (login ? ' — ' + login : '');
        sessionEl.hidden = false;
      } else {
        sessionEl.textContent = '';
        sessionEl.hidden = true;
      }
    }
    if (bar) bar.style.display = 'none';
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
        user &&
        typeof globalThis['__users'].hasCapability === 'function' &&
        globalThis['__users'].hasCapability('adminUsersRoles', user) &&
        typeof window !== 'undefined' &&
        window.CATTLE_TRACKER_USE_API;
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
        var connectBtn = document.getElementById('auth-connect-server-btn');
        if (connectBtn) {
          connectBtn.focus({ preventScroll: false });
          return;
        }
        var serverSelect = document.getElementById('authServerSelect');
        if (serverSelect) {
          serverSelect.focus({ preventScroll: false });
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
  NS.fillAuthServerSelect = fillAuthServerSelect;
  NS.updateAuthServerDisplay = updateAuthServerDisplay;
  NS.showAuthAccessRequestModal = showAuthAccessRequestModal;
  NS.initUsers = initUsers;
  NS.updateAuthBar = updateAuthBar;
  NS.formatRoleLabel = formatRoleLabel;
  NS.updateRegisterAvailability = updateRegisterAvailability;
  NS.initRegisterUsernameCheck = initRegisterUsernameCheck;
  NS.focusAuthForm = focusAuthForm;
  NS.showAuthLogin = showAuthLogin;
  NS.showAuthRegister = showAuthRegister;
  NS.handleLogin = handleLogin;
})();
export {};
