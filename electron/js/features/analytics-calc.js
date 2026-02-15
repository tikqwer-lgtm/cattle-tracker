/**
 * analytics-calc.js — расчёты аналитики: PR, CR, HDR, сервис-период, границы периода.
 * Использует глобальные entries. Подключать перед analytics.js.
 */
function parseDate(str) {
  if (!str) return null;
  var d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

function getPeriodBounds(period, dateFrom, dateTo) {
  if (period === 'custom') {
    var start = parseDate(dateFrom);
    var end = parseDate(dateTo);
    if (start && end) return { start: start, end: end };
    var now = new Date();
    return { start: new Date(now.getFullYear(), now.getMonth() - 1, 1), end: new Date(now) };
  }
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

function addDays(d, days) {
  var r = new Date(d);
  r.setDate(r.getDate() + days);
  return r;
}

function getInseminationDates(entry) {
  var list = [];
  if (entry.inseminationHistory && entry.inseminationHistory.length > 0) {
    entry.inseminationHistory.forEach(function (h) {
      if (h.date) list.push(h.date);
    });
  } else if (entry.inseminationDate) {
    list.push(entry.inseminationDate);
  }
  list.sort();
  return list;
}

function getLastInseminationDateInPeriod(entry, bounds) {
  var dates = getInseminationDates(entry);
  var last = null;
  for (var i = 0; i < dates.length; i++) {
    var d = parseDate(dates[i]);
    if (d && d >= bounds.start && d <= bounds.end) last = d;
  }
  return last;
}

function countInseminationsInPeriod(entry, bounds, pdo) {
  var calv = parseDate(entry.calvingDate);
  var pdoEnd = calv ? addDays(calv, pdo) : null;
  var dates = getInseminationDates(entry);
  var n = 0;
  for (var i = 0; i < dates.length; i++) {
    var d = parseDate(dates[i]);
    if (!d || d < bounds.start || d > bounds.end) continue;
    if (pdoEnd && d < pdoEnd) continue;
    n++;
  }
  return n;
}

function isPregnant(entry) {
  var s = (entry.status || '').toString();
  return s.indexOf('Отёл') !== -1 || s.indexOf('Стельная') !== -1;
}

function isBrak(entry) {
  return (entry.status || '').toString().indexOf('Брак') !== -1;
}

function hasLactationOnePlus(entry) {
  var l = entry.lactation;
  if (l === undefined || l === null || l === '') return false;
  var n = parseInt(l, 10);
  return !isNaN(n) && n >= 1;
}

function getFilteredEntries(period, dateFrom, dateTo, pdo) {
  var list = (typeof window !== 'undefined' && window.entries) ? window.entries : [];
  var bounds = getPeriodBounds(period, dateFrom, dateTo);
  pdo = parseInt(pdo, 10) || 0;
  return list.filter(function (e) {
    if (isBrak(e)) return false;
    if (!hasLactationOnePlus(e)) return false;
    var calv = parseDate(e.calvingDate);
    if (!calv) return false;
    var pdoEnd = addDays(calv, pdo);
    if (pdoEnd > bounds.end) return false;
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

function calculateCR(list, bounds, pdo) {
  if (!list || list.length === 0) return 0;
  pdo = parseInt(pdo, 10) || 0;
  var totalInsem = 0;
  var pregnantFromPeriod = 0;
  for (var i = 0; i < list.length; i++) {
    var e = list[i];
    var n = countInseminationsInPeriod(e, bounds, pdo);
    totalInsem += n;
    if (isPregnant(e) && getLastInseminationDateInPeriod(e, bounds)) {
      pregnantFromPeriod++;
    }
  }
  if (totalInsem === 0) return 0;
  return Math.round((pregnantFromPeriod / totalInsem) * 1000) / 10;
}

function calculateHDR(list, bounds, pdo) {
  if (!list || list.length === 0) return 0;
  pdo = parseInt(pdo, 10) || 0;
  var sumRatio = 0;
  var count = 0;
  for (var i = 0; i < list.length; i++) {
    var e = list[i];
    var lastInPeriod = getLastInseminationDateInPeriod(e, bounds);
    if (!lastInPeriod) continue;
    var calv = parseDate(e.calvingDate);
    if (!calv) continue;
    var pdoDate = addDays(calv, pdo);
    if (lastInPeriod < pdoDate) continue;
    var days = daysBetween(pdoDate, lastInPeriod);
    if (days == null) continue;
    var ratio = days / 21;
    sumRatio += Math.min(1, ratio);
    count++;
  }
  if (count === 0) return 0;
  var avg = (sumRatio / count) * 100;
  return Math.round(Math.min(100, avg) * 10) / 10;
}

function calculatePR(hdr, cr) {
  return Math.round((hdr / 100) * (cr / 100) * 1000) / 10;
}

function averageServicePeriod(list) {
  if (!list) return null;
  var withBoth = list.filter(function (e) { return e.calvingDate && (getInseminationDates(e).length > 0); });
  if (withBoth.length === 0) return null;
  var sum = 0, count = 0;
  withBoth.forEach(function (e) {
    var calv = parseDate(e.calvingDate);
    var dates = getInseminationDates(e);
    if (!calv || dates.length === 0) return;
    var firstInsem = parseDate(dates[0]);
    if (firstInsem && firstInsem >= calv) {
      sum += daysBetween(calv, firstInsem);
      count++;
    }
  });
  return count ? Math.round(sum / count) : null;
}

function generateReport(period, dateFrom, dateTo, pdo, listOverride) {
  var list = listOverride != null ? listOverride : getFilteredEntries(period, dateFrom, dateTo, pdo);
  var bounds = getPeriodBounds(period, dateFrom, dateTo);
  pdo = parseInt(pdo, 10) || 0;
  var cr = calculateCR(list, bounds, pdo);
  var hdr = calculateHDR(list, bounds, pdo);
  var pr = calculatePR(hdr, cr);
  var serv = averageServicePeriod(list);
  var inseminatedCount = 0;
  var pregnantCount = 0;
  list.forEach(function (e) {
    if (countInseminationsInPeriod(e, bounds, pdo) > 0) inseminatedCount++;
    if (isPregnant(e)) pregnantCount++;
  });
  var totalInseminations = 0;
  list.forEach(function (e) { totalInseminations += countInseminationsInPeriod(e, bounds, pdo); });
  return {
    period: period,
    bounds: bounds,
    dateFrom: dateFrom,
    dateTo: dateTo,
    pdo: pdo,
    totalCows: list.length,
    pr: pr,
    cr: cr,
    hdr: hdr,
    servicePeriodDays: serv,
    inseminatedCount: inseminatedCount,
    pregnantCount: pregnantCount,
    totalInseminations: totalInseminations
  };
}

function getBreakdownKey(entry, breakdownBy) {
  if (breakdownBy === 'group') return (entry.group || '').trim() || '—';
  if (breakdownBy === 'lactation') return entry.lactation !== undefined && entry.lactation !== '' ? String(entry.lactation) : '—';
  if (breakdownBy === 'inseminator') return (entry.inseminator || '').trim() || '—';
  if (breakdownBy === 'bull') return (entry.bull || '').trim() || '—';
  return '—';
}

function getMonthsInRange(bounds) {
  var months = [];
  var d = new Date(bounds.start.getFullYear(), bounds.start.getMonth(), 1);
  var end = new Date(bounds.end.getFullYear(), bounds.end.getMonth(), 1);
  while (d <= end) {
    months.push({
      start: new Date(d.getFullYear(), d.getMonth(), 1),
      end: new Date(d.getFullYear(), d.getMonth() + 1, 0)
    });
    d.setMonth(d.getMonth() + 1);
  }
  return months;
}

function monthLabel(m) {
  var names = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  return names[m.start.getMonth()] + ' ' + m.start.getFullYear();
}

if (typeof window !== 'undefined') {
  window.getFilteredEntries = getFilteredEntries;
  window.calculateCR = calculateCR;
  window.calculateHDR = calculateHDR;
  window.calculatePR = calculatePR;
  window.generateReport = generateReport;
  window.getPeriodBounds = getPeriodBounds;
  window.isBrak = isBrak;
  window.getBreakdownKey = getBreakdownKey;
  window.getMonthsInRange = getMonthsInRange;
  window.monthLabel = monthLabel;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    parseDate: parseDate,
    getPeriodBounds: getPeriodBounds,
    addDays: addDays,
    getInseminationDates: getInseminationDates,
    daysBetween: daysBetween,
    calculateCR: calculateCR,
    calculateHDR: calculateHDR,
    calculatePR: calculatePR,
    isPregnant: isPregnant,
    averageServicePeriod: averageServicePeriod,
    generateReport: generateReport
  };
}
export { parseDate, getPeriodBounds, addDays, daysBetween, calculatePR, isPregnant, generateReport };
