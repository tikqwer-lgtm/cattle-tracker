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

  function createNotification(type, message, cowId, meta) {
    var item = {
      id: 'n_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9),
      type: type || 'info',
      message: message || '',
      cattleId: cowId || '',
      meta: meta || {},
      createdAt: new Date().toISOString()
    };
    var history = loadHistory();
    history.push(item);
    saveHistory(history);
    if (typeof window.showToast === 'function') {
      window.showToast(message, type === 'error' ? 'error' : 'info', 4000);
    }
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification('Учёт коров', { body: message, tag: item.id });
      } catch (err) {}
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
            out.push(createNotification('info', 'Предстоящий отёл: корова ' + cattleId + ' через ' + daysToCalving + ' дн.', cattleId, { daysToCalving: daysToCalving }));
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
            out.push(createNotification('info', 'Рекомендуется осеменение: корова ' + cattleId + ' (прошло ' + daysSinceCalving + ' дн. после отёла)', cattleId, { daysSinceCalving: daysSinceCalving }));
          }
        }
      }

      if (calvingDate && calvingDate > today) {
        var dryOffDue = daysBetween(new Date(), calvingDate);
        if (dryOffDue <= VWP_DAYS && dryOffDue >= VWP_DAYS - 14) {
          var key3 = 'dry_' + cattleId;
          if (!notified[key3]) {
            notified[key3] = true;
            out.push(createNotification('info', 'Запуск в сухостой: корова ' + cattleId + ' (отёл через ~' + dryOffDue + ' дн.)', cattleId, { daysToCalving: dryOffDue }));
          }
        }
      }
    });

    var unsynced = list.filter(function (e) { return e.synced !== true; });
    if (unsynced.length > 0) {
      var key4 = 'unsynced_count';
      if (!notified[key4]) {
        notified[key4] = true;
        out.push(createNotification('info', 'Не синхронизировано записей: ' + unsynced.length, '', { count: unsynced.length }));
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

  function renderNotificationCenter(containerId) {
    var container = document.getElementById(containerId);
    if (!container) return;
    var history = getNotificationHistory().slice().reverse().slice(0, 50);
    container.innerHTML =
      '<div class="notification-center">' +
        '<div class="notification-center-header">' +
          '<span>Уведомления</span>' +
          '<button type="button" class="small-btn" id="notifCheckNow">Проверить сейчас</button>' +
          '<button type="button" class="small-btn" id="notifClearHistory">Очистить историю</button>' +
        '</div>' +
        '<ul class="notification-list">' +
          (history.length === 0
            ? '<li class="notification-item notification-empty">Нет уведомлений</li>'
            : history.map(function (n) {
                return '<li class="notification-item notification-' + (n.type || 'info') + '" data-cattle-id="' + (n.cattleId || '').replace(/"/g, '&quot;') + '">' +
                  '<span class="notification-message">' + (n.message || '').replace(/</g, '&lt;') + '</span>' +
                  '<span class="notification-time">' + (n.createdAt ? new Date(n.createdAt).toLocaleString('ru-RU') : '') + '</span>' +
                  '</li>';
              }).join('')) +
        '</ul>' +
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
      });
    }
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
  }

  if (typeof window !== 'undefined' && window.document) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initNotifications);
    } else {
      initNotifications();
    }
  }
})(typeof window !== 'undefined' ? window : this);
