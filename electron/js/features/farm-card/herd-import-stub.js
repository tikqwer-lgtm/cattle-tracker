/**
 * Импорт KPI карточки хозяйства из CSV/Excel-шаблона (DC305 → ручной перенос в шаблон).
 * Листы/файлы: kpi (месяц + CR/HDR/PR) и bulls (месяц + бык + CR).
 */
(function (global) {
  'use strict';

  var SUPPORTED_SOURCES = [
    { id: 'dc305', label: 'DairyComp 305 (шаблон KPI)', status: 'ready' },
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

  function parseCsvString(csvString) {
    if (typeof Papa === 'undefined') {
      return { ok: false, metricValues: [], bullFertility: [], errors: ['PapaParse не загружен'] };
    }
    var delim = csvString.indexOf(';') !== -1 ? ';' : ',';
    var parsed = Papa.parse(csvString, {
      header: false,
      skipEmptyLines: true,
      delimiter: delim
    });
    var rows = parsed.data || [];
    var errors = [];
    var metricValues = parseKpiRows(rows, errors);
    return {
      ok: metricValues.length > 0 || errors.length === 0,
      metricValues: metricValues,
      bullFertility: [],
      errors: errors,
      _hint: 'CSV без имени листа: распознан как kpi. Для быков используйте Excel с листом bulls или отдельный CSV bulls.'
    };
  }

  function detectSheetKind(name) {
    var n = normHeader(name);
    if (/bull|бык|sire/.test(n)) return 'bulls';
    if (/kpi|показател|repro|воспроиз|metric/.test(n)) return 'kpi';
    return '';
  }

  function parseWorkbook(ab) {
    var errors = [];
    if (typeof XLSX === 'undefined') {
      return { ok: false, metricValues: [], bullFertility: [], errors: ['SheetJS (XLSX) не загружен'] };
    }
    var wb = XLSX.read(ab, { type: 'array', raw: false });
    var metricValues = [];
    var bullFertility = [];
    var names = wb.SheetNames || [];
    var kpiDone = false;
    var bullsDone = false;
    names.forEach(function (name) {
      var kind = detectSheetKind(name);
      var rows = sheetToRows(wb.Sheets[name]);
      if (kind === 'bulls' || (!bullsDone && !kind && names.length === 1 && mapHeaders(rows[0] || [], BULL_HEADER_ALIASES).bull != null)) {
        var b = parseBullRows(rows, errors);
        bullFertility = bullFertility.concat(b);
        bullsDone = true;
        return;
      }
      if (kind === 'kpi' || (!kpiDone && (kind === '' || kind === 'kpi'))) {
        if (mapHeaders(rows[0] || [], KPI_HEADER_ALIASES).month != null && mapHeaders(rows[0] || [], KPI_HEADER_ALIASES).cows_cr != null) {
          metricValues = metricValues.concat(parseKpiRows(rows, errors));
          kpiDone = true;
          return;
        }
        if (mapHeaders(rows[0] || [], BULL_HEADER_ALIASES).bull != null) {
          bullFertility = bullFertility.concat(parseBullRows(rows, errors));
          bullsDone = true;
        } else if (!kpiDone) {
          metricValues = metricValues.concat(parseKpiRows(rows, errors));
          kpiDone = true;
        }
      }
    });
    if (!kpiDone && !bullsDone && names.length) {
      var rows0 = sheetToRows(wb.Sheets[names[0]]);
      if (mapHeaders(rows0[0] || [], BULL_HEADER_ALIASES).bull != null) {
        bullFertility = parseBullRows(rows0, errors);
      } else {
        metricValues = parseKpiRows(rows0, errors);
      }
    }
    var ok = metricValues.length > 0 || bullFertility.length > 0;
    if (!ok && !errors.length) errors.push('В файле не найдено строк KPI или быков');
    return { ok: ok, metricValues: metricValues, bullFertility: bullFertility, errors: errors };
  }

  /**
   * @param {ArrayBuffer|string} payload
   * @param {{ fileName?: string, sourceId?: string }} [opts]
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
    var fileName = String(opts.fileName || '').toLowerCase();
    if (typeof payload === 'string') {
      var csvRes = parseCsvString(payload);
      if (/bull|бык/.test(fileName)) {
        var errB = [];
        var delim = payload.indexOf(';') !== -1 ? ';' : ',';
        var parsedB = Papa.parse(payload, { header: false, skipEmptyLines: true, delimiter: delim });
        return {
          ok: true,
          metricValues: [],
          bullFertility: parseBullRows(parsedB.data || [], errB),
          errors: errB
        };
      }
      return csvRes;
    }
    if (payload && payload instanceof ArrayBuffer) {
      if (fileName.indexOf('.csv') !== -1) {
        var text = '';
        try {
          text = new TextDecoder('utf-8').decode(payload);
        } catch (e) {
          text = String.fromCharCode.apply(null, new Uint8Array(payload));
        }
        if (/bull|бык/.test(fileName)) {
          var errC = [];
          var delimC = text.indexOf(';') !== -1 ? ';' : ',';
          var parsedC = Papa.parse(text, { header: false, skipEmptyLines: true, delimiter: delimC });
          var bulls = parseBullRows(parsedC.data || [], errC);
          return {
            ok: bulls.length > 0 || errC.length === 0,
            metricValues: [],
            bullFertility: bulls,
            errors: errC
          };
        }
        return parseCsvString(text);
      }
      return parseWorkbook(payload);
    }
    return { ok: false, metricValues: [], bullFertility: [], errors: ['Неподдерживаемый тип файла'] };
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
      global.showToast('Используйте «Скачать шаблон» и «Импорт KPI» на вкладке Показатели', 'info');
    }
  }

  function parseFile(file) {
    return new Promise(function (resolve) {
      if (!file) {
        resolve({ ok: false, metricValues: [], bullFertility: [], errors: ['Файл не выбран'] });
        return;
      }
      var reader = new FileReader();
      reader.onload = function () {
        var ab = reader.result;
        resolve(parse(ab, { fileName: file.name || '', sourceId: 'generic_csv' }));
      };
      reader.onerror = function () {
        resolve({ ok: false, metricValues: [], bullFertility: [], errors: ['Не удалось прочитать файл'] });
      };
      reader.readAsArrayBuffer(file);
    });
  }

  var api = {
    SUPPORTED_SOURCES: SUPPORTED_SOURCES,
    parse: parse,
    parseFile: parseFile,
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
