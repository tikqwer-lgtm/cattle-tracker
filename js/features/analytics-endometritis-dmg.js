/**
 * analytics-endometritis-dmg.js — расчёт «Эндометрит ДМГ» по загруженному Excel (.xlsx)
 * Работает только с файлом, не использует entries/БД.
 *
 * Ожидаемые колонки (точные заголовки):
 * - Номер животного
 * - Событие
 * - День лактации события
 */
(function (global) {
  'use strict';

  function escapeHtml(text) {
    var s = String(text == null ? '' : text);
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function normalizeEventType(raw) {
    var s = String(raw == null ? '' : raw).trim().toLowerCase();
    if (!s) return null;
    // допускаем: "Стел", "стел", "Стельная" и т.п.
    if (s.indexOf('стел') !== -1) return 'stel';
    if (s.indexOf('эндом') !== -1) return 'endom';
    if (s.indexOf('осемен') !== -1) return 'insemen';
    return null;
  }

  function parseDim(raw) {
    if (raw === null || raw === undefined) return null;
    if (typeof raw === 'number' && isFinite(raw)) return Math.round(raw);
    var s = String(raw).trim();
    if (!s) return null;
    var n = parseInt(s, 10);
    return isNaN(n) ? null : n;
  }

  function quantile(sortedNums, q) {
    if (!sortedNums || sortedNums.length === 0) return null;
    if (q <= 0) return sortedNums[0];
    if (q >= 1) return sortedNums[sortedNums.length - 1];
    var pos = (sortedNums.length - 1) * q;
    var base = Math.floor(pos);
    var rest = pos - base;
    var a = sortedNums[base];
    var b = sortedNums[base + 1] != null ? sortedNums[base + 1] : a;
    return a + (b - a) * rest;
  }

  function mean(nums) {
    if (!nums || nums.length === 0) return null;
    var sum = 0;
    for (var i = 0; i < nums.length; i++) sum += nums[i];
    return sum / nums.length;
  }

  function computeStats(dims) {
    var nums = (dims || []).filter(function (x) { return typeof x === 'number' && isFinite(x); }).slice();
    nums.sort(function (a, b) { return a - b; });
    if (nums.length === 0) {
      return { n: 0, mean: null, median: null, p25: null, p75: null };
    }
    return {
      n: nums.length,
      mean: mean(nums),
      median: quantile(nums, 0.5),
      p25: quantile(nums, 0.25),
      p75: quantile(nums, 0.75)
    };
  }

  function round1(x) {
    if (x === null || x === undefined) return null;
    return Math.round(x * 10) / 10;
  }

  function readXlsxFirstSheetToRows(file) {
    return new Promise(function (resolve, reject) {
      if (!file) return reject(new Error('Файл не выбран'));
      if (typeof global.FileReader === 'undefined') return reject(new Error('FileReader недоступен'));
      if (typeof global.XLSX === 'undefined') return reject(new Error('XLSX не загружен'));
      var reader = new FileReader();
      reader.onerror = function () { reject(new Error('Не удалось прочитать файл')); };
      reader.onload = function (e) {
        try {
          var data = e && e.target ? e.target.result : null;
          var wb = global.XLSX.read(data, { type: 'array' });
          var sheetName = wb.SheetNames && wb.SheetNames[0];
          if (!sheetName) return reject(new Error('В книге нет листов'));
          var ws = wb.Sheets[sheetName];
          var rows = global.XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' });
          resolve(rows || []);
        } catch (err) {
          reject(err);
        }
      };
      reader.readAsArrayBuffer(file);
    });
  }

  function findHeaderIndexes(headerRow) {
    var idxCattle = -1, idxEvent = -1, idxDim = -1;
    for (var i = 0; i < headerRow.length; i++) {
      var h = String(headerRow[i] == null ? '' : headerRow[i]).trim().toLowerCase();
      if (!h) continue;
      if (h === 'номер животного') idxCattle = i;
      else if (h === 'событие') idxEvent = i;
      else if (h === 'день лактации события') idxDim = i;
    }
    return { idxCattle: idxCattle, idxEvent: idxEvent, idxDim: idxDim };
  }

  function buildCattleMapFromRows(rows) {
    if (!rows || rows.length < 2) {
      return { ok: false, message: 'Файл пустой или нет данных', byId: {}, meta: null };
    }
    var header = rows[0] || [];
    var idx = findHeaderIndexes(header);
    if (idx.idxCattle === -1 || idx.idxEvent === -1 || idx.idxDim === -1) {
      return {
        ok: false,
        message: 'Не найдены нужные колонки. Нужны: «Номер животного», «Событие», «День лактации события».',
        byId: {},
        meta: { idx: idx }
      };
    }
    var byId = {};
    var ignoredRows = 0;
    var invalidDimRows = 0;
    var totalRows = 0;
    for (var r = 1; r < rows.length; r++) {
      var row = rows[r];
      if (!row || !Array.isArray(row)) continue;
      var cattleId = String(row[idx.idxCattle] == null ? '' : row[idx.idxCattle]).trim();
      if (!cattleId) continue;
      var evRaw = row[idx.idxEvent];
      var type = normalizeEventType(evRaw);
      if (!type) { ignoredRows++; continue; }
      var dim = parseDim(row[idx.idxDim]);
      if (dim === null) { invalidDimRows++; continue; }
      totalRows++;
      if (!byId[cattleId]) {
        byId[cattleId] = { cattleId: cattleId, stelDim: null, hasInsemen: false, endomDims: [] };
      }
      var rec = byId[cattleId];
      if (type === 'stel') {
        if (rec.stelDim === null || dim < rec.stelDim) rec.stelDim = dim;
      } else if (type === 'insemen') {
        rec.hasInsemen = true;
      } else if (type === 'endom') {
        rec.endomDims.push(dim);
      }
    }
    return {
      ok: true,
      message: '',
      byId: byId,
      meta: { totalRows: totalRows, ignoredRows: ignoredRows, invalidDimRows: invalidDimRows }
    };
  }

  function calculateEndometritisDmgFromMap(byId) {
    var dimsEndom21_27 = [];
    var dimsControlA = [];
    var dimsControlC = [];
    var onlyInsemenCount = 0;
    var withoutStelAndInsemen = 0;
    var totalAnimalsInFile = 0;
    var animalsWithStel = 0;
    Object.keys(byId || {}).forEach(function (id) {
      totalAnimalsInFile++;
      var rec = byId[id];
      var stelDim = rec && rec.stelDim != null ? rec.stelDim : null;
      var hasInsemen = !!(rec && rec.hasInsemen);
      var endomDims = rec && Array.isArray(rec.endomDims) ? rec.endomDims : [];
      if (stelDim == null) {
        if (hasInsemen) onlyInsemenCount++;
        else withoutStelAndInsemen++;
        return;
      }
      animalsWithStel++;
      var hasEndom21_27 = endomDims.some(function (d) { return d >= 21 && d <= 27; });
      var hasEndomEver = endomDims.length > 0;
      var hasEndom21Plus = endomDims.some(function (d) { return d >= 21; });

      if (hasEndom21_27) dimsEndom21_27.push(stelDim);
      if (!hasEndomEver) dimsControlA.push(stelDim);
      if (!hasEndom21Plus) dimsControlC.push(stelDim);
    });

    return {
      groups: {
        endom21_27: computeStats(dimsEndom21_27),
        controlA: computeStats(dimsControlA),
        controlC: computeStats(dimsControlC)
      },
      counts: {
        totalAnimalsInFile: totalAnimalsInFile,
        animalsWithStel: animalsWithStel,
        onlyInsemenCount: onlyInsemenCount,
        withoutStelAndInsemen: withoutStelAndInsemen
      }
    };
  }

  function renderResults(container, result) {
    if (!container) return;
    if (!result) { container.innerHTML = ''; return; }
    var g = result.groups || {};
    var c = result.counts || {};
    function fmt(x) { return x == null ? '—' : String(round1(x)); }
    function row(label, s) {
      return '<tr>' +
        '<td>' + escapeHtml(label) + '</td>' +
        '<td>' + (s && s.n ? String(s.n) : '0') + '</td>' +
        '<td>' + fmt(s ? s.mean : null) + '</td>' +
        '<td>' + fmt(s ? s.median : null) + '</td>' +
        '<td>' + fmt(s ? s.p25 : null) + '</td>' +
        '<td>' + fmt(s ? s.p75 : null) + '</td>' +
      '</tr>';
    }
    var html = '';
    html += '<div style="color:#666; margin-bottom:8px;">' +
      'Животных в файле: <strong>' + (c.totalAnimalsInFile || 0) + '</strong>' +
      ' • Со «Стел»: <strong>' + (c.animalsWithStel || 0) + '</strong>' +
      ' • Только «Осемен» (исключены): <strong>' + (c.onlyInsemenCount || 0) + '</strong>' +
      '</div>';
    html += '<table class="analytics-breakdown-table">' +
      '<thead><tr><th>Группа</th><th>N</th><th>Средний DIM</th><th>Медиана DIM</th><th>P25</th><th>P75</th></tr></thead>' +
      '<tbody>' +
        row('Эндом 21–27', g.endom21_27) +
        row('Без эндом (никогда)', g.controlA) +
        row('Без эндом (DIM ≥ 21)', g.controlC) +
      '</tbody></table>';
    container.innerHTML = html;
  }

  function setStatus(text, kind) {
    var el = document.getElementById('endometritisDmgStatus');
    if (!el) return;
    el.textContent = text || '';
    el.style.color = kind === 'error' ? '#b00020' : '#666';
  }

  function bindUIOnce() {
    var fileEl = document.getElementById('endometritisDmgFile');
    var btnEl = document.getElementById('endometritisDmgCalcBtn');
    var outEl = document.getElementById('endometritisDmgResults');
    if (!fileEl || !btnEl || !outEl) return;
    if (btnEl.dataset.bound) return;
    btnEl.dataset.bound = '1';

    function calc() {
      var file = fileEl.files && fileEl.files[0];
      if (!file) {
        setStatus('Выберите файл .xlsx', 'error');
        renderResults(outEl, null);
        return;
      }
      setStatus('Чтение файла…', 'info');
      readXlsxFirstSheetToRows(file).then(function (rows) {
        var parsed = buildCattleMapFromRows(rows);
        if (!parsed.ok) {
          setStatus(parsed.message || 'Ошибка импорта', 'error');
          renderResults(outEl, null);
          return;
        }
        var result = calculateEndometritisDmgFromMap(parsed.byId);
        renderResults(outEl, result);
        var meta = parsed.meta || {};
        var msg = 'Готово';
        if (meta.totalRows != null) {
          msg += ' • строк учтено: ' + meta.totalRows;
          if (meta.ignoredRows) msg += ' • игнор: ' + meta.ignoredRows;
          if (meta.invalidDimRows) msg += ' • DIM пуст/ошибка: ' + meta.invalidDimRows;
        }
        setStatus(msg, 'info');
      }).catch(function (err) {
        setStatus((err && err.message) ? err.message : 'Ошибка чтения файла', 'error');
        renderResults(outEl, null);
      });
    }

    btnEl.addEventListener('click', calc);
  }

  function init() {
    bindUIOnce();
    // на случай, если экран аналитики создаётся/меняется динамически
    if (global.CattleTrackerEvents && typeof global.CattleTrackerEvents.on === 'function') {
      global.CattleTrackerEvents.on('navigation:changed', bindUIOnce);
      global.CattleTrackerEvents.on('screen:changed', bindUIOnce);
    }
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
  }

  global.calculateEndometritisDmgFromXlsxRows = function (rows) {
    var parsed = buildCattleMapFromRows(rows);
    if (!parsed.ok) return { ok: false, message: parsed.message || 'Ошибка', result: null };
    return { ok: true, message: '', result: calculateEndometritisDmgFromMap(parsed.byId), meta: parsed.meta || null };
  };
})(typeof window !== 'undefined' ? window : this);

