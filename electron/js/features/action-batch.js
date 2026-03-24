/**
 * Пакетный ввод для экранов «Действия»: черновик, «Сохранить всё», API/local.
 */
(function () {
  'use strict';

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

  function closeTopModal() {
    var ex = document.querySelector('.action-batch-overlay');
    if (ex) ex.remove();
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
      if (e.target === wrap) closeTopModal();
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
        '<tr data-row-id="' + r.id + '" class="action-batch-draft-row">' +
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

  function escapeHtml(s) {
    if (s == null) return '';
    var d = document.createElement('div');
    d.textContent = String(s);
    return d.innerHTML;
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
      closeTopModal();
      renderUziDraft();
    });
    document.getElementById('uziEditCancel').addEventListener('click', closeTopModal);
  }

  function promptUziResultThenAdd(cattleId) {
    if (uziDraft.some(function (x) { return x.cattleId === cattleId; })) {
      toast('Эта корова уже в списке', 'error');
      return;
    }
    var entry = getEntries().find(function (e) { return e.cattleId === cattleId; });
    if (!entry) {
      toast('Корова не найдена', 'error');
      return;
    }
    openOverlay(
      '<h3 class="action-batch-modal-title">УЗИ: ' + escapeHtml(cattleId) + '</h3>' +
      '<p class="action-batch-modal-hint">Выберите результат</p>' +
      '<div class="action-batch-modal-actions action-batch-modal-actions--stack">' +
      '<button type="button" class="action-batch-btn action-batch-btn-primary" id="uziPickPregnant">Стельная</button>' +
      '<button type="button" class="action-batch-btn" id="uziPickOpen">Не стельная</button>' +
      '<button type="button" class="action-batch-btn" id="uziPickCancel">Отмена</button>' +
      '</div>'
    );
    function pick(result) {
      closeTopModal();
      if (!result) return;
      var uziDate = (document.getElementById('uziDateInput') && document.getElementById('uziDateInput').value) || '';
      var days = computeUziDays(entry, uziDate);
      uziDraft.push({ id: uid(), cattleId: cattleId, result: result, daysFromInsemination: days != null ? days : null });
      var addIn = document.getElementById('uziBatchAddInput');
      if (addIn) addIn.value = '';
      renderUziDraft();
    }
    document.getElementById('uziPickPregnant').addEventListener('click', function () { pick('Стельная'); });
    document.getElementById('uziPickOpen').addEventListener('click', function () { pick('Не стельная'); });
    document.getElementById('uziPickCancel').addEventListener('click', function () { pick(null); });
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
    var operations = [];
    uziDraft.forEach(function (r) {
      operations.push({
        cattleId: r.cattleId,
        apply: function (entry) {
          applyUzi(entry, {
            uziDate: uziDate,
            result: r.result,
            specialist: specialist,
            daysFromInsemination: r.daysFromInsemination
          });
        }
      });
    });
    runSequentialUpdates(operations)
      .then(function () {
        uziDraft = [];
        renderUziDraft();
        toast('Сохранено', 'success');
        if (typeof updateViewList === 'function') updateViewList();
        if (typeof window.navigateBackOrFallback === 'function') window.navigateBackOrFallback();
        else if (typeof navigate === 'function') navigate('menu');
      })
      .catch(function (err) {
        toast(err && err.message ? err.message : 'Ошибка сохранения', 'error');
      });
  }

  function initActionBatchUziScreen() {
    uziDraft = [];
    var spec = document.getElementById('uziSpecialistInput');
    if (spec && !spec.value.trim()) spec.value = defaultSpecialist();
    var dateEl = document.getElementById('uziDateInput');
    if (dateEl) dateEl.value = new Date().toISOString().slice(0, 10);
    if (typeof window.setupCattleAutocompleteFor === 'function') {
      window.setupCattleAutocompleteFor('uziBatchAddInput', 'uziBatchAddList', function (cid) {
        promptUziResultThenAdd(cid);
      });
    }
    if (window._prefillCattleId) {
      var a = document.getElementById('uziBatchAddInput');
      if (a) a.value = window._prefillCattleId;
      delete window._prefillCattleId;
    }
    bindOnce(document.getElementById('uziBatchSaveBtn'), 'click', saveUziBatch);
    bindOnce(dateEl, 'change', function () { renderUziDraft(); });
    bindOnce(dateEl, 'input', function () { renderUziDraft(); });
    renderUziDraft();
  }

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
        '<tr data-row-id="' + r.id + '" class="action-batch-draft-row">' +
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
    if (!getEntries().find(function (e) { return e.cattleId === cattleId; })) {
      toast('Корова не найдена', 'error');
      return;
    }
    dryDraft.push({ id: uid(), cattleId: cattleId });
    var addIn = document.getElementById('dryBatchAddInput');
    if (addIn) addIn.value = '';
    renderDryDraft();
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
    var operations = dryDraft.map(function (r) {
      return {
        cattleId: r.cattleId,
        apply: function (entry) { applyDry(entry, dryDate); }
      };
    });
    runSequentialUpdates(operations)
      .then(function () {
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
        '<tr data-row-id="' + r.id + '">' +
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
    if (!getEntries().find(function (e) { return e.cattleId === cattleId; })) {
      toast('Корова не найдена', 'error');
      return;
    }
    protocolDraft.push({ id: uid(), cattleId: cattleId });
    var addIn = document.getElementById('protocolBatchAddInput');
    if (addIn) addIn.value = '';
    renderProtocolDraft();
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
    if (!applyP) return;
    var operations = [];
    try {
      protocolDraft.forEach(function (r) {
        operations.push({
          cattleId: r.cattleId,
          apply: function (entry) { applyP(entry, protocolName, startDate || ''); }
        });
      });
    } catch (e) {
      toast(e && e.message ? e.message : 'Ошибка', 'error');
      return;
    }
    runSequentialUpdates(operations)
      .then(function () {
        protocolDraft = [];
        renderProtocolDraft();
        toast('Сохранено', 'success');
        if (typeof updateViewList === 'function') updateViewList();
        if (typeof window.navigateBackOrFallback === 'function') window.navigateBackOrFallback();
        else if (typeof navigate === 'function') navigate('menu');
      })
      .catch(function (err) {
        toast(err && err.message ? err.message : 'Ошибка', 'error');
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
        '<tr data-row-id="' + r.id + '" class="action-batch-draft-row">' +
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
    var entry = getEntries().find(function (e) { return e.cattleId === cattleId; });
    if (!entry) {
      toast('Корова не найдена', 'error');
      return;
    }
    var defAtt = nextAttemptFor(cattleId);
    var bullDef = (document.getElementById('bullInsemBatch') && document.getElementById('bullInsemBatch').value) || '';
    openOverlay(
      '<h3 class="action-batch-modal-title">Осеменение: ' + escapeHtml(cattleId) + '</h3>' +
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
      closeTopModal();
      insemDraft.push({ id: uid(), cattleId: cattleId, attemptNumber: att, bull: bull });
      var addIn = document.getElementById('inseminationBatchAddInput');
      if (addIn) addIn.value = '';
      renderInsemDraft();
    });
    document.getElementById('insemModalCancel').addEventListener('click', closeTopModal);
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
      closeTopModal();
      renderInsemDraft();
    });
    document.getElementById('insemEdCancel').addEventListener('click', closeTopModal);
  }

  function saveInsemBatch() {
    var insemDate = document.getElementById('inseminationDateInsem') && document.getElementById('inseminationDateInsem').value;
    var bullGlobal = (document.getElementById('bullInsemBatch') && document.getElementById('bullInsemBatch').value) || '';
    var inseminator = (document.getElementById('inseminatorInsem') && document.getElementById('inseminatorInsem').value) || '';
    var code = (document.getElementById('codeInsem') && document.getElementById('codeInsem').value) || '';
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
    var operations = [];
    try {
      insemDraft.forEach(function (r) {
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
    runSequentialUpdates(operations)
      .then(function () {
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

  function initActionBatchInseminationScreen() {
    insemDraft = [];
    var dateEl = document.getElementById('inseminationDateInsem');
    if (dateEl) dateEl.value = new Date().toISOString().slice(0, 10);
    // Как на экране УЗИ: сначала автодополнение по номеру, затем протоколы для «Код осеменения»
    if (typeof window.setupCattleAutocompleteFor === 'function') {
      window.setupCattleAutocompleteFor('inseminationBatchAddInput', 'inseminationBatchAddList', promptInsemRow);
    }
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
            focusAdd.focus({ preventScroll: false });
            focusAdd.scrollIntoView({ block: 'nearest', behavior: 'auto' });
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
      if (r.calfId && String(r.calfId).trim()) {
        sub =
          '<tr class="action-batch-calf-subrow"><td colspan="3">└ Телёнок: ' + escapeHtml(String(r.calfId)) +
          ', пол: ' + escapeHtml(r.calfSex || '—') +
          (r.calfWeight ? ', вес: ' + escapeHtml(String(r.calfWeight)) : '') +
          '</td></tr>';
      }
      return (
        '<tr data-row-id="' + r.id + '" class="action-batch-draft-row">' +
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
      onDone(out);
    });
    document.getElementById('calfCancel').addEventListener('click', function () {
      closeTopModal();
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
      calvingDraft.push({
        id: uid(),
        cattleId: cattleId,
        calfId: data.calfId || '',
        calfSex: data.calfSex || 'Телка',
        calfWeight: data.calfWeight || ''
      });
      var addIn = document.getElementById('calvingBatchAddInput');
      if (addIn) addIn.value = '';
      renderCalvingDraft();
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
    var chain = Promise.resolve();
    calvingDraft.forEach(function (r) {
      chain = chain.then(function () {
        var mother = getEntries().find(function (e) { return e.cattleId === r.cattleId; });
        if (!mother) return Promise.reject(new Error('Нет записи: ' + r.cattleId));
        var fatherBull = '';
        if (getLastRec) {
          var rec = getLastRec(mother, calvingDate);
          if (rec && rec.bull) fatherBull = rec.bull;
        }
        var calfEntry = null;
        if (r.calfId && String(r.calfId).trim()) {
          calfEntry = buildCalf(r.cattleId, calvingDate, String(r.calfId).trim(), r.calfSex, r.calfWeight, fatherBull);
        }
        try {
          applyCalve(mother, calvingDate);
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
    chain
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

  if (typeof window !== 'undefined') {
    window.initActionBatchUziScreen = initActionBatchUziScreen;
    window.initActionBatchDryScreen = initActionBatchDryScreen;
    window.initActionBatchCalvingScreen = initActionBatchCalvingScreen;
    window.initActionBatchProtocolScreen = initActionBatchProtocolScreen;
    window.initActionBatchInseminationScreen = initActionBatchInseminationScreen;
  }
})();

export {};
