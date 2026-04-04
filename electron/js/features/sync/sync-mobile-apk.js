/** Секция «Скачать APK» на экране синхронизации (только Android + режим API). */
(function (global) {
  'use strict';

  function getApiBase() {
    var api = global.CattleTrackerApi;
    if (api && typeof api.getBaseUrl === 'function') {
      return (api.getBaseUrl() || '').trim();
    }
    return '';
  }

  function isAndroidCapacitor() {
    try {
      var C = global.Capacitor;
      return C && typeof C.getPlatform === 'function' && C.getPlatform() === 'android';
    } catch (e) {
      return false;
    }
  }

  function bindDownloadButton() {
    var btn = document.getElementById('syncDownloadApkBtn');
    if (!btn || btn.dataset.apkBound === '1') return;
    btn.dataset.apkBound = '1';
    btn.addEventListener('click', function () {
      if (typeof global.downloadApkFromServer === 'function') global.downloadApkFromServer();
    });
  }

  function initSyncMobileApkSection() {
    var section = document.getElementById('sync-mobile-apk-section');
    if (!section) return;
    bindDownloadButton();
    var show = isAndroidCapacitor() && !!getApiBase();
    section.style.display = show ? '' : 'none';
  }

  function downloadApkFromServer() {
    var base = getApiBase();
    if (!base) {
      if (typeof global.showToast === 'function') global.showToast('Нет адреса сервера', 'error');
      return;
    }
    var infoUrl = base + '/api/mobile/info';
    fetch(infoUrl, { cache: 'no-cache' })
      .then(function (res) {
        return res.json().then(function (data) {
          if (!res.ok) {
            var err = (data && (data.error || data.message)) || 'Ошибка ' + res.status;
            throw new Error(err);
          }
          return data;
        });
      })
      .then(function (data) {
        if (!data || !data.available) {
          if (typeof global.showToast === 'function') {
            global.showToast('На сервере нет файла обновления', 'error');
          }
          return;
        }
        var apkUrl = base + (data.downloadPath || '/api/mobile/app.apk');
        return import('@capacitor/browser')
          .then(function (mod) {
            return mod.Browser.open({ url: apkUrl });
          })
          .catch(function () {
            global.open(apkUrl, '_blank', 'noopener,noreferrer');
          });
      })
      .catch(function (err) {
        var msg = err && err.message ? err.message : 'Не удалось проверить обновление';
        if (msg.indexOf('Failed to fetch') !== -1) {
          msg = 'Сервер недоступен';
        }
        if (typeof global.showToast === 'function') global.showToast(msg, 'error', 5000);
      });
  }

  global.initSyncMobileApkSection = initSyncMobileApkSection;
  global.downloadApkFromServer = downloadApkFromServer;
})(typeof window !== 'undefined' ? window : this);

export {};
