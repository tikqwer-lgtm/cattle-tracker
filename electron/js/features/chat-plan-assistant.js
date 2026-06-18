/**
 * chat-plan-assistant.js — планы работ (уколы, УЗИ, осеменения) для чат-консультанта.
 */
(function (global) {
  'use strict';

  var SETTINGS_KEY = 'cattleTracker_chatAssistantSettings';
  var ANNOUNCED_KEY = 'cattleTracker_chatPlanAnnounced';

  var DEFAULT_SETTINGS = {
    planHints: true,
    overdueHints: true,
    dailyPlanHints: true
  };

  function parseDateLocal(str) {
    if (!str) return null;
    var d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
  }

  function formatDateKey(refDate) {
    var d = refDate || new Date();
    if (typeof d === 'string') return String(d).slice(0, 10);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function addDaysToKey(dateKey, delta) {
    var d = parseDateLocal(dateKey);
    if (!d) return dateKey;
    d.setDate(d.getDate() + delta);
    return formatDateKey(d);
  }

  function daysBetween(from, to) {
    if (!from || !to) return null;
    var a = parseDateLocal(from);
    var b = parseDateLocal(to);
    if (!a || !b) return null;
    a = new Date(a.getFullYear(), a.getMonth(), a.getDate());
    b = new Date(b.getFullYear(), b.getMonth(), b.getDate());
    return Math.round((b - a) / (24 * 60 * 60 * 1000));
  }

  function formatDateRu(dateKey) {
    var d = parseDateLocal(dateKey);
    if (!d) return dateKey;
    try {
      return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch (e) {
      return dateKey;
    }
  }

  function normalizeQuestion(text) {
    if (global.__chatCtx && typeof global.__chatCtx.normalizeQuestion === 'function') {
      return global.__chatCtx.normalizeQuestion(text);
    }
    return String(text || '').toLowerCase().replace(/ё/g, 'е').trim();
  }

  function getLastInsemDate(entry) {
    if (global.__chatCtx && typeof global.__chatCtx.getLastInsemDate === 'function') {
      return global.__chatCtx.getLastInsemDate(entry);
    }
    var hist = entry.inseminationHistory;
    if (Array.isArray(hist) && hist.length > 0) {
      var dates = hist.map(function (h) { return h && h.date; }).filter(Boolean);
      if (dates.length) return dates.reduce(function (a, b) { return a > b ? a : b; });
    }
    return entry.inseminationDate || null;
  }

  function getProtocols() {
    return typeof global.getProtocols === 'function' ? global.getProtocols() : [];
  }

  function getFarmVwpDays() {
    return typeof global.getFarmVwpDays === 'function' ? global.getFarmVwpDays() : 60;
  }

  function isActiveEntry(entry, todayKey) {
    if (!entry || !entry.cattleId) return false;
    var exit = parseDateLocal(entry.exitDate);
    var today = parseDateLocal(todayKey);
    if (exit && today && exit <= today) return false;
    return true;
  }

  function hasInseminationOnOrAfter(entry, dateKey) {
    var taskD = parseDateLocal(dateKey);
    if (!taskD) return false;
    var hist = entry.inseminationHistory;
    if (Array.isArray(hist)) {
      for (var i = 0; i < hist.length; i++) {
        var hd = parseDateLocal(hist[i] && hist[i].date);
        if (hd && hd >= taskD) return true;
      }
    }
    var id = parseDateLocal(entry.inseminationDate);
    return !!(id && id >= taskD);
  }

  function hasUziAfterInsem(entry, lastInsem) {
    var insemD = parseDateLocal(lastInsem);
    if (!insemD) return false;
    var uziHist = entry.uziHistory || [];
    return uziHist.some(function (u) {
      var ud = parseDateLocal(u && u.date);
      return ud && ud >= insemD;
    });
  }

  function isPlanItemDone(entry, item) {
    if (!entry || !item) return true;
    if (item.kind === 'insemination_protocol' || (item.kind === 'injection' && item.drug === 'Осеменение')) {
      return hasInseminationOnOrAfter(entry, item.date);
    }
    if (item.kind === 'injection') {
      var p = entry.protocol;
      if (!p || !p.name || p.name !== item.protocolName) return true;
      if (String(p.startDate || '') !== String(item.protocolStartDate || '')) return true;
      return false;
    }
    if (item.kind === 'uzi1') {
      return hasUziAfterInsem(entry, item.lastInsemDate);
    }
    if (item.kind === 'uzi2') {
      var uziHist = entry.uziHistory || [];
      var insemD = parseDateLocal(item.lastInsemDate);
      if (!insemD) return false;
      var after = uziHist.filter(function (u) {
        var ud = parseDateLocal(u && u.date);
        return ud && ud >= insemD;
      });
      return after.length >= 2;
    }
    if (item.kind === 'insemination_recommend') {
      return hasInseminationOnOrAfter(entry, item.date) || !!(entry.inseminationDate) ||
        (Array.isArray(entry.inseminationHistory) && entry.inseminationHistory.length > 0);
    }
    return false;
  }

  function collectProtocolPlanItems(entries, fromKey, toKey) {
    var protocols = getProtocols();
    var byName = {};
    protocols.forEach(function (p) { byName[p.name || p.id] = p; });
    var fromT = parseDateLocal(fromKey);
    var toT = parseDateLocal(toKey);
    if (!fromT || !toT) return [];
    fromT = new Date(fromT.getFullYear(), fromT.getMonth(), fromT.getDate()).getTime();
    toT = new Date(toT.getFullYear(), toT.getMonth(), toT.getDate()).getTime();
    var out = [];

    (entries || []).forEach(function (entry) {
      if (!isActiveEntry(entry, toKey)) return;
      var protocol = entry.protocol;
      if (!protocol || !protocol.name || !protocol.startDate) return;
      var def = byName[protocol.name];
      if (!def || !def.steps || !def.steps.length) return;
      var start = parseDateLocal(protocol.startDate);
      if (!start) return;
      def.steps.forEach(function (step) {
        var d = new Date(start);
        d.setDate(d.getDate() + (parseInt(step.day, 10) || 0));
        var taskKey = formatDateKey(d);
        var taskTime = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
        if (taskTime < fromT || taskTime > toT) return;
        var drug = (step.drug || '').trim() || '—';
        var isInsem = drug === 'Осеменение';
        out.push({
          kind: isInsem ? 'insemination_protocol' : 'injection',
          date: taskKey,
          cattleId: entry.cattleId || '',
          group: entry.group || '',
          drug: drug,
          protocolName: protocol.name,
          protocolStartDate: protocol.startDate,
          label: drug + (protocol.name ? ' (' + protocol.name + ')' : '')
        });
      });
    });
    return out;
  }

  function collectRecommendationItems(entries, refDate) {
    var todayKey = formatDateKey(refDate);
    var vwpDays = getFarmVwpDays();
    var getDaysInLactation = typeof global.getDaysInLactation === 'function' ? global.getDaysInLactation : null;
    var out = [];

    (entries || []).forEach(function (entry) {
      if (!isActiveEntry(entry, todayKey)) return;
      var statusStr = (entry.status || '').toString();
      var cattleId = entry.cattleId;
      var calvingDate = parseDateLocal(entry.calvingDate);
      var lastInsem = getLastInsemDate(entry);
      var lastInsemD = parseDateLocal(lastInsem);
      var hasInsemHist = Array.isArray(entry.inseminationHistory) && entry.inseminationHistory.length > 0;

      var daysSinceCalving = calvingDate ? daysBetween(calvingDate, todayKey) : 0;
      var daysInLactation = getDaysInLactation ? getDaysInLactation(entry) : daysSinceCalving;
      var otelFirstVwpOnly = statusStr.indexOf('Отёл') !== -1 && (daysSinceCalving < vwpDays || !calvingDate);
      var excludeInsem = statusStr.indexOf('Стельная') !== -1 || statusStr.indexOf('Брак') !== -1 || otelFirstVwpOnly;

      if (calvingDate && !entry.inseminationDate && !hasInsemHist && !excludeInsem &&
          daysInLactation != null && daysInLactation > vwpDays) {
        out.push({
          kind: 'insemination_recommend',
          date: todayKey,
          cattleId: cattleId,
          group: entry.group || '',
          drug: 'Осеменение',
          label: 'рекомендуется осеменение (день лактации ' + daysInLactation + ')',
          daysInLactation: daysInLactation
        });
      }

      var uziHist = entry.uziHistory || [];
      if (statusStr.indexOf('Осеменен') !== -1 && lastInsemD) {
        var daysFromInsem = daysBetween(lastInsemD, todayKey);
        if (daysFromInsem !== null && daysFromInsem >= 32 && !hasUziAfterInsem(entry, lastInsem)) {
          out.push({
            kind: 'uzi1',
            date: todayKey,
            cattleId: cattleId,
            group: entry.group || '',
            drug: 'УЗИ1',
            label: 'УЗИ1 (' + daysFromInsem + ' дн. после осеменения)',
            lastInsemDate: lastInsem
          });
        }
      }
      if (statusStr.indexOf('Стельная') !== -1 && uziHist.length === 1 && lastInsemD) {
        var daysPreg = daysBetween(lastInsemD, todayKey);
        if (daysPreg !== null && daysPreg >= 60) {
          out.push({
            kind: 'uzi2',
            date: todayKey,
            cattleId: cattleId,
            group: entry.group || '',
            drug: 'УЗИ2',
            label: 'УЗИ2 (' + daysPreg + ' дн. стельности)',
            lastInsemDate: lastInsem
          });
        }
      }
    });
    return out;
  }

  function findEntryById(entries, cattleId) {
    return (entries || []).find(function (e) { return e && e.cattleId === cattleId; }) || null;
  }

  function filterPendingItems(entries, items) {
    return (items || []).filter(function (item) {
      var entry = findEntryById(entries, item.cattleId);
      return entry && !isPlanItemDone(entry, item);
    });
  }

  /**
   * @param {Array} entries
   * @param {Date} refDate
   * @param {string} fromKey YYYY-MM-DD
   * @param {string} toKey YYYY-MM-DD
   */
  function collectWorkPlanItems(entries, refDate, fromKey, toKey) {
    var protocolItems = collectProtocolPlanItems(entries, fromKey, toKey);
    var todayKey = formatDateKey(refDate);
    var recItems = [];
    if (fromKey <= todayKey && todayKey <= toKey) {
      recItems = collectRecommendationItems(entries, refDate);
    }
    var all = protocolItems.concat(recItems);
    all.sort(function (a, b) {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return String(a.cattleId).localeCompare(String(b.cattleId), 'ru');
    });
    return filterPendingItems(entries, all);
  }

  function getOverdueItems(entries, refDate, onlyYesterday) {
    var todayKey = formatDateKey(refDate);
    var yesterdayKey = addDaysToKey(todayKey, -1);
    var fromKey = onlyYesterday ? yesterdayKey : addDaysToKey(todayKey, -30);
    var toKey = onlyYesterday ? yesterdayKey : addDaysToKey(todayKey, -1);
    var items = collectWorkPlanItems(entries, refDate, fromKey, toKey);
    if (onlyYesterday) {
      return items.filter(function (it) { return it.date === yesterdayKey; });
    }
    return items;
  }

  function kindGroupLabel(kind, drug) {
    if (kind === 'uzi1' || kind === 'uzi2' || drug === 'УЗИ1' || drug === 'УЗИ2') return 'УЗИ';
    if (kind === 'insemination_protocol' || kind === 'insemination_recommend' || drug === 'Осеменение') return 'Осеменения';
    return 'Уколы';
  }

  function formatItemLine(item) {
    return '№' + item.cattleId + ' — ' + (item.label || item.drug || '—');
  }

  function groupItemsByDate(items) {
    var byDate = {};
    (items || []).forEach(function (it) {
      if (!byDate[it.date]) byDate[it.date] = [];
      byDate[it.date].push(it);
    });
    return byDate;
  }

  function formatItemsByCategory(items) {
    var groups = { 'Уколы': [], 'УЗИ': [], 'Осеменения': [] };
    (items || []).forEach(function (it) {
      var g = kindGroupLabel(it.kind, it.drug);
      if (!groups[g]) groups[g] = [];
      groups[g].push(it);
    });
    var lines = [];
    ['Уколы', 'УЗИ', 'Осеменения'].forEach(function (g) {
      if (!groups[g].length) return;
      lines.push(g + ':');
      groups[g].forEach(function (it, idx) {
        lines.push((idx + 1) + '. ' + formatItemLine(it));
      });
      lines.push('');
    });
    return lines.join('\n').trim();
  }

  function formatWhatsNext(entries, refDate) {
    refDate = refDate || new Date();
    var todayKey = formatDateKey(refDate);
    var weekEnd = addDaysToKey(todayKey, 7);
    var items = collectWorkPlanItems(entries, refDate, todayKey, weekEnd);
    var overdue = getOverdueItems(entries, refDate, false);

    if (!items.length && !overdue.length) {
      return 'На ближайшую неделю нет запланированных задач (уколы, УЗИ, осеменения). Проверьте протоколы и статусы животных.';
    }

    var lines = ['Ближайшие планы работ (уколы, УЗИ, осеменения):', ''];
    var byDate = groupItemsByDate(items);
    Object.keys(byDate).sort().forEach(function (dateKey) {
      var dayItems = byDate[dateKey];
      var prefix = dateKey === todayKey ? 'Сегодня' : (dateKey === addDaysToKey(todayKey, 1) ? 'Завтра' : formatDateRu(dateKey));
      lines.push(prefix + ' (' + dayItems.length + '):');
      var cat = { 'Уколы': [], 'УЗИ': [], 'Осеменения': [] };
      dayItems.forEach(function (it) {
        var g = kindGroupLabel(it.kind, it.drug);
        if (!cat[g]) cat[g] = [];
        cat[g].push(formatItemLine(it));
      });
      ['Уколы', 'УЗИ', 'Осеменения'].forEach(function (g) {
        if (cat[g].length) lines.push('  ' + g + ': ' + cat[g].join('; '));
      });
      lines.push('');
    });

    if (overdue.length) {
      lines.push('Просрочено (не отмечено выполненным):');
      overdue.slice(0, 15).forEach(function (it) {
        lines.push('• ' + formatDateRu(it.date) + ': ' + formatItemLine(it));
      });
      if (overdue.length > 15) lines.push('… и ещё ' + (overdue.length - 15));
    }

    return lines.join('\n').trim();
  }

  function formatDailyPlan(entries, refDate) {
    refDate = refDate || new Date();
    var todayKey = formatDateKey(refDate);
    var items = collectWorkPlanItems(entries, refDate, todayKey, todayKey);

    if (!items.length) {
      return 'На сегодня (' + formatDateRu(todayKey) + ') запланированных задач нет.';
    }

    var lines = ['План на день — ' + formatDateRu(todayKey) + ':', ''];
    lines.push(formatItemsByCategory(items));
    lines.push('');
    lines.push('Всего задач: ' + items.length + '.');
    return lines.join('\n').trim();
  }

  function formatOverdueReminder(entries, refDate) {
    var overdue = getOverdueItems(entries, refDate, true);
    if (!overdue.length) return null;
    var yesterdayKey = addDaysToKey(formatDateKey(refDate), -1);
    var lines = [
      'Напоминание: вчера (' + formatDateRu(yesterdayKey) + ') остались невыполненными задачи:',
      ''
    ];
    overdue.forEach(function (it) {
      lines.push('• ' + formatItemLine(it));
    });
    lines.push('');
    lines.push('Введите событие в карточке коровы (осеменение, УЗИ, протокол), чтобы задача считалась выполненной.');
    return lines.join('\n');
  }

  function matchWhatsNext(text) {
    var q = normalizeQuestion(text);
    return /^(что дальше|что далее|какие планы|что на очереди|что предстоит)[\s!?.…,]*$/i.test(q) ||
      /что дальше|что далее|какие планы|предстоящ|что на очереди|ближайш/.test(q);
  }

  function matchDailyPlan(text) {
    var q = normalizeQuestion(text);
    return /^(дай план|план на день|задачи на день|расписание на день)[\s!?.…,]*$/i.test(q) ||
      /дай план|план на день|задачи на день|расписание на день/.test(q);
  }

  function loadAnnouncedState() {
    try {
      var raw = localStorage.getItem(ANNOUNCED_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function saveAnnouncedState(state) {
    try {
      localStorage.setItem(ANNOUNCED_KEY, JSON.stringify(state || {}));
    } catch (e) {}
  }

  function itemAnnounceKey(item) {
    return [item.date, item.kind, item.cattleId, item.drug || '', item.protocolName || ''].join('|');
  }

  function getChatAssistantSettings() {
    try {
      var raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) return Object.assign({}, DEFAULT_SETTINGS);
      var o = JSON.parse(raw);
      return {
        planHints: o.planHints !== false,
        overdueHints: o.overdueHints !== false,
        dailyPlanHints: o.dailyPlanHints !== false
      };
    } catch (e) {
      return Object.assign({}, DEFAULT_SETTINGS);
    }
  }

  function setChatAssistantSettings(partial) {
    var cur = getChatAssistantSettings();
    var next = Object.assign({}, cur, partial || {});
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
    } catch (e) {}
    return next;
  }

  function getEntriesForPlan() {
    var raw = global.entries || [];
    if (typeof global.getVisibleEntries === 'function') {
      return global.getVisibleEntries(raw);
    }
    return raw;
  }

  function buildChatWhatsNextSection(entries, refDate) {
    return '[Что дальше / планы работ]\n' + formatWhatsNext(entries, refDate);
  }

  function buildChatDailyPlanSection(entries, refDate) {
    return '[План на день]\n' + formatDailyPlan(entries, refDate);
  }

  function tryLocalPlanResponse(text) {
    var settings = getChatAssistantSettings();
    var entries = getEntriesForPlan();
    var refDate = new Date();

    if (matchDailyPlan(text)) {
      if (!settings.dailyPlanHints) {
        return 'Подсказка «План на день» отключена в настройках хозяйства → Чат-консультант.';
      }
      return formatDailyPlan(entries, refDate);
    }
    if (matchWhatsNext(text)) {
      if (!settings.planHints) {
        return 'Подсказка по планам отключена в настройках хозяйства → Чат-консультант.';
      }
      return formatWhatsNext(entries, refDate);
    }
    return null;
  }

  function updateChatProactiveBadge() {
    var title = document.querySelector('.chat-consultant-title');
    if (!title) return;
    var has = title.getAttribute('data-has-proactive') === '1';
    if (has && !title.querySelector('.chat-consultant-badge')) {
      var badge = document.createElement('span');
      badge.className = 'chat-consultant-badge';
      badge.textContent = '●';
      badge.setAttribute('aria-label', 'Есть новое сообщение');
      title.appendChild(badge);
    } else if (!has) {
      var existing = title.querySelector('.chat-consultant-badge');
      if (existing) existing.remove();
    }
  }

  function runChatPlanProactiveChecks() {
    var settings = getChatAssistantSettings();
    var entries = getEntriesForPlan();
    if (!entries.length) return;
    var refDate = new Date();
    var todayKey = formatDateKey(refDate);
    var state = loadAnnouncedState();
    if (state.date !== todayKey) {
      state = { date: todayKey, overdueKeys: [], dailyPlan: false };
    }

    var messages = [];

    if (settings.overdueHints) {
      var overdueMsg = formatOverdueReminder(entries, refDate);
      if (overdueMsg) {
        var overdueItems = getOverdueItems(entries, refDate, true);
        var newKeys = overdueItems.map(itemAnnounceKey);
        var already = state.overdueKeys || [];
        var hasNew = newKeys.some(function (k) { return already.indexOf(k) === -1; });
        if (hasNew) {
          messages.push(overdueMsg);
          state.overdueKeys = already.concat(newKeys.filter(function (k) { return already.indexOf(k) === -1; }));
        }
      }
    }

    if (settings.dailyPlanHints && !state.dailyPlan) {
      var plan = formatDailyPlan(entries, refDate);
      var hasTasks = collectWorkPlanItems(entries, refDate, todayKey, todayKey).length > 0;
      if (hasTasks) {
        messages.push('Доброе утро! ' + plan);
        state.dailyPlan = true;
      }
    }

    saveAnnouncedState(state);

    if (messages.length && typeof global.chatConsultantPushProactive === 'function') {
      messages.forEach(function (m) { global.chatConsultantPushProactive(m); });
    }
  }

  function initChatPlanAssistant() {
    setTimeout(function () {
      runChatPlanProactiveChecks();
    }, 2500);
    setInterval(function () {
      runChatPlanProactiveChecks();
    }, 60 * 60 * 1000);
  }

  global.getChatAssistantSettings = getChatAssistantSettings;
  global.setChatAssistantSettings = setChatAssistantSettings;
  global.matchChatWhatsNext = matchWhatsNext;
  global.matchChatDailyPlan = matchDailyPlan;
  global.formatChatWhatsNext = formatWhatsNext;
  global.formatChatDailyPlan = formatDailyPlan;
  global.tryLocalChatPlanResponse = tryLocalPlanResponse;
  global.collectWorkPlanItems = collectWorkPlanItems;
  global.buildChatWhatsNextSection = buildChatWhatsNextSection;
  global.buildChatDailyPlanSection = buildChatDailyPlanSection;
  global.runChatPlanProactiveChecks = runChatPlanProactiveChecks;
  global.initChatPlanAssistant = initChatPlanAssistant;
  global.updateChatProactiveBadge = updateChatProactiveBadge;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initChatPlanAssistant);
  } else {
    initChatPlanAssistant();
  }
})(typeof window !== 'undefined' ? window : this);
