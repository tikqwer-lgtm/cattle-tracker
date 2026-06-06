/**
 * Unit-тесты data-integrity (сканирование дат в будущем).
 */
import { describe, it, expect, beforeAll } from 'vitest';

describe('scanEntryDataErrors', () => {
  let scanEntryDataErrors;
  let formatDataErrorMessage;

  beforeAll(async () => {
    if (typeof window === 'undefined') {
      global.window = globalThis;
    }
    await import('../js/features/data-integrity.js');
    scanEntryDataErrors = window.scanEntryDataErrors;
    formatDataErrorMessage = window.formatDataErrorMessage;
  });

  it('находит дату рождения в будущем', () => {
    const ref = new Date(2026, 5, 10);
    const errs = scanEntryDataErrors({
      cattleId: '101',
      birthDate: '2030-01-01'
    }, ref);
    expect(errs.length).toBe(1);
    expect(errs[0].field).toBe('birthDate');
  });

  it('находит calvingDate в будущем', () => {
    const ref = new Date(2026, 5, 10);
    const errs = scanEntryDataErrors({
      cattleId: '102',
      calvingDate: '2027-06-01'
    }, ref);
    expect(errs.length).toBe(1);
    expect(formatDataErrorMessage(errs[0])).toContain('102');
    expect(formatDataErrorMessage(errs[0])).toContain('будущем');
  });

  it('валидные даты не дают ошибок', () => {
    const ref = new Date(2026, 5, 10);
    const errs = scanEntryDataErrors({
      cattleId: '103',
      birthDate: '2020-01-01',
      calvingDate: '2026-01-01'
    }, ref);
    expect(errs.length).toBe(0);
  });
});
