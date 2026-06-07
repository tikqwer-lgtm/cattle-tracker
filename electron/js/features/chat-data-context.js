/**
 * chat-data-context.js — сводки данных стада для чат-консультанта (все блоки учёта).
 */
import { getCalvingStatsForMonth } from './calving-calc.js';
import { generateReport } from './analytics-calc.js';
import { buildStallChecklist, entryHasStallCoords } from './stall-inventory-core.js';

var MAX_LIST_ITEMS = 12;
var ANALYTICS_SETTINGS_KEY = 'cattleTracker_analytics_settings';
var STALL_LAYOUT_PREFIX = 'cattleTracker_stallLayout_';
var CURRENT_OBJECT_KEY = 'cattleTracker_currentObject';

var MONTH_NAME_PATTERNS = [
  ['январ', 0], ['феврал', 1], ['март', 2], ['апрел', 3],
  ['мая', 4], ['май', 4], ['июн', 5], ['июл', 6], ['август', 7],
  ['сентябр', 8], ['октябр', 9], ['ноябр', 10], ['декабр', 11]
];

var TOPICS = [
  {
    id: 'herd',
    match: function (q) {
      return /стад|сколько коров|всего коров|животн|голов|стельн|сухосто|осеменен|не осеменен|холост|брак|статистик/.test(q) &&
        /сколько|количество|число|процент|скок|всего|статистик|скольк/.test(q);
    }
  },
  {
    id: 'calving',
    match: function (q) {
      if (!/отел/.test(q)) return false;
      if (/сколько|скок|количество|число|план|факт|прогноз|предстоящ|ожидаем|будет|какие|какая|список/.test(q)) return true;
      if (/следующ|этом|текущ|прошл/.test(q) && /месяц/.test(q)) return true;
      return MONTH_NAME_PATTERNS.some(function (pair) { return q.indexOf(pair[0]) !== -1; });
    }
  },
  {
    id: 'analytics',
    match: function (q) {
      return /аналитик|показател|воспроизвод|интервальн|\bpr\b|\bcr\b|\bhdr\b|сервис.?период|оплодотвор|выявлен|нагрузк|пдо/.test(q);
    }
  },
  {
    id: 'recommendations',
    match: function (q) {
      return /рекоменд|напомин|кого осемен|нужно осемен|кому осемен|запуск|сухостой|проверить отел|просроч|дней лактац/.test(q) &&
        !/как ввести|где ввести|как записать/.test(q);
    }
  },
  {
    id: 'uzi',
    match: function (q) { return /узи1|узи2|\bузи\b/.test(q); }
  },
  {
    id: 'insemination_list',
    match: function (q) { return /список на осеменен|на осеменение по протоколу|осеменение по протоколу/.test(q); }
  },
  {
    id: 'tasks',
    match: function (q) { return /задач|инъекц|препарат/.test(q) && /протокол|план|сегодня|завтра|недел/.test(q); }
  },
  {
    id: 'stall',
    match: function (q) { return /стойл|стойломест|мест[ао]|двор|инвентар|схем|без места|нераспредел|рассадк/.test(q); }
  },
  {
    id: 'groups',
    match: function (q) { return /групп|по группам/.test(q) && /сколько|количество|список|какие|какая|всего/.test(q); }
  },
  {
    id: 'sync',
    match: function (q) {
      return /синхрон|несинхрон|не синхрон/.test(q) &&
        /сколько|количество|число|остал|не синхрониз|несинхрониз|запис/.test(q) &&
        !/как синхрон|как настроить|где синхрон|настроить синхрон/.test(q);
    }
  },
  {
    id: 'errors',
    match: function (q) { return /ошибк|дата в будущ|некорректн.*дат|проверь.*дат/.test(q); }
  }
];

var TYPO_REPLACEMENTS = [
  [/сколко|скольо|скока/g, 'сколько'],
  [/ател/g, 'отел'],
  [/стелных/g, 'стельн'],
  [/сухастой/g, 'сухостой']
];

function normalizeQuestion(text) {
  var q = String(text || '').toLowerCase().replace(/ё/g, 'е');
  TYPO_REPLACEMENTS.forEach(function (pair) {
    q = q.replace(pair[0], pair[1]);
  });
  return q;
}

