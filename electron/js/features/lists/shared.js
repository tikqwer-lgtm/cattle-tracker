/** Shared state: __lists */
(function () {
  'use strict';
  var root = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this);
  var NS = root['__lists'] = root['__lists'] || {};
  var global = root;
  if (!NS.state) {
    NS.state = {};
  }
})();
export {};
