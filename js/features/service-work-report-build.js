/**
 * Опись работ сервис-специалиста за дату (из карточек животных).
 */

function namesMatch(a, b) {
  return String(a || '')
    .trim()
    .toLowerCase() === String(b || '')
    .trim()
    .toLowerCase();
}

function dateKey(raw) {
  var s = String(raw || '').trim();
  if (!s) return '';
  var iso = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return iso[1] + '-' + iso[2] + '-' + iso[3];
  var ru = s.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (ru) {
    return ru[3] + '-' + String(ru[2]).padStart(2, '0') + '-' + String(ru[1]).padStart(2, '0');
  }
  return s.slice(0, 10);
}

function histType(item) {
  if (!item || typeof item !== 'object') return '';
  return String(item.eventType || item.action || '').trim();
}

function isInsemAction(item) {
  var t = histType(item);
  return t === 'Осеменение' || t.indexOf('Осеменение') === 0;
}

function isUziAction(item) {
  var t = histType(item);
  return t === 'УЗИ' || t === 'УЗИ1' || t === 'УЗИ2' || t.indexOf('УЗИ') === 0;
}

function isProtocolAction(item) {
  var t = histType(item);
  return t === 'Постановка на протокол' || t.indexOf('протокол') !== -1 || t.indexOf('Протокол') !== -1;
}

function uziActionLabel(item) {
  var t = histType(item);
  if (t === 'УЗИ1' || t.indexOf('УЗИ1') !== -1) return 'УЗИ1';
  if (t === 'УЗИ2' || t.indexOf('УЗИ2') !== -1) return 'УЗИ2';
  return 'УЗИ';
}

function itemDate(item) {
  if (!item) return '';
  var fromDetails = dateKey(item.details);
  if (fromDetails) return fromDetails;
  return dateKey(item.dateTime || item.date || item.startDate);
}

function actor(item, fallback) {
  return (item && (item.userName || item.inseminator || item.specialist)) || fallback || '';
}

function insemDetails(item, rec) {
  var bull = (item && item.bull) || (rec && rec.bull) || '';
  var tech = (item && item.inseminator) || (rec && rec.inseminator) || '';
  var parts = [];
  if (bull) parts.push('бык ' + bull);
  if (tech) parts.push('техник ' + tech);
  if (!parts.length && item && item.details) return String(item.details);
  return parts.join(', ');
}

function uziResultOf(item, rec) {
  return String((item && item.result) || (rec && rec.result) || '').trim();
}

function formatUziPrintResult(result) {
  var r = String(result || '').trim();
  if (!r) return '';
  if (/не стельн/i.test(r) || /ялов/i.test(r)) return 'Яловая';
  if (/сомнительн/i.test(r)) return 'Сомнительная';
  if (/стельн/i.test(r)) return 'Стельная';
  return r;
}

function formatPrintDate(raw) {
  var k = dateKey(raw);
  if (!k) return '';
  var p = k.split('-');
  if (p.length !== 3) return k;
  return p[2] + '.' + p[1] + '.' + p[0];
}

function isUziReportItem(it) {
  var a = String((it && it.action) || '');
  return a === 'УЗИ' || a.indexOf('УЗИ') === 0;
}

function uziDetails(item, rec) {
  var result = uziResultOf(item, rec);
  var days = item && item.details && String(item.details).match(/дней от осеменения:\s*(\d+)/i);
  var daysVal = (rec && rec.daysFromInsemination != null && rec.daysFromInsemination !== '')
    ? rec.daysFromInsemination
    : (days ? days[1] : '');
  var parts = [];
  if (result) parts.push(result);
  if (daysVal !== '' && daysVal != null) parts.push('дней от осеменения: ' + daysVal);
  if (!parts.length && item && item.details) return String(item.details);
  return parts.join(', ');
}

function protocolDetails(item, entry) {
  var name = (item && item.protocolName) || (entry && entry.protocol && entry.protocol.name) || '';
  if (name) return String(name);
  if (item && item.details) return String(item.details);
  return '';
}

