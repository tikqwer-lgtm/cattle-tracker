/** Shared state: __protocols */
(function () {
  'use strict';
  var root = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this);
  var NS = root['__protocols'] = root['__protocols'] || {};
  var global = root;
  if (!NS.state) {
    NS.state = {};
  }
})();
export {};
