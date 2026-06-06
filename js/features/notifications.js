/**
 * notifications.js — Уведомления и напоминания
 */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'cattleTracker_notifications';
  var LIST_KEY = 'cattleTracker_notification_history';
  var CHECK_INTERVAL_MS = 60 * 1000;
  var timerId = null;
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
      var raw = localStorage.getItem(LIST_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function saveHistory(list) {
    try {
      localStorage.setItem(LIST_KEY, JSON.stringify((list || []).slice(-200)));
    } catch (e) {}
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
    if (changed) saveHistory(list);
    return list;
  }

  var GROUP_LABELS = {
    errors: 'Ошибки',
    data_error: 'Ошибки',
    calving_check: 'Проверить отёл',
    uzi1: 'УЗИ1',
    uzi2: 'УЗИ2',
    calving: 'Предстоящий отёл',
    insemination: 'Осеменение',
    dry: 'Сухостой',
    sync: 'Синхронизация',
    other: 'Прочее'
  };

  var GROUP_ORDER = ['errors', 'calving_check', 'uzi1', 'uzi2', 'calving', 'insemination', 'dry', 'sync', 'other'];

  var CATEGORY_LABELS = GROUP_LABELS;

  function inferKind(n) {
    if (n.meta && n.meta.kind) return n.meta.kind;
    if (n.category === 'errors') return 'data_error';
    var msg = (n.message || '').toLowerCase();
    if (msg.indexOf('в будущем') !== -1) return 'data_error';
    if (msg.indexOf('проверить отел') !== -1) return 'calving_check';
    if (msg.indexOf('узи1') !== -1) return 'uzi1';
    if (msg.indexOf('узи2') !== -1) return 'uzi2';
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
    var showToastOpt = options.showToast !== false;
    var showSystemOpt = options.showSystem !== false;
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
      updateNotificationIndicators();
    }
    if (document.getElementById('menuNotificationsBody')) {
      renderNotificationSummary('menuNotificationsBody');
    }
    return item;
  }

  function checkUpcomingEvents() {
    var list = typeof entries !== 'undefined' ? entries : [];
    if (!list.length) {
      if (typeof global.syncDataErrorNotifications === 'function') {
        global.syncDataErrorNotifications(list, { notified: {} });
      }
      return [];
    }
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
            out.push(createNotification('info', 'Предстоящий отёл: корова ' + cattleId + ' через ' + daysToCalving + ' дн.', cattleId, { kind: 'calving', daysToCalving: daysToCalving, category: 'calving' }, { showToast: false, showSystem: false }));
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
            out.push(createNotification('info', 'Рекомендуется осеменение: корова ' + cattleId + ' (день лактации ' + daysInLactation + ')', cattleId, { kind: 'insemination', daysInLactation: daysInLactation, category: 'insemination' }, { showToast: false, showSystem: false }));
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
              out.push(createNotification('info', 'Запуск в сухостой: корова ' + cattleId + ' (отёл через ~' + dryOffDue + ' дн.)', cattleId, { kind: 'dry', daysToCalving: dryOffDue, category: 'dry' }, { showToast: false, showSystem: false }));
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
              out.push(createNotification('info', 'УЗИ1: корова ' + cattleId + ' (осеменена ' + daysFromInsem + ' дн. назад)', cattleId, { kind: 'uzi1', daysFromInsemination: daysFromInsem, category: 'other' }, { showToast: false, showSystem: false }));
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
            out.push(createNotification('info', 'УЗИ2: корова ' + cattleId + ' (стельность ' + daysFromInsem2 + ' дн.)', cattleId, { kind: 'uzi2', daysFromInsemination: daysFromInsem2, category: 'other' }, { showToast: false, showSystem: false }));
          }
        }
      }

      if (entry.status && String(entry.status).indexOf('Стельная') !== -1 && typeof getDaysPregnant === 'function') {
        var daysPreg = getDaysPregnant(entry);
        if (daysPreg !== null && daysPreg > 275) {
          var keyOverdue = 'overdue_' + cattleId;
          if (!notified[keyOverdue]) {
            notified[keyOverdue] = true;
            out.push(createNotification('info', 'Проверить отел: корова ' + cattleId + ' (дней стельности: ' + daysPreg + ')', cattleId, { kind: 'calving_check', daysPregnant: daysPreg, category: 'calving' }, { showToast: false, showSystem: false }));
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
          out.push(createNotification('info', 'Не синхронизировано записей: ' + unsynced.length, '', { kind: 'sync', count: unsynced.length, category: 'sync' }, { showToast: false, showSystem: false }));
        }
      }
    }

    if (typeof global.syncDataErrorNotifications === 'function') {
      global.syncDataErrorNotifications(list, { notified: notified });
    }
    return out;
  }

  function scheduleReminders() {
    if (timerId) clearInterval(timerId);
    checkUpcomingEvents();
    timerId = setInterval(checkUpcomingEvents, CHECK_INTERVAL_MS);
  }

  function stopReminders() {
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }
  }

  function requestNotificationPermission() {
    if (!('Notification' in window)) return Promise.resolve(false);
    if (Notification.permission === 'granted') return Promise.resolve(true);
    if (Notification.permission === 'denied') return Promise.resolve(false);
    return Notification.requestPermission().then(function (p) { return p === 'granted'; });
  }

  function getNotificationHistory() {
    return normalizeHistory(loadHistory());
  }

  function getUnreadCount() {
    var list = getNotificationHistory();
    return list.filter(function (n) { return n.read === false; }).length;
  }

  function markNotificationRead(id) {
    if (!id) return false;
    var history = normalizeHistory(loadHistory());
    var changed = false;
    history.forEach(function (n) {
      if (n.id === id && n.read === false) {
        n.read = true;
        changed = true;
      }
    });
    if (changed) {
      saveHistory(history);
      if (typeof updateNotificationIndicators === 'function') {
        updateNotificationIndicators();
      }
    }
    return changed;
  }

  function updateNotificationIndicators() {
    var count = getUnreadCount();
    var badge = document.getElementById('menuNotificationsBadge');
    if (badge) {
      badge.textContent = count ? String(count) : '';
      badge.style.display = count ? 'inline-flex' : 'none';
    }
    var btnBadge = document.getElementById('menuNotificationsButtonBadge');
    if (btnBadge) {
      btnBadge.textContent = count ? String(count) : '';
      btnBadge.style.display = count ? 'inline-flex' : 'none';
    }
  }

  function renderNotificationSummary(containerId) {
    var body = document.getElementById(containerId);
    if (!body) return;
    var list = getNotificationHistory().slice().reverse();
    var groups = groupNotificationsForDisplay(list);
    var html = '';
    if (!groups.length) {
      html = '<div class="menu-notifications-empty">Нет уведомлений</div>';
    } else {
      html = '<ul class="menu-notifications-list menu-notifications-groups">';
      groups.slice(0, 6).forEach(function (g) {
        var unreadBadge = g.unreadCount > 0 ? ' <span class="menu-notifications-group-badge">' + g.unreadCount + '</span>' : '';
        html += '<li class="menu-notifications-group-item">' +
          '<div class="menu-notifications-group-head">' + (g.label || '').replace(/</g, '&lt;') + ' (' + g.count + ')' + unreadBadge + '</div>';
        g.items.slice(0, 2).forEach(function (n) {
          var cls = 'menu-notifications-item' + (n.read === false ? ' notification-item-unread' : '');
          html += '<div class="' + cls + '" data-notif-id="' + (n.id || '').replace(/"/g, '&quot;') + '" data-cattle-id="' + (n.cattleId || '').replace(/"/g, '&quot;') + '">' +
            '<div class="menu-notifications-message">' + (n.message || '').replace(/</g, '&lt;') + '</div>' +
            '</div>';
        });
        if (g.count > 2) {
          html += '<div class="menu-notifications-group-more">…ещё ' + (g.count - 2) + '</div>';
        }
        html += '</li>';
      });
      html += '</ul>';
    }
    html += '<div class="menu-notifications-actions">' +
      '<button type="button" class="small-btn" data-action="open-notifications">Все уведомления</button>' +
      '</div>';
    body.innerHTML = html;
    updateNotificationIndicators();
    body.querySelectorAll('.menu-notifications-item[data-notif-id]').forEach(function (item) {
      item.addEventListener('click', function () {
        var id = item.getAttribute('data-notif-id');
        if (markNotificationRead(id)) {
          renderNotificationSummary(containerId);
        }
        var cid = item.getAttribute('data-cattle-id');
        if (cid && typeof viewCow === 'function') viewCow(cid);
      });
    });
    var openBtn = body.querySelector('[data-action="open-notifications"]');
    if (openBtn) {
      openBtn.addEventListener('click', function () {
        if (typeof navigate === 'function') navigate('notifications');
      });
    }
  }

  /**
   * Собирает задачи по протоколам: для записей с protocol.name и protocol.startDate
   * по каждому этапу протокола вычисляет дату инъекции и возвращает список задач.
   * @param {string} fromDate - YYYY-MM-DD
   * @param {string} toDate - YYYY-MM-DD
   * @returns {Array<{date: string, dateKey: string, cattleId: string, group: string, drug: string, protocolName: string}>}
   */
  function getProtocolTasks(fromDate, toDate) {
    var list = typeof entries !== 'undefined' ? entries : [];
    var getProtocolsFn = typeof getProtocols === 'function' ? getProtocols : function () { return []; };
    var protocols = getProtocolsFn();
    var byName = {};
    protocols.forEach(function (p) { byName[p.name || p.id] = p; });
    var from = fromDate ? dateOnly(new Date(fromDate)).getTime() : 0;
    var to = toDate ? dateOnly(new Date(toDate)).getTime() : Number.MAX_SAFE_INTEGER;
    var tasks = [];
    list.forEach(function (entry) {
      var protocol = entry.protocol;
      if (!protocol || !protocol.name || !protocol.startDate) return;
      var def = byName[protocol.name];
      if (!def || !def.steps || !def.steps.length) return;
      var start = parseDate(protocol.startDate);
      if (!start) return;
      var cattleId = entry.cattleId || '';
      var group = entry.group || '';
      def.steps.forEach(function (step) {
        var d = new Date(start);
        d.setDate(d.getDate() + (parseInt(step.day, 10) || 0));
        var taskDate = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        var taskTime = dateOnly(d).getTime();
        if (taskTime >= from && taskTime <= to) {
          tasks.push({
            date: taskDate,
            dateKey: taskDate,
            cattleId: cattleId,
            group: group,
            drug: (step.drug || '').trim() || '—',
            protocolName: protocol.name
          });
        }
      });
    });
    tasks.sort(function (a, b) { return a.dateKey.localeCompare(b.dateKey); });
    return tasks;
  }

  function renderTasksList(containerEl, fromDate, toDate) {
    if (!containerEl) return;
    var today = new Date();
    var todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
    if (!fromDate && !toDate) { fromDate = todayStr; toDate = todayStr; }
    var tasks = getProtocolTasks(fromDate, toDate);
    var byDate = {};
    tasks.forEach(function (t) {
      if (!byDate[t.dateKey]) byDate[t.dateKey] = [];
      byDate[t.dateKey].push(t);
    });
    var dates = Object.keys(byDate).sort();
    var html = '<div class="tasks-list-block">';
    html += '<h4 class="tasks-list-title">Список задач (инъекции по протоколам)</h4>';
    html += '<div class="tasks-period">';
    html += '<button type="button" class="small-btn tasks-period-btn" data-range="today">Сегодня</button>';
    html += '<button type="button" class="small-btn tasks-period-btn" data-range="tomorrow">Завтра</button>';
    html += '<button type="button" class="small-btn tasks-period-btn" data-range="week">Неделя вперёд</button>';
    html += '<label>С <input type="date" id="tasksDateFrom" class="tasks-date-input" value="' + (fromDate || '') + '" /></label>';
    html += '<label>По <input type="date" id="tasksDateTo" class="tasks-date-input" value="' + (toDate || '') + '" /></label>';
    html += '</div>';
    var tasksPrintHtml = (typeof window.isMobile === 'function' && window.isMobile()) ? '' : '<button type="button" class="small-btn" id="tasksPrintBtn">Печать</button>';
    html += '<div class="tasks-list-actions">' + tasksPrintHtml + '<button type="button" class="small-btn" id="tasksExcelBtn">Экспорт в Excel</button></div>';
    if (dates.length === 0) {
      html += '<p class="tasks-empty">Нет задач на выбранный период.</p>';
    } else {
      html += '<div class="tasks-by-date">';
      dates.forEach(function (dateKey) {
        var dayTasks = byDate[dateKey];
        html += '<div class="tasks-date-group">';
        html += '<div class="tasks-date-header">' + formatTaskDateWithWeekdayRu(dateKey) + '</div>';
        html += '<ul class="tasks-date-list">';
        dayTasks.forEach(function (t) {
          html += '<li class="tasks-item">' +
            '<span class="tasks-cattle">' + (t.cattleId || '').replace(/</g, '&lt;') + '</span>' +
            ' | <span class="tasks-group">' + (t.group || '—').replace(/</g, '&lt;') + '</span>' +
            ' | <span class="tasks-drug">' + (t.drug || '—').replace(/</g, '&lt;') + '</span>' +
            ' | <span class="tasks-date">' + formatTaskDateWithWeekdayRu(t.date) + '</span>' +
            '</li>';
        });
        html += '</ul></div>';
      });
      html += '</div>';
    }
    html += '</div>';
    containerEl.innerHTML = html;
    var todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
    function applyRange(range) {
      var from = '';
      var to = '';
      if (range === 'today') {
        from = to = todayStr;
      } else if (range === 'tomorrow') {
        var t2 = new Date(today);
        t2.setDate(t2.getDate() + 1);
        from = to = t2.getFullYear() + '-' + String(t2.getMonth() + 1).padStart(2, '0') + '-' + String(t2.getDate()).padStart(2, '0');
      } else if (range === 'week') {
        from = todayStr;
        var t7 = new Date(today);
        t7.setDate(t7.getDate() + 7);
        to = t7.getFullYear() + '-' + String(t7.getMonth() + 1).padStart(2, '0') + '-' + String(t7.getDate()).padStart(2, '0');
      }
      var fromEl = document.getElementById('tasksDateFrom');
      var toEl = document.getElementById('tasksDateTo');
      if (fromEl) fromEl.value = from;
      if (toEl) toEl.value = to;
      renderTasksList(containerEl, from || undefined, to || undefined);
    }
    containerEl.querySelectorAll('.tasks-period-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        applyRange(btn.getAttribute('data-range'));
      });
    });
    var fromInput = document.getElementById('tasksDateFrom');
    var toInput = document.getElementById('tasksDateTo');
    if (fromInput) fromInput.addEventListener('change', function () {
      renderTasksList(containerEl, fromInput.value || undefined, toInput ? toInput.value : undefined);
    });
    if (toInput) toInput.addEventListener('change', function () {
      renderTasksList(containerEl, fromInput ? fromInput.value : undefined, toInput.value || undefined);
    });
    var printBtn = document.getElementById('tasksPrintBtn');
    if (printBtn) {
      printBtn.addEventListener('click', function () {
        if (typeof global.print === 'function') global.print(); else window.print();
      });
    }
    var excelBtn = document.getElementById('tasksExcelBtn');
    if (excelBtn) excelBtn.addEventListener('click', function () {
      var from = (fromInput && fromInput.value) || todayStr;
      var to = (toInput && toInput.value) || todayStr;
      var taskList = getProtocolTasks(from, to);
      if (typeof global.exportListToExcel === 'function') global.exportListToExcel('Список_задач', taskList, ['date', 'cattleId', 'group', 'drug', 'protocolName'], ['Дата', 'Номер животного', 'Группа', 'Препарат/инъекция', 'Протокол']);
    });
  }

  function renderNotificationCenter(containerId) {
    var container = document.getElementById(containerId);
    if (!container) return;
    var history = getNotificationHistory().slice().reverse().slice(0, 100);
    var groups = groupNotificationsForDisplay(history);
    var listHtml = '';
    groups.forEach(function (g) {
      listHtml += '<div class="notification-group" data-group-kind="' + (g.kind || '').replace(/"/g, '&quot;') + '">';
      listHtml += '<h4 class="notification-group-title">' + (g.label || g.kind).replace(/</g, '&lt;') + ' <span class="notification-group-count">(' + g.count + ')</span></h4>';
      listHtml += '<ul class="notification-list">';
      g.items.forEach(function (n) {
        var unreadClass = n.read === false ? ' notification-item-unread' : '';
        var cattleIdSafe = (n.cattleId || '').replace(/"/g, '&quot;');
        var cardBtn = n.cattleId
          ? '<button type="button" class="small-btn notification-view-card-btn" data-cattle-id="' + cattleIdSafe + '" aria-label="Посмотреть карточку">Посмотреть карточку</button>'
          : '';
        listHtml += '<li class="notification-item notification-' + (n.type || 'info') + unreadClass + '" data-notif-id="' + (n.id || '').replace(/"/g, '&quot;') + '" data-cattle-id="' + cattleIdSafe + '">' +
          '<div class="notification-item-content">' +
            '<span class="notification-message">' + (n.message || '').replace(/</g, '&lt;') + '</span>' +
            '<span class="notification-time">' + (n.createdAt ? new Date(n.createdAt).toLocaleString('ru-RU') : '') + '</span>' +
          '</div>' +
          (cardBtn ? '<div class="notification-item-actions">' + cardBtn + '</div>' : '') +
          '</li>';
      });
      listHtml += '</ul></div>';
    });
    if (!listHtml) listHtml = '<ul class="notification-list"><li class="notification-item notification-empty">Нет уведомлений</li></ul>';
    container.innerHTML =
      '<div class="notification-center">' +
        '<section class="notification-section" aria-labelledby="notif-section-title">' +
          '<h2 id="notif-section-title" class="notification-section-title">Уведомления</h2>' +
          '<div class="notification-center-header">' +
            '<button type="button" class="small-btn" id="notifCheckNow">Проверить сейчас</button>' +
            '<button type="button" class="small-btn" id="notifClearHistory">Очистить историю</button>' +
          '</div>' +
          '<div class="notification-groups">' + listHtml + '</div>' +
        '</section>' +
      '</div>';
    var checkBtn = document.getElementById('notifCheckNow');
    var clearBtn = document.getElementById('notifClearHistory');
    if (checkBtn) {
      checkBtn.addEventListener('click', function () {
        checkUpcomingEvents();
        renderNotificationCenter(containerId);
      });
    }
    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        saveHistory([]);
        renderNotificationCenter(containerId);
        updateNotificationIndicators();
      });
    }
    container.querySelectorAll('.notification-item[data-notif-id]').forEach(function (item) {
      item.addEventListener('click', function (ev) {
        if (ev.target.closest('.notification-view-card-btn')) return;
        var id = item.getAttribute('data-notif-id');
        if (markNotificationRead(id)) renderNotificationCenter(containerId);
      });
    });
    container.querySelectorAll('.notification-view-card-btn').forEach(function (btn) {
      btn.addEventListener('click', function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        var cattleId = btn.getAttribute('data-cattle-id');
        if (cattleId) {
          if (typeof window !== 'undefined') window._viewCowReturnTo = 'notifications';
          if (typeof viewCow === 'function') viewCow(cattleId);
        }
      });
    });
    updateNotificationIndicators();
  }

  function initNotifications() {
    scheduleReminders();
    if (typeof window.requestNotificationPermission === 'undefined') {
      window.requestNotificationPermission = requestNotificationPermission;
    }
    if (document.getElementById('menuNotificationsBody')) {
      renderNotificationSummary('menuNotificationsBody');
    } else {
      updateNotificationIndicators();
    }
  }

  if (typeof window !== 'undefined') {
    window.checkUpcomingEvents = checkUpcomingEvents;
    window.createNotification = createNotification;
    window.scheduleReminders = scheduleReminders;
    window.getNotificationHistory = getNotificationHistory;
    window.getUnreadNotificationCount = getUnreadCount;
    window.markNotificationRead = markNotificationRead;
    window.updateNotificationIndicators = updateNotificationIndicators;
    window.renderNotificationSummary = renderNotificationSummary;
    window.renderNotificationCenter = renderNotificationCenter;
    window.requestNotificationPermission = requestNotificationPermission;
    window.renderTasksScreen = function () {
      var el = document.getElementById('tasksScreenContainer');
      if (el) renderTasksList(el);
    };
    window.getProtocolTasks = getProtocolTasks;
    window.groupNotificationsForDisplay = groupNotificationsForDisplay;
    window.inferNotificationKind = inferKind;
  }

  if (typeof window !== 'undefined' && window.document) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initNotifications);
    } else {
      initNotifications();
    }
  }
})(typeof window !== 'undefined' ? window : this);
export {};
