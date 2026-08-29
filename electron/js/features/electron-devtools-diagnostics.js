/**
 * Журнал диагностики открытия/закрытия DevTools (Electron) — экран «Справка».
 * API на window работает без DOM; textarea синхронизируется, если есть в React-экране.
 */
(function () {
  'use strict';

  var entries = [];
  var lastVisibilitySnapMs = 0;

  function safeJson(x) {
    try {
      return JSON.stringify(x);
    } catch (e) {
      return String(x);
    }
  }

  function formatEntry(e) {
    if (!e || !e.ts) return '';
    var extra = '';
    if (e.extra != null && e.extra !== '') {
      extra = typeof e.extra === 'object' ? ' ' + safeJson(e.extra) : ' ' + String(e.extra);
    }
    return e.ts + ' [' + e.source + '] ' + (e.message || '') + extra;
  }

  function collectRendererSnapshot(hint) {
    try {
      return {
        hint: hint || '',
        visibilityState: document.visibilityState,
        documentHasFocus: document.hasFocus(),
        activeElement: document.activeElement
          ? document.activeElement.tagName + (document.activeElement.id ? '#' + document.activeElement.id : '')
          : null,
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        devicePixelRatio: window.devicePixelRatio,
        scrollY: window.scrollY
      };
    } catch (err) {
      return { error: String(err && err.message) };
    }
  }

  function getText() {
    return entries.map(formatEntry).filter(Boolean).join('\n');
  }

  function syncTextarea() {
    var ta = document.getElementById('help-diagnostics-log');
    if (!ta) return;
    ta.value = getText();
    ta.scrollTop = ta.scrollHeight;
  }

  function pushLocalSnapshot(api, label) {
    var snap = collectRendererSnapshot(label);
    entries.push({
      ts: new Date().toISOString(),
      source: 'renderer',
      message: 'снимок ' + label,
      extra: snap
    });
    syncTextarea();
    try {
      if (api && typeof api.sendDevtoolsDiagnosticsSnapshot === 'function') {
        api.sendDevtoolsDiagnosticsSnapshot('renderer:' + label, snap);
      }
    } catch (e) {}
  }

  function scheduleResidualSnapshots(api) {
    [0, 50, 100, 300, 800].forEach(function (ms) {
      setTimeout(function () {
        pushLocalSnapshot(api, '+' + ms + ' мс после devtools-closed (остаточное состояние)');
      }, ms);
    });
  }

  function setup() {
    var api = typeof window !== 'undefined' && window.electronAPI;

    window.getHelpDevtoolsDiagnosticsText = function () {
      return getText();
    };

    window.clearHelpDevtoolsDiagnostics = function () {
      if (api && typeof api.clearDevtoolsDiagnosticsLog === 'function') {
        api.clearDevtoolsDiagnosticsLog();
      }
      entries.length = 0;
      syncTextarea();
    };

    window.refreshHelpDevtoolsDiagnostics = function () {
      if (!api || typeof api.getDevtoolsDiagnosticsHistory !== 'function') {
        syncTextarea();
        return Promise.resolve();
      }
      return api.getDevtoolsDiagnosticsHistory().then(function (h) {
        entries.length = 0;
        if (Array.isArray(h)) {
          h.forEach(function (x) {
            entries.push(x);
          });
        }
        pushLocalSnapshot(api, 'экран «Справка»: синхронизация с main');
        syncTextarea();
      }).catch(function () {
        syncTextarea();
      });
    };

    if (!api || typeof api.getDevtoolsDiagnosticsHistory !== 'function') return;

    if (typeof api.onDevtoolsDiagnosticsEntry === 'function') {
      api.onDevtoolsDiagnosticsEntry(function (entry) {
        if (!entry || !entry.ts) return;
        entries.push(entry);
        if (entries.length > 1500) entries.splice(0, entries.length - 1500);
        if (entry.message === 'devtools-closed') {
          scheduleResidualSnapshots(api);
        }
        syncTextarea();
      });
    }

    document.addEventListener('visibilitychange', function () {
      var now = Date.now();
      if (now - lastVisibilitySnapMs < 1500) return;
      lastVisibilitySnapMs = now;
      try {
        if (typeof api.sendDevtoolsDiagnosticsSnapshot === 'function') {
          api.sendDevtoolsDiagnosticsSnapshot('document.visibilitychange', collectRendererSnapshot('visibility'));
        }
      } catch (e) {}
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setup);
  } else {
    setup();
  }
})();

export {};