function pushItem(out, seen, row) {
  var key = row.cattleId + '|' + row.action + '|' + row.workDate;
  if (seen[key]) return;
  seen[key] = true;
  out.push(row);
}

function pushUziItem(out, seen, row) {
  var key = row.cattleId + '|uzi|' + row.workDate;
  var prevIdx = seen[key];
  if (prevIdx != null && out[prevIdx]) {
    var prev = out[prevIdx];
    var prevRank = prev.action === 'УЗИ1' || prev.action === 'УЗИ2' ? 2 : 1;
    var nextRank = row.action === 'УЗИ1' || row.action === 'УЗИ2' ? 2 : 1;
    if (nextRank > prevRank) {
      prev.action = row.action;
      if (row.details) prev.details = row.details;
    }
    if (!prev.result && row.result) prev.result = row.result;
    if (!prev.group && row.group) prev.group = row.group;
    return;
  }
  seen[key] = out.length;
  out.push(row);
}

function collectServiceWorkItems(entries, opts) {
  opts = opts || {};
  var date = dateKey(opts.date);
  var username = opts.username || '';
  var types = opts.types || { insemination: true, uzi: true, protocol: true };
  var out = [];
  var seen = {};
  (entries || []).forEach(function (entry) {
    if (!entry) return;
    var cattleId = String(entry.cattleId || '');
    ((entry.actionHistory) || []).forEach(function (h) {
      var d = itemDate(h);
      if (date && d !== date) return;
      if (username && !namesMatch(actor(h), username)) return;
      if (types.insemination && isInsemAction(h)) {
        pushItem(out, seen, {
          cattleId: cattleId,
          action: 'Осеменение',
          details: insemDetails(h),
          workDate: d,
          group: String(entry.group || '')
        });
      } else if (types.uzi && isUziAction(h)) {
        pushUziItem(out, seen, {
          cattleId: cattleId,
          action: uziActionLabel(h),
          details: uziDetails(h),
          workDate: d,
          group: String(entry.group || ''),
          result: uziResultOf(h)
        });
      } else if (types.protocol && isProtocolAction(h) && !isInsemAction(h) && !isUziAction(h)) {
        pushItem(out, seen, {
          cattleId: cattleId,
          action: 'Протокол',
          details: protocolDetails(h, entry),
          workDate: d,
          group: String(entry.group || '')
        });
      }
    });
    if (types.insemination) {
      ((entry.inseminationHistory) || []).forEach(function (rec) {
        var d = dateKey(rec && rec.date);
        if (date && d !== date) return;
        var who = actor(rec, rec && rec.inseminator);
        if (username && !namesMatch(who, username) && !namesMatch(rec && rec.inseminator, username)) return;
        pushItem(out, seen, {
          cattleId: cattleId,
          action: 'Осеменение',
          details: insemDetails(null, rec),
          workDate: d,
          group: String(entry.group || '')
        });
      });
    }
    if (types.uzi) {
      ((entry.uziHistory) || []).forEach(function (rec, idx) {
        var d = dateKey(rec && rec.date);
        if (date && d !== date) return;
        var who = actor(rec, rec && rec.specialist);
        if (username && !namesMatch(who, username) && !namesMatch(rec && rec.specialist, username)) return;
        var label = idx === 0 ? 'УЗИ1' : (idx === 1 ? 'УЗИ2' : 'УЗИ');
        pushUziItem(out, seen, {
          cattleId: cattleId,
          action: label,
          details: uziDetails(null, rec),
          workDate: d,
          group: String(entry.group || ''),
          result: uziResultOf(null, rec)
        });
      });
    }
    if (types.protocol && entry.protocol && entry.protocol.startDate) {
      var d = dateKey(entry.protocol.startDate);
      if (date && d === date) {
        /* without actionHistory user we cannot prove "mine"; skip unless already collected */
      }
    }
  });
  out.sort(function (a, b) {
    var c = String(a.cattleId).localeCompare(String(b.cattleId), 'ru', { numeric: true });
    if (c !== 0) return c;
    return String(a.action).localeCompare(String(b.action), 'ru');
  });
  return out;
}

