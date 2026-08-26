/**
 * Собирает assets/templates/act-uslug.docx из образца Word:
 * убирает «ОБРАЗЕЦ», вставляет плейсхолдеры в подчёркнутые поля.
 * Три строки таблицы и пункты акта не трогаем.
 *
 * Источник по умолчанию: Рабочий стол / Протоколы / АКТ*.docx
 * Запуск: node scripts/prepare-act-template.js [путь-к-образцу.docx]
 */
const fs = require('fs');
const path = require('path');
const { zipSync, unzipSync, strToU8, strFromU8 } = require('fflate');

const root = path.resolve(__dirname, '..');
const outPath = path.join(root, 'assets', 'templates', 'act-uslug.docx');

function findDefaultSample() {
  const dir = path.join(process.env.USERPROFILE || '', 'Desktop', 'Протоколы');
  if (!fs.existsSync(dir)) return '';
  const names = fs.readdirSync(dir);
  const hit = names.find(function (n) {
    return /\.docx$/i.test(n) && /акт/i.test(n);
  });
  return hit ? path.join(dir, hit) : '';
}

function addRun(placeholder) {
  return (
    '<w:r><w:rPr><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr><w:t xml:space="preserve">' +
    placeholder +
    '</w:t></w:r>'
  );
}

function injectPlaceholder(tcXml, placeholder) {
  if (/<w:t[\s\S]*?>[123]<\/w:t>/.test(tcXml)) {
    return tcXml.replace(/<w:t([^>]*)>[123]<\/w:t>/, '<w:t$1>' + placeholder + '</w:t>');
  }
  const idx = tcXml.indexOf('</w:p>');
  if (idx === -1) return tcXml;
  return tcXml.slice(0, idx) + addRun(placeholder) + tcXml.slice(idx);
}

function patchDataRow(trXml, index) {
  const cells = splitCells(trXml);
  if (cells.length < 7) throw new Error('В строке услуг ' + index + ' ожидалось 7 ячеек');
  const n = String(index);
  cells[0] = injectPlaceholder(cells[0], '{{rowNum' + n + '}}');
  cells[1] = injectPlaceholder(cells[1], '{{svcName' + n + '}}');
  cells[2] = injectPlaceholder(cells[2], '{{svcUnit' + n + '}}');
  cells[3] = injectPlaceholder(cells[3], '{{svcQty' + n + '}}');
  cells[4] = injectPlaceholder(cells[4], '{{svcPrice' + n + '}}');
  cells[6] = injectPlaceholder(cells[6], '{{svcSum' + n + '}}');
  return rebuildTr(trXml, cells);
}

function patchServicesTable(xml) {
  const marker = 'Наименование услуги';
  const pos = xml.indexOf(marker);
  if (pos < 0) throw new Error('Не найдена таблица услуг');
  const tblStart = xml.lastIndexOf('<w:tbl>', pos);
  const tblEnd = xml.indexOf('</w:tbl>', pos);
  if (tblStart < 0 || tblEnd < 0) throw new Error('Не найдены границы таблицы услуг');
  const tbl = xml.slice(tblStart, tblEnd + '</w:tbl>'.length);
  const rows = splitTrs(tbl);
  if (rows.length < 5) throw new Error('В таблице услуг мало строк: ' + rows.length);

  const header = rows[0];
  const dataRows = [patchDataRow(rows[1], 1), patchDataRow(rows[2], 2), patchDataRow(rows[3], 3)];
  const total = rows[rows.length - 1];
  const totalCells = splitCells(total);
  if (!totalCells.length) throw new Error('Нет ячеек в строке Итого');
  totalCells[totalCells.length - 1] = injectPlaceholder(
    totalCells[totalCells.length - 1],
    '{{total}}'
  );
  const totalRow = rebuildTr(total, totalCells);

  const tblPrEnd = tbl.indexOf(rows[0]);
  const prefix = tbl.slice(0, tblPrEnd);
  const nextTbl = prefix + header + dataRows.join('') + totalRow + '</w:tbl>';
  return xml.slice(0, tblStart) + nextTbl + xml.slice(tblEnd + '</w:tbl>'.length);
}

