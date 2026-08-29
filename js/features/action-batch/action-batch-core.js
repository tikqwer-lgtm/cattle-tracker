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

  function findEntry(cattleId) {
    var id = String(cattleId || '').trim();
    if (!id) return null;
    return getEntries().find(function (x) { return String(x.cattleId || '').trim() === id; }) || null;
  }

  function buildBlankEntry(cattleId) {
    var entry;
    if (typeof window.getDefaultCowEntry === 'function') {
      entry = window.getDefaultCowEntry();
    } else {
      entry = {
        cattleId: '',
        nickname: '',
        group: '',
        status: '',
        inseminationHistory: [],
        uziHistory: [],
        actionHistory: [],
        lactationHistory: [],
        protocol: { name: '', startDate: '' },
        vwp: 60
      };
    }
    entry.cattleId = String(cattleId || '').trim();
    return entry;
  }

  function resolveEntryForAction(cattleId) {
    return findEntry(cattleId) || buildBlankEntry(cattleId);
  }

  function newAnimalHintHtml(cattleId) {
    if (findEntry(cattleId)) return '';
    return '<p class="action-batch-modal-hint">Животного нет в стаде — будет добавлено вместе с событием.</p>';
  }

  function toast(msg, type) {
    if (typeof showToast === 'function') showToast(msg, type || 'info');
    else alert(msg);
  }

  function toastSaveError(err, fallback) {
    if (err && err.alreadyToasted) return;
    var msg = err && err.message ? String(err.message) : (fallback || 'Ошибка сохранения');
    if (err && err.code === 'PREVIEW_BLOCKED') return;
    if (msg === 'Режим просмотра: изменения отключены') return;
    toast(msg, 'error');
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
    var useApi = typeof window !== 'undefined' && window.CATTLE_TRACKER_USE_API;
    var canUpdate = useApi && typeof window.updateEntryViaApi === 'function';
    var canCreate = useApi && typeof window.createEntryViaApi === 'function';

    function applyOne(op) {
      var existing = findEntry(op.cattleId);
      var isNew = !existing;
      var e = existing || buildBlankEntry(op.cattleId);
      if (isNew) getEntries().push(e);
      op.apply(e);
      if (!useApi) return Promise.resolve();
      if (isNew) {
        if (!canCreate) return Promise.reject(new Error('Нет записи: ' + op.cattleId));
        return window.createEntryViaApi(e);
      }
      if (!canUpdate) return Promise.reject(new Error('Нет записи: ' + op.cattleId));
      return window.updateEntryViaApi(op.cattleId, e);
    }

    if (!useApi) {
      for (var i = 0; i < operations.length; i++) {
        applyOne(operations[i]);
      }
      if (typeof saveLocally === 'function') saveLocally();
      return Promise.resolve();
    }
    return operations.reduce(function (p, op) {
      return p.then(function () { return applyOne(op); });
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

  function fillOperatorField(inputId) {
    var input = document.getElementById(inputId);
    if (!input) return;
    var login = defaultSpecialist();
    var techs = typeof window.getFarmTechnicians === 'function' ? (window.getFarmTechnicians() || []) : [];
    var listId = input.getAttribute('list') || 'datalist-farm-technicians';
    input.setAttribute('list', listId);
    var dl = document.getElementById(listId);
    if (dl && dl.tagName === 'DATALIST') {
      var seen = {};
      var values = [];
      function addVal(v) {
        var s = String(v || '').trim();
        if (!s) return;
        var k = s.toLowerCase();
        if (seen[k]) return;
        seen[k] = true;
        values.push(s);
      }
      addVal(login);
      techs.forEach(addVal);
      dl.innerHTML = '';
      values.forEach(function (v) {
        var opt = document.createElement('option');
        opt.value = v;
        dl.appendChild(opt);
      });
    }
    if (login && !String(input.value || '').trim()) input.value = login;
  }

  function confirmMissingAnimal(cattleId) {
    if (findEntry(cattleId)) return Promise.resolve(true);
    return new Promise(function (resolve) {
      var wrap = openOverlay(
        '<h3 class="action-batch-modal-title">Нет в стаде</h3>' +
        '<p class="action-batch-modal-hint">Животного «' + escapeHtml(cattleId) + '» нет в стаде. Добавить вместе с событием?</p>' +
        '<div class="action-batch-modal-actions">' +
        '<button type="button" class="action-batch-btn action-batch-btn-primary" id="abMissingYes">Добавить</button>' +
        '<button type="button" class="action-batch-btn" id="abMissingNo">Отмена</button>' +
        '</div>'
      );
      var done = false;
      function finish(ok) {
        if (done) return;
        done = true;
        closeTopModal();
        resolve(!!ok);
      }
      var yes = document.getElementById('abMissingYes');
      var no = document.getElementById('abMissingNo');
      if (yes) yes.addEventListener('click', function () { finish(true); });
      if (no) no.addEventListener('click', function () { finish(false); });
      if (wrap) {
        wrap.addEventListener('click', function (e) {
          if (e.target === wrap) finish(false);
        });
      }
    });
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
    r._batchGuardKey = undefined;
    r._batchGuardWarned = false;
  }

  function bindNumberCollarPair(numberId, collarId) {
    var numEl = document.getElementById(numberId);
    var colEl = document.getElementById(collarId);
    if (!numEl || !colEl) return;
    function fromNumber() {
      var CL = window.CollarLookup;
      if (!CL) return;
      var e = CL.findEntryByCattleId(numEl.value);
      if (e) colEl.value = e.collar || '';
    }
    function fromCollar() {
      var CL = window.CollarLookup;
      if (!CL) return;
      var e = CL.findEntryByCollar(colEl.value);
      if (e) numEl.value = e.cattleId || '';
    }
    bindOnce(numEl, 'input', fromNumber);
    bindOnce(numEl, 'change', fromNumber);
    bindOnce(numEl, 'blur', fromNumber);
    bindOnce(colEl, 'input', fromCollar);
    bindOnce(colEl, 'change', fromCollar);
    bindOnce(colEl, 'blur', fromCollar);
    bindOnce(colEl, 'keydown', function (e) {
      if (e.key !== 'Enter') return;
      if (e.isComposing || e.keyCode === 229) return;
      fromCollar();
    });
  }

  function applyDraftCollar(entry, collar) {
    if (!entry) return;
    var CL = window.CollarLookup;
    if (CL && typeof CL.applyCollarToHerd === 'function') {
      CL.applyCollarToHerd(entry, collar);
    } else {
      entry.collar = String(collar || '').trim();
    }
  }
  window.__actionBatch = {
    getEntries: getEntries,
    findEntry: findEntry,
    buildBlankEntry: buildBlankEntry,
    resolveEntryForAction: resolveEntryForAction,
    newAnimalHintHtml: newAnimalHintHtml,
    toast: toast,
    toastSaveError: toastSaveError,
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
    fillOperatorField: fillOperatorField,
    confirmMissingAnimal: confirmMissingAnimal,
    escapeHtml: escapeHtml,
    batchGuardKey: batchGuardKey,
    draftRowWarnClass: draftRowWarnClass,
    clearRowBatchGuard: clearRowBatchGuard,
    bindNumberCollarPair: bindNumberCollarPair,
    applyDraftCollar: applyDraftCollar
  };
})();

export {};
