/**
 * Unit-тесты chat-data-context.js
 */
import { describe, it, expect } from 'vitest';
import {
  isCalvingDataQuestion,
  isDataQuestion,
  detectChatDataTopics,
  detectQuestionWarnings,
  parseMonthFromQuestion,
  buildChatDataContext,
  buildHerdSection
} from '../js/features/chat-data-context.js';

describe('detectChatDataTopics', () => {
  it('отёлы', () => {
    expect(detectChatDataTopics('Сколько отёлов в следующем месяце?')).toContain('calving');
  });

  it('статистика стада', () => {
    expect(detectChatDataTopics('Сколько стельных коров?')).toContain('herd');
  });

  it('аналитика', () => {
    expect(detectChatDataTopics('Какой PR за месяц?')).toContain('analytics');
  });

  it('не срабатывает на справку по программе', () => {
    expect(detectChatDataTopics('Где список всех животных?')).toEqual([]);
  });
});

describe('isDataQuestion', () => {
  it('true для данных', () => {
    expect(isDataQuestion('Сколько в сухостое?')).toBe(true);
  });

  it('false для UI', () => {
    expect(isDataQuestion('Как синхронизировать?')).toBe(false);
  });
});

describe('isCalvingDataQuestion', () => {
  it('распознаёт вопрос про отёлы в следующем месяце', () => {
    expect(isCalvingDataQuestion('Сколько отёлов в следующем месяце?')).toBe(true);
  });
});

describe('parseMonthFromQuestion', () => {
  const ref = new Date(2026, 5, 10);

  it('следующий месяц', () => {
    const ym = parseMonthFromQuestion('сколько отелов в следующем месяце', ref);
    expect(ym.year).toBe(2026);
    expect(ym.month).toBe(6);
  });
});

describe('buildHerdSection', () => {
  it('считает статусы', () => {
    const text = buildHerdSection([
      { cattleId: '1', status: 'Стельная' },
      { cattleId: '2', status: 'Сухостой' }
    ]);
    expect(text).toContain('Всего животных: 2');
    expect(text).toContain('Стельные: 1');
    expect(text).toContain('В сухостое: 1');
  });
});

describe('detectQuestionWarnings', () => {
  it('конфликт следующий и прошлый месяц', () => {
    const w = detectQuestionWarnings('Сколько отёлов в прошлом и следующем месяце?', ['calving']);
    expect(w.some(function (x) { return x.indexOf('следующий') !== -1 && x.indexOf('прошлый') !== -1; })).toBe(true);
  });

  it('не распознанный запрос данных', () => {
    const w = detectQuestionWarnings('Сколко ателов в июле?', []);
    expect(w.length).toBeGreaterThan(0);
  });
});

describe('buildChatDataContext', () => {
  const ref = new Date(2026, 5, 10);
  const entries = [{
    cattleId: '101',
    status: 'Стельная',
    inseminationDate: '2025-09-01',
    inseminationHistory: [{ date: '2025-09-01' }]
  }];

  it('возвращает сводку с планом отёлов', () => {
    const ctx = buildChatDataContext('Сколько отёлов в июне?', entries, ref);
    expect(ctx).toContain('План');
    expect(ctx).toContain('№101');
  });

  it('возвращает статистику стада', () => {
    const ctx = buildChatDataContext('Сколько всего коров и стельных?', entries, ref);
    expect(ctx).toContain('Статистика стада');
    expect(ctx).toContain('Стельные: 1');
  });

  it('null для вопроса не про данные', () => {
    expect(buildChatDataContext('Как синхронизировать?', [], ref)).toBeNull();
  });

  it('замечания если блок не распознан', () => {
    const ctx = buildChatDataContext('Сколко чего-то непонятного?', entries, ref);
    expect(ctx).toContain('Замечания');
  });
});
