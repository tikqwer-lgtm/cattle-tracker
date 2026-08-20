/**
 * Пакетный ввод — осеменение.
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
  var newAnimalHintHtml = AB.newAnimalHintHtml;
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

  // ——— Осеменение ———
  var insemDraft = [];

  function renderInsemDraft() {
    var host = document.getElementById('inseminationBatchDraftTable');
    if (!host) return;
    if (!insemDraft.length) {
      host.innerHTML = '<p class="action-batch-draft-empty">Добавьте коров; для каждой можно задать попытку.</p>';
      return;
    }
    var rows = insemDraft.map(function (r) {
      return (
        '<tr data-row-id="' + r.id + '" class="action-batch-draft-row' + draftRowWarnClass(r) + '">' +
        '<td>' + escapeHtml(r.cattleId) + '</td>' +
        '<td>' + escapeHtml(String(r.attemptNumber != null ? r.attemptNumber : '—')) + '</td>' +
        '<td>' + escapeHtml(r.bull || '—') + '</td>' +
        '<td><button type="button" class="action-batch-row-remove" data-insem-remove="' + r.id + '">×</button></td>' +
        '</tr>'
      );
    }).join('');
    host.innerHTML =
      '<table class="action-batch-table"><thead><tr><th>Номер</th><th>Попытка</th><th>Бык</th><th></th></tr></thead><tbody>' +
      rows + '</tbody></table>';
    host.querySelectorAll('[data-insem-remove]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var id = btn.getAttribute('data-insem-remove');
        insemDraft = insemDraft.filter(function (x) { return x.id !== id; });
        renderInsemDraft();
      });
    });
    host.querySelectorAll('tr.action-batch-draft-row').forEach(function (tr) {
      tr.addEventListener('click', function () {
        var id = tr.getAttribute('data-row-id');
        editInsemRow(id);
      });
    });
  }

  function nextAttemptFor(cattleId) {
    if (typeof window.getInseminationAttempt === 'function') return window.getInseminationAttempt(cattleId);
    var entry = getEntries().find(function (e) { return e.cattleId === cattleId; });
    if (!entry || !Array.isArray(entry.inseminationHistory)) return 1;
    return entry.inseminationHistory.length + 1;
  }

  function promptInsemRow(cattleId) {
    if (insemDraft.some(function (x) { return x.cattleId === cattleId; })) {
      toast('Уже в списке', 'error');
      return;
    }
    var entry = resolveEntryForAction(cattleId);
    var defAtt = nextAttemptFor(cattleId);
    var bullDef = (document.getElementById('bullInsemBatch') && document.getElementById('bullInsemBatch').value) || '';
    openOverlay(
      '<h3 class="action-batch-modal-title">Осеменение: ' + escapeHtml(cattleId) + '</h3>' +
      newAnimalHintHtml(cattleId) +
      '<label class="action-batch-modal-label">Попытка<br><input type="number" id="insemModalAttempt" class="action-batch-modal-input" min="1" value="' + defAtt + '" /></label>' +
      '<label class="action-batch-modal-label">Бык (необязательно, общий можно задать выше)<br>' +
      '<input type="text" id="insemModalBull" class="action-batch-modal-input" list="datalist-farm-bulls" autocomplete="off" value="' + escapeHtml(bullDef) + '" /></label>' +
      '<div class="action-batch-modal-actions">' +
      '<button type="button" class="action-batch-btn action-batch-btn-primary" id="insemModalOk">Добавить</button>' +
      '<button type="button" class="action-batch-btn" id="insemModalCancel">Отмена</button>' +
      '</div>'
    );
    document.getElementById('insemModalOk').addEventListener('click', function () {
      var att = parseInt(document.getElementById('insemModalAttempt').value, 10) || 1;
      var bull = document.getElementById('insemModalBull').value || '';
      var insemDate = document.getElementById('inseminationDateInsem') && document.getElementById('inseminationDateInsem').value;
      if (insemDate && typeof validateDateNotFuture === 'function') {
        var dErr = validateDateNotFuture(insemDate, 'Дата осеменения');
        if (dErr) {
          toast(dErr, 'error');
          return;
        }
      }
      closeTopModal();
      var G = window.ActionInputGuards;
      var hadWarnings = !!(G && G.checkInsemination && !G.checkInsemination(entry, insemDate, {}).ok);
      var p =
        !G || typeof G.confirmInseminationFlow !== 'function'
          ? Promise.resolve(true)
          : G.confirmInseminationFlow(entry, insemDate);
      p.then(function (ok) {
        if (!ok) {
          refocusActiveActionBatchNumberInput();
          return;
        }
        insemDraft.push({
          id: uid(),
          cattleId: cattleId,
          attemptNumber: att,
          bull: bull,
          _batchGuardKey: batchGuardKey(insemDate || '', ''),
          _batchGuardWarned: hadWarnings
        });
        var addIn = document.getElementById('inseminationBatchAddInput');
        if (addIn) addIn.value = '';
        renderInsemDraft();
        refocusActiveActionBatchNumberInput();
      });
    });
    document.getElementById('insemModalCancel').addEventListener('click', function () {
      closeTopModal();
      refocusActiveActionBatchNumberInput();
    });
  }

  function editInsemRow(rowId) {
    var r = insemDraft.find(function (x) { return x.id === rowId; });
    if (!r) return;
    openOverlay(
      '<h3 class="action-batch-modal-title">' + escapeHtml(r.cattleId) + '</h3>' +
      '<label class="action-batch-modal-label">Попытка<br><input type="number" id="insemEdAtt" class="action-batch-modal-input" min="1" value="' + (r.attemptNumber || 1) + '" /></label>' +
      '<label class="action-batch-modal-label">Бык<br><input type="text" id="insemEdBull" class="action-batch-modal-input" list="datalist-farm-bulls" autocomplete="off" value="' + escapeHtml(r.bull || '') + '" /></label>' +
      '<div class="action-batch-modal-actions">' +
      '<button type="button" class="action-batch-btn action-batch-btn-primary" id="insemEdOk">OK</button>' +
      '<button type="button" class="action-batch-btn" id="insemEdCancel">Отмена</button>' +
      '</div>'
    );
    document.getElementById('insemEdOk').addEventListener('click', function () {
      r.attemptNumber = parseInt(document.getElementById('insemEdAtt').value, 10) || 1;
      r.bull = document.getElementById('insemEdBull').value || '';
      clearRowBatchGuard(r);
      closeTopModal();
      renderInsemDraft();
      refocusActiveActionBatchNumberInput();
    });
    document.getElementById('insemEdCancel').addEventListener('click', function () {
      closeTopModal();
      refocusActiveActionBatchNumberInput();
    });
  }

  function saveInsemBatch() {
    var insemDate = document.getElementById('inseminationDateInsem') && document.getElementById('inseminationDateInsem').value;
    var bullGlobal = (document.getElementById('bullInsemBatch') && document.getElementById('bullInsemBatch').value) || '';
    var inseminator = (document.getElementById('inseminatorInsem') && document.getElementById('inseminatorInsem').value) || '';
    var codeEl = document.getElementById('codeInsem');
    var code = codeEl ? (codeEl.tagName === 'SELECT' ? codeEl.value : (codeEl.value || '')) : '';
    if (!insemDraft.length) {
      toast('Добавьте коров', 'error');
      return;
    }
    if (insemDate && typeof validateDateNotFuture === 'function') {
      var err = validateDateNotFuture(insemDate, 'Дата осеменения');
      if (err) {
        toast(err, 'error');
        return;
      }
    }
    var applyI = typeof window.applyInseminationToEntry === 'function' ? window.applyInseminationToEntry : null;
    if (!applyI) return;
    var G = window.ActionInputGuards;
    var draft = insemDraft.slice();
    var p = Promise.resolve(true);
    draft.forEach(function (r) {
      p = p.then(function (prev) {
        if (!prev) return false;
        var ent = resolveEntryForAction(r.cattleId);
        if (!ent) return false;
        if (!G || typeof G.confirmInseminationFlow !== 'function') return true;
        if (r._batchGuardKey === batchGuardKey(insemDate || '', '')) return true;
        return G.confirmInseminationFlow(ent, insemDate);
      });
    });
    p.then(function (ok) {
      if (!ok) return;
      var operations = [];
      try {
        draft.forEach(function (r) {
          operations.push({
            cattleId: r.cattleId,
            apply: function (entry) {
              applyI(entry, {
                inseminationDate: insemDate,
                attemptNumber: r.attemptNumber,
                bull: (r.bull || bullGlobal || '').trim(),
                inseminator: inseminator,
                code: code
              });
            }
          });
        });
      } catch (e) {
        toast(e && e.message ? e.message : 'Ошибка', 'error');
        return;
      }
      return runSequentialUpdates(operations);
    })
      .then(function (ran) {
        if (ran === undefined) return;
        insemDraft = [];
        renderInsemDraft();
        toast('Сохранено', 'success');
        if (typeof updateViewList === 'function') updateViewList();
        if (typeof window.navigateBackOrFallback === 'function') window.navigateBackOrFallback();
        else if (typeof navigate === 'function') navigate('menu');
      })
      .catch(function (err) {
        toast(err && err.message ? err.message : 'Ошибка', 'error');
      });
  }

  function bindInseminationBatchAutocomplete() {
    if (typeof window.setupCattleAutocompleteFor === 'function') {
      window.setupCattleAutocompleteFor('inseminationBatchAddInput', 'inseminationBatchAddList', promptInsemRow);
    } else {
      console.warn('[cattle-tracker] setupCattleAutocompleteFor не найден — поле номера на экране осеменения без подсказок');
    }
  }

  function initActionBatchInseminationScreen() {
    insemDraft = [];
    var dateEl = document.getElementById('inseminationDateInsem');
    if (dateEl) dateEl.value = new Date().toISOString().slice(0, 10);
    bindInseminationBatchAutocomplete();
    if (window._prefillCattleId) {
      var aPre = document.getElementById('inseminationBatchAddInput');
      if (aPre) aPre.value = window._prefillCattleId;
      delete window._prefillCattleId;
    }
    function focusInseminationNumberField() {
      var focusAdd = document.getElementById('inseminationBatchAddInput');
      var screen = document.getElementById('insemination-screen');
      if (!focusAdd || !screen || !screen.classList.contains('active')) return;
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          try {
            /* preventScroll + без scrollIntoView: в Electron/WebView иначе бывают «мёртвые» клики по полю до перерисовки (помогает только открытие DevTools). */
            focusAdd.focus({ preventScroll: true });
          } catch (e) {
            try {
              focusAdd.focus();
            } catch (e2) {}
          }
        });
      });
    }
    function scheduleInseminationFocus() {
      focusInseminationNumberField();
      setTimeout(focusInseminationNumberField, 80);
      setTimeout(focusInseminationNumberField, 220);
    }
    function afterProtocols() {
      if (typeof window.refreshFarmDatalists === 'function') window.refreshFarmDatalists();
      if (typeof window.fillAllInseminationCodeSelects === 'function') window.fillAllInseminationCodeSelects();
      bindInseminationBatchAutocomplete();
      scheduleInseminationFocus();
    }
    scheduleInseminationFocus();
    if (typeof window.ensureProtocolsLoaded === 'function') {
      window.ensureProtocolsLoaded(afterProtocols);
    } else {
      afterProtocols();
    }
    bindOnce(document.getElementById('inseminationBatchSaveBtn'), 'click', saveInsemBatch);
    renderInsemDraft();
  }
  window.initActionBatchInseminationScreen = initActionBatchInseminationScreen;
})();

export {};
