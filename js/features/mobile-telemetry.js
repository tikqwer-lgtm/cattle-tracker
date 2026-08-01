/**
 * mobile-telemetry.js — Android Capacitor: ring log + credential mirror to native TelemetryBridge.
 * No-op outside Capacitor Android.
 */
(function (global) {
  'use strict';

  var PLUGIN = 'TelemetryBridge';
  var started = false;
  var flushTimer = null;
  var queue = [];
  var MAX_QUEUE = 80;

  function isAndroidCapacitor() {
    try {
      var C = global.Capacitor;
      if (!C || typeof C.isNativePlatform !== 'function' || !C.isNativePlatform()) return false;
      var p = typeof C.getPlatform === 'function' ? C.getPlatform() : '';
      return String(p).toLowerCase() === 'android';
    } catch (e) {
      return false;
    }
  }

  var pluginPromise = null;

  function getPluginAsync() {
    if (!isAndroidCapacitor()) return Promise.resolve(null);
    if (pluginPromise) return pluginPromise;
    pluginPromise = import('@capacitor/core')
      .then(function (core) {
        return core.registerPlugin(PLUGIN, {
          web: {
            setUploadConfig: function () {
              return Promise.resolve();
            },
            clearUploadConfig: function () {
              return Promise.resolve();
            },
            appendLog: function () {
              return Promise.resolve();
            },
            flushPending: function () {
              return Promise.resolve();
            },
            getStatus: function () {
              return Promise.resolve({ hasConfig: false, hasPending: false });
            }
          }
        });
      })
      .catch(function () {
        pluginPromise = null;
        return null;
      });
    return pluginPromise;
  }

  function callPlugin(method, data) {
    return getPluginAsync().then(function (p) {
      if (!p || typeof p[method] !== 'function') return;
      return p[method](data || {}).catch(function () {});
    });
  }

  function enqueue(line) {
    if (!line) return;
    var s = String(line);
    if (s.length > 1500) s = s.slice(0, 1500) + '…';
    queue.push(s);
    if (queue.length > MAX_QUEUE) queue = queue.slice(-MAX_QUEUE);
    if (!flushTimer) {
      flushTimer = setTimeout(flushQueue, 400);
    }
  }

  function flushQueue() {
    flushTimer = null;
    if (!queue.length) return;
    var batch = queue.splice(0, queue.length);
    for (var i = 0; i < batch.length; i++) {
      callPlugin('appendLog', { line: batch[i] });
    }
  }

  function mirrorUploadConfig() {
    if (!isAndroidCapacitor()) return;
    var api = global.CattleTrackerApi;
    var token = api && typeof api.getToken === 'function' ? api.getToken() : null;
    var base =
      api && typeof api.getBaseUrl === 'function'
        ? api.getBaseUrl()
        : (global.CATTLE_TRACKER_API_BASE || '').trim().replace(/\/$/, '');
    if (token && base) {
      callPlugin('setUploadConfig', { apiBase: base, token: token }).then(function () {
        callPlugin('flushPending', {});
      });
    } else {
      callPlugin('clearUploadConfig', {});
    }
  }

  function wrapConsole() {
    ['log', 'info', 'warn', 'error'].forEach(function (level) {
      var orig = console[level];
      if (typeof orig !== 'function') return;
      console[level] = function () {
        try {
          var parts = [];
          for (var i = 0; i < arguments.length; i++) {
            var a = arguments[i];
            if (a == null) parts.push(String(a));
            else if (typeof a === 'string') parts.push(a);
            else {
              try {
                parts.push(JSON.stringify(a));
              } catch (e) {
                parts.push(String(a));
              }
            }
          }
          enqueue('console.' + level + ': ' + parts.join(' '));
        } catch (e) {}
        return orig.apply(console, arguments);
      };
    });
  }

  function bindErrors() {
    var prevOnError = global.onerror;
    global.onerror = function (msg, src, line, col, err) {
      try {
        enqueue(
          'onerror: ' +
            String(msg || '') +
            ' @' +
            String(src || '') +
            ':' +
            String(line || '') +
            ':' +
            String(col || '') +
            (err && err.stack ? ' ' + String(err.stack).split('\n')[0] : '')
        );
      } catch (e) {}
      if (typeof prevOnError === 'function') return prevOnError.apply(this, arguments);
      return false;
    };
    global.addEventListener('unhandledrejection', function (ev) {
      try {
        var r = ev && ev.reason;
        enqueue('unhandledrejection: ' + (r && r.message ? r.message : String(r)));
      } catch (e) {}
    });
  }

  function bindNavigation() {
    try {
      global.addEventListener('cattle-tracker:navigate', function (ev) {
        var sid = ev && ev.detail && ev.detail.screenId;
        enqueue('navigate: ' + String(sid || ''));
      });
    } catch (e) {}
  }

  function initMobileTelemetry() {
    if (started || !isAndroidCapacitor()) return;
    started = true;

    global.__ctTelemetryPing = function () {
      return 'pong';
    };

    wrapConsole();
    bindErrors();
    bindNavigation();
    enqueue('telemetry: js bridge started');
    mirrorUploadConfig();

    setInterval(function () {
      flushQueue();
    }, 15000);
  }

  global.initMobileTelemetry = initMobileTelemetry;
  global.mirrorMobileTelemetryConfig = mirrorUploadConfig;
  global.appendMobileTelemetryLog = enqueue;

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () {
        setTimeout(initMobileTelemetry, 0);
      });
    } else {
      setTimeout(initMobileTelemetry, 0);
    }
  }
})(typeof window !== 'undefined' ? window : this);

export {};
