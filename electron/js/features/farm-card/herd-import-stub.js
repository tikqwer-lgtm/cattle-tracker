/**
 * Импорт KPI карточки хозяйства:
 * — шаблон kpi/bulls (CSV/XLSX);
 * — сырые BREDSUM\\E (HDR/%PR по 21-дневкам → месяц) и BREDSUM BY SID (CR по быкам).
 */
(function (global) {
  'use strict';

  var SUPPORTED_SOURCES = [
    { id: 'dc305', label: 'DairyComp 305 (BREDSUM / шаблон)', status: 'ready' },
    { id: 'generic_csv', label: 'CSV/Excel шаблон KPI', status: 'ready' },
    { id: 'afifarm', label: 'AfiFarm', status: 'planned' },
    { id: 'uniform', label: 'Uniform-Agri', status: 'planned' }
  ];

  var MONTH_IDS = {
    cows_cr: 'm_cr_cows_m',
    cows_hdr: 'm_hdr_cows_m',
    cows_pr: 'm_pr_cows_m',
    heif_cr: 'm_cr_heif_m',
    heif_hdr: 'm_hdr_heif_m',
    heif_pr: 'm_pr_heif_m'
  };
  var YEAR_IDS = {
    cows_cr: 'm_cr_cows_y',
    cows_hdr: 'm_hdr_cows_y',
    cows_pr: 'm_pr_cows_y',
    heif_cr: 'm_cr_heif_y',
    heif_hdr: 'm_hdr_heif_y',
    heif_pr: 'm_pr_heif_y'
  };

  var KPI_HEADER_ALIASES = {
    month: ['month', 'месяц', 'ym', 'period', 'период'],
    cows_cr: ['cows_cr', 'коровы_cr', 'cr_cows', 'cr коровы', 'cr_коровы'],
    cows_hdr: ['cows_hdr', 'коровы_hdr', 'hdr_cows', 'hdr коровы', 'hdr_коровы'],
    cows_pr: ['cows_pr', 'коровы_pr', 'pr_cows', 'pr коровы', 'pr_коровы'],
    heif_cr: ['heif_cr', 'телки_cr', 'тёлка_cr', 'тёлки_cr', 'cr_heif', 'cr тёлки', 'cr_телки'],
    heif_hdr: ['heif_hdr', 'телки_hdr', 'тёлки_hdr', 'hdr_heif', 'hdr тёлки', 'hdr_телки'],
    heif_pr: ['heif_pr', 'телки_pr', 'тёлки_pr', 'pr_heif', 'pr тёлки', 'pr_телки']
  };

  var BULL_HEADER_ALIASES = {
    month: ['month', 'месяц', 'ym', 'period', 'период'],
    bull: ['bull', 'бык', 'sire', 'sid', 'кличка', 'bullname', 'name'],
    cr: ['cr', 'cr%', 'cr_pct', 'оплодотворяемость', 'conc', '%conc']
  };

  function normHeader(h) {
    return String(h == null ? '' : h)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/ё/g, 'е');
  }

  function mapHeaders(row0, aliases) {
    var map = {};
    if (!row0 || !row0.length) return map;
    for (var c = 0; c < row0.length; c++) {
      var h = normHeader(row0[c]);
      if (!h) continue;
      Object.keys(aliases).forEach(function (key) {
        if (map[key] != null) return;
        var list = aliases[key];
        for (var i = 0; i < list.length; i++) {
          if (normHeader(list[i]) === h) {
            map[key] = c;
            break;
          }
        }
      });
    }
    return map;
  }

  function cell(row, idx) {
    if (idx == null || idx < 0 || !row) return '';
    var v = row[idx];
    if (v == null) return '';
    return String(v).trim();
  }

  function toYearMonth(raw) {
    var s = String(raw || '').trim();
    if (!s) return '';
    var low = s.toLowerCase().replace(/ё/g, 'е');
    if (low === 'year' || low === 'год' || low === 'y') return 'year';
    if (/^\d{4}-\d{2}$/.test(s)) return s;
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 7);
    var m = s.match(/^(\d{1,2})[.\/](\d{4})$/);
    if (m) return m[2] + '-' + String(m[1]).padStart(2, '0');
    var m2 = s.match(/^(\d{4})[.\/](\d{1,2})$/);
    if (m2) return m2[1] + '-' + String(m2[2]).padStart(2, '0');
    return '';
  }

  function newId(prefix) {
    return prefix + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  function pushMetric(list, metricId, valueDate, text) {
    var t = text != null ? String(text).trim() : '';
    if (!t || !metricId || !valueDate) return;
    list.push({
      id: null,
      metricId: metricId,
      valueDate: valueDate,
      valueText: t,
      source: 'manual'
    });
  }

  function parseKpiRows(rows, errors) {
    var metricValues = [];
    if (!rows || rows.length < 2) {
      errors.push('Лист kpi: нет данных (нужен заголовок и хотя бы одна строка)');
      return metricValues;
    }
    var map = mapHeaders(rows[0], KPI_HEADER_ALIASES);
    if (map.month == null) {
      errors.push('Лист kpi: не найден столбец month / месяц');
      return metricValues;
    }
    var today = new Date().toISOString().slice(0, 10);
    for (var r = 1; r < rows.length; r++) {
      var row = rows[r];
      if (!row || !row.length) continue;
      var ymRaw = cell(row, map.month);
      if (!ymRaw) continue;
      var ym = toYearMonth(ymRaw);
      if (!ym) {
        errors.push('Лист kpi, строка ' + (r + 1) + ': неверный месяц «' + ymRaw + '»');
        continue;
      }
      var ids = ym === 'year' ? YEAR_IDS : MONTH_IDS;
      var valueDate = ym === 'year' ? today : ym + '-01';
      pushMetric(metricValues, ids.cows_cr, valueDate, cell(row, map.cows_cr));
      pushMetric(metricValues, ids.cows_hdr, valueDate, cell(row, map.cows_hdr));
      pushMetric(metricValues, ids.cows_pr, valueDate, cell(row, map.cows_pr));
      pushMetric(metricValues, ids.heif_cr, valueDate, cell(row, map.heif_cr));
      pushMetric(metricValues, ids.heif_hdr, valueDate, cell(row, map.heif_hdr));
      pushMetric(metricValues, ids.heif_pr, valueDate, cell(row, map.heif_pr));
    }
    return metricValues;
  }

  function parseBullRows(rows, errors) {
    var bullFertility = [];
    if (!rows || rows.length < 2) {
      return bullFertility;
    }
    var map = mapHeaders(rows[0], BULL_HEADER_ALIASES);
    if (map.month == null || map.bull == null || map.cr == null) {
      errors.push('Лист bulls: нужны столбцы month, bull, cr (или русские синонимы)');
      return bullFertility;
    }
    for (var r = 1; r < rows.length; r++) {
      var row = rows[r];
      if (!row || !row.length) continue;
      var ym = toYearMonth(cell(row, map.month));
      var bull = cell(row, map.bull);
      var cr = cell(row, map.cr);
      if (!ym || ym === 'year') {
        if (cell(row, map.month) || bull || cr) {
          errors.push('Лист bulls, строка ' + (r + 1) + ': укажите месяц YYYY-MM');
        }
        continue;
      }
      if (!bull || !cr) continue;
      bullFertility.push({
        id: newId('bf_'),
        bullName: bull,
        periodMonth: ym,
        crPct: cr,
        services: '',
        pregnant: ''
      });
    }
    return bullFertility;
  }

  function sheetToRows(ws) {
    if (typeof XLSX === 'undefined') return [];
    return XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });
  }

  function decodeCsvBuffer(ab) {
    var u8 = new Uint8Array(ab);
    var utf8 = '';
    try {
      utf8 = new TextDecoder('utf-8').decode(u8);
    } catch (e1) {
      utf8 = String.fromCharCode.apply(null, u8);
    }
    var probe = utf8.slice(0, 200);
    if (/Дата|HDR|SID|%PR|%Стел|месяц|cows_cr/i.test(probe) && probe.indexOf('\ufffd') === -1) {
      return utf8;
    }
    try {
      var cp1251 = new TextDecoder('windows-1251').decode(u8);
      if (/Дата|HDR|SID|%PR|%Стел|Всего/i.test(cp1251.slice(0, 200))) return cp1251;
      return cp1251;
    } catch (e2) {
      return utf8;
    }
  }

  function parseCsvToRows(csvString) {
    if (typeof Papa === 'undefined') return null;
    var delim = csvString.indexOf(';') !== -1 ? ';' : ',';
    var parsed = Papa.parse(csvString, { header: false, skipEmptyLines: true, delimiter: delim });
    return parsed.data || [];
  }

  function parseDcDateToYm(raw) {
    var s = String(raw || '').trim();
    var m = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{2,4})$/);
    if (!m) return '';
    var dd = parseInt(m[1], 10);
    var mm = parseInt(m[2], 10);
    var yy = parseInt(m[3], 10);
    if (m[3].length <= 2) yy = yy <= 70 ? 2000 + yy : 1900 + yy;
    if (!mm || mm < 1 || mm > 12 || !dd) return '';
    return yy + '-' + String(mm).padStart(2, '0');
  }

  function parseNumCell(raw) {
    var s = String(raw == null ? '' : raw).trim().replace(/\s/g, '').replace(',', '.');
    if (!s || s === '-' || s === '—') return null;
    var n = parseFloat(s);
    return isNaN(n) ? null : n;
  }

  function roundPct(n) {
    if (n == null || isNaN(n)) return '';
    return String(Math.round(n));
  }

  function segmentFromFileName(fileName) {
    var n = String(fileName || '').toLowerCase().replace(/ё/g, 'е');
    if (/телк|heif|lact\s*0|lact=0|лакт\s*0/.test(n)) return 'heif';
    return 'cows';
  }

  function findHeaderIndex(headers, predicates) {
    for (var i = 0; i < headers.length; i++) {
      var h = normHeader(headers[i]);
      for (var p = 0; p < predicates.length; p++) {
        if (predicates[p](h)) return i;
      }
    }
    return -1;
  }

  function isBredsumE(rows) {
    if (!rows || !rows[0]) return false;
    var joined = (rows[0] || []).map(normHeader).join(' ');
    var hasDate = /дата|date/.test(joined);
    var hasHdr = /\bhdr\b/.test(joined);
    var hasPr = /%pr|\bpr\b|стел/.test(joined);
    return hasDate && hasHdr && hasPr;
  }

  function isBredsumBySid(rows) {
    if (!rows || !rows[0]) return false;
    var h0 = normHeader((rows[0] || [])[0]);
    if (h0 === 'sid' || h0 === 'sire' || h0 === 'bull') return true;
    var fileHint = false;
    var c0 = cell(rows[1] || [], 0).replace(/\s/g, '');
    if (/^\d*H\d+/i.test(c0) || /\.S$/i.test(c0)) fileHint = true;
    var joined = (rows[0] || []).map(normHeader).join(' ');
    if (/sid|sire/.test(joined) && (/%стел|%conc|стел|#стел/.test(joined) || fileHint)) return true;
    return fileHint && rows.length > 5;
  }

  function isTotalRow(raw) {
    var s = normHeader(raw).replace(/\s/g, '');
    return s === 'всего' || s === 'total' || s.indexOf('всего') !== -1;
  }

  /**
   * BREDSUM\E: Дата; …; HDR; …; %PR → HDR/PR по календарным месяцам (+ строка Всего → год).
   * CR в этом отчёте нет — не заполняется.
   */
  function parseBredsumE(rows, errors, segment) {
    var metricValues = [];
    var headers = rows[0] || [];
    var dateIdx = findHeaderIndex(headers, [
      function (h) {
        return h === 'дата' || h === 'date';
      }
    ]);
    var hdrIdx = findHeaderIndex(headers, [
      function (h) {
        return h === 'hdr' || h === '%hdr';
      }
    ]);
    var prIdx = findHeaderIndex(headers, [
      function (h) {
        return h === '%pr' || h === 'pr' || h === '%стел' || h === 'pct pr';
      }
    ]);
    if (dateIdx < 0) dateIdx = 0;
    if (hdrIdx < 0) {
      errors.push('BREDSUM\\E: не найден столбец HDR');
      return metricValues;
    }
    if (prIdx < 0) {
      // типичный порядок: Дата;Ос Приг;Осем;HDR;Ст Приг;Стел;%PR
      prIdx = headers.length > 6 ? 6 : -1;
    }
    if (prIdx < 0) {
      errors.push('BREDSUM\\E: не найден столбец %PR');
      return metricValues;
    }

    var byMonth = {};
    var yearHdr = null;
    var yearPr = null;
    var hdrKey = segment === 'heif' ? 'heif_hdr' : 'cows_hdr';
    var prKey = segment === 'heif' ? 'heif_pr' : 'cows_pr';

    for (var r = 1; r < rows.length; r++) {
      var row = rows[r];
      if (!row || !row.length) continue;
      var dateRaw = cell(row, dateIdx);
      if (isTotalRow(dateRaw)) {
        yearHdr = parseNumCell(cell(row, hdrIdx));
        yearPr = parseNumCell(cell(row, prIdx));
        continue;
      }
      var ym = parseDcDateToYm(dateRaw);
      if (!ym) continue;
      var hdr = parseNumCell(cell(row, hdrIdx));
      var pr = parseNumCell(cell(row, prIdx));
      // %PR=0 в незакрытых окнах (ещё нет диагнозов) — не усредняем в месяц
      if (pr === 0) pr = null;
      if (hdr == null && pr == null) continue;
      if (!byMonth[ym]) byMonth[ym] = { hdrSum: 0, hdrN: 0, prSum: 0, prN: 0 };
      if (hdr != null) {
        byMonth[ym].hdrSum += hdr;
        byMonth[ym].hdrN += 1;
      }
      if (pr != null) {
        byMonth[ym].prSum += pr;
        byMonth[ym].prN += 1;
      }
    }

    Object.keys(byMonth)
      .sort()
      .forEach(function (ym) {
        var g = byMonth[ym];
        var valueDate = ym + '-01';
        if (g.hdrN) pushMetric(metricValues, MONTH_IDS[hdrKey], valueDate, roundPct(g.hdrSum / g.hdrN));
        if (g.prN) pushMetric(metricValues, MONTH_IDS[prKey], valueDate, roundPct(g.prSum / g.prN));
      });

    var today = new Date().toISOString().slice(0, 10);
    if (yearHdr != null) pushMetric(metricValues, YEAR_IDS[hdrKey], today, roundPct(yearHdr));
    if (yearPr != null) pushMetric(metricValues, YEAR_IDS[prKey], today, roundPct(yearPr));

    if (!metricValues.length) errors.push('BREDSUM\\E: нет распознанных строк (' + (segment === 'heif' ? 'тёлки' : 'коровы') + ')');
    return metricValues;
  }

  /**
   * BREDSUM BY SID: SID; …; %Стел → CR по быкам за defaultMonth.
   */
  function parseBredsumBySid(rows, errors, defaultMonth) {
    var bullFertility = [];
    var ym = toYearMonth(defaultMonth) || new Date().toISOString().slice(0, 7);
    if (ym === 'year') ym = new Date().toISOString().slice(0, 7);

    var headers = rows[0] || [];
    var sidIdx = findHeaderIndex(headers, [
      function (h) {
        return h === 'sid' || h === 'sire' || h === 'bull';
      }
    ]);
    if (sidIdx < 0) sidIdx = 0;
    var crIdx = findHeaderIndex(headers, [
      function (h) {
        return h === '%стел' || h === '%conc' || h === 'cr' || h === '%cr' || h.indexOf('%стел') !== -1;
      }
    ]);
    // стандартный BREDSUM по быку: col0 SID, col2 %Стел
    if (crIdx < 0) crIdx = 2;

    for (var r = 1; r < rows.length; r++) {
      var row = rows[r];
      if (!row || !row.length) continue;
      var bull = cell(row, sidIdx).replace(/\s+/g, ' ').trim();
      if (!bull || isTotalRow(bull)) continue;
      var cr = parseNumCell(cell(row, crIdx));
      if (cr == null) continue;
      bullFertility.push({
        id: newId('bf_'),
        bullName: bull,
        periodMonth: ym,
        crPct: roundPct(cr),
        services: '',
        pregnant: ''
      });
    }
    if (!bullFertility.length) errors.push('BREDSUM BY SID: нет строк с CR по быкам');
    return bullFertility;
  }

  function parseRowsAuto(rows, fileName, errors, opts) {
    opts = opts || {};
    var segment = opts.segment || segmentFromFileName(fileName);
    var defaultMonth = opts.defaultMonth || '';
    var metricValues = [];
    var bullFertility = [];

    if (isBredsumE(rows)) {
      metricValues = parseBredsumE(rows, errors, segment);
      return { metricValues: metricValues, bullFertility: bullFertility, kind: 'bredsum_e' };
    }
    if (isBredsumBySid(rows) || /bredsum|by\s*sid|sid/i.test(fileName || '')) {
      if (!isBredsumBySid(rows) && mapHeaders(rows[0] || [], BULL_HEADER_ALIASES).bull != null) {
        bullFertility = parseBullRows(rows, errors);
      } else {
        bullFertility = parseBredsumBySid(rows, errors, defaultMonth);
      }
      return { metricValues: metricValues, bullFertility: bullFertility, kind: 'bredsum_sid' };
    }
    if (mapHeaders(rows[0] || [], BULL_HEADER_ALIASES).bull != null && mapHeaders(rows[0] || [], BULL_HEADER_ALIASES).cr != null) {
      bullFertility = parseBullRows(rows, errors);
      return { metricValues: metricValues, bullFertility: bullFertility, kind: 'template_bulls' };
    }
    metricValues = parseKpiRows(rows, errors);
    return { metricValues: metricValues, bullFertility: bullFertility, kind: 'template_kpi' };
  }

  function parseCsvString(csvString, fileName, opts) {
    var rows = parseCsvToRows(csvString);
    if (!rows) {
      return { ok: false, metricValues: [], bullFertility: [], errors: ['PapaParse не загружен'] };
    }
    var errors = [];
    var parsed = parseRowsAuto(rows, fileName || '', errors, opts || {});
    var ok = parsed.metricValues.length > 0 || parsed.bullFertility.length > 0;
    if (!ok && !errors.length) errors.push('Не удалось распознать CSV');
    return {
      ok: ok,
      metricValues: parsed.metricValues,
      bullFertility: parsed.bullFertility,
      errors: errors,
      kind: parsed.kind
    };
  }

  function detectSheetKind(name) {
    var n = normHeader(name);
    if (/bull|бык|sire|sid/.test(n)) return 'bulls';
    if (/kpi|показател|repro|воспроиз|metric/.test(n)) return 'kpi';
    return '';
  }

  function parseWorkbook(ab, fileName, opts) {
    var errors = [];
    if (typeof XLSX === 'undefined') {
      return { ok: false, metricValues: [], bullFertility: [], errors: ['SheetJS (XLSX) не загружен'] };
    }
    var wb = XLSX.read(ab, { type: 'array', raw: false });
    var metricValues = [];
    var bullFertility = [];
    var names = wb.SheetNames || [];
    names.forEach(function (name) {
      var rows = sheetToRows(wb.Sheets[name]);
      var parsed = parseRowsAuto(rows, name + ' ' + (fileName || ''), errors, opts || {});
      metricValues = metricValues.concat(parsed.metricValues);
      bullFertility = bullFertility.concat(parsed.bullFertility);
    });
    var ok = metricValues.length > 0 || bullFertility.length > 0;
    if (!ok && !errors.length) errors.push('В файле не найдено строк KPI или быков');
    return { ok: ok, metricValues: metricValues, bullFertility: bullFertility, errors: errors };
  }

  /**
   * @param {ArrayBuffer|string} payload
   * @param {{ fileName?: string, sourceId?: string, defaultMonth?: string, segment?: string }} [opts]
   */
  function parse(payload, opts) {
    opts = opts || {};
    var sourceId = opts.sourceId || 'generic_csv';
    if (sourceId === 'afifarm' || sourceId === 'uniform') {
      return {
        ok: false,
        metricValues: [],
        bullFertility: [],
        errors: ['Источник «' + sourceId + '» ещё не подключён']
      };
    }
    var fileName = String(opts.fileName || '');
    if (typeof payload === 'string') {
      return parseCsvString(payload, fileName, opts);
    }
    var ab = null;
    if (payload && typeof ArrayBuffer !== 'undefined' && payload instanceof ArrayBuffer) {
      ab = payload;
    } else if (payload && Object.prototype.toString.call(payload) === '[object ArrayBuffer]') {
      ab = payload;
    } else if (payload && typeof ArrayBuffer !== 'undefined' && ArrayBuffer.isView && ArrayBuffer.isView(payload)) {
      ab = payload.buffer.slice(payload.byteOffset, payload.byteOffset + payload.byteLength);
    }
    if (ab) {
      var lower = fileName.toLowerCase();
      if (lower.indexOf('.csv') !== -1 || lower.indexOf('.txt') !== -1 || !lower) {
        var text = decodeCsvBuffer(ab);
        // если это не csv (xlsx wrongly named) — fallback workbook
        if (text.charCodeAt(0) === 0x50 && text.charCodeAt(1) === 0x4b) {
          return parseWorkbook(ab, fileName, opts);
        }
        return parseCsvString(text, fileName, opts);
      }
      return parseWorkbook(ab, fileName, opts);
    }
    return { ok: false, metricValues: [], bullFertility: [], errors: ['Неподдерживаемый тип файла'] };
  }

  function latestMonthFromMetrics(metricValues) {
    var best = '';
    (metricValues || []).forEach(function (v) {
      if (!v || !v.valueDate) return;
      var ym = toYearMonthKey(v.valueDate);
      if (/^\d{4}-\d{2}$/.test(ym) && ym > best) best = ym;
    });
    return best;
  }

  function parseFile(file, opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      if (!file) {
        resolve({ ok: false, metricValues: [], bullFertility: [], errors: ['Файл не выбран'] });
        return;
      }
      var reader = new FileReader();
      reader.onload = function () {
        resolve(
          parse(reader.result, {
            fileName: file.name || '',
            sourceId: 'dc305',
            defaultMonth: opts.defaultMonth || '',
            segment: opts.segment || segmentFromFileName(file.name || '')
          })
        );
      };
      reader.onerror = function () {
        resolve({ ok: false, metricValues: [], bullFertility: [], errors: ['Не удалось прочитать файл'] });
      };
      reader.readAsArrayBuffer(file);
    });
  }

  /** Несколько файлов: сначала E/KPI, затем BY SID (месяц = последний из E или текущий). */
  function parseFiles(fileList) {
    var files = Array.prototype.slice.call(fileList || []).filter(Boolean);
    if (!files.length) {
      return Promise.resolve({ ok: false, metricValues: [], bullFertility: [], errors: ['Файлы не выбраны'] });
    }
    var sidFiles = [];
    var otherFiles = [];
    files.forEach(function (f) {
      var n = String(f.name || '').toLowerCase();
      if (/sid|бык|bull|bredsum\s*by/i.test(n) && !/^e\.csv$/i.test(n)) sidFiles.push(f);
      else otherFiles.push(f);
    });
    var chain = Promise.resolve({ ok: true, metricValues: [], bullFertility: [], errors: [] });
    otherFiles.forEach(function (f) {
      chain = chain.then(function (acc) {
        return parseFile(f).then(function (res) {
          acc.metricValues = acc.metricValues.concat(res.metricValues || []);
          acc.bullFertility = acc.bullFertility.concat(res.bullFertility || []);
          acc.errors = acc.errors.concat(res.errors || []);
          if (res.ok) acc.ok = true;
          return acc;
        });
      });
    });
    return chain.then(function (acc) {
      var defaultMonth = latestMonthFromMetrics(acc.metricValues) || new Date().toISOString().slice(0, 7);
      var sidChain = Promise.resolve(acc);
      sidFiles.forEach(function (f) {
        sidChain = sidChain.then(function (a) {
          return parseFile(f, { defaultMonth: defaultMonth }).then(function (res) {
            a.metricValues = a.metricValues.concat(res.metricValues || []);
            a.bullFertility = a.bullFertility.concat(res.bullFertility || []);
            a.errors = a.errors.concat(res.errors || []);
            if (res.ok) a.ok = true;
            return a;
          });
        });
      });
      return sidChain.then(function (finalAcc) {
        finalAcc.ok = finalAcc.metricValues.length > 0 || finalAcc.bullFertility.length > 0;
        if (!finalAcc.ok && !finalAcc.errors.length) finalAcc.errors.push('Нет данных для импорта');
        return finalAcc;
      });
    });
  }

  function toYearMonthKey(dateOrMonth) {
    var s = String(dateOrMonth || '').trim();
    if (/^\d{4}-\d{2}$/.test(s)) return s;
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 7);
    return s;
  }

  function applyParseResult(bundle, result) {
    var b = bundle && typeof bundle === 'object' ? bundle : {};
    if (!result || !result.ok) {
      return { bundle: b, applied: false, errors: (result && result.errors) || ['Нет данных для импорта'] };
    }
    if (!Array.isArray(b.metricValues)) b.metricValues = [];
    if (!Array.isArray(b.bullFertility)) b.bullFertility = [];
    if (!Array.isArray(b.items)) b.items = [];

    (result.metricValues || []).forEach(function (v) {
      if (!v || !v.metricId || !v.valueDate) return;
      var ym = toYearMonthKey(v.valueDate);
      var replaced = false;
      for (var i = 0; i < b.metricValues.length; i++) {
        var cur = b.metricValues[i];
        if (cur && cur.metricId === v.metricId && toYearMonthKey(cur.valueDate) === ym) {
          cur.valueText = v.valueText;
          cur.valueDate = v.valueDate;
          cur.source = 'manual';
          replaced = true;
          break;
        }
      }
      if (!replaced) b.metricValues.push(v);
    });

    (result.bullFertility || []).forEach(function (row) {
      if (!row || !row.bullName || !row.periodMonth) return;
      var name = String(row.bullName).trim();
      var ym = toYearMonthKey(row.periodMonth);
      var replaced = false;
      for (var j = 0; j < b.bullFertility.length; j++) {
        var br = b.bullFertility[j];
        if (
          br &&
          String(br.bullName || '').trim() === name &&
          toYearMonthKey(br.periodMonth) === ym
        ) {
          br.crPct = row.crPct;
          br.periodMonth = ym;
          replaced = true;
          break;
        }
      }
      if (!replaced) {
        b.bullFertility.push({
          id: row.id || newId('bf_'),
          bullName: name,
          periodMonth: ym,
          crPct: row.crPct != null ? String(row.crPct) : '',
          services: row.services != null ? String(row.services) : '',
          pregnant: row.pregnant != null ? String(row.pregnant) : ''
        });
      }
    });

    (result.items || []).forEach(function (it) {
      b.items.push(it);
    });

    return { bundle: b, applied: true, errors: result.errors || [] };
  }

  function buildTemplateWorkbook() {
    if (typeof XLSX === 'undefined') return null;
    var wb = XLSX.utils.book_new();
    var kpi = [
      ['month', 'cows_cr', 'cows_hdr', 'cows_pr', 'heif_cr', 'heif_hdr', 'heif_pr'],
      ['2026-07', '42', '58', '24', '45', '60', '27'],
      ['year', '41', '57', '23', '44', '59', '26']
    ];
    var bulls = [
      ['month', 'bull', 'cr'],
      ['2026-07', 'H16479', '38'],
      ['2026-07', 'H16172', '41']
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(kpi), 'kpi');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(bulls), 'bulls');
    return wb;
  }

  function downloadTemplate() {
    var wb = buildTemplateWorkbook();
    if (wb && typeof XLSX !== 'undefined' && XLSX.writeFile) {
      XLSX.writeFile(wb, 'cattle-tracker-kpi-template.xlsx');
      return true;
    }
    var kpiCsv =
      'month;cows_cr;cows_hdr;cows_pr;heif_cr;heif_hdr;heif_pr\n' +
      '2026-07;42;58;24;45;60;27\n' +
      'year;41;57;23;44;59;26\n';
    var blob = new Blob(['\uFEFF' + kpiCsv], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'cattle-tracker-kpi-template.csv';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 500);
    return true;
  }

  function showStub() {
    if (typeof global.showToast === 'function') {
      global.showToast('Импорт KPI: BREDSUM\\E, BREDSUM BY SID или шаблон — на вкладке Показатели', 'info');
    }
  }

  var api = {
    SUPPORTED_SOURCES: SUPPORTED_SOURCES,
    parse: parse,
    parseFile: parseFile,
    parseFiles: parseFiles,
    applyParseResult: applyParseResult,
    downloadTemplate: downloadTemplate,
    buildTemplateWorkbook: buildTemplateWorkbook,
    showStub: showStub
  };

  global.CattleTrackerHerdImport = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
export {};
