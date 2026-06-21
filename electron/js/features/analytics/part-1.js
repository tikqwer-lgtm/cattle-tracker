/** __analytics part 1 */
(function () {
  'use strict';
  var root = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this);
  var NS = root['__analytics'] = root['__analytics'] || {};
  var global = typeof window !== 'undefined' ? window : this;

var chartInstances = [];
  var SETTINGS_KEY = 'cattleTracker_analytics_settings';

  /* Расчёты PR/CR/HDR и периода — в analytics-calc.js (глобальные функции) */

  function renderCharts(containerId, report, monthlyData, bounds, pdo) {
    var container = document.getElementById(containerId);
    if (!container || typeof Chart === 'undefined') return;
    chartInstances.forEach(function (c) { try { c.destroy(); } catch (e) {} });
    chartInstances = [];

    var pdoVal = (report && report.pdo !== undefined) ? report.pdo : (pdo || 0);
    var list = window.getAnalyticsFilteredEntries(report.period, report.dateFrom, report.dateTo, pdoVal);
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
        var list = window.getAnalyticsFilteredEntries(period, dateFrom, dateTo, pdo);
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
          tableHtml += '<tr><td>' + globalThis['__analytics'].escapeHtml(r.key) + '</td><td>' + r.pr + '</td><td>' + r.cr + '</td><td>' + r.hdr + '</td><td>' + r.inseminatedCount + '</td><td>' + r.pregnantCount + '</td></tr>';
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
      var listM = window.getAnalyticsFilteredEntries('custom', fromStr, toStr, pdo);
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


  // register functions
  NS.renderCharts = renderCharts;
  NS.getAnalyticsSettings = getAnalyticsSettings;
  NS.saveAnalyticsSettings = saveAnalyticsSettings;
  NS.applySettingsToUI = applySettingsToUI;
  NS.updatePeriodDatesFromPreset = updatePeriodDatesFromPreset;
  NS.renderAnalyticsScreen = renderAnalyticsScreen;
})();
export {};
