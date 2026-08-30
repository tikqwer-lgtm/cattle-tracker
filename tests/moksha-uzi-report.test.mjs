import { describe, it, expect } from 'vitest';
import {
  applyGroupFromHerd,
  mokshaUziAoa,
  mokshaUziFilename,
  mokshaUziTableHtml,
  isMokshaFarmName,
  formatPrintDateShort,
  DEFAULT_MOKSHA_SIGNERS
} from '../js/features/service-work-report-build.js';
import { parseActFio, loadActFio, saveActFio, actFioStorageKey, emptyActFio } from '../js/features/service-act-fio.js';
import { parseCattleIdsFromPaste, isServiceWorkFormDirty } from '../js/features/service-work-tasks.js';

describe('moksha UZI sheet', () => {
  it('detects Moksha farm name', () => {
    expect(isMokshaFarmName('Мокша')).toBe(true);
    expect(isMokshaFarmName('ООО Мокша')).toBe(true);
    expect(isMokshaFarmName('Шаверки')).toBe(false);
  });

  it('fills MTF from herd group', () => {
    var items = applyGroupFromHerd(
      [{ cattleId: '35', action: 'УЗИ', workDate: '2026-08-24', group: '' }],
      [{ cattleId: '35', group: 'Ефаево' }],
      'Мокша'
    );
    expect(items[0].group).toBe('Ефаево');
  });

  it('builds AOA without result column, grouped by MTF, with signers', () => {
    var aoa = mokshaUziAoa(
      [
        { cattleId: '2192', action: 'УЗИ', workDate: '2026-08-24', group: 'Тенишево' },
        { cattleId: '35', action: 'УЗИ', workDate: '2026-08-24', group: 'Ефаево' },
        { cattleId: '1', action: 'Осеменение', workDate: '2026-08-24', group: 'Ефаево' }
      ],
      { farmName: 'Мокша', date: '2026-08-24' }
    );
    expect(aoa[0][0]).toMatch(/Список животных/);
    expect(aoa[2]).toEqual(['№ п/п', '№', 'МТФ', 'Дата узи']);
    expect(aoa[2].join(' ')).not.toMatch(/Результат/);
    expect(aoa[3]).toEqual([1, '35', 'Ефаево', '24.08.2026']);
    expect(aoa[4]).toEqual([2, '2192', 'Тенишево', '24.08.2026']);
    var joined = aoa.map(function (r) { return r.join('|'); }).join('\n');
    expect(joined).toMatch(/Бушаев А\.В\./);
    expect(joined).toMatch(/Матвеев П\.Н\./);
    expect(joined).toMatch(/Филиппова М\.В\./);
    expect(joined).toMatch(/Подпись/);
    expect(mokshaUziFilename('2026-08-24', 'Мокша')).toBe('УЗИ Мокша 24.08.26.xlsx');
    expect(formatPrintDateShort('2026-08-24')).toBe('24.08.26');
    expect(mokshaUziTableHtml([{ cattleId: '35', action: 'УЗИ', workDate: '2026-08-24', group: 'Ефаево' }], 'Мокша')).not.toMatch(/Результат/);
    expect(DEFAULT_MOKSHA_SIGNERS.left).toBe('Бушаев А.В.');
  });
});

describe('act FIO storage', () => {
  it('parses and saves per object', () => {
    expect(actFioStorageKey('obj1')).toBe('cattleTracker_actFio_obj1');
    var empty = emptyActFio();
    expect(empty.mokshaLeft).toBe('Бушаев А.В.');
    var parsed = parseActFio({ executorFio: 'Иванов', customerOrg: 'ООО Х' });
    expect(parsed.executorFio).toBe('Иванов');
    expect(parsed.mokshaRight1).toBe('Матвеев П.Н.');
    var store = {};
    var storage = {
      getItem: function (k) { return store[k] || null; },
      setItem: function (k, v) { store[k] = v; }
    };
    saveActFio(storage, 'farm-a', { executorFio: 'Петров', customerFio: 'Сидоров' });
    var loaded = loadActFio(storage, 'farm-a');
    expect(loaded.executorFio).toBe('Петров');
    expect(loaded.customerFio).toBe('Сидоров');
    expect(loadActFio(storage, 'farm-b').executorFio).toBe('');
  });
});

describe('group paste and dirty form', () => {
  it('parses cattle ids from mixed paste', () => {
    expect(parseCattleIdsFromPaste('35, 4283\n4639;4701 35')).toEqual(['35', '4283', '4639', '4701']);
  });

  it('asks before clearing only when form has data', () => {
    var defaults = { type: 'insemination', workDate: '2026-08-30', count: 1 };
    expect(isServiceWorkFormDirty({ type: 'insemination', workDate: '2026-08-30', count: 1, animals: [] }, defaults)).toBe(false);
    expect(isServiceWorkFormDirty({ type: 'uzi', workDate: '2026-08-30', count: 1, animals: [] }, defaults)).toBe(true);
    expect(isServiceWorkFormDirty({ type: 'insemination', workDate: '2026-08-30', count: 1, note: 'x', animals: [] }, defaults)).toBe(true);
    expect(isServiceWorkFormDirty({
      type: 'insemination',
      workDate: '2026-08-30',
      count: 1,
      animals: [{ cattleId: '35' }]
    }, defaults)).toBe(true);
    expect(isServiceWorkFormDirty({
      type: 'insemination',
      workDate: '2026-08-30',
      count: 1,
      paste: '35 36',
      animals: []
    }, defaults)).toBe(true);
  });
});
