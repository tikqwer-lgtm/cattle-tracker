/**
 * Unit-тесты calving-calc.js
 */
import { describe, it, expect } from 'vitest';
import {
  getCalvingStatsForMonth,
  getExpectedCalvingDateFromInsem,
  getPlanDisplayMonth,
  compareMonth,
  GESTATION_DAYS
} from '../js/features/calving-calc.js';

describe('GESTATION_DAYS', () => {
  it('равно 285', () => {
    expect(GESTATION_DAYS).toBe(285);
  });
});

describe('getExpectedCalvingDateFromInsem', () => {
  it('добавляет 285 дней к дате осеменения', () => {
    const d = getExpectedCalvingDateFromInsem('2025-01-01');
    expect(d.getFullYear()).toBe(2025);
    expect(d.getMonth()).toBe(9);
    expect(d.getDate()).toBe(13);
  });
});

describe('getPlanDisplayMonth', () => {
  it('просроченная: display = текущий месяц', () => {
    const expected = getExpectedCalvingDateFromInsem('2025-08-15');
    const ref = new Date(2026, 5, 10);
    const display = getPlanDisplayMonth(expected, ref);
    expect(display.year).toBe(2026);
    expect(display.month).toBe(5);
  });

  it('будущий план: display = plannedMonth', () => {
    const expected = getExpectedCalvingDateFromInsem('2025-09-01');
    const ref = new Date(2026, 5, 10);
    const display = getPlanDisplayMonth(expected, ref);
    expect(display.month).toBe(expected.getMonth());
    expect(display.year).toBe(expected.getFullYear());
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
    const expected = getExpectedCalvingDateFromInsem('2025-09-01');
    const stats = getCalvingStatsForMonth(entries, expected.getFullYear(), expected.getMonth(), ref);
    expect(stats.plan.count).toBe(1);
    expect(stats.rows.length).toBe(1);
    expect(stats.rows[0].cattleId).toBe('1');
    expect(stats.rows[0].rowKind).toBe('plan');
    expect(stats.rows[0].actualCalvingDate).toBeNull();
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

  it('факт по calvingDate в месяце (осеменение из снимка лактации)', () => {
    const entries = [{
      cattleId: '3',
      status: 'Холостая',
      calvingDate: '2026-06-05',
      inseminationDate: '2026-07-20',
      inseminationHistory: [{ date: '2026-07-20' }],
      lactationHistory: [{
        calvingDate: '2026-06-05',
        inseminationDate: '2025-08-25',
        inseminationHistory: [{ date: '2025-08-25' }]
      }]
    }];
    const stats = getCalvingStatsForMonth(entries, 2026, 5, ref);
    expect(stats.fact.count).toBe(1);
    expect(stats.rows[0].inseminationDate).toBe('2025-08-25');
    expect(stats.rows[0].actualCalvingDate).toBe('2026-06-05');
    expect(stats.rows[0].planFactDiffDays).not.toBeNull();
  });

  it('факт с датой в будущем — dataError', () => {
    const entries = [{
      cattleId: '4',
      status: 'Отёл',
      calvingDate: '2026-08-01',
      lactationHistory: [{
        calvingDate: '2026-08-01',
        inseminationDate: '2025-10-20',
        inseminationHistory: [{ date: '2025-10-20' }]
      }]
    }];
    const stats = getCalvingStatsForMonth(entries, 2026, 7, ref);
    expect(stats.fact.count).toBe(1);
    expect(stats.fact.hasDataErrors).toBe(true);
    expect(stats.fact.items[0].dataError).toBe(true);
  });

  it('просроченная не в следующем просматриваемом месяце (ref июнь, смотрим июль)', () => {
    const entries = [{
      cattleId: '6',
      status: 'Стельная',
      inseminationDate: '2025-08-15',
      inseminationHistory: [{ date: '2025-08-15' }]
    }];
    const june = getCalvingStatsForMonth(entries, 2026, 5, ref);
    const july = getCalvingStatsForMonth(entries, 2026, 6, ref);
    expect(june.plan.count).toBe(1);
    expect(june.plan.items[0].overdue).toBe(true);
    expect(july.plan.count).toBe(0);
  });

  it('стельная без осеменения — не в списке', () => {
    const entries = [{ cattleId: '7', status: 'Стельная' }];
    const june = getCalvingStatsForMonth(entries, 2026, 5, ref);
    expect(june.plan.count).toBe(0);
    expect(june.rows.length).toBe(0);
  });

  it('прошлый плановый месяц: просроченная не дублируется', () => {
    const entries = [{
      cattleId: '5',
      status: 'Стельная',
      inseminationDate: '2025-08-01',
      inseminationHistory: [{ date: '2025-08-01' }]
    }];
    const expected = getExpectedCalvingDateFromInsem('2025-08-01');
    const statsPlanned = getCalvingStatsForMonth(entries, expected.getFullYear(), expected.getMonth(), ref);
    const statsJune = getCalvingStatsForMonth(entries, 2026, 5, ref);
    expect(statsPlanned.plan.count).toBe(0);
    expect(statsJune.plan.items.some(function (x) { return x.cattleId === '5' && x.overdue; })).toBe(true);
  });

  it('повторное осеменение после отёла: факт использует архив, не текущее осеменение', () => {
    const entries = [{
      cattleId: '8',
      nickname: 'Зорька',
      status: 'Осемененная',
      calvingDate: '2026-06-10',
      inseminationDate: '2026-08-01',
      inseminationHistory: [{ date: '2026-08-01' }],
      lactationHistory: [{
        number: 2,
        calvingDate: '2026-06-10',
        inseminationDate: '2025-09-05',
        inseminationHistory: [{ date: '2025-09-05' }]
      }]
    }];
    const june = getCalvingStatsForMonth(entries, 2026, 5, ref);
    expect(june.fact.count).toBe(1);
    expect(june.rows[0].inseminationDate).toBe('2025-09-05');
    expect(june.rows[0].inseminationDate).not.toBe('2026-08-01');
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
