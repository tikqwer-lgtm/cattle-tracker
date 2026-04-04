/** Фрагмент модуля синхронизации; фасад: ../sync.js */
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
      if (localStorage.getItem('cattleTracker_uploadAfterConnect') === '1') {
        localStorage.removeItem('cattleTracker_uploadAfterConnect');
        setTimeout(function () {
          if (typeof window.uploadCurrentBaseToServer === 'function') window.uploadCurrentBaseToServer();
        }, 1500);
      } else if (localStorage.getItem('cattleTracker_syncAfterConnect') === '1') {
        localStorage.removeItem('cattleTracker_syncAfterConnect');
        setTimeout(function () {
          if (typeof window.syncCurrentBaseToServer === 'function') window.syncCurrentBaseToServer();
        }, 1500);
      }
    } catch (e) {}
  } else {
    if (typeof window.updateConnectionIndicator === 'function') window.updateConnectionIndicator(false);
  }
  if (typeof window.initSyncMobileApkSection === 'function') window.initSyncMobileApkSection();
  if (typeof window.initSyncDesktopApkAdmin === 'function') window.initSyncDesktopApkAdmin();
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
