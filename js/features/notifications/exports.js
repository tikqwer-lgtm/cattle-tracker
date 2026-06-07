/** Public window exports */
import './part-3.js';

if (typeof globalThis !== 'undefined') {
  var SM = globalThis.__notif;
  window.checkUpcomingEvents = SM.checkUpcomingEvents;
  window.createNotification = SM.createNotification;
  window.scheduleReminders = SM.scheduleReminders;
  window.getNotificationHistory = SM.getNotificationHistory;
  window.getUnreadNotificationCount = SM.getUnreadCount;
  window.markNotificationRead = SM.markNotificationRead;
  window.updateNotificationIndicators = SM.updateNotificationIndicators;
  window.renderNotificationSummary = SM.renderNotificationSummary;
  window.renderNotificationCenter = SM.renderNotificationCenter;
  window.requestNotificationPermission = SM.requestNotificationPermission;
  window.renderTasksScreen = function () {
    var el = document.getElementById('tasksScreenContainer');
    if (el) SM.renderTasksList(el);
  };
  window.getProtocolTasks = SM.getProtocolTasks;
  window.groupNotificationsForDisplay = SM.groupNotificationsForDisplay;
  window.inferNotificationKind = SM.inferKind;
}

if (typeof globalThis !== 'undefined' && globalThis.document) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { SM.initNotifications(); });
  } else {
    SM.initNotifications();
  }
}

export {};
