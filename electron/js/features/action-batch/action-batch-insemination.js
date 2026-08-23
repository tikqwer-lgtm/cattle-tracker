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
  var findEntry = AB.findEntry;
  var resolveEntryForAction = AB.resolveEntryForAction;
  var toast = AB.toast;
  var toastSaveError = AB.toastSaveError;
  var uid = AB.uid;
  var bindOnce = AB.bindOnce;
  var openOverlay = AB.openOverlay;
  var closeTopModal = AB.closeTopModal;
  var refocusActiveActionBatchNumberInput = AB.refocusActiveActionBatchNumberInput;
  var runSequentialUpdates = AB.runSequentialUpdates;
  var batchGuardKey = AB.batchGuardKey;
  var draftRowWarnClass = AB.draftRowWarnClass;
  var clearRowBatchGuard = AB.clearRowBatchGuard;
  var escapeHtml = AB.escapeHtml;

  var insemDraft = [];

  function renderInsemDraft() {
    var host = document.getElementById('inseminationBatchDraftTable');
    if (!host) return;
    if (!insemDraft.length) {
      host.innerHTML = '';
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

  function nextAttemptForExisting(cattleId) {
    if (typeof window.getInseminationAttempt === 'function') return window.getInseminationAttempt(cattleId);
    var entry = findEntry(cattleId);
    if (!entry || !Array.isArray(entry.inseminationHistory)) return 1;
    return entry.inseminationHistory.length + 1;
  }

  function parseAttemptField(raw) {
    var s = String(raw == null ? '' : raw).trim();
    if (!s) return null;
    var n = parseInt(s, 10);
    return n >= 1 ? n : null;
  }

  function syncAttemptFromNumber() {
    var numEl = document.getElementById('inseminationBatchAddInput');
    var attEl = document.getElementById('inseminationAttemptInput');
    if (!numEl || !attEl) return;
    var cattleId = (numEl.value || '').trim();
    if (!cattleId || !findEntry(cattleId)) {
      attEl.value = '';
      return;
    }
    attEl.value = String(nextAttemptForExisting(cattleId));
  }

  function attemptForDraft(cattleId, fieldValue) {
    var fromField = parseAttemptField(fieldValue);
    if (fromField != null) return fromField;
    if (findEntry(cattleId)) return nextAttemptForExisting(cattleId);
    return null;
  }

  function attemptForSave(attemptNumber) {
    var n = parseInt(attemptNumber, 10);
    return n >= 1 ? n : 1;
  }

  function addGroupCattleId(cattleId) {
    var G = window.__inseminationGroup;
    if (!G) return;
    var rows = G.buildGroupDraftRows(
      [cattleId],
      insemDraft.map(function (x) { return x.cattleId; }),
      findEntry,
      {
        bull: (document.getElementById('bullInsemBatch') && document.getElementById('bullInsemBatch').value) || '',
        uid: uid
      }
    );
    if (!rows.length) {
      toast('Уже в списке или пустой номер', 'error');
      return false;
    }
    var insemDate = document.getElementById('inseminationDateInsem') && document.getElementById('inseminationDateInsem').value;
    if (insemDate && typeof validateDateNotFuture === 'function') {
      var dErr = validateDateNotFuture(insemDate, 'Дата осеменения');
      if (dErr) {
        toast(dErr, 'error');
        return false;
      }
    }
    rows.forEach(function (r) {
      insemDraft.push({
        id: r.id,
        cattleId: r.cattleId,
        attemptNumber: r.attemptNumber,
        bull: r.bull,
        _batchGuardKey: batchGuardKey(insemDate || '', ''),
        _batchGuardWarned: false
      });
    });
    renderInsemDraft();
    return true;
  }

  function openGroupAddOverlay() {
    openOverlay(
      '<h3 class="action-batch-modal-title">Групповой ввод</h3>' +
      '<label class="action-batch-modal-label">Номер<br><input type="text" id="insemGroupNum" class="action-batch-modal-input" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" /></label>' +
      '<div id="insemGroupLast" class="action-batch-modal-last" hidden>' +
      '<span><strong id="insemGroupLastNum"></strong></span>' +
      '<button type="button" class="action-batch-modal-last-del" id="insemGroupLastDel" title="Удалить" aria-label="Удалить последний номер">×</button>' +
      '</div>' +
      '<div class="action-batch-modal-actions">' +
      '<button type="button" class="action-batch-btn action-batch-btn-primary" id="insemGroupOk">Добавить</button>' +
      '<button type="button" class="action-batch-btn action-batch-btn-primary" id="insemGroupCancel">Сохранить все</button>' +
      '</div>'
    );
    var input = document.getElementById('insemGroupNum');
    var lastCattleId = null;
    var lastDraftRowId = null;
    var lastOrdinal = 0;

    function refreshLastUi() {
      var wrap = document.getElementById('insemGroupLast');
      var label = document.getElementById('insemGroupLastNum');
      if (!wrap || !label) return;
      if (!lastCattleId || !lastOrdinal) {
        wrap.hidden = true;
        label.textContent = '';
        return;
      }
      wrap.hidden = false;
      label.textContent = lastOrdinal + '. ' + lastCattleId;
    }

    function addOne() {
      var id = input && input.value ? String(input.value).trim() : '';
      if (!id) {
        toast('Укажите номер', 'error');
        return;
      }
      if (addGroupCattleId(id) && input) {
        lastCattleId = id;
        lastDraftRowId = null;
        lastOrdinal = 0;
        for (var i = insemDraft.length - 1; i >= 0; i--) {
          if (insemDraft[i].cattleId === id) {
            lastDraftRowId = insemDraft[i].id;
            lastOrdinal = i + 1;
            break;
          }
        }
        refreshLastUi();
        input.value = '';
        input.focus();
      }
    }

    function removeLast() {
      if (!lastDraftRowId && !lastCattleId) return;
      if (lastDraftRowId) {
        insemDraft = insemDraft.filter(function (x) { return x.id !== lastDraftRowId; });
      } else {
        for (var i = insemDraft.length - 1; i >= 0; i--) {
          if (insemDraft[i].cattleId === lastCattleId) {
            insemDraft.splice(i, 1);
            break;
          }
        }
      }
      lastDraftRowId = null;
      lastCattleId = null;
      lastOrdinal = 0;
      if (insemDraft.length) {
        var prev = insemDraft[insemDraft.length - 1];
        lastDraftRowId = prev.id;
        lastCattleId = prev.cattleId;
        lastOrdinal = insemDraft.length;
      }
      renderInsemDraft();
      refreshLastUi();
      if (input) input.focus();
    }

    var okBtn = document.getElementById('insemGroupOk');
    var cancelBtn = document.getElementById('insemGroupCancel');
    var delBtn = document.getElementById('insemGroupLastDel');
    if (okBtn) okBtn.addEventListener('click', addOne);
    if (delBtn) delBtn.addEventListener('click', removeLast);
    if (cancelBtn) {
      cancelBtn.addEventListener('click', function () {
        closeTopModal();
        saveInsemBatch();
      });
    }
    if (input) {
      input.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter') return;
        if (e.isComposing || e.keyCode === 229) return;
        e.preventDefault();
        addOne();
      });
      setTimeout(function () {
        try { input.focus(); } catch (e) {}
      }, 50);
    }
  }

  function addInsemFromForm() {
    var addIn = document.getElementById('inseminationBatchAddInput');
    var attIn = document.getElementById('inseminationAttemptInput');
    var cattleId = addIn && addIn.value ? String(addIn.value).trim() : '';
    if (!cattleId) {
      toast('Укажите номер', 'error');
      return;
    }
    if (insemDraft.some(function (x) { return x.cattleId === cattleId; })) {
      toast('Уже в списке', 'error');
      return;
    }
    var att = attemptForDraft(cattleId, attIn ? attIn.value : '');
    var bull = (document.getElementById('bullInsemBatch') && document.getElementById('bullInsemBatch').value) || '';
    var insemDate = document.getElementById('inseminationDateInsem') && document.getElementById('inseminationDateInsem').value;
    if (insemDate && typeof validateDateNotFuture === 'function') {
      var dErr = validateDateNotFuture(insemDate, 'Дата осеменения');
      if (dErr) {
        toast(dErr, 'error');
        return;
      }
    }
    var entry = resolveEntryForAction(cattleId);
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
      if (addIn) addIn.value = '';
      if (attIn) attIn.value = '';
      renderInsemDraft();
      refocusActiveActionBatchNumberInput();
    });
  }

  function editInsemRow(rowId) {
    var r = insemDraft.find(function (x) { return x.id === rowId; });
    if (!r) return;
    var attVal = r.attemptNumber != null ? r.attemptNumber : '';
    openOverlay(
      '<h3 class="action-batch-modal-title">' + escapeHtml(r.cattleId) + '</h3>' +
      '<label class="action-batch-modal-label">Попытка<br><input type="number" id="insemEdAtt" class="action-batch-modal-input" min="1" value="' + attVal + '" /></label>' +
      '<label class="action-batch-modal-label">Бык<br><input type="text" id="insemEdBull" class="action-batch-modal-input" list="datalist-farm-bulls" autocomplete="off" value="' + escapeHtml(r.bull || '') + '" /></label>' +
      '<div class="action-batch-modal-actions">' +
      '<button type="button" class="action-batch-btn action-batch-btn-primary" id="insemEdOk">OK</button>' +
      '<button type="button" class="action-batch-btn" id="insemEdCancel">Отмена</button>' +
      '</div>'
    );
    document.getElementById('insemEdOk').addEventListener('click', function () {
      r.attemptNumber = parseAttemptField(document.getElementById('insemEdAtt').value);
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
                attemptNumber: attemptForSave(r.attemptNumber),
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
        toastSaveError(err, 'Ошибка');
      });
  }

  function bindInseminationAddForm() {
    var addIn = document.getElementById('inseminationBatchAddInput');
    bindOnce(document.getElementById('inseminationBatchAddBtn'), 'click', addInsemFromForm);
    bindOnce(document.getElementById('inseminationGroupAddBtn'), 'click', openGroupAddOverlay);
    bindOnce(addIn, 'input', syncAttemptFromNumber);
    bindOnce(addIn, 'change', syncAttemptFromNumber);
    bindOnce(addIn, 'keydown', function (e) {
      if (e.key !== 'Enter') return;
      if (e.isComposing || e.keyCode === 229) return;
      e.preventDefault();
      addInsemFromForm();
    });
    bindOnce(document.getElementById('inseminationAttemptInput'), 'keydown', function (e) {
      if (e.key !== 'Enter') return;
      if (e.isComposing || e.keyCode === 229) return;
      e.preventDefault();
      addInsemFromForm();
    });
  }

  function initActionBatchInseminationScreen() {
    insemDraft = [];
    if (typeof AB.fillOperatorField === 'function') AB.fillOperatorField('inseminatorInsem');
    var dateEl = document.getElementById('inseminationDateInsem');
    if (dateEl) dateEl.value = new Date().toISOString().slice(0, 10);
    var attIn = document.getElementById('inseminationAttemptInput');
    if (attIn) attIn.value = '';
    bindInseminationAddForm();
    if (window._prefillCattleId) {
      var aPre = document.getElementById('inseminationBatchAddInput');
      if (aPre) aPre.value = window._prefillCattleId;
      delete window._prefillCattleId;
    }
    syncAttemptFromNumber();
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
      bindInseminationAddForm();
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
