/** __chatCtx part 2 */
import { getCalvingStatsForMonth } from '../calving-calc.js';
import { generateReport } from '../analytics-calc.js';
import { buildStallChecklist, entryHasStallCoords } from '../stall-inventory-core.js';

(function () {
  'use strict';
  var root = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this);
  var NS = root['__chatCtx'] = root['__chatCtx'] || {};
  var global = typeof window !== 'undefined' ? window : this;

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
  var ym = globalThis['__chatCtx'].parseMonthFromQuestion(questionText, refDate);
  var stats = getCalvingStatsForMonth(entries, ym.year, ym.month, refDate);
  var monthLabel = globalThis['__chatCtx'].formatMonthLabel(ym.year, ym.month);
  var lines = ['[Прогноз отёлов за месяц]'];
  lines.push('Период: ' + monthLabel + '.');
  lines.push('План (ожидаемые отёлы у стельных): ' + stats.plan.count + '.');
  if (stats.plan.items.length) lines.push('Список план: ' + globalThis['__chatCtx'].joinLimited(stats.plan.items, formatPlanItem) + '.');
  lines.push('Факт (отёлы по датам в месяце): ' + stats.fact.count + '.');
  if (stats.fact.items.length) lines.push('Список факт: ' + globalThis['__chatCtx'].joinLimited(stats.fact.items, formatFactItem) + '.');
  if (stats.fact.hasDataErrors) lines.push('В факте есть даты отёла в будущем — возможна ошибка ввода.');
  return lines.join('\n');
}

function buildAnalyticsSection(questionText, entries, deps) {
  var period = globalThis['__chatCtx'].parseAnalyticsPeriod(questionText);
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
  lines.push('Рекомендуется осеменить: ' + insem.length + (insem.length ? ' — ' + globalThis['__chatCtx'].joinLimited(insem, function (x) { return x; }) : '') + '.');
  lines.push('Запуск в сухостой: ' + dry.length + (dry.length ? ' — ' + globalThis['__chatCtx'].joinLimited(dry, function (x) { return x; }) : '') + '.');
  lines.push('УЗИ1 (осеменённые ≥32 дн.): ' + uzi1.length + (uzi1.length ? ' — ' + globalThis['__chatCtx'].joinLimited(uzi1, function (x) { return x; }) : '') + '.');
  lines.push('УЗИ2 (стельные ≥60 дн.): ' + uzi2.length + (uzi2.length ? ' — ' + globalThis['__chatCtx'].joinLimited(uzi2, function (x) { return x; }) : '') + '.');
  lines.push('Проверить отёл (стельность >275 дн.): ' + overdue.length + (overdue.length ? ' — ' + globalThis['__chatCtx'].joinLimited(overdue, function (x) { return x; }) : '') + '.');
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
      var taskDate = globalThis['__chatCtx'].formatDateKey(d);
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
  var range = globalThis['__chatCtx'].parseDateRangeFromQuestion(questionText, new Date());
  var protocols = deps.getProtocols ? deps.getProtocols() : [];
  var tasks = collectProtocolTasks(entries, protocols, range.from, range.to);
  var lines = ['[Планы / задачи по протоколам, ' + range.from + ' — ' + range.to + ']'];
  lines.push('Всего задач (инъекции): ' + tasks.length + '.');
  if (tasks.length) {
    lines.push('Список: ' + globalThis['__chatCtx'].joinLimited(tasks, function (t) {
      return t.date + ' №' + t.cattleId + ' — ' + t.drug + ' (' + t.protocolName + ')';
    }) + '.');
  }
  return lines.join('\n');
}

function buildUziSection(entries, refDate) {
  var dateStr = globalThis['__chatCtx'].formatDateKey(refDate);
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
  lines.push('УЗИ1: ' + uzi1.length + (uzi1.length ? ' — ' + globalThis['__chatCtx'].joinLimited(uzi1, function (x) { return x; }) : '') + '.');
  lines.push('УЗИ2: ' + uzi2.length + (uzi2.length ? ' — ' + globalThis['__chatCtx'].joinLimited(uzi2, function (x) { return x; }) : '') + '.');
  return lines.join('\n');
}

function buildInseminationListSection(questionText, entries, deps) {
  var range = globalThis['__chatCtx'].parseDateRangeFromQuestion(questionText, new Date());
  var protocols = deps.getProtocols ? deps.getProtocols() : [];
  var tasks = collectProtocolTasks(entries, protocols, range.from, range.to).filter(function (t) {
    return (t.drug || '').trim() === 'Осеменение';
  });
  var lines = ['[Список на осеменение по протоколу, ' + range.from + ' — ' + range.to + ']'];
  lines.push('Всего: ' + tasks.length + '.');
  if (tasks.length) {
    lines.push('Список: ' + globalThis['__chatCtx'].joinLimited(tasks, function (t) {
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
    lines.push('Без места: ' + globalThis['__chatCtx'].joinLimited(checklist.unassigned, function (u) {
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
    lines.push('Примеры: ' + globalThis['__chatCtx'].joinLimited(errors, function (err) {
      return '№' + (err.cattleId || '?') + ' — ' + (err.label || 'дата') + ' ' + (err.date || '');
    }) + '.');
  }
  return lines.join('\n');
}

var SECTION_BUILDERS = {
  herd: function (q, entries) { return globalThis['__chatCtx'].buildHerdSection(entries); },
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


  // register functions
  NS.formatPlanItem = formatPlanItem;
  NS.formatFactItem = formatFactItem;
  NS.buildCalvingSection = buildCalvingSection;
  NS.buildAnalyticsSection = buildAnalyticsSection;
  NS.parseDateLocal = parseDateLocal;
  NS.daysBetweenLocal = daysBetweenLocal;
  NS.getLastInsemDate = getLastInsemDate;
  NS.buildRecommendationsSection = buildRecommendationsSection;
  NS.collectProtocolTasks = collectProtocolTasks;
  NS.buildTasksSection = buildTasksSection;
  NS.buildUziSection = buildUziSection;
  NS.buildInseminationListSection = buildInseminationListSection;
  NS.buildStallSection = buildStallSection;
  NS.buildGroupsSection = buildGroupsSection;
  NS.buildSyncSection = buildSyncSection;
  NS.buildErrorsSection = buildErrorsSection;
  NS.state.SECTION_BUILDERS = SECTION_BUILDERS;
})();
export {};
