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
    var list = getFilteredEntries(report.period, report.dateFrom, report.dateTo, pdoVal);
    var statusCounts = {};
    list.forEach(function (e) {
      var s = (e.status || '—').toString();
      if (isBrak(e)) return;
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
    var bounds = getPeriodBounds(period, null, null);
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

    var report = generateReport(period, dateFrom, dateTo, pdo);
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
        var list = getFilteredEntries(period, dateFrom, dateTo, pdo);
        var groups = {};
        list.forEach(function (e) {
          var k = getBreakdownKey(e, breakdownBy);
          if (!groups[k]) groups[k] = [];
          groups[k].push(e);
        });
        var colLabel = breakdownBy === 'group' ? 'Группа' : breakdownBy === 'lactation' ? 'Лактация' : breakdownBy === 'inseminator' ? 'Осеменатор' : 'Бык';
        var rows = [];
        Object.keys(groups).sort().forEach(function (k) {
          var subList = groups[k];
          var subReport = generateReport(period, dateFrom, dateTo, pdo, subList);
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
    var bounds = getPeriodBounds(period, dateFrom, dateTo);
    var months = getMonthsInRange(bounds);
    months.forEach(function (m) {
      var fromStr = m.start.toISOString().slice(0, 10);
      var toStr = m.end.toISOString().slice(0, 10);
      var listM = getFilteredEntries('custom', fromStr, toStr, pdo);
      var r = generateReport('custom', fromStr, toStr, pdo, listM);
      monthlyData.push({
        label: monthLabel(m),
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
    var list = typeof entries !== 'undefined' ? entries : [];
    var filterLact = filter && filter.lactation !== undefined && filter.lactation !== null && filter.lactation !== '' ? String(filter.lactation) : '';
    var getList = typeof getInseminationListForEntry === 'function' ? getInseminationListForEntry : function () { return []; };
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

  if (typeof window !== 'undefined') {
    window.calculatePR = function (hdr, cr) { return calculatePR(hdr, cr); };
    window.calculateCR = calculateCR;
    window.calculateHDR = calculateHDR;
    window.generateReport = generateReport;
    window.renderCharts = renderCharts;
    window.renderAnalyticsScreen = renderAnalyticsScreen;
    window.renderIntervalAnalysisScreen = renderIntervalAnalysisScreen;
    window.getAnalyticsFilteredEntries = getFilteredEntries;
    window.getPeriodBounds = getPeriodBounds;
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
