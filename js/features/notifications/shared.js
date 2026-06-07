/** Shared state: __notif */
(function () {
  'use strict';
  var root = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this);
  var NS = root['__notif'] = root['__notif'] || {};
  var global = root;
  if (!NS.state) {
    NS.state = {};
    NS.state.STORAGE_KEY = 'cattleTracker_notifications';;
    NS.state.LIST_KEY = 'cattleTracker_notification_history';;
    NS.state.CHECK_INTERVAL_MS = 60 * 1000;;
    NS.state.timerId = null;;
  }
})();
export {};
