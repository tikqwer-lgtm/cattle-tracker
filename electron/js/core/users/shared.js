/** Shared state: __users */
(function () {
  'use strict';
  var root = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this);
  var NS = root['__users'] = root['__users'] || {};
  var global = root;
  if (!NS.state) {
    NS.state = {};
    NS.state.USERS_KEY = 'cattleTracker_users';;
    NS.state.CURRENT_USER_KEY = 'cattleTracker_currentUser';;
    NS.state.LAST_USERNAMES_KEY = 'cattleTracker_lastUsernames';;
    NS.state.MAX_LAST_USERNAMES = 15;;
    NS.state.currentUser = null;;
    NS.state.loginInProgress = false;;
  }
})();
export {};
