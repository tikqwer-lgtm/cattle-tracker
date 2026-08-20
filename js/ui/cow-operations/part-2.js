/** __cowOps part 2 */
(function () {
  'use strict';
  var root = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this);
  var NS = root['__cowOps'] = root['__cowOps'] || {};
  var global = typeof window !== 'undefined' ? window : this;

function saveDryRunEntry() {
  var cattleId = document.getElementById('cattleIdDryInput').value.trim();
  var dryStartDate = document.getElementById('dryStartDateInput').value;
  if (!cattleId) {
    if (typeof showToast === 'function') showToast('Укажите номер коровы', 'error'); else alert('Укажите номер коровы');
    return;
  }
  var entry = entries.find(function (e) { return e.cattleId === cattleId; });
  if (!entry) {
    if (typeof showToast === 'function') showToast('Корова не найдена', 'error'); else alert('Корова не найдена');
    return;
  }
  var G = typeof window !== 'undefined' && window.ActionInputGuards;
  var afterSave = function () {
    if (typeof window !== 'undefined' && window.CATTLE_TRACKER_USE_API && typeof window.updateEntryViaApi === 'function') {
      window.updateEntryViaApi(cattleId, entry).then(function () {
        if (typeof loadLocally === 'function') return loadLocally();
      }).then(function () {
        if (typeof showToast === 'function') showToast('Сохранено', 'success');
        if (typeof updateViewList === 'function') updateViewList();
        if (window._returnToViewCow) { if (typeof navigate === 'function') navigate('view-cow'); if (typeof viewCow === 'function') viewCow(cattleId); window._returnToViewCow = null; } else if (typeof navigate === 'function') navigate('menu');
      }).catch(function (err) {
        if (typeof showToast === 'function') showToast(err && err.message ? err.message : 'Ошибка', 'error'); else alert(err && err.message ? err.message : 'Ошибка');
      });
      return;
    }
    saveLocally();
    if (typeof showToast === 'function') showToast('Сохранено', 'success');
    if (typeof updateViewList === 'function') updateViewList();
    if (window._returnToViewCow) { if (typeof navigate === 'function') navigate('view-cow'); if (typeof viewCow === 'function') viewCow(cattleId); window._returnToViewCow = null; } else if (typeof navigate === 'function') navigate('menu');
  };
  if (G && typeof G.confirmDryFlow === 'function') {
    G.confirmDryFlow(entry, dryStartDate).then(function (ok) {
      if (!ok) return;
      globalThis['__cowOps'].applyDryRunToEntry(entry, dryStartDate);
      afterSave();
    });
    return;
  }
  globalThis['__cowOps'].applyDryRunToEntry(entry, dryStartDate);
  afterSave();
}

/**
 * Обновляет запись: отёл (calvingDate). Архивирует текущую лактацию, инкрементирует номер, сбрасывает поля для новой лактации.
 */
function saveCalvingEntry() {
  var cattleId = document.getElementById('cattleIdCalvingInput').value.trim();
  var calvingDate = document.getElementById('calvingDateInput').value;
  if (!cattleId) {
    if (typeof showToast === 'function') showToast('Укажите номер коровы', 'error'); else alert('Укажите номер коровы');
    return;
  }
  var entry = entries.find(function (e) { return e.cattleId === cattleId; });
  if (!entry) {
    if (typeof showToast === 'function') showToast('Корова не найдена', 'error'); else alert('Корова не найдена');
    return;
  }
  var G = typeof window !== 'undefined' && window.ActionInputGuards;
  var doPersist = function () {
    if (typeof window !== 'undefined' && window.CATTLE_TRACKER_USE_API && typeof window.updateEntryViaApi === 'function') {
      window.updateEntryViaApi(cattleId, entry).then(function () {
        if (typeof loadLocally === 'function') return loadLocally();
      }).then(function () {
        if (typeof showToast === 'function') showToast('Сохранено', 'success');
        if (typeof updateViewList === 'function') updateViewList();
        if (window._returnToViewCow) { if (typeof navigate === 'function') navigate('view-cow'); if (typeof viewCow === 'function') viewCow(cattleId); window._returnToViewCow = null; } else if (typeof navigate === 'function') navigate('menu');
      }).catch(function (err) {
        if (typeof showToast === 'function') showToast(err && err.message ? err.message : 'Ошибка', 'error'); else alert(err && err.message ? err.message : 'Ошибка');
      });
      return;
    }
    saveLocally();
    if (typeof showToast === 'function') showToast('Сохранено', 'success');
    if (typeof updateViewList === 'function') updateViewList();
    if (window._returnToViewCow) { if (typeof navigate === 'function') navigate('view-cow'); if (typeof viewCow === 'function') viewCow(cattleId); window._returnToViewCow = null; } else if (typeof navigate === 'function') navigate('menu');
  };
  var applyOne = function (mode) {
    try {
      if (mode === 'abort') globalThis['__cowOps'].applyAbortToEntry(entry, calvingDate, '');
      else globalThis['__cowOps'].applyCalvingToEntry(entry, calvingDate);
    } catch (err) {
      var msg = err && err.message ? err.message : String(err);
      if (typeof showToast === 'function') showToast(msg, 'error'); else alert(msg);
      return;
    }
    doPersist();
  };
  if (G && typeof G.confirmCalvingFlow === 'function') {
    G.confirmCalvingFlow(entry, calvingDate).then(function (decision) {
      if (decision === 'cancel') return;
      applyOne(decision === 'abort' ? 'abort' : 'calve');
    });
    return;
  }
  applyOne('calve');
}

/**
 * Обновляет запись: поставить на протокол (protocol.name, protocol.startDate)
 */
function saveProtocolAssignEntry() {
  var cattleId = document.getElementById('cattleIdProtocolInput').value.trim();
  var protocolName = document.getElementById('protocolSelectAssign').value;
  var startDate = document.getElementById('protocolStartDateInput').value;
  if (!cattleId) {
    if (typeof showToast === 'function') showToast('Укажите номер коровы', 'error'); else alert('Укажите номер коровы');
    return;
  }
  if (!protocolName) {
    if (typeof showToast === 'function') showToast('Выберите протокол', 'error'); else alert('Выберите протокол');
    return;
  }
  var entry = entries.find(function (e) { return e.cattleId === cattleId; });
  if (!entry) {
    if (typeof showToast === 'function') showToast('Корова не найдена', 'error'); else alert('Корова не найдена');
    return;
  }
  var G = typeof window !== 'undefined' && window.ActionInputGuards;
  var afterSave = function () {
    if (typeof window !== 'undefined' && window.CATTLE_TRACKER_USE_API && typeof window.updateEntryViaApi === 'function') {
      window.updateEntryViaApi(cattleId, entry).then(function () {
        if (typeof loadLocally === 'function') return loadLocally();
      }).then(function () {
        if (typeof showToast === 'function') showToast('Сохранено', 'success');
        if (typeof updateViewList === 'function') updateViewList();
        if (window._returnToViewCow) { if (typeof navigate === 'function') navigate('view-cow'); if (typeof viewCow === 'function') viewCow(cattleId); window._returnToViewCow = null; } else if (typeof navigate === 'function') navigate('menu');
      }).catch(function (err) {
        if (typeof showToast === 'function') showToast(err && err.message ? err.message : 'Ошибка', 'error'); else alert(err && err.message ? err.message : 'Ошибка');
      });
      return;
    }
    saveLocally();
    if (typeof showToast === 'function') showToast('Сохранено', 'success');
    if (typeof updateViewList === 'function') updateViewList();
    if (window._returnToViewCow) { if (typeof navigate === 'function') navigate('view-cow'); if (typeof viewCow === 'function') viewCow(cattleId); window._returnToViewCow = null; } else if (typeof navigate === 'function') navigate('menu');
  };
  if (G && typeof G.confirmProtocolAssignFlow === 'function') {
    G.confirmProtocolAssignFlow(entry, protocolName, startDate).then(function (res) {
      if (!res || res.mode === 'cancel') return;
      try {
        if (res.mode === 'replace_previous') globalThis['__cowOps'].applyProtocolClearToEntry(entry);
        globalThis['__cowOps'].applyProtocolAssignToEntry(entry, protocolName, startDate);
      } catch (err2) {
        var msg2 = err2 && err2.message ? err2.message : String(err2);
        if (typeof showToast === 'function') showToast(msg2, 'error'); else alert(msg2);
        return;
      }
      afterSave();
    });
    return;
  }
  try {
    globalThis['__cowOps'].applyProtocolAssignToEntry(entry, protocolName, startDate);
  } catch (err) {
    var msgP = err && err.message ? err.message : String(err);
    if (typeof showToast === 'function') showToast(msgP, 'error'); else alert(msgP);
    return;
  }
  afterSave();
}

function initDryScreen() {
  if (typeof window.initActionBatchDryScreen === 'function') {
    window.initActionBatchDryScreen();
    return;
  }
  globalThis['__cowOps'].setupCattleAutocompleteFor('cattleIdDryInput', 'cattleIdDryList');
  if (window._prefillCattleId) {
    var el = document.getElementById('cattleIdDryInput');
    if (el) { el.value = window._prefillCattleId; delete window._prefillCattleId; }
  }
  var dateEl = document.getElementById('dryStartDateInput');
  if (dateEl) dateEl.value = new Date().toISOString().slice(0, 10);
}

function initCalvingScreen() {
  if (typeof window.initActionBatchCalvingScreen === 'function') {
    window.initActionBatchCalvingScreen();
    return;
  }
  globalThis['__cowOps'].setupCattleAutocompleteFor('cattleIdCalvingInput', 'cattleIdCalvingList');
  if (window._prefillCattleId) {
    var el = document.getElementById('cattleIdCalvingInput');
    if (el) { el.value = window._prefillCattleId; delete window._prefillCattleId; }
  }
  var dateEl = document.getElementById('calvingDateInput');
  if (dateEl) dateEl.value = new Date().toISOString().slice(0, 10);
}

function initProtocolAssignScreen() {
  if (typeof window.initActionBatchProtocolScreen === 'function') {
    window.initActionBatchProtocolScreen();
    return;
  }
  globalThis['__cowOps'].setupCattleAutocompleteFor('cattleIdProtocolInput', 'cattleIdProtocolList');
  var select = document.getElementById('protocolSelectAssign');
  var getProtocolsFn = typeof window.getProtocols === 'function' ? window.getProtocols : (typeof getProtocols === 'function' ? getProtocols : null);
  function fillProtocolSelect() {
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
  if (typeof window.ensureProtocolsLoaded === 'function') {
    window.ensureProtocolsLoaded(fillProtocolSelect);
  } else {
    globalThis['__cowOps'].fillProtocolSelect();
  }
  if (window._prefillCattleId) {
    var el = document.getElementById('cattleIdProtocolInput');
    if (el) { el.value = window._prefillCattleId; delete window._prefillCattleId; }
  }
}

function initAbortScreen() {
  if (typeof window.initActionBatchAbortScreen === 'function') {
    window.initActionBatchAbortScreen();
    return;
  }
  globalThis['__cowOps'].setupCattleAutocompleteFor('abortBatchAddInput', 'abortBatchAddList');
  if (window._prefillCattleId) {
    var el = document.getElementById('abortBatchAddInput');
    if (el) { el.value = window._prefillCattleId; delete window._prefillCattleId; }
  }
  var dateEl = document.getElementById('abortDateInput');
  if (dateEl) dateEl.value = new Date().toISOString().slice(0, 10);
}

/**
 * Возвращает дату последнего осеменения до указанной даты (строго до неё).
 */
function getLastInseminationDateBefore(entry, beforeDate) {
  if (!entry || !beforeDate) return null;
  var dates = [];
  if (entry.inseminationHistory && entry.inseminationHistory.length > 0) {
    entry.inseminationHistory.forEach(function (h) {
      if (h.date && String(h.date) < String(beforeDate)) dates.push(h.date);
    });
  } else if (entry.inseminationDate && String(entry.inseminationDate) < String(beforeDate)) {
    dates.push(entry.inseminationDate);
  }
  if (dates.length === 0) return null;
  return dates.reduce(function (a, b) { return a > b ? a : b; });
}

/**
 * Последняя запись осеменения строго до даты (для «Родитель О» при отёле).
 * @returns {{ date: string, bull: string }|null}
 */
function getLastInseminationRecordBefore(entry, beforeDate) {
  if (!entry || !beforeDate) return null;
  var best = null;
  if (entry.inseminationHistory && entry.inseminationHistory.length) {
    entry.inseminationHistory.forEach(function (h) {
      if (!h || !h.date || String(h.date) >= String(beforeDate)) return;
      if (!best || String(h.date) > String(best.date)) best = { date: h.date, bull: (h.bull || '').toString() };
    });
  }
  if (!best && entry.inseminationDate && String(entry.inseminationDate) < String(beforeDate)) {
    best = { date: entry.inseminationDate, bull: (entry.bull || '').toString() };
  }
  return best;
}

/**
 * Применяет УЗИ к записи (без сохранения на диск / API).
 * @returns {{ eventTypeUzi: string, detailsStr: string }}
 */
function applyUziToEntry(entry, payload) {
  var uziDate = payload.uziDate;
  var result = payload.result;
  var specialist = (payload.specialist || '').trim();
  var daysFromInsemination = payload.daysFromInsemination;
  if (!entry) throw new Error('Нет записи');
  if (!uziDate || !result) throw new Error('Нет даты или результата УЗИ');
  if (uziDate && typeof validateDateNotFuture === 'function') {
    var errUziVal = validateDateNotFuture(uziDate, 'Дата УЗИ');
    if (errUziVal) throw new Error(errUziVal);
  }
  if (!entry.uziHistory) entry.uziHistory = [];
  var statusBefore = (entry.status || '').toString();
  var hasInsem = statusBefore.indexOf('Осеменен') !== -1 ||
    (Array.isArray(entry.inseminationHistory) && entry.inseminationHistory.length > 0) ||
    !!(entry.inseminationDate);
  var eventTypeUzi = hasInsem
    ? (statusBefore.indexOf('Стельная') !== -1 ? 'УЗИ2' : 'УЗИ1')
    : (statusBefore.indexOf('Стельная') !== -1 ? 'УЗИ2' : 'УЗИ');
  var lastInsem = getLastInseminationDateBefore(entry, uziDate);
  var daysNum = null;
  if (daysFromInsemination != null && !isNaN(daysFromInsemination)) daysNum = daysFromInsemination;
  else if (lastInsem) {
    var d1 = new Date(lastInsem);
    var d2 = new Date(uziDate);
    if (!isNaN(d1.getTime()) && !isNaN(d2.getTime())) daysNum = Math.round((d2 - d1) / (24 * 60 * 60 * 1000));
  }
  entry.uziHistory.push({
    date: uziDate,
    result: result,
    specialist: specialist,
    daysFromInsemination: daysNum
  });
  if (result === 'Стельная') entry.status = 'Стельная';
  else if (result === 'Не стельная') entry.status = 'Холостая';
  /* Сомнительная: статус карточки не меняем (остаётся Осемененная). */
  entry.synced = false;
  var lastRec = entry.uziHistory[entry.uziHistory.length - 1];
  var detailsStr = 'Дата: ' + uziDate + ', ' + result + (specialist ? ', специалист: ' + specialist : '');
  if (lastRec.daysFromInsemination != null && lastRec.daysFromInsemination !== undefined) detailsStr += ', дней от осеменения: ' + lastRec.daysFromInsemination;
  var pushHistFn = (typeof window !== 'undefined' && window.pushActionHistory) ? window.pushActionHistory : (typeof pushActionHistory === 'function' ? pushActionHistory : null);
  if (pushHistFn) pushHistFn(entry, 'УЗИ', detailsStr, { eventType: eventTypeUzi, result: result, eventDate: uziDate });
  return { eventTypeUzi: eventTypeUzi, detailsStr: detailsStr };
}


  // register functions
  NS.saveDryRunEntry = saveDryRunEntry;
  NS.saveCalvingEntry = saveCalvingEntry;
  NS.saveProtocolAssignEntry = saveProtocolAssignEntry;
  NS.initDryScreen = initDryScreen;
  NS.initCalvingScreen = initCalvingScreen;
  NS.initProtocolAssignScreen = initProtocolAssignScreen;
  NS.initAbortScreen = initAbortScreen;
  NS.getLastInseminationDateBefore = getLastInseminationDateBefore;
  NS.getLastInseminationRecordBefore = getLastInseminationRecordBefore;
  NS.applyUziToEntry = applyUziToEntry;
})();
export {};