function serializeReportText(items) {
  return (items || [])
    .map(function (it) {
      return [
        it.cattleId || '',
        it.action || '',
        it.details || '',
        it.workDate || '',
        it.group || '',
        it.result || ''
      ].join('\t');
    })
    .join('\n');
}

function reportWordFilename(items, date, farmName) {
  var farm = String(farmName || '').trim();
  var dPrint = formatPrintDate(date) || String(date || '').trim();
  var prefix = (items || []).some(isUziReportItem) ? 'УЗИ' : 'opis';
  return prefix + (farm ? ' ' + farm : '') + (dPrint ? ' ' + dPrint : '') + '.doc';
}

function isDuplicateServiceReport(events, date, items) {
  var text = serializeReportText(items);
  var dateK = dateKey(date);
  return (events || []).some(function (ev) {
    return ev &&
      ev.eventType === 'service_report' &&
      dateKey(ev.eventDate) === dateK &&
      String(ev.description || '') === text;
  });
}

function resultFromDetails(details) {
  var s = String(details || '');
  if (/сомнительн/i.test(s)) return 'Сомнительная';
  if (/не стельн/i.test(s) || /ялов/i.test(s)) return 'Не стельная';
  if (/стельн/i.test(s)) return 'Стельная';
  return '';
}

function parseReportItemsFromDescription(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map(function (line) {
      var p = line.split('\t');
      if (p.length < 2) return null;
      return {
        cattleId: p[0] || '',
        action: p[1] || '',
        details: p[2] || '',
        workDate: p[3] || '',
        group: p[4] || '',
        result: p[5] || resultFromDetails(p[2])
      };
    })
    .filter(Boolean);
}

function escapePrintHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function uziPrintTableHtml(items, farmName) {
  var farm = String(farmName || '').trim();
  var rows = (items || []).filter(isUziReportItem);
  if (!rows.length) return '';
  var body = rows
    .map(function (it, idx) {
      var mtf = String(it.group || '').trim() || farm;
      return (
        '<tr>' +
        '<td class="n">' +
        (idx + 1) +
        '</td>' +
        '<td>' +
        escapePrintHtml(it.cattleId) +
        '</td>' +
        '<td>' +
        escapePrintHtml(mtf) +
        '</td>' +
        '<td>' +
        escapePrintHtml(formatPrintDate(it.workDate)) +
        '</td>' +
        '<td>' +
        escapePrintHtml(formatUziPrintResult(it.result || it.details)) +
        '</td>' +
        '</tr>'
      );
    })
    .join('');
  return (
    '<table class="uzi-print-table">' +
    '<thead><tr>' +
    '<th>№ п/п</th><th>№</th><th>МТФ</th><th>Дата узи</th><th>Результат</th>' +
    '</tr></thead><tbody>' +
    body +
    '</tbody></table>'
  );
}

function uziPrintDocumentHtml(opts) {
  opts = opts || {};
  var date = opts.date || '';
  var farmName = opts.farmName || '';
  var username = opts.username || '';
  var table = uziPrintTableHtml(opts.items || [], farmName);
  if (!table) return '';
  var sub = [];
  if (farmName) sub.push(farmName);
  if (username) sub.push(username);
  if (date) sub.push(formatPrintDate(date));
  return (
    '<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8">' +
    '<title>УЗИ' +
    (farmName ? ' ' + escapePrintHtml(farmName) : '') +
    (date ? ' ' + escapePrintHtml(formatPrintDate(date)) : '') +
    '</title>' +
    '<style>' +
    '@page{size:A4;margin:12mm}' +
    'body{font-family:"Times New Roman",Times,serif;font-size:12pt;color:#000;margin:0;padding:12px}' +
    'h1{font-size:14pt;text-align:center;margin:0 0 6px;font-weight:700}' +
    '.sub{text-align:center;margin:0 0 12px;font-size:11pt}' +
    'table{border-collapse:collapse;width:100%}' +
    'th,td{border:1px solid #000;padding:4px 6px;text-align:center}' +
    'th{font-weight:700;background:#f3f3f3}' +
    'td.n{width:3.5em}' +
    '</style></head><body>' +
    '<h1>Список животных с указанием МТФ и номера животных</h1>' +
    (sub.length ? '<p class="sub">' + escapePrintHtml(sub.join(' · ')) + '</p>' : '') +
    table +
    '</body></html>'
  );
}

