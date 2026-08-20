/** __analytics part 2 */
(function () {
  'use strict';
  var root = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this);
  var NS = root['__analytics'] = root['__analytics'] || {};
  var global = typeof window !== 'undefined' ? window : this;

  function escapeHtml(text) {
    var s = String(text == null ? '' : text);
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function initAnalytics() {
    var settings = globalThis['__analytics'].getAnalyticsSettings();
    globalThis['__analytics'].applySettingsToUI(settings);

    var periodSelect = document.getElementById('analyticsPeriod');
    var customDates = document.getElementById('analyticsCustomDates');
    if (periodSelect) {
      periodSelect.addEventListener('change', function () {
        var isCustom = periodSelect.value === 'custom';
        if (customDates) customDates.style.display = isCustom ? 'inline-flex' : 'none';
        if (!isCustom) globalThis['__analytics'].updatePeriodDatesFromPreset(periodSelect.value);
        globalThis['__analytics'].renderAnalyticsScreen();
      });
    }
    var dateFromEl = document.getElementById('analyticsDateFrom');
    var dateToEl = document.getElementById('analyticsDateTo');
    if (dateFromEl) dateFromEl.addEventListener('change', renderAnalyticsScreen);
    if (dateToEl) dateToEl.addEventListener('change', renderAnalyticsScreen);
    var pdoEl = document.getElementById('analyticsPdo');
    if (pdoEl) pdoEl.addEventListener('change', renderAnalyticsScreen);
    var breakdownEl = document.getElementById('analyticsBreakdown');
    if (breakdownEl) breakdownEl.addEventListener('change', renderAnalyticsScreen);

    var refreshBtn = document.getElementById('analyticsRefreshBtn');
    if (refreshBtn) refreshBtn.addEventListener('click', renderAnalyticsScreen);
  }

  /** Интервалы между ИО для интервального анализа: подписи и границы (дни) */
  var INTERVAL_BUCKETS = [
    { label: '1-3 дня', min: 1, max: 3 },
    { label: '4-17 дней', min: 4, max: 17 },
    { label: '18-24 дня', min: 18, max: 24 },
    { label: '25-35 дней', min: 25, max: 35 },
    { label: '36-48 дней', min: 36, max: 48 },
    { label: '> 48 дней', min: 49, max: null }
  ];

  var intervalAnalysisFilter = { lactation: null };

  /**
   * Собирает статистику по интервалам между осеменениями (по всем животным, внутри лактации).
   * В анализ не включаются животные с одной попыткой осеменения (только попытка 1).
   * «Нет данных» — для осеменений с попыткой 2 и более, у которых нет предыдущего осеменения в той же лактации для расчёта интервала.
   * Фильтр по лактации: '' = все, '0' = тёлки, '1' = первотелки, '2+' = 2 и более, '1+2+' = лактирующие (1 и 2+).
   * @param {{ lactation: string|null }} [filter] — lactation: null/'' = все, '0', '1', '2+', '1+2+'
   * @returns {{ buckets: Array<{label: string, count: number}>, noDataCount: number, total: number }}
   */
  function getIntervalAnalysisData(filter) {
    var counts = {};
    INTERVAL_BUCKETS.forEach(function (b) { counts[b.label] = 0; });
    var noDataCount = 0;
    var list = (typeof window !== 'undefined' && window.entries && Array.isArray(window.entries)) ? window.entries : [];
    var filterLact = filter && filter.lactation !== undefined && filter.lactation !== null && filter.lactation !== '' ? String(filter.lactation) : '';
    var getList = (typeof window.getInseminationListForEntry === 'function') ? window.getInseminationListForEntry : function () { return []; };
    for (var i = 0; i < list.length; i++) {
      var entry = list[i];
      if (filterLact !== '') {
        var entryLact = entry.lactation === undefined || entry.lactation === null || entry.lactation === '' ? null : parseInt(entry.lactation, 10);
        if (entryLact === null || isNaN(entryLact)) continue;
        if (filterLact === '0' && entryLact !== 0) continue;
        if (filterLact === '1' && entryLact !== 1) continue;
        if (filterLact === '2+' && entryLact < 2) continue;
        if (filterLact === '1+2+' && entryLact < 1) continue;
      }
      var rows = getList(entry);
      if (rows.length < 2) continue;
      for (var j = 0; j < rows.length; j++) {
        var val = rows[j].daysFromPrevious;
        if (val === '—' || val === undefined || val === null || val === '') {
          noDataCount++;
          continue;
        }
        var num = parseInt(val, 10);
        if (isNaN(num)) {
          noDataCount++;
          continue;
        }
        var found = false;
        for (var k = 0; k < INTERVAL_BUCKETS.length; k++) {
          var b = INTERVAL_BUCKETS[k];
          if (b.max !== null && num >= b.min && num <= b.max) {
            counts[b.label]++;
            found = true;
            break;
          }
          if (b.max === null && num >= b.min) {
            counts[b.label]++;
            found = true;
            break;
          }
        }
        if (!found) noDataCount++;
      }
    }
    var total = noDataCount;
    INTERVAL_BUCKETS.forEach(function (b) { total += counts[b.label]; });
    return {
      buckets: INTERVAL_BUCKETS.map(function (b) { return { label: b.label, count: counts[b.label] }; }),
      noDataCount: noDataCount,
      total: total
    };
  }

  function renderIntervalAnalysisFilterUI() {
    var container = document.getElementById('intervalAnalysisFilter');
    if (!container) return;
    var lactVal = intervalAnalysisFilter.lactation !== null && intervalAnalysisFilter.lactation !== '' ? String(intervalAnalysisFilter.lactation) : '';
    var options = '<option value="">Все лактации</option>' +
      '<option value="0"' + (lactVal === '0' ? ' selected' : '') + '>0 (тёлки)</option>' +
      '<option value="1"' + (lactVal === '1' ? ' selected' : '') + '>1 (первотелки)</option>' +
      '<option value="2+"' + (lactVal === '2+' ? ' selected' : '') + '>2+ (коровы)</option>' +
      '<option value="1+2+"' + (lactVal === '1+2+' ? ' selected' : '') + '>1 + 2+ (лактирующие)</option>';
    container.innerHTML =
      '<div class="search-filter-bar analytics-interval-filter-bar">' +
        '<div class="filter-row">' +
          '<span class="filter-label">Лактация:</span>' +
          '<select id="intervalAnalysisLactation" class="analytics-interval-select" aria-label="Фильтр по лактации">' + options + '</select>' +
        '</div>' +
      '</div>';
    var selectEl = document.getElementById('intervalAnalysisLactation');
    if (selectEl) {
      selectEl.addEventListener('change', function () {
        var v = selectEl.value;
        intervalAnalysisFilter.lactation = (v === '' || v === null) ? null : v;
        renderIntervalAnalysisScreen();
      });
    }
  }

  function renderIntervalAnalysisScreen() {
    var filterContainer = document.getElementById('intervalAnalysisFilter');
    if (filterContainer && !filterContainer.dataset.rendered) {
      filterContainer.dataset.rendered = '1';
      renderIntervalAnalysisFilterUI();
    }
    var container = document.getElementById('intervalAnalysisTable');
    if (!container) return;
    var data = getIntervalAnalysisData(intervalAnalysisFilter);
    var total = data.total;
    var rows = data.buckets.map(function (b) {
      var pct = total > 0 ? Math.round((b.count / total) * 100) : 0;
      return '<tr><td>' + escapeHtml(b.label) + '</td><td>' + b.count + '</td><td>' + pct + '%</td></tr>';
    });
    var noDataPct = total > 0 ? Math.round((data.noDataCount / total) * 100) : 0;
    rows.push('<tr><td>Нет данных</td><td>' + data.noDataCount + '</td><td>' + noDataPct + '%</td></tr>');
    var totalPct = total > 0 ? 100 : 0;
    rows.push('<tr class="analytics-interval-total"><td>Всего</td><td>' + total + '</td><td>' + totalPct + '%</td></tr>');
    container.innerHTML =
      '<table class="analytics-interval-table">' +
      '<thead><tr><th>Интервал между ИО</th><th>Количество, шт</th><th>Процент, %</th></tr></thead>' +
      '<tbody>' + rows.join('') + '</tbody></table>';
  }

  /** Воспроизводство: оплодотворяемость за период. Фильтры: попытка, бык, лактация. */
  var reproductionFilter = {
    period: 'month',
    dateFrom: '',
    dateTo: '',
    attemptNumber: '',
    bull: '',
    lactation: ''
  };

  function parseDateRepr(str) {
    if (!str) return null;
    var d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
  }

  /** Проверяет, привело ли осеменение на дату insemDate к стельности (УЗИ «Стельная» после этой даты, либо статус «Стельная» для последнего осеменения). */
  function inseminationResultedInPregnancy(entry, insemDateStr) {
    var insemD = parseDateRepr(insemDateStr);
    if (!insemD) return false;

    var statusStr = (entry && entry.status != null) ? String(entry.status) : '';
    if (statusStr.indexOf('Стельная') !== -1) {
      var lastInsemTime = null;
      var lastInsemRaw = null;
      var insemList0 = entry && entry.inseminationHistory && entry.inseminationHistory.length > 0
        ? entry.inseminationHistory
        : (entry && entry.inseminationDate ? [{ date: entry.inseminationDate }] : []);
      for (var k = 0; k < insemList0.length; k++) {
        var rec0 = insemList0[k];
        var dd0 = parseDateRepr(rec0 && rec0.date);
        if (!dd0) continue;
        var t0 = dd0.getTime();
        if (lastInsemTime === null || t0 > lastInsemTime) {
          lastInsemTime = t0;
          lastInsemRaw = rec0.date;
        }
      }
      if (lastInsemTime !== null) {
        var lastD = parseDateRepr(lastInsemRaw);
        if (lastD && lastD.getTime() === insemD.getTime()) return true;
      }
    }

    var uziHistory = entry.uziHistory || [];
    if (uziHistory.length === 0) return false;
    var afterInsem = uziHistory.filter(function (u) {
      var ud = parseDateRepr(u.date);
      return ud && ud > insemD;
    });
    afterInsem.sort(function (a, b) {
      var da = parseDateRepr(a.date);
      var db = parseDateRepr(b.date);
      return (da && db) ? (da < db ? -1 : da > db ? 1 : 0) : 0;
    });
    var firstUziAfter = afterInsem[0];
    if (!firstUziAfter) return false;
    var r = (firstUziAfter.result || '').toString().trim();
    return r.indexOf('Стельная') !== -1 || r === 'Стел';
  }

  function hasLaterInsemination(entry, insemDateStr) {
    var list = entry && entry.inseminationHistory && entry.inseminationHistory.length > 0
      ? entry.inseminationHistory
      : (entry && entry.inseminationDate ? [{ date: entry.inseminationDate }] : []);
    var d0 = parseDateRepr(insemDateStr);
    if (!d0 || list.length === 0) return false;
    for (var i = 0; i < list.length; i++) {
      var rec = list[i];
      var d = parseDateRepr(rec && rec.date);
      if (d && d > d0) return true;
    }
    return false;
  }

  function isConfirmedInsemination(entry, insemDateStr, boundsEnd) {
    if (inseminationResultedInPregnancy(entry, insemDateStr)) return true;
    if (hasLaterInsemination(entry, insemDateStr)) return true;
    var d0 = parseDateRepr(insemDateStr);
    var ref = boundsEnd || new Date();
    if (d0) {
      var a = new Date(d0.getFullYear(), d0.getMonth(), d0.getDate());
      var b = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
      var diffDays = Math.round((b - a) / (24 * 60 * 60 * 1000));
      if (diffDays >= 40) return true;
    }
    return false;
  }

  /** Собирает все осеменения в периоде с учётом фильтров. Возвращает { events: [{ entry, date, attemptNumber, bull, lactation }], pregnantCount, unconfirmedAnimalsCount }. */
  function getReproductionData(period, dateFrom, dateTo, filters) {
    var bounds = window.getPeriodBounds(period, dateFrom, dateTo);
    var list = (typeof window !== 'undefined' && window.entries && Array.isArray(window.entries)) ? window.entries : [];
    if (window.isBrak) list = list.filter(function (e) { return !window.isBrak(e); });
    var events = [];
    var attemptFilter = (filters && filters.attemptNumber !== undefined && filters.attemptNumber !== '') ? String(filters.attemptNumber) : '';
    var bullFilter = (filters && filters.bull !== undefined && filters.bull !== '') ? String(filters.bull).trim().toLowerCase() : '';
    var lactFilter = (filters && filters.lactation !== undefined && filters.lactation !== '') ? String(filters.lactation) : '';
    for (var i = 0; i < list.length; i++) {
      var entry = list[i];
      var lact = entry.lactation === undefined || entry.lactation === null || entry.lactation === '' ? null : parseInt(entry.lactation, 10);
      if (lactFilter !== '') {
        if (lact === null || isNaN(lact)) continue;
        if (lactFilter === '0' && lact !== 0) continue;
        if (lactFilter === '1' && lact !== 1) continue;
        if (lactFilter === '2+' && lact < 2) continue;
        if (lactFilter === '1+2+' && lact < 1) continue;
      }
      var insemList = entry.inseminationHistory && entry.inseminationHistory.length > 0
        ? entry.inseminationHistory.slice()
        : (entry.inseminationDate ? [{ date: entry.inseminationDate, attemptNumber: entry.attemptNumber != null ? entry.attemptNumber : 1, bull: entry.bull || '' }] : []);
      for (var j = 0; j < insemList.length; j++) {
        var rec = insemList[j];
        var d = parseDateRepr(rec.date);
        if (!d || d < bounds.start || d > bounds.end) continue;
        var attemptNum = rec.attemptNumber !== undefined && rec.attemptNumber !== null ? Number(rec.attemptNumber) : 1;
        if (attemptFilter !== '' && String(attemptNum) !== attemptFilter) continue;
        var bullVal = (rec.bull || '').toString().trim();
        if (bullFilter !== '' && bullVal.toLowerCase().indexOf(bullFilter) === -1) continue;
        events.push({ entry: entry, date: rec.date, attemptNumber: attemptNum, bull: bullVal, lactation: lact });
      }
    }
    var animalsUnconfirmed = {};
    var getKey = function (ev) {
      var e = ev.entry || {};
      if (e.cattleId != null && e.cattleId !== '') return String(e.cattleId);
      return String(list.indexOf(e));
    };
    events.forEach(function (ev) {
      var key = getKey(ev);
      if (!isConfirmedInsemination(ev.entry, ev.date, bounds.end)) animalsUnconfirmed[key] = true;
    });
    var filteredEvents = events.filter(function (ev) {
      var key = getKey(ev);
      return !animalsUnconfirmed[key];
    });
    var pregnantCount = 0;
    filteredEvents.forEach(function (ev) {
      if (inseminationResultedInPregnancy(ev.entry, ev.date)) pregnantCount++;
    });
    var totalInseminations = filteredEvents.length;
    var unconfirmedAnimalsCount = Object.keys(animalsUnconfirmed).length;
    return {
      totalInseminations: totalInseminations,
      pregnantCount: pregnantCount,
      percent: totalInseminations > 0 ? Math.round((pregnantCount / totalInseminations) * 1000) / 10 : 0,
      unconfirmedAnimalsCount: unconfirmedAnimalsCount
    };
  }


  // register functions
  NS.escapeHtml = escapeHtml;
  NS.initAnalytics = initAnalytics;
  NS.getIntervalAnalysisData = getIntervalAnalysisData;
  NS.renderIntervalAnalysisFilterUI = renderIntervalAnalysisFilterUI;
  NS.renderIntervalAnalysisScreen = renderIntervalAnalysisScreen;
  NS.parseDateRepr = parseDateRepr;
  NS.inseminationResultedInPregnancy = inseminationResultedInPregnancy;
  NS.hasLaterInsemination = hasLaterInsemination;
  NS.isConfirmedInsemination = isConfirmedInsemination;
  NS.getReproductionData = getReproductionData;
})();
export {};
