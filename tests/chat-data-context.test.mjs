/**
 * Unit-тесты chat-data-context.js
 */
import { describe, it, expect } from 'vitest';
import {
  isCalvingDataQuestion,
  parseMonthFromQuestion,
  buildChatDataContext
} from '../js/features/chat-data-context.js';

describe('isCalvingDataQuestion', () => {
  it('распознаёт вопрос про отёлы в следующем месяце', () => {
    expect(isCalvingDataQuestion('Сколько отёлов в следующем месяце?')).toBe(true);
  });

  it('не срабатывает на общий вопрос по программе', () => {
    expect(isCalvingDataQuestion('Где список всех животных?')).toBe(false);
  });
});

describe('parseMonthFromQuestion', () => {
  const ref = new Date(2026, 5, 10);

  it('следующий месяц', () => {
    const ym = parseMonthFromQuestion('сколько отелов в следующем месяце', ref);
    expect(ym.year).toBe(2026);
    expect(ym.month).toBe(6);
  });

  it('название месяца', () => {
    const ym = parseMonthFromQuestion('отёлы в июне', ref);
    expect(ym.month).toBe(5);
  });
});

describe('buildChatDataContext', () => {
  const ref = new Date(2026, 5, 10);

  it('возвращает сводку с планом', () => {
    const entries = [{
      cattleId: '101',
      status: 'Стельная',
      inseminationDate: '2025-09-01',
      inseminationHistory: [{ date: '2025-09-01' }]
    }];
    const ctx = buildChatDataContext('Сколько отёлов в июне?', entries, ref);
    expect(ctx).toContain('План');
    expect(ctx).toContain('1');
    expect(ctx).toContain('№101');
  });

  it('null для вопроса не про отёлы', () => {
    expect(buildChatDataContext('Как синхронизировать?', [], ref)).toBeNull();
  });
});
