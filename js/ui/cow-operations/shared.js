/** Shared state: __cowOps */
(function () {
  'use strict';
  var root = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this);
  var NS = root['__cowOps'] = root['__cowOps'] || {};
  var global = root;
  if (!NS.state) {
    NS.state = {};
  }
})();
export {};
