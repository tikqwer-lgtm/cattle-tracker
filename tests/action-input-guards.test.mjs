/**
 * Тесты расчёта дней стельности и выбора даты осеменения (ActionInputGuards).
 */
import { describe, it, expect, beforeAll } from 'vitest';

describe('ActionInputGuards pregnancy helpers', () => {
  let G;

  beforeAll(async () => {
    if (typeof globalThis.window === 'undefined') {
      globalThis.window = globalThis;
    }
    await import('../js/features/action-input-guards.js');
    G = globalThis.window.ActionInputGuards;
    if (!G) throw new Error('ActionInputGuards not loaded');
  });

  describe('getLastInseminationOnOrBefore', () => {
    it('берёт последнюю дату осеменения не позже даты события', () => {
      const entry = {
        inseminationDate: '2024-01-01',
        inseminationHistory: [{ date: '2023-06-01' }, { date: '2024-03-15' }]
      };
      expect(G.getLastInseminationOnOrBefore(entry, '2024-02-01')).toBe('2024-01-01');
      expect(G.getLastInseminationOnOrBefore(entry, '2024-04-01')).toBe('2024-03-15');
    });

    it('возвращает null при пустом вводе', () => {
      expect(G.getLastInseminationOnOrBefore(null, '2024-01-01')).toBeNull();
      expect(G.getLastInseminationOnOrBefore({}, '')).toBeNull();
    });
  });

  describe('getPregnancyDaysOnDate', () => {
    it('считает дни от последнего осеменения до даты события', () => {
      const entry = { inseminationDate: '2024-01-01' };
      expect(G.getPregnancyDaysOnDate(entry, '2024-01-11')).toBe(10);
    });

    it('null если осеменение позже даты события', () => {
      const entry = { inseminationDate: '2024-06-01' };
      expect(G.getPregnancyDaysOnDate(entry, '2024-01-01')).toBeNull();
    });
  });
});
