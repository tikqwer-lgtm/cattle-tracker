// export-excel.js — экспорт в Excel/CSV, шаблон для импорта

/** Порядок колонок CSV (для шаблона и экспорта). Разделитель — точка с запятой. */
var CSV_HEADERS = [
  'Номер', 'Кличка', 'Группа', 'Дата рождения', 'Лактация', 'Дата отёла', 'Дата осеменения',
  'Номер попытки', 'Бык', 'Осеменитель', 'Код', 'Статус', 'Протокол', 'Начало протокола',
  'Дата выбытия', 'Начало сухостоя', 'ПДО', 'Примечание', 'Синхронизировано'
];
var CSV_DELIMITER = ';';

/**
 * Скачивает шаблон CSV для импорта
 */
function downloadTemplate() {
  var BOM = '\uFEFF';
  var line = CSV_HEADERS.join(CSV_DELIMITER);
  var csv = BOM + line + '\r\n';
  var blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'шаблон_импорта_коров.csv';
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Форматирует дату записи для экспорта в CSV
 */
function formatDateForExport(dateStr) {
  if (!dateStr) return '';
  return String(dateStr).trim();
}

/** Экранирует значение ячейки CSV */
function escapeCsvCell(val) {
  var s = val === null || val === undefined ? '' : String(val);
  if (s.indexOf(CSV_DELIMITER) !== -1 || s.indexOf('"') !== -1 || s.indexOf('\n') !== -1 || s.indexOf('\r') !== -1) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

/**
 * Возвращает значение ПДО для экспорта. Использует getPDO из view-cow.js при наличии.
 */
function getPDOForExport(entry) {
  if (typeof getPDO === 'function') return getPDO(entry);
  return entry.vwp !== undefined ? String(entry.vwp) : '';
}

/**
 * Экспорт текущих записей: при наличии SheetJS — .xlsx с листами Коровы и Осеменения, иначе CSV.
 */
function exportToExcel() {
  if (typeof entries === 'undefined' || !Array.isArray(entries) || entries.length === 0) {
    alert('Нет данных для экспорта.');
    return;
  }
  var dateStr = new Date().toISOString().slice(0, 10);

  if (typeof XLSX !== 'undefined') {
    var cowHeaders = [CSV_HEADERS];
    var cowRows = [];
    for (var i = 0; i < entries.length; i++) {
      var e = entries[i];
      var pdoVal = getPDOForExport(e);
      cowRows.push([
        e.cattleId || '',
        e.nickname || '',
        e.group || '',
        formatDateForExport(e.birthDate),
        e.lactation !== undefined && e.lactation !== '' ? String(e.lactation) : '',
        formatDateForExport(e.calvingDate),
        formatDateForExport(e.inseminationDate),
        e.attemptNumber !== undefined ? String(e.attemptNumber) : '1',
        e.bull || '',
        e.inseminator || '',
        e.code || '',
        e.status || '',
        (e.protocol && e.protocol.name) || '',
        formatDateForExport(e.protocol && e.protocol.startDate ? e.protocol.startDate : ''),
        formatDateForExport(e.exitDate),
        formatDateForExport(e.dryStartDate),
        pdoVal === '—' || pdoVal === '' ? '' : String(pdoVal),
        e.note || '',
        e.synced ? 'Да' : 'Нет'
      ]);
    }
    var wsCows = XLSX.utils.aoa_to_sheet(cowHeaders.concat(cowRows));

    var insemHeaders = [['Номер коровы', 'Кличка', 'Дата осеменения', 'Попытка', 'Бык', 'Осеменитель', 'Дней от предыдущего', 'Код']];
    var insemRows = [];
    if (typeof getAllInseminationsFlat === 'function') {
      var flat = getAllInseminationsFlat();
      for (var j = 0; j < flat.length; j++) {
        var r = flat[j];
        insemRows.push([
          r.cattleId || '',
          r.nickname || '',
          formatDateForExport(r.date),
          r.attemptNumber !== undefined ? String(r.attemptNumber) : '',
          r.bull || '',
          r.inseminator || '',
          r.daysFromPrevious !== undefined && r.daysFromPrevious !== '—' ? String(r.daysFromPrevious) : '',
          r.code || ''
        ]);
      }
    }
    var wsInsem = XLSX.utils.aoa_to_sheet(insemHeaders.concat(insemRows));

    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsCows, 'Коровы');
    XLSX.utils.book_append_sheet(wb, wsInsem, 'Осеменения');
    XLSX.writeFile(wb, 'коровы_' + dateStr + '.xlsx');
    return;
  }

  var BOM = '\uFEFF';
  var lines = [CSV_HEADERS.join(CSV_DELIMITER)];
  for (var k = 0; k < entries.length; k++) {
    var e = entries[k];
    var pdoVal = getPDOForExport(e);
    var row = [
      escapeCsvCell(e.cattleId),
      escapeCsvCell(e.nickname),
      escapeCsvCell(e.group || ''),
      escapeCsvCell(formatDateForExport(e.birthDate)),
      (e.lactation !== undefined && e.lactation !== '' ? String(e.lactation) : ''),
      escapeCsvCell(formatDateForExport(e.calvingDate)),
      escapeCsvCell(formatDateForExport(e.inseminationDate)),
      (e.attemptNumber !== undefined ? String(e.attemptNumber) : '1'),
      escapeCsvCell(e.bull),
      escapeCsvCell(e.inseminator),
      escapeCsvCell(e.code),
      escapeCsvCell(e.status),
      escapeCsvCell(e.protocol && e.protocol.name ? e.protocol.name : ''),
      escapeCsvCell(formatDateForExport(e.protocol && e.protocol.startDate ? e.protocol.startDate : '')),
      escapeCsvCell(formatDateForExport(e.exitDate)),
      escapeCsvCell(formatDateForExport(e.dryStartDate)),
      (pdoVal === '—' || pdoVal === '' ? '' : String(pdoVal)),
      escapeCsvCell(e.note),
      (e.synced ? 'Да' : 'Нет')
    ];
    lines.push(row.join(CSV_DELIMITER));
  }
  var csv = BOM + lines.join('\r\n');
  var blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'коровы_' + dateStr + '.csv';
  a.click();
  URL.revokeObjectURL(url);
}
