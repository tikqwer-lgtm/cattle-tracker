const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getOsUsername: () => ipcRenderer.invoke('get-os-username'),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  onUpdateDownloadProgress: (cb) => {
    ipcRenderer.on('update-download-progress', (_e, data) => cb(data));
  },
  onUpdateDownloadPath: (cb) => {
    ipcRenderer.on('update-download-path', (_e, path) => cb(path));
  },
  setWindowMode: (mode) => ipcRenderer.send('set-window-mode', mode),
  /** Синхронизация с главным меню: показывать «Консоль разработчика» только после входа. */
  setAuthenticatedForMenu: (authenticated) => ipcRenderer.send('cattle-tracker-auth-menu', !!authenticated),
  /** После авторизации: автоматически открыть и закрыть консоль (обход ввода в Electron). */
  runPostAuthDevtoolsFlash: () => ipcRenderer.send('cattle-tracker-post-auth-flash'),
  getDevtoolsDiagnosticsHistory: () => ipcRenderer.invoke('devtools-diagnostics-get-history'),
  clearDevtoolsDiagnosticsLog: () => ipcRenderer.send('devtools-diagnostics-clear'),
  onDevtoolsDiagnosticsEntry: (cb) => {
    ipcRenderer.on('devtools-diagnostics-entry', (_e, entry) => cb(entry));
  },
  sendDevtoolsDiagnosticsSnapshot: (label, payload) => {
    ipcRenderer.send('devtools-diagnostics-renderer-snapshot', { label: String(label || ''), payload: payload || null });
  },
  /** Лёгкий фокус окна (main process), без DevTools. */
  requestWebContentsFocus: () => ipcRenderer.send('cattle-tracker-webcontents-focus'),
  /** Кнопка «Восстановить ввод» в шапке: обход «мёртвого ввода» (кратко открыть/закрыть DevTools в упакованной сборке). */
  requestHitTestWorkaround: () => ipcRenderer.send('cattle-tracker-hit-test-workaround')
});

/**
 * Обработчики ПКМ должны выполняться в основном мире страницы (как обычный скрипт приложения).
 * Слушатели из изолированного контекста preload часто не дают стабильного фокуса ввода в Electron
 * (симптом «помогает только открытие DevTools»), хотя курсор в поле меняется.
 * Левый и правый клик: принудительный focus + softRepaint (как обход «мёртвых» полей после модалок).
 */
(function installRightClickEditableFocusInMainWorld() {
  function injectMainWorldListeners() {
    var runInPage = function () {
      function editableFromEvent(e) {
        var path = typeof e.composedPath === 'function' ? e.composedPath() : [];
        for (var i = 0; i < path.length; i++) {
          var el = path[i];
          if (!el || el.nodeType !== 1) continue;
          var tag = el.tagName;
          if (tag === 'TEXTAREA' || tag === 'SELECT') return el;
          if (tag === 'INPUT') {
            var type = (el.getAttribute('type') || 'text').toLowerCase();
            if (type === 'hidden' || type === 'button' || type === 'submit' || type === 'reset' || type === 'checkbox' || type === 'radio') continue;
            return el;
          }
          if (el.isContentEditable) return el;
        }
        return null;
      }

      function focusEditableFromEvent(e) {
        var el = editableFromEvent(e);
        if (!el) return;
        function apply() {
          try {
            el.focus({ preventScroll: true });
          } catch (err) {}
          try {
            if (typeof window.softRepaintCattleTrackerView === 'function') {
              window.softRepaintCattleTrackerView();
            }
          } catch (err2) {}
        }
        apply();
        if (typeof requestAnimationFrame === 'function') {
          requestAnimationFrame(apply);
        }
        setTimeout(apply, 0);
      }

      document.addEventListener('mousedown', function (e) {
        if (e.button === 2) focusEditableFromEvent(e);
        if (e.button === 0) focusEditableFromEvent(e);
      }, true);
      document.addEventListener('contextmenu', function (e) {
        focusEditableFromEvent(e);
      }, true);
    };

    var s = document.createElement('script');
    s.textContent = '(' + String(runInPage) + ')();';
    (document.head || document.documentElement).appendChild(s);
    s.remove();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectMainWorldListeners, { once: true });
  } else {
    injectMainWorldListeners();
  }
})();
