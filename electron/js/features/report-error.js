/**
 * report-error.js — кнопка «Сообщить об ошибке» и модалка отправки отчёта администратору (режим API).
 * В диагностику входят: последняя ошибка (onerror), буфер записей консоли (log/warn/error).
 */
(function (global) {
  'use strict';

  var CONSOLE_BUFFER_MAX = 500;
  var CONSOLE_PAYLOAD_MAX_CHARS = 80000;

  if (typeof global !== 'undefined') {
    global.__lastCattleTrackerError = null;
    var origOnError = global.onerror;
    global.onerror = function (message, source, lineno, colno, error) {
      try {
        global.__lastCattleTrackerError = { message: message, source: source, line: lineno, col: colno, stack: error && error.stack };
      } catch (_) {}
      if (typeof origOnError === 'function') return origOnError.apply(this, arguments);
      return false;
    };

    var consoleBuffer = [];
    global.__cattleTrackerConsoleBuffer = consoleBuffer;
    function serializeArg(a) {
      if (a == null) return String(a);
      if (typeof a === 'string') return a.length <= 500 ? a : a.slice(0, 500) + '…';
      if (typeof a === 'number' || typeof a === 'boolean') return String(a);
      try {
        var s = JSON.stringify(a);
        return s.length <= 500 ? s : s.slice(0, 500) + '…';
      } catch (_) { return Object.prototype.toString.call(a); }
    }
    function pushConsole(level, args) {
      try {
        var text = Array.prototype.map.call(args, serializeArg).join(' ');
        consoleBuffer.push({ t: Date.now(), level: level, text: text });
        if (consoleBuffer.length > CONSOLE_BUFFER_MAX) consoleBuffer.shift();
      } catch (_) {}
    }
    if (typeof global.console !== 'undefined') {
      var origLog = global.console.log;
      var origWarn = global.console.warn;
      var origError = global.console.error;
      global.console.log = function () { pushConsole('log', arguments); return origLog.apply(global.console, arguments); };
      global.console.warn = function () { pushConsole('warn', arguments); return origWarn.apply(global.console, arguments); };
      global.console.error = function () { pushConsole('error', arguments); return origError.apply(global.console, arguments); };
    }
  }

  function getModal() {
    return document.getElementById('report-error-modal');
  }

  function getMessageEl() {
    return document.getElementById('report-error-message');
  }

  function getIncludeDiagnosticsEl() {
    return document.getElementById('report-error-include-diagnostics');
  }

  function openReportErrorModal() {
    var modal = getModal();
    var msg = getMessageEl();
    var chk = getIncludeDiagnosticsEl();
    if (!modal || !msg) return;
    msg.value = '';
    if (chk) chk.checked = true;
    modal.classList.add('active');
    modal.removeAttribute('hidden');
    modal.setAttribute('aria-hidden', 'false');
    setTimeout(function () {
      if (msg) msg.focus();
    }, 100);
  }

  function closeReportErrorModal() {
    var modal = getModal();
    if (!modal) return;
    modal.classList.remove('active');
    modal.setAttribute('hidden', '');
    modal.setAttribute('aria-hidden', 'true');
  }

  function collectDiagnostics() {
    var payload = {
      version: '',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      screen: typeof location !== 'undefined' ? (location.hash || location.pathname || '') : '',
      localStorageLength: 0
    };
    try {
      var verEl = document.getElementById('app-version');
      if (verEl && verEl.getAttribute('data-default-version')) {
        payload.version = verEl.getAttribute('data-default-version');
      }
      if (typeof navigator !== 'undefined' && navigator.userAgent) {
        payload.userAgent = navigator.userAgent;
      }
      if (typeof location !== 'undefined') {
        payload.screen = location.hash || location.pathname || '';
      }
      if (typeof localStorage !== 'undefined') {
        try {
          var total = 0;
          for (var key in localStorage) {
            if (localStorage.hasOwnProperty(key)) total += (localStorage[key].length + key.length) * 2;
          }
          payload.localStorageLength = total;
        } catch (_) {}
      }
      if (global.__lastCattleTrackerError) {
        payload.lastError = global.__lastCattleTrackerError;
      }
      if (global.__cattleTrackerConsoleBuffer && global.__cattleTrackerConsoleBuffer.length > 0) {
        var lines = global.__cattleTrackerConsoleBuffer.map(function (e) {
          return '[' + new Date(e.t).toISOString() + '] [' + e.level + '] ' + e.text;
        });
        var joined = lines.join('\n');
        if (joined.length > CONSOLE_PAYLOAD_MAX_CHARS) {
          joined = joined.slice(-CONSOLE_PAYLOAD_MAX_CHARS);
          payload.consoleLogTruncated = true;
        }
        payload.consoleLog = joined;
      }
    } catch (e) {
      payload.collectError = String(e && e.message);
    }
    return payload;
  }

  function submitReportError() {
    var api = global.CattleTrackerApi;
    if (!api || typeof api.submitReport !== 'function') {
      if (typeof showToast === 'function') showToast('Отправка недоступна (нет подключения к серверу)', 'error');
      return;
    }
    var msgEl = getMessageEl();
    var chk = getIncludeDiagnosticsEl();
    var message = msgEl ? (msgEl.value || '').trim() : '';
    if (!message) {
      if (typeof showToast === 'function') showToast('Введите описание проблемы', 'error');
      if (msgEl) msgEl.focus();
      return;
    }
    var payload = (chk && chk.checked) ? collectDiagnostics() : null;
    var btn = document.getElementById('report-error-submit-btn');
    if (btn) btn.disabled = true;
    api.submitReport(message, payload)
      .then(function () {
        closeReportErrorModal();
        if (typeof showToast === 'function') showToast('Сообщение отправлено', 'info');
      })
      .catch(function (err) {
        if (typeof showToast === 'function') showToast(err.message || 'Ошибка отправки', 'error', 5000);
      })
      .finally(function () {
        if (btn) btn.disabled = false;
      });
  }

  if (typeof global !== 'undefined') {
    global.openReportErrorModal = openReportErrorModal;
    global.closeReportErrorModal = closeReportErrorModal;
    global.submitReportError = submitReportError;
  }
})(typeof window !== 'undefined' ? window : this);
