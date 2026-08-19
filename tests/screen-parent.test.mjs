import { describe, it, expect } from 'vitest';
import { resolveScreenParent } from '../js/core/screen-parent.js';

describe('resolveScreenParent', () => {
  it('lists → list-uzi → parent lists; lists → submenu data', () => {
    expect(resolveScreenParent('list-uzi')).toEqual({ screen: 'lists' });
    expect(resolveScreenParent('lists')).toEqual({ screen: 'submenu', group: 'data' });
  });

  it('add and stall-inventory go to submenu data, not menu', () => {
    expect(resolveScreenParent('add')).toEqual({ screen: 'submenu', group: 'data' });
    expect(resolveScreenParent('stall-inventory')).toEqual({ screen: 'submenu', group: 'data' });
  });

  it('submenu → herd-hub → menu; menu has no parent', () => {
    expect(resolveScreenParent('submenu')).toEqual({ screen: 'herd-hub' });
    expect(resolveScreenParent('herd-hub')).toEqual({ screen: 'menu' });
    expect(resolveScreenParent('menu')).toBeNull();
  });

  it('view-cow uses viewCowBack', () => {
    expect(resolveScreenParent('view-cow')).toEqual({ type: 'viewCowBack' });
  });
});