var MOKSHA_TITLE = 'Список животных с указанием МТФ и номера животных';
var MOKSHA_HEADERS = ['№ п/п', '№ Животного', 'МТФ', 'Дата узи'];

function mokshaMtfOf(it, farmName) {
  return String((it && it.group) || '').trim() || String(farmName || '').trim();
}

function sortMokshaUziItems(items, farmName) {
  var farm = String(farmName || '').trim();
  return (items || [])
    .filter(isUziReportItem)
    .slice()
    .sort(function (a, b) {
      var ma = mokshaMtfOf(a, farm);
      var mb = mokshaMtfOf(b, farm);
      var c = ma.localeCompare(mb, 'ru');
      if (c !== 0) return c;
      return String(a.cattleId || '').localeCompare(String(b.cattleId || ''), 'ru', { numeric: true });
    });
}

/**
 * Двумерный массив листа «Мокша»: заголовок, колонки, строки УЗИ, подписи.
 * opts: { farmName, signerLeft, signerRight }
 */
function mokshaUziAoa(items, opts) {
  opts = opts || {};
  var farm = String(opts.farmName || '').trim();
  var left = String(opts.signerLeft || '').trim();
  var right = String(opts.signerRight || '').trim();
  var rows = sortMokshaUziItems(items, farm);
  var aoa = [
    [MOKSHA_TITLE, '', '', ''],
    ['', '', '', ''],
    MOKSHA_HEADERS.slice()
  ];
  rows.forEach(function (it, idx) {
    aoa.push([
      idx + 1,
      it.cattleId != null ? String(it.cattleId) : '',
      mokshaMtfOf(it, farm),
      formatPrintDate(it.workDate) || String(it.workDate || '')
    ]);
  });
  aoa.push(['', '', '', '']);
  aoa.push([left, '', right, '']);
  aoa.push(['', '', '', '']);
  aoa.push(['Подпись', '', 'Подпись', '']);
  return aoa;
}

function mokshaUziSheetFromAoa(aoa) {
  var XLSX = typeof window !== 'undefined' ? window.XLSX : null;
  if (!XLSX || !XLSX.utils) return null;
  var ws = XLSX.utils.aoa_to_sheet(aoa || []);
  ws['!merges'] = [{ s: { c: 0, r: 0 }, e: { c: 3, r: 1 } }];
  ws['!cols'] = [
    { wch: 8.57 },
    { wch: 15.29 },
    { wch: 11.86 },
    { wch: 10.57 }
  ];
  return ws;
}

function mokshaUziWorkbook(aoa) {
  var XLSX = typeof window !== 'undefined' ? window.XLSX : null;
  if (!XLSX || !XLSX.utils) return null;
  var wb = XLSX.utils.book_new();
  var ws = mokshaUziSheetFromAoa(aoa);
  if (!ws) return null;
  XLSX.utils.book_append_sheet(wb, ws, 'Лист1');
  return wb;
}

function mokshaUziFilename(date, farmName) {
  var farm = String(farmName || '').trim() || 'Мокша';
  var dPrint = formatPrintDate(date) || String(date || '').trim();
  return 'УЗИ ' + farm + (dPrint ? ' ' + dPrint : '') + '.xlsx';
}

