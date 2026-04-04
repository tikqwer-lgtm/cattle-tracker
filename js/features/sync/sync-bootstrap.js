/** Фрагмент модуля синхронизации; фасад: ../sync.js */
function applyMobileSyncUploadRestrictions() {
  var lim = window.CATTLE_TRACKER_USE_API && typeof window.isMobile === 'function' && window.isMobile();
  var sendBtn = document.getElementById('syncSendToServerBtn');
  if (sendBtn) sendBtn.style.display = lim ? 'none' : '';
  var serverBlock = document.getElementById('sync-server-block');
  if (serverBlock) {
    var btns = serverBlock.querySelectorAll('button.sync-control-btn');
    for (var i = 0; i < btns.length; i++) {
      var oc = btns[i].getAttribute('onclick') || '';
      if (oc.indexOf('sendToServer') !== -1) btns[i].style.display = lim ? 'none' : '';
    }
  }
}

function initSyncServerBlock() {
  var connectBlock = document.getElementById('sync-connect-block');
  var serverBlock = document.getElementById('sync-server-block');
  var useApi = typeof window !== 'undefined' && window.CATTLE_TRACKER_USE_API && window.CattleTrackerApi;
  if (connectBlock) connectBlock.style.display = useApi ? 'none' : '';
  if (serverBlock) serverBlock.style.display = useApi ? '' : 'none';
  if (useApi) {
    if (typeof window.updateSyncServerStatusFromHealth === 'function') window.updateSyncServerStatusFromHealth();
    if (typeof window.renderSyncServerBasesList === 'function') window.renderSyncServerBasesList();
    try {
      var skipUpload = typeof window.isMobile === 'function' && window.isMobile();
      if (localStorage.getItem('cattleTracker_uploadAfterConnect') === '1') {
        localStorage.removeItem('cattleTracker_uploadAfterConnect');
        if (!skipUpload) {
          setTimeout(function () {
            if (typeof window.uploadCurrentBaseToServer === 'function') window.uploadCurrentBaseToServer();
          }, 1500);
        }
      } else if (localStorage.getItem('cattleTracker_syncAfterConnect') === '1') {
        localStorage.removeItem('cattleTracker_syncAfterConnect');
        if (!skipUpload) {
          setTimeout(function () {
            if (typeof window.syncCurrentBaseToServer === 'function') window.syncCurrentBaseToServer();
          }, 1500);
        }
      }
    } catch (e) {}
  } else {
    if (typeof window.updateConnectionIndicator === 'function') window.updateConnectionIndicator(false);
    var defUrl =
      typeof window !== 'undefined' && window.CATTLE_TRACKER_DEFAULT_SERVER_URL != null
        ? String(window.CATTLE_TRACKER_DEFAULT_SERVER_URL).trim().replace(/\/$/, '')
        : '';
    var pre = '';
    try {
      pre = (localStorage.getItem('cattleTracker_lastConnectUrl') || '').trim();
    } catch (e) {}
    var val = pre || defUrl || '';
    function prefillConnectUrlInput(el) {
      if (!el || el.dataset.prefilled === '1') return;
      el.dataset.prefilled = '1';
      if (defUrl) el.placeholder = defUrl;
      if (val) el.value = val;
    }
    prefillConnectUrlInput(document.getElementById('syncConnectServerUrlInput'));
    prefillConnectUrlInput(document.getElementById('authLocalConnectServerUrlInput'));
  }
  if (typeof window.initSyncMobileApkSection === 'function') window.initSyncMobileApkSection();
  if (typeof window.initSyncDesktopApkAdmin === 'function') window.initSyncDesktopApkAdmin();
  if (useApi) {
    var inp = document.getElementById('syncAdminServerUrlInput');
    if (inp && window.CattleTrackerApi && typeof window.CattleTrackerApi.getBaseUrl === 'function') {
      if (typeof window.getCurrentUser === 'function') {
        var u = window.getCurrentUser();
        if (u && u.role === 'admin') {
          inp.value = window.CattleTrackerApi.getBaseUrl() || '';
        }
      }
    }
  }
  if (typeof window.bindAdminSyncServerUrlControls === 'function') window.bindAdminSyncServerUrlControls();
  applyMobileSyncUploadRestrictions();
}

window.initSyncServerBlock = initSyncServerBlock;

if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSyncServerBlock);
  } else {
    initSyncServerBlock();
  }
}

export {};
