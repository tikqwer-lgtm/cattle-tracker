/**
 * analytics.js — Аналитика и отчёты (PR, CR, HDR, сервис-период, графики)
 * План: произвольный период, ПДО, формулы PR=HDR*CR, разбивка, динамика по месяцам, настройки.
 */
(function (global) {
  'use strict';

  var chartInstances = [];
  var SETTINGS_KEY = 'cattleTracker_analytics_settings';

  /* Расчёты PR/CR/HDR и периода — в analytics-calc.js (глобальные функции) */

  function renderCharts(containerId, report, monthlyData, bounds, pdo) {
    var container = document.getElementById(containerId);
    if (!container || typeof Chart === 'undefined') return;
    chartInstances.forEach(function (c) { try { c.destroy(); } catch (e) {} });
    chartInstances = [];

    var pdoVal = (report && report.pdo !== undefined) ? report.pdo : (pdo || 0);
    var list = window.getFilteredEntries(report.period, report.dateFrom, report.dateTo, pdoVal);
    var statusCounts = {};
    list.forEach(function (e) {
      var s = (e.status || '—').toString();
      if (window.isBrak(e)) return;
      statusCounts[s] = (statusCounts[s] || 0) + 1;
    });

    var html = '';
    if (monthlyData && monthlyData.length > 0) {
      html += '<div class="analytics-chart-wrapper"><canvas id="analyticsChartMonthly"></canvas></div>';
    }
    html += '<div class="analytics-chart-wrapper"><canvas id="analyticsChartIndicators"></canvas></div>';
    html += '<div class="analytics-chart-wrapper"><canvas id="analyticsChartStatus"></canvas></div>';
    container.innerHTML = html;

    if (monthlyData && monthlyData.length > 0) {
      var ctxM = document.getElementById('analyticsChartMonthly');
      if (ctxM) {
        var chM = new Chart(ctxM.getContext('2d'), {
          type: 'line',
          data: {
            labels: monthlyData.map(function (m) { return m.label; }),
            datasets: [
              { label: 'PR %', data: monthlyData.map(function (m) { return m.pr; }), borderColor: '#4a90e2', backgroundColor: 'transparent', tension: 0.2 },
              { label: 'CR %', data: monthlyData.map(function (m) { return m.cr; }), borderColor: '#4caf50', backgroundColor: 'transparent', tension: 0.2 },
              { label: 'HDR %', data: monthlyData.map(function (m) { return m.hdr; }), borderColor: '#ff9800', backgroundColor: 'transparent', tension: 0.2 }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: true,
            scales: { y: { beginAtZero: true, max: 100 } },
            plugins: { legend: { position: 'top' } }
          }
        });
        chartInstances.push(chM);
      }
    }

    var ctx1 = document.getElementById('analyticsChartIndicators');
    if (ctx1) {
      var ch1 = new Chart(ctx1.getContext('2d'), {
        type: 'bar',
        data: {
          labels: ['PR (%)', 'CR (%)', 'HDR (%)', 'Сервис-период (дн.)'],
          datasets: [{
            label: 'Значение',
            data: [
              report ? report.pr : 0,
              report ? report.cr : 0,
              report ? report.hdr : 0,
              report && report.servicePeriodDays != null ? report.servicePeriodDays : 0
            ],
            backgroundColor: ['#4a90e2', '#4caf50', '#ff9800', '#9c27b0']
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          scales: { y: { beginAtZero: true } },
          plugins: { legend: { display: false } }
        }
      });
      chartInstances.push(ch1);
    }
    var ctx2 = document.getElementById('analyticsChartStatus');
    if (ctx2 && Object.keys(statusCounts).length > 0) {
      var ch2 = new Chart(ctx2.getContext('2d'), {
        type: 'doughnut',
        data: {
          labels: Object.keys(statusCounts),
          datasets: [{
            data: Object.keys(statusCounts).map(function (k) { return statusCounts[k]; }),
            backgroundColor: ['#4a90e2', '#4caf50', '#ff9800', '#f44336', '#9c27b0', '#00bcd4']
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: { legend: { position: 'right' } }
        }
      });
      chartInstances.push(ch2);
    }
  }

  function getAnalyticsSettings() {
    try {
      var raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        var o = JSON.parse(raw);
        return {
          period: o.period || 'month',
          dateFrom: o.dateFrom || '',
          dateTo: o.dateTo || '',
          pdo: o.pdo !== undefined ? o.pdo : 50,
          breakdownBy: o.breakdownBy || ''
        };
      }
    } catch (e) {}
    var now = new Date();
    var start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return {
      period: 'month',
      dateFrom: start.toISOString().slice(0, 10),
      dateTo: now.toISOString().slice(0, 10),
      pdo: 50,
      breakdownBy: ''
    };
  }

  function saveAnalyticsSettings() {
    var periodSelect = document.getElementById('analyticsPeriod');
    var dateFromEl = document.getElementById('analyticsDateFrom');
    var dateToEl = document.getElementById('analyticsDateTo');
    var pdoEl = document.getElementById('analyticsPdo');
    var breakdownEl = document.getElementById('analyticsBreakdown');
    var o = {
      period: (periodSelect && periodSelect.value) ? periodSelect.value : 'month',
      dateFrom: (dateFromEl && dateFromEl.value) ? dateFromEl.value : '',
      dateTo: (dateToEl && dateToEl.value) ? dateToEl.value : '',
      pdo: (pdoEl && pdoEl.value !== '') ? parseInt(pdoEl.value, 10) : 50,
      breakdownBy: (breakdownEl && breakdownEl.value) ? breakdownEl.value : ''
    };
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(o));
    } catch (e) {}
  }

  function applySettingsToUI(settings) {
    var periodSelect = document.getElementById('analyticsPeriod');
    var dateFromEl = document.getElementById('analyticsDateFrom');
    var dateToEl = document.getElementById('analyticsDateTo');
    var pdoEl = document.getElementById('analyticsPdo');
    var breakdownEl = document.getElementById('analyticsBreakdown');
    var customDates = document.getElementById('analyticsCustomDates');
    if (periodSelect) periodSelect.value = settings.period || 'month';
    if (dateFromEl) dateFromEl.value = settings.dateFrom || '';
    if (dateToEl) dateToEl.value = settings.dateTo || '';
    if (pdoEl) pdoEl.value = String(settings.pdo !== undefined ? settings.pdo : 50);
    if (breakdownEl) breakdownEl.value = settings.breakdownBy || '';
    if (customDates) customDates.style.display = (settings.period === 'custom') ? 'inline-flex' : 'none';
  }

  function updatePeriodDatesFromPreset(period) {
    var bounds = window.getPeriodBounds(period, null, null);
    var dateFromEl = document.getElementById('analyticsDateFrom');
    var dateToEl = document.getElementById('analyticsDateTo');
    if (dateFromEl) dateFromEl.value = bounds.start.toISOString().slice(0, 10);
    if (dateToEl) dateToEl.value = bounds.end.toISOString().slice(0, 10);
  }

  function renderAnalyticsScreen() {
    var periodSelect = document.getElementById('analyticsPeriod');
    var period = (periodSelect && periodSelect.value) ? periodSelect.value : 'month';
    var dateFromEl = document.getElementById('analyticsDateFrom');
    var dateToEl = document.getElementById('analyticsDateTo');
    var dateFrom = (dateFromEl && dateFromEl.value) ? dateFromEl.value : '';
    var dateTo = (dateToEl && dateToEl.value) ? dateToEl.value : '';
    var pdoEl = document.getElementById('analyticsPdo');
    var pdo = (pdoEl && pdoEl.value !== '') ? parseInt(pdoEl.value, 10) : 50;
    var breakdownEl = document.getElementById('analyticsBreakdown');
    var breakdownBy = (breakdownEl && breakdownEl.value) ? breakdownEl.value : '';

    if (period !== 'custom') updatePeriodDatesFromPreset(period);

    var report = window.generateReport(period, dateFrom, dateTo, pdo);
    var indicatorsEl = document.getElementById('analyticsIndicators');
    if (indicatorsEl) {
      indicatorsEl.innerHTML =
        '<div class="analytics-cards">' +
          '<div class="analytics-card"><div class="analytics-card-value">' + report.pr + '%</div><div class="analytics-card-label">PR (стельность)</div></div>' +
          '<div class="analytics-card"><div class="analytics-card-value">' + report.cr + '%</div><div class="analytics-card-label">CR (оплодотворение)</div></div>' +
          '<div class="analytics-card"><div class="analytics-card-value">' + report.hdr + '%</div><div class="analytics-card-label">HDR (охота)</div></div>' +
          '<div class="analytics-card"><div class="analytics-card-value">' + (report.servicePeriodDays != null ? report.servicePeriodDays : '—') + '</div><div class="analytics-card-label">Сервис-период (дн.)</div></div>' +
          '<div class="analytics-card"><div class="analytics-card-value">' + report.inseminatedCount + '</div><div class="analytics-card-label">Осеменено</div></div>' +
          '<div class="analytics-card"><div class="analytics-card-value">' + report.pregnantCount + '</div><div class="analytics-card-label">Стельных</div></div>' +
        '</div>';
    }

    var breakdownTableEl = document.getElementById('analyticsBreakdownTable');
    if (breakdownTableEl) {
      if (breakdownBy) {
        var list = window.getFilteredEntries(period, dateFrom, dateTo, pdo);
        var groups = {};
        list.forEach(function (e) {
          var k = window.getBreakdownKey(e, breakdownBy);
          if (!groups[k]) groups[k] = [];
          groups[k].push(e);
        });
        var colLabel = breakdownBy === 'group' ? 'Группа' : breakdownBy === 'lactation' ? 'Лактация' : breakdownBy === 'inseminator' ? 'Осеменатор' : 'Бык';
        var rows = [];
        Object.keys(groups).sort().forEach(function (k) {
          var subList = groups[k];
          var subReport = window.generateReport(period, dateFrom, dateTo, pdo, subList);
          rows.push({
            key: k,
            pr: subReport.pr,
            cr: subReport.cr,
            hdr: subReport.hdr,
            inseminatedCount: subReport.inseminatedCount,
            pregnantCount: subReport.pregnantCount
          });
        });
        var tableHtml = '<table class="analytics-breakdown-table"><thead><tr><th>' + colLabel + '</th><th>PR %</th><th>CR %</th><th>HDR %</th><th>Осеменено</th><th>Стельных</th></tr></thead><tbody>';
        rows.forEach(function (r) {
          tableHtml += '<tr><td>' + escapeHtml(r.key) + '</td><td>' + r.pr + '</td><td>' + r.cr + '</td><td>' + r.hdr + '</td><td>' + r.inseminatedCount + '</td><td>' + r.pregnantCount + '</td></tr>';
        });
        tableHtml += '</tbody></table>';
        breakdownTableEl.innerHTML = tableHtml;
        breakdownTableEl.style.display = 'block';
      } else {
        breakdownTableEl.innerHTML = '';
        breakdownTableEl.style.display = 'none';
      }
    }

    var monthlyData = [];
    var bounds = window.getPeriodBounds(period, dateFrom, dateTo);
    var months = window.getMonthsInRange(bounds);
    months.forEach(function (m) {
      var fromStr = m.start.toISOString().slice(0, 10);
      var toStr = m.end.toISOString().slice(0, 10);
      var listM = window.getFilteredEntries('custom', fromStr, toStr, pdo);
      var r = window.generateReport('custom', fromStr, toStr, pdo, listM);
      monthlyData.push({
        label: window.monthLabel(m),
        pr: r.pr,
        cr: r.cr,
        hdr: r.hdr
      });
    });

    renderCharts('analyticsCharts', report, monthlyData, bounds, pdo);
    saveAnalyticsSettings();
  }

  function escapeHtml(text) {
    var s = String(text == null ? '' : text);
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function initAnalytics() {
    var settings = getAnalyticsSettings();
    applySettingsToUI(settings);

    var periodSelect = document.getElementById('analyticsPeriod');
    var customDates = document.getElementById('analyticsCustomDates');
    if (periodSelect) {
      periodSelect.addEventListener('change', function () {
        var isCustom = periodSelect.value === 'custom';
        if (customDates) customDates.style.display = isCustom ? 'inline-flex' : 'none';
        if (!isCustom) updatePeriodDatesFromPreset(periodSelect.value);
        renderAnalyticsScreen();
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
    { label: 'Свыше 48 дней', min: 49, max: null }
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

  function renderReproductionFiltersUI() {
    var container = document.getElementById('reproductionFilters');
    if (!container) return;
    var bounds = window.getPeriodBounds(reproductionFilter.period, reproductionFilter.dateFrom, reproductionFilter.dateTo);
    var df = reproductionFilter.dateFrom || bounds.start.toISOString().slice(0, 10);
    var dt = reproductionFilter.dateTo || bounds.end.toISOString().slice(0, 10);
    var attemptVal = reproductionFilter.attemptNumber !== undefined ? reproductionFilter.attemptNumber : '';
    var bullVal = (reproductionFilter.bull !== undefined ? reproductionFilter.bull : '').replace(/"/g, '&quot;');
    var lactVal = reproductionFilter.lactation !== undefined ? reproductionFilter.lactation : '';
    var attemptOptions = '<option value="">Все попытки</option>';
    for (var a = 1; a <= 10; a++) attemptOptions += '<option value="' + a + '"' + (attemptVal === String(a) ? ' selected' : '') + '>Попытка ' + a + '</option>';
    var bulls = [];
    var list = (typeof window !== 'undefined' && window.entries && Array.isArray(window.entries)) ? window.entries : [];
    list.forEach(function (e) {
      var hist = e.inseminationHistory || (e.inseminationDate ? [{ bull: e.bull || '' }] : []);
      hist.forEach(function (h) {
        var b = (h.bull || '').trim();
        if (b && bulls.indexOf(b) === -1) bulls.push(b);
      });
    });
    bulls.sort();
    var bullOptions = '<option value="">Все быки</option>' + bulls.map(function (b) {
      return '<option value="' + String(b).replace(/"/g, '&quot;') + '"' + (bullVal === b ? ' selected' : '') + '>' + escapeHtml(b) + '</option>';
    }).join('');
    var lactOptions = '<option value="">Все лактации</option>' +
      '<option value="0"' + (lactVal === '0' ? ' selected' : '') + '>0 (тёлки)</option>' +
      '<option value="1"' + (lactVal === '1' ? ' selected' : '') + '>1 (первотелки)</option>' +
      '<option value="2+"' + (lactVal === '2+' ? ' selected' : '') + '>2+</option>' +
      '<option value="1+2+"' + (lactVal === '1+2+' ? ' selected' : '') + '>1 + 2+ (лактирующие)</option>';
    container.innerHTML =
      '<div class="search-filter-bar analytics-interval-filter-bar">' +
        '<div class="filter-row">' +
          '<span class="filter-label">Период:</span>' +
          '<select id="reproductionPeriod" class="analytics-interval-select"><option value="month"' + (reproductionFilter.period === 'month' ? ' selected' : '') + '>Месяц</option><option value="quarter"' + (reproductionFilter.period === 'quarter' ? ' selected' : '') + '>Квартал</option><option value="year"' + (reproductionFilter.period === 'year' ? ' selected' : '') + '>Год</option><option value="all"' + (reproductionFilter.period === 'all' ? ' selected' : '') + '>За всё время</option><option value="custom"' + (reproductionFilter.period === 'custom' ? ' selected' : '') + '>Произвольный</option></select>' +
          '<span id="reproductionCustomDates" style="display:none;">' +
          '<label>С: <input type="date" id="reproductionDateFrom" value="' + df + '" /></label>' +
          '<label>По: <input type="date" id="reproductionDateTo" value="' + dt + '" /></label>' +
          '</span>' +
        '</div>' +
        '<div class="filter-row">' +
          '<span class="filter-label">Попытка осеменения:</span>' +
          '<select id="reproductionAttempt" class="analytics-interval-select">' + attemptOptions + '</select>' +
        '</div>' +
        '<div class="filter-row">' +
          '<span class="filter-label">Бык:</span>' +
          '<select id="reproductionBull" class="analytics-interval-select">' + bullOptions + '</select>' +
        '</div>' +
        '<div class="filter-row">' +
          '<span class="filter-label">Лактация:</span>' +
          '<select id="reproductionLactation" class="analytics-interval-select">' + lactOptions + '</select>' +
        '</div>' +
        '<div class="filter-row"><button type="button" class="small-btn" id="reproductionRefreshBtn">Обновить</button></div>' +
      '</div>';
    var periodEl = document.getElementById('reproductionPeriod');
    var customWrap = document.getElementById('reproductionCustomDates');
    if (periodEl) {
      periodEl.addEventListener('change', function () {
        reproductionFilter.period = periodEl.value;
        if (customWrap) customWrap.style.display = periodEl.value === 'custom' ? 'inline' : 'none';
        if (periodEl.value !== 'custom') {
          var b = window.getPeriodBounds(periodEl.value, null, null);
          var fromEl = document.getElementById('reproductionDateFrom');
          var toEl = document.getElementById('reproductionDateTo');
          if (fromEl) fromEl.value = b.start.toISOString().slice(0, 10);
          if (toEl) toEl.value = b.end.toISOString().slice(0, 10);
        }
        renderReproductionScreen();
      });
    }
    var fromEl = document.getElementById('reproductionDateFrom');
    var toEl = document.getElementById('reproductionDateTo');
    if (fromEl) fromEl.addEventListener('change', function () { reproductionFilter.dateFrom = fromEl.value; renderReproductionScreen(); });
    if (toEl) toEl.addEventListener('change', function () { reproductionFilter.dateTo = toEl.value; renderReproductionScreen(); });
    var attemptEl = document.getElementById('reproductionAttempt');
    if (attemptEl) attemptEl.addEventListener('change', function () { reproductionFilter.attemptNumber = attemptEl.value; renderReproductionScreen(); });
    var bullEl = document.getElementById('reproductionBull');
    if (bullEl) bullEl.addEventListener('change', function () { reproductionFilter.bull = bullEl.value; renderReproductionScreen(); });
    var lactEl = document.getElementById('reproductionLactation');
    if (lactEl) lactEl.addEventListener('change', function () { reproductionFilter.lactation = lactEl.value; renderReproductionScreen(); });
    var refreshBtn = document.getElementById('reproductionRefreshBtn');
    if (refreshBtn) refreshBtn.addEventListener('click', renderReproductionScreen);
  }

  function renderReproductionScreen() {
    var filterContainer = document.getElementById('reproductionFilters');
    if (filterContainer && !filterContainer.dataset.rendered) {
      filterContainer.dataset.rendered = '1';
      var bounds = window.getPeriodBounds(reproductionFilter.period, null, null);
      reproductionFilter.dateFrom = reproductionFilter.dateFrom || bounds.start.toISOString().slice(0, 10);
      reproductionFilter.dateTo = reproductionFilter.dateTo || bounds.end.toISOString().slice(0, 10);
      renderReproductionFiltersUI();
      var customWrap = document.getElementById('reproductionCustomDates');
      if (customWrap) customWrap.style.display = reproductionFilter.period === 'custom' ? 'inline' : 'none';
    } else if (filterContainer) {
      var fromEl = document.getElementById('reproductionDateFrom');
      var toEl = document.getElementById('reproductionDateTo');
      if (fromEl) reproductionFilter.dateFrom = fromEl.value;
      if (toEl) reproductionFilter.dateTo = toEl.value;
    }
    var data = getReproductionData(reproductionFilter.period, reproductionFilter.dateFrom, reproductionFilter.dateTo, reproductionFilter);
    var indicatorsEl = document.getElementById('reproductionIndicators');
    if (indicatorsEl) {
      var starHtml = '';
      if (data.unconfirmedAnimalsCount && data.unconfirmedAnimalsCount > 0) {
        starHtml = '<span class="analytics-info-star" title="Животных с осеменением без проверки стельности (моложе 40 дней): ' + data.unconfirmedAnimalsCount + '">*</span>';
      }
      indicatorsEl.innerHTML =
        '<div class="analytics-cards">' +
          '<div class="analytics-card"><div class="analytics-card-value">' + data.totalInseminations + '</div><div class="analytics-card-label">Осеменено в периоде (шт)</div></div>' +
          '<div class="analytics-card"><div class="analytics-card-value">' + data.pregnantCount + '</div><div class="analytics-card-label">Стельных из них (шт)</div></div>' +
          '<div class="analytics-card"><div class="analytics-card-value">' + data.percent + '%' + starHtml + '</div><div class="analytics-card-label">Оплодотворяемость (%)</div></div>' +
        '</div>';
    }
    var tableEl = document.getElementById('reproductionTable');
    if (tableEl) {
      tableEl.innerHTML = '<p class="analytics-interval-intro">Период: с ' + (reproductionFilter.dateFrom || '—') + ' по ' + (reproductionFilter.dateTo || '—') + '. Животные с осеменением без проверки стельности не входят в расчёт; их количество показывается при наведении на звёздочку рядом с показателем оплодотворяемости. Данные по текущей базе с учётом всех осеменений и проверок на стельность (УЗИ).</p>';
    }
  }

  if (typeof window !== 'undefined') {
    window.renderCharts = renderCharts;
    window.renderAnalyticsScreen = renderAnalyticsScreen;
    window.renderIntervalAnalysisScreen = renderIntervalAnalysisScreen;
    window.renderReproductionScreen = renderReproductionScreen;
    window.getAnalyticsFilteredEntries = window.getFilteredEntries;
    window.getPeriodBounds = window.getPeriodBounds;
  }

  if (typeof window !== 'undefined' && window.document) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initAnalytics);
    } else {
      initAnalytics();
    }
  }
})(typeof window !== 'undefined' ? window : this);
export {};
