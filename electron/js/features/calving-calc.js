/**
 * calving-calc.js — план и факт отёлов по месяцам.
 */
var GESTATION_DAYS = 280;

function parseCalvingDate(str) {
  if (!str) return null;
  var d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

function dateOnly(d) {
  if (!d) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function monthBounds(year, month) {
  var start = new Date(year, month, 1);
  var end = new Date(year, month + 1, 0);
  return { start: dateOnly(start), end: dateOnly(end) };
}

function isDateInMonth(d, year, month) {
  if (!d) return false;
  return d.getFullYear() === year && d.getMonth() === month;
}

function compareMonth(year, month, refDate) {
  var ref = refDate || new Date();
  var ry = ref.getFullYear();
  var rm = ref.getMonth();
  if (year < ry) return -1;
  if (year > ry) return 1;
  if (month < rm) return -1;
  if (month > rm) return 1;
  return 0;
}

function getLastInseminationDateFromHistory(history, insemDate) {
  var dates = [];
  if (Array.isArray(history)) {
    history.forEach(function (h) {
      if (h && h.date) dates.push(h.date);
    });
  }
  if (insemDate) dates.push(insemDate);
  if (!dates.length) return null;
  dates.sort();
  return dates[dates.length - 1];
}

function getFertileInseminationDate(entry) {
  if (!entry) return null;
  return getLastInseminationDateFromHistory(entry.inseminationHistory, entry.inseminationDate);
}

function getExpectedCalvingDateFromInsem(insemDateStr) {
  if (!insemDateStr) return null;
  var d = parseCalvingDate(insemDateStr);
  if (!d) return null;
  d.setDate(d.getDate() + GESTATION_DAYS);
  return dateOnly(d);
}

function isSterlyana(entry) {
  return ((entry && entry.status) || '').toString().indexOf('Стельная') !== -1;
}

function isExited(entry, refDate) {
  var ed = parseCalvingDate(entry && entry.exitDate);
  if (!ed) return false;
  var today = dateOnly(refDate || new Date());
  return ed <= today;
}

function formatDateKey(d) {
  if (!d) return '';
  var y = d.getFullYear();
  var m = String(d.getMonth() + 1).padStart(2, '0');
  var day = String(d.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + day;
}

function collectPlanSources(entry) {
  var out = [];
  if (isSterlyana(entry)) {
    var insem = getFertileInseminationDate(entry);
    var exp = getExpectedCalvingDateFromInsem(insem);
    if (exp) {
      out.push({ cattleId: entry.cattleId, nickname: entry.nickname || '', expectedDate: exp, source: 'current' });
    }
  }
  var hist = entry.lactationHistory;
  if (Array.isArray(hist)) {
    hist.forEach(function (snap) {
      if (!snap) return;
      var insem2 = getLastInseminationDateFromHistory(snap.inseminationHistory, snap.inseminationDate);
      var exp2 = getExpectedCalvingDateFromInsem(insem2);
      if (exp2) {
        out.push({
          cattleId: entry.cattleId,
          nickname: entry.nickname || '',
          expectedDate: exp2,
          source: 'history'
        });
      }
    });
  }
  return out;
}

function collectFactDates(entry) {
  var out = [];
  var cd = parseCalvingDate(entry && entry.calvingDate);
  if (cd) out.push({ date: dateOnly(cd), source: 'current' });
  if (Array.isArray(entry.lactationHistory)) {
    entry.lactationHistory.forEach(function (snap) {
      if (!snap || !snap.calvingDate) return;
      var d = parseCalvingDate(snap.calvingDate);
      if (d) out.push({ date: dateOnly(d), source: 'history' });
    });
  }
  return out;
}

function isFutureDate(d, refDate) {
  if (!d) return false;
  var today = dateOnly(refDate || new Date());
  return d > today;
}

/**
 * @param {Array} entries
 * @param {number} year
 * @param {number} month 0-based
 * @param {Date} [refDate]
 */
function getCalvingStatsForMonth(entries, year, month, refDate) {
  refDate = refDate || new Date();
  var monthCmp = compareMonth(year, month, refDate);
  var planItems = [];
  var factItems = [];
  var planSeen = Object.create(null);

  (entries || []).forEach(function (entry) {
    if (!entry || !entry.cattleId) return;
    if (isExited(entry, refDate)) return;

    collectPlanSources(entry).forEach(function (src) {
      var exp = src.expectedDate;
      var inMonth = isDateInMonth(exp, year, month);
      var overdue = false;
      if (!inMonth && monthCmp >= 0 && isSterlyana(entry) && src.source === 'current') {
        var bounds = monthBounds(year, month);
        if (exp < bounds.start) {
          inMonth = true;
          overdue = true;
        }
      }
      if (!inMonth) return;
      var key = String(entry.cattleId) + '_plan';
      if (planSeen[key]) return;
      planSeen[key] = true;
      planItems.push({
        cattleId: entry.cattleId,
        nickname: src.nickname,
        expectedDate: formatDateKey(exp),
        overdue: overdue
      });
    });

    collectFactDates(entry).forEach(function (fd) {
      if (!isDateInMonth(fd.date, year, month)) return;
      var dataError = isFutureDate(fd.date, refDate);
      factItems.push({
        cattleId: entry.cattleId,
        nickname: entry.nickname || '',
        calvingDate: formatDateKey(fd.date),
        dataError: dataError
      });
    });
  });

  planItems.sort(function (a, b) {
    if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
    if (a.expectedDate !== b.expectedDate) return a.expectedDate < b.expectedDate ? -1 : 1;
    return String(a.cattleId).localeCompare(String(b.cattleId), 'ru');
  });
  factItems.sort(function (a, b) {
    if (a.calvingDate !== b.calvingDate) return a.calvingDate < b.calvingDate ? -1 : 1;
    return String(a.cattleId).localeCompare(String(b.cattleId), 'ru');
  });

  var factDataErrors = factItems.some(function (x) { return x.dataError; });

  return {
    plan: { count: planItems.length, items: planItems },
    fact: { count: factItems.length, items: factItems, hasDataErrors: factDataErrors }
  };
}

if (typeof window !== 'undefined') {
  window.getCalvingStatsForMonth = getCalvingStatsForMonth;
  window.getFertileInseminationDate = getFertileInseminationDate;
  window.getExpectedCalvingDateFromInsem = getExpectedCalvingDateFromInsem;
}

export {
  parseCalvingDate,
  dateOnly,
  monthBounds,
  compareMonth,
  getFertileInseminationDate,
  getExpectedCalvingDateFromInsem,
  getCalvingStatsForMonth,
  GESTATION_DAYS
};
