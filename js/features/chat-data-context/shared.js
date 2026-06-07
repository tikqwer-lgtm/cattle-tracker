/** Shared state: __chatCtx */
(function () {
  'use strict';
  var root = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this);
  var NS = root['__chatCtx'] = root['__chatCtx'] || {};
  var global = root;
  if (!NS.state) {
    NS.state = {};
    NS.state.MAX_LIST_ITEMS = 12;;
    NS.state.ANALYTICS_SETTINGS_KEY = 'cattleTracker_analytics_settings';;
    NS.state.STALL_LAYOUT_PREFIX = 'cattleTracker_stallLayout_';;
    NS.state.CURRENT_OBJECT_KEY = 'cattleTracker_currentObject';;
  }
})();
export {};
