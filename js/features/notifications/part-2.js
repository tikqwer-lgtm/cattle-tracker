import { formatMonthLabel, shiftMonth, monthBounds, monthNavHtml } from '../../ui/month-nav.js';
/** __notif part 2 */
(function () {
  'use strict';
  var root = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this);
  var NS = root['__notif'] = root['__notif'] || {};
  var global = typeof window !== 'undefined' ? window : this;

  function scheduleReminders() {
    if (globalThis['__notif'].state.timerId) clearInterval(globalThis['__notif'].state.timerId);
    globalThis['__notif'].checkUpcomingEvents();
    globalThis['__notif'].state.timerId = setInterval(checkUpcomingEvents, globalThis['__notif'].state.CHECK_INTERVAL_MS);
  }

  function stopReminders() {
    if (globalThis['__notif'].state.timerId) {
      clearInterval(globalThis['__notif'].state.timerId);
      globalThis['__notif'].state.timerId = null;
    }
  }

  function requestNotificationPermission() {
    if (!('Notification' in window)) return Promise.resolve(false);
    if (Notification.permission === 'granted') return Promise.resolve(true);
    if (Notification.permission === 'denied') return Promise.resolve(false);
    return Notification.requestPermission().then(function (p) { return p === 'granted'; });
  }

  function getNotificationHistory() {
    return globalThis['__notif'].normalizeHistory(globalThis['__notif'].loadHistory());
  }

  function getUnreadCount() {
    var list = getNotificationHistory();
    return list.filter(function (n) { return n.read === false; }).length;
  }

  function markNotificationRead(id) {
    if (!id) return false;
    var history = globalThis['__notif'].normalizeHistory(globalThis['__notif'].loadHistory());
    var changed = false;
    history.forEach(function (n) {
      if (n.id === id && n.read === false) {
        n.read = true;
        changed = true;
      }
    });
    if (changed) {
      globalThis['__notif'].saveHistory(history);
      if (typeof updateNotificationIndicators === 'function') {
        updateNotificationIndicators();
      }
    }
    return changed;
  }

  function updateNotificationIndicators() {
    if (typeof document === 'undefined') return;
    var count = getUnreadCount();
    var badge = document.getElementById('menuNotificationsBadge');
    if (badge) {
      badge.textContent = count ? String(count) : '';
      badge.style.display = count ? 'inline-flex' : 'none';
    }
  }

  function renderNotificationSummary(containerId) {
    var body = document.getElementById(containerId);
    if (!body) return;
    var list = getNotificationHistory().slice().reverse();
    var groups = globalThis['__notif'].groupNotificationsForDisplay(list);
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
    var from = fromDate ? globalThis['__notif'].dateOnly(new Date(fromDate)).getTime() : 0;
    var to = toDate ? globalThis['__notif'].dateOnly(new Date(toDate)).getTime() : Number.MAX_SAFE_INTEGER;
    var tasks = [];
    list.forEach(function (entry) {
      var protocol = entry.protocol;
      if (!protocol || !protocol.name || !protocol.startDate) return;
      var def = byName[protocol.name];
      if (!def || !def.steps || !def.steps.length) return;
      var start = globalThis['__notif'].parseDate(protocol.startDate);
      if (!start) return;
      var cattleId = entry.cattleId || '';
      var group = entry.group || '';
      def.steps.forEach(function (step) {
        var d = new Date(start);
        d.setDate(d.getDate() + (parseInt(step.day, 10) || 0));
        var taskDate = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        var taskTime = globalThis['__notif'].dateOnly(d).getTime();
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
    if (typeof window.usesServiceWorkTasksJournal === 'function' && window.usesServiceWorkTasksJournal()) {
      if (typeof window.renderServiceWorkTasksJournal === 'function') {
        window.renderServiceWorkTasksJournal(containerEl, fromDate, toDate);
        return;
      }
    }
    var today = new Date();
    var todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
    if (containerEl._tasksYear == null) containerEl._tasksYear = today.getFullYear();
    if (containerEl._tasksMonth == null) containerEl._tasksMonth = today.getMonth();
    if (!fromDate && !toDate) {
      var bounds0 = monthBounds(containerEl._tasksYear, containerEl._tasksMonth);
      fromDate = bounds0.from;
      toDate = bounds0.to;
    }
    var tasks = getProtocolTasks(fromDate, toDate);
    var byDate = {};
    tasks.forEach(function (t) {
      if (!byDate[t.dateKey]) byDate[t.dateKey] = [];
      byDate[t.dateKey].push(t);
    });
    var dates = Object.keys(byDate).sort();
    var html = '<div class="tasks-list-block">';
    html += monthNavHtml({ prev: 'tasksMonthPrev', next: 'tasksMonthNext', label: 'tasksMonthLabel' });
    html += '<div class="tasks-period">';
    html += '<button type="button" class="small-btn tasks-period-btn" data-range="today">Сегодня</button>';
    html += '<button type="button" class="small-btn tasks-period-btn" data-range="tomorrow">Завтра</button>';
    html += '<button type="button" class="small-btn tasks-period-btn" data-range="week">Неделя</button>';
    html += '</div>';
    var tasksPrintHtml = (typeof window.isMobile === 'function' && window.isMobile()) ? '' : '<button type="button" class="small-btn" id="tasksPrintBtn">Печать</button>';
    html += '<div class="list-actions list-actions-inline">' + tasksPrintHtml + '<button type="button" class="small-btn" id="tasksExcelBtn">Экспорт в Excel</button></div>';
    if (dates.length === 0) {
      html += '<p class="tasks-empty">Нет задач на выбранный период.</p>';
    } else {
      html += '<div class="tasks-by-date">';
      dates.forEach(function (dateKey) {
        var dayTasks = byDate[dateKey];
        html += '<div class="tasks-date-group">';
        html += '<div class="tasks-date-header">' + globalThis['__notif'].formatTaskDateWithWeekdayRu(dateKey) + '</div>';
        html += '<ul class="tasks-date-list">';
        dayTasks.forEach(function (t) {
          html += '<li class="tasks-item">' +
            '<span class="tasks-cattle">' + (t.cattleId || '').replace(/</g, '&lt;') + '</span>' +
            ' | <span class="tasks-group">' + (t.group || '—').replace(/</g, '&lt;') + '</span>' +
            ' | <span class="tasks-drug">' + (t.drug || '—').replace(/</g, '&lt;') + '</span>' +
            ' | <span class="tasks-date">' + globalThis['__notif'].formatTaskDateWithWeekdayRu(t.date) + '</span>' +
            '</li>';
        });
        html += '</ul></div>';
      });
      html += '</div>';
    }
    html += '</div>';
    containerEl.innerHTML = html;
    var monthLabelEl = containerEl.querySelector('#tasksMonthLabel');
    if (monthLabelEl) monthLabelEl.textContent = formatMonthLabel(containerEl._tasksYear, containerEl._tasksMonth);
    var todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
    function applyRange(range) {
      var from = '';
      var to = '';
      if (range === 'today') {
        from = to = todayStr;
        containerEl._tasksYear = today.getFullYear();
        containerEl._tasksMonth = today.getMonth();
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
      renderTasksList(containerEl, from || undefined, to || undefined);
    }
    containerEl.querySelectorAll('.tasks-period-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        applyRange(btn.getAttribute('data-range'));
      });
    });
    var prevBtn = containerEl.querySelector('#tasksMonthPrev');
    var nextBtn = containerEl.querySelector('#tasksMonthNext');
    if (prevBtn) prevBtn.addEventListener('click', function () {
      var n = shiftMonth(containerEl._tasksYear, containerEl._tasksMonth, -1);
      containerEl._tasksYear = n.year;
      containerEl._tasksMonth = n.month;
      var b = monthBounds(n.year, n.month);
      renderTasksList(containerEl, b.from, b.to);
    });
    if (nextBtn) nextBtn.addEventListener('click', function () {
      var n = shiftMonth(containerEl._tasksYear, containerEl._tasksMonth, 1);
      containerEl._tasksYear = n.year;
      containerEl._tasksMonth = n.month;
      var b = monthBounds(n.year, n.month);
      renderTasksList(containerEl, b.from, b.to);
    });
    var printBtn = document.getElementById('tasksPrintBtn');
    if (printBtn) {
      printBtn.addEventListener('click', function () {
        if (typeof global.print === 'function') global.print(); else window.print();
      });
    }
    var excelBtn = document.getElementById('tasksExcelBtn');
    if (excelBtn) excelBtn.addEventListener('click', function () {
      var taskList = getProtocolTasks(fromDate, toDate);
      if (typeof global.exportListToExcel === 'function') global.exportListToExcel('Список_задач', taskList, ['date', 'cattleId', 'group', 'drug', 'protocolName'], ['Дата', 'Номер животного', 'Группа', 'Препарат/инъекция', 'Протокол']);
    });
  }


  // register functions
  NS.scheduleReminders = scheduleReminders;
  NS.stopReminders = stopReminders;
  NS.requestNotificationPermission = requestNotificationPermission;
  NS.getNotificationHistory = getNotificationHistory;
  NS.getUnreadCount = getUnreadCount;
  NS.markNotificationRead = markNotificationRead;
  NS.updateNotificationIndicators = updateNotificationIndicators;
  NS.renderNotificationSummary = renderNotificationSummary;
  NS.getProtocolTasks = getProtocolTasks;
  NS.renderTasksList = renderTasksList;
})();
export {};
