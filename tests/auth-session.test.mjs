import { beforeEach, describe, it, expect, vi } from 'vitest';

const storage = {};

function makeLocalStorage() {
  return {
    getItem(k) { return Object.prototype.hasOwnProperty.call(storage, k) ? storage[k] : null; },
    setItem(k, v) { storage[k] = String(v); },
    removeItem(k) { delete storage[k]; }
  };
}

function resetStorage() {
  Object.keys(storage).forEach(function (k) { delete storage[k]; });
}

describe('auth-session', function () {
  beforeEach(function () {
    vi.resetModules();
    resetStorage();
    global.window = global;
    global.localStorage = makeLocalStorage();
    global.CATTLE_TRACKER_USE_API = true;
    global.saveCurrentUser = vi.fn(function (user) {
      if (user) {
        storage.cattleTracker_currentUser = JSON.stringify({
          id: user.id,
          username: user.username,
          role: user.role
        });
      } else {
        delete storage.cattleTracker_currentUser;
      }
    });
    global.updateAuthBar = vi.fn();
    global.updateAuthSessionStatusUi = vi.fn();
    global.updateSyncAuthStatusUi = vi.fn();
    global.CattleTrackerApi = {
      getToken: vi.fn(),
      setToken: vi.fn(),
      getCurrentUser: vi.fn()
    };
  });

  it('token + /me OK → loggedIn and saveCurrentUser', async function () {
    global.CattleTrackerApi.getToken.mockReturnValue('jwt-ok');
    global.CattleTrackerApi.getCurrentUser.mockResolvedValue({
      id: 'u1',
      username: 'admin',
      role: 'admin'
    });
    await import('../js/core/auth-session.js');
    const session = await global.restoreApiSession();
    expect(session.status).toBe('loggedIn');
    expect(session.user.username).toBe('admin');
    expect(global.saveCurrentUser).toHaveBeenCalledWith(session.user);
    expect(global.isAuthLoggedIn()).toBe(true);
  });

  it('token + /me 401 → sessionExpired, token and user cleared', async function () {
    storage.cattleTracker_currentUser = JSON.stringify({ id: 'u1', username: 'old', role: 'operator' });
    storage.cattleTracker_apiToken = 'jwt-bad';
    global.CattleTrackerApi.getToken.mockReturnValue('jwt-bad');
    const err = new Error('Unauthorized');
    err.status = 401;
    global.CattleTrackerApi.getCurrentUser.mockRejectedValue(err);
    await import('../js/core/auth-session.js');
    const session = await global.restoreApiSession();
    expect(session.status).toBe('sessionExpired');
    expect(global.CattleTrackerApi.setToken).toHaveBeenCalledWith(null);
    expect(global.saveCurrentUser).toHaveBeenCalledWith(null);
    expect(storage.cattleTracker_currentUser).toBeUndefined();
  });

  it('no token + stale currentUser → serverOnly, profile cleared', async function () {
    storage.cattleTracker_currentUser = JSON.stringify({ id: 'u1', username: 'stale', role: 'operator' });
    global.CattleTrackerApi.getToken.mockReturnValue(null);
    await import('../js/core/auth-session.js');
    const session = await global.restoreApiSession();
    expect(session.status).toBe('serverOnly');
    expect(global.saveCurrentUser).toHaveBeenCalledWith(null);
    expect(storage.cattleTracker_currentUser).toBeUndefined();
    expect(session.lastUsername).toBe('stale');
  });
});