function looksLikeDataQuestion(q) {
  return /сколько|количество|скок|список|показател|стельн|отел|осемен|сухосто|узи|протокол|стойл|голов|животн|\bpr\b|\bcr\b|\bhdr\b|план|факт|групп|задач|инъекц/.test(q);
}

/**
 * @param {string} questionText
 * @param {string[]} [topics]
 * @param {Date} [refDate]
 * @returns {string[]}
 */
function detectQuestionWarnings(questionText, topics, refDate) {
  var q = normalizeQuestion(questionText);
  topics = topics || detectChatDataTopics(questionText);
  refDate = refDate || new Date();
  var warnings = [];

  if (/следующ/.test(q) && /прошл/.test(q)) {
    warnings.push(
      'В вопросе одновременно «следующий» и «прошлый» период. Для расчёта взят следующий период (он проверяется раньше). Уточните один период, если нужна другая цифра.'
    );
  } else if (/следующ/.test(q) && /этом|текущ/.test(q) && /месяц/.test(q)) {
    warnings.push('Указаны и текущий, и следующий месяц — для отёлов использован следующий месяц.');
  }

  var namedMonths = [];
  MONTH_NAME_PATTERNS.forEach(function (pair) {
    if (q.indexOf(pair[0]) !== -1 && !namedMonths.some(function (m) { return m.month === pair[1]; })) {
      namedMonths.push({ month: pair[1] });
    }
  });
  if (namedMonths.length > 1 && topics.indexOf('calving') !== -1) {
    var usedYm = parseMonthFromQuestion(questionText, refDate);
    warnings.push(
      'Упомянуто несколько месяцев — для отёлов взят первый найденный в тексте: ' +
      formatMonthLabel(usedYm.year, usedYm.month) + '.'
    );
  }

  if (/стельн/.test(q) && /холост/.test(q)) {
    warnings.push('«Стельные» и «холостые» — разные статусы; в ответе нужны две отдельные цифры, не суммировать.');
  }

  if (/сегодня/.test(q) && /завтра/.test(q) &&
    (topics.indexOf('tasks') !== -1 || topics.indexOf('insemination_list') !== -1)) {
    warnings.push('Указаны и «сегодня», и «завтра» — для задач использована дата «завтра» (приоритет в разборе).');
  }

  if (/план/.test(q) && /факт/.test(q) && topics.indexOf('calving') === -1 && /отел/.test(q)) {
    warnings.push('Запрошены план и факт отёлов — убедитесь, что вопрос про прогноз отёлов за конкретный месяц.');
  }

  if (looksLikeDataQuestion(q) && !topics.length) {
    warnings.push(
      'Вопрос похож на запрос данных стада, но блок не распознан (возможна опечатка или необычная формулировка). ' +
      'Примеры: «Сколько стельных?», «Отёлы в июле», «PR за месяц», «Задачи на сегодня».'
    );
  }

  return warnings;
}

function detectChatDataTopics(questionText) {
  var q = normalizeQuestion(questionText);
  var out = [];
  TOPICS.forEach(function (topic) {
    if (topic.match(q)) out.push(topic.id);
  });
  return out;
}

function isCalvingDataQuestion(text) {
  return TOPICS.find(function (t) { return t.id === 'calving'; }).match(normalizeQuestion(text));
}

