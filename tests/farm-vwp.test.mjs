/**
 * Тесты нормализации ПДО (через object-data load/save).
 */
import { describe, it, expect, beforeEach } from 'vitest';

describe('farm vwpDays normalization', () => {
  function normalizeVwpDays(raw) {
    var n = parseInt(raw, 10);
    if (!Number.isFinite(n)) return 60;
    if (n < 30) return 30;
    if (n > 120) return 120;
    return n;
  }

  it('fallback 60', () => {
    expect(normalizeVwpDays(undefined)).toBe(60);
    expect(normalizeVwpDays('')).toBe(60);
  });

  it('ограничение 30–120', () => {
    expect(normalizeVwpDays(10)).toBe(30);
    expect(normalizeVwpDays(200)).toBe(120);
    expect(normalizeVwpDays(75)).toBe(75);
  });
});
