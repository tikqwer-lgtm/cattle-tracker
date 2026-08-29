/** __notif part 1 */
(function () {
  'use strict';
  var root = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this);
  var NS = root['__notif'] = root['__notif'] || {};
  var global = typeof window !== 'undefined' ? window : this;

  var CALVING_REMINDER_DAYS = [7, 3, 1];

  function getVwpDays() {
    return typeof global.getFarmVwpDays === 'function' ? global.getFarmVwpDays() : 60;
  }

  function parseDate(str) {
    if (!str) return null;
    var d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
  }

  function dateOnly(d) {
    if (!d) return null;
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  /** YYYY-MM-DD → строка для UI: «2026-03-28 (Суббота)» */
  function formatTaskDateWithWeekdayRu(dateKey) {
    if (!dateKey) return '';
    var esc = function (s) {
      return String(s).replace(/</g, '&lt;');
    };
    var m = String(dateKey).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return esc(dateKey);
    var d = new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
    if (isNaN(d.getTime())) return esc(dateKey);
    var wd = '';
    try {
      wd = d.toLocaleDateString('ru-RU', { weekday: 'long' });
    } catch (e) {
      wd = '';
    }
    if (wd && wd.length) wd = wd.charAt(0).toUpperCase() + wd.slice(1);
    return esc(m[0]) + (wd ? ' (' + esc(wd) + ')' : '');
  }

  function daysBetween(from, to) {
    if (!from || !to) return null;
    var a = dateOnly(from);
    var b = dateOnly(to);
    return Math.round((b - a) / (24 * 60 * 60 * 1000));
  }

  function loadHistory() {
    try {
      var raw = localStorage.getItem(globalThis['__notif'].state.LIST_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function saveHistory(list) {
    try {
      localStorage.setItem(globalThis['__notif'].state.LIST_KEY, JSON.stringify((list || []).slice(-200)));
    } catch (e) {}
  }

  function buildDedupeKey(kind, cattleId, meta) {
    meta = meta || {};
    if (meta.dedupeKey) return String(meta.dedupeKey);
    kind = kind || meta.kind || meta.category || 'other';
    var parts = [kind, cattleId || ''];
    if (meta.daysToCalving != null) parts.push('dc' + meta.daysToCalving);
    if (meta.daysPregnant != null) parts.push('dp' + meta.daysPregnant);
    if (meta.daysInLactation != null) parts.push('dl' + meta.daysInLactation);
    if (meta.daysFromInsemination != null) parts.push('di' + meta.daysFromInsemination);
    if (meta.field) parts.push(String(meta.field), String(meta.date || ''));
    if (kind === 'sync') parts.push('unsynced');
    return parts.join('|');
  }

  function findDedupeKey(n) {
    if (!n) return '';
    return buildDedupeKey(inferKind(n), n.cattleId, n.meta || {});
  }

  /** Оставляет по одному уведомлению на логический ключ (последнее по времени). */
  function dedupeHistoryList(list) {
    if (!Array.isArray(list) || !list.length) return list || [];
    var seen = {};
    var out = [];
    for (var i = list.length - 1; i >= 0; i--) {
      var n = list[i];
      var key = findDedupeKey(n);
      if (!key || seen[key]) continue;
      seen[key] = true;
      if (!n.meta) n.meta = {};
      n.meta.dedupeKey = key;
      out.unshift(n);
    }
    return out;
  }

  function historyHasDedupeKey(key) {
    if (!key) return false;
    return loadHistory().some(function (n) {
      return findDedupeKey(n) === key;
    });
  }

  function normalizeHistory(list) {
    if (!Array.isArray(list)) return [];
    var changed = false;
    list.forEach(function (n) {
      if (typeof n.read !== 'boolean') {
        n.read = true;
        changed = true;
      }
    });
    var deduped = dedupeHistoryList(list);
    if (deduped.length !== list.length) {
      changed = true;
      list = deduped;
    }
    if (changed) saveHistory(list);
    return list;
  }

  var GROUP_LABELS = {
    errors: 'Ошибки',
    data_error: 'Ошибки',
    calving_check: 'Проверить отёл',
    servicePregCheck: 'Проверка на Ст',
    uzi1: 'УЗИ1',
    uzi2: 'УЗИ2',
    calving: 'Предстоящий отёл',
    insemination: 'Осеменение',
    dry: 'Сухостой',
    sync: 'Синхронизация',
    farm_goal: 'Цели хозяйства',
    farm_event: 'События хозяйства',
    other: 'Прочее'
  };

  var GROUP_ORDER = ['errors', 'calving_check', 'servicePregCheck', 'uzi1', 'uzi2', 'calving', 'insemination', 'dry', 'farm_goal', 'farm_event', 'sync', 'other'];

  var CATEGORY_LABELS = GROUP_LABELS;

  function inferKind(n) {
    if (n.meta && n.meta.kind) return n.meta.kind;
    if (n.category === 'errors') return 'data_error';
    var msg = (n.message || '').toLowerCase();
    if (msg.indexOf('в будущем') !== -1) return 'data_error';
    if (msg.indexOf('проверить отел') !== -1) return 'calving_check';
    if (msg.indexOf('узи1') !== -1) return 'uzi1';
    if (msg.indexOf('узи2') !== -1) return 'uzi2';
    if (msg.indexOf('цель') !== -1 || msg.indexOf('просрочен') !== -1) return 'farm_goal';
    if (msg.indexOf('событие хозяйства') !== -1 || msg.indexOf('напоминание: ') !== -1) return 'farm_event';
    if (msg.indexOf('отёл') !== -1 || msg.indexOf('отел') !== -1) return 'calving';
    if (msg.indexOf('осеменен') !== -1 || msg.indexOf('рекомендуется осеменение') !== -1) return 'insemination';
    if (msg.indexOf('сухостой') !== -1) return 'dry';
    if (msg.indexOf('синхрониз') !== -1) return 'sync';
    return 'other';
  }

  function inferCategory(n) {
    if (n.category) return n.category;
    return inferKind(n);
  }

  function groupNotificationsForDisplay(history) {
    var byKind = {};
    (history || []).forEach(function (n) {
      var kind = inferKind(n);
      if (kind === 'data_error') kind = 'errors';
      if (!byKind[kind]) byKind[kind] = [];
      byKind[kind].push(n);
    });
    var groups = [];
    GROUP_ORDER.forEach(function (kind) {
      var key = kind === 'data_error' ? 'errors' : kind;
      var items = byKind[key];
      if (!items || !items.length) return;
      var unread = items.filter(function (x) { return x.read === false; }).length;
      groups.push({
        kind: key,
        label: GROUP_LABELS[key] || key,
        items: items,
        count: items.length,
        unreadCount: unread
      });
    });
    Object.keys(byKind).forEach(function (k) {
      if (GROUP_ORDER.indexOf(k) !== -1 || GROUP_ORDER.indexOf(k === 'errors' ? 'data_error' : k) !== -1) return;
      var items2 = byKind[k];
      groups.push({
        kind: k,
        label: GROUP_LABELS[k] || k,
        items: items2,
        count: items2.length,
        unreadCount: items2.filter(function (x) { return x.read === false; }).length
      });
    });
    return groups;
  }

  function createNotification(type, message, cowId, meta, options) {
    meta = meta || {};
    options = options || {};
    var dedupeKey = buildDedupeKey(meta.kind || meta.category, cowId, meta);
    if (historyHasDedupeKey(dedupeKey)) {
      return null;
    }
    var showToastOpt = options.showToast !== false;
    var showSystemOpt = options.showSystem !== false;
    meta.dedupeKey = dedupeKey;
    var item = {
      id: 'n_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9),
      type: type || 'info',
      message: message || '',
      cattleId: cowId || '',
      meta: meta,
      category: meta.category || 'other',
      createdAt: new Date().toISOString(),
      read: false
    };
    var history = loadHistory();
    history.push(item);
    saveHistory(history);
    if (showToastOpt && typeof window.showToast === 'function') {
      window.showToast(message, type === 'error' ? 'error' : 'info', 4000);
    }
    if (showSystemOpt && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification('Учёт коров', { body: message, tag: item.id });
      } catch (err) {}
    }
    if (typeof window.CattleTrackerEvents !== 'undefined') {
      window.CattleTrackerEvents.emit('notification:created', item);
    }
    if (typeof updateNotificationIndicators === 'function') {
      globalThis['__notif'].updateNotificationIndicators();
    }
    return item;
  }

  function checkFarmCardReminders(notified, out) {
    notified = notified || {};
    out = out || [];
    var bundle = null;
    if (typeof window !== 'undefined' && window.__farmCardBundle) {
      bundle = window.__farmCardBundle;
    } else if (typeof window !== 'undefined' && typeof window.getFarmCardBundleForExport === 'function') {
      try {
        bundle = window.getFarmCardBundleForExport();
      } catch (e) {
        bundle = null;
      }
    }
    if (!bundle) return out;

    var today = dateOnly(new Date());
    var todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
    var now = Date.now();

    (bundle.goals || []).forEach(function (g) {
      if (!g || g.status === 'done') return;
      var deadline = g.deadline ? String(g.deadline).slice(0, 10) : '';
      if (!deadline) return;
      var d = parseDate(deadline);
      if (!d) return;
      var daysLeft = daysBetween(new Date(), d);
      var overdue = deadline < todayStr;
      var dueSoon = daysLeft !== null && daysLeft >= 0 && daysLeft <= 3;
      if (!overdue && !dueSoon) return;
      var key = 'farm_goal_' + (g.id || '') + '_' + deadline + (overdue ? '_od' : '_soon');
      if (notified[key] || historyHasDedupeKey(key)) return;
      notified[key] = true;
      var msg = overdue
        ? 'Просрочена цель хозяйства: «' + (g.title || '') + '» (срок ' + deadline + ')'
        : 'Цель хозяйства скоро: «' + (g.title || '') + '» (через ' + daysLeft + ' дн.)';
      var n = createNotification(
        overdue ? 'warning' : 'info',
        msg,
        '',
        { kind: 'farm_goal', category: 'farm_goal', goalId: g.id, dedupeKey: key },
        { showToast: false, showSystem: true }
      );
      if (n) out.push(n);
    });

    (bundle.events || []).forEach(function (ev) {
      if (!ev || ev.completed || ev.notifyLocal === false) return;
      var rem = ev.reminderAt ? String(ev.reminderAt) : '';
      if (!rem) return;
      var remDate = parseDate(rem);
      if (!remDate) {
        try {
          remDate = new Date(rem);
        } catch (e2) {
          remDate = null;
        }
      }
      if (!remDate || isNaN(remDate.getTime())) return;
      if (remDate.getTime() > now) return;
      var keyEv = 'farm_event_' + (ev.id || '') + '_' + rem;
      if (notified[keyEv] || historyHasDedupeKey(keyEv)) return;
      notified[keyEv] = true;
      var label = ev.description || ev.task || ev.goal || ev.eventType || 'событие';
      var nEv = createNotification(
        'info',
        'Напоминание: событие хозяйства «' + label + '»',
        '',
        { kind: 'farm_event', category: 'farm_event', eventId: ev.id, dedupeKey: keyEv },
        { showToast: false, showSystem: true }
      );
      if (nEv) out.push(nEv);
    });

    return out;
  }

  function checkUpcomingEvents() {
    var list = typeof entries !== 'undefined' ? entries : [];
    var today = dateOnly(new Date());
    var vwpDays = getVwpDays();
    var notified = {};
    var out = [];

    function getLastInseminationDate(e) {
      var hist = e.inseminationHistory;
      if (Array.isArray(hist) && hist.length > 0) {
        var dates = hist.map(function (h) { return h && h.date; }).filter(Boolean);
        if (dates.length > 0) return dates.reduce(function (a, b) { return a > b ? a : b; });
      }
      return e.inseminationDate || null;
    }

    function getExpectedCalvingDate(e) {
      var lastInsem = getLastInseminationDate(e);
      if (!lastInsem) return null;
      var d = parseDate(lastInsem);
      if (!d) return null;
      d.setDate(d.getDate() + 280);
      return d;
    }
    NS.getLastInseminationDate = getLastInseminationDate;
    NS.getExpectedCalvingDate = getExpectedCalvingDate;

    if (!list.length) {
      if (typeof global.syncDataErrorNotifications === 'function') {
        global.syncDataErrorNotifications(list, { notified: notified });
      }
      checkFarmCardReminders(notified, out);
      return out;
    }

    list.forEach(function (entry) {
      var cattleId = entry.cattleId || '';
      var calvingDate = parseDate(entry.calvingDate);
      var lastInsemDateStr = getLastInseminationDate(entry);
      var inseminationDate = parseDate(entry.inseminationDate);
      var hasInseminationHistory = Array.isArray(entry.inseminationHistory) && entry.inseminationHistory.length > 0;
      var dryStartDate = parseDate(entry.dryStartDate);
      var exitDate = parseDate(entry.exitDate);
      var statusStr = (entry.status || '').toString();
      if (exitDate && exitDate <= today) return;

      var expectedCalving = (statusStr.indexOf('Стельная') !== -1) ? getExpectedCalvingDate(entry) : null;
      var calvingForReminder = (expectedCalving && expectedCalving >= today) ? expectedCalving : (calvingDate && calvingDate >= today ? calvingDate : null);
      if (calvingForReminder) {
        var daysToCalving = daysBetween(new Date(), calvingForReminder);
        if (daysToCalving !== null && CALVING_REMINDER_DAYS.indexOf(daysToCalving) !== -1) {
          var key = 'calving_' + cattleId + '_' + daysToCalving;
          if (!notified[key]) {
            notified[key] = true;
            var nCalving = createNotification('info', 'Предстоящий отёл: корова ' + cattleId + ' через ' + daysToCalving + ' дн.', cattleId, { kind: 'calving', daysToCalving: daysToCalving, category: 'calving', dedupeKey: key }, { showToast: false, showSystem: false });
            if (nCalving) out.push(nCalving);
          }
        }
      }

      var lastCalving = calvingDate;
      var daysSinceCalving = lastCalving ? daysBetween(lastCalving, new Date()) : 0;
      var daysInLactation = typeof getDaysInLactation === 'function' ? getDaysInLactation(entry) : daysSinceCalving;
      var otelFirstVwpOnly = statusStr.indexOf('Отёл') !== -1 && (daysSinceCalving < vwpDays || !lastCalving);
      var excludeInsemination = statusStr.indexOf('Стельная') !== -1 || statusStr.indexOf('Брак') !== -1 || otelFirstVwpOnly;
      if (lastCalving && !inseminationDate && !hasInseminationHistory && !excludeInsemination) {
        if (daysInLactation != null && daysInLactation > vwpDays) {
          var key2 = 'insem_' + cattleId;
          if (!notified[key2]) {
            notified[key2] = true;
            var nInsem = createNotification('info', 'Рекомендуется осеменение: корова ' + cattleId + ' (день лактации ' + daysInLactation + ')', cattleId, { kind: 'insemination', daysInLactation: daysInLactation, category: 'insemination', dedupeKey: key2 }, { showToast: false, showSystem: false });
            if (nInsem) out.push(nInsem);
          }
        }
      }

      var alreadyDry = statusStr.indexOf('Сухостой') !== -1 || (dryStartDate && dryStartDate <= today);
      if (!alreadyDry) {
        var calvingForDry = (expectedCalving && expectedCalving >= today) ? expectedCalving : (calvingDate && calvingDate > today ? calvingDate : null);
        if (calvingForDry) {
          var dryOffDue = daysBetween(new Date(), calvingForDry);
          if (dryOffDue !== null && dryOffDue <= vwpDays && dryOffDue >= vwpDays - 14) {
            var key3 = 'dry_' + cattleId;
            if (!notified[key3]) {
              notified[key3] = true;
              var nDry = createNotification('info', 'Запуск в сухостой: корова ' + cattleId + ' (отёл через ~' + dryOffDue + ' дн.)', cattleId, { kind: 'dry', daysToCalving: dryOffDue, category: 'dry', dedupeKey: key3 }, { showToast: false, showSystem: false });
              if (nDry) out.push(nDry);
            }
          }
        }
      }

      var lastInsemD = parseDate(lastInsemDateStr);
      var uziHist = entry.uziHistory || [];
      if (statusStr.indexOf('Осеменен') !== -1 && lastInsemD) {
        var daysFromInsem = daysBetween(lastInsemD, new Date());
        if (daysFromInsem !== null && daysFromInsem >= 32) {
          var hasUziAfterLastInsem = uziHist.some(function (u) { var ud = parseDate(u.date); return ud && ud >= lastInsemD; });
          if (!hasUziAfterLastInsem) {
            var keyUzi1 = 'uzi1_' + cattleId;
            if (!notified[keyUzi1]) {
              notified[keyUzi1] = true;
              var nUzi1 = createNotification('info', 'УЗИ1: корова ' + cattleId + ' (осеменена ' + daysFromInsem + ' дн. назад)', cattleId, { kind: 'uzi1', daysFromInsemination: daysFromInsem, category: 'other', dedupeKey: keyUzi1 }, { showToast: false, showSystem: false });
              if (nUzi1) out.push(nUzi1);
            }
          }
        }
      }
      if (statusStr.indexOf('Стельная') !== -1 && uziHist.length === 1 && lastInsemD) {
        var daysFromInsem2 = daysBetween(lastInsemD, new Date());
        if (daysFromInsem2 !== null && daysFromInsem2 >= 60) {
          var keyUzi2 = 'uzi2_' + cattleId;
          if (!notified[keyUzi2]) {
            notified[keyUzi2] = true;
            var nUzi2 = createNotification('info', 'УЗИ2: корова ' + cattleId + ' (стельность ' + daysFromInsem2 + ' дн.)', cattleId, { kind: 'uzi2', daysFromInsemination: daysFromInsem2, category: 'other', dedupeKey: keyUzi2 }, { showToast: false, showSystem: false });
            if (nUzi2) out.push(nUzi2);
          }
        }
      }

      if (entry.status && String(entry.status).indexOf('Стельная') !== -1 && typeof getDaysPregnant === 'function') {
        var daysPreg = getDaysPregnant(entry);
        if (daysPreg !== null && daysPreg > 275) {
          var keyOverdue = 'overdue_' + cattleId;
          if (!notified[keyOverdue]) {
            notified[keyOverdue] = true;
            var nOverdue = createNotification('info', 'Проверить отел: корова ' + cattleId + ' (дней стельности: ' + daysPreg + ')', cattleId, { kind: 'calving_check', daysPregnant: daysPreg, category: 'calving', dedupeKey: keyOverdue }, { showToast: false, showSystem: false });
            if (nOverdue) out.push(nOverdue);
          }
        }
      }
    });

    var useApi = typeof global.CATTLE_TRACKER_USE_API !== 'undefined' && global.CATTLE_TRACKER_USE_API;
    if (!useApi) {
      var unsynced = list.filter(function (e) { return e.synced !== true; });
      if (unsynced.length > 0) {
        var key4 = 'unsynced_count';
        if (!notified[key4]) {
          notified[key4] = true;
          var nSync = createNotification('info', 'Не синхронизировано записей: ' + unsynced.length, '', { kind: 'sync', count: unsynced.length, category: 'sync', dedupeKey: key4 }, { showToast: false, showSystem: false });
          if (nSync) out.push(nSync);
        }
      }
    }

    if (typeof global.syncDataErrorNotifications === 'function') {
      global.syncDataErrorNotifications(list, { notified: notified });
    }
    checkFarmCardReminders(notified, out);

    try {
      var wtBundle = typeof window !== 'undefined' ? window.__farmCardBundle : null;
      var wtList = [];
      if (wtBundle && Array.isArray(wtBundle.workTasks)) wtList = wtBundle.workTasks;
      else if (typeof window !== 'undefined' && window.CattleTrackerWorkTasks &&
               typeof window.CattleTrackerWorkTasks.readWorkTasksLocal === 'function') {
        wtList = window.CattleTrackerWorkTasks.readWorkTasksLocal();
      }
      var todayIso =
        new Date().getFullYear() +
        '-' +
        String(new Date().getMonth() + 1).padStart(2, '0') +
        '-' +
        String(new Date().getDate()).padStart(2, '0');
      var openChecks =
        typeof window !== 'undefined' &&
        window.CattleTrackerWorkTasks &&
        typeof window.CattleTrackerWorkTasks.listOpenPregChecks === 'function'
          ? window.CattleTrackerWorkTasks.listOpenPregChecks(wtList, todayIso)
          : [];
      openChecks.forEach(function (t) {
        var keyPc = 'servicePregCheck_' + (t.id || '');
        if (notified[keyPc]) return;
        notified[keyPc] = true;
        var due = !!t.due;
        var msg =
          'Проверка на Ст: ' +
          t.count +
          ' гол. (осеменение ' +
          t.workDate +
          ', срок ' +
          t.checkDueDate +
          ')' +
          (due ? ' — ожидает результата' : '');
        var nPc = createNotification(
          due ? 'warning' : 'info',
          msg,
          '',
          {
            kind: 'servicePregCheck',
            category: 'servicePregCheck',
            due: due,
            workTaskId: t.id,
            checkDueDate: t.checkDueDate,
            dedupeKey: keyPc
          },
          { showToast: false, showSystem: false }
        );
        if (nPc) out.push(nPc);
      });
    } catch (eWt) {}

    return out;
  }


  // register functions
  NS.getVwpDays = getVwpDays;
  NS.parseDate = parseDate;
  NS.dateOnly = dateOnly;
  NS.formatTaskDateWithWeekdayRu = formatTaskDateWithWeekdayRu;
  NS.daysBetween = daysBetween;
  NS.loadHistory = loadHistory;
  NS.saveHistory = saveHistory;
  NS.buildDedupeKey = buildDedupeKey;
  NS.findDedupeKey = findDedupeKey;
  NS.dedupeHistoryList = dedupeHistoryList;
  NS.historyHasDedupeKey = historyHasDedupeKey;
  NS.normalizeHistory = normalizeHistory;
  NS.inferKind = inferKind;
  NS.inferCategory = inferCategory;
  NS.groupNotificationsForDisplay = groupNotificationsForDisplay;
  NS.createNotification = createNotification;
  NS.checkFarmCardReminders = checkFarmCardReminders;
  NS.checkUpcomingEvents = checkUpcomingEvents;
})();
export {};
