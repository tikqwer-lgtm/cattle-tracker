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
  expandServiceRows,
  fillActDocumentXml,
  buildActDocx
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
    expect(formatActHeaderDate('2026-08-26')).toBe('«26» августа 2026');
    expect(amountWithWords(1234).display).toBe('1234 (одна тысяча двести тридцать четыре)');
  });
});

describe('fillActDocumentXml', () => {
  it('clones the service row and substitutes placeholders', () => {
    var xml =
      '<w:tbl><w:tr><w:tc><w:p><w:r><w:t>hdr</w:t></w:r></w:p></w:tc></w:tr>' +
      '<w:tr><w:tc><w:p><w:r><w:t>{{rowNum}}</w:t></w:r></w:p></w:tc>' +
      '<w:tc><w:p><w:r><w:t>{{svcName}}</w:t></w:r></w:p></w:tc>' +
      '<w:tc><w:p><w:r><w:t>{{svcUnit}}</w:t></w:r></w:p></w:tc>' +
      '<w:tc><w:p><w:r><w:t>{{svcQty}}</w:t></w:r></w:p></w:tc>' +
      '<w:tc><w:p><w:r><w:t>{{svcSum}}</w:t></w:r></w:p></w:tc></w:tr>' +
      '<w:tr><w:tc><w:p><w:r><w:t>Итого {{total}}</w:t></w:r></w:p></w:tc></w:tr></w:tbl>' +
      '<w:p><w:r><w:t>{{actDate}} {{executorFio}} {{customerFio}} ({{totalWords}})</w:t></w:r></w:p>';
    var out = fillActDocumentXml(xml, {
      actDate: '«26» августа 2026',
      executorFio: 'Иванов И.И.',
      customerFio: 'Петров П.П.',
      rows: [
        { name: 'УЗИ', unit: 'гол', qty: '10', sum: '100' },
        { name: 'Осеменение', unit: 'гол', qty: '5', sum: '200' }
      ]
    });
    expect(out).toMatch(/УЗИ/);
    expect(out).toMatch(/Осеменение/);
    expect(out).toMatch(/Иванов И\.И\./);
    expect(out).toMatch(/Петров П\.П\./);
    expect(out).toMatch(/300/);
    expect(out).toMatch(/триста/);
    expect(out).not.toMatch(/\{\{svcName\}\}/);
    expect(expandServiceRows(xml, [{ name: 'A', unit: '', qty: '', sum: '1' }])).toMatch(/>A</);
  });

  it('escapes XML in user text', () => {
    var xml = '<w:tr><w:tc><w:p><w:r><w:t>{{svcName}}</w:t></w:r></w:p></w:tc></w:tr>{{total}}';
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
      customerFio: 'Петров П.П.',
      rows: [{ name: 'УЗИ-диагностика', unit: 'гол', qty: '12', sum: '2196' }]
    });
    var xml = strFromU8(unzipSync(bytes)['word/document.xml']);
    expect(xml).toMatch(/УЗИ-диагностика/);
    expect(xml).toMatch(/Иванов И\.И\./);
    expect(xml).toMatch(/2196/);
    expect(xml).not.toMatch(/\{\{/);
    expect(xml).not.toMatch(/ОБРАЗЕЦ/);
  });
});
