/**
 * Пакетный ввод — аборт.
 */
(function () {
  'use strict';
  var AB = window.__actionBatch;
  if (!AB) {
    console.error('[action-batch] сначала загрузите action-batch-core.js');
    return;
  }
  var resolveEntryForAction = AB.resolveEntryForAction;
  var toast = AB.toast;
  var uid = AB.uid;
  var bindOnce = AB.bindOnce;
  var openOverlay = AB.openOverlay;
  var closeTopModal = AB.closeTopModal;
  var refocusActiveActionBatchNumberInput = AB.refocusActiveActionBatchNumberInput;
  var computeUziDays = AB.computeUziDays;
  var runSequentialUpdates = AB.runSequentialUpdates;
  var runSequentialCreates = AB.runSequentialCreates;
  var defaultSpecialist = AB.defaultSpecialist;
  var escapeHtml = AB.escapeHtml;
  var batchGuardKey = AB.batchGuardKey;
  var draftRowWarnClass = AB.draftRowWarnClass;
  var clearRowBatchGuard = AB.clearRowBatchGuard;

  // ——— Аборт ———
  var abortDraft = [];

  function renderAbortDraft() {
    var host = document.getElementById('abortBatchDraftTable');
    if (!host) return;
    if (!abortDraft.length) {
      host.innerHTML = '<p class="action-batch-draft-empty">Добавьте коров по номеру.</p>';
      return;
    }
    var rows = abortDraft.map(function (r) {
      return (
        '<tr data-row-id="' + r.id + '" class="action-batch-draft-row' + draftRowWarnClass(r) + '">' +
        '<td>' + escapeHtml(r.cattleId) + '</td>' +
        '<td><button type="button" class="action-batch-row-remove" data-abort-remove="' + r.id + '">×</button></td>' +
        '</tr>'
      );
    }).join('');
    host.innerHTML = '<table class="action-batch-table"><thead><tr><th>Номер</th><th></th></tr></thead><tbody>' + rows + '</tbody></table>';
    host.querySelectorAll('[data-abort-remove]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var id = btn.getAttribute('data-abort-remove');
        abortDraft = abortDraft.filter(function (x) { return x.id !== id; });
        renderAbortDraft();
      });
    });
  }

  function addAbortRow(cattleId) {
    if (abortDraft.some(function (x) { return x.cattleId === cattleId; })) {
      toast('Уже в списке', 'error');
      return;
    }
    var ent = resolveEntryForAction(cattleId);
    var abortDate = document.getElementById('abortDateInput') && document.getElementById('abortDateInput').value;
    if (!abortDate) {
      toast('Укажите дату события', 'error');
      return;
    }
    var G = window.ActionInputGuards;
    var hadWarnings = !!(G && G.checkAbort && !G.checkAbort(ent, abortDate, {}).ok);
    var p = !G || typeof G.confirmAbortFlow !== 'function' ? Promise.resolve(true) : G.confirmAbortFlow(ent, abortDate);
    p.then(function (ok) {
      if (!ok) return;
      abortDraft.push({
        id: uid(),
        cattleId: cattleId,
        _batchGuardKey: batchGuardKey(abortDate, ''),
        _batchGuardWarned: hadWarnings
      });
      var addIn = document.getElementById('abortBatchAddInput');
      if (addIn) addIn.value = '';
      renderAbortDraft();
    });
  }

  function saveAbortBatch() {
    var abortDate = document.getElementById('abortDateInput') && document.getElementById('abortDateInput').value;
    var noteEl = document.getElementById('abortNoteInput');
    var note = (noteEl && noteEl.value && noteEl.value.trim()) || '';
    if (!abortDate) {
      toast('Укажите дату события', 'error');
      return;
    }
    if (!abortDraft.length) {
      toast('Добавьте коров', 'error');
      return;
    }
    var applyAb = typeof window.applyAbortToEntry === 'function' ? window.applyAbortToEntry : null;
    if (!applyAb) return;
    var G = window.ActionInputGuards;
    var draft = abortDraft.slice();
    var p = Promise.resolve(true);
    draft.forEach(function (r) {
      p = p.then(function (prev) {
        if (!prev) return false;
        var ent = resolveEntryForAction(r.cattleId);
        if (!ent) return false;
        if (!G || typeof G.confirmAbortFlow !== 'function') return true;
        if (r._batchGuardKey === batchGuardKey(abortDate, '')) return true;
        return G.confirmAbortFlow(ent, abortDate);
      });
    });
    p.then(function (ok) {
      if (!ok) return;
      var operations = draft.map(function (r) {
        return {
          cattleId: r.cattleId,
          apply: function (entry) {
            applyAb(entry, abortDate, note);
          }
        };
      });
      return runSequentialUpdates(operations);
    })
      .then(function (ran) {
        if (ran === undefined) return;
        abortDraft = [];
        renderAbortDraft();
        toast('Сохранено', 'success');
        if (typeof updateViewList === 'function') updateViewList();
        if (typeof window.navigateBackOrFallback === 'function') window.navigateBackOrFallback();
        else if (typeof navigate === 'function') navigate('menu');
      })
      .catch(function (err) {
        toast(err && err.message ? err.message : 'Ошибка', 'error');
      });
  }

  function initActionBatchAbortScreen() {
    abortDraft = [];
    var dateEl = document.getElementById('abortDateInput');
    if (dateEl) dateEl.value = new Date().toISOString().slice(0, 10);
    var noteIn = document.getElementById('abortNoteInput');
    if (noteIn) noteIn.value = '';
    if (typeof window.setupCattleAutocompleteFor === 'function') {
      window.setupCattleAutocompleteFor('abortBatchAddInput', 'abortBatchAddList', addAbortRow);
    }
    if (window._prefillCattleId) {
      var a = document.getElementById('abortBatchAddInput');
      if (a) a.value = window._prefillCattleId;
      delete window._prefillCattleId;
    }
    bindOnce(document.getElementById('abortBatchSaveBtn'), 'click', saveAbortBatch);
    renderAbortDraft();
  }
  window.initActionBatchAbortScreen = initActionBatchAbortScreen;
})();

export {};
