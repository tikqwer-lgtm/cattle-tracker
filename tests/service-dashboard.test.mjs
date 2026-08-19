import { describe, it, expect } from 'vitest';
import { computeServiceDashboardStats } from '../js/features/service-dashboard-calc.js';
import { normalizePregnancyCheckResult } from '../js/features/export-import-parse.js';

function cow(partial) {
  return Object.assign(
    {
      cattleId: '1',
      group: 'A',
      status: 'Осемененная',
      exitDate: '',
      inseminationHistory: [],
      uziHistory: [],
      actionHistory: [],
      lactationHistory: []
    },
    partial
  );
}

describe('computeServiceDashboardStats', () => {
  it('counts my inseminations by actionHistory.userName', () => {
    const entries = [
      cow({
        cattleId: '10',
        actionHistory: [
          { dateTime: '2026-03-01 10:00', userName: 'svc', action: 'Осеменение', eventType: 'Осеменение' },
          { dateTime: '2026-03-02 10:00', userName: 'other', action: 'Осеменение', eventType: 'Осеменение' }
        ]
      })
    ];
    const stats = computeServiceDashboardStats(entries, { username: 'svc', mineOnly: true });
    expect(stats.inseminationCount).toBe(1);
  });

  it('counts inseminationHistory when actionHistory has no matching ИО', () => {
    const entries = [
      cow({
        cattleId: '11',
        inseminationHistory: [{ date: '2026-03-01', inseminator: 'svc', attemptNumber: 1 }]
      })
    ];
    const stats = computeServiceDashboardStats(entries, { username: 'svc', mineOnly: true });
    expect(stats.inseminationCount).toBe(1);
  });

  it('does not double-count ИО present in both actionHistory and inseminationHistory', () => {
    const entries = [
      cow({
        cattleId: '12',
        inseminationHistory: [{ date: '2026-03-01', inseminator: 'svc' }],
        actionHistory: [
          {
            dateTime: '2026-03-01 12:00',
            userName: 'svc',
            action: 'Осеменение',
            eventType: 'Осеменение',
            details: 'Дата: 2026-03-01'
          }
        ]
      })
    ];
    const stats = computeServiceDashboardStats(entries, { username: 'svc', mineOnly: true });
    expect(stats.inseminationCount).toBe(1);
  });

  it('counts pregnant cows I inseminated and percent of inseminations', () => {
    const entries = [
      cow({
        cattleId: '20',
        status: 'Стельная',
        inseminationHistory: [{ date: '2026-04-01', inseminator: 'svc' }],
        actionHistory: [
          { dateTime: '2026-04-01 10:00', userName: 'svc', action: 'Осеменение', eventType: 'Осеменение', details: 'Дата: 2026-04-01' }
        ]
      }),
      cow({
        cattleId: '21',
        status: 'Осемененная',
        inseminationHistory: [{ date: '2026-04-02', inseminator: 'svc' }],
        actionHistory: [
          { dateTime: '2026-04-02 10:00', userName: 'svc', action: 'Осеменение', eventType: 'Осеменение', details: 'Дата: 2026-04-02' }
        ]
      })
    ];
    const stats = computeServiceDashboardStats(entries, { username: 'svc', mineOnly: true });
    expect(stats.pregnantCount).toBe(1);
    expect(stats.pregnantPct).toBe(50);
  });

  it('counts current doubtful USI1 and percent of all my USI1', () => {
    const entries = [
      cow({
        cattleId: '30',
        status: 'Осемененная',
        uziHistory: [{ date: '2026-05-10', result: 'Сомнительная', specialist: 'svc', daysFromInsemination: 32 }],
        actionHistory: [
          { dateTime: '2026-05-10 11:00', userName: 'svc', action: 'УЗИ', eventType: 'УЗИ1', result: 'Сомнительная', details: 'Дата: 2026-05-10' }
        ]
      }),
      cow({
        cattleId: '31',
        status: 'Стельная',
        uziHistory: [{ date: '2026-05-11', result: 'Стельная', specialist: 'svc', daysFromInsemination: 33 }],
        actionHistory: [
          { dateTime: '2026-05-11 11:00', userName: 'svc', action: 'УЗИ', eventType: 'УЗИ1', result: 'Стельная', details: 'Дата: 2026-05-11' }
        ]
      })
    ];
    const stats = computeServiceDashboardStats(entries, { username: 'svc', mineOnly: true });
    expect(stats.doubtfulCount).toBe(1);
    expect(stats.uzi1Count).toBe(2);
    expect(stats.doubtfulPct).toBe(50);
    expect(stats.doubtfulByDays).toEqual([{ days: 32, heads: 1 }]);
    expect(stats.doubtfulList.map((r) => r.cattleId)).toEqual(['30']);
  });

  it('drops doubtful after a later resolving USI', () => {
    const entries = [
      cow({
        cattleId: '32',
        status: 'Стельная',
        uziHistory: [
          { date: '2026-05-10', result: 'Сомнительная', specialist: 'svc', daysFromInsemination: 32 },
          { date: '2026-05-20', result: 'Стельная', specialist: 'svc', daysFromInsemination: 42 }
        ],
        actionHistory: [
          { dateTime: '2026-05-10 11:00', userName: 'svc', action: 'УЗИ', eventType: 'УЗИ1', result: 'Сомнительная' },
          { dateTime: '2026-05-20 11:00', userName: 'svc', action: 'УЗИ', eventType: 'УЗИ', result: 'Стельная' }
        ]
      })
    ];
    const stats = computeServiceDashboardStats(entries, { username: 'svc', mineOnly: true });
    expect(stats.doubtfulCount).toBe(0);
    expect(stats.doubtfulList).toEqual([]);
  });

  it('computes USI accuracy as USI2 pregnant / USI1 pregnant among dual-check cows', () => {
    const entries = [
      cow({
        cattleId: '40',
        status: 'Стельная',
        inseminationHistory: [{ date: '2026-01-01', inseminator: 'svc' }],
        uziHistory: [
          { date: '2026-02-05', result: 'Стельная', specialist: 'svc', daysFromInsemination: 35 },
          { date: '2026-03-05', result: 'Стельная', specialist: 'svc', daysFromInsemination: 63 }
        ],
        actionHistory: [
          { dateTime: '2026-02-05 10:00', userName: 'svc', action: 'УЗИ', eventType: 'УЗИ1', result: 'Стельная' },
          { dateTime: '2026-03-05 10:00', userName: 'svc', action: 'УЗИ', eventType: 'УЗИ2', result: 'Стельная' }
        ]
      }),
      cow({
        cattleId: '41',
        status: 'Холостая',
        inseminationHistory: [{ date: '2026-01-02', inseminator: 'svc' }],
        uziHistory: [
          { date: '2026-02-06', result: 'Стельная', specialist: 'svc', daysFromInsemination: 35 },
          { date: '2026-03-06', result: 'Не стельная', specialist: 'svc', daysFromInsemination: 63 }
        ],
        actionHistory: [
          { dateTime: '2026-02-06 10:00', userName: 'svc', action: 'УЗИ', eventType: 'УЗИ1', result: 'Стельная' },
          { dateTime: '2026-03-06 10:00', userName: 'svc', action: 'УЗИ', eventType: 'УЗИ2', result: 'Не стельная' }
        ]
      }),
      cow({
        cattleId: '42',
        status: 'Стельная',
        inseminationHistory: [{ date: '2026-01-03', inseminator: 'svc' }],
        uziHistory: [{ date: '2026-02-07', result: 'Стельная', specialist: 'svc', daysFromInsemination: 35 }],
        actionHistory: [
          { dateTime: '2026-02-07 10:00', userName: 'svc', action: 'УЗИ', eventType: 'УЗИ1', result: 'Стельная' }
        ]
      })
    ];
    const stats = computeServiceDashboardStats(entries, { username: 'svc', mineOnly: true });
    expect(stats.uziAccuracyDenominator).toBe(2);
    expect(stats.uziAccuracyNumerator).toBe(1);
    expect(stats.uziAccuracyPct).toBe(50);
  });

  it('includes closed lactation snapshots in USI accuracy', () => {
    const entries = [
      cow({
        cattleId: '50',
        status: 'Осемененная',
        inseminationHistory: [],
        uziHistory: [],
        lactationHistory: [
          {
            inseminationHistory: [{ date: '2025-01-01', inseminator: 'svc' }],
            uziHistory: [
              { date: '2025-02-05', result: 'Стельная', specialist: 'svc' },
              { date: '2025-03-05', result: 'Стельная', specialist: 'svc' }
            ]
          }
        ],
        actionHistory: [
          { dateTime: '2025-02-05 10:00', userName: 'svc', action: 'УЗИ', eventType: 'УЗИ1', result: 'Стельная' },
          { dateTime: '2025-03-05 10:00', userName: 'svc', action: 'УЗИ', eventType: 'УЗИ2', result: 'Стельная' }
        ]
      })
    ];
    const stats = computeServiceDashboardStats(entries, { username: 'svc', mineOnly: true });
    expect(stats.uziAccuracyDenominator).toBe(1);
    expect(stats.uziAccuracyNumerator).toBe(1);
    expect(stats.uziAccuracyPct).toBe(100);
  });

  it('mineOnly false includes all specialists on the herd', () => {
    const entries = [
      cow({
        cattleId: '60',
        actionHistory: [
          { dateTime: '2026-03-01 10:00', userName: 'svc', action: 'Осеменение', eventType: 'Осеменение' },
          { dateTime: '2026-03-02 10:00', userName: 'other', action: 'Осеменение', eventType: 'Осеменение' }
        ]
      })
    ];
    const mine = computeServiceDashboardStats(entries, { username: 'svc', mineOnly: true });
    const all = computeServiceDashboardStats(entries, { username: 'svc', mineOnly: false });
    expect(mine.inseminationCount).toBe(1);
    expect(all.inseminationCount).toBe(2);
  });

  it('skips exited animals in current pregnant and doubtful lists', () => {
    const entries = [
      cow({
        cattleId: '70',
        status: 'Стельная',
        exitDate: '2026-06-01',
        inseminationHistory: [{ date: '2026-04-01', inseminator: 'svc' }],
        actionHistory: [
          { dateTime: '2026-04-01 10:00', userName: 'svc', action: 'Осеменение', eventType: 'Осеменение' }
        ]
      })
    ];
    const stats = computeServiceDashboardStats(entries, { username: 'svc', mineOnly: true });
    expect(stats.inseminationCount).toBe(1);
    expect(stats.pregnantCount).toBe(0);
  });
});

describe('normalizePregnancyCheckResult doubtful', () => {
  it('maps сомнительная aliases', () => {
    expect(normalizePregnancyCheckResult('Сомнительная')).toBe('Сомнительная');
    expect(normalizePregnancyCheckResult('сомн.')).toBe('Сомнительная');
    expect(normalizePregnancyCheckResult('сомн')).toBe('Сомнительная');
  });
});
