/** __app part 2 */
(function () {
  'use strict';
  var root = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this);
  var NS = root['__app'] = root['__app'] || {};
  var global = typeof window !== 'undefined' ? window : this;

function initOfflineIndicator() {
  var el = document.getElementById('offline-indicator');
  if (!el) return;
  var defaultOfflineText = el.textContent || 'Офлайн';
  function setOffline() {
    el.textContent = defaultOfflineText;
    el.hidden = false;
    el.setAttribute('aria-hidden', 'false');
  }
  function setOnline() {
    el.hidden = true;
    el.setAttribute('aria-hidden', 'true');
  }
  function update() {
    var online = typeof navigator !== 'undefined' && navigator.onLine;
    if (online) {
      if (window.CATTLE_TRACKER_USE_API && typeof window.refreshFromServer === 'function') {
        el.textContent = 'Обновление…';
        el.hidden = false;
        el.setAttribute('aria-hidden', 'false');
        window.refreshFromServer().then(function () {
          setOnline();
        }).catch(function () {
          setOnline();
        });
      } else {
        setOnline();
      }
    } else {
      setOffline();
    }
  }
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    setOffline();
  } else {
    setOnline();
  }
  window.addEventListener('online', update);
  window.addEventListener('offline', function () { setOffline(); });
}

// Запуск приложения при загрузке
function bootApp() {
  globalThis['__app'].initApp();
  initOfflineIndicator();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootApp);
} else {
  bootApp();
}

// PWA: регистрация Service Worker (только для http/https; в Electron file:// не регистрируем)
if (typeof navigator !== 'undefined' && navigator.serviceWorker) {
  if (location.protocol === 'file:') {
    navigator.serviceWorker.getRegistrations().then(function (regs) {
      regs.forEach(function (r) { r.unregister(); });
    });
  } else {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('./sw.js').catch(function () {});
    });
  }
}

function handleCheckForUpdates() {
  if (typeof window.electronAPI !== 'undefined' && window.electronAPI.checkForUpdates) {
    window.electronAPI.checkForUpdates().then(function (r) {
      if (r.dev) {
        if (typeof showToast === 'function') showToast('Проверка обновлений работает только в установленной версии приложения', 'info');
        else alert('Проверка обновлений работает только в установленной версии приложения.');
        return;
      }
      if (!r.ok) {
        var msg = r.error ? ('Не удалось проверить обновления: ' + r.error) : 'Не удалось проверить обновления';
        if (typeof showToast === 'function') showToast(msg, 'error');
        else alert(msg);
        return;
      }
      if (r.version) {
        if (typeof showToast === 'function') showToast('Доступна версия ' + r.version + '. Скачивание…', 'info', 5000);
        else alert('Доступна версия ' + r.version + '. Скачивание…');
        return;
      }
      if (typeof showToast === 'function') showToast('Установлена последняя версия', 'success');
      else alert('Установлена последняя версия.');
    });
  } else {
    if (typeof showToast === 'function') showToast('Проверка обновлений доступна в десктопной версии', 'info');
    else alert('Проверка обновлений доступна в десктопной версии приложения.');
  }
}

// Подписка на прогресс и путь загрузки обновления (Electron)
if (typeof window.electronAPI !== 'undefined') {
  if (window.electronAPI.onUpdateDownloadPath && typeof showUpdateProgress === 'function') {
    window.electronAPI.onUpdateDownloadPath(function (downloadPath) {
      showUpdateProgress(0, downloadPath, 0);
    });
  }
  if (window.electronAPI.onUpdateDownloadProgress && typeof showUpdateProgress === 'function') {
    window.electronAPI.onUpdateDownloadProgress(function (data) {
      showUpdateProgress(data.percent, null, data.bytesPerSecond);
    });
  }
}

// Экспорт для других модулей
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    entries: window.entries,
    nowFormatted: window.nowFormatted,
    addEntry,
    saveCurrentEntry
  };
}

  // register functions
  NS.initOfflineIndicator = initOfflineIndicator;
  NS.handleCheckForUpdates = handleCheckForUpdates;
})();
export {};
