/** Shared state: __stallMap */
(function () {
  'use strict';
  var root = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this);
  var NS = root['__stallMap'] = root['__stallMap'] || {};
  var global = root;
  if (!NS.state) {
    NS.state = {};
    NS.state.STALL_LAYOUT_STORAGE_PREFIX = 'cattleTracker_stallLayout_';;
    NS.state._stallMapLayoutCache = { yards: {} };;
    NS.state._stallMapYardKey = '';;
    NS.state._stallMapAssignTarget = null;;
    NS.state._stallMapCellModalCtx = null;;
    NS.state._stallMapViewportListenersBound = false;;
    NS.state._stallMapEntriesUiBound = false;;
    NS.state._stallMapLifecycleBound = false;;
    NS.state._stallMapInsetRaf = null;;
    NS.state._stallMapAssignPollTimer = null;;
    NS.state._stallMapAssignPollLastValue = '';;
    NS.state._stallMapConfirmAssignBusy = false;;
  }
})();
export {};
