/**
 * Группировка уведомлений.
 */
import { describe, it, expect, beforeAll } from 'vitest';

function mockLocalStorage() {
  const store = new Map();
  const ls = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: (k) => { store.delete(k); },
    clear: () => { store.clear(); }
  };
  global.localStorage = ls;
  if (global.window) global.window.localStorage = ls;
  return ls;
}

describe('groupNotificationsForDisplay', () => {
  let groupNotificationsForDisplay;

  beforeAll(async () => {
    if (typeof window === 'undefined') {
      global.window = globalThis;
    }
    mockLocalStorage();
    await import('../js/features/notifications.js');
    groupNotificationsForDisplay = window.groupNotificationsForDisplay;
  });

  it('группирует по kind', () => {
    const history = [
      { id: '1', message: 'УЗИ1: корова 1', read: false, meta: { kind: 'uzi1' } },
      { id: '2', message: 'УЗИ1: корова 2', read: true, meta: { kind: 'uzi1' } },
      { id: '3', message: 'Ошибка', read: false, meta: { kind: 'data_error', category: 'errors' } }
    ];
    const groups = groupNotificationsForDisplay(history);
    const uzi = groups.find(function (g) { return g.kind === 'uzi1'; });
    const err = groups.find(function (g) { return g.kind === 'errors'; });
    expect(uzi).toBeTruthy();
    expect(uzi.count).toBe(2);
    expect(err).toBeTruthy();
    expect(err.label).toBe('Ошибки');
  });

  it('не дублирует уведомления с тем же dedupeKey', () => {
    localStorage.setItem('cattleTracker_notification_history', '[]');
    const meta = { kind: 'uzi1', dedupeKey: 'uzi1_42' };
    const opts = { showToast: false, showSystem: false };
    window.createNotification('info', 'УЗИ1: корова 42', '42', meta, opts);
    window.createNotification('info', 'УЗИ1: корова 42 повтор', '42', meta, opts);
    expect(window.getNotificationHistory().length).toBe(1);
  });

  it('схлопывает дубликаты в истории при normalizeHistory', () => {
    const dupes = [
      { id: 'a', message: 'УЗИ1: 1', read: false, meta: { kind: 'uzi1', dedupeKey: 'uzi1_1' } },
      { id: 'b', message: 'УЗИ1: 1 снова', read: false, meta: { kind: 'uzi1', dedupeKey: 'uzi1_1' } },
      { id: 'c', message: 'УЗИ2: 2', read: false, meta: { kind: 'uzi2', dedupeKey: 'uzi2_2' } }
    ];
    localStorage.setItem('cattleTracker_notification_history', JSON.stringify(dupes));
    const list = window.getNotificationHistory();
    expect(list.length).toBe(2);
  });
});
