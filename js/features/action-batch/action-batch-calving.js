/**
 * Пакетный ввод — отёл.
 */
(function () {
  'use strict';
  var AB = window.__actionBatch;
  if (!AB) {
    console.error('[action-batch] сначала загрузите action-batch-core.js');
    return;
  }
  var getEntries = AB.getEntries;
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

  // ——— Отёл ———
  var calvingDraft = [];

  function renderCalvingDraft() {
    var host = document.getElementById('calvingBatchDraftTable');
    if (!host) return;
    if (!calvingDraft.length) {
      host.innerHTML = '<p class="action-batch-draft-empty">Добавьте коров; при необходимости укажите данные телёнка.</p>';
      return;
    }
    var rows = calvingDraft.map(function (r) {
      var sub = '';
      var subWarn = r._batchGuardWarned ? ' action-batch-draft-row--guard-warn' : '';
      if (r.calfId && String(r.calfId).trim()) {
        sub =
          '<tr class="action-batch-calf-subrow' + subWarn + '"><td colspan="3">└ Телёнок: ' + escapeHtml(String(r.calfId)) +
          ', пол: ' + escapeHtml(r.calfSex || '—') +
          (r.calfWeight ? ', вес: ' + escapeHtml(String(r.calfWeight)) : '') +
          '</td></tr>';
      }
      return (
        '<tr data-row-id="' + r.id + '" class="action-batch-draft-row' + draftRowWarnClass(r) + '">' +
        '<td>' + escapeHtml(r.cattleId) + '</td>' +
        '<td>' + (r.calfId && String(r.calfId).trim() ? escapeHtml(String(r.calfId)) : '—') + '</td>' +
        '<td><button type="button" class="action-batch-row-remove" data-calve-remove="' + r.id + '">×</button></td>' +
        '</tr>' + sub
      );
    }).join('');
    host.innerHTML =
      '<table class="action-batch-table"><thead><tr><th>Мать</th><th>Телёнок</th><th></th></tr></thead><tbody>' +
      rows + '</tbody></table>';
    host.querySelectorAll('[data-calve-remove]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var id = btn.getAttribute('data-calve-remove');
        calvingDraft = calvingDraft.filter(function (x) { return x.id !== id; });
        renderCalvingDraft();
      });
    });
    host.querySelectorAll('tr.action-batch-draft-row').forEach(function (tr) {
      tr.addEventListener('click', function () {
        var id = tr.getAttribute('data-row-id');
        editCalvingRow(id);
      });
    });
  }

  function showCalfModal(initial, onDone) {
    openOverlay(
      '<h3 class="action-batch-modal-title">Телёнок (необязательно)</h3>' +
      '<p class="action-batch-modal-hint">Оставьте номер пустым, если телёнка не вносим в базу.</p>' +
      '<label class="action-batch-modal-label">Номер телёнка<br>' +
      '<input type="text" id="calfIdInp" class="action-batch-modal-input" value="' + escapeHtml(initial.calfId || '') + '" /></label>' +
      '<label class="action-batch-modal-label">Пол<br>' +
      '<select id="calfSexInp" class="action-batch-modal-input">' +
      '<option value="Телка"' + (initial.calfSex !== 'Бык' ? ' selected' : '') + '>Телка</option>' +
      '<option value="Бык"' + (initial.calfSex === 'Бык' ? ' selected' : '') + '>Бык</option>' +
      '</select></label>' +
      '<label class="action-batch-modal-label">Вес при рождении (кг, необяз.)<br>' +
      '<input type="text" id="calfWeightInp" class="action-batch-modal-input" value="' + escapeHtml(initial.calfWeight || '') + '" /></label>' +
      '<div class="action-batch-modal-actions">' +
      '<button type="button" class="action-batch-btn action-batch-btn-primary" id="calfOk">OK</button>' +
      '<button type="button" class="action-batch-btn" id="calfCancel">Отмена</button>' +
      '</div>'
    );
    document.getElementById('calfOk').addEventListener('click', function () {
      var out = {
        calfId: (document.getElementById('calfIdInp').value || '').trim(),
        calfSex: document.getElementById('calfSexInp').value,
        calfWeight: (document.getElementById('calfWeightInp').value || '').trim()
      };
      closeTopModal();
      refocusActiveActionBatchNumberInput();
      onDone(out);
    });
    document.getElementById('calfCancel').addEventListener('click', function () {
      closeTopModal();
      refocusActiveActionBatchNumberInput();
      onDone(null);
    });
  }

  function promptCalvingAdd(cattleId) {
    if (calvingDraft.some(function (x) { return x.cattleId === cattleId; })) {
      toast('Уже в списке', 'error');
      return;
    }
    if (!getEntries().find(function (e) { return e.cattleId === cattleId; })) {
      toast('Корова не найдена', 'error');
      return;
    }
    showCalfModal({ calfId: '', calfSex: 'Телка', calfWeight: '' }, function (data) {
      if (data === null) return;
      var calvingDate = document.getElementById('calvingDateInput') && document.getElementById('calvingDateInput').value;
      if (!calvingDate) {
        toast('Укажите дату отёла', 'error');
        return;
      }
      var mother = getEntries().find(function (e) { return e.cattleId === cattleId; });
      if (!mother) {
        toast('Корова не найдена', 'error');
        return;
      }
      var G = window.ActionInputGuards;
      var hadWarnings = !!(G && G.checkCalving && !G.checkCalving(mother, calvingDate, {}).ok);
      var p =
        !G || typeof G.confirmCalvingFlow !== 'function'
          ? Promise.resolve('calve')
          : G.confirmCalvingFlow(mother, calvingDate);
      p.then(function (dec) {
        if (dec === 'cancel') return;
        var intent = dec === 'abort' ? 'abort' : 'calve';
        calvingDraft.push({
          id: uid(),
          cattleId: cattleId,
          calfId: data.calfId || '',
          calfSex: data.calfSex || 'Телка',
          calfWeight: data.calfWeight || '',
          _batchGuardKey: batchGuardKey(calvingDate, ''),
          _batchGuardWarned: hadWarnings,
          _calvingIntentAtAdd: intent
        });
        var addIn = document.getElementById('calvingBatchAddInput');
        if (addIn) addIn.value = '';
        renderCalvingDraft();
      });
    });
  }

  function editCalvingRow(rowId) {
    var r = calvingDraft.find(function (x) { return x.id === rowId; });
    if (!r) return;
    showCalfModal(
      { calfId: r.calfId, calfSex: r.calfSex || 'Телка', calfWeight: r.calfWeight },
      function (data) {
        if (data === null) return;
        r.calfId = data.calfId || '';
        r.calfSex = data.calfSex || 'Телка';
        r.calfWeight = data.calfWeight || '';
        clearRowBatchGuard(r);
        renderCalvingDraft();
      }
    );
  }

  function saveCalvingBatch() {
    var calvingDate = document.getElementById('calvingDateInput') && document.getElementById('calvingDateInput').value;
    if (!calvingDate) {
      toast('Укажите дату отёла', 'error');
      return;
    }
    if (!calvingDraft.length) {
      toast('Добавьте коров', 'error');
      return;
    }
    var applyCalve = typeof window.applyCalvingToEntry === 'function' ? window.applyCalvingToEntry : null;
    var buildCalf = typeof window.buildCalfEntryFromCalving === 'function' ? window.buildCalfEntryFromCalving : null;
    var getLastRec = typeof window.getLastInseminationRecordBefore === 'function' ? window.getLastInseminationRecordBefore : null;
    if (!applyCalve || !buildCalf) return;

    var calvesToCreate = [];
    var duplicateCalf = null;
    calvingDraft.forEach(function (r) {
      if (r.calfId && String(r.calfId).trim()) {
        var exists = getEntries().some(function (e) { return e.cattleId === String(r.calfId).trim(); });
        if (exists) duplicateCalf = r.calfId;
      }
    });
    if (duplicateCalf) {
      toast('Номер телёнка уже есть в базе: ' + duplicateCalf, 'error');
      return;
    }

    var useApi = typeof window !== 'undefined' && window.CATTLE_TRACKER_USE_API && typeof window.updateEntryViaApi === 'function';
    var applyAbort = typeof window.applyAbortToEntry === 'function' ? window.applyAbortToEntry : null;
    var G = window.ActionInputGuards;
    var draft = calvingDraft.slice();
    var confirmChain = Promise.resolve();
    draft.forEach(function (r) {
      confirmChain = confirmChain.then(function () {
        var mother = getEntries().find(function (e) { return e.cattleId === r.cattleId; });
        if (!mother) return Promise.reject(new Error('Нет записи: ' + r.cattleId));
        if (!G || typeof G.confirmCalvingFlow !== 'function') {
          r._calvingDecision = 'calve';
          return;
        }
        if (r._batchGuardKey === batchGuardKey(calvingDate, '') && r._calvingIntentAtAdd) {
          r._calvingDecision = r._calvingIntentAtAdd;
          return;
        }
        return G.confirmCalvingFlow(mother, calvingDate).then(function (dec) {
          if (dec === 'cancel') return Promise.reject({ code: 'USER_CANCEL' });
          r._calvingDecision = dec === 'abort' ? 'abort' : 'calve';
        });
      });
    });
    confirmChain
      .then(function () {
        var chain = Promise.resolve();
        draft.forEach(function (r) {
          chain = chain.then(function () {
            var mother = getEntries().find(function (e) { return e.cattleId === r.cattleId; });
            if (!mother) return Promise.reject(new Error('Нет записи: ' + r.cattleId));
            var dec = r._calvingDecision || 'calve';
            var fatherBull = '';
            if (getLastRec) {
              var rec = getLastRec(mother, calvingDate);
              if (rec && rec.bull) fatherBull = rec.bull;
            }
            var calfEntry = null;
            if (dec !== 'abort' && r.calfId && String(r.calfId).trim()) {
              calfEntry = buildCalf(r.cattleId, calvingDate, String(r.calfId).trim(), r.calfSex, r.calfWeight, fatherBull);
            }
            try {
              if (dec === 'abort' && applyAbort) applyAbort(mother, calvingDate, '');
              else applyCalve(mother, calvingDate);
            } catch (err) {
              return Promise.reject(err);
            }
            if (!useApi) {
              if (calfEntry) getEntries().push(calfEntry);
              return Promise.resolve();
            }
            return window.updateEntryViaApi(r.cattleId, mother).then(function () {
              if (calfEntry) return window.createEntryViaApi(calfEntry);
            });
          });
        });
        return chain;
      })
      .then(function () {
        if (!useApi && typeof saveLocally === 'function') saveLocally();
        calvingDraft = [];
        renderCalvingDraft();
        toast('Сохранено', 'success');
        if (typeof updateViewList === 'function') updateViewList();
        if (typeof window.navigateBackOrFallback === 'function') window.navigateBackOrFallback();
        else if (typeof navigate === 'function') navigate('menu');
      })
      .catch(function (err) {
        if (err && err.code === 'USER_CANCEL') return;
        toast(err && err.message ? err.message : 'Ошибка', 'error');
      });
  }

  function initActionBatchCalvingScreen() {
    calvingDraft = [];
    var dateEl = document.getElementById('calvingDateInput');
    if (dateEl) dateEl.value = new Date().toISOString().slice(0, 10);
    if (typeof window.setupCattleAutocompleteFor === 'function') {
      window.setupCattleAutocompleteFor('calvingBatchAddInput', 'calvingBatchAddList', promptCalvingAdd);
    }
    if (window._prefillCattleId) {
      var a = document.getElementById('calvingBatchAddInput');
      if (a) a.value = window._prefillCattleId;
      delete window._prefillCattleId;
    }
    bindOnce(document.getElementById('calvingBatchSaveBtn'), 'click', saveCalvingBatch);
    renderCalvingDraft();
  }
  window.initActionBatchCalvingScreen = initActionBatchCalvingScreen;
})();

export {};
