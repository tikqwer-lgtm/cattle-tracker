/** Shared state: __exportImport */
(function () {
  'use strict';
  var root = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this);
  var NS = root['__exportImport'] = root['__exportImport'] || {};
  var global = root;
  if (!NS.state) {
    NS.state = {};
  }
})();
export {};
