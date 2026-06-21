/**
 * calving-calc.js — план и факт отёлов по месяцам.
 * План: стельная текущей лактации, осеменение + GESTATION_DAYS, rollover displayMonth.
 * Факт: отёлы из lactationHistory (осеменение той же лактации, не текущее поле карточки).
 */
var GESTATION_DAYS = 285;

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

function monthOrdinal(year, month) {
  return year * 12 + month;
}

function ordinalToYearMonth(ord) {
  return { year: Math.floor(ord / 12), month: ord % 12 };
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
  if (typeof d === 'string') return String(d).slice(0, 10);
  var y = d.getFullYear();
  var m = String(d.getMonth() + 1).padStart(2, '0');
  var day = String(d.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + day;
}

function daysBetween(fromStr, toStr) {
  if (!fromStr || !toStr) return null;
  var a = dateOnly(parseCalvingDate(fromStr));
  var b = dateOnly(parseCalvingDate(toStr));
  if (!a || !b) return null;
  return Math.round((b - a) / (24 * 60 * 60 * 1000));
}

/**
 * Месяц отображения просроченной стельной: planned или текущий (rollover).
 */
function getPlanDisplayMonth(expectedDate, refDate) {
  refDate = refDate || new Date();
  if (!expectedDate) return null;
  var plannedOrd = monthOrdinal(expectedDate.getFullYear(), expectedDate.getMonth());
  var currentOrd = monthOrdinal(refDate.getFullYear(), refDate.getMonth());
  var displayOrd = currentOrd <= plannedOrd ? plannedOrd : currentOrd;
  return ordinalToYearMonth(displayOrd);
}

function findSnapshotForCalving(entry, calvingDateKey) {
  if (!entry || !Array.isArray(entry.lactationHistory) || !calvingDateKey) return null;
  for (var i = entry.lactationHistory.length - 1; i >= 0; i--) {
    var snap = entry.lactationHistory[i];
    if (!snap || !snap.calvingDate) continue;
    var key = formatDateKey(dateOnly(parseCalvingDate(snap.calvingDate)));
    if (key === calvingDateKey) return snap;
  }
  return null;
}

/**
 * Фактические отёлы с осеменением той же лактации (снимок lactationHistory).
 */
function collectFactLactationEvents(entry) {
  var seen = Object.create(null);
  var out = [];

  function pushEvent(calvingDateKey, insemDateStr) {
    if (!calvingDateKey || !insemDateStr || seen[calvingDateKey]) return;
    seen[calvingDateKey] = true;
    var d = dateOnly(parseCalvingDate(calvingDateKey));
    if (!d) return;
    out.push({ calvingDate: d, inseminationDate: insemDateStr });
  }

  if (Array.isArray(entry.lactationHistory)) {
    entry.lactationHistory.forEach(function (snap) {
      if (!snap || !snap.calvingDate) return;
      var insem = getLastInseminationDateFromHistory(snap.inseminationHistory, snap.inseminationDate);
      if (!insem) return;
      pushEvent(formatDateKey(dateOnly(parseCalvingDate(snap.calvingDate))), insem);
    });
  }

  var currentCd = parseCalvingDate(entry && entry.calvingDate);
  if (currentCd) {
    var currentKey = formatDateKey(dateOnly(currentCd));
    if (!seen[currentKey]) {
      var snap = findSnapshotForCalving(entry, currentKey);
      if (snap) {
        var insem2 = getLastInseminationDateFromHistory(snap.inseminationHistory, snap.inseminationDate);
        if (insem2) pushEvent(currentKey, insem2);
      }
    }
  }
  return out;
}

function buildCalvingRow(entry, opts) {
  var insem = opts.inseminationDate;
  var expected = getExpectedCalvingDateFromInsem(insem);
  var expectedKey = expected ? formatDateKey(expected) : '';
  var actualDate = opts.actualCalvingDate || null;
  var actualKey = actualDate ? formatDateKey(actualDate) : null;
  var refDate = opts.refDate || new Date();
  var refKey = formatDateKey(dateOnly(refDate));
  var daysPregnant = insem
    ? daysBetween(insem, actualKey || refKey)
    : null;
  var planFactDiffDays = (actualKey && expectedKey) ? daysBetween(expectedKey, actualKey) : null;

  return {
    cattleId: entry.cattleId,
    nickname: entry.nickname || '',
    inseminationDate: insem || '',
    daysPregnant: daysPregnant,
    expectedCalvingDate: expectedKey,
    expectedDate: expectedKey,
    actualCalvingDate: actualKey,
    calvingDate: actualKey,
    planFactDiffDays: planFactDiffDays,
    overdue: !!opts.overdue,
    rowKind: opts.rowKind || 'plan',
    dataError: actualDate ? isFutureDate(actualDate, refDate) : false
  };
}

function isFutureDate(d, refDate) {
  if (!d) return false;
  var today = dateOnly(refDate || new Date());
  return dateOnly(d) > today;
}

function sortCalvingRows(a, b) {
  if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
  var ea = a.expectedCalvingDate || a.actualCalvingDate || '';
  var eb = b.expectedCalvingDate || b.actualCalvingDate || '';
  if (ea !== eb) return ea < eb ? -1 : 1;
  return String(a.cattleId).localeCompare(String(b.cattleId), 'ru');
}

/**
 * @param {Array} entries
 * @param {number} year
 * @param {number} month 0-based
 * @param {Date} [refDate]
 */
function getCalvingStatsForMonth(entries, year, month, refDate) {
  refDate = refDate || new Date();
  var planRows = [];
  var factRows = [];
  var mergedRows = [];
  var mergedSeen = Object.create(null);

  (entries || []).forEach(function (entry) {
    if (!entry || !entry.cattleId) return;
    if (isExited(entry, refDate)) return;

    if (isSterlyana(entry)) {
      var insem = getFertileInseminationDate(entry);
      if (insem) {
        var expected = getExpectedCalvingDateFromInsem(insem);
        if (expected) {
          var display = getPlanDisplayMonth(expected, refDate);
          if (display && display.year === year && display.month === month) {
            var plannedOrd = monthOrdinal(expected.getFullYear(), expected.getMonth());
            var displayOrd = monthOrdinal(display.year, display.month);
            var row = buildCalvingRow(entry, {
              inseminationDate: insem,
              actualCalvingDate: null,
              refDate: refDate,
              overdue: displayOrd > plannedOrd,
              rowKind: 'plan'
            });
            planRows.push(row);
            mergedSeen[String(entry.cattleId) + '_plan'] = row;
          }
        }
      }
    }

    collectFactLactationEvents(entry).forEach(function (ev) {
      if (!isDateInMonth(ev.calvingDate, year, month)) return;
      var factRow = buildCalvingRow(entry, {
        inseminationDate: ev.inseminationDate,
        actualCalvingDate: ev.calvingDate,
        refDate: refDate,
        overdue: false,
        rowKind: 'fact'
      });
      factRows.push(factRow);
      var factKey = String(entry.cattleId) + '_' + formatDateKey(ev.calvingDate);
      mergedSeen[factKey] = factRow;
      delete mergedSeen[String(entry.cattleId) + '_plan'];
    });
  });

  Object.keys(mergedSeen).forEach(function (k) {
    mergedRows.push(mergedSeen[k]);
  });
  mergedRows.sort(sortCalvingRows);
  planRows.sort(sortCalvingRows);
  factRows.sort(function (a, b) {
    if (a.calvingDate !== b.calvingDate) return a.calvingDate < b.calvingDate ? -1 : 1;
    return String(a.cattleId).localeCompare(String(b.cattleId), 'ru');
  });

  var factDataErrors = factRows.some(function (x) { return x.dataError; });

  return {
    plan: { count: planRows.length, items: planRows },
    fact: { count: factRows.length, items: factRows, hasDataErrors: factDataErrors },
    rows: mergedRows
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
  getPlanDisplayMonth,
  getFertileInseminationDate,
  getExpectedCalvingDateFromInsem,
  getCalvingStatsForMonth,
  GESTATION_DAYS
};
