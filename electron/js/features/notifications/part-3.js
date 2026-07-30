/** __notif part 3 */
(function () {
  'use strict';
  var root = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this);
  var NS = root['__notif'] = root['__notif'] || {};
  var global = typeof window !== 'undefined' ? window : this;

  function renderNotificationCenter(containerId) {
    var container = document.getElementById(containerId);
    if (!container) return;
    var history = globalThis['__notif'].getNotificationHistory().slice().reverse().slice(0, 100);
    var groups = globalThis['__notif'].groupNotificationsForDisplay(history);
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
        globalThis['__notif'].checkUpcomingEvents();
        renderNotificationCenter(containerId);
      });
    }
    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        globalThis['__notif'].saveHistory([]);
        renderNotificationCenter(containerId);
        globalThis['__notif'].updateNotificationIndicators();
      });
    }
    container.querySelectorAll('.notification-item[data-notif-id]').forEach(function (item) {
      item.addEventListener('click', function (ev) {
        if (ev.target.closest('.notification-view-card-btn')) return;
        var id = item.getAttribute('data-notif-id');
        if (globalThis['__notif'].markNotificationRead(id)) renderNotificationCenter(containerId);
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
    globalThis['__notif'].updateNotificationIndicators();
  }

  function initNotifications() {
    globalThis['__notif'].normalizeHistory(globalThis['__notif'].loadHistory());
    globalThis['__notif'].scheduleReminders();
    if (typeof window.requestNotificationPermission === 'undefined') {
      window.requestNotificationPermission = requestNotificationPermission;
    }
    globalThis['__notif'].updateNotificationIndicators();
    if (typeof window !== 'undefined' && window.CattleTrackerEvents && typeof window.CattleTrackerEvents.on === 'function') {
      window.CattleTrackerEvents.on('farm-goal:changed', function () {
        try {
          globalThis['__notif'].checkUpcomingEvents();
        } catch (e) {}
      });
      window.CattleTrackerEvents.on('farm-card:updated', function () {
        try {
          globalThis['__notif'].checkUpcomingEvents();
        } catch (e) {}
      });
    }
  }


  // register functions
  NS.renderNotificationCenter = renderNotificationCenter;
  NS.initNotifications = initNotifications;
})();
export {};
