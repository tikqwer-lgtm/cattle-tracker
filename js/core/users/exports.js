/** Public window exports */
import './part-3.js';

if (typeof window !== 'undefined') {
  var SM = globalThis['__users'];
  window.registerUser = SM.registerUser;
  window.loginUser = SM.loginUser;
  window.logoutUser = SM.logoutUser;
  window.getCurrentUser = SM.getCurrentUser;
  window.saveCurrentUser = SM.saveCurrentUser;
  window.getVisibleEntries = SM.getVisibleEntries;
  window.getRealRole = SM.getRealRole;
  window.getUiRole = SM.getUiRole;
  window.getEffectiveRole = SM.getEffectiveRole;
  window.setPreviewRole = SM.setPreviewRole;
  window.clearPreviewRole = SM.clearPreviewRole;
  window.isRolePreviewMode = SM.isRolePreviewMode;
  window.rejectIfPreviewMutation = SM.rejectIfPreviewMutation;
  window.isAppAdminRole = SM.isAppAdminRole;
  window.hasCapability = SM.hasCapability;
  window.setRoleCapabilities = SM.setRoleCapabilities;
  window.getRoleCapabilities = SM.getRoleCapabilities;
  window.canInputServiceWorks = SM.canInputServiceWorks;
  window.canAdd = SM.canAdd;
  window.canEdit = SM.canEdit;
  window.canDelete = SM.canDelete;
  window.filterObjectsListForRole = SM.filterObjectsListForRole;
  window.updateAuthBar = SM.updateAuthBar;
  window.showAuthLogin = SM.showAuthLogin;
  window.showAuthRegister = SM.showAuthRegister;
  window.focusAuthForm = SM.focusAuthForm;
  window.handleLogin = SM.handleLogin;
  window.handleRegister = SM.handleRegister;
  window.skipAuth = SM.skipAuth;
  window.handleLogout = SM.handleLogout;
  window.saveServerBaseUrl = SM.saveServerBaseUrl;
  window.getSavedServerBase = SM.getSavedServerBase;
  window.initRegisterUsernameCheck = SM.initRegisterUsernameCheck;
  window.fillAuthUsernameList = SM.fillAuthUsernameList;
  window.bindAuthControls = SM.bindAuthControls;
  window.updateAuthSessionStatusUi = SM.updateAuthSessionStatusUi;
  window.showAuthAccessRequestModal = SM.showAuthAccessRequestModal;
  window.fillAuthServerSelect = SM.fillAuthServerSelect;
}

if (typeof window !== 'undefined' && window.document) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { SM.initUsers(); });
  } else {
    SM.initUsers();
  }
}

export {};
