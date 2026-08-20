import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const cap = require('../server/lib/capabilities.js');
const root = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('role capabilities', () => {
  it('defaults: service has no analytics or eventsInput', () => {
    const d = cap.getDefaultRoleCapabilities();
    expect(d.service.analytics).toBe(false);
    expect(d.service.eventsInput).toBe(false);
    expect(d.service.serviceWorksInput).toBe(true);
    expect(d.inseminator.eventsInput).toBe(true);
    expect(d.inseminator.analytics).toBe(false);
  });

  it('merge applies overlay and ignores admin-only keys', () => {
    const merged = cap.mergeRoleCapabilities({
      service: { analytics: true, adminUsersRoles: true, eventsInput: true },
      inseminator: { analytics: true }
    });
    expect(merged.service.analytics).toBe(true);
    expect(merged.service.eventsInput).toBe(true);
    expect(merged.service.adminUsersRoles).toBe(false);
    expect(merged.inseminator.analytics).toBe(true);
    expect(merged.inseminator.eventsInput).toBe(true);
  });

  it('admin always has capabilities', () => {
    const merged = cap.mergeRoleCapabilities({});
    expect(cap.userHasCapability({ role: 'admin' }, 'analytics', merged)).toBe(true);
    expect(cap.userHasCapability({ role: 'admin' }, 'adminUsersRoles', merged)).toBe(true);
  });

  it('service overlay is used for userHasCapability', () => {
    const merged = cap.mergeRoleCapabilities({ service: { analytics: true } });
    expect(cap.userHasCapability({ role: 'service' }, 'analytics', merged)).toBe(true);
    expect(cap.userHasCapability({ role: 'service' }, 'eventsInput', merged)).toBe(false);
  });

  it('service can create protocols via serviceWorksInput', () => {
    const merged = cap.mergeRoleCapabilities({});
    expect(cap.userHasCapability({ role: 'service' }, 'serviceWorksInput', merged)).toBe(true);
    const src = readFileSync(join(root, 'server/routes/protocols.js'), 'utf8');
    expect(src).toMatch(/requireAnyCapability\('eventsInput', 'farmCardSettings', 'serviceWorksInput'\)/);
  });

  it('user overlay overrides role capabilities', () => {
    const merged = cap.mergeRoleCapabilities({});
    expect(cap.userHasCapability({ role: 'service' }, 'analytics', merged, { analytics: true })).toBe(true);
    expect(cap.userHasCapability({ role: 'service' }, 'eventsInput', merged, { eventsInput: true })).toBe(true);
    expect(cap.userHasCapability({ role: 'service' }, 'serviceWorksInput', merged, { serviceWorksInput: false })).toBe(false);
    expect(cap.userHasCapability({ role: 'inseminator' }, 'inventory', merged, { inventory: false })).toBe(false);
    expect(cap.userHasCapability({ role: 'admin' }, 'analytics', merged, { analytics: false })).toBe(true);
  });
});
