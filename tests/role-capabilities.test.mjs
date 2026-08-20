import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const cap = require('../server/lib/capabilities.js');

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
});
