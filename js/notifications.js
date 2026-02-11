/**
 * notifications.js — Уведомления и напоминания
 */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'cattleTracker_notifications';
  var LIST_KEY = 'cattleTracker_notification_history';
  var CHECK_INTERVAL_MS = 60 * 1000;
  var timerId = null;
  var VWP_DAYS = 60;
  var CALVING_REMINDER_DAYS = [7, 3, 1];

  function parseDate(str) {
    if (!str) return null;
    var d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
  }

  function dateOnly(d) {
    if (!d) return null;
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
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

  var CATEGORY_LABELS = {
    calving: 'Предстоящий отёл',
    insemination: 'Осеменение',
    dry: 'Сухостой',
    sync: 'Синхронизация',
    other: 'Прочее'
  };

  function inferCategory(n) {
    if (n.category) return n.category;
    var msg = (n.message || '').toLowerCase();
    if (msg.indexOf('отёл') !== -1 || msg.indexOf('отел') !== -1) return 'calving';
    if (msg.indexOf('осеменен') !== -1) return 'insemination';
    if (msg.indexOf('сухостой') !== -1) return 'dry';
    if (msg.indexOf('синхрониз') !== -1) return 'sync';
    return 'other';
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
    if (!list.length) return [];
    var today = dateOnly(new Date());
    var now = Date.now();
    var notified = {};
    var out = [];

    list.forEach(function (entry) {
      var cattleId = entry.cattleId || '';
      var calvingDate = parseDate(entry.calvingDate);
      var inseminationDate = parseDate(entry.inseminationDate);
      var dryStartDate = parseDate(entry.dryStartDate);
      var exitDate = parseDate(entry.exitDate);
      if (exitDate && exitDate <= today) return;

      if (calvingDate && calvingDate >= today) {
        var daysToCalving = daysBetween(new Date(), calvingDate);
        if (CALVING_REMINDER_DAYS.indexOf(daysToCalving) !== -1) {
          var key = 'calving_' + cattleId + '_' + daysToCalving;
          if (!notified[key]) {
            notified[key] = true;
            out.push(createNotification('info', 'Предстоящий отёл: корова ' + cattleId + ' через ' + daysToCalving + ' дн.', cattleId, { daysToCalving: daysToCalving, category: 'calving' }, { showToast: false, showSystem: false }));
          }
        }
      }

      var lastCalving = calvingDate;
      if (lastCalving && !inseminationDate) {
        var daysSinceCalving = daysBetween(lastCalving, new Date());
        if (daysSinceCalving >= VWP_DAYS) {
          var key2 = 'insem_' + cattleId;
          if (!notified[key2]) {
            notified[key2] = true;
            out.push(createNotification('info', 'Рекомендуется осеменение: корова ' + cattleId + ' (прошло ' + daysSinceCalving + ' дн. после отёла)', cattleId, { daysSinceCalving: daysSinceCalving, category: 'insemination' }, { showToast: false, showSystem: false }));
          }
        }
      }

      if (calvingDate && calvingDate > today) {
        var dryOffDue = daysBetween(new Date(), calvingDate);
        if (dryOffDue <= VWP_DAYS && dryOffDue >= VWP_DAYS - 14) {
          var key3 = 'dry_' + cattleId;
          if (!notified[key3]) {
            notified[key3] = true;
            out.push(createNotification('info', 'Запуск в сухостой: корова ' + cattleId + ' (отёл через ~' + dryOffDue + ' дн.)', cattleId, { daysToCalving: dryOffDue, category: 'dry' }, { showToast: false, showSystem: false }));
          }
        }
      }

      if (entry.status && String(entry.status).indexOf('Стельная') !== -1 && typeof getDaysPregnant === 'function') {
        var daysPreg = getDaysPregnant(entry);
        if (daysPreg !== null && daysPreg > 275) {
          var keyOverdue = 'overdue_' + cattleId;
          if (!notified[keyOverdue]) {
            notified[keyOverdue] = true;
            out.push(createNotification('info', 'Проверить отел: корова ' + cattleId + ' (дней стельности: ' + daysPreg + ')', cattleId, { daysPregnant: daysPreg, category: 'calving' }, { showToast: false, showSystem: false }));
          }
        }
      }
    });

    var unsynced = list.filter(function (e) { return e.synced !== true; });
    if (unsynced.length > 0) {
      var key4 = 'unsynced_count';
      if (!notified[key4]) {
        notified[key4] = true;
        out.push(createNotification('info', 'Не синхронизировано записей: ' + unsynced.length, '', { count: unsynced.length, category: 'sync' }, { showToast: false, showSystem: false }));
      }
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
    var limit = 5;
    var items = list.slice(0, limit);
    var html = '';
    if (items.length === 0) {
      html = '<div class="menu-notifications-empty">Нет уведомлений</div>';
    } else {
      html = '<ul class="menu-notifications-list">';
      items.forEach(function (n) {
        var cls = 'menu-notifications-item' + (n.read === false ? ' notification-item-unread' : '');
        html += '<li class="' + cls + '" data-notif-id="' + (n.id || '').replace(/"/g, '&quot;') + '">' +
          '<div class="menu-notifications-message">' + (n.message || '').replace(/</g, '&lt;') + '</div>' +
          '<div class="menu-notifications-time">' + (n.createdAt ? new Date(n.createdAt).toLocaleString('ru-RU') : '') + '</div>' +
          '</li>';
      });
      html += '</ul>';
    }
    html += '<div class="menu-notifications-actions">' +
      '<button type="button" class="small-btn" data-action="open-notifications">Все уведомления</button>' +
      '</div>';
    body.innerHTML = html;
    updateNotificationIndicators();
    body.querySelectorAll('.menu-notifications-item').forEach(function (item) {
      item.addEventListener('click', function () {
        var id = item.getAttribute('data-notif-id');
        if (markNotificationRead(id)) {
          renderNotificationSummary(containerId);
        }
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
    var todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + String(today.getDate()).padStart(2, '0');
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
    html += '<label>С <input type="date" id="tasksDateFrom" class="tasks-date-input" /></label>';
    html += '<label>По <input type="date" id="tasksDateTo" class="tasks-date-input" /></label>';
    html += '</div>';
    if (dates.length === 0) {
      html += '<p class="tasks-empty">Нет задач на выбранный период.</p>';
    } else {
      html += '<div class="tasks-by-date">';
      dates.forEach(function (dateKey) {
        var dayTasks = byDate[dateKey];
        html += '<div class="tasks-date-group">';
        html += '<div class="tasks-date-header">' + (dateKey || '').replace(/</g, '&lt;') + '</div>';
        html += '<ul class="tasks-date-list">';
        dayTasks.forEach(function (t) {
          html += '<li class="tasks-item">' +
            '<span class="tasks-cattle">' + (t.cattleId || '').replace(/</g, '&lt;') + '</span>' +
            ' | <span class="tasks-group">' + (t.group || '—').replace(/</g, '&lt;') + '</span>' +
            ' | <span class="tasks-drug">' + (t.drug || '—').replace(/</g, '&lt;') + '</span>' +
            ' | <span class="tasks-date">' + (t.date || '').replace(/</g, '&lt;') + '</span>' +
            '</li>';
        });
        html += '</ul></div>';
      });
      html += '</div>';
    }
    html += '</div>';
    containerEl.innerHTML = html;
    var todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + String(today.getDate()).padStart(2, '0');
    function applyRange(range) {
      var from = '';
      var to = '';
      if (range === 'today') {
        from = to = todayStr;
      } else if (range === 'tomorrow') {
        var t2 = new Date(today);
        t2.setDate(t2.getDate() + 1);
        from = to = t2.getFullYear() + '-' + String(t2.getMonth() + 1).padStart(2, '0') + String(t2.getDate()).padStart(2, '0');
      } else if (range === 'week') {
        from = todayStr;
        var t7 = new Date(today);
        t7.setDate(t7.getDate() + 7);
        to = t7.getFullYear() + '-' + String(t7.getMonth() + 1).padStart(2, '0') + String(t7.getDate()).padStart(2, '0');
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
  }

  function renderNotificationCenter(containerId) {
    var container = document.getElementById(containerId);
    if (!container) return;
    var history = getNotificationHistory().slice().reverse().slice(0, 50);
    var order = ['calving', 'insemination', 'dry', 'sync', 'other'];
    var byCategory = {};
    order.forEach(function (cat) { byCategory[cat] = []; });
    history.forEach(function (n) {
      var cat = inferCategory(n);
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(n);
    });
    var listHtml = '';
    order.forEach(function (cat) {
      var items = byCategory[cat] || [];
      if (items.length === 0) return;
      listHtml += '<div class="notification-group">';
      listHtml += '<h4 class="notification-group-title">' + (CATEGORY_LABELS[cat] || cat).replace(/</g, '&lt;') + '</h4>';
      listHtml += '<ul class="notification-list">';
      items.forEach(function (n) {
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
        '<section class="notification-section plans-section" aria-labelledby="plans-section-title">' +
          '<h2 id="plans-section-title" class="notification-section-title">Планы</h2>' +
          '<div id="tasks-list-container" class="tasks-list-container"></div>' +
        '</section>' +
      '</div>';
    var tasksContainer = document.getElementById('tasks-list-container');
    if (tasksContainer) renderTasksList(tasksContainer);
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
        if (cattleId && typeof viewCow === 'function') viewCow(cattleId);
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
  }

  if (typeof window !== 'undefined' && window.document) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initNotifications);
    } else {
      initNotifications();
    }
  }
})(typeof window !== 'undefined' ? window : this);
