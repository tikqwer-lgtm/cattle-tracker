/** Shared state: __menu */
(function () {
  'use strict';
  var root = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this);
  var NS = root['__menu'] = root['__menu'] || {};
  var global = root;
  if (!NS.state) {
    NS.state = {};
  }
})();
export {};
