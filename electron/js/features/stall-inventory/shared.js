/** Shared state: __stallInv */
(function () {
  'use strict';
  var root = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this);
  var NS = root['__stallInv'] = root['__stallInv'] || {};
  var global = root;
  if (!NS.state) {
    NS.state = {};
    NS.state.INVENTORY_SESSION_PREFIX = 'cattleTracker_stallInventory_';;
    NS.state._inventoryTab = 'print';;
    NS.state._inventorySession = null;;
  }
})();
export {};
