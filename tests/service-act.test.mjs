import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  numberToWordsRu,
  rubleWord,
  parseAmount,
  sumServiceRows,
  formatActHeaderDate,
  amountWithWords
} from '../js/utils/number-to-words-ru.js';
import {
  fillServiceTable,
  fillActDocumentXml,
  buildActDocx,
  fetchActTemplateBytes,
  getCachedActTemplateBytes,
  ensureDocxFilename
} from '../js/features/service-act-docx.js';
import { unzipSync, strFromU8 } from 'fflate';

const here = path.dirname(fileURLToPath(import.meta.url));
const templatePath = path.join(here, '..', 'assets', 'templates', 'act-uslug.docx');

describe('numberToWordsRu', () => {
  it('covers zero, small and compound numbers', () => {
    expect(numberToWordsRu(0)).toBe('ноль');
    expect(numberToWordsRu(1)).toBe('один');
    expect(numberToWordsRu(21)).toBe('двадцать один');
    expect(numberToWordsRu(1000)).toBe('одна тысяча');
    expect(numberToWordsRu(2000)).toBe('две тысячи');
    expect(numberToWordsRu(5000)).toBe('пять тысяч');
    expect(numberToWordsRu(1234)).toBe('одна тысяча двести тридцать четыре');
    expect(numberToWordsRu(1000000)).toBe('один миллион');
  });

  it('picks ruble inflection', () => {
    expect(rubleWord(1)).toBe('рубль');
    expect(rubleWord(2)).toBe('рубля');
    expect(rubleWord(5)).toBe('рублей');
    expect(rubleWord(21)).toBe('рубль');
    expect(rubleWord(12)).toBe('рублей');
  });
});

describe('act amounts', () => {
  it('sums rows and formats date for the header', () => {
    expect(parseAmount('1 234,5')).toBe(1234.5);
    expect(sumServiceRows([{ sum: '100' }, { sum: '50,5' }, { sum: '' }])).toBe(150.5);
    expect(sumServiceRows([{ qty: '10', price: '50' }, { qty: '2', price: '3,5' }])).toBe(507);
    expect(formatActHeaderDate('2026-08-26')).toBe('«26» августа 2026');
    expect(amountWithWords(1234).display).toBe('1234 (одна тысяча двести тридцать четыре)');
  });
});

