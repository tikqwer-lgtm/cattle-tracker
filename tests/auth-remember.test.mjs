import { beforeEach, describe, it, expect, vi } from 'vitest';

const storage = {};

function makeLocalStorage() {
  return {
    getItem(k) {
      return Object.prototype.hasOwnProperty.call(storage, k) ? storage[k] : null;
    },
    setItem(k, v) {
      storage[k] = String(v);
    },
    removeItem(k) {
      delete storage[k];
    },
    key(i) {
      return Object.keys(storage)[i] || null;
    },
    get length() {
      return Object.keys(storage).length;
    }
  };
}

function resetStorage() {
  Object.keys(storage).forEach(function (k) {
    delete storage[k];
  });
}

describe('auth-remember', function () {
  var nativeRemember;
  var nativeUpload;

  beforeEach(function () {
    vi.resetModules();
    resetStorage();
    nativeRemember = { payload: null };
    nativeUpload = { apiBase: '', token: '' };
    global.window = global;
    global.localStorage = makeLocalStorage();
    global.CATTLE_TRACKER_USE_API = true;
    global.CattleTrackerApi = {
      getToken: vi.fn(function () {
        return storage.cattleTracker_apiToken || null;
      }),
      setToken: vi.fn(function (token) {
        if (token) storage.cattleTracker_apiToken = String(token);
        else delete storage.cattleTracker_apiToken;
      }),
      setPersistedApiBase: vi.fn(function (url) {
        storage.cattleTracker_apiBase = String(url);
        return true;
      }),
      login: vi.fn()
    };
    global.CattleTrackerAuthNative = {
      getRemember: vi.fn(function () {
        return Promise.resolve({ payload: nativeRemember.payload || '' });
      }),
      setRemember: vi.fn(function (payload) {
        nativeRemember.payload = payload || '';
        return Promise.resolve();
      }),
      clearRemember: vi.fn(function () {
        nativeRemember.payload = '';
        return Promise.resolve();
      }),
      getUploadConfig: vi.fn(function () {
        return Promise.resolve({
          apiBase: nativeUpload.apiBase || '',
          token: nativeUpload.token || ''
        });
      })
    };
  });

  it('encode/decode сохраняет логин и пароль', async function () {
    await import('../js/core/auth-remember.js');
    var encoded = global.encodeAuthRememberPayload({ u: 'Panko', p: 'secret' });
    expect(encoded).toBeTruthy();
    expect(encoded).not.toContain('secret');
    expect(global.decodeAuthRememberPayload(encoded)).toEqual({ u: 'Panko', p: 'secret' });
  });

  it('saveAuthRemember пишет в localStorage и native', async function () {
    await import('../js/core/auth-remember.js');
    await global.saveAuthRemember('Panko', '06121992');
    var raw = storage.cattleTracker_authRemember;
    expect(raw).toBeTruthy();
    expect(global.decodeAuthRememberPayload(raw)).toEqual({ u: 'Panko', p: '06121992' });
    expect(nativeRemember.payload).toBe(raw);
  });

  it('loadAuthRemember берёт native, если WebView-хранилище пустое', async function () {
    await import('../js/core/auth-remember.js');
    var encoded = global.encodeAuthRememberPayload({ u: 'Panko', p: 'kept' });
    nativeRemember.payload = encoded;
    var data = await global.loadAuthRemember();
    expect(data).toEqual({ u: 'Panko', p: 'kept' });
    expect(storage.cattleTracker_authRemember).toBe(encoded);
  });

  it('loadAuthRemember читает старый ключ cattleTracker_authRemember_<server>', async function () {
    await import('../js/core/auth-remember.js');
    var encoded = global.encodeAuthRememberPayload({ u: 'old', p: 'legacy' });
    storage['cattleTracker_authRemember_genetika-nn'] = encoded;
    var data = await global.loadAuthRemember();
    expect(data).toEqual({ u: 'old', p: 'legacy' });
  });

  it('hydrateNativeAuthSession поднимает JWT из native, если localStorage пуст', async function () {
    nativeUpload.apiBase = 'http://31.130.155.149:3000';
    nativeUpload.token = 'jwt-from-prefs';
    await import('../js/core/auth-remember.js');
    var result = await global.hydrateNativeAuthSession();
    expect(result.tokenRestored).toBe(true);
    expect(global.CattleTrackerApi.setToken).toHaveBeenCalledWith('jwt-from-prefs');
    expect(global.CattleTrackerApi.setPersistedApiBase).toHaveBeenCalledWith('http://31.130.155.149:3000');
  });

  it('hydrateNativeAuthSession не затирает уже сохранённый JWT', async function () {
    storage.cattleTracker_apiToken = 'jwt-local';
    nativeUpload.token = 'jwt-from-prefs';
    nativeUpload.apiBase = 'http://example';
    await import('../js/core/auth-remember.js');
    var result = await global.hydrateNativeAuthSession();
    expect(result.tokenRestored).toBe(false);
    expect(global.CattleTrackerApi.setToken).not.toHaveBeenCalled();
  });

  it('tryRememberedLogin входит по сохранённому паролю, если сессии нет', async function () {
    global.CattleTrackerApi.login.mockResolvedValue({
      token: 'jwt-new',
      user: { id: 'u1', username: 'Panko', role: 'admin' }
    });
    await import('../js/core/auth-remember.js');
    await global.saveAuthRemember('Panko', '06121992');
    var user = await global.tryRememberedLogin();
    expect(global.CattleTrackerApi.login).toHaveBeenCalledWith('Panko', '06121992');
    expect(user.username).toBe('Panko');
  });
});