function isDataQuestion(text) {
  return detectChatDataTopics(text).length > 0;
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

function formatDateKey(refDate) {
  var d = refDate || new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function parseDateRangeFromQuestion(text, refDate) {
  refDate = refDate || new Date();
  var q = normalizeQuestion(text);
  var today = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate());

  function fmt(dt) {
    return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
  }

  if (/завтра/.test(q)) {
    var tmr = new Date(today);
    tmr.setDate(tmr.getDate() + 1);
    return { from: fmt(tmr), to: fmt(tmr) };
  }
  if (/недел/.test(q)) {
    var end = new Date(today);
    end.setDate(end.getDate() + 7);
    return { from: fmt(today), to: fmt(end) };
  }
  var todayStr = fmt(today);
  if (/сегодня/.test(q)) return { from: todayStr, to: todayStr };
  if (/задач|инъекц|протокол|план/.test(q)) {
    var weekEnd = new Date(today);
    weekEnd.setDate(weekEnd.getDate() + 7);
    return { from: todayStr, to: fmt(weekEnd) };
  }
  return { from: todayStr, to: todayStr };
}

function parseAnalyticsPeriod(text) {
  var q = normalizeQuestion(text);
  if (/квартал/.test(q)) return 'quarter';
  if (/год|за год/.test(q)) return 'year';
  if (/все время|за все|весь период/.test(q)) return 'all';
  return 'month';
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

function joinLimited(items, formatter) {
  if (!items.length) return '';
  var slice = items.slice(0, MAX_LIST_ITEMS).map(formatter).join('; ');
  if (items.length > MAX_LIST_ITEMS) slice += '; … ещё ' + (items.length - MAX_LIST_ITEMS);
  return slice;
}

function statusIncludes(status, fragment) {
  return (status || '').toString().toLowerCase().indexOf(fragment) !== -1;
}

function buildHerdSection(entries) {
  var total = entries.length;
  var pregnant = entries.filter(function (e) { return statusIncludes(e.status, 'стельн'); }).length;
  var dry = entries.filter(function (e) { return statusIncludes(e.status, 'сухосто'); }).length;
  var inseminated = entries.filter(function (e) { return statusIncludes(e.status, 'осеменен'); }).length;
  var cull = entries.filter(function (e) { return statusIncludes(e.status, 'брак'); }).length;
  var notInseminated = entries.filter(function (e) {
    return !e.status || statusIncludes(e.status, 'холост');
  }).length;
  function pct(n) { return total ? Math.round((n / total) * 100) : 0; }

  var lines = ['[Статистика стада на главном экране]'];
  lines.push('Всего животных: ' + total + '.');
  lines.push('Стельные: ' + pregnant + ' (' + pct(pregnant) + '%).');
  lines.push('Осеменённые: ' + inseminated + ' (' + pct(inseminated) + '%).');
  lines.push('В сухостое: ' + dry + ' (' + pct(dry) + '%).');
  lines.push('На брак: ' + cull + ' (' + pct(cull) + '%).');
  lines.push('Не осеменённые (холостые): ' + notInseminated + ' (' + pct(notInseminated) + '%).');
  return lines.join('\n');
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

function buildCalvingSection(questionText, entries, refDate) {
  var ym = parseMonthFromQuestion(questionText, refDate);
  var stats = getCalvingStatsForMonth(entries, ym.year, ym.month, refDate);
  var monthLabel = formatMonthLabel(ym.year, ym.month);
  var lines = ['[Прогноз отёлов за месяц]'];
  lines.push('Период: ' + monthLabel + '.');
  lines.push('План (ожидаемые отёлы у стельных): ' + stats.plan.count + '.');
  if (stats.plan.items.length) lines.push('Список план: ' + joinLimited(stats.plan.items, formatPlanItem) + '.');
  lines.push('Факт (отёлы по датам в месяце): ' + stats.fact.count + '.');
  if (stats.fact.items.length) lines.push('Список факт: ' + joinLimited(stats.fact.items, formatFactItem) + '.');
  if (stats.fact.hasDataErrors) lines.push('В факте есть даты отёла в будущем — возможна ошибка ввода.');
  return lines.join('\n');
}

function buildAnalyticsSection(questionText, entries, deps) {
  var period = parseAnalyticsPeriod(questionText);
  var pdo = deps.getAnalyticsPdo ? deps.getAnalyticsPdo() : 50;
  var report = generateReport(period, null, null, pdo, entries);
  var periodLabel = period === 'month' ? 'месяц' : (period === 'quarter' ? 'квартал' : (period === 'year' ? 'год' : 'всё время'));
  var lines = ['[Аналитика / воспроизводство, период: ' + periodLabel + ', ПДО ' + pdo + ' дн.]'];
  lines.push('Коров в расчёте: ' + report.totalCows + '.');
  lines.push('PR (показатель воспроизводства): ' + report.pr + '%.');
  lines.push('CR (оплодотворяемость): ' + report.cr + '%.');
  lines.push('HDR (выявленная охота): ' + report.hdr + '%.');
  lines.push('Сервис-период (средний): ' + (report.servicePeriodDays != null ? report.servicePeriodDays + ' дн.' : 'нет данных') + '.');
  lines.push('Осеменено голов за период: ' + report.inseminatedCount + ', осеменений всего: ' + report.totalInseminations + ', стельных в расчёте: ' + report.pregnantCount + '.');
  return lines.join('\n');
}

function parseDateLocal(str) {
  if (!str) return null;
  var d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

function daysBetweenLocal(from, to) {
  if (!from || !to) return null;
  var a = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  var b = typeof to === 'string' ? parseDateLocal(to) : new Date(to.getFullYear(), to.getMonth(), to.getDate());
  if (!b) return null;
  return Math.round((b - a) / (24 * 60 * 60 * 1000));
}

function getLastInsemDate(entry) {
  var hist = entry.inseminationHistory;
  if (Array.isArray(hist) && hist.length > 0) {
    var dates = hist.map(function (h) { return h && h.date; }).filter(Boolean);
    if (dates.length) return dates.reduce(function (a, b) { return a > b ? a : b; });
  }
  return entry.inseminationDate || null;
}

function buildRecommendationsSection(entries, refDate, deps) {
  var today = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate());
  var vwpDays = deps.getFarmVwpDays ? deps.getFarmVwpDays() : 60;
  var getDaysInLactation = deps.getDaysInLactation;
  var getDaysPregnant = deps.getDaysPregnant;
  var insem = [];
  var dry = [];
  var uzi1 = [];
  var uzi2 = [];
  var overdue = [];

  entries.forEach(function (entry) {
    if (!entry || !entry.cattleId) return;
    var exitDate = parseDateLocal(entry.exitDate);
    if (exitDate && exitDate <= today) return;
    var statusStr = (entry.status || '').toString();
    var cattleId = entry.cattleId;
    var calvingDate = parseDateLocal(entry.calvingDate);
    var lastInsem = getLastInsemDate(entry);
    var lastInsemD = parseDateLocal(lastInsem);

    if (statusStr.indexOf('Стельная') !== -1 && lastInsemD) {
      var exp = new Date(lastInsemD);
      exp.setDate(exp.getDate() + 280);
      var daysPreg = getDaysPregnant ? getDaysPregnant(entry) : daysBetweenLocal(lastInsemD, today);
      if (daysPreg !== null && daysPreg > 275) overdue.push('№' + cattleId + ' (' + daysPreg + ' дн. стельности)');
    }

    var daysSinceCalving = calvingDate ? daysBetweenLocal(calvingDate, today) : 0;
    var daysInLactation = getDaysInLactation ? getDaysInLactation(entry) : daysSinceCalving;
    var otelFirstVwpOnly = statusStr.indexOf('Отёл') !== -1 && (daysSinceCalving < vwpDays || !calvingDate);
    var excludeInsem = statusStr.indexOf('Стельная') !== -1 || statusStr.indexOf('Брак') !== -1 || otelFirstVwpOnly;
    var hasInsemHist = Array.isArray(entry.inseminationHistory) && entry.inseminationHistory.length > 0;
    if (calvingDate && !entry.inseminationDate && !hasInsemHist && !excludeInsem && daysInLactation != null && daysInLactation > vwpDays) {
      insem.push('№' + cattleId + ' (день лактации ' + daysInLactation + ')');
    }

    var dryStartDate = parseDateLocal(entry.dryStartDate);
    var alreadyDry = statusStr.indexOf('Сухостой') !== -1 || (dryStartDate && dryStartDate <= today);
    if (!alreadyDry && statusStr.indexOf('Стельная') !== -1 && lastInsemD) {
      var expCalv = new Date(lastInsemD);
      expCalv.setDate(expCalv.getDate() + 280);
      if (expCalv >= today) {
        var dryOffDue = daysBetweenLocal(today, expCalv);
        if (dryOffDue !== null && dryOffDue <= vwpDays && dryOffDue >= vwpDays - 14) {
          dry.push('№' + cattleId + ' (отёл через ~' + dryOffDue + ' дн.)');
        }
      }
    }

    var uziHist = entry.uziHistory || [];
    if (statusStr.indexOf('Осеменен') !== -1 && lastInsemD) {
      var daysFromInsem = daysBetweenLocal(lastInsemD, today);
      if (daysFromInsem !== null && daysFromInsem >= 32) {
        var hasUzi = uziHist.some(function (u) {
          var ud = parseDateLocal(u.date);
          return ud && ud >= lastInsemD;
        });
        if (!hasUzi) uzi1.push('№' + cattleId + ' (' + daysFromInsem + ' дн. после осеменения)');
      }
    }
    if (statusStr.indexOf('Стельная') !== -1 && uziHist.length === 1 && lastInsemD) {
      var daysFromInsem2 = daysBetweenLocal(lastInsemD, today);
      if (daysFromInsem2 !== null && daysFromInsem2 >= 60) {
        uzi2.push('№' + cattleId + ' (' + daysFromInsem2 + ' дн. стельности)');
      }
    }
  });

  var lines = ['[Рекомендации / уведомления (ПДО ' + vwpDays + ' дн.)]'];
  lines.push('Рекомендуется осеменить: ' + insem.length + (insem.length ? ' — ' + joinLimited(insem, function (x) { return x; }) : '') + '.');
  lines.push('Запуск в сухостой: ' + dry.length + (dry.length ? ' — ' + joinLimited(dry, function (x) { return x; }) : '') + '.');
  lines.push('УЗИ1 (осеменённые ≥32 дн.): ' + uzi1.length + (uzi1.length ? ' — ' + joinLimited(uzi1, function (x) { return x; }) : '') + '.');
  lines.push('УЗИ2 (стельные ≥60 дн.): ' + uzi2.length + (uzi2.length ? ' — ' + joinLimited(uzi2, function (x) { return x; }) : '') + '.');
  lines.push('Проверить отёл (стельность >275 дн.): ' + overdue.length + (overdue.length ? ' — ' + joinLimited(overdue, function (x) { return x; }) : '') + '.');
  return lines.join('\n');
}

function collectProtocolTasks(entries, protocols, fromDate, toDate) {
  var byName = {};
  (protocols || []).forEach(function (p) { byName[p.name || p.id] = p; });
  var from = fromDate ? new Date(fromDate).getTime() : 0;
  var to = toDate ? new Date(toDate).getTime() : Number.MAX_SAFE_INTEGER;
  var tasks = [];
  (entries || []).forEach(function (entry) {
    var protocol = entry.protocol;
    if (!protocol || !protocol.name || !protocol.startDate) return;
    var def = byName[protocol.name];
    if (!def || !def.steps || !def.steps.length) return;
    var start = parseDateLocal(protocol.startDate);
    if (!start) return;
    def.steps.forEach(function (step) {
      var d = new Date(start);
      d.setDate(d.getDate() + (parseInt(step.day, 10) || 0));
      var taskDate = formatDateKey(d);
      var taskTime = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      if (taskTime >= from && taskTime <= to) {
        tasks.push({
          date: taskDate,
          cattleId: entry.cattleId || '',
          group: entry.group || '',
          drug: (step.drug || '').trim() || '—',
          protocolName: protocol.name
        });
      }
    });
  });
  tasks.sort(function (a, b) { return a.date.localeCompare(b.date); });
  return tasks;
}

function buildTasksSection(questionText, entries, deps) {
  var range = parseDateRangeFromQuestion(questionText, new Date());
  var protocols = deps.getProtocols ? deps.getProtocols() : [];
  var tasks = collectProtocolTasks(entries, protocols, range.from, range.to);
  var lines = ['[Планы / задачи по протоколам, ' + range.from + ' — ' + range.to + ']'];
  lines.push('Всего задач (инъекции): ' + tasks.length + '.');
  if (tasks.length) {
    lines.push('Список: ' + joinLimited(tasks, function (t) {
      return t.date + ' №' + t.cattleId + ' — ' + t.drug + ' (' + t.protocolName + ')';
    }) + '.');
  }
  return lines.join('\n');
}

function buildUziSection(entries, refDate) {
  var dateStr = formatDateKey(refDate);
  var uzi1 = [];
  var uzi2 = [];
  entries.forEach(function (entry) {
    var status = (entry.status || '').toString();
    var lastInsem = getLastInsemDate(entry);
    var uziHist = entry.uziHistory || [];
    if (status.indexOf('Осеменен') !== -1 && lastInsem) {
      var daysFrom = daysBetweenLocal(lastInsem, dateStr);
      if (daysFrom !== null && daysFrom >= 32) {
        var hasUzi = uziHist.some(function (u) {
          var ud = parseDateLocal(u.date);
          return ud && ud >= parseDateLocal(lastInsem);
        });
        if (!hasUzi) uzi1.push('№' + entry.cattleId + ' (' + daysFrom + ' дн.)');
      }
    }
    if (status.indexOf('Стельная') !== -1 && uziHist.length === 1 && lastInsem) {
      var daysPreg = daysBetweenLocal(lastInsem, dateStr);
      if (daysPreg !== null && daysPreg >= 60) uzi2.push('№' + entry.cattleId + ' (' + daysPreg + ' дн.)');
    }
  });
  var lines = ['[Списки УЗИ на ' + dateStr + ']'];
  lines.push('УЗИ1: ' + uzi1.length + (uzi1.length ? ' — ' + joinLimited(uzi1, function (x) { return x; }) : '') + '.');
  lines.push('УЗИ2: ' + uzi2.length + (uzi2.length ? ' — ' + joinLimited(uzi2, function (x) { return x; }) : '') + '.');
  return lines.join('\n');
}

function buildInseminationListSection(questionText, entries, deps) {
  var range = parseDateRangeFromQuestion(questionText, new Date());
  var protocols = deps.getProtocols ? deps.getProtocols() : [];
  var tasks = collectProtocolTasks(entries, protocols, range.from, range.to).filter(function (t) {
    return (t.drug || '').trim() === 'Осеменение';
  });
  var lines = ['[Список на осеменение по протоколу, ' + range.from + ' — ' + range.to + ']'];
  lines.push('Всего: ' + tasks.length + '.');
  if (tasks.length) {
    lines.push('Список: ' + joinLimited(tasks, function (t) {
      return t.date + ' №' + t.cattleId + ' (' + t.protocolName + ')';
    }) + '.');
  }
  return lines.join('\n');
}

function buildStallSection(entries, deps) {
  var layout = deps.getStallLayout ? deps.getStallLayout() : { yards: {} };
  var checklist = buildStallChecklist(layout, entries);
  var withCoords = entries.filter(function (e) { return e && entryHasStallCoords(e); }).length;
  var lines = ['[Схема стойломест / инвентаризация]'];
  lines.push('Животных с координатами стойла: ' + withCoords + ' из ' + entries.length + '.');
  lines.push('Без места (нераспределённые): ' + checklist.unassigned.length + '.');
  lines.push('Занятых ячеек: ' + checklist.occupiedCells.length + '.');
  lines.push('Дублей координат: ' + checklist.duplicateWarnings.length + '.');
  if (checklist.unassigned.length) {
    lines.push('Без места: ' + joinLimited(checklist.unassigned, function (u) {
      return '№' + u.cattleId;
    }) + '.');
  }
  return lines.join('\n');
}

function buildGroupsSection(entries) {
  var counts = {};
  entries.forEach(function (e) {
    var g = (e.group || '').trim() || '—';
    counts[g] = (counts[g] || 0) + 1;
  });
  var keys = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; });
  var lines = ['[Распределение по группам]'];
  lines.push('Групп: ' + keys.length + '.');
  keys.forEach(function (k) {
    lines.push('«' + k + '»: ' + counts[k] + ' гол.');
  });
  return lines.join('\n');
}

function buildSyncSection(entries, deps) {
  var useApi = deps.useApi === true;
  if (useApi) return '[Синхронизация]\nДанные загружаются с сервера — локальный счётчик несинхронизированных записей не применим.';
  var unsynced = entries.filter(function (e) { return e.synced !== true; }).length;
  return '[Синхронизация]\nНе синхронизировано записей: ' + unsynced + '.';
}

function buildErrorsSection(entries, refDate, deps) {
  var scan = deps.scanAllDataErrors;
  if (!scan) return '[Ошибки в данных]\nПроверка дат недоступна в этой среде.';
  var errors = scan(entries, refDate);
  var lines = ['[Ошибки в данных (даты в будущем)]'];
  lines.push('Всего ошибок: ' + errors.length + '.');
  if (errors.length) {
    lines.push('Примеры: ' + joinLimited(errors, function (err) {
      return '№' + (err.cattleId || '?') + ' — ' + (err.label || 'дата') + ' ' + (err.date || '');
    }) + '.');
  }
  return lines.join('\n');
}

var SECTION_BUILDERS = {
  herd: function (q, entries) { return buildHerdSection(entries); },
  calving: function (q, entries, refDate) { return buildCalvingSection(q, entries, refDate); },
  analytics: function (q, entries, refDate, deps) { return buildAnalyticsSection(q, entries, deps); },
  recommendations: function (q, entries, refDate, deps) { return buildRecommendationsSection(entries, refDate, deps); },
  tasks: function (q, entries, refDate, deps) { return buildTasksSection(q, entries, deps); },
  uzi: function (q, entries, refDate) { return buildUziSection(entries, refDate); },
  insemination_list: function (q, entries, refDate, deps) { return buildInseminationListSection(q, entries, deps); },
  stall: function (q, entries, refDate, deps) { return buildStallSection(entries, deps); },
  groups: function (q, entries) { return buildGroupsSection(entries); },
  sync: function (q, entries, refDate, deps) { return buildSyncSection(entries, deps); },
  errors: function (q, entries, refDate, deps) { return buildErrorsSection(entries, refDate, deps); }
};

function defaultDeps() {
  var g = typeof window !== 'undefined' ? window : {};
  return {
    getProtocols: function () { return typeof g.getProtocols === 'function' ? g.getProtocols() : []; },
    getFarmVwpDays: function () { return typeof g.getFarmVwpDays === 'function' ? g.getFarmVwpDays() : 60; },
    getDaysPregnant: function (e) { return typeof g.getDaysPregnant === 'function' ? g.getDaysPregnant(e) : null; },
    getDaysInLactation: function (e) { return typeof g.getDaysInLactation === 'function' ? g.getDaysInLactation(e) : null; },
    scanAllDataErrors: function (entries, refDate) {
      return typeof g.scanAllDataErrors === 'function' ? g.scanAllDataErrors(entries, refDate) : [];
    },
    useApi: !!(g.CATTLE_TRACKER_USE_API),
    getAnalyticsPdo: function () {
      try {
        if (typeof localStorage !== 'undefined') {
          var raw = localStorage.getItem(ANALYTICS_SETTINGS_KEY);
          if (raw) {
            var o = JSON.parse(raw);
            if (o && o.pdo !== undefined) return parseInt(o.pdo, 10) || 50;
          }
        }
      } catch (e) {}
      return 50;
    },
    getStallLayout: function () {
      try {
        if (typeof localStorage !== 'undefined') {
          var oid = localStorage.getItem(CURRENT_OBJECT_KEY) || '';
          var raw = localStorage.getItem(STALL_LAYOUT_PREFIX + oid);
          if (raw) return JSON.parse(raw);
        }
      } catch (e) {}
      return { yards: {} };
    }
  };
}

/**
 * @param {string} questionText
 * @param {Array} entries
 * @param {Date} [refDate]
 * @param {object} [deps]
 * @returns {string|null}
 */
function buildChatDataContext(questionText, entries, refDate, deps) {
  refDate = refDate || new Date();
  entries = entries || [];
  deps = deps || defaultDeps();
  var topics = detectChatDataTopics(questionText);
  var warnings = detectQuestionWarnings(questionText, topics, refDate);

  if (!topics.length) {
    if (!warnings.length) return null;
    return 'Сводка по данным не сформирована.\n\n[Замечания к вопросу]\n' + warnings.join('\n');
  }

  if (!entries.length) {
    var emptyMsg = 'Сводка данных стада: в программе нет загруженных записей о животных. ' +
      'Подскажи пользователю выбрать объект в настройках и при необходимости синхронизировать данные с сервером.';
    if (warnings.length) emptyMsg += '\n\n[Замечания к вопросу]\n' + warnings.join('\n');
    return emptyMsg;
  }

  var sections = [];
  topics.forEach(function (topicId) {
    var builder = SECTION_BUILDERS[topicId];
    if (builder) {
      var section = builder(questionText, entries, refDate, deps);
      if (section) sections.push(section);
    }
  });

  if (!sections.length) return null;

  if (warnings.length) {
    sections.unshift('[Замечания к вопросу]\n' + warnings.join('\n'));
  }

  return 'Сводка данных стада (посчитано программой — используй эти числа без изменений).\n\n' +
    sections.join('\n\n');
}

if (typeof window !== 'undefined') {
  window.buildChatDataContext = buildChatDataContext;
  window.isCalvingDataQuestion = isCalvingDataQuestion;
  window.isDataQuestion = isDataQuestion;
  window.detectChatDataTopics = detectChatDataTopics;
  window.detectQuestionWarnings = detectQuestionWarnings;
}

export {
  normalizeQuestion,
  isCalvingDataQuestion,
  isDataQuestion,
  detectChatDataTopics,
  detectQuestionWarnings,
  looksLikeDataQuestion,
  parseMonthFromQuestion,
  parseDateRangeFromQuestion,
  buildChatDataContext,
  formatMonthLabel,
  countActiveEntries,
  collectProtocolTasks,
  buildHerdSection
};
