/** Shared state: __viewList */
(function () {
  'use strict';
  var root = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this);
  var NS = root['__viewList'] = root['__viewList'] || {};
  var global = root;
  if (!NS.state) {
    NS.state = {};
    NS.state.viewListSortKey = '';;
    NS.state.viewListSortDir = 'asc';;
  }
})();
export {};
