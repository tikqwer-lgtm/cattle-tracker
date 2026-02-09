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
      var list = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(list)) return [];
      var migrated = false;
      list = list.map(function (n) {
        if (n.read === undefined) {
          migrated = true;
          return Object.assign({}, n, { read: true });
        }
        return n;
      });
      if (migrated) saveHistory(list);
      return list;
    } catch (e) {
      return [];
    }
  }

  function saveHistory(list) {
    try {
      localStorage.setItem(LIST_KEY, JSON.stringify((list || []).slice(-200)));
    } catch (e) {}
  }

  function markNotificationRead(id) {
    var list = loadHistory();
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) {
        list[i] = Object.assign({}, list[i], { read: true });
        saveHistory(list);
        if (typeof window.CattleTrackerEvents !== 'undefined') {
          window.CattleTrackerEvents.emit('notification:read', id);
        }
        return true;
      }
    }
    return false;
  }

  function getUnreadCount() {
    return loadHistory().filter(function (n) { return !n.read; }).length;
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

  function createNotification(type, message, cowId, meta) {
    meta = meta || {};
    var silent = meta.silent === true || meta.fromTimer === true;
    var item = {
      id: 'n_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9),
      type: type || 'info',
      message: message || '',
      cattleId: cowId || '',
      meta: meta,
      category: meta.category || 'other',
      read: false,
      createdAt: new Date().toISOString()
    };
    var history = loadHistory();
    history.push(item);
    saveHistory(history);
    if (!silent) {
      if (typeof window.showToast === 'function') {
        window.showToast(message, type === 'error' ? 'error' : 'info', 4000);
      }
      if ('Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification('Учёт коров', { body: message, tag: item.id });
        } catch (err) {}
      }
    }
    if (typeof window.CattleTrackerEvents !== 'undefined') {
      window.CattleTrackerEvents.emit('notification:created', item);
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
            out.push(createNotification('info', 'Предстоящий отёл: корова ' + cattleId + ' через ' + daysToCalving + ' дн.', cattleId, { daysToCalving: daysToCalving, category: 'calving', fromTimer: true }));
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
            out.push(createNotification('info', 'Рекомендуется осеменение: корова ' + cattleId + ' (прошло ' + daysSinceCalving + ' дн. после отёла)', cattleId, { daysSinceCalving: daysSinceCalving, category: 'insemination', fromTimer: true }));
          }
        }
      }

      if (calvingDate && calvingDate > today) {
        var dryOffDue = daysBetween(new Date(), calvingDate);
        if (dryOffDue <= VWP_DAYS && dryOffDue >= VWP_DAYS - 14) {
          var key3 = 'dry_' + cattleId;
          if (!notified[key3]) {
            notified[key3] = true;
            out.push(createNotification('info', 'Запуск в сухостой: корова ' + cattleId + ' (отёл через ~' + dryOffDue + ' дн.)', cattleId, { daysToCalving: dryOffDue, category: 'dry', fromTimer: true }));
          }
        }
      }
    });

    var unsynced = list.filter(function (e) { return e.synced !== true; });
    if (unsynced.length > 0) {
      var key4 = 'unsynced_count';
      if (!notified[key4]) {
        notified[key4] = true;
        out.push(createNotification('info', 'Не синхронизировано записей: ' + unsynced.length, '', { count: unsynced.length, category: 'sync', fromTimer: true }));
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
    return loadHistory();
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
        var unreadClass = !n.read ? ' notification-item-unread' : '';
        listHtml += '<li class="notification-item notification-' + (n.type || 'info') + unreadClass + '" data-notification-id="' + (n.id || '').replace(/"/g, '&quot;') + '" data-cattle-id="' + (n.cattleId || '').replace(/"/g, '&quot;') + '" role="button" tabindex="0">' +
          '<span class="notification-message">' + (n.message || '').replace(/</g, '&lt;') + '</span>' +
          '<span class="notification-time">' + (n.createdAt ? new Date(n.createdAt).toLocaleString('ru-RU') : '') + '</span>' +
          '</li>';
      });
      listHtml += '</ul></div>';
    });
    if (!listHtml) listHtml = '<ul class="notification-list"><li class="notification-item notification-empty">Нет уведомлений</li></ul>';
    container.innerHTML =
      '<div class="notification-center">' +
        '<div class="notification-center-header">' +
          '<span>Уведомления</span>' +
          '<button type="button" class="small-btn" id="notifCheckNow">Проверить сейчас</button>' +
          '<button type="button" class="small-btn" id="notifClearHistory">Очистить историю</button>' +
        '</div>' +
        '<div class="notification-groups">' + listHtml + '</div>' +
        '<div id="tasks-list-container" class="tasks-list-container"></div>' +
      '</div>';
    var tasksContainer = document.getElementById('tasks-list-container');
    if (tasksContainer) renderTasksList(tasksContainer);
    container.querySelectorAll('.notification-item[data-notification-id]').forEach(function (li) {
      li.addEventListener('click', function () {
        var id = li.getAttribute('data-notification-id');
        if (id && markNotificationRead(id)) {
          renderNotificationCenter(containerId);
          if (typeof renderMenuNotificationsDropdown === 'function') renderMenuNotificationsDropdown('menu-notifications-dropdown');
        }
      });
    });
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
      });
    }
  }

  var MENU_DROPDOWN_LIMIT = 15;

  function renderMenuNotificationsDropdown(containerId) {
    var container = document.getElementById(containerId);
    var badgeEl = document.getElementById('notificationBadge');
    var unreadCount = getUnreadCount();
    if (badgeEl) {
      badgeEl.textContent = unreadCount > 0 ? String(unreadCount) : '0';
      badgeEl.classList.toggle('notification-badge-empty', unreadCount === 0);
    }
    if (!container) return;
    var history = getNotificationHistory().slice().reverse().slice(0, MENU_DROPDOWN_LIMIT);
    if (history.length === 0) {
      container.innerHTML = '<p class="notifications-dropdown-empty">Нет уведомлений</p>';
      return;
    }
    var html = '<ul class="notifications-dropdown-list">';
    history.forEach(function (n) {
      var unreadClass = !n.read ? ' notification-item-unread' : '';
      html += '<li class="notification-item notification-' + (n.type || 'info') + unreadClass + '" data-notification-id="' + (n.id || '').replace(/"/g, '&quot;') + '" role="button" tabindex="0">' +
        '<span class="notification-message">' + (n.message || '').replace(/</g, '&lt;') + '</span>' +
        '<span class="notification-time">' + (n.createdAt ? new Date(n.createdAt).toLocaleString('ru-RU') : '') + '</span>' +
        '</li>';
    });
    html += '</ul><p class="notifications-dropdown-more"><a href="#" onclick="navigateToSubmenu(\'notifications\'); return false;">Все уведомления</a></p>';
    container.innerHTML = html;
    container.querySelectorAll('.notification-item[data-notification-id]').forEach(function (li) {
      li.addEventListener('click', function (e) {
        if (e.target && e.target.tagName === 'A') return;
        var id = li.getAttribute('data-notification-id');
        if (id && markNotificationRead(id)) {
          renderMenuNotificationsDropdown(containerId);
        }
      });
    });
  }

  function toggleMenuNotificationsDropdown() {
    var body = document.getElementById('menuNotificationsDropdownBody');
    if (!body) return;
    var isExpanded = body.style.display !== 'none';
    body.style.display = isExpanded ? 'none' : 'block';
  }

  function initNotifications() {
    scheduleReminders();
    if (typeof window.requestNotificationPermission === 'undefined') {
      window.requestNotificationPermission = requestNotificationPermission;
    }
  }

  if (typeof window !== 'undefined') {
    window.checkUpcomingEvents = checkUpcomingEvents;
    window.createNotification = createNotification;
    window.scheduleReminders = scheduleReminders;
    window.getNotificationHistory = getNotificationHistory;
    window.renderNotificationCenter = renderNotificationCenter;
    window.requestNotificationPermission = requestNotificationPermission;
    window.markNotificationRead = markNotificationRead;
    window.getUnreadCount = getUnreadCount;
    window.renderMenuNotificationsDropdown = renderMenuNotificationsDropdown;
    window.toggleMenuNotificationsDropdown = toggleMenuNotificationsDropdown;
  }

  if (typeof window !== 'undefined' && window.document) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initNotifications);
    } else {
      initNotifications();
    }
  }
})(typeof window !== 'undefined' ? window : this);
