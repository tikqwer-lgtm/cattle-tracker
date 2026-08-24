import { describe, it, expect, beforeEach } from 'vitest';
import '../js/storage/data-hash.js';
import '../js/storage/offline-outbox.js';

const hashApi = () => globalThis.CattleTrackerDataHash;
const outboxApi = () => globalThis.CattleTrackerOutbox;

describe('CattleTrackerDataHash', () => {
  it('даёт одинаковый хеш независимо от порядка ключей', () => {
    const h = hashApi();
    expect(h.contentHash({ a: 1, b: 2 })).toBe(h.contentHash({ b: 2, a: 1 }));
  });

  it('игнорирует служебные поля _savedAt', () => {
    const h = hashApi();
    expect(h.contentHash({ name: 'x', _savedAt: 1 })).toBe(h.contentHash({ name: 'x', _savedAt: 99 }));
  });

  it('при разном хеше берёт более свежий источник', () => {
    const h = hashApi();
    const local = { name: 'локально', updatedAt: '2026-08-24T12:00:00.000Z' };
    const remote = { name: 'сервер', updatedAt: '2026-08-20T12:00:00.000Z' };
    const picked = h.pickNewerSource(local, Date.parse(local.updatedAt), remote, Date.parse(remote.updatedAt));
    expect(picked.source).toBe('local');
    expect(picked.value.name).toBe('локально');
  });

  it('при одинаковом хеше считает источники равными', () => {
    const h = hashApi();
    const a = { name: 'карточка', items: [{ id: '1', value: 2 }] };
    const picked = h.pickNewerSource(a, 10, JSON.parse(JSON.stringify(a)), 99);
    expect(picked.source).toBe('equal');
  });
});

describe('CattleTrackerOutbox sequential flush', () => {
  beforeEach(() => {
    const store = {};
    globalThis.localStorage = {
      getItem: (k) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
      setItem: (k, v) => {
        store[k] = String(v);
      },
      removeItem: (k) => {
        delete store[k];
      },
      clear: () => {
        Object.keys(store).forEach((k) => delete store[k]);
      }
    };
    localStorage.clear();
  });

  it('отправляет задания строго по одному', async () => {
    const log = [];
    let active = 0;
    const api = {
      createEntry: async (_oid, entry) => {
        active += 1;
        expect(active).toBe(1);
        log.push(entry.cattleId);
        await new Promise((r) => setTimeout(r, 5));
        active -= 1;
      }
    };
    const ob = outboxApi();
    ob.enqueue({ op: 'create', objectId: 'o1', entry: { cattleId: 'A' } });
    ob.enqueue({ op: 'create', objectId: 'o1', entry: { cattleId: 'B' } });
    ob.enqueue({ op: 'create', objectId: 'o1', entry: { cattleId: 'C' } });
    expect(ob.count()).toBe(3);
    const res = await ob.flush(api);
    expect(res.flushed).toBe(3);
    expect(log).toEqual(['A', 'B', 'C']);
    expect(ob.count()).toBe(0);
  });

  it('останавливается на сетевой ошибке и сохраняет хвост очереди', async () => {
    let n = 0;
    const api = {
      updateEntry: async () => {
        n += 1;
        if (n === 2) throw new Error('Сервер недоступен');
      }
    };
    const ob = outboxApi();
    ob.enqueue({ op: 'update', objectId: 'o1', cattleId: '1', entry: {} });
    ob.enqueue({ op: 'update', objectId: 'o1', cattleId: '2', entry: {} });
    ob.enqueue({ op: 'update', objectId: 'o1', cattleId: '3', entry: {} });
    const res = await ob.flush(api);
    expect(res.paused).toBe(true);
    expect(res.flushed).toBe(1);
    expect(ob.count()).toBe(2);
  });
});
