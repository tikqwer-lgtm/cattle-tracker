/** Shared state: __viewCow */
(function () {
  'use strict';
  var root = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this);
  var NS = root['__viewCow'] = root['__viewCow'] || {};
  var global = root;
  if (!NS.state) {
    NS.state = {};
  }
})();
export {};
