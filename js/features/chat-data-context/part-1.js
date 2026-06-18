/** __chatCtx part 1 */
(function () {
  'use strict';
  var root = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this);
  var NS = root['__chatCtx'] = root['__chatCtx'] || {};
  var global = typeof window !== 'undefined' ? window : this;

var MONTH_NAME_PATTERNS = [
  ['январ', 0], ['феврал', 1], ['март', 2], ['апрел', 3],
  ['мая', 4], ['май', 4], ['июн', 5], ['июл', 6], ['август', 7],
  ['сентябр', 8], ['октябр', 9], ['ноябр', 10], ['декабр', 11]
];

var TOPICS = [
  {
    id: 'whats_next',
    match: function (q) {
      return /что дальше|что далее|какие планы|предстоящ|что на очереди|ближайш/.test(q);
    }
  },
  {
    id: 'daily_plan',
    match: function (q) {
      return /дай план|план на день|задачи на день|расписание на день/.test(q);
    }
  },
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
    return { from: globalThis['__chatCtx'].fmt(tmr), to: globalThis['__chatCtx'].fmt(tmr) };
  }
  if (/недел/.test(q)) {
    var end = new Date(today);
    end.setDate(end.getDate() + 7);
    return { from: globalThis['__chatCtx'].fmt(today), to: globalThis['__chatCtx'].fmt(end) };
  }
  var todayStr = globalThis['__chatCtx'].fmt(today);
  if (/сегодня/.test(q)) return { from: todayStr, to: todayStr };
  if (/задач|инъекц|протокол|план/.test(q)) {
    var weekEnd = new Date(today);
    weekEnd.setDate(weekEnd.getDate() + 7);
    return { from: todayStr, to: globalThis['__chatCtx'].fmt(weekEnd) };
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
  var slice = items.slice(0, globalThis['__chatCtx'].state.MAX_LIST_ITEMS).map(formatter).join('; ');
  if (items.length > globalThis['__chatCtx'].state.MAX_LIST_ITEMS) slice += '; … ещё ' + (items.length - globalThis['__chatCtx'].state.MAX_LIST_ITEMS);
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


  // register functions
  NS.normalizeQuestion = normalizeQuestion;
  NS.looksLikeDataQuestion = looksLikeDataQuestion;
  NS.detectQuestionWarnings = detectQuestionWarnings;
  NS.detectChatDataTopics = detectChatDataTopics;
  NS.isCalvingDataQuestion = isCalvingDataQuestion;
  NS.isDataQuestion = isDataQuestion;
  NS.shiftMonth = shiftMonth;
  NS.parseMonthFromQuestion = parseMonthFromQuestion;
  NS.formatMonthLabel = formatMonthLabel;
  NS.formatDateKey = formatDateKey;
  NS.parseDateRangeFromQuestion = parseDateRangeFromQuestion;
  NS.parseAnalyticsPeriod = parseAnalyticsPeriod;
  NS.countActiveEntries = countActiveEntries;
  NS.joinLimited = joinLimited;
  NS.statusIncludes = statusIncludes;
  NS.buildHerdSection = buildHerdSection;
})();
export {};
