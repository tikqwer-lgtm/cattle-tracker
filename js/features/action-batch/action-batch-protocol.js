/**
 * Пакетный ввод — протокол.
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
  var toastSaveError = AB.toastSaveError;
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

  // ——— Протокол ———
  var protocolDraft = [];

  function fillProtocolSelectBatch() {
    var select = document.getElementById('protocolSelectAssign');
    var getProtocolsFn = typeof window.getProtocols === 'function' ? window.getProtocols : (typeof getProtocols === 'function' ? getProtocols : null);
    if (!select || !getProtocolsFn) return;
    var list = getProtocolsFn();
    if (!Array.isArray(list)) list = [];
    select.innerHTML = '<option value="">— Выберите протокол —</option>';
    list.forEach(function (p) {
      var opt = document.createElement('option');
      opt.value = p.name || p.id;
      opt.textContent = p.name || 'Без названия';
      select.appendChild(opt);
    });
  }

  function renderProtocolDraft() {
    var host = document.getElementById('protocolBatchDraftTable');
    if (!host) return;
    if (!protocolDraft.length) {
      host.innerHTML = '<p class="action-batch-draft-empty">Добавьте коров по номеру.</p>';
      return;
    }
    var rows = protocolDraft.map(function (r) {
      return (
        '<tr data-row-id="' + r.id + '" class="action-batch-draft-row' + draftRowWarnClass(r) + '">' +
        '<td>' + escapeHtml(r.cattleId) + '</td>' +
        '<td><button type="button" class="action-batch-row-remove" data-proto-remove="' + r.id + '">×</button></td>' +
        '</tr>'
      );
    }).join('');
    host.innerHTML = '<table class="action-batch-table"><thead><tr><th>Номер</th><th></th></tr></thead><tbody>' + rows + '</tbody></table>';
    host.querySelectorAll('[data-proto-remove]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var id = btn.getAttribute('data-proto-remove');
        protocolDraft = protocolDraft.filter(function (x) { return x.id !== id; });
        renderProtocolDraft();
      });
    });
  }

  function addProtocolRow(cattleId) {
    if (protocolDraft.some(function (x) { return x.cattleId === cattleId; })) {
      toast('Уже в списке', 'error');
      return;
    }
    var ent = resolveEntryForAction(cattleId);
    var sel = document.getElementById('protocolSelectAssign');
    var protocolName = sel && sel.value ? sel.value.trim() : '';
    var startDate =
      (document.getElementById('protocolStartDateInput') && document.getElementById('protocolStartDateInput').value) || '';
    if (!protocolName) {
      toast('Выберите протокол', 'error');
      return;
    }
    if (!startDate) {
      toast('Укажите дату начала протокола', 'error');
      return;
    }
    var G = window.ActionInputGuards;
    var hadWarnings = !!(G && G.checkProtocolAssign && !G.checkProtocolAssign(ent, protocolName, startDate, {}).ok);
    var p =
      !G || typeof G.confirmProtocolAssignFlow !== 'function'
        ? Promise.resolve({ mode: 'apply' })
        : G.confirmProtocolAssignFlow(ent, protocolName, startDate);
    p.then(function (res) {
      if (!res || res.mode === 'cancel') return;
      protocolDraft.push({
        id: uid(),
        cattleId: cattleId,
        _batchGuardKey: batchGuardKey(startDate, protocolName),
        _batchGuardWarned: hadWarnings,
        _protocolModeAtAdd: res.mode
      });
      var addIn = document.getElementById('protocolBatchAddInput');
      if (addIn) addIn.value = '';
      renderProtocolDraft();
    });
  }

  function saveProtocolBatch() {
    var sel = document.getElementById('protocolSelectAssign');
    var protocolName = sel && sel.value ? sel.value.trim() : '';
    var startDate = document.getElementById('protocolStartDateInput') && document.getElementById('protocolStartDateInput').value;
    if (!protocolName) {
      toast('Выберите протокол', 'error');
      return;
    }
    if (!protocolDraft.length) {
      toast('Добавьте коров', 'error');
      return;
    }
    var applyP = typeof window.applyProtocolAssignToEntry === 'function' ? window.applyProtocolAssignToEntry : null;
    var clearP = typeof window.applyProtocolClearToEntry === 'function' ? window.applyProtocolClearToEntry : null;
    if (!applyP) return;
    var G = window.ActionInputGuards;
    var draft = protocolDraft.slice();
    var modes = {};
    var chain = Promise.resolve();
    draft.forEach(function (r) {
      chain = chain.then(function () {
        var ent = resolveEntryForAction(r.cattleId);
        if (!ent) return Promise.reject(new Error('Нет номера: ' + r.cattleId));
        if (!G || typeof G.confirmProtocolAssignFlow !== 'function') {
          modes[r.cattleId] = 'apply';
          return;
        }
        var gk = batchGuardKey(startDate || '', protocolName);
        if (r._batchGuardKey === gk && r._protocolModeAtAdd) {
          modes[r.cattleId] = r._protocolModeAtAdd;
          return;
        }
        return G.confirmProtocolAssignFlow(ent, protocolName, startDate || '').then(function (res) {
          if (!res || res.mode === 'cancel') return Promise.reject({ code: 'USER_CANCEL' });
          modes[r.cattleId] = res.mode;
        });
      });
    });
    chain
      .then(function () {
        var operations = draft.map(function (r) {
          return {
            cattleId: r.cattleId,
            apply: function (entry) {
              if (modes[r.cattleId] === 'replace_previous' && clearP) clearP(entry);
              applyP(entry, protocolName, startDate || '');
            }
          };
        });
        return runSequentialUpdates(operations);
      })
      .then(function () {
        protocolDraft = [];
        renderProtocolDraft();
        toast('Сохранено', 'success');
        if (typeof updateViewList === 'function') updateViewList();
        if (typeof window.navigateBackOrFallback === 'function') window.navigateBackOrFallback();
        else if (typeof navigate === 'function') navigate('menu');
      })
      .catch(function (err) {
        if (err && err.code === 'USER_CANCEL') return;
        toastSaveError(err, 'Ошибка');
      });
  }

  function initActionBatchProtocolScreen() {
    protocolDraft = [];
    fillProtocolSelectBatch();
    if (typeof window.ensureProtocolsLoaded === 'function') {
      window.ensureProtocolsLoaded(fillProtocolSelectBatch);
    }
    var startEl = document.getElementById('protocolStartDateInput');
    if (startEl) startEl.value = new Date().toISOString().slice(0, 10);
    if (typeof window.setupCattleAutocompleteFor === 'function') {
      window.setupCattleAutocompleteFor('protocolBatchAddInput', 'protocolBatchAddList', addProtocolRow);
    }
    if (window._prefillCattleId) {
      var a = document.getElementById('protocolBatchAddInput');
      if (a) a.value = window._prefillCattleId;
      delete window._prefillCattleId;
    }
    bindOnce(document.getElementById('protocolBatchSaveBtn'), 'click', saveProtocolBatch);
    renderProtocolDraft();
  }
  window.initActionBatchProtocolScreen = initActionBatchProtocolScreen;
})();

export {};
