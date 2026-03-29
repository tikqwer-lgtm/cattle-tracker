/**
 * Журнал диагностики открытия/закрытия DevTools (Electron) — экран «Справка».
 */
(function () {
  'use strict';

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

  function setup() {
    var api = typeof window !== 'undefined' && window.electronAPI;
    if (!api || typeof api.getDevtoolsDiagnosticsHistory !== 'function') return;

    var entries = [];
    var ta = document.getElementById('help-diagnostics-log');
    var copyBtn = document.getElementById('help-diagnostics-copy-btn');
    var clearBtn = document.getElementById('help-diagnostics-clear-btn');
    var refreshBtn = document.getElementById('help-diagnostics-refresh-btn');
    if (!ta) return;

    var lastVisibilitySnapMs = 0;

    function rebuildText() {
      ta.value = entries.map(formatEntry).filter(Boolean).join('\n');
      ta.scrollTop = ta.scrollHeight;
    }

    function pushLocalSnapshot(label) {
      var snap = collectRendererSnapshot(label);
      entries.push({
        ts: new Date().toISOString(),
        source: 'renderer',
        message: 'снимок ' + label,
        extra: snap
      });
      rebuildText();
      try {
        if (typeof api.sendDevtoolsDiagnosticsSnapshot === 'function') {
          api.sendDevtoolsDiagnosticsSnapshot('renderer:' + label, snap);
        }
      } catch (e) {}
    }

    function scheduleResidualSnapshots() {
      [0, 50, 100, 300, 800].forEach(function (ms) {
        setTimeout(function () {
          pushLocalSnapshot('+' + ms + ' мс после devtools-closed (остаточное состояние)');
        }, ms);
      });
    }

    api.onDevtoolsDiagnosticsEntry(function (entry) {
      if (!entry || !entry.ts) return;
      entries.push(entry);
      if (entries.length > 1500) entries.splice(0, entries.length - 1500);
      if (entry.message === 'devtools-closed') {
        scheduleResidualSnapshots();
      }
      rebuildText();
    });

    function refreshFromMain() {
      return api.getDevtoolsDiagnosticsHistory().then(function (h) {
        entries.length = 0;
        if (Array.isArray(h)) {
          h.forEach(function (x) {
            entries.push(x);
          });
        }
        pushLocalSnapshot('экран «Справка»: синхронизация с main');
        rebuildText();
      }).catch(function () {});
    }

    window.refreshHelpDevtoolsDiagnostics = function () {
      return refreshFromMain();
    };

    if (copyBtn) {
      copyBtn.addEventListener('click', function () {
        var text = ta.value || '';
        if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(function () {
            if (typeof showToast === 'function') showToast('Журнал скопирован в буфер', 'info');
          }).catch(function () {
            ta.select();
            try {
              document.execCommand('copy');
            } catch (e) {}
          });
        } else {
          ta.select();
          try {
            document.execCommand('copy');
          } catch (e2) {}
        }
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        if (typeof api.clearDevtoolsDiagnosticsLog === 'function') {
          api.clearDevtoolsDiagnosticsLog();
        }
        entries.length = 0;
        rebuildText();
        if (typeof showToast === 'function') showToast('Журнал очищен', 'info');
      });
    }

    if (refreshBtn) {
      refreshBtn.addEventListener('click', function () {
        refreshFromMain();
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
