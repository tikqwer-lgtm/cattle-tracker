import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

describe('service version capabilities and preview', () => {
  let U;

  beforeAll(async () => {
    if (typeof globalThis.window === 'undefined') {
      globalThis.window = globalThis;
    }
    const store = {};
    globalThis.sessionStorage = {
      getItem: (k) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
      setItem: (k, v) => {
        store[k] = String(v);
      },
      removeItem: (k) => {
        delete store[k];
      }
    };
    globalThis.window.sessionStorage = globalThis.sessionStorage;
    await import('../js/core/users/shared.js');
    await import('../js/core/users/part-1.js');
    U = globalThis.__users;
    if (!U || !U.hasCapability) throw new Error('users module not loaded');
  });

  beforeEach(() => {
    U.clearPreviewRole();
    U.setRoleCapabilities(null);
    U.state.currentUser = { id: 'u1', username: 'Panko', role: 'admin' };
  });

  it('service can write works and farm events, but not herd eventsInput', () => {
    const service = { id: 's1', username: 'svc', role: 'service' };
    expect(U.hasCapability('serviceWorksInput', service)).toBe(true);
    expect(U.hasCapability('farmCardEventsWrite', service)).toBe(true);
    expect(U.hasCapability('eventsInput', service)).toBe(false);
    expect(U.hasCapability('inventory', service)).toBe(false);
    expect(U.hasCapability('farmCardSettings', service)).toBe(false);
    expect(U.hasCapability('analytics', service)).toBe(false);
    expect(U.canInputServiceWorks(service)).toBe(true);
  });

  it('role overlay from admin can enable analytics for service', () => {
    const service = { id: 's1', username: 'svc', role: 'service' };
    U.setRoleCapabilities({ service: { analytics: true } });
    expect(U.hasCapability('analytics', service)).toBe(true);
    expect(U.hasCapability('eventsInput', service)).toBe(false);
    U.setRoleCapabilities(null);
  });

  it('admin preview switches UI role without changing real role', () => {
    expect(U.getRealRole()).toBe('admin');
    expect(U.isAppAdminRole()).toBe(true);
    U.setPreviewRole('service');
    expect(U.getUiRole()).toBe('service');
    expect(U.getEffectiveRole()).toBe('service');
    expect(U.isRolePreviewMode()).toBe(true);
    expect(U.hasCapability('eventsInput')).toBe(false);
    expect(U.hasCapability('serviceWorksInput')).toBe(true);
    expect(U.isAppAdminRole()).toBe(true);
    U.setPreviewRole('admin');
    expect(U.getUiRole()).toBe('admin');
    expect(U.isRolePreviewMode()).toBe(false);
  });
});

describe('service-work-acl', () => {
  const acl = require('../server/lib/service-work-acl.js');

  it('allows insemination patch and keeps calving date', () => {
    const existing = {
      cattleId: '101',
      calvingDate: '2024-01-01',
      status: 'Холостая',
      actionHistory: [{ eventType: 'Отёл', date: '2024-01-01' }]
    };
    const incoming = {
      cattleId: '101',
      calvingDate: '2099-01-01',
      status: 'Осемененная',
      inseminationDate: '2026-08-01',
      actionHistory: [
        { eventType: 'Отёл', date: '2024-01-01' },
        { eventType: 'Осеменение', date: '2026-08-01' }
      ]
    };
    const patched = acl.applyServiceEntryUpdate(existing, incoming);
    expect(patched.ok).toBe(true);
    expect(patched.entry.calvingDate).toBe('2024-01-01');
    expect(patched.entry.inseminationDate).toBe('2026-08-01');
    expect(patched.entry.status).toBe('Осемененная');
    expect(patched.entry.actionHistory.some((x) => x.eventType === 'Осеменение')).toBe(true);
    expect(patched.entry.actionHistory.some((x) => x.eventType === 'Отёл')).toBe(true);
  });

  it('rejects new calving history from service', () => {
    const existing = { cattleId: '101', actionHistory: [] };
    const incoming = {
      actionHistory: [{ eventType: 'Отёл', date: '2026-08-01' }]
    };
    const patched = acl.applyServiceEntryUpdate(existing, incoming);
    expect(patched.ok).toBe(false);
  });

  it('creates a new cow for service with insemination only', () => {
    const incoming = {
      cattleId: '909',
      nickname: 'hack',
      calvingDate: '2024-01-01',
      status: 'Осемененная',
      inseminationDate: '2026-08-19',
      actionHistory: [{ eventType: 'Осеменение', date: '2026-08-19' }]
    };
    const created = acl.applyServiceEntryCreate(incoming);
    expect(created.ok).toBe(true);
    expect(created.entry.cattleId).toBe('909');
    expect(created.entry.inseminationDate).toBe('2026-08-19');
    expect(created.entry.status).toBe('Осемененная');
    expect(created.entry.nickname).toBe('');
    expect(created.entry.calvingDate).toBe('');
    expect(created.entry.actionHistory.some((x) => x.eventType === 'Осеменение')).toBe(true);
  });

  it('rejects service create with calving history', () => {
    const created = acl.applyServiceEntryCreate({
      cattleId: '910',
      actionHistory: [{ eventType: 'Отёл', date: '2026-08-01' }]
    });
    expect(created.ok).toBe(false);
  });

  it('farm card events-only keeps addresses', () => {
    const prev = {
      addresses: [{ id: 'a1' }],
      events: [],
      notes: 'keep'
    };
    const next = acl.applyFarmCardEventsOnly(prev, {
      addresses: [],
      notes: 'hack',
      events: [{ id: 'ev1', title: 'Визит' }]
    });
    expect(next.addresses).toEqual([{ id: 'a1' }]);
    expect(next.notes).toBe('keep');
    expect(next.events).toEqual([{ id: 'ev1', title: 'Визит' }]);
  });
});
