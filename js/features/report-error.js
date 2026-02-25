/**
 * report-error.js — кнопка «Сообщить об ошибке» и модалка отправки отчёта администратору (режим API).
 */
(function (global) {
  'use strict';

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
