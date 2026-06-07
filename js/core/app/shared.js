/** Shared state: __app */
(function () {
  'use strict';
  var root = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this);
  var NS = root['__app'] = root['__app'] || {};
  var global = root;
  if (!NS.state) {
    NS.state = {};
  }
})();
export {};
