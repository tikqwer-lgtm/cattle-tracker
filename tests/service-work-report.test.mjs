import { describe, it, expect } from 'vitest';
import {
  collectServiceWorkItems,
  serializeReportText,
  parseReportItemsFromDescription,
  formatUziPrintResult,
  formatPrintDate,
  uziPrintTableHtml,
  uziPrintDocumentHtml
} from '../js/features/service-work-report-build.js';

function cow(partial) {
  return Object.assign(
    {
      cattleId: '1',
      nickname: '',
      inseminationHistory: [],
      uziHistory: [],
      actionHistory: [],
      protocol: { name: '', startDate: '' }
    },
    partial
  );
}

describe('collectServiceWorkItems', () => {
  it('collects my insemination, USI and protocol for the date', () => {
    var entries = [
      cow({
        cattleId: '101',
        inseminationHistory: [{ date: '2026-08-19', bull: 'Б-1', inseminator: 'svc', attemptNumber: 1 }],
        actionHistory: [
          {
            dateTime: '2026-08-19 10:00',
            userName: 'svc',
            action: 'Осеменение',
            eventType: 'Осеменение',
            details: 'Дата: 2026-08-19, бык: Б-1, осеменатор: svc',
            bull: 'Б-1',
            inseminator: 'svc'
          }
        ]
      }),
      cow({
        cattleId: '102',
        group: 'Тенишево',
        uziHistory: [{ date: '2026-08-19', result: 'Стельная', specialist: 'svc', daysFromInsemination: 32 }],
        actionHistory: [
          {
            dateTime: '2026-08-19 11:00',
            userName: 'svc',
            action: 'УЗИ1',
            eventType: 'УЗИ1',
            result: 'Стельная',
            details: 'Дата: 2026-08-19, Стельная, дней от осеменения: 32'
          }
        ]
      }),
      cow({
        cattleId: '103',
        protocol: { name: 'Ovsynch', startDate: '2026-08-19' },
        actionHistory: [
          {
            dateTime: '2026-08-19 12:00',
            userName: 'svc',
            action: 'Постановка на протокол',
            eventType: 'Постановка на протокол',
            protocolName: 'Ovsynch',
            details: 'Протокол: Ovsynch, начало: 2026-08-19'
          }
        ]
      })
    ];
    var items = collectServiceWorkItems(entries, {
      date: '2026-08-19',
      username: 'svc',
      types: { insemination: true, uzi: true, protocol: true }
    });
    expect(items).toHaveLength(3);
    expect(items[0]).toMatchObject({ cattleId: '101', action: 'Осеменение' });
    expect(items[0].details).toMatch(/Б-1/);
    expect(items[1].result).toBe('Стельная');
    expect(items[1].group).toBe('Тенишево');
    expect(items[2]).toMatchObject({ cattleId: '103', action: 'Протокол' });
    expect(items[2].details).toMatch(/Ovsynch/);
  });

  it('skips other users and other dates', () => {
    var entries = [
      cow({
        cattleId: '1',
        actionHistory: [
          { dateTime: '2026-08-19 10:00', userName: 'other', action: 'Осеменение', eventType: 'Осеменение', details: 'Дата: 2026-08-19' }
        ]
      }),
      cow({
        cattleId: '2',
        actionHistory: [
          { dateTime: '2026-08-18 10:00', userName: 'svc', action: 'Осеменение', eventType: 'Осеменение', details: 'Дата: 2026-08-18' }
        ]
      })
    ];
    var items = collectServiceWorkItems(entries, {
      date: '2026-08-19',
      username: 'svc',
      types: { insemination: true, uzi: true, protocol: true }
    });
    expect(items).toHaveLength(0);
  });

  it('dedups USI from actionHistory and uziHistory as one row', () => {
    var entries = [
      cow({
        cattleId: '102',
        uziHistory: [{ date: '2026-08-19', result: 'Стельная', specialist: 'svc', daysFromInsemination: 32 }],
        actionHistory: [
          {
            dateTime: '20.08.2026 11:00',
            userName: 'svc',
            action: 'УЗИ',
            eventType: 'УЗИ',
            result: 'Стельная',
            details: 'Дата: 2026-08-19, Стельная, дней от осеменения: 32'
          }
        ]
      })
    ];
    var items = collectServiceWorkItems(entries, {
      date: '2026-08-19',
      username: 'svc',
      types: { insemination: false, uzi: true, protocol: false }
    });
    expect(items).toHaveLength(1);
    expect(items[0].action).toBe('УЗИ1');
    expect(items[0].result).toBe('Стельная');
  });

  it('maps USI results for print: яловая / стельная / сомнительная', () => {
    expect(formatUziPrintResult('Не стельная')).toBe('Яловая');
    expect(formatUziPrintResult('Стельная')).toBe('Стельная');
    expect(formatUziPrintResult('Сомнительная')).toBe('Сомнительная');
    expect(formatPrintDate('2026-08-17')).toBe('17.08.2026');
  });

  it('builds print table like the UZI Excel form', () => {
    var html = uziPrintTableHtml(
      [
        { cattleId: '2231', action: 'УЗИ1', workDate: '2026-08-17', group: 'Тенишево', result: 'Стельная' },
        { cattleId: '1593', action: 'УЗИ1', workDate: '2026-08-17', group: 'Шаверки', result: 'Не стельная' }
      ],
      'Мокша'
    );
    expect(html).toMatch(/№ п\/п/);
    expect(html).toMatch(/МТФ/);
    expect(html).toMatch(/Дата узи/);
    expect(html).toMatch(/Результат/);
    expect(html).toMatch(/2231/);
    expect(html).toMatch(/Тенишево/);
    expect(html).toMatch(/Стельная/);
    expect(html).toMatch(/Яловая/);
    var doc = uziPrintDocumentHtml({
      items: [{ cattleId: '2231', action: 'УЗИ1', workDate: '2026-08-17', group: 'Тенишево', result: 'Стельная' }],
      date: '2026-08-17',
      farmName: 'Мокша',
      username: 'svc'
    });
    expect(doc).toMatch(/Список животных с указанием МТФ и номера животных/);
  });
});
