/** ПК (Electron): загрузка APK на сервер и список для администратора. */
(function (global) {
  'use strict';

  function isElectron() {
    return !!(global.electronAPI && typeof global.electronAPI.selectApkFile === 'function');
  }

  function isAdmin() {
    if (typeof global.getCurrentUser !== 'function') return false;
    var u = global.getCurrentUser();
    return u && u.role === 'admin';
  }

  /** Версия десктопной сборки (как в корневом package.json → data-default-version в index.html). */
  function getBundledAppVersion() {
    try {
      return (document.documentElement.getAttribute('data-default-version') || '').trim();
    } catch (e) {
      return '';
    }
  }

  function refreshSyncDesktopApkList() {
    var container = document.getElementById('syncApkServerList');
    if (!container || !global.CattleTrackerApi || typeof global.CattleTrackerApi.listMobileApkFiles !== 'function') {
      return;
    }
    container.innerHTML = '<p class="sync-section-hint">Загрузка списка…</p>';
    global.CattleTrackerApi.listMobileApkFiles()
      .then(function (data) {
        var items = (data && data.items) ? data.items : [];
        if (!items.length) {
          container.innerHTML = '<p class="sync-section-hint">На сервере пока нет сохранённых APK.</p>';
          return;
        }
        var html = '';
        for (var i = 0; i < items.length; i++) {
          var it = items[i];
          if (!it || !it.filename) continue;
          var label = (it.originalName || it.filename) + '';
          var meta = '';
          if (it.uploadedAt) {
            try {
              meta = new Date(it.uploadedAt).toLocaleString('ru-RU');
            } catch (e) {
              meta = it.uploadedAt;
            }
          }
          if (it.size != null) meta = (meta ? meta + ' · ' : '') + formatSize(it.size);
          if (it.version) meta = (meta ? meta + ' · ' : '') + 'v' + it.version;
          html += '<div class="sync-apk-row" data-filename="' + escapeAttr(it.filename) + '">' +
            '<span class="sync-apk-row-name" title="' + escapeAttr(it.filename) + '">' + escapeHtml(label) + '</span>' +
            '<span class="sync-apk-row-meta">' + escapeHtml(meta) + '</span>' +
            '<button type="button" class="small-btn sync-apk-delete-btn" data-filename="' + escapeAttr(it.filename) + '">Удалить</button>' +
            '</div>';
        }
        container.innerHTML = html || '<p class="sync-section-hint">Список пуст.</p>';
      })
      .catch(function (err) {
        var msg = err && err.message ? err.message : 'Ошибка загрузки списка';
        container.innerHTML = '<p class="sync-connect-status--error">' + escapeHtml(msg) + '</p>';
      });
  }

  function formatSize(n) {
    if (n == null || isNaN(n)) return '';
    if (n < 1024) return n + ' Б';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' КБ';
    return (n / (1024 * 1024)).toFixed(1) + ' МБ';
  }

  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function escapeAttr(s) {
    return escapeHtml(s).replace(/'/g, '&#39;');
  }

  function bindListClicksOnce() {
    var container = document.getElementById('syncApkServerList');
    if (!container || container.dataset.deleteBound === '1') return;
    container.dataset.deleteBound = '1';
    container.addEventListener('click', function (e) {
      var btn = e.target && e.target.closest && e.target.closest('.sync-apk-delete-btn');
      if (!btn) return;
      var fn = btn.getAttribute('data-filename');
      if (!fn || !global.CattleTrackerApi || typeof global.CattleTrackerApi.deleteMobileApkFile !== 'function') return;
      var okFn = typeof global.showConfirmModal === 'function'
        ? global.showConfirmModal('Удалить выбранный APK с сервера?')
        : Promise.resolve(global.confirm('Удалить файл с сервера?'));
      Promise.resolve(okFn).then(function (ok) {
        if (!ok) return;
        return global.CattleTrackerApi.deleteMobileApkFile(fn).then(function () {
          if (typeof global.showToast === 'function') global.showToast('Файл удалён', 'success');
          refreshSyncDesktopApkList();
        });
      }).catch(function (err) {
        var msg = err && err.message ? err.message : 'Ошибка удаления';
        if (typeof global.showToast === 'function') global.showToast(msg, 'error', 5000);
      });
    });
  }

  function setApkUploadStatusLine(data) {
    var el = document.getElementById('syncApkUploadStatus');
    if (!el) return;
    el.classList.remove('sync-apk-upload-status--error');
    if (!data || !data.message) {
      el.textContent = '';
      return;
    }
    if (data.phase === 'error') {
      el.classList.add('sync-apk-upload-status--error');
    }
    el.textContent = data.message;
  }

  function bindApkUploadProgressOnce() {
    if (!isElectron() || !global.electronAPI || typeof global.electronAPI.onApkUploadProgress !== 'function') return;
    if (global._cattleApkUploadProgressBound) return;
    global._cattleApkUploadProgressBound = true;
    global.electronAPI.onApkUploadProgress(function (data) {
      setApkUploadStatusLine(data);
    });
  }

  function bindUploadButtonOnce() {
    var btn = document.getElementById('syncUploadApkBtn');
    if (!btn || btn.dataset.bound === '1') return;
    btn.dataset.bound = '1';
    bindApkUploadProgressOnce();
    btn.addEventListener('click', function () {
      if (!isElectron() || !global.CattleTrackerApi || typeof global.electronAPI.selectApkFile !== 'function') return;
      if (typeof global.electronAPI.uploadApkToServer !== 'function') {
        if (typeof global.showToast === 'function') {
          global.showToast('Обновите приложение (нет модуля загрузки APK)', 'error');
        }
        return;
      }
      var api = global.CattleTrackerApi;
      var base = typeof api.getBaseUrl === 'function' ? (api.getBaseUrl() || '').trim() : '';
      var token = typeof api.getToken === 'function' ? (api.getToken() || '').trim() : '';
      if (!base || !token) {
        if (typeof global.showToast === 'function') {
          global.showToast('Нет адреса сервера или сессии. Войдите как администратор.', 'error', 6000);
        }
        return;
      }
      setApkUploadStatusLine({ message: 'Выберите файл APK…' });
      global.electronAPI
        .selectApkFile()
        .then(function (r) {
          if (!r) {
            setApkUploadStatusLine(null);
            return null;
          }
          if (r.error) {
            if (typeof global.showToast === 'function') global.showToast(r.error, 'error', 6000);
            setApkUploadStatusLine({ phase: 'error', message: r.error });
            return null;
          }
          if (!r.path) {
            var m = 'Не удалось получить путь к файлу';
            if (typeof global.showToast === 'function') global.showToast(m, 'error');
            setApkUploadStatusLine({ phase: 'error', message: m });
            return null;
          }
          btn.disabled = true;
          return global.electronAPI.uploadApkToServer({
            filePath: r.path,
            baseUrl: base,
            token: token,
            version: getBundledAppVersion()
          });
        })
        .then(function (res) {
          if (res == null) return;
          if (!res.ok) {
            var errMsg = (res && res.error) ? res.error : 'Ошибка загрузки';
            if (typeof global.showToast === 'function') global.showToast(errMsg, 'error', 8000);
            setApkUploadStatusLine({ phase: 'error', message: errMsg });
            return;
          }
          if (typeof global.showToast === 'function') global.showToast('APK загружен на сервер', 'success');
          refreshSyncDesktopApkList();
          setTimeout(function () {
            setApkUploadStatusLine(null);
          }, 5000);
        })
        .catch(function (err) {
          var msg = err && err.message ? err.message : 'Ошибка: не удалось открыть диалог или связаться с процессом приложения';
          if (typeof global.showToast === 'function') global.showToast(msg, 'error', 8000);
          setApkUploadStatusLine({ phase: 'error', message: msg });
        })
        .finally(function () {
          btn.disabled = false;
        });
    });
  }

  function initSyncDesktopApkAdmin() {
    var section = document.getElementById('sync-desktop-apk-admin-section');
    if (!section) return;
    bindApkUploadProgressOnce();
    bindUploadButtonOnce();
    bindListClicksOnce();
    var show =
      isElectron() &&
      global.CATTLE_TRACKER_USE_API &&
      global.CattleTrackerApi &&
      isAdmin();
    section.style.display = show ? '' : 'none';
    if (show) refreshSyncDesktopApkList();
  }

  global.initSyncDesktopApkAdmin = initSyncDesktopApkAdmin;
  global.refreshSyncDesktopApkList = refreshSyncDesktopApkList;
})(typeof window !== 'undefined' ? window : this);

export {};
