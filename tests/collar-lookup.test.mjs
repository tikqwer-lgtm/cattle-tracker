import { describe, it, expect } from 'vitest';
import {
  findEntryByCattleId,
  findEntryByCollar,
  resolveCattleIdFromNumberOrCollar,
  applyCollarToHerd,
  entryMatchesNumberOrCollar
} from '../js/utils/collar-lookup.js';

const herd = [
  { cattleId: '101', nickname: 'Зорька', collar: 'A12' },
  { cattleId: '102', nickname: 'Роза', collar: 'B3' }
];

describe('collar-lookup', () => {
  it('находит по номеру и ошейнику', () => {
    expect(findEntryByCattleId('101', herd).nickname).toBe('Зорька');
    expect(findEntryByCollar('a12', herd).cattleId).toBe('101');
    expect(findEntryByCollar('нет', herd)).toBeNull();
  });

  it('подставляет номер, если ввели только ошейник', () => {
    expect(resolveCattleIdFromNumberOrCollar('', 'B3', herd)).toBe('102');
    expect(resolveCattleIdFromNumberOrCollar('101', 'B3', herd)).toBe('101');
  });

  it('переносит ошейник на другую карточку и снимает со старой', () => {
    const a = { cattleId: '101', collar: 'A12' };
    const b = { cattleId: '102', collar: '' };
    const list = [a, b];
    applyCollarToHerd(b, 'A12', list);
    expect(b.collar).toBe('A12');
    expect(a.collar).toBe('');
  });

  it('ищет по ошейнику в строке', () => {
    expect(entryMatchesNumberOrCollar(herd[0], 'A12')).toBe(true);
    expect(entryMatchesNumberOrCollar(herd[0], 'зор')).toBe(true);
    expect(entryMatchesNumberOrCollar(herd[0], 'zzz')).toBe(false);
  });
});
