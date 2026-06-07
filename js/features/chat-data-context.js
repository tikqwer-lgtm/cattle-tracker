/**
 * chat-data-context.js — сводка данных стада для чат-консультанта.
 */
import { getCalvingStatsForMonth } from './calving-calc.js';

var MAX_LIST_ITEMS = 12;

var MONTH_NAME_PATTERNS = [
  ['январ', 0], ['феврал', 1], ['март', 2], ['апрел', 3],
  ['мая', 4], ['май', 4], ['июн', 5], ['июл', 6], ['август', 7],
  ['сентябр', 8], ['октябр', 9], ['ноябр', 10], ['декабр', 11]
];

function normalizeQuestion(text) {
  return String(text || '').toLowerCase().replace(/ё/g, 'е');
}

function isCalvingDataQuestion(text) {
  var q = normalizeQuestion(text);
  if (!/отел/.test(q)) return false;
  if (/сколько|скок|количество|число|план|факт|прогноз|предстоящ|ожидаем|будет|какие|какая|список/.test(q)) return true;
  if (/следующ|этом|текущ|прошл/.test(q) && /месяц/.test(q)) return true;
  return MONTH_NAME_PATTERNS.some(function (pair) { return q.indexOf(pair[0]) !== -1; });
}

function shiftMonth(year, month, delta) {
  var m = month + delta;
  var y = year;
  while (m > 11) { m -= 12; y += 1; }
  while (m < 0) { m += 12; y -= 1; }
  return { year: y, month: m };
}

function parseMonthFromQuestion(text, refDate) {
  refDate = refDate || new Date();
  var q = normalizeQuestion(text);
  var year = refDate.getFullYear();
  var month = refDate.getMonth();

  if (/следующ/.test(q) && /месяц/.test(q)) return shiftMonth(year, month, 1);
  if (/прошл/.test(q) && /месяц/.test(q)) return shiftMonth(year, month, -1);
  if (/этом|текущ/.test(q) && /месяц/.test(q)) return { year: year, month: month };

  var i;
  for (i = 0; i < MONTH_NAME_PATTERNS.length; i++) {
    if (q.indexOf(MONTH_NAME_PATTERNS[i][0]) !== -1) {
      month = MONTH_NAME_PATTERNS[i][1];
      var yearMatch = q.match(/\b(20\d{2})\b/);
      if (yearMatch) year = parseInt(yearMatch[1], 10);
      else if (month < refDate.getMonth()) year = refDate.getFullYear() + 1;
      return { year: year, month: month };
    }
  }

  if (/следующ/.test(q)) return shiftMonth(year, month, 1);
  return { year: year, month: month };
}

function formatMonthLabel(year, month) {
  try {
    return new Date(year, month, 1).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
  } catch (e) {
    return year + '-' + (month + 1);
  }
}

function countActiveEntries(entries, refDate) {
  refDate = refDate || new Date();
  var today = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate());
  var n = 0;
  (entries || []).forEach(function (entry) {
    if (!entry || !entry.cattleId) return;
    var ed = entry.exitDate ? new Date(entry.exitDate) : null;
    if (ed && !isNaN(ed.getTime()) && ed <= today) return;
    n += 1;
  });
  return n;
}

function formatPlanItem(it) {
  var nick = it.nickname ? ' (' + it.nickname + ')' : '';
  var overdue = it.overdue ? ', просрочено' : '';
  return '№' + it.cattleId + ' — ' + it.expectedDate + nick + overdue;
}

function formatFactItem(it) {
  var nick = it.nickname ? ' (' + it.nickname + ')' : '';
  var err = it.dataError ? ', ошибка даты' : '';
  return '№' + it.cattleId + ' — ' + it.calvingDate + nick + err;
}

function joinLimited(items, formatter) {
  if (!items.length) return '';
  var slice = items.slice(0, MAX_LIST_ITEMS).map(formatter).join('; ');
  if (items.length > MAX_LIST_ITEMS) slice += '; … ещё ' + (items.length - MAX_LIST_ITEMS);
  return slice;
}

/**
 * @param {string} questionText
 * @param {Array} entries
 * @param {Date} [refDate]
 * @returns {string|null}
 */
function buildChatDataContext(questionText, entries, refDate) {
  if (!isCalvingDataQuestion(questionText)) return null;
  refDate = refDate || new Date();
  entries = entries || [];

  if (!entries.length) {
    return 'Сводка данных стада: в программе нет загруженных записей о животных. ' +
      'Подскажи пользователю выбрать объект в настройках и при необходимости синхронизировать данные с сервером.';
  }

  var ym = parseMonthFromQuestion(questionText, refDate);
  var stats = getCalvingStatsForMonth(entries, ym.year, ym.month, refDate);
  var monthLabel = formatMonthLabel(ym.year, ym.month);
  var lines = [];

  lines.push('Сводка данных стада (уже посчитано программой — используй эти числа без изменений).');
  lines.push('Период: ' + monthLabel + '.');
  lines.push('План (ожидаемые отёлы у стельных): ' + stats.plan.count + '.');
  if (stats.plan.items.length) {
    lines.push('Список план: ' + joinLimited(stats.plan.items, formatPlanItem) + '.');
  }
  lines.push('Факт (отёлы по датам в этом месяце): ' + stats.fact.count + '.');
  if (stats.fact.items.length) {
    lines.push('Список факт: ' + joinLimited(stats.fact.items, formatFactItem) + '.');
  }
  if (stats.fact.hasDataErrors) {
    lines.push('Внимание: в факте есть даты отёла в будущем — возможна ошибка ввода в карточках.');
  }
  lines.push('Всего животных в учёте (не выбывших): ' + countActiveEntries(entries, refDate) + '.');

  return lines.join('\n');
}

if (typeof window !== 'undefined') {
  window.buildChatDataContext = buildChatDataContext;
  window.isCalvingDataQuestion = isCalvingDataQuestion;
}

export {
  normalizeQuestion,
  isCalvingDataQuestion,
  parseMonthFromQuestion,
  buildChatDataContext,
  formatMonthLabel,
  countActiveEntries
};
