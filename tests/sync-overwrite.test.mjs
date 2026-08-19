/**
 * Выгрузка на сервер не должна зависать из‑за вызовов
 * globalThis.__syncBases.setBtns / addNext, которых нет на namespace.
 */
import { describe, it, expect, beforeAll } from 'vitest';

describe('overwriteCurrentServerBaseWithLocal', () => {
  beforeAll(async () => {
    if (typeof globalThis.window === 'undefined') globalThis.window = globalThis;
    globalThis.document = {
      getElementById: () => null,
      querySelectorAll: () => []
    };
    window.CATTLE_TRACKER_USE_API = true;
    window.entries = [{ cattleId: 'A1', synced: false }];
    window.getCurrentObjectId = function () { return 'obj-1'; };
    window.showConfirmModal = function () { return Promise.resolve(true); };
    window._syncTestCalls = { deleted: [], created: [] };
    window.CattleTrackerApi = {
      PENDING_OBJECT_ID: null,
      loadEntries: async function () { return [{ cattleId: 'OLD' }]; },
      deleteEntry: async function (_oid, cid) { window._syncTestCalls.deleted.push(cid); },
      createEntry: async function (_oid, entry) { window._syncTestCalls.created.push(entry.cattleId); }
    };
    await import('../js/features/sync/sync-bases/shared.js');
    await import('../js/features/sync/sync-bases/part-1.js');
    await import('../js/features/sync/sync-bases/part-3.js');
  });

  it('завершает выгрузку: удаляет старые и создаёт локальные записи', async () => {
    const fn = globalThis.__syncBases && globalThis.__syncBases.overwriteCurrentServerBaseWithLocal;
    expect(typeof fn).toBe('function');
    await fn();
    expect(window._syncTestCalls.deleted).toEqual(['OLD']);
    expect(window._syncTestCalls.created).toEqual(['A1']);
  });
});
