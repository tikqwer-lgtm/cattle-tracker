/** __analytics part 3 */
(function () {
  'use strict';
  var root = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this);
  var NS = root['__analytics'] = root['__analytics'] || {};
  var global = typeof window !== 'undefined' ? window : this;

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
      return '<option value="' + String(b).replace(/"/g, '&quot;') + '"' + (bullVal === b ? ' selected' : '') + '>' + globalThis['__analytics'].escapeHtml(b) + '</option>';
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
    var data = globalThis['__analytics'].getReproductionData(reproductionFilter.period, reproductionFilter.dateFrom, reproductionFilter.dateTo, reproductionFilter);
    var indicatorsEl = document.getElementById('reproductionIndicators');
    if (indicatorsEl) {
      var starHtml = '';
      if (data.unconfirmedAnimalsCount && data.unconfirmedAnimalsCount > 0) {
        starHtml = '<span class="analytics-info-star" title="Животных с осеменением без проверки стельности (моложе 40 дней): ' + data.unconfirmedAnimalsCount + '">*</span>';
      }
      indicatorsEl.innerHTML =
        '<div class="analytics-cards">' +
          '<div class="analytics-card"><div class="analytics-card-value"><span data-animate-to="' + data.totalInseminations + '">0</span></div><div class="analytics-card-label">Осеменено в периоде (шт)</div></div>' +
          '<div class="analytics-card"><div class="analytics-card-value"><span data-animate-to="' + data.pregnantCount + '">0</span></div><div class="analytics-card-label">Стельных из них (шт)</div></div>' +
          '<div class="analytics-card"><div class="analytics-card-value"><span data-animate-to="' + data.percent + '" data-suffix="%">0%</span>' + starHtml + '</div><div class="analytics-card-label">Оплодотворяемость (%)</div></div>' +
        '</div>';
      if (typeof window.animateNumberTargets === 'function') {
        window.animateNumberTargets(indicatorsEl);
      }
    }
    var tableEl = document.getElementById('reproductionTable');
    if (tableEl) {
      tableEl.innerHTML = '<p class="analytics-interval-intro">Период: с ' + (reproductionFilter.dateFrom || '—') + ' по ' + (reproductionFilter.dateTo || '—') + '. Животные с осеменением без проверки стельности не входят в расчёт; их количество показывается при наведении на звёздочку рядом с показателем оплодотворяемости. Данные по текущей базе с учётом всех осеменений и проверок на стельность (УЗИ).</p>';
    }
  }


  // register functions
  NS.renderReproductionFiltersUI = renderReproductionFiltersUI;
  NS.renderReproductionScreen = renderReproductionScreen;
})();
export {};
