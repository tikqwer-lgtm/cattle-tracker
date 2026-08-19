/**
 * Общий виджет месяца: ‹ месяц год › и дата снимка списка.
 */

var MONTHS_RU = [
  'январь',
  'февраль',
  'март',
  'апрель',
  'май',
  'июнь',
  'июль',
  'август',
  'сентябрь',
  'октябрь',
  'ноябрь',
  'декабрь'
];

function pad2(n) {
  return String(n).padStart(2, '0');
}

function isoDate(d) {
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}

function formatMonthLabel(year, month) {
  var name = MONTHS_RU[month] || '';
  return name ? name + ' ' + year : year + '-' + pad2(month + 1);
}

function shiftMonth(year, month, delta) {
  var d = new Date(year, month + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
}

function monthBounds(year, month) {
  var from = year + '-' + pad2(month + 1) + '-01';
  var last = new Date(year, month + 1, 0);
  return { from: from, to: isoDate(last) };
}

/**
 * Дата для списков «на дату»: последний день выбранного месяца;
 * если месяц текущий — сегодня.
 */
function snapshotDateForMonth(year, month, today) {
  today = today || new Date();
  if (today.getFullYear() === year && today.getMonth() === month) {
    return isoDate(today);
  }
  return monthBounds(year, month).to;
}

function monthNavHtml(ids) {
  ids = ids || {};
  var prevId = ids.prev || 'monthNavPrev';
  var nextId = ids.next || 'monthNavNext';
  var labelId = ids.label || 'monthNavLabel';
  return (
    '<div class="menu-calving-header month-nav">' +
    '<button type="button" id="' +
    prevId +
    '" class="menu-calving-nav-btn" aria-label="Предыдущий месяц">‹</button>' +
    '<span id="' +
    labelId +
    '" class="menu-calving-month-label">—</span>' +
    '<button type="button" id="' +
    nextId +
    '" class="menu-calving-nav-btn" aria-label="Следующий месяц">›</button>' +
    '</div>'
  );
}

export {
  formatMonthLabel,
  shiftMonth,
  monthBounds,
  snapshotDateForMonth,
  monthNavHtml
};
