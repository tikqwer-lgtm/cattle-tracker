/** Shared state: __analytics */
(function () {
  'use strict';
  var root = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this);
  var NS = root['__analytics'] = root['__analytics'] || {};
  var global = root;
  if (!NS.state) {
    NS.state = {};
  }
})();
export {};
