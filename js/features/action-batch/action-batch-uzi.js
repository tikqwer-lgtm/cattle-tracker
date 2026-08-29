/**
 * Пакетный ввод — УЗИ.
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
  var fillOperatorField = AB.fillOperatorField;
  var confirmMissingAnimal = AB.confirmMissingAnimal;
  var escapeHtml = AB.escapeHtml;
  var batchGuardKey = AB.batchGuardKey;
  var draftRowWarnClass = AB.draftRowWarnClass;
  var clearRowBatchGuard = AB.clearRowBatchGuard;
  var bindNumberCollarPair = AB.bindNumberCollarPair;
  var applyDraftCollar = AB.applyDraftCollar;

  // ——— УЗИ ———
  var uziDraft = [];

  function renderUziDraft() {
    var host = document.getElementById('uziBatchDraftTable');
    if (!host) return;
    var uziDate = (document.getElementById('uziDateInput') && document.getElementById('uziDateInput').value) || '';
    if (!uziDraft.length) {
      host.innerHTML = '<p class="action-batch-draft-empty">Добавьте коров по номеру — после выбора укажите результат УЗИ.</p>';
      return;
    }
    var rows = uziDraft.map(function (r) {
      var entry = getEntries().find(function (e) { return e.cattleId === r.cattleId; });
      var days = r.daysFromInsemination != null ? r.daysFromInsemination : (entry && uziDate ? computeUziDays(entry, uziDate) : '—');
      return (
        '<tr data-row-id="' + r.id + '" class="action-batch-draft-row' + draftRowWarnClass(r) + '">' +
        '<td>' + escapeHtml(r.cattleId) + '</td>' +
        '<td>' + escapeHtml(r.result || '—') + '</td>' +
        '<td>' + escapeHtml(String(days)) + '</td>' +
        '<td><button type="button" class="action-batch-row-remove" data-remove="' + r.id + '" aria-label="Удалить">×</button></td>' +
        '</tr>'
      );
    }).join('');
    host.innerHTML =
      '<table class="action-batch-table"><thead><tr><th>Номер</th><th>Результат</th><th>Дней от осем.</th><th></th></tr></thead><tbody>' +
      rows + '</tbody></table>';
    host.querySelectorAll('[data-remove]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var id = btn.getAttribute('data-remove');
        uziDraft = uziDraft.filter(function (x) { return x.id !== id; });
        renderUziDraft();
      });
    });
    host.querySelectorAll('tr.action-batch-draft-row').forEach(function (tr) {
      tr.addEventListener('click', function () {
        var id = tr.getAttribute('data-row-id');
        editUziRow(id);
      });
    });
  }


  function editUziRow(rowId) {
    var r = uziDraft.find(function (x) { return x.id === rowId; });
    if (!r) return;
    var uziDate = (document.getElementById('uziDateInput') && document.getElementById('uziDateInput').value) || '';
    var entry = getEntries().find(function (e) { return e.cattleId === r.cattleId; });
    var defDays = r.daysFromInsemination != null ? r.daysFromInsemination : (entry && uziDate ? computeUziDays(entry, uziDate) : '');
    openOverlay(
      '<h3 class="action-batch-modal-title">Строка: ' + escapeHtml(r.cattleId) + '</h3>' +
      '<label class="action-batch-modal-label">Результат<br>' +
      '<select id="uziEditResult" class="action-batch-modal-input">' +
      '<option value="Стельная"' + (r.result === 'Стельная' ? ' selected' : '') + '>Стельная</option>' +
      '<option value="Не стельная"' + (r.result === 'Не стельная' ? ' selected' : '') + '>Не стельная</option>' +
      '<option value="Сомнительная"' + (r.result === 'Сомнительная' ? ' selected' : '') + '>Сомнительная</option>' +
      '</select></label>' +
      '<label class="action-batch-modal-label">Дней от осеменения (пусто — авто)<br>' +
      '<input type="number" id="uziEditDays" class="action-batch-modal-input" value="' + (defDays !== '' && defDays != null ? escapeHtml(String(defDays)) : '') + '" placeholder="Авто" /></label>' +
      '<div class="action-batch-modal-actions">' +
      '<button type="button" class="action-batch-btn action-batch-btn-primary" id="uziEditSave">OK</button>' +
      '<button type="button" class="action-batch-btn" id="uziEditCancel">Отмена</button>' +
      '</div>'
    );
    document.getElementById('uziEditSave').addEventListener('click', function () {
      r.result = document.getElementById('uziEditResult').value;
      var dEl = document.getElementById('uziEditDays');
      var dv = dEl && dEl.value !== '' ? parseInt(dEl.value, 10) : null;
      r.daysFromInsemination = dv != null && !isNaN(dv) ? dv : null;
      clearRowBatchGuard(r);
      closeTopModal();
      renderUziDraft();
      refocusActiveActionBatchNumberInput();
    });
    document.getElementById('uziEditCancel').addEventListener('click', function () {
      closeTopModal();
      refocusActiveActionBatchNumberInput();
    });
  }

  function daysFromDates(insemDate, uziDate) {
    if (!insemDate || !uziDate) return null;
    var d1 = new Date(insemDate);
    var d2 = new Date(uziDate);
    if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return null;
    var n = Math.round((d2 - d1) / (24 * 60 * 60 * 1000));
    return n >= 0 ? n : null;
  }

  function promptDoubtfulInsemInfo(uziDate, existingDays) {
    if (existingDays != null && !isNaN(existingDays)) return Promise.resolve(existingDays);
    return new Promise(function (resolve) {
      var wrap = openOverlay(
        '<h3 class="action-batch-modal-title">Сомнительная</h3>' +
        '<p class="action-batch-modal-hint">Укажите день от осеменения или дату осеменения (достаточно одного).</p>' +
        '<label class="action-batch-modal-label">Дней от осеменения<br>' +
        '<input type="number" id="uziDoubtDays" class="action-batch-modal-input" min="0" placeholder="Например 32" /></label>' +
        '<label class="action-batch-modal-label">Дата осеменения<br>' +
        '<input type="date" id="uziDoubtInsemDate" class="action-batch-modal-input" /></label>' +
        '<div class="action-batch-modal-actions">' +
        '<button type="button" class="action-batch-btn action-batch-btn-primary" id="uziDoubtOk">OK</button>' +
        '<button type="button" class="action-batch-btn" id="uziDoubtCancel">Отмена</button>' +
        '</div>'
      );
      var done = false;
      function finish(val) {
        if (done) return;
        done = true;
        closeTopModal();
        resolve(val);
      }
      document.getElementById('uziDoubtOk').addEventListener('click', function () {
        var daysEl = document.getElementById('uziDoubtDays');
        var dateEl = document.getElementById('uziDoubtInsemDate');
        var dv = daysEl && daysEl.value !== '' ? parseInt(daysEl.value, 10) : NaN;
        if (!isNaN(dv) && dv >= 0) {
          finish(dv);
          return;
        }
        var fromDate = daysFromDates(dateEl && dateEl.value, uziDate);
        if (fromDate != null) {
          finish(fromDate);
          return;
        }
        toast('Укажите день от осеменения или дату осеменения', 'error');
      });
      document.getElementById('uziDoubtCancel').addEventListener('click', function () { finish(false); });
      if (wrap) {
        wrap.addEventListener('click', function (e) {
          if (e.target === wrap) finish(false);
        });
      }
    });
  }

  function promptUziResultThenAdd(cattleId, collarVal) {
    var collar = String(collarVal == null ? '' : collarVal).trim();
    var colIn = document.getElementById('uziBatchCollarInput');
    if (!collar && colIn) collar = String(colIn.value || '').trim();
    if (window.CollarLookup && typeof window.CollarLookup.resolveCattleIdFromNumberOrCollar === 'function') {
      cattleId = window.CollarLookup.resolveCattleIdFromNumberOrCollar(cattleId, collar);
    }
    cattleId = String(cattleId || '').trim();
    if (!cattleId) {
      toast('Укажите номер или ошейник из базы', 'error');
      return;
    }
    if (!collar) {
      var knownUzi = getEntries().find(function (e) { return String(e.cattleId || '').trim() === cattleId; });
      if (knownUzi && knownUzi.collar) collar = String(knownUzi.collar).trim();
    }
    if (uziDraft.some(function (x) { return x.cattleId === cattleId; })) {
      toast('Эта корова уже в списке', 'error');
      return;
    }
    confirmMissingAnimal(cattleId).then(function (okAdd) {
      if (!okAdd) {
        refocusActiveActionBatchNumberInput();
        return;
      }
      var entry = resolveEntryForAction(cattleId);
      openOverlay(
        '<h3 class="action-batch-modal-title">УЗИ: ' + escapeHtml(cattleId) + '</h3>' +
        newAnimalHintHtml(cattleId) +
        '<p class="action-batch-modal-hint">Выберите результат</p>' +
        '<div class="action-batch-modal-actions action-batch-modal-actions--stack">' +
        '<button type="button" class="action-batch-btn action-batch-btn-primary" id="uziPickPregnant">Стельная</button>' +
        '<button type="button" class="action-batch-btn" id="uziPickOpen">Не стельная</button>' +
        '<button type="button" class="action-batch-btn" id="uziPickDoubtful">Сомнительная</button>' +
        '<button type="button" class="action-batch-btn" id="uziPickCancel">Отмена</button>' +
        '</div>'
      );
      function addRow(result, days, hadWarnings, uziDate) {
        uziDraft.push({
          id: uid(),
          cattleId: cattleId,
          collar: collar,
          result: result,
          daysFromInsemination: days != null ? days : null,
          _batchGuardKey: batchGuardKey(uziDate, ''),
          _batchGuardWarned: hadWarnings
        });
        var addIn = document.getElementById('uziBatchAddInput');
        if (addIn) addIn.value = '';
        if (colIn) colIn.value = '';
        renderUziDraft();
        refocusActiveActionBatchNumberInput();
      }
      function pick(result) {
        closeTopModal();
        if (!result) {
          refocusActiveActionBatchNumberInput();
          return;
        }
        var uziDate = (document.getElementById('uziDateInput') && document.getElementById('uziDateInput').value) || '';
        if (!uziDate) {
          toast('Укажите дату проверки', 'error');
          refocusActiveActionBatchNumberInput();
          return;
        }
        var G = window.ActionInputGuards;
        var hadWarnings = !!(G && G.checkUzi && !G.checkUzi(entry, uziDate, {}).ok);
        var p = !G || typeof G.confirmUziFlow !== 'function' ? Promise.resolve(true) : G.confirmUziFlow(entry, uziDate);
        p.then(function (ok) {
          if (!ok) {
            refocusActiveActionBatchNumberInput();
            return;
          }
          var days = computeUziDays(entry, uziDate);
          if (result !== 'Сомнительная') {
            addRow(result, days, hadWarnings, uziDate);
            return;
          }
          return promptDoubtfulInsemInfo(uziDate, days).then(function (doubtDays) {
            if (doubtDays === false) {
              refocusActiveActionBatchNumberInput();
              return;
            }
            addRow(result, doubtDays != null ? doubtDays : days, hadWarnings, uziDate);
          });
        });
      }
      document.getElementById('uziPickPregnant').addEventListener('click', function () { pick('Стельная'); });
      document.getElementById('uziPickOpen').addEventListener('click', function () { pick('Не стельная'); });
      document.getElementById('uziPickDoubtful').addEventListener('click', function () { pick('Сомнительная'); });
      document.getElementById('uziPickCancel').addEventListener('click', function () { pick(null); });
    });
  }

  function saveUziBatch() {
    var uziDate = document.getElementById('uziDateInput') && document.getElementById('uziDateInput').value;
    var specialist = (document.getElementById('uziSpecialistInput') && document.getElementById('uziSpecialistInput').value.trim()) || '';
    if (!uziDate) {
      toast('Укажите дату проверки', 'error');
      return;
    }
    if (!uziDraft.length) {
      toast('Добавьте хотя бы одну корову', 'error');
      return;
    }
    var applyUzi = typeof window.applyUziToEntry === 'function' ? window.applyUziToEntry : null;
    if (!applyUzi) {
      toast('Ошибка: нет applyUziToEntry', 'error');
      return;
    }
    var G = window.ActionInputGuards;
    var draft = uziDraft.slice();
    var p = Promise.resolve(true);
    draft.forEach(function (r) {
      p = p.then(function (prev) {
        if (!prev) return false;
        var ent = resolveEntryForAction(r.cattleId);
        if (!ent) return false;
        if (!G || typeof G.confirmUziFlow !== 'function') return true;
        if (r._batchGuardKey === batchGuardKey(uziDate, '')) return true;
        return G.confirmUziFlow(ent, uziDate);
      });
    });
    p.then(function (ok) {
      if (!ok) return;
      var operations = [];
      draft.forEach(function (r) {
        operations.push({
          cattleId: r.cattleId,
          apply: function (entry) {
            applyUzi(entry, {
              uziDate: uziDate,
              result: r.result,
              specialist: specialist,
              daysFromInsemination: r.daysFromInsemination
            });
            if (typeof applyDraftCollar === 'function') applyDraftCollar(entry, r.collar);
          }
        });
      });
      return runSequentialUpdates(operations);
    })
      .then(function (ran) {
        if (ran === undefined) return;
        uziDraft = [];
        renderUziDraft();
        toast('Сохранено', 'success');
        if (typeof updateViewList === 'function') updateViewList();
        if (typeof window.navigateBackOrFallback === 'function') window.navigateBackOrFallback();
        else if (typeof navigate === 'function') navigate('menu');
      })
      .catch(function (err) {
        toastSaveError(err, 'Ошибка сохранения');
      });
  }

  function initActionBatchUziScreen() {
    uziDraft = [];
    if (typeof fillOperatorField === 'function') fillOperatorField('uziSpecialistInput');
    else {
      var spec = document.getElementById('uziSpecialistInput');
      if (spec && !spec.value.trim()) spec.value = defaultSpecialist();
    }
    var dateEl = document.getElementById('uziDateInput');
    if (dateEl) dateEl.value = new Date().toISOString().slice(0, 10);
    if (typeof window.setupCattleAutocompleteFor === 'function') {
      window.setupCattleAutocompleteFor('uziBatchAddInput', 'uziBatchAddList', function (cid) {
        var col = document.getElementById('uziBatchCollarInput');
        promptUziResultThenAdd(cid, col ? col.value : '');
      });
    }
    if (typeof bindNumberCollarPair === 'function') {
      bindNumberCollarPair('uziBatchAddInput', 'uziBatchCollarInput');
    }
    var colEl = document.getElementById('uziBatchCollarInput');
    bindOnce(colEl, 'keydown', function (e) {
      if (e.key !== 'Enter') return;
      if (e.isComposing || e.keyCode === 229) return;
      e.preventDefault();
      var num = document.getElementById('uziBatchAddInput');
      promptUziResultThenAdd(num ? num.value : '', colEl.value);
    });
    if (window._prefillCattleId) {
      var a = document.getElementById('uziBatchAddInput');
      if (a) a.value = window._prefillCattleId;
      var colP = document.getElementById('uziBatchCollarInput');
      var foundP = getEntries().find(function (e) { return String(e.cattleId || '').trim() === String(window._prefillCattleId); });
      if (colP && foundP) colP.value = foundP.collar || '';
      delete window._prefillCattleId;
    }
    bindOnce(document.getElementById('uziBatchSaveBtn'), 'click', saveUziBatch);
    bindOnce(dateEl, 'change', function () { renderUziDraft(); });
    bindOnce(dateEl, 'input', function () { renderUziDraft(); });
    renderUziDraft();
  }
  window.initActionBatchUziScreen = initActionBatchUziScreen;
})();

export {};
