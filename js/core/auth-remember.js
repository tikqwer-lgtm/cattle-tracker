/**
 * auth-remember.js — логин/пароль и JWT переживают обновление APK.
 * WebView localStorage часто сбрасывается; Android SharedPreferences — нет.
 */
(function (global) {
  'use strict';

  var REMEMBER_KEY = 'cattleTracker_authRemember';
  var REMEMBER_PREFIX = 'cattleTracker_authRemember_';
  var TOKEN_KEY = 'cattleTracker_apiToken';

  var capAdapterPromise = null;

  function encodeAuthRememberPayload(obj) {
    try {
      return btoa(unescape(encodeURIComponent(JSON.stringify(obj))));
    } catch (e) {
      return '';
    }
  }

  function decodeAuthRememberPayload(raw) {
    try {
      return JSON.parse(decodeURIComponent(escape(atob(String(raw || '')))));
    } catch (e) {
      return null;
    }
  }

  function readLocalRaw() {
    try {
      var unified = localStorage.getItem(REMEMBER_KEY);
      if (unified) return unified;
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf(REMEMBER_PREFIX) === 0) {
          var v = localStorage.getItem(k);
          if (v) return v;
        }
      }
    } catch (e) {}
    return null;
  }

  function writeLocalRaw(encoded) {
    try {
      if (encoded) localStorage.setItem(REMEMBER_KEY, encoded);
      else localStorage.removeItem(REMEMBER_KEY);
    } catch (e) {}
  }

  function removeLegacyLocalKeys() {
    try {
      var keys = [];
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf(REMEMBER_PREFIX) === 0) keys.push(k);
      }
      keys.forEach(function (k) {
        try {
          localStorage.removeItem(k);
        } catch (e2) {}
      });
    } catch (e) {}
  }

  function emptyNative() {
    return {
      getRemember: function () {
        return Promise.resolve({ payload: '' });
      },
      setRemember: function () {
        return Promise.resolve();
      },
      clearRemember: function () {
        return Promise.resolve();
      },
      getUploadConfig: function () {
        return Promise.resolve({ apiBase: '', token: '' });
      }
    };
  }

  function isAndroidNative() {
    try {
      var C = global.Capacitor;
      if (!C || typeof C.isNativePlatform !== 'function' || !C.isNativePlatform()) return false;
      var p = typeof C.getPlatform === 'function' ? C.getPlatform() : '';
      return String(p).toLowerCase() === 'android';
    } catch (e) {
      return false;
    }
  }

  function loadCapacitorAdapter() {
    if (capAdapterPromise) return capAdapterPromise;
    if (!isAndroidNative()) {
      capAdapterPromise = Promise.resolve(null);
      return capAdapterPromise;
    }
    capAdapterPromise = import('@capacitor/core')
      .then(function (core) {
        var AuthRemember = core.registerPlugin('AuthRemember', {
          web: {
            get: function () {
              return Promise.resolve({ payload: '' });
            },
            set: function () {
              return Promise.resolve();
            },
            clear: function () {
              return Promise.resolve();
            }
          }
        });
        var TelemetryBridge = core.registerPlugin('TelemetryBridge', {
          web: {
            getUploadConfig: function () {
              return Promise.resolve({ apiBase: '', token: '' });
            }
          }
        });
        return {
          getRemember: function () {
            return AuthRemember.get();
          },
          setRemember: function (payload) {
            return AuthRemember.set({ payload: payload || '' });
          },
          clearRemember: function () {
            return AuthRemember.clear();
          },
          getUploadConfig: function () {
            if (!TelemetryBridge || typeof TelemetryBridge.getUploadConfig !== 'function') {
              return Promise.resolve({ apiBase: '', token: '' });
            }
            return TelemetryBridge.getUploadConfig();
          }
        };
      })
      .catch(function () {
        capAdapterPromise = null;
        return null;
      });
    return capAdapterPromise;
  }

  function withNative() {
    if (global.CattleTrackerAuthNative) return Promise.resolve(global.CattleTrackerAuthNative);
    return loadCapacitorAdapter().then(function (adapter) {
      return adapter || emptyNative();
    });
  }

  function saveAuthRemember(username, password) {
    var u = username != null ? String(username).trim() : '';
    var p = password != null ? String(password) : '';
    if (!u || !p) return clearAuthRemember();
    var encoded = encodeAuthRememberPayload({ u: u, p: p });
    if (!encoded) return Promise.resolve();
    writeLocalRaw(encoded);
    return withNative().then(function (native) {
      if (native && typeof native.setRemember === 'function') {
        return native.setRemember(encoded);
      }
    }).catch(function () {});
  }

  function clearAuthRemember() {
    writeLocalRaw('');
    try {
      localStorage.removeItem(REMEMBER_KEY);
    } catch (e) {}
    removeLegacyLocalKeys();
    return withNative().then(function (native) {
      if (native && typeof native.clearRemember === 'function') {
        return native.clearRemember();
      }
    }).catch(function () {});
  }

  function loadAuthRemember() {
    return withNative()
      .then(function (native) {
        if (!native || typeof native.getRemember !== 'function') return { payload: '' };
        return native.getRemember();
      })
      .catch(function () {
        return { payload: '' };
      })
      .then(function (res) {
        var nativeRaw = res && res.payload ? String(res.payload) : '';
        var nativeData = nativeRaw ? decodeAuthRememberPayload(nativeRaw) : null;
        if (nativeData && nativeData.u && nativeData.p) {
          writeLocalRaw(nativeRaw);
          return nativeData;
        }
        var localRaw = readLocalRaw();
        var localData = localRaw ? decodeAuthRememberPayload(localRaw) : null;
        if (localData && localData.u && localData.p) {
          writeLocalRaw(localRaw);
          if (nativeRaw !== localRaw) {
            return withNative().then(function (native) {
              if (native && typeof native.setRemember === 'function') {
                return native.setRemember(localRaw);
              }
            }).catch(function () {}).then(function () {
              return localData;
            });
          }
          return localData;
        }
        return null;
      });
  }

  function hydrateNativeAuthSession() {
    var api = global.CattleTrackerApi;
    var existingToken = '';
    try {
      existingToken = (api && typeof api.getToken === 'function' ? api.getToken() : null) ||
        localStorage.getItem(TOKEN_KEY) ||
        '';
    } catch (e) {
      existingToken = '';
    }
    if (existingToken) {
      return Promise.resolve({ tokenRestored: false });
    }
    return withNative()
      .then(function (native) {
        if (!native || typeof native.getUploadConfig !== 'function') {
          return { apiBase: '', token: '' };
        }
        return native.getUploadConfig();
      })
      .catch(function () {
        return { apiBase: '', token: '' };
      })
      .then(function (cfg) {
        var token = cfg && cfg.token ? String(cfg.token).trim() : '';
        var apiBase = cfg && cfg.apiBase ? String(cfg.apiBase).trim().replace(/\/$/, '') : '';
        if (apiBase && api && typeof api.setPersistedApiBase === 'function') {
          api.setPersistedApiBase(apiBase);
        } else if (apiBase) {
          global.CATTLE_TRACKER_API_BASE = apiBase;
        }
        if (token && api && typeof api.setToken === 'function') {
          api.setToken(token);
          return { tokenRestored: true };
        }
        return { tokenRestored: false };
      });
  }

  function tryRememberedLogin() {
    var api = global.CattleTrackerApi;
    if (!api || typeof api.login !== 'function') return Promise.resolve(null);
    return loadAuthRemember().then(function (data) {
      if (!data || !data.u || !data.p) return null;
      return api.login(data.u, data.p).then(function (res) {
        return res && res.user ? res.user : null;
      }).catch(function () {
        return null;
      });
    });
  }

  global.encodeAuthRememberPayload = encodeAuthRememberPayload;
  global.decodeAuthRememberPayload = decodeAuthRememberPayload;
  global.saveAuthRemember = saveAuthRemember;
  global.clearAuthRemember = clearAuthRemember;
  global.loadAuthRemember = loadAuthRemember;
  global.hydrateNativeAuthSession = hydrateNativeAuthSession;
  global.tryRememberedLogin = tryRememberedLogin;
})(typeof window !== 'undefined' ? window : this);
export {};
