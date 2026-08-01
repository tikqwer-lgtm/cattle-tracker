/**
 * Плавный счёт числовых значений в DOM (меню, аналитика).
 * Уважает prefers-reduced-motion.
 */
(function () {
  'use strict';

  var REDUCED =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function parseStart(el) {
    if (!el) return 0;
    var raw = String(el.textContent || '').replace(/\s/g, '').replace(',', '.');
    var m = raw.match(/-?\d+(?:\.\d+)?/);
    return m ? parseFloat(m[0]) : 0;
  }

  function formatValue(n, decimals) {
    if (decimals > 0) return n.toFixed(decimals);
    return String(Math.round(n));
  }

  /**
   * @param {HTMLElement} el
   * @param {number} target
   * @param {{ duration?: number, suffix?: string, decimals?: number, prefix?: string }} [opts]
   */
  function animateNumber(el, target, opts) {
    if (!el) return;
    opts = opts || {};
    var duration = opts.duration != null ? opts.duration : 650;
    var suffix = opts.suffix != null ? opts.suffix : '';
    var prefix = opts.prefix != null ? opts.prefix : '';
    var decimals = opts.decimals != null ? opts.decimals : 0;
    var to = Number(target);
    if (!isFinite(to)) {
      el.textContent = prefix + String(target) + suffix;
      return;
    }

    if (REDUCED || duration <= 0) {
      el.textContent = prefix + formatValue(to, decimals) + suffix;
      return;
    }

    var from = parseStart(el);
    var token = (el._animToken || 0) + 1;
    el._animToken = token;
    var start = null;

    function easeOutCubic(t) {
      return 1 - Math.pow(1 - t, 3);
    }

    function frame(ts) {
      if (el._animToken !== token) return;
      if (start == null) start = ts;
      var t = Math.min(1, (ts - start) / duration);
      var v = from + (to - from) * easeOutCubic(t);
      el.textContent = prefix + formatValue(v, decimals) + suffix;
      if (t < 1) {
        requestAnimationFrame(frame);
      } else {
        el.textContent = prefix + formatValue(to, decimals) + suffix;
      }
    }

    requestAnimationFrame(frame);
  }

  /**
   * Анимирует элементы с data-animate-to внутри контейнера.
   * data-suffix, data-decimals — опционально.
   * @param {ParentNode} root
   */
  function animateNumberTargets(root) {
    if (!root || !root.querySelectorAll) return;
    var nodes = root.querySelectorAll('[data-animate-to]');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var raw = el.getAttribute('data-animate-to');
      if (raw == null || raw === '' || raw === '—') {
        el.textContent = raw === '—' ? '—' : el.textContent;
        continue;
      }
      var target = parseFloat(raw);
      if (!isFinite(target)) {
        el.textContent = raw;
        continue;
      }
      var suffix = el.getAttribute('data-suffix') || '';
      var decimals = parseInt(el.getAttribute('data-decimals') || '0', 10) || 0;
      el.textContent = '0' + suffix;
      animateNumber(el, target, { suffix: suffix, decimals: decimals });
    }
  }

  if (typeof window !== 'undefined') {
    window.animateNumber = animateNumber;
    window.animateNumberTargets = animateNumberTargets;
  }
})();
export {};
