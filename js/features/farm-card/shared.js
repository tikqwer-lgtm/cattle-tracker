/** Shared state: __farmCard */
(function () {
  'use strict';
  var root = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this);
  var NS = root['__farmCard'] = root['__farmCard'] || {};
  var global = root;
  if (!NS.state) {
    NS.state = {};
    NS.state.CACHE_PREFIX = 'cattleTracker_farmProfile_';
    NS.state._farmGen = 0;
  }
  if (NS.state.addrSuggestResults == null) NS.state.addrSuggestResults = [];
  if (NS.state.addrSuggestTimer == null) NS.state.addrSuggestTimer = null;
})();
export {};
