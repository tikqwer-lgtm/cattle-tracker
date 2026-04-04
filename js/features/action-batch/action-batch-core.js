/**
 * Общая логика пакетного ввода (оверлей, сохранение, хелперы).
 * window.__actionBatch — внутренний API.
 */
(function () {
  'use strict';
  if (typeof window === 'undefined') return;

  function getEntries() {
    return typeof window !== 'undefined' && window.entries && Array.isArray(window.entries) ? window.entries : [];
  }

  function toast(msg, type) {
    if (typeof showToast === 'function') showToast(msg, type || 'info');
    else alert(msg);
  }

  function uid() {
    return 'b_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
  }

  function clearAutocompleteDropdowns() {
    try {
      document.querySelectorAll('.autocomplete-list').forEach(function (ul) {
        ul.innerHTML = '';
      });
    } catch (e) {}
  }

  var ACTION_BATCH_NUMBER_INPUTS = [
    { screen: 'insemination-screen', input: 'inseminationBatchAddInput' },
    { screen: 'dry-screen', input: 'dryBatchAddInput' },
    { screen: 'uzi-screen', input: 'uziBatchAddInput' },
    { screen: 'protocol-assign-screen', input: 'protocolBatchAddInput' },
    { screen: 'calving-screen', input: 'calvingBatchAddInput' },
    { screen: 'abort-screen', input: 'abortBatchAddInput' }
  ];

  function refocusActiveActionBatchNumberInput() {
    for (var i = 0; i < ACTION_BATCH_NUMBER_INPUTS.length; i++) {
      var p = ACTION_BATCH_NUMBER_INPUTS[i];
      var sc = document.getElementById(p.screen);
      if (!sc || !sc.classList.contains('active')) continue;
      var el = document.getElementById(p.input);
      if (!el || !el.isConnected) return;
      (function (focusEl) {
        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            if (!focusEl.isConnected) return;
            try {
              focusEl.focus({ preventScroll: true });
            } catch (e1) {
              try {
                focusEl.focus();
              } catch (e2) {}
            }
          });
        });
      })(el);
      return;
    }
  }

  function closeTopModal() {
    var ex = document.querySelector('.action-batch-overlay');
    if (ex) {
      try {
        var ae = document.activeElement;
        if (ae && ex.contains(ae) && typeof ae.blur === 'function') ae.blur();
      } catch (e) {}
      ex.remove();
      try {
        ae = document.activeElement;
        if (ae && ae !== document.body && ae !== document.documentElement && !ae.isConnected && typeof ae.blur === 'function') {
          ae.blur();
        }
      } catch (e2) {}
      if (typeof window.softRepaintCattleTrackerView === 'function') window.softRepaintCattleTrackerView();
      try {
        var api = typeof window !== 'undefined' && window.electronAPI;
        if (api && typeof api.requestNativeWindowRefresh === 'function') api.requestNativeWindowRefresh();
      } catch (e3) {}
    }
    clearAutocompleteDropdowns();
  }

  function openOverlay(innerHtml) {
    closeTopModal();
    var wrap = document.createElement('div');
    wrap.className = 'action-batch-overlay';
    wrap.setAttribute('role', 'dialog');
    wrap.innerHTML =
      '<div class="action-batch-modal">' +
      innerHtml +
      '</div>';
    wrap.addEventListener('click', function (e) {
      if (e.target === wrap) {
        closeTopModal();
        refocusActiveActionBatchNumberInput();
      }
    });
    document.body.appendChild(wrap);
    return wrap;
  }

  function bindOnce(el, evt, fn) {
    if (!el) return;
    var k = '_ab_' + evt;
    if (el[k]) el.removeEventListener(evt, el[k]);
    el[k] = fn;
    el.addEventListener(evt, fn);
  }

  function computeUziDays(entry, uziDate) {
    if (!entry || !uziDate) return null;
    var fn = typeof window.getLastInseminationDateBefore === 'function' ? window.getLastInseminationDateBefore : null;
    if (!fn) return null;
    var lastInsem = fn(entry, uziDate);
    if (!lastInsem) return null;
    var d1 = new Date(lastInsem);
    var d2 = new Date(uziDate);
    if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return null;
    var days = Math.round((d2 - d1) / (24 * 60 * 60 * 1000));
    return days >= 0 ? days : null;
  }

  function runSequentialUpdates(operations) {
    var useApi = typeof window !== 'undefined' && window.CATTLE_TRACKER_USE_API && typeof window.updateEntryViaApi === 'function';
    if (!useApi) {
      for (var i = 0; i < operations.length; i++) {
        var op = operations[i];
        var e = getEntries().find(function (x) { return x.cattleId === op.cattleId; });
        if (!e) throw new Error('Нет записи: ' + op.cattleId);
        op.apply(e);
      }
      if (typeof saveLocally === 'function') saveLocally();
      return Promise.resolve();
    }
    return operations.reduce(function (p, op) {
      return p.then(function () {
        var e = getEntries().find(function (x) { return x.cattleId === op.cattleId; });
        if (!e) return Promise.reject(new Error('Нет записи: ' + op.cattleId));
        op.apply(e);
        return window.updateEntryViaApi(op.cattleId, e);
      });
    }, Promise.resolve());
  }

  function runSequentialCreates(entriesToCreate) {
    if (!entriesToCreate || !entriesToCreate.length) return Promise.resolve();
    var useApi = typeof window !== 'undefined' && window.CATTLE_TRACKER_USE_API && typeof window.createEntryViaApi === 'function';
    if (!useApi) {
      var arr = getEntries();
      entriesToCreate.forEach(function (en) { arr.push(en); });
      if (typeof saveLocally === 'function') saveLocally();
      return Promise.resolve();
    }
    return entriesToCreate.reduce(function (p, en) {
      return p.then(function () { return window.createEntryViaApi(en); });
    }, Promise.resolve());
  }

  function defaultSpecialist() {
    if (typeof window.getCurrentUser === 'function' && window.getCurrentUser()) {
      var u = window.getCurrentUser();
      if (u && u.username) return String(u.username);
    }
    return '';
  }

  function escapeHtml(s) {
    if (s == null) return '';
    var d = document.createElement('div');
    d.textContent = String(s);
    return d.innerHTML;
  }

  /** Ключ для пропуска повторных модалок при «Сохранить всё», если дата/параметры не менялись. */
  function batchGuardKey(actionDate, extra) {
    return String(actionDate || '') + '\x1e' + String(extra || '');
  }

  function draftRowWarnClass(r) {
    return r && r._batchGuardWarned ? ' action-batch-draft-row--guard-warn' : '';
  }

  function clearRowBatchGuard(r) {
    if (!r) return;
    delete r._batchGuardKey;
    delete r._batchGuardWarned;
    delete r._calvingIntentAtAdd;
    delete r._protocolModeAtAdd;
  }
  window.__actionBatch = {
    getEntries: getEntries,
    toast: toast,
    uid: uid,
    clearAutocompleteDropdowns: clearAutocompleteDropdowns,
    refocusActiveActionBatchNumberInput: refocusActiveActionBatchNumberInput,
    closeTopModal: closeTopModal,
    openOverlay: openOverlay,
    bindOnce: bindOnce,
    computeUziDays: computeUziDays,
    runSequentialUpdates: runSequentialUpdates,
    runSequentialCreates: runSequentialCreates,
    defaultSpecialist: defaultSpecialist,
    escapeHtml: escapeHtml,
    batchGuardKey: batchGuardKey,
    draftRowWarnClass: draftRowWarnClass,
    clearRowBatchGuard: clearRowBatchGuard
  };
})();

export {};
