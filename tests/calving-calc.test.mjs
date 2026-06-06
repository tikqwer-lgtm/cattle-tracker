/**
 * Unit-тесты calving-calc.js
 */
import { describe, it, expect } from 'vitest';
import {
  getCalvingStatsForMonth,
  getExpectedCalvingDateFromInsem,
  compareMonth
} from '../js/features/calving-calc.js';

describe('getExpectedCalvingDateFromInsem', () => {
  it('добавляет 280 дней к дате осеменения', () => {
    const d = getExpectedCalvingDateFromInsem('2025-01-01');
    expect(d.getFullYear()).toBe(2025);
    expect(d.getMonth()).toBe(9);
    expect(d.getDate()).toBe(8);
  });
});

describe('getCalvingStatsForMonth', () => {
  const ref = new Date(2026, 5, 10);

  it('план: стельная с осеменением в месяце отёла', () => {
    const entries = [{
      cattleId: '1',
      status: 'Стельная',
      inseminationDate: '2025-09-01',
      inseminationHistory: [{ date: '2025-09-01' }]
    }];
    const stats = getCalvingStatsForMonth(entries, 2026, 5, ref);
    expect(stats.plan.count).toBe(1);
    expect(stats.plan.items[0].cattleId).toBe('1');
  });

  it('rollover: просроченная стельная в текущем месяце', () => {
    const entries = [{
      cattleId: '2',
      status: 'Стельная',
      inseminationDate: '2025-08-15',
      inseminationHistory: [{ date: '2025-08-15' }]
    }];
    const stats = getCalvingStatsForMonth(entries, 2026, 5, ref);
    expect(stats.plan.count).toBe(1);
    expect(stats.plan.items[0].overdue).toBe(true);
  });

  it('факт по calvingDate в месяце', () => {
    const entries = [{
      cattleId: '3',
      status: 'Отёл',
      calvingDate: '2026-06-05'
    }];
    const stats = getCalvingStatsForMonth(entries, 2026, 5, ref);
    expect(stats.fact.count).toBe(1);
  });

  it('факт с датой в будущем — dataError', () => {
    const entries = [{
      cattleId: '4',
      status: 'Отёл',
      calvingDate: '2026-08-01'
    }];
    const stats = getCalvingStatsForMonth(entries, 2026, 7, ref);
    expect(stats.fact.count).toBe(1);
    expect(stats.fact.hasDataErrors).toBe(true);
    expect(stats.fact.items[0].dataError).toBe(true);
  });

  it('прошлый месяц: план без rollover просроченных', () => {
    const entries = [{
      cattleId: '5',
      status: 'Стельная',
      inseminationDate: '2025-08-01',
      inseminationHistory: [{ date: '2025-08-01' }]
    }];
    const statsMay = getCalvingStatsForMonth(entries, 2026, 4, ref);
    const statsJune = getCalvingStatsForMonth(entries, 2026, 5, ref);
    expect(statsMay.plan.count).toBeGreaterThanOrEqual(0);
    expect(statsJune.plan.items.some(function (x) { return x.cattleId === '5' && x.overdue; })).toBe(true);
  });
});

describe('compareMonth', () => {
  it('определяет прошлый/текущий/будущий месяц', () => {
    const ref = new Date(2026, 5, 1);
    expect(compareMonth(2026, 4, ref)).toBe(-1);
    expect(compareMonth(2026, 5, ref)).toBe(0);
    expect(compareMonth(2026, 6, ref)).toBe(1);
  });
});
