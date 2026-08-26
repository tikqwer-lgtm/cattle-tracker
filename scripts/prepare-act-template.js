/**
 * Собирает assets/templates/act-uslug.docx из образца Word:
 * убирает «ОБРАЗЕЦ», вставляет плейсхолдеры, оставляет одну строку таблицы.
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

function injectIntoCell(tcXml, placeholder) {
  if (/<w:t[\s\S]*?>1<\/w:t>/.test(tcXml)) {
    return tcXml.replace(/<w:t([^>]*)>1<\/w:t>/, '<w:t$1>' + placeholder + '</w:t>');
  }
  const idx = tcXml.indexOf('</w:p>');
  if (idx === -1) return tcXml;
  return tcXml.slice(0, idx) + addRun(placeholder) + tcXml.slice(idx);
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

function patchServicesTable(xml) {
  const marker = 'Наименование услуги';
  const pos = xml.indexOf(marker);
  if (pos < 0) throw new Error('Не найдена таблица услуг');
  const tblStart = xml.lastIndexOf('<w:tbl>', pos);
  const tblEnd = xml.indexOf('</w:tbl>', pos);
  if (tblStart < 0 || tblEnd < 0) throw new Error('Не найдены границы таблицы услуг');
  const tbl = xml.slice(tblStart, tblEnd + '</w:tbl>'.length);
  const rows = splitTrs(tbl);
  if (rows.length < 3) throw new Error('В таблице услуг мало строк: ' + rows.length);

  const header = rows[0];
  const data = rows[1];
  const total = rows[rows.length - 1];
  const dataCells = splitCells(data);
  if (dataCells.length < 7) throw new Error('В строке услуг ожидалось 7 ячеек, есть ' + dataCells.length);

  dataCells[0] = injectIntoCell(dataCells[0], '{{rowNum}}');
  dataCells[1] = injectIntoCell(dataCells[1], '{{svcName}}');
  dataCells[2] = injectIntoCell(dataCells[2], '{{svcUnit}}');
  dataCells[3] = injectIntoCell(dataCells[3], '{{svcQty}}');
  dataCells[4] = injectIntoCell(dataCells[4], '{{svcPrice}}');
  dataCells[6] = injectIntoCell(dataCells[6], '{{svcSum}}');
  const dataRow = rebuildTr(data, dataCells);

  const totalCells = splitCells(total);
  if (!totalCells.length) throw new Error('Нет ячеек в строке Итого');
  totalCells[totalCells.length - 1] = injectIntoCell(
    totalCells[totalCells.length - 1],
    '{{total}}'
  );
  const totalRow = rebuildTr(total, totalCells);

  const tblPrEnd = tbl.indexOf(rows[0]);
  const prefix = tbl.slice(0, tblPrEnd);
  const nextTbl = prefix + header + dataRow + totalRow + '</w:tbl>';
  return xml.slice(0, tblStart) + nextTbl + xml.slice(tblEnd + '</w:tbl>'.length);
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
    '>с одной стороны, и {{customerFio}}<'
  );
  xml = xml.replace(
    /Стоимость оказанных услуг составила _______ \(____________________________________________________________________________\) /,
    'Стоимость оказанных услуг составила {{total}} ({{totalWords}}) '
  );
  xml = xml.replace(/рублей____копеек/, 'рублей 00 копеек');
  xml = patchServicesTable(xml);
  if (xml.indexOf('{{actDate}}') < 0) throw new Error('Не вставлен {{actDate}}');
  if (xml.indexOf('{{executorFio}}') < 0) throw new Error('Не вставлен {{executorFio}}');
  if (xml.indexOf('{{customerFio}}') < 0) throw new Error('Не вставлен {{customerFio}}');
  if (xml.indexOf('{{svcName}}') < 0) throw new Error('Не вставлен {{svcName}}');
  if (xml.indexOf('{{svcPrice}}') < 0) throw new Error('Не вставлен {{svcPrice}}');
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
  console.log('Шаблон записан:', outPath);
  console.log('Копия для fetch:', publicCopy);
}

main();
