/** __users part 3 */
(function () {
  'use strict';
  var root = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this);
  var NS = root['__users'] = root['__users'] || {};
  var global = typeof window !== 'undefined' ? window : this;
  var useApi = typeof global !== 'undefined' && global.CATTLE_TRACKER_USE_API && global.CattleTrackerApi;

  function handleRegister(ev) {
    if (ev && ev.preventDefault) ev.preventDefault();
    var username = document.getElementById('regUsername') && document.getElementById('regUsername').value;
    var password = document.getElementById('regPassword') && document.getElementById('regPassword').value;
    var role = document.getElementById('regRole') && document.getElementById('regRole').value;
    if (useApi) {
      global.CattleTrackerApi.register(username, password, role).then(function (data) {
        if (typeof showToast === 'function') showToast('Регистрация успешна. Войдите.', 'success'); else alert('Регистрация успешна. Войдите.');
        globalThis['__users'].showAuthLogin();
      }).catch(function (err) {
        var msg = (err && err.message) ? err.message : 'Ошибка';
        if (typeof showToast === 'function') showToast(msg, 'error'); else alert(msg);
      });
      return false;
    }
    var result = globalThis['__users'].registerUser(username, password, role);
    if (result.ok) {
      if (typeof showToast === 'function') showToast('Регистрация успешна. Войдите.', 'success'); else alert('Регистрация успешна. Войдите.');
      globalThis['__users'].showAuthLogin();
    } else {
      if (typeof showToast === 'function') showToast(result.error || result.message || 'Ошибка', 'error'); else alert(result.error || result.message || 'Ошибка');
    }
    return false;
  }
  function skipAuth() {
    var nav = (typeof global !== 'undefined' && global.navigate) || (typeof window !== 'undefined' && window.navigate);
    globalThis['__users'].getDefaultLocalUsername().then(function (username) {
      globalThis['__users'].saveCurrentUser({ id: 'local_operator', username: username, role: 'operator' });
      globalThis['__users'].updateAuthBar();
      if (typeof nav === 'function') nav('menu');
    }).catch(function () {
      globalThis['__users'].saveCurrentUser({ id: 'local_operator', username: 'operator(local)', role: 'operator' });
      globalThis['__users'].updateAuthBar();
      if (typeof nav === 'function') nav('menu');
    });
  }
  function handleLogout() {
    if (useApi) {
      global.CattleTrackerApi.logout();
      if (typeof global.clearAuthSession === 'function') global.clearAuthSession();
    }
    globalThis['__users'].saveCurrentUser(null);
    globalThis['__users'].updateAuthBar();
    globalThis['__users'].updateAuthSessionStatusUi();
    if (typeof showToast === 'function') showToast('Выход выполнен', 'info'); else alert('Выход выполнен');
    if (typeof navigate === 'function') navigate('auth');
    setTimeout(function () {
      if (typeof focusAuthForm === 'function') globalThis['__users'].focusAuthForm();
    }, 200);
  }


  // register functions
  NS.handleRegister = handleRegister;
  NS.skipAuth = skipAuth;
  NS.handleLogout = handleLogout;
})();
export {};
