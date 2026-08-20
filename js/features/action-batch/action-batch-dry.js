/**
 * Пакетный ввод — сухостой.
 */
(function () {
  'use strict';
  var AB = window.__actionBatch;
  if (!AB) {
    console.error('[action-batch] сначала загрузите action-batch-core.js');
    return;
  }
  var getEntries = AB.getEntries;
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

  // ——— Запуск (сухостой) ———
  var dryDraft = [];

  function formatDateCell(d) {
    if (!d) return '—';
    if (typeof formatDate === 'function') return formatDate(d) || d;
    return String(d);
  }

  function getLastInseminationDate(entry) {
    if (!entry) return '';
    var last = null;
    if (entry.inseminationHistory && entry.inseminationHistory.length) {
      var dates = entry.inseminationHistory.map(function (h) { return h.date; }).filter(Boolean);
      if (dates.length) last = dates.reduce(function (a, b) { return a > b ? a : b; });
    }
    if (!last && entry.inseminationDate) last = entry.inseminationDate;
    return last || '';
  }

  function renderDryDraft() {
    var host = document.getElementById('dryBatchDraftTable');
    if (!host) return;
    if (!dryDraft.length) {
      host.innerHTML = '<p class="action-batch-draft-empty">Добавьте коров по номеру.</p>';
      return;
    }
    var rows = dryDraft.map(function (r) {
      var entry = getEntries().find(function (e) { return e.cattleId === r.cattleId; });
      var insemStr = '—';
      var statusStr = '—';
      var daysStr = '—';
      if (entry) {
        statusStr = escapeHtml(String(entry.status || '—'));
        var lastInsem = getLastInseminationDate(entry);
        insemStr = lastInsem ? escapeHtml(formatDateCell(lastInsem)) : '—';
        var dp = typeof window.getDaysPregnant === 'function' ? window.getDaysPregnant(entry) : null;
        daysStr = dp != null && dp !== '' ? String(dp) : '—';
      }
      return (
        '<tr data-row-id="' + r.id + '" class="action-batch-draft-row' + draftRowWarnClass(r) + '">' +
        '<td>' + escapeHtml(r.cattleId) + '</td>' +
        '<td>' + insemStr + '</td>' +
        '<td>' + statusStr + '</td>' +
        '<td>' + escapeHtml(daysStr) + '</td>' +
        '<td><button type="button" class="action-batch-row-remove" data-dry-remove="' + r.id + '">×</button></td>' +
        '</tr>'
      );
    }).join('');
    host.innerHTML =
      '<table class="action-batch-table action-batch-table--dry">' +
      '<thead><tr><th>Номер</th><th>Дата осеменения</th><th>Статус</th><th>Дни стельности</th><th></th></tr></thead><tbody>' +
      rows + '</tbody></table>';
    host.querySelectorAll('[data-dry-remove]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var id = btn.getAttribute('data-dry-remove');
        dryDraft = dryDraft.filter(function (x) { return x.id !== id; });
        renderDryDraft();
      });
    });
  }

  function addDryRow(cattleId) {
    if (dryDraft.some(function (x) { return x.cattleId === cattleId; })) {
      toast('Уже в списке', 'error');
      return;
    }
    var ent = resolveEntryForAction(cattleId);
    var dryDate = document.getElementById('dryStartDateInput') && document.getElementById('dryStartDateInput').value;
    if (!dryDate) {
      toast('Укажите дату начала сухостоя', 'error');
      return;
    }
    var G = window.ActionInputGuards;
    var hadWarnings = !!(G && G.checkDry && !G.checkDry(ent, dryDate, {}).ok);
    var p = !G || typeof G.confirmDryFlow !== 'function' ? Promise.resolve(true) : G.confirmDryFlow(ent, dryDate);
    p.then(function (ok) {
      if (!ok) return;
      dryDraft.push({
        id: uid(),
        cattleId: cattleId,
        _batchGuardKey: batchGuardKey(dryDate, ''),
        _batchGuardWarned: hadWarnings
      });
      var addIn = document.getElementById('dryBatchAddInput');
      if (addIn) addIn.value = '';
      renderDryDraft();
    });
  }

  function saveDryBatch() {
    var dryDate = document.getElementById('dryStartDateInput') && document.getElementById('dryStartDateInput').value;
    if (!dryDate) {
      toast('Укажите дату начала сухостоя', 'error');
      return;
    }
    if (!dryDraft.length) {
      toast('Добавьте коров', 'error');
      return;
    }
    var applyDry = typeof window.applyDryRunToEntry === 'function' ? window.applyDryRunToEntry : null;
    if (!applyDry) return;
    var G = window.ActionInputGuards;
    var draft = dryDraft.slice();
    var p = Promise.resolve(true);
    draft.forEach(function (r) {
      p = p.then(function (prev) {
        if (!prev) return false;
        var ent = resolveEntryForAction(r.cattleId);
        if (!ent) return false;
        if (!G || typeof G.confirmDryFlow !== 'function') return true;
        if (r._batchGuardKey === batchGuardKey(dryDate, '')) return true;
        return G.confirmDryFlow(ent, dryDate);
      });
    });
    p.then(function (ok) {
      if (!ok) return;
      var operations = draft.map(function (r) {
        return {
          cattleId: r.cattleId,
          apply: function (entry) { applyDry(entry, dryDate); }
        };
      });
      return runSequentialUpdates(operations);
    })
      .then(function (ran) {
        if (ran === undefined) return;
        dryDraft = [];
        renderDryDraft();
        toast('Сохранено', 'success');
        if (typeof updateViewList === 'function') updateViewList();
        if (typeof window.navigateBackOrFallback === 'function') window.navigateBackOrFallback();
        else if (typeof navigate === 'function') navigate('menu');
      })
      .catch(function (err) {
        toast(err && err.message ? err.message : 'Ошибка', 'error');
      });
  }

  function initActionBatchDryScreen() {
    dryDraft = [];
    var dateEl = document.getElementById('dryStartDateInput');
    if (dateEl) dateEl.value = new Date().toISOString().slice(0, 10);
    if (typeof window.setupCattleAutocompleteFor === 'function') {
      window.setupCattleAutocompleteFor('dryBatchAddInput', 'dryBatchAddList', addDryRow);
    }
    if (window._prefillCattleId) {
      var a = document.getElementById('dryBatchAddInput');
      if (a) a.value = window._prefillCattleId;
      delete window._prefillCattleId;
    }
    bindOnce(document.getElementById('dryBatchSaveBtn'), 'click', saveDryBatch);
    renderDryDraft();
  }
  window.initActionBatchDryScreen = initActionBatchDryScreen;
})();

export {};
