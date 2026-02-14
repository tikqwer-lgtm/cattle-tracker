/**
 * Unit-тесты для логики поиска и фильтрации (search-filter).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

let searchEntries, filterEntries;

beforeAll(() => {
  global.entries = [];
  const m = require(path.join(__dirname, '../js/features/search-filter.js'));
  searchEntries = m.searchEntries;
  filterEntries = m.filterEntries;
});

describe('searchEntries', () => {
  const list = [
    { cattleId: '101', nickname: 'Зорька', status: 'Охота', bull: 'Бык1', code: 'Охота', note: '', inseminator: 'Иванов', group: 'Группа А' },
    { cattleId: '102', nickname: 'Роза', status: 'Стельная', bull: 'Бык2', code: '', note: 'прим', inseminator: '', group: 'Б' }
  ];

  it('возвращает все записи при пустом запросе', () => {
    expect(searchEntries('', list)).toEqual(list);
    expect(searchEntries(null, list)).toEqual(list);
  });

  it('фильтрует по номеру коровы', () => {
    expect(searchEntries('101', list)).toHaveLength(1);
    expect(searchEntries('101', list)[0].cattleId).toBe('101');
  });

  it('фильтрует по кличке', () => {
    expect(searchEntries('Зорька', list)).toHaveLength(1);
    expect(searchEntries('Роза', list)[0].nickname).toBe('Роза');
  });

  it('фильтрует по статусу', () => {
    expect(searchEntries('Охота', list)).toHaveLength(1);
    expect(searchEntries('Стельная', list)).toHaveLength(1);
  });

  it('фильтрует по быку', () => {
    expect(searchEntries('Бык1', list)).toHaveLength(1);
  });

  it('регистронезависимый поиск', () => {
    expect(searchEntries('ЗОРЬКА', list)).toHaveLength(1);
    expect(searchEntries('зорька', list)).toHaveLength(1);
  });

  it('возвращает пустой массив при отсутствии совпадений', () => {
    expect(searchEntries('нет такой', list)).toEqual([]);
  });
});

describe('filterEntries', () => {
  const list = [
    { status: 'Охота', lactation: 1, inseminationDate: '2024-01-15', synced: true, group: 'А', bull: 'Бык1' },
    { status: 'Стельная', lactation: 2, inseminationDate: '2024-02-20', synced: false, group: 'Б', bull: 'Бык2' },
    { status: 'Охота', lactation: 1, inseminationDate: '2024-03-01', synced: false, group: 'А', bull: 'Бык1' }
  ];

  it('фильтр по статусу', () => {
    const f = { status: ['Охота'], lactation: null, dateFrom: '', dateTo: '', synced: null, group: '', bull: '' };
    expect(filterEntries(f, list)).toHaveLength(2);
  });

  it('фильтр по лактации', () => {
    const f = { status: [], lactation: 1, dateFrom: '', dateTo: '', synced: null, group: '', bull: '' };
    expect(filterEntries(f, list)).toHaveLength(2);
  });

  it('фильтр по дате от', () => {
    const f = { status: [], lactation: null, dateFrom: '2024-02-01', dateTo: '', synced: null, group: '', bull: '' };
    expect(filterEntries(f, list)).toHaveLength(2);
  });

  it('фильтр только синхронизированные', () => {
    const f = { status: [], lactation: null, dateFrom: '', dateTo: '', synced: true, group: '', bull: '' };
    expect(filterEntries(f, list)).toHaveLength(1);
    expect(filterEntries(f, list)[0].synced).toBe(true);
  });

  it('возвращает копию при пустых фильтрах', () => {
    const f = { status: [], lactation: null, dateFrom: '', dateTo: '', synced: null, group: '', bull: '' };
    expect(filterEntries(f, list)).toHaveLength(3);
  });
});
