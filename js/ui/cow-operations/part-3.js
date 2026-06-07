/** __cowOps part 3 */
(function () {
  'use strict';
  var root = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this);
  var NS = root['__cowOps'] = root['__cowOps'] || {};
  var global = typeof window !== 'undefined' ? window : this;

function applyDryRunToEntry(entry, dryStartDate) {
  if (!entry) throw new Error('Нет записи');
  entry.dryStartDate = dryStartDate || '';
  entry.status = entry.status || '';
  if (dryStartDate && entry.status.indexOf('Сухостой') === -1) entry.status = 'Сухостой';
  entry.synced = false;
  if (dryStartDate) {
    var detailsStr = 'Дата запуска: ' + dryStartDate;
    var _pushHist = typeof pushActionHistory === 'function' ? pushActionHistory : window.pushActionHistory;
    if (typeof _pushHist === 'function') _pushHist(entry, 'Запуск в сухостой', detailsStr, { eventType: 'Запуск в сухостой' });
  }
}

function applyCalvingToEntry(entry, calvingDate) {
  if (!entry) throw new Error('Нет записи');
  if (calvingDate && typeof validateDateNotFuture === 'function') {
    var err = validateDateNotFuture(calvingDate, 'Дата отёла');
    if (err) throw new Error(err);
  }
  if (calvingDate) {
    if (typeof window.archiveCurrentLactation === 'function') window.archiveCurrentLactation(entry, calvingDate);
    var prevLact = parseInt(entry.lactation, 10);
    entry.lactation = (isNaN(prevLact) ? 0 : prevLact) + 1;
    var detailsStr = 'Дата отёла: ' + calvingDate;
    var _pushHist = typeof pushActionHistory === 'function' ? pushActionHistory : window.pushActionHistory;
    if (typeof _pushHist === 'function') _pushHist(entry, 'Отёл', detailsStr, { eventType: 'Отёл' });
    entry.inseminationDate = '';
    entry.attemptNumber = 1;
    entry.bull = '';
    entry.inseminator = '';
    entry.code = '';
    entry.inseminationHistory = [];
    entry.uziHistory = [];
    entry.dryStartDate = '';
    entry.protocol = entry.protocol && typeof entry.protocol === 'object' ? { name: '', startDate: '' } : { name: '', startDate: '' };
  }
  entry.calvingDate = calvingDate || '';
  if (calvingDate && entry.status !== 'Отёл') entry.status = 'Отёл';
  entry.synced = false;
}

function applyProtocolAssignToEntry(entry, protocolName, startDate) {
  if (!entry) throw new Error('Нет записи');
  if (!protocolName) throw new Error('Не выбран протокол');
  if (startDate && typeof validateDateNotFuture === 'function') {
    var errProto = validateDateNotFuture(startDate, 'Дата постановки на протокол');
    if (errProto) throw new Error(errProto);
  }
  if (!entry.protocol) entry.protocol = {};
  entry.protocol.name = protocolName;
  entry.protocol.startDate = startDate || '';
  entry.synced = false;
  var detailsStr = 'Протокол: ' + protocolName + (startDate ? ', начало: ' + startDate : '');
  var _pushHist = typeof pushActionHistory === 'function' ? pushActionHistory : window.pushActionHistory;
  if (typeof _pushHist === 'function') _pushHist(entry, 'Постановка на протокол', detailsStr, { eventType: 'Постановка на протокол', protocolName: protocolName });
}

function applyProtocolClearToEntry(entry) {
  if (!entry) throw new Error('Нет записи');
  if (!entry.protocol) entry.protocol = {};
  var oldName = String(entry.protocol.name || '').trim();
  entry.protocol.name = '';
  entry.protocol.startDate = '';
  entry.synced = false;
  var _pushClear = typeof pushActionHistory === 'function' ? pushActionHistory : window.pushActionHistory;
  if (oldName && typeof _pushClear === 'function') {
    _pushClear(entry, 'Снятие с протокола', 'Был протокол: ' + oldName, { eventType: 'Снятие с протокола', protocolName: oldName });
  }
}

function applyAbortToEntry(entry, abortDate, note) {
  if (!entry) throw new Error('Нет записи');
  if (abortDate && typeof validateDateNotFuture === 'function') {
    var errAb = validateDateNotFuture(abortDate, 'Дата аборта');
    if (errAb) throw new Error(errAb);
  }
  var st = (entry.status || '').toString();
  var detailsStr = 'Дата: ' + (abortDate || '') + (note ? ' — ' + note : '');
  var _pushA = typeof pushActionHistory === 'function' ? pushActionHistory : window.pushActionHistory;

  if (st.indexOf('Сухостой') !== -1) {
    applyCalvingToEntry(entry, abortDate || '');
    if (typeof _pushA === 'function') {
      _pushA(entry, 'Аборт', detailsStr + ' (после сухостоя, новая лактация)', { eventType: 'Аборт' });
    }
    return;
  }

  entry.status = 'Холостая';
  entry.inseminationDate = '';
  entry.attemptNumber = 1;
  entry.bull = '';
  entry.inseminator = '';
  entry.code = '';
  entry.inseminationHistory = [];
  entry.uziHistory = [];
  entry.dryStartDate = '';
  entry.protocol = { name: '', startDate: '' };
  entry.synced = false;
  if (typeof _pushA === 'function') {
    _pushA(entry, 'Аборт', detailsStr, { eventType: 'Аборт' });
  }
}

/**
 * Создаёт объект записи телёнка (ещё не в массиве entries).
 */
function buildCalfEntryFromCalving(motherId, calvingDate, calfId, calfSex, calfWeight, fatherBull) {
  var def = typeof getDefaultCowEntry === 'function' ? getDefaultCowEntry() : {};
  def.cattleId = String(calfId).trim();
  def.birthDate = calvingDate || '';
  def.status = (calfSex === 'Бык' || calfSex === 'бык') ? 'Бык' : 'Телка';
  def.parentMother = String(motherId).trim();
  def.parentFather = (fatherBull || '').toString();
  def.birthWeight = calfWeight != null && calfWeight !== '' ? String(calfWeight).trim() : '';
  def.lactation = '';
  def.nickname = '';
  def.calvingDate = '';
  def.inseminationDate = '';
  def.inseminationHistory = [];
  def.uziHistory = [];
  def.synced = false;
  if (typeof window.nowFormatted === 'function') def.dateAdded = window.nowFormatted();
  return def;
}

function updateUziDaysFromInsemination() {
  var cattleIdEl = document.getElementById('cattleIdUziInput');
  var dateEl = document.getElementById('uziDateInput');
  var outEl = document.getElementById('uziDaysFromInsemination');
  if (!cattleIdEl || !dateEl || !outEl) return;
  var cattleId = cattleIdEl.value.trim();
  var uziDate = dateEl.value;
  if (!cattleId || !uziDate) {
    outEl.value = '';
    outEl.placeholder = '—';
    return;
  }
  var entry = entries.find(function (e) { return e.cattleId === cattleId; });
  var lastInsem = entry ? globalThis['__cowOps'].getLastInseminationDateBefore(entry, uziDate) : null;
  if (!lastInsem) {
    outEl.value = '';
    outEl.placeholder = '—';
    return;
  }
  var d1 = new Date(lastInsem);
  var d2 = new Date(uziDate);
  if (isNaN(d1.getTime()) || isNaN(d2.getTime())) {
    outEl.value = '';
    outEl.placeholder = '—';
    return;
  }
  var days = Math.round((d2 - d1) / (24 * 60 * 60 * 1000));
  outEl.value = days >= 0 ? String(days) : '—';
}

function initUziScreen() {
  if (typeof window.initActionBatchUziScreen === 'function') {
    window.initActionBatchUziScreen();
    return;
  }
  globalThis['__cowOps'].setupCattleAutocompleteFor('cattleIdUziInput', 'cattleIdUziList');
  if (window._prefillCattleId) {
    var el = document.getElementById('cattleIdUziInput');
    if (el) { el.value = window._prefillCattleId; delete window._prefillCattleId; }
  }
  var dateInputUzi = document.getElementById('uziDateInput');
  if (dateInputUzi) dateInputUzi.value = new Date().toISOString().slice(0, 10);
  var cattleIdEl = document.getElementById('cattleIdUziInput');
  var dateEl = document.getElementById('uziDateInput');
  if (cattleIdEl) {
    cattleIdEl.removeEventListener('input', updateUziDaysFromInsemination);
    cattleIdEl.removeEventListener('change', updateUziDaysFromInsemination);
    cattleIdEl.addEventListener('input', updateUziDaysFromInsemination);
    cattleIdEl.addEventListener('change', updateUziDaysFromInsemination);
  }
  if (dateEl) {
    dateEl.removeEventListener('input', updateUziDaysFromInsemination);
    dateEl.removeEventListener('change', updateUziDaysFromInsemination);
    dateEl.addEventListener('input', updateUziDaysFromInsemination);
    dateEl.addEventListener('change', updateUziDaysFromInsemination);
  }
  updateUziDaysFromInsemination();
}

function saveUziEntry() {
  var cattleId = document.getElementById('cattleIdUziInput').value.trim();
  var uziDate = document.getElementById('uziDateInput').value;
  var result = document.getElementById('uziResultSelect').value;
  var specialist = document.getElementById('uziSpecialistInput').value.trim();
  var daysEl = document.getElementById('uziDaysFromInsemination');
  var daysFromInsemination = daysEl && daysEl.value !== '' ? parseInt(daysEl.value, 10) : null;

  if (!cattleId) {
    if (typeof showToast === 'function') showToast('Укажите номер коровы', 'error'); else alert('Укажите номер коровы');
    return;
  }
  if (!uziDate) {
    if (typeof showToast === 'function') showToast('Укажите дату проверки', 'error'); else alert('Укажите дату проверки');
    return;
  }
  if (typeof validateDateNotFuture === 'function') {
    var errUzi = validateDateNotFuture(uziDate, 'Дата УЗИ');
    if (errUzi) {
      if (typeof showToast === 'function') showToast(errUzi, 'error'); else alert(errUzi);
      return;
    }
  }
  if (!result) {
    if (typeof showToast === 'function') showToast('Выберите результат (Не стельная / Стельная)', 'error'); else alert('Выберите результат');
    return;
  }

  var entry = entries.find(function (e) { return e.cattleId === cattleId; });
  if (!entry) {
    if (typeof showToast === 'function') showToast('Корова не найдена', 'error'); else alert('Корова не найдена');
    return;
  }

  var G = typeof window !== 'undefined' && window.ActionInputGuards;
  var pushHistFn = (typeof window !== 'undefined' && window.pushActionHistory) ? window.pushActionHistory : (typeof pushActionHistory === 'function' ? pushActionHistory : null);

  var persistAfterUzi = function (applied) {
    var eventTypeUzi = applied.eventTypeUzi;
    var detailsStr = applied.detailsStr;
    if (typeof window !== 'undefined' && window.CATTLE_TRACKER_USE_API && typeof window.updateEntryViaApi === 'function') {
      window.updateEntryViaApi(cattleId, entry).then(function () {
        if (typeof loadLocally === 'function') return loadLocally();
      }).then(function () {
        var entryAfter = (typeof entries !== 'undefined' && entries && entries.find) ? entries.find(function (e) { return e.cattleId === cattleId; }) : null;
        if (entryAfter && pushHistFn) {
          var hasUzi = entryAfter.actionHistory && entryAfter.actionHistory.some(function (item) {
            return item.action === 'УЗИ' && item.details && item.details.indexOf(uziDate) !== -1;
          });
          if (!hasUzi) pushHistFn(entryAfter, 'УЗИ', detailsStr, { eventType: eventTypeUzi, result: result });
        }
        if (typeof showToast === 'function') showToast('Сохранено', 'success');
        if (typeof updateViewList === 'function') updateViewList();
        if (typeof navigate === 'function') navigate('view-cow');
        viewCow(cattleId);
      }).catch(function (err) {
        if (typeof showToast === 'function') showToast(err && err.message ? err.message : 'Ошибка', 'error'); else alert(err && err.message ? err.message : 'Ошибка');
      });
      return;
    }
    saveLocally();
    if (typeof showToast === 'function') showToast('Сохранено', 'success');
    if (typeof updateViewList === 'function') updateViewList();
    if (typeof navigate === 'function') navigate('view-cow');
    if (typeof viewCow === 'function') viewCow(cattleId);
  };

  var doApply = function () {
    try {
      return globalThis['__cowOps'].applyUziToEntry(entry, {
        uziDate: uziDate,
        result: result,
        specialist: specialist,
        daysFromInsemination: daysFromInsemination
      });
    } catch (errApply) {
      if (typeof showToast === 'function') showToast(errApply && errApply.message ? errApply.message : 'Ошибка', 'error'); else alert(errApply && errApply.message ? errApply.message : 'Ошибка');
      return null;
    }
  };

  if (G && typeof G.confirmUziFlow === 'function') {
    G.confirmUziFlow(entry, uziDate).then(function (ok) {
      if (!ok) return;
      var applied = doApply();
      if (applied) persistAfterUzi(applied);
    });
    return;
  }
  var appliedLegacy = doApply();
  if (appliedLegacy) persistAfterUzi(appliedLegacy);
}

// Делаем функции доступными глобально (для inline onsubmit/onclick в формах и карточке)

  // register functions
  NS.applyDryRunToEntry = applyDryRunToEntry;
  NS.applyCalvingToEntry = applyCalvingToEntry;
  NS.applyProtocolAssignToEntry = applyProtocolAssignToEntry;
  NS.applyProtocolClearToEntry = applyProtocolClearToEntry;
  NS.applyAbortToEntry = applyAbortToEntry;
  NS.buildCalfEntryFromCalving = buildCalfEntryFromCalving;
  NS.updateUziDaysFromInsemination = updateUziDaysFromInsemination;
  NS.initUziScreen = initUziScreen;
  NS.saveUziEntry = saveUziEntry;
})();
export {};
