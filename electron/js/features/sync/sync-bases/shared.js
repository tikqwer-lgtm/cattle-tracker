/** Shared state: __syncBases */
(function () {
  'use strict';
  var root = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this);
  var NS = root['__syncBases'] = root['__syncBases'] || {};
  var global = root;
  if (!NS.state) {
    NS.state = {};
  }
})();
export {};
