import {
  formatApkProgressDetail,
  uint8ToBase64,
  APK_STALL_MS,
  shouldFallbackApkDownload,
  shouldFallbackApkStall
} from '../../utils/apk-progress-text.js';

/** Секция «Установка обновления (APK)» на синхронизации (Android + режим API). */
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

  function compareAppVersions(serverV, localV) {
    if (serverV == null || localV == null) return null;
    var s = String(serverV).trim();
    var l = String(localV).trim();
    if (!s || !l) return null;
    var sa = s.split('.').map(function (x) {
      return parseInt(x, 10) || 0;
    });
    var la = l.split('.').map(function (x) {
      return parseInt(x, 10) || 0;
    });
    var n = Math.max(sa.length, la.length);
    for (var i = 0; i < n; i++) {
      var a = sa[i] || 0;
      var b = la[i] || 0;
      if (a > b) return 1;
      if (a < b) return -1;
    }
    return 0;
  }

  function formatUploadedAt(iso) {
    if (!iso) return '—';
    try {
      var d = new Date(iso);
      if (isNaN(d.getTime())) return '—';
      return d.toLocaleString('ru-RU', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return '—';
    }
  }

  function readEmbeddedDefaultVersion() {
    var versionEl = document.getElementById('app-version');
    if (versionEl) {
      var fromEl = versionEl.getAttribute('data-default-version');
      if (fromEl && String(fromEl).trim()) return String(fromEl).trim();
    }
    var rootEl = document.documentElement;
    if (rootEl) {
      var fromRoot = rootEl.getAttribute('data-default-version');
      if (fromRoot && String(fromRoot).trim()) return String(fromRoot).trim();
    }
    return '';
  }

  function getLocalAppVersionFromCapacitor() {
    var C = global.Capacitor;
    if (C && C.Plugins && C.Plugins.App && typeof C.Plugins.App.getInfo === 'function') {
      return Promise.resolve(C.Plugins.App.getInfo())
        .then(function (info) {
          return info && info.version ? String(info.version).trim() : '';
        })
        .catch(function () {
          return '';
        });
    }
    return import('@capacitor/app')
      .then(function (mod) {
        return mod.App.getInfo();
      })
      .then(function (info) {
        return info && info.version ? String(info.version).trim() : '';
      })
      .catch(function () {
        return '';
      });
  }

  function getLocalAppVersion() {
    return getLocalAppVersionFromCapacitor().then(function (v) {
      if (v) return v;
      var embedded = readEmbeddedDefaultVersion();
      if (embedded) return embedded;
      return fetch('package.json', { cache: 'no-cache' })
        .then(function (r) {
          return r.ok ? r.json() : null;
        })
        .then(function (pkg) {
          return pkg && pkg.version ? String(pkg.version).trim() : '';
        })
        .catch(function () {
          return '';
        });
    });
  }

  function setText(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function setVisible(id, on) {
    var el = document.getElementById(id);
    if (!el) return;
    el.style.display = on ? '' : 'none';
  }

  function setUpdateLine(className, text) {
    var el = document.getElementById('syncMobileApkUpdateLine');
    if (!el) return;
    el.className = 'sync-mobile-apk-update-line ' + (className || '');
    el.textContent = text || '';
    el.style.display = text ? '' : 'none';
  }

  var _mobileUpdateState = {
    hasUpdate: false,
    available: false,
    localVer: '',
    serverVer: ''
  };

  function formatVersionLabel(localVer, hasUpdate) {
    var v = (localVer || '').trim() || '—';
    return 'Версия ' + v + (hasUpdate ? '*' : '');
  }

  function applyVersionUpdateBadge() {
    var text = formatVersionLabel(_mobileUpdateState.localVer, _mobileUpdateState.hasUpdate);
    var versionEl = document.getElementById('app-version');
    var versionHeaderEl = document.getElementById('app-version-header');
    if (versionEl) {
      versionEl.textContent = text;
      if (_mobileUpdateState.localVer) {
        versionEl.setAttribute('data-default-version', _mobileUpdateState.localVer);
      }
      versionEl.classList.toggle('app-version--update', _mobileUpdateState.hasUpdate);
    }
    if (versionHeaderEl) {
      versionHeaderEl.textContent = text;
      versionHeaderEl.classList.toggle('app-version-header--update', _mobileUpdateState.hasUpdate);
      var canOpenActions = isAndroidCapacitor() && !!getApiBase();
      versionHeaderEl.disabled = !canOpenActions;
      versionHeaderEl.title = canOpenActions
        ? 'Нажмите, чтобы открыть список изменений'
        : '';
    }
  }

  function checkMobileApkUpdate(forceRefresh) {
    if (!isAndroidCapacitor() || !getApiBase()) {
      return getLocalAppVersion().then(function (localVer) {
        _mobileUpdateState.localVer = localVer;
        _mobileUpdateState.hasUpdate = false;
        applyVersionUpdateBadge();
        return _mobileUpdateState;
      });
    }
    if (!forceRefresh && _mobileUpdateState.localVer && _mobileUpdateState.serverVer) {
      applyVersionUpdateBadge();
      return Promise.resolve(_mobileUpdateState);
    }
    var infoUrl = getApiBase() + '/api/mobile/info';
    return fetch(infoUrl, { cache: 'no-cache' })
      .then(function (res) {
        return res.json().then(function (data) {
          if (!res.ok) {
            throw new Error((data && (data.error || data.message)) || 'Ошибка ' + res.status);
          }
          return data;
        });
      })
      .then(function (data) {
        return getLocalAppVersion().then(function (localVer) {
          _mobileUpdateState.localVer = localVer;
          _mobileUpdateState.available = !!(data && data.available);
          _mobileUpdateState.serverVer = data && data.version ? String(data.version).trim() : '';
          var cmp = _mobileUpdateState.available
            ? compareAppVersions(_mobileUpdateState.serverVer, localVer)
            : null;
          _mobileUpdateState.hasUpdate = cmp !== null && cmp > 0;
          applyVersionUpdateBadge();
          return _mobileUpdateState;
        });
      })
      .catch(function () {
        return getLocalAppVersion().then(function (localVer) {
          _mobileUpdateState.localVer = localVer;
          _mobileUpdateState.hasUpdate = false;
          applyVersionUpdateBadge();
          return _mobileUpdateState;
        });
      });
  }

  function isAppAdminUser() {
    if (typeof global.getCurrentUser !== 'function') return false;
    var u = global.getCurrentUser();
    if (!u) return false;
    if (typeof global.hasCapability === 'function' && global.hasCapability('adminReleaseControls', u)) {
      return true;
    }
    return String(u.role || '').trim().toLowerCase() === 'admin';
  }

  function isApiLoggedInUser() {
    if (!global.CATTLE_TRACKER_USE_API) return false;
    if (typeof global.getCurrentUser !== 'function') return false;
    return !!global.getCurrentUser();
  }

  function openImprovementForm() {
    var ver = _mobileUpdateState.localVer || '';
    if (typeof global.showImprovementSuggestionModal === 'function') {
      global.showImprovementSuggestionModal(ver);
    }
  }

  function syncHeaderReloadButton() {
    var btn = document.getElementById('app-header-reload-btn');
    if (!btn) return;
    btn.removeAttribute('onclick');
    if (btn.dataset.suggestionBound !== '1') {
      btn.dataset.suggestionBound = '1';
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (isAppAdminUser() || isApiLoggedInUser()) {
          openImprovementForm();
          return;
        }
        if (isAndroidCapacitor()) return;
        if (typeof global.reloadCattleTrackerPage === 'function') {
          global.reloadCattleTrackerPage();
        }
      });
    }
    if (isAppAdminUser() || isApiLoggedInUser()) {
      btn.hidden = false;
      btn.textContent = 'Обновить';
      btn.setAttribute('aria-label', 'Предложения по улучшению');
      btn.title = 'Написать предложение';
      return;
    }
    if (isAndroidCapacitor()) {
      btn.hidden = true;
      return;
    }
    btn.hidden = false;
    btn.textContent = 'Страница';
    btn.setAttribute('aria-label', 'Обновить страницу');
    btn.title = 'Обновить страницу, если поля не нажимаются';
  }

  function handleAppVersionHeaderClick() {
    if (!isAndroidCapacitor() || !getApiBase()) {
      return;
    }
    checkMobileApkUpdate(true).then(function (state) {
      if (typeof global.showAppVersionActionsModal !== 'function') return;
      global.showAppVersionActionsModal(state, {
        canUpdate: true,
        onUpdate: function () {
          if (state.hasUpdate) {
            downloadApkFromServer();
            return;
          }
          if (state.available) {
            if (typeof global.showToast === 'function') {
              global.showToast('У вас установлена актуальная версия', 'info', 4000);
            }
            return;
          }
          if (typeof global.showToast === 'function') {
            global.showToast('На сервере нет файла обновления', 'info', 4000);
          }
        }
      });
    });
  }

  function initAppVersionUpdateUi() {
    var headerBtn = document.getElementById('app-version-header');
    if (headerBtn && headerBtn.dataset.versionBound !== '1') {
      headerBtn.dataset.versionBound = '1';
      headerBtn.addEventListener('click', handleAppVersionHeaderClick);
    }
    syncHeaderReloadButton();
    var embedded = readEmbeddedDefaultVersion();
    if (embedded) {
      _mobileUpdateState.localVer = embedded;
      applyVersionUpdateBadge();
    }
    if (typeof global.electronAPI !== 'undefined' && global.electronAPI.getAppVersion) {
      global.electronAPI.getAppVersion().then(function (v) {
        if (v) {
          _mobileUpdateState.localVer = v;
          applyVersionUpdateBadge();
        }
      });
      return;
    }
    checkMobileApkUpdate(true);
  }

  function refreshMobileApkServerUi() {
    var base = getApiBase();
    var metaBlock = document.getElementById('syncMobileApkMetaBlock');
    var noFile = document.getElementById('syncMobileApkNoFileHint');
    if (!base) return;
    setText('syncMobileApkMetaVersion', '…');
    setText('syncMobileApkMetaName', '…');
    setText('syncMobileApkMetaDate', '…');
    setUpdateLine('sync-mobile-apk-update-line--loading', 'Проверка сервера…');
    if (metaBlock) metaBlock.style.display = '';
    if (noFile) noFile.style.display = 'none';

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
        return getLocalAppVersion().then(function (localVer) {
          return { data: data, localVer: localVer };
        });
      })
      .then(function (_ref) {
        var data = _ref.data;
        var localVer = _ref.localVer;
        if (!data || !data.available) {
          setVisible('syncMobileApkMetaBlock', false);
          if (noFile) {
            noFile.style.display = '';
            noFile.textContent =
              'На сервере пока нет файла обновления. Администратор может загрузить APK в разделе синхронизации на ПК.';
          }
          setUpdateLine('', '');
          return;
        }
        setVisible('syncMobileApkMetaBlock', true);
        if (noFile) noFile.style.display = 'none';
        setText('syncMobileApkMetaVersion', data.version || 'не указана');
        setText('syncMobileApkMetaName', data.originalName || '—');
        setText('syncMobileApkMetaDate', formatUploadedAt(data.uploadedAt));

        var cmp = compareAppVersions(data.version, localVer);
        if (cmp === null) {
          setUpdateLine(
            'sync-mobile-apk-update-line--neutral',
            localVer
              ? 'Версию на сервере нельзя сравнить с установленной (на сервере не указана версия). Установлено: ' +
                  localVer +
                  '.'
              : 'Укажите версию при загрузке APK на сервер, чтобы сравнивать с установленной.'
          );
        } else if (cmp > 0) {
          setUpdateLine(
            'sync-mobile-apk-update-line--new',
            'Доступна новая версия на сервере (у вас ' + localVer + ', на сервере ' + data.version + ').'
          );
          _mobileUpdateState.hasUpdate = true;
          _mobileUpdateState.localVer = localVer;
          _mobileUpdateState.serverVer = data.version || '';
          _mobileUpdateState.available = true;
          applyVersionUpdateBadge();
        } else if (cmp < 0) {
          setUpdateLine(
            'sync-mobile-apk-update-line--ahead',
            'Установленная версия новее, чем файл на сервере (' + localVer + ').'
          );
        } else {
          setUpdateLine(
            'sync-mobile-apk-update-line--ok',
            'У вас установлена актуальная версия (' + localVer + ').'
          );
          _mobileUpdateState.hasUpdate = false;
          _mobileUpdateState.localVer = localVer;
          _mobileUpdateState.serverVer = data.version || '';
          _mobileUpdateState.available = true;
          applyVersionUpdateBadge();
        }
      })
      .catch(function (err) {
        var msg = err && err.message ? err.message : 'Не удалось получить данные';
        if (msg.indexOf('Failed to fetch') !== -1) {
          msg = 'Сервер недоступен';
        }
        setVisible('syncMobileApkMetaBlock', false);
        if (noFile) {
          noFile.style.display = '';
          noFile.textContent = msg;
        }
        setUpdateLine('sync-mobile-apk-update-line--error', msg);
      });
  }

  function bindDownloadButton() {
    var btn = document.getElementById('syncDownloadApkBtn');
    if (btn && btn.dataset.apkBound !== '1') {
      btn.dataset.apkBound = '1';
      btn.addEventListener('click', function () {
        if (typeof global.downloadApkFromServer === 'function') global.downloadApkFromServer();
      });
    }
    var onlyBtn = document.getElementById('syncDownloadApkOnlyBtn');
    if (onlyBtn && onlyBtn.dataset.apkBound !== '1') {
      onlyBtn.dataset.apkBound = '1';
      onlyBtn.addEventListener('click', function () {
        if (typeof global.downloadApkFileOnly === 'function') global.downloadApkFileOnly();
      });
    }
  }

  function bindDetailsToggle(section) {
    if (!section || section.dataset.apkToggleBound === '1') return;
    section.dataset.apkToggleBound = '1';
    section.addEventListener('toggle', function () {
      if (section.open) refreshMobileApkServerUi();
    });
  }

  function initSyncMobileApkSection() {
    var section = document.getElementById('sync-mobile-apk-section');
    if (!section) return;
    bindDownloadButton();
    bindDetailsToggle(section);
    var show = isAndroidCapacitor() && !!getApiBase();
    section.style.display = show ? '' : 'none';
    if (show) {
      refreshMobileApkServerUi();
    }
  }

  /**
   * Fallback: открыть URL во внешнем браузере (старые сборки без ApkUpdatePlugin).
   */
  function openApkDownloadUrl(apkUrl) {
    var C = global.Capacitor;
    var isAndroidNative =
      C &&
      typeof C.isNativePlatform === 'function' &&
      C.isNativePlatform() &&
      typeof C.getPlatform === 'function' &&
      C.getPlatform() === 'android';
    if (isAndroidNative) {
      return import('@capacitor/core')
        .then(function (core) {
          var OpenExternalUrl = core.registerPlugin('OpenExternalUrl', {
            web: {
              openUrl: function () {
                return Promise.resolve();
              }
            }
          });
          return OpenExternalUrl.openUrl({ url: apkUrl });
        })
        .catch(function () {
          return import('@capacitor/browser').then(function (mod) {
            return mod.Browser.open({ url: apkUrl });
          });
        })
        .catch(function () {
          global.open(apkUrl, '_blank', 'noopener,noreferrer');
        });
    }
    return import('@capacitor/browser')
      .then(function (mod) {
        return mod.Browser.open({ url: apkUrl });
      })
      .catch(function () {
        global.open(apkUrl, '_blank', 'noopener,noreferrer');
      });
  }

  /** Меньше 256 КБ: крупные base64 через Capacitor bridge на Android часто подвисают. */
  var APK_CHUNK_BYTES = 64 * 1024;
  var apkUpdatePlugin = null;
  var apkUpdatePluginPromise = null;

  function getApkUpdatePlugin() {
    if (apkUpdatePlugin) return Promise.resolve(apkUpdatePlugin);
    if (apkUpdatePluginPromise) return apkUpdatePluginPromise;
    apkUpdatePluginPromise = import('@capacitor/core')
      .then(function (core) {
        apkUpdatePlugin = core.registerPlugin('ApkUpdate', {
          web: {
            downloadApk: function () {
              return Promise.reject(new Error('web'));
            },
            startApkFile: function () {
              return Promise.reject(new Error('web'));
            },
            appendApkChunk: function () {
              return Promise.reject(new Error('web'));
            },
            finishApkFile: function () {
              return Promise.reject(new Error('web'));
            },
            installDownloadedApk: function () {
              return Promise.reject(new Error('web'));
            },
            cancelDownload: function () {
              return Promise.resolve();
            }
          }
        });
        return apkUpdatePlugin;
      })
      .catch(function () {
        apkUpdatePluginPromise = null;
        return null;
      });
    return apkUpdatePluginPromise;
  }

  if (typeof global.Capacitor !== 'undefined') {
    getApkUpdatePlugin();
  }

  function throwIfCanceled(userCanceled) {
    if (userCanceled) {
      var err = new Error('CANCELED');
      err.message = 'CANCELED';
      throw err;
    }
  }

  /**
   * XHR с onprogress надёжнее fetch+stream в Android WebView:
   * байты сразу идут в UI, abort реально останавливает запрос.
   */
  function downloadApkBytesViaXhr(apkUrl, expectedSize, onProgress, abortCtrl) {
    return new Promise(function (resolve, reject) {
      var xhr = new XMLHttpRequest();
      var settled = false;
      function finish(fn, arg) {
        if (settled) return;
        settled = true;
        try {
          if (abortCtrl && abortCtrl.signal) {
            abortCtrl.signal.removeEventListener('abort', onAbort);
          }
        } catch (eRm) {}
        fn(arg);
      }
      function onAbort() {
        try {
          xhr.abort();
        } catch (eAb) {}
        var err = new Error('CANCELED');
        err.name = 'AbortError';
        finish(reject, err);
      }
      xhr.open('GET', apkUrl, true);
      xhr.responseType = 'arraybuffer';
      xhr.setRequestHeader('Cache-Control', 'no-store');
      xhr.onprogress = function (ev) {
        var loaded = Number(ev.loaded) || 0;
        var total =
          ev.lengthComputable && ev.total
            ? Number(ev.total)
            : Number(expectedSize) || 0;
        if (typeof onProgress === 'function') onProgress(loaded, total);
      };
      xhr.onload = function () {
        if (xhr.status < 200 || xhr.status >= 300) {
          finish(reject, new Error('Сервер вернул код ' + xhr.status));
          return;
        }
        var buf = xhr.response;
        if (!buf) {
          finish(reject, new Error('Пустой ответ сервера'));
          return;
        }
        var u8 = new Uint8Array(buf);
        if (typeof onProgress === 'function') {
          onProgress(u8.length, Number(expectedSize) || u8.length);
        }
        finish(resolve, u8);
      };
      xhr.onerror = function () {
        finish(reject, new Error('Сеть недоступна'));
      };
      xhr.onabort = function () {
        var err = new Error('CANCELED');
        err.name = 'AbortError';
        finish(reject, err);
      };
      if (abortCtrl && abortCtrl.signal) {
        if (abortCtrl.signal.aborted) {
          onAbort();
          return;
        }
        abortCtrl.signal.addEventListener('abort', onAbort);
      }
      xhr.send();
    });
  }

  function writeApkBytesToPlugin(plugin, u8, progress, userCanceledRef, onBytes) {
    var total = u8.length;
    var offset = 0;
    function report(loaded) {
      if (typeof onBytes === 'function') onBytes(loaded, total);
      if (progress) progress.update(loaded, total, formatApkProgressDetail(loaded, total));
    }
    function next() {
      throwIfCanceled(userCanceledRef.canceled);
      if (offset >= u8.length) return Promise.resolve();
      var end = Math.min(offset + APK_CHUNK_BYTES, u8.length);
      var piece = u8.subarray(offset, end);
      offset = end;
      report(offset);
      return plugin.appendApkChunk({ data: uint8ToBase64(piece) }).then(next);
    }
    report(0);
    return next();
  }

  function downloadApkViaNative(apkUrl, expectedSize) {
    var C = global.Capacitor;
    var isAndroidNative =
      C &&
      typeof C.isNativePlatform === 'function' &&
      C.isNativePlatform() &&
      typeof C.getPlatform === 'function' &&
      C.getPlatform() === 'android';
    if (!isAndroidNative) {
      return openApkDownloadUrl(apkUrl);
    }
    var userCanceledRef = { canceled: false };
    var stallRef = { stalled: false };
    var bytesSeen = { n: 0 };
    var lastProgressAt = { t: Date.now() };
    var pluginRef = apkUpdatePlugin;
    var abortCtrl =
      typeof AbortController === 'function'
        ? new AbortController()
        : { abort: function () {}, signal: undefined };
    var progress =
      typeof global.showProgressOverlay === 'function'
        ? global.showProgressOverlay({
            title: 'Загрузка обновления',
            detail: 'Загрузка…',
            cancelText: 'Отмена',
            blocking: true,
            onCancel: function () {
              userCanceledRef.canceled = true;
              try {
                abortCtrl.abort();
              } catch (eAbort) {}
              if (pluginRef && typeof pluginRef.cancelDownload === 'function') {
                try {
                  pluginRef.cancelDownload();
                } catch (eCancel) {}
              } else {
                getApkUpdatePlugin()
                  .then(function (plugin) {
                    if (plugin && plugin.cancelDownload) return plugin.cancelDownload();
                  })
                  .catch(function () {});
              }
              if (progress) {
                progress.close();
                progress = null;
              }
              if (typeof global.showToast === 'function') {
                global.showToast('Загрузка отменена', 'info', 3000);
              }
            }
          })
        : null;

    function noteProgress(loaded, total) {
      var n = Number(loaded) || 0;
      if (n > bytesSeen.n) {
        bytesSeen.n = n;
        lastProgressAt.t = Date.now();
      }
      if (progress) {
        progress.update(n, Number(total) || 0, formatApkProgressDetail(n, total));
      }
    }

    function triggerStallFallback() {
      if (userCanceledRef.canceled || stallRef.stalled) return;
      stallRef.stalled = true;
      userCanceledRef.canceled = true;
      try {
        abortCtrl.abort();
      } catch (eStall) {}
      if (pluginRef && typeof pluginRef.cancelDownload === 'function') {
        try {
          pluginRef.cancelDownload();
        } catch (eCancel) {}
      }
      if (progress) {
        progress.close();
        progress = null;
      }
      if (typeof global.showToast === 'function') {
        global.showToast('Скачивание в приложении зависло. Открываем файл в браузере…', 'info', 5000);
      }
      openApkDownloadUrl(apkUrl);
    }

    var stallWatch = setInterval(function () {
      if (userCanceledRef.canceled || stallRef.stalled) return;
      var now = Date.now();
      if (shouldFallbackApkDownload(bytesSeen.n, now - lastProgressAt.t, APK_STALL_MS)) {
        triggerStallFallback();
        return;
      }
      if (shouldFallbackApkStall(bytesSeen.n, lastProgressAt.t, now, APK_STALL_MS * 2)) {
        triggerStallFallback();
      }
    }, 1000);

    function startDownload(plugin) {
      if (!plugin || typeof plugin.startApkFile !== 'function') {
        return Promise.reject(new Error('web'));
      }
      pluginRef = plugin;
      throwIfCanceled(userCanceledRef.canceled);
      noteProgress(0, Number(expectedSize) || 0);
      return plugin
        .startApkFile()
        .then(function () {
          throwIfCanceled(userCanceledRef.canceled || stallRef.stalled);
          return downloadApkBytesViaXhr(apkUrl, expectedSize, noteProgress, abortCtrl);
        })
        .then(function (u8) {
          throwIfCanceled(userCanceledRef.canceled || stallRef.stalled);
          return writeApkBytesToPlugin(plugin, u8, progress, userCanceledRef, noteProgress);
        })
        .then(function () {
          throwIfCanceled(userCanceledRef.canceled || stallRef.stalled);
          return plugin.finishApkFile();
        })
        .then(function () {
          if (progress) {
            progress.close();
            progress = null;
          }
          throwIfCanceled(userCanceledRef.canceled || stallRef.stalled);
          return plugin.installDownloadedApk();
        });
    }

    return (pluginRef ? Promise.resolve(pluginRef) : getApkUpdatePlugin())
      .then(startDownload)
      .then(function () {
        if (userCanceledRef.canceled || stallRef.stalled) return;
        if (progress) progress.close();
        if (typeof global.showToast === 'function') {
          global.showToast('Откройте установщик на экране', 'success', 4000);
        }
      })
      .catch(function (err) {
        if (stallRef.stalled) return;
        if (progress) {
          progress.close();
          progress = null;
        }
        if (userCanceledRef.canceled) return;
        var msg = err && err.message ? String(err.message) : '';
        if (err && err.name === 'AbortError') msg = 'CANCELED';
        if (msg === 'CANCELED' || /отмен/i.test(msg)) {
          if (typeof global.showToast === 'function') global.showToast('Загрузка отменена', 'info', 3000);
          return;
        }
        if (
          msg !== 'NEED_INSTALL_PERMISSION' &&
          pluginRef &&
          typeof pluginRef.cancelDownload === 'function'
        ) {
          try {
            pluginRef.cancelDownload();
          } catch (eCancel) {}
        }
        if (
          msg === 'NEED_INSTALL_PERMISSION' ||
          msg.indexOf('Разрешите установку') !== -1 ||
          msg.indexOf('NEED_INSTALL') !== -1
        ) {
          if (typeof global.showToast === 'function') {
            global.showToast(
              'Установка из приложения недоступна. Открываем загрузку в браузере…',
              'info',
              6000
            );
          }
          return openApkDownloadUrl(apkUrl);
        }
        if (msg && msg !== 'web') {
          if (typeof global.showToast === 'function') global.showToast(msg, 'error', 6000);
          return openApkDownloadUrl(apkUrl);
        }
        return openApkDownloadUrl(apkUrl);
      })
      .finally(function () {
        clearInterval(stallWatch);
      });
  }

  function resolveApkDownloadUrl() {
    var base = getApiBase();
    if (!base) {
      return Promise.reject(new Error('Нет адреса сервера'));
    }
    var infoUrl = base + '/api/mobile/info';
    return fetch(infoUrl, { cache: 'no-cache' }).then(function (res) {
      return res.json().then(function (data) {
        if (!res.ok) {
          var err = (data && (data.error || data.message)) || 'Ошибка ' + res.status;
          throw new Error(err);
        }
        if (!data || !data.available) {
          throw new Error('На сервере нет файла обновления');
        }
        return {
          url: base + (data.downloadPath || '/api/mobile/app.apk'),
          size: Number(data.size) || 0
        };
      });
    });
  }

  function downloadApkFromServer() {
    resolveApkDownloadUrl()
      .then(function (info) {
        return downloadApkViaNative(info.url, info.size);
      })
      .catch(function (err) {
        var msg = err && err.message ? err.message : 'Не удалось проверить обновление';
        if (msg.indexOf('Failed to fetch') !== -1) {
          msg = 'Сервер недоступен';
        }
        if (typeof global.showToast === 'function') global.showToast(msg, 'error', 5000);
      });
  }

  /** Только скачать APK во внешний браузер / Downloads — без автоустановки. */
  function downloadApkFileOnly() {
    if (typeof global.showToast === 'function') {
      global.showToast('Открываем загрузку APK…', 'info', 3000);
    }
    resolveApkDownloadUrl()
      .then(function (info) {
        return openApkDownloadUrl(info.url);
      })
      .catch(function (err) {
        var msg = err && err.message ? err.message : 'Не удалось скачать APK';
        if (msg.indexOf('Failed to fetch') !== -1) {
          msg = 'Сервер недоступен';
        }
        if (typeof global.showToast === 'function') global.showToast(msg, 'error', 5000);
      });
  }

  global.initSyncMobileApkSection = initSyncMobileApkSection;
  global.downloadApkFromServer = downloadApkFromServer;
  global.downloadApkFileOnly = downloadApkFileOnly;
  global.refreshMobileApkServerUi = refreshMobileApkServerUi;
  global.checkMobileApkUpdate = checkMobileApkUpdate;
  global.initAppVersionUpdateUi = initAppVersionUpdateUi;
  global.syncHeaderReloadButton = syncHeaderReloadButton;
  global.handleAppVersionHeaderClick = handleAppVersionHeaderClick;
})(typeof window !== 'undefined' ? window : this);

export {};
