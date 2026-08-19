import { describe, it, expect } from 'vitest';
import { snapshotDateForMonth, monthBounds, shiftMonth, formatMonthLabel } from '../js/ui/month-nav.js';

describe('month-nav', () => {
  it('snapshot of current month is today', () => {
    var today = new Date(2026, 7, 19);
    expect(snapshotDateForMonth(2026, 7, today)).toBe('2026-08-19');
  });

  it('snapshot of other month is last day', () => {
    var today = new Date(2026, 7, 19);
    expect(snapshotDateForMonth(2026, 6, today)).toBe('2026-07-31');
  });

  it('monthBounds covers full month', () => {
    expect(monthBounds(2026, 1)).toEqual({ from: '2026-02-01', to: '2026-02-28' });
  });

  it('shiftMonth wraps year', () => {
    expect(shiftMonth(2026, 0, -1)).toEqual({ year: 2025, month: 11 });
  });

  it('formatMonthLabel is russian', () => {
    expect(formatMonthLabel(2026, 7)).toBe('август 2026');
  });
});
