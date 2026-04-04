/**
 * Electron: нативное обновление окна при фокусе/клике по полям на экранах «Действия».
 * Симптом «ввод оживает после minimize/restore» часто проявляется уже после открытия экрана —
 * таймеры при navigate не всегда совпадают с моментом, когда пользователь кликает в поле.
 */
(function () {
  'use strict';

  var ACTION_SCREEN_IDS = {
    'insemination-screen': true,
    'dry-screen': true,
    'uzi-screen': true,
    'calving-screen': true,
    'abort-screen': true,
    'protocol-assign-screen': true
  };

  function activeActionScreen() {
    var keys = Object.keys(ACTION_SCREEN_IDS);
    for (var i = 0; i < keys.length; i++) {
      var el = document.getElementById(keys[i]);
      if (el && el.classList.contains('active')) return el;
    }
    return null;
  }

  function isEditableTarget(t) {
    if (!t || !t.tagName) return false;
    var tag = t.tagName;
    if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
    if (tag !== 'INPUT') return false;
    var type = (t.getAttribute('type') || 'text').toLowerCase();
    if (type === 'hidden' || type === 'button' || type === 'submit' || type === 'reset' || type === 'checkbox' || type === 'radio') return false;
    return true;
  }

  function install() {
    var api = typeof window !== 'undefined' && window.electronAPI;
    if (!api || typeof api.requestNativeWindowRefresh !== 'function') return;

    var lastPointerMs = 0;
    var focusTimer = null;
    var POINTER_COOLDOWN_MS = 900;
    var FOCUS_DEBOUNCE_MS = 380;

    function scheduleNativeRefresh() {
      try {
        api.requestNativeWindowRefresh();
      } catch (e) {}
    }

    document.addEventListener(
      'pointerdown',
      function (e) {
        if (!isEditableTarget(e.target)) return;
        var sc = e.target.closest && e.target.closest('.screen.active');
        if (!sc || !ACTION_SCREEN_IDS[sc.id]) return;
        var now = Date.now();
        if (now - lastPointerMs < POINTER_COOLDOWN_MS) return;
        lastPointerMs = now;
        setTimeout(scheduleNativeRefresh, 0);
      },
      true
    );

    document.addEventListener(
      'focusin',
      function (e) {
        if (!isEditableTarget(e.target)) return;
        var sc = e.target.closest && e.target.closest('.screen.active');
        if (!sc || !ACTION_SCREEN_IDS[sc.id]) return;
        if (focusTimer) clearTimeout(focusTimer);
        var el = e.target;
        focusTimer = setTimeout(function () {
          focusTimer = null;
          if (!el || !el.isConnected) return;
          if (document.activeElement !== el) return;
          if (!activeActionScreen()) return;
          scheduleNativeRefresh();
        }, FOCUS_DEBOUNCE_MS);
      },
      true
    );
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }
})();
