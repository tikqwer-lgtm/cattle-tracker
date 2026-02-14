/**
 * Unit-тесты для расчётов аналитики (analytics-calc).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

let calc;

beforeAll(() => {
  global.entries = [];
  calc = require(path.join(__dirname, '../js/features/analytics-calc.js'));
});

describe('parseDate', () => {
  it('парсит ISO-дату', () => {
    const d = calc.parseDate('2024-01-15');
    expect(d).toBeInstanceOf(Date);
    expect(d.getFullYear()).toBe(2024);
    expect(d.getMonth()).toBe(0);
    expect(d.getDate()).toBe(15);
  });

  it('возвращает null для пустой строки', () => {
    expect(calc.parseDate('')).toBeNull();
    expect(calc.parseDate(null)).toBeNull();
  });

  it('возвращает null для невалидной даты', () => {
    expect(calc.parseDate('не дата')).toBeNull();
  });
});

describe('getPeriodBounds', () => {
  it('возвращает start и end для month', () => {
    const b = calc.getPeriodBounds('month');
    expect(b.start).toBeInstanceOf(Date);
    expect(b.end).toBeInstanceOf(Date);
    expect(b.start.getTime()).toBeLessThanOrEqual(b.end.getTime());
  });

  it('возвращает границы для year', () => {
    const b = calc.getPeriodBounds('year');
    expect(b.end.getFullYear() - b.start.getFullYear()).toBe(1);
  });
});

describe('addDays', () => {
  it('добавляет дни к дате', () => {
    const d = new Date(2024, 0, 10);
    const r = calc.addDays(d, 5);
    expect(r.getDate()).toBe(15);
  });
});

describe('daysBetween', () => {
  it('считает разницу в днях', () => {
    const a = new Date(2024, 0, 1);
    const b = new Date(2024, 0, 11);
    expect(calc.daysBetween(a, b)).toBe(10);
  });

  it('возвращает null при отсутствии даты', () => {
    expect(calc.daysBetween(null, new Date())).toBeNull();
  });
});

describe('calculatePR', () => {
  it('PR = (HDR/100) * (CR/100) * 100', () => {
    expect(calc.calculatePR(50, 40)).toBe(20); // 0.5 * 0.4 * 100
  });

  it('округление до одного знака', () => {
    expect(calc.calculatePR(33, 33)).toBe(10.9);
  });
});

describe('isPregnant', () => {
  it('стельная при статусе с "Стельная"', () => {
    expect(calc.isPregnant({ status: 'Стельная' })).toBe(true);
  });

  it('стельная при статусе с "Отёл"', () => {
    expect(calc.isPregnant({ status: 'Отёл' })).toBe(true);
  });

  it('не стельная при статусе Охота', () => {
    expect(calc.isPregnant({ status: 'Охота' })).toBe(false);
  });
});

describe('generateReport', () => {
  it('возвращает объект с полями периода и показателей', () => {
    const list = [
      { calvingDate: '2024-01-01', lactation: 1, status: 'Стельная', inseminationDate: '2024-02-15', inseminationHistory: [], dateAdded: '2024-01-01' }
    ];
    global.entries = list;
    const report = calc.generateReport('month', null, null, 50, list);
    expect(report).toHaveProperty('period', 'month');
    expect(report).toHaveProperty('bounds');
    expect(report).toHaveProperty('pr');
    expect(report).toHaveProperty('cr');
    expect(report).toHaveProperty('hdr');
    expect(report).toHaveProperty('servicePeriodDays');
    expect(report).toHaveProperty('totalCows');
  });
});