function mokshaUziTableHtml(items, farmName) {
  var farm = String(farmName || '').trim();
  var rows = sortMokshaUziItems(items, farm);
  if (!rows.length) return '';
  var body = rows
    .map(function (it, idx) {
      return (
        '<tr>' +
        '<td class="n">' +
        (idx + 1) +
        '</td>' +
        '<td>' +
        escapePrintHtml(it.cattleId) +
        '</td>' +
        '<td>' +
        escapePrintHtml(mokshaMtfOf(it, farm)) +
        '</td>' +
        '<td>' +
        escapePrintHtml(formatPrintDate(it.workDate)) +
        '</td>' +
        '</tr>'
      );
    })
    .join('');
  return (
    '<table class="uzi-print-table moksha-uzi-table">' +
    '<thead><tr>' +
    '<th>№ п/п</th><th>№ Животного</th><th>МТФ</th><th>Дата узи</th>' +
    '</tr></thead><tbody>' +
    body +
    '</tbody></table>'
  );
}

function mokshaUziPreviewHtml(opts) {
  opts = opts || {};
  var farmName = opts.farmName || '';
  var date = opts.date || '';
  var left = String(opts.signerLeft || '').trim();
  var right = String(opts.signerRight || '').trim();
  var table = mokshaUziTableHtml(opts.items || [], farmName);
  if (!table) return '';
  return (
    '<div class="moksha-uzi-preview">' +
    '<p class="moksha-uzi-title">' +
    escapePrintHtml(MOKSHA_TITLE) +
    '</p>' +
    table +
    '<div class="moksha-uzi-signers">' +
    '<div class="moksha-uzi-signer"><div>' +
    escapePrintHtml(left) +
    '</div><div class="moksha-uzi-sign-label">Подпись</div></div>' +
    '<div class="moksha-uzi-signer"><div>' +
    escapePrintHtml(right) +
    '</div><div class="moksha-uzi-sign-label">Подпись</div></div>' +
    '</div>' +
    (date
      ? '<p class="farm-settings-hint">' + escapePrintHtml(formatPrintDate(date) || date) + '</p>'
      : '') +
    '</div>'
  );
}

function mokshaUziDocumentHtml(opts) {
  opts = opts || {};
  var farmName = opts.farmName || '';
  var date = opts.date || '';
  var left = String(opts.signerLeft || '').trim();
  var right = String(opts.signerRight || '').trim();
  var table = mokshaUziTableHtml(opts.items || [], farmName);
  if (!table) return '';
  return (
    '<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8">' +
    '<title>' +
    escapePrintHtml(mokshaUziFilename(date, farmName).replace(/\.xlsx$/i, '')) +
    '</title>' +
    '<style>' +
    'body{font-family:"Times New Roman",Times,serif;font-size:12pt;color:#000;margin:0;padding:12px}' +
    'h1{font-size:14pt;text-align:center;margin:0 0 12px;font-weight:700}' +
    'table{border-collapse:collapse;width:100%}' +
    'th,td{border:1px solid #000;padding:4px 6px;text-align:center}' +
    'th{font-weight:700}' +
    'td.n{width:3.5em}' +
    '.signers{display:flex;justify-content:space-between;margin-top:24px;gap:24px}' +
    '.signer{min-width:40%}' +
    '.sign-label{margin-top:18px}' +
    '</style></head><body>' +
    '<h1>' +
    escapePrintHtml(MOKSHA_TITLE) +
    '</h1>' +
    table +
    '<div class="signers">' +
    '<div class="signer"><div>' +
    escapePrintHtml(left) +
    '</div><div class="sign-label">Подпись</div></div>' +
    '<div class="signer"><div>' +
    escapePrintHtml(right) +
    '</div><div class="sign-label">Подпись</div></div>' +
    '</div>' +
    '</body></html>'
  );
}

export {
  collectServiceWorkItems,
  serializeReportText,
  parseReportItemsFromDescription,
  dateKey,
  formatUziPrintResult,
  formatPrintDate,
  isUziReportItem,
  uziPrintTableHtml,
  uziPrintDocumentHtml,
  reportWordFilename,
  isDuplicateServiceReport,
  sortMokshaUziItems,
  mokshaUziAoa,
  mokshaUziWorkbook,
  mokshaUziFilename,
  mokshaUziPreviewHtml,
  mokshaUziDocumentHtml,
  mokshaUziTableHtml
};