function splitTrs(xml) {
  return xml.match(/<w:tr\b[\s\S]*?<\/w:tr>/g) || [];
}

function splitCells(trXml) {
  return trXml.match(/<w:tc\b[\s\S]*?<\/w:tc>/g) || [];
}

function trOpen(trXml) {
  const m = trXml.match(/^<w:tr\b[^>]*>/);
  const pr = trXml.match(/<w:trPr>[\s\S]*?<\/w:trPr>/);
  return (m ? m[0] : '<w:tr>') + (pr ? pr[0] : '');
}

function rebuildTr(trXml, cells) {
  return trOpen(trXml) + cells.join('') + '</w:tr>';
}

function patchDocumentXml(xml) {
  xml = xml.replace(/<w:sdt>[\s\S]*?Watermarks[\s\S]*?<\/w:sdt>/, '');
  xml = xml.replace(/«___»___________[\u00a0 ]202/, '{{actDate}}');
  xml = xml.replace(
    /> ____________________________________________</,
    '> {{executorFio}}<'
  );
  xml = xml.replace(
    />с одной стороны, и _________________________________________________</,
    '>с одной стороны, и {{customerOrg}}<'
  );
  xml = xml.replace(
    /, в лице ____________________________________, действующего/,
    ', в лице {{customerFio}}, действующего'
  );
  xml = xml.replace(
    /Стоимость оказанных услуг составила _______ \(____________________________________________________________________________\) /,
    'Стоимость оказанных услуг составила {{total}} ({{totalWords}}) '
  );
  xml = xml.replace(/рублей____копеек/, 'рублей 00 копеек');
  xml = patchServicesTable(xml);
  if (xml.indexOf('{{actDate}}') < 0) throw new Error('Не вставлен {{actDate}}');
  if (xml.indexOf('{{executorFio}}') < 0) throw new Error('Не вставлен {{executorFio}}');
  if (xml.indexOf('{{customerOrg}}') < 0) throw new Error('Не вставлен {{customerOrg}}');
  if (xml.indexOf('{{customerFio}}') < 0) throw new Error('Не вставлен {{customerFio}}');
  if (xml.indexOf('{{svcName1}}') < 0 || xml.indexOf('{{svcName2}}') < 0 || xml.indexOf('{{svcName3}}') < 0) {
    throw new Error('Не вставлены строки услуг 1–3');
  }
  if (xml.indexOf('{{svcPrice1}}') < 0) throw new Error('Не вставлен {{svcPrice1}}');
  if (xml.indexOf('{{totalWords}}') < 0) throw new Error('Не вставлен {{totalWords}}');
  if (/ОБРАЗЕЦ/.test(xml)) throw new Error('Водяной знак ОБРАЗЕЦ не удалён');
  return xml;
}

function zipUnzipped(unzipped) {
  const files = {};
  Object.keys(unzipped).forEach(function (k) {
    files[k] = unzipped[k];
  });
  return zipSync(files, { level: 6 });
}

function main() {
  const src = process.argv[2] || findDefaultSample();
  if (!src || !fs.existsSync(src)) {
    console.error('Не найден образец Word. Передайте путь: node scripts/prepare-act-template.js <file.docx>');
    process.exit(1);
  }
  const bytes = new Uint8Array(fs.readFileSync(src));
  const unzipped = unzipSync(bytes);
  const key = 'word/document.xml';
  if (!unzipped[key]) throw new Error('В docx нет word/document.xml');
  const xml = patchDocumentXml(strFromU8(unzipped[key]));
  unzipped[key] = strToU8(xml);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const outBytes = Buffer.from(zipUnzipped(unzipped));
  fs.writeFileSync(outPath, outBytes);
  const publicCopy = path.join(root, 'templates', 'act-uslug.docx');
  fs.mkdirSync(path.dirname(publicCopy), { recursive: true });
  fs.writeFileSync(publicCopy, outBytes);
  const electronCopy = path.join(root, 'electron', 'templates', 'act-uslug.docx');
  fs.mkdirSync(path.dirname(electronCopy), { recursive: true });
  fs.writeFileSync(electronCopy, outBytes);
  console.log('Шаблон записан:', outPath);
  console.log('Копия для fetch:', publicCopy);
}

main();
