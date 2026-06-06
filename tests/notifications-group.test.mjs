/**
 * Группировка уведомлений.
 */
import { describe, it, expect, beforeAll } from 'vitest';

describe('groupNotificationsForDisplay', () => {
  let groupNotificationsForDisplay;

  beforeAll(async () => {
    if (typeof window === 'undefined') {
      global.window = globalThis;
    }
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
});