describe('fillActDocumentXml', () => {
  it('fills three fixed service rows without cloning the preamble', () => {
    var xml =
      '<w:p><w:r><w:t>преамбула {{executorFio}}</w:t></w:r></w:p>' +
      '<w:tbl><w:tr><w:tc><w:p><w:r><w:t>hdr</w:t></w:r></w:p></w:tc></w:tr>' +
      '<w:tr><w:tc><w:p><w:r><w:t>{{rowNum1}}</w:t></w:r></w:p></w:tc>' +
      '<w:tc><w:p><w:r><w:t>{{svcName1}}</w:t></w:r></w:p></w:tc></w:tr>' +
      '<w:tr><w:tc><w:p><w:r><w:t>{{rowNum2}}</w:t></w:r></w:p></w:tc>' +
      '<w:tc><w:p><w:r><w:t>{{svcName2}}</w:t></w:r></w:p></w:tc></w:tr>' +
      '<w:tr><w:tc><w:p><w:r><w:t>{{rowNum3}}</w:t></w:r></w:p></w:tc>' +
      '<w:tc><w:p><w:r><w:t>{{svcName3}}</w:t></w:r></w:p></w:tc></w:tr>' +
      '<w:tr><w:tc><w:p><w:r><w:t>Итого {{total}}</w:t></w:r></w:p></w:tc></w:tr></w:tbl>' +
      '<w:p><w:r><w:t>Услуги оказаны Исполнителем</w:t></w:r></w:p>' +
      '<w:p><w:r><w:t>{{actDate}} {{customerOrg}} {{customerFio}} ({{totalWords}})</w:t></w:r></w:p>';
    var out = fillActDocumentXml(xml, {
      actDate: '«26» августа 2026',
      executorFio: 'Иванов И.И.',
      customerOrg: 'ООО Ромашка',
      customerFio: 'Петров П.П.',
      rows: [
        { name: 'УЗИ', unit: 'гол', qty: '10', sum: '100' },
        { name: 'Осеменение', unit: 'гол', qty: '5', sum: '200' }
      ]
    });
    expect(out).toMatch(/УЗИ/);
    expect(out).toMatch(/Осеменение/);
    expect(out).toMatch(/Иванов И\.И\./);
    expect(out).toMatch(/ООО Ромашка/);
    expect(out).toMatch(/Петров П\.П\./);
    expect(out).toMatch(/300/);
    expect(out).toMatch(/триста/);
    expect((out.match(/преамбула/g) || []).length).toBe(1);
    expect((out.match(/Услуги оказаны Исполнителем/g) || []).length).toBe(1);
    expect(out.match(/<w:tr\b/g).length).toBe(5);
    expect(out).not.toMatch(/\{\{svcName/);
    expect(fillServiceTable(xml, [{ name: 'A', unit: '', qty: '', sum: '1' }])).toMatch(/>A</);
  });

  it('keeps three service rows when only one service is filled', () => {
    var xml =
      '<w:tr><w:tc><w:p><w:r><w:t>{{rowNum1}}</w:t></w:r></w:p></w:tc>' +
      '<w:tc><w:p><w:r><w:t>{{svcName1}}</w:t></w:r></w:p></w:tc></w:tr>' +
      '<w:tr><w:tc><w:p><w:r><w:t>{{rowNum2}}</w:t></w:r></w:p></w:tc>' +
      '<w:tc><w:p><w:r><w:t>{{svcName2}}</w:t></w:r></w:p></w:tc></w:tr>' +
      '<w:tr><w:tc><w:p><w:r><w:t>{{rowNum3}}</w:t></w:r></w:p></w:tc>' +
      '<w:tc><w:p><w:r><w:t>{{svcName3}}</w:t></w:r></w:p></w:tc></w:tr>';
    var out = fillServiceTable(xml, [{ name: 'УЗИ', unit: 'гол', qty: '1', price: '10' }]);
    expect(out.match(/<w:tr\b/g).length).toBe(3);
    expect(out).toMatch(/>1</);
    expect(out).toMatch(/>2</);
    expect(out).toMatch(/>3</);
  });

  it('escapes XML in user text', () => {
    var xml = '<w:tr><w:tc><w:p><w:r><w:t>{{svcName1}}</w:t></w:r></w:p></w:tc></w:tr>{{total}}{{svcName2}}{{svcName3}}{{rowNum1}}{{rowNum2}}{{rowNum3}}{{svcUnit1}}{{svcQty1}}{{svcPrice1}}{{svcSum1}}{{svcUnit2}}{{svcQty2}}{{svcPrice2}}{{svcSum2}}{{svcUnit3}}{{svcQty3}}{{svcPrice3}}{{svcSum3}}';
    var out = fillActDocumentXml(xml, {
      rows: [{ name: 'A & B <тест>', unit: '', qty: '', sum: '0' }]
    });
    expect(out).toMatch(/A &amp; B &lt;тест&gt;/);
  });
});

describe('buildActDocx from template', () => {
  it('writes filled document.xml into a valid docx zip', () => {
    expect(fs.existsSync(templatePath)).toBe(true);
    var bytes = buildActDocx(fs.readFileSync(templatePath), {
      actDate: '«26» августа 2026',
      executorFio: 'Иванов И.И.',
      customerOrg: 'ООО Ромашка',
      customerFio: 'Петров П.П.',
      rows: [{ name: 'УЗИ-диагностика', unit: 'гол', qty: '12', sum: '2196' }]
    });
    var xml = strFromU8(unzipSync(bytes)['word/document.xml']);
    expect(xml).toMatch(/УЗИ-диагностика/);
    expect(xml).toMatch(/Иванов И\.И\./);
    expect(xml).toMatch(/ООО Ромашка/);
    expect(xml).toMatch(/Петров П\.П\./);
    expect(xml).toMatch(/2196/);
    expect((xml.match(/Услуги оказаны Исполнителем/g) || []).length).toBe(1);
    expect((xml.match(/составили настоящий Акт/g) || []).length).toBe(1);
    expect(xml).not.toMatch(/\{\{/);
    expect(xml).not.toMatch(/ОБРАЗЕЦ/);
  });

  it('keeps three service rows and organization placeholders in the blank', () => {
    var xml = strFromU8(unzipSync(fs.readFileSync(templatePath))['word/document.xml']);
    expect(xml).toMatch(/\{\{svcPrice1\}\}/);
    expect(xml).toMatch(/\{\{svcName2\}\}/);
    expect(xml).toMatch(/\{\{svcName3\}\}/);
    expect(xml).toMatch(/\{\{customerOrg\}\}/);
    expect(xml).toMatch(/\{\{customerFio\}\}/);
    expect((xml.match(/<w:tr\b/g) || []).length).toBeGreaterThanOrEqual(5);
  });

  it('caches template bytes after the first fetch', async () => {
    var raw = fs.readFileSync(templatePath);
    var origFetch = global.fetch;
    global.fetch = async function () {
      return {
        ok: true,
        arrayBuffer: async function () {
          return raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
        }
      };
    };
    try {
      var bytes = await fetchActTemplateBytes();
      expect(bytes.byteLength).toBeGreaterThan(100);
      expect(getCachedActTemplateBytes()).toBe(bytes);
      var again = await fetchActTemplateBytes();
      expect(again).toBe(bytes);
    } finally {
      global.fetch = origFetch;
    }
  });
});

describe('ensureDocxFilename', () => {
  it('turns .docx(1) into a real Word name', () => {
    expect(ensureDocxFilename('акт.docx(1)')).toBe('акт (1).docx');
    expect(ensureDocxFilename('акт.docx')).toBe('акт.docx');
    expect(ensureDocxFilename('акт')).toBe('акт.docx');
  });
});
