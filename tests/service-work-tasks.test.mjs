import { describe, it, expect } from 'vitest';
import {
  addDaysIso,
  checkDueDateFromWork,
  normalizeWorkTask,
  closePregChecksWithUziTask,
  listOpenPregChecks,
  collectServiceWorkItemsFromTasks,
  sumTaskQuantities,
  appendWorkTaskToBundle,
  PREG_CHECK_DAYS
} from '../js/features/service-work-tasks.js';

describe('service-work-tasks dates', () => {
  it('adds 32 days for pregnancy check', () => {
    expect(PREG_CHECK_DAYS).toBe(32);
    expect(checkDueDateFromWork('2026-08-01')).toBe('2026-09-02');
    expect(addDaysIso('2026-01-31', 1)).toBe('2026-02-01');
  });
});

describe('closePregChecksWithUziTask', () => {
  it('closes by matching cattle ids', () => {
    var insem = normalizeWorkTask({
      id: 'wt1',
      type: 'insemination',
      workDate: '2026-08-01',
      count: 2,
      animals: [{ cattleId: '101' }, { cattleId: '102' }],
      checkDueDate: '2026-09-02'
    });
    var uzi = normalizeWorkTask({
      id: 'wt2',
      type: 'uzi',
      workDate: '2026-09-05',
      count: 1,
      animals: [{ cattleId: '101', result: 'pregnant' }]
    });
    var next = closePregChecksWithUziTask([insem], uzi);
    expect(next[0].checkClosedByTaskId).toBe('wt2');
  });

  it('batch-closes open checks when UZI has no animal ids', () => {
    var insem = normalizeWorkTask({
      id: 'wt1',
      type: 'insemination',
      workDate: '2026-08-01',
      count: 10,
      animals: [],
      checkDueDate: '2026-09-02'
    });
    var uzi = normalizeWorkTask({
      id: 'wt2',
      type: 'uzi',
      workDate: '2026-09-10',
      count: 10,
      animals: []
    });
    var next = closePregChecksWithUziTask([insem], uzi);
    expect(next[0].checkClosedByTaskId).toBe('wt2');
  });
});

describe('listOpenPregChecks', () => {
  it('marks due after check date', () => {
    var tasks = [
      normalizeWorkTask({
        id: 'a',
        type: 'insemination',
        workDate: '2026-08-01',
        count: 3,
        checkDueDate: '2026-09-02'
      })
    ];
    var open = listOpenPregChecks(tasks, '2026-09-02');
    expect(open).toHaveLength(1);
    expect(open[0].due).toBe(true);
    var early = listOpenPregChecks(tasks, '2026-09-01');
    expect(early[0].due).toBe(false);
  });
});

describe('collectServiceWorkItemsFromTasks', () => {
  it('uses count when no animal rows', () => {
    var items = collectServiceWorkItemsFromTasks(
      [
        {
          id: '1',
          type: 'insemination',
          workDate: '2026-08-19',
          count: 15,
          userName: 'svc',
          animals: []
        }
      ],
      { date: '2026-08-19', username: 'svc', types: { insemination: true, uzi: true, protocol: true } }
    );
    expect(items).toHaveLength(1);
    expect(items[0].quantity).toBe(15);
    expect(sumTaskQuantities(items)).toBe(15);
  });

  it('maps UZI result labels', () => {
    var items = collectServiceWorkItemsFromTasks(
      [
        {
          id: '2',
          type: 'uzi',
          workDate: '2026-08-19',
          count: 2,
          userName: 'svc',
          animals: [
            { cattleId: '1', result: 'pregnant' },
            { cattleId: '2', result: 'open' }
          ]
        }
      ],
      { date: '2026-08-19', username: 'svc', types: { insemination: true, uzi: true, protocol: false } }
    );
    expect(items).toHaveLength(2);
    expect(items[0].result).toBe('Стельная');
    expect(items[1].result).toBe('Не стельная');
  });
});

describe('appendWorkTaskToBundle', () => {
  it('appends and closes checks on UZI', () => {
    var first = appendWorkTaskToBundle(
      { workTasks: [] },
      {
        type: 'insemination',
        workDate: '2026-08-01',
        count: 5,
        userName: 'svc',
        animals: []
      }
    );
    expect(first.ok).toBe(true);
    expect(first.task.checkDueDate).toBe('2026-09-02');
    var second = appendWorkTaskToBundle(first.bundle, {
      type: 'uzi',
      workDate: '2026-09-05',
      count: 5,
      userName: 'svc',
      animals: []
    });
    expect(second.ok).toBe(true);
    expect(second.bundle.workTasks[0].checkClosedByTaskId).toBe(second.task.id);
  });
});
