/**
 * analytics.js — Аналитика и отчёты (PR, CR, HDR, сервис-период, графики)
 */
(function (global) {
  'use strict';

  var chartInstances = [];

  function parseDate(str) {
    if (!str) return null;
    var d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
  }

  function getPeriodBounds(period) {
    var now = new Date();
    var start = new Date(now);
    if (period === 'month') {
      start.setMonth(start.getMonth() - 1);
    } else if (period === 'quarter') {
      start.setMonth(start.getMonth() - 3);
    } else if (period === 'year') {
      start.setFullYear(start.getFullYear() - 1);
    } else {
      start.setMonth(start.getMonth() - 1);
    }
    return { start: start, end: new Date(now) };
  }

  function getEntriesInPeriod(period) {
    var list = typeof entries !== 'undefined' ? entries : [];
    if (!period) return list;
    var bounds = getPeriodBounds(period);
    return list.filter(function (e) {
      var d = parseDate(e.inseminationDate) || parseDate(e.calvingDate) || parseDate(e.dateAdded);
      return d && d >= bounds.start && d <= bounds.end;
    });
  }

  function daysBetween(from, to) {
    if (!from || !to) return null;
    var a = new Date(from.getFullYear(), from.getMonth(), from.getDate());
    var b = new Date(to.getFullYear(), to.getMonth(), to.getDate());
    return Math.round((b - a) / (24 * 60 * 60 * 1000));
  }

  /**
   * PR (Pregnancy Rate) — процент стельности за 21 день
   * Упрощённо: доля коров с осеменением, у которых статус связан со стельностью (Отёл и т.д.) или которые осеменены
   */
  function calculatePR(list) {
    if (!list) list = typeof entries !== 'undefined' ? entries : [];
    var inseminated = list.filter(function (e) { return e.inseminationDate; });
    var pregnant = list.filter(function (e) {
      return e.status && (e.status.indexOf('Отёл') !== -1 || e.status.indexOf('Стельная') !== -1);
    });
    var eligible = inseminated.length || 1;
    return Math.round((pregnant.length / eligible) * 1000) / 10;
  }

  /**
   * CR (Conception Rate) — процент оплодотворения (по попыткам осеменения)
   * Упрощённо: стельность / количество осеменений
   */
  function calculateCR(list) {
    if (!list) list = typeof entries !== 'undefined' ? entries : [];
    var withInsem = list.filter(function (e) { return e.inseminationDate; });
    var pregnant = list.filter(function (e) {
      return e.status && (e.status.indexOf('Отёл') !== -1 || e.status.indexOf('Стельная') !== -1);
    });
    var totalAttempts = withInsem.reduce(function (sum, e) { return sum + (e.attemptNumber || 1); }, 0) || 1;
    return Math.round((pregnant.length / totalAttempts) * 1000) / 10;
  }

  /**
   * HDR (Heat Detection Rate) — процент обнаружения охоты
   * Упрощённо: коровы в охоте (осеменены в периоде) / коровы, подлежащие осеменению
   */
  function calculateHDR(list) {
    if (!list) list = typeof entries !== 'undefined' ? entries : [];
    var withCalving = list.filter(function (e) { return e.calvingDate; });
    var withInsem = list.filter(function (e) { return e.inseminationDate; });
    var eligible = withCalving.length || 1;
    return Math.round((withInsem.length / eligible) * 1000) / 10;
  }

  /**
   * Средний сервис-период (дни от отёла до первого осеменения)
   */
  function averageServicePeriod(list) {
    if (!list) list = typeof entries !== 'undefined' ? entries : [];
    var withBoth = list.filter(function (e) { return e.calvingDate && e.inseminationDate; });
    if (withBoth.length === 0) return null;
    var sum = 0, count = 0;
    withBoth.forEach(function (e) {
      var calv = parseDate(e.calvingDate);
      var insem = parseDate(e.inseminationDate);
      if (calv && insem && insem >= calv) {
        sum += daysBetween(calv, insem);
        count++;
      }
    });
    return count ? Math.round(sum / count) : null;
  }

  /**
   * Межотёльный период (упрощённо по одной записи не посчитать — нужна история отёлов по корове)
   */
  function averageInterCalving(list) {
    if (!list) list = typeof entries !== 'undefined' ? entries : [];
    return null;
  }

  function generateReport(period) {
    var list = getEntriesInPeriod(period);
    var pr = calculatePR(list);
    var cr = calculateCR(list);
    var hdr = calculateHDR(list);
    var serv = averageServicePeriod(list);
    return {
      period: period,
      totalCows: list.length,
      pr: pr,
      cr: cr,
      hdr: hdr,
      servicePeriodDays: serv,
      inseminatedCount: list.filter(function (e) { return e.inseminationDate; }).length,
      pregnantCount: list.filter(function (e) {
        return e.status && (e.status.indexOf('Отёл') !== -1 || e.status.indexOf('Стельная') !== -1);
      }).length
    };
  }

  function renderCharts(containerId, report) {
    var container = document.getElementById(containerId);
    if (!container || typeof Chart === 'undefined') return;
    chartInstances.forEach(function (c) { try { c.destroy(); } catch (e) {} });
    chartInstances = [];
    container.innerHTML = '<div class="analytics-chart-wrapper"><canvas id="analyticsChartIndicators"></canvas></div><div class="analytics-chart-wrapper"><canvas id="analyticsChartStatus"></canvas></div>';
    var list = getEntriesInPeriod(report && report.period ? report.period : 'month');
    var statusCounts = {};
    list.forEach(function (e) {
      var s = e.status || '—';
      statusCounts[s] = (statusCounts[s] || 0) + 1;
    });
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

  function renderAnalyticsScreen() {
    var periodSelect = document.getElementById('analyticsPeriod');
    var period = (periodSelect && periodSelect.value) ? periodSelect.value : 'month';
    var report = generateReport(period);
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
    renderCharts('analyticsCharts', report);
  }

  function initAnalytics() {
    var refreshBtn = document.getElementById('analyticsRefreshBtn');
    var periodSelect = document.getElementById('analyticsPeriod');
    if (refreshBtn) refreshBtn.addEventListener('click', renderAnalyticsScreen);
    if (periodSelect) periodSelect.addEventListener('change', renderAnalyticsScreen);
  }

  if (typeof window !== 'undefined') {
    window.calculatePR = calculatePR;
    window.calculateCR = calculateCR;
    window.calculateHDR = calculateHDR;
    window.generateReport = generateReport;
    window.renderCharts = renderCharts;
    window.renderAnalyticsScreen = renderAnalyticsScreen;
    window.getEntriesInPeriod = getEntriesInPeriod;
  }

  if (typeof window !== 'undefined' && window.document) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initAnalytics);
    } else {
      initAnalytics();
    }
  }
})(typeof window !== 'undefined' ? window : this);
