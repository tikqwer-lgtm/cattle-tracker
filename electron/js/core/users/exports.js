/** Public window exports */
import './part-3.js';

  if (typeof window !== 'undefined') {
  var SM = globalThis['__users'];
    window.registerUser = registerUser;
    window.loginUser = loginUser;
    window.logoutUser = logoutUser;
    window.getCurrentUser = getCurrentUser;
    window.saveCurrentUser = saveCurrentUser;
    window.getVisibleEntries = getVisibleEntries;
    window.canAdd = canAdd;
    window.canEdit = canEdit;
    window.canDelete = canDelete;
    window.filterObjectsListForRole = filterObjectsListForRole;
    window.updateAuthBar = updateAuthBar;
    window.showAuthLogin = showAuthLogin;
    window.showAuthRegister = showAuthRegister;
    window.focusAuthForm = focusAuthForm;
    window.handleLogin = handleLogin;
    window.handleRegister = handleRegister;
    window.skipAuth = skipAuth;
    window.handleLogout = handleLogout;
    window.saveServerBaseUrl = saveServerBaseUrl;
    window.getSavedServerBase = getSavedServerBase;
    window.initRegisterUsernameCheck = initRegisterUsernameCheck;
    window.fillAuthUsernameList = fillAuthUsernameList;
    window.bindAuthControls = bindAuthControls;
    window.updateAuthSessionStatusUi = updateAuthSessionStatusUi;
  }

  if (typeof window !== 'undefined' && window.document) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initUsers);
    } else {
      initUsers();
    }
  }


export {};
