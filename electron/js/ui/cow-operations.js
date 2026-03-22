// cow-operations.js — Операции с записями коров

/**
 * Редактирует существующую запись
 * @param {string} cattleId - Номер коровы
 */
function editEntry(cattleId) {
  const entry = entries.find(e => e.cattleId === cattleId);
  if (!entry) {
    if (typeof showToast === 'function') showToast('Запись не найдена!', 'error'); else alert('Запись не найдена!');
    return;
  }

  // Устанавливаем режим редактирования
  window.currentEditingId = entry.cattleId;

  var clearBtn = document.getElementById('clearFormButton');
  if (clearBtn) clearBtn.style.display = 'none';

  // Обновляем заголовок экрана
  const titleElement = document.getElementById('addScreenTitle');
  if (titleElement) {
    titleElement.textContent = '✏️ Редактирование коровы ' + entry.cattleId;
  }

  // Заполняем форму данными из записи
  fillFormFromCowEntry(entry);

  // Переключаемся на экран добавления/редактирования
  if (typeof navigate === 'function') {
    navigate('add');
  }
}

/**
 * Удаляет запись
 * @param {string} cattleId - Номер коровы
 */
function deleteEntry(cattleId) {
  var doDelete = function () {
    var useApi = typeof window !== 'undefined' && window.CATTLE_TRACKER_USE_API && typeof window.deleteEntryViaApi === 'function';
    if (useApi) {
      window.deleteEntryViaApi(cattleId).then(function () {
        updateList();
        if (typeof updateViewList === 'function') updateViewList();
        if (typeof showToast === 'function') showToast('Запись удалена', 'success'); else alert('Запись удалена');
      }).catch(function (err) {
        if (typeof showToast === 'function') showToast(err && err.message ? err.message : 'Ошибка удаления', 'error'); else alert(err && err.message ? err.message : 'Ошибка удаления');
      });
      return;
    }
    var index = entries.findIndex(function (e) { return e.cattleId === cattleId; });
    if (index !== -1) {
      entries.splice(index, 1);
      saveLocally();
      updateList();
      if (typeof updateViewList === 'function') updateViewList();
      if (typeof showToast === 'function') showToast('Запись удалена', 'success'); else alert('Запись удалена');
    } else {
      if (typeof showToast === 'function') showToast('Запись не найдена!', 'error'); else alert('Запись не найдена!');
    }
  };
  if (typeof showConfirmModal === 'function') {
    showConfirmModal('Удалить запись о корове ' + cattleId + '?').then(function (ok) { if (ok) doDelete(); });
    return;
  }
  if (!confirm('Удалить запись о корове ' + cattleId + '?')) return;
  doDelete();
}

/**
 * Удаляет выделенные записи
 */
function deleteSelectedEntries() {
  var selectedCattleIds = typeof window.getSelectedCattleIds === 'function'
    ? window.getSelectedCattleIds()
    : Array.prototype.map.call(document.querySelectorAll('.entry-checkbox:checked'), function (checkbox) {
        return checkbox.getAttribute('data-cattle-id');
      });
  if (!selectedCattleIds || selectedCattleIds.length === 0) {
    if (typeof showToast === 'function') showToast('Нет выделенных записей для удаления', 'info'); else alert('Нет выделенных записей для удаления');
    return;
  }
  var count = selectedCattleIds.length;
  var confirmMessage = 'Вы уверены, что хотите удалить ' + count + (count === 1 ? ' запись' : count < 5 ? ' записи' : ' записей') + '?';
  var doDeleteSelected = function () {
    var useApi = typeof window !== 'undefined' && window.CATTLE_TRACKER_USE_API && window.CattleTrackerApi && typeof window.loadLocally === 'function';
    if (useApi) {
      var objectId = typeof getCurrentObjectId === 'function' ? getCurrentObjectId() : 'default';
      var promises = selectedCattleIds.map(function (id) {
        return window.CattleTrackerApi.deleteEntry(objectId, id);
      });
      Promise.all(promises).then(function () {
        return window.loadLocally();
      }).then(function () {
        updateList();
        if (typeof updateViewList === 'function') updateViewList();
        if (typeof updateHerdStats === 'function') updateHerdStats();
        if (typeof showToast === 'function') showToast('Удалено записей: ' + count, 'success'); else alert('Удалено записей: ' + count);
      }).catch(function (err) {
        if (typeof showToast === 'function') showToast(err && err.message ? err.message : 'Ошибка удаления', 'error'); else alert(err && err.message ? err.message : 'Ошибка удаления');
      });
      return;
    }
    var deletedCount = 0;
    selectedCattleIds.forEach(function (cattleId) {
      var index = entries.findIndex(function (e) { return e.cattleId === cattleId; });
      if (index !== -1) {
        entries.splice(index, 1);
        deletedCount++;
      }
    });
    if (deletedCount > 0) {
      saveLocally();
      updateList();
      if (typeof updateViewList === 'function') updateViewList();
      if (typeof updateHerdStats === 'function') updateHerdStats();
      if (typeof showToast === 'function') showToast('Удалено записей: ' + deletedCount, 'success'); else alert('Удалено записей: ' + deletedCount);
    } else {
      if (typeof showToast === 'function') showToast('Не удалось найти записи для удаления', 'info'); else alert('Не удалось найти записи для удаления');
    }
  };
  if (typeof showConfirmModal === 'function') {
    showConfirmModal(confirmMessage).then(function (ok) { if (ok) doDeleteSelected(); });
    return;
  }
  if (!confirm(confirmMessage)) return;
  doDeleteSelected();
}

/**
 * Заполняет форму данными из записи коровы
 * @param {Object} entry - Запись коровы
 */
function fillFormFromCowEntry(entry) {
  if (typeof window.refreshFarmDatalists === 'function') window.refreshFarmDatalists();
  if (typeof window.fillAllInseminationCodeSelects === 'function') window.fillAllInseminationCodeSelects();
  document.getElementById('cattleId').value = entry.cattleId || '';
  document.getElementById('nickname').value = entry.nickname || '';
  document.getElementById('group').value = entry.group || '';
  document.getElementById('birthDate').value = entry.birthDate || '';
  document.getElementById('lactation').value = entry.lactation !== undefined && entry.lactation !== '' ? entry.lactation : '';
  document.getElementById('calvingDate').value = entry.calvingDate || '';
  document.getElementById('inseminationDate').value = entry.inseminationDate || '';
  document.getElementById('attemptNumber').value = entry.attemptNumber || 1;
  document.getElementById('bull').value = entry.bull || '';
  document.getElementById('inseminator').value = entry.inseminator || '';
  document.getElementById('code').value = entry.code || '';
  document.getElementById('status').value = entry.status || '';
  document.getElementById('exitDate').value = entry.exitDate || '';
  document.getElementById('dryStartDate').value = entry.dryStartDate || '';
  document.getElementById('vwp').value = (typeof getPDO === 'function' ? getPDO(entry) : entry.vwp) || '—';
  document.getElementById('protocolName').value = entry.protocol?.name || '';
  document.getElementById('protocolStartDate').value = entry.protocol?.startDate || '';
  document.getElementById('note').value = entry.note || '';
}

/**
 * Заполняет запись коровы данными из формы
 * @param {Object} entry - Запись коровы для заполнения
 */
function fillCowEntryFromForm(entry) {
  entry.cattleId = document.getElementById('cattleId').value.trim();
  entry.nickname = document.getElementById('nickname').value || '';
  entry.group = document.getElementById('group').value || '';
  entry.birthDate = document.getElementById('birthDate').value || '';
  var lactationVal = document.getElementById('lactation').value.trim();
  entry.lactation = lactationVal === '' ? '' : (parseInt(lactationVal, 10) || '');
  entry.calvingDate = document.getElementById('calvingDate').value || '';
  entry.inseminationDate = document.getElementById('inseminationDate').value;
  entry.attemptNumber = parseInt(document.getElementById('attemptNumber').value) || 1;
  entry.bull = document.getElementById('bull').value || '';
  entry.inseminator = document.getElementById('inseminator').value || '';
  entry.code = document.getElementById('code').value || '';
  entry.status = document.getElementById('status').value || '';
  entry.exitDate = document.getElementById('exitDate').value || '';
  entry.dryStartDate = document.getElementById('dryStartDate').value || '';
  // ПДО не сохраняем — рассчитывается автоматически; vwp оставляем для совместимости импорта
  entry.note = document.getElementById('note').value || '';
  
  // Протокол синхронизации
  if (!entry.protocol) entry.protocol = {};
  entry.protocol.name = document.getElementById('protocolName').value || '';
  entry.protocol.startDate = document.getElementById('protocolStartDate').value || '';

  // Синхронизация последней записи в истории осеменений с полями формы
  if (entry.inseminationHistory && entry.inseminationHistory.length > 0) {
    var last = entry.inseminationHistory[entry.inseminationHistory.length - 1];
    last.date = entry.inseminationDate || '';
    last.attemptNumber = entry.attemptNumber;
    last.bull = entry.bull || '';
    last.inseminator = entry.inseminator || '';
    last.code = entry.code || '';
  }
}

/**
 * Отменяет редактирование
 */
function cancelEdit() {
  if (window.currentEditingId) {
    delete window.currentEditingId;
    const titleElement = document.getElementById('addScreenTitle');
    if (titleElement) {
      titleElement.textContent = '➕ Добавить корову';
    }
  }
  clearForm();
  if (typeof navigate === 'function') {
    navigate('view');
  }
}

/**
 * Универсальное автодополнение по номеру коровы для экранов Запуск/Отел/Протокол
 * @param {string} inputId - id поля ввода
 * @param {string} listId - id списка подсказок
 * @param {function(string): void} [onPick] - вызов после выбора коровы из списка
 */
function setupCattleAutocompleteFor(inputId, listId, onPick) {
  var input = document.getElementById(inputId);
  var list = document.getElementById(listId);
  if (!input || !list) return;
  function getEntries() {
    if (typeof window !== 'undefined' && window.entries && Array.isArray(window.entries)) return window.entries;
    return [];
  }
  function populate() {
    list.innerHTML = '';
    var filter = (input.value || '').toLowerCase().trim();
    var source = getEntries();
    var matching = filter
      ? source.filter(function (e) {
          return (e.cattleId && e.cattleId.toLowerCase().indexOf(filter) !== -1) ||
            (e.nickname && e.nickname && e.nickname.toLowerCase().indexOf(filter) !== -1);
        }).slice(0, 10)
      : source.slice(0, 10);
    matching.forEach(function (entry) {
      var li = document.createElement('li');
      li.textContent = entry.cattleId + (entry.nickname ? ' (' + entry.nickname + ')' : '');
      li.dataset.value = entry.cattleId;
      li.addEventListener('click', function () {
        input.value = entry.cattleId;
        list.innerHTML = '';
        if (typeof onPick === 'function') onPick(entry.cattleId);
      });
      list.appendChild(li);
    });
  }
  input.removeEventListener('input', input._cattleAutocompleteInput);
  input.removeEventListener('focus', input._cattleAutocompleteFocus);
  input._cattleAutocompleteInput = populate;
  input.addEventListener('input', populate);
  input._cattleAutocompleteFocus = function () {
    populate();
  };
  input.addEventListener('focus', input._cattleAutocompleteFocus);
  input.addEventListener('blur', function () {
    setTimeout(function () {
      list.innerHTML = '';
    }, 200);
  });
  list.addEventListener('mousedown', function (e) {
    e.preventDefault();
  });
}

/**
 * Обновляет запись: запуск в сухостой (dryStartDate)
 */
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
  applyDryRunToEntry(entry, dryStartDate);
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
  try {
    applyCalvingToEntry(entry, calvingDate);
  } catch (err) {
    var msg = err && err.message ? err.message : String(err);
    if (typeof showToast === 'function') showToast(msg, 'error'); else alert(msg);
    return;
  }
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
  try {
    applyProtocolAssignToEntry(entry, protocolName, startDate);
  } catch (err) {
    var msgP = err && err.message ? err.message : String(err);
    if (typeof showToast === 'function') showToast(msgP, 'error'); else alert(msgP);
    return;
  }
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
}

function initDryScreen() {
  if (typeof window.initActionBatchDryScreen === 'function') {
    window.initActionBatchDryScreen();
    return;
  }
  setupCattleAutocompleteFor('cattleIdDryInput', 'cattleIdDryList');
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
  setupCattleAutocompleteFor('cattleIdCalvingInput', 'cattleIdCalvingList');
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
  setupCattleAutocompleteFor('cattleIdProtocolInput', 'cattleIdProtocolList');
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
    fillProtocolSelect();
  }
  if (window._prefillCattleId) {
    var el = document.getElementById('cattleIdProtocolInput');
    if (el) { el.value = window._prefillCattleId; delete window._prefillCattleId; }
  }
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
  var eventTypeUzi = (statusBefore.indexOf('Осеменен') !== -1) ? 'УЗИ1' : (statusBefore.indexOf('Стельная') !== -1 ? 'УЗИ2' : 'УЗИ');
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
  if (result === 'Не стельная') entry.status = 'Холостая';
  var lastRec = entry.uziHistory[entry.uziHistory.length - 1];
  var detailsStr = 'Дата: ' + uziDate + ', ' + result + (specialist ? ', специалист: ' + specialist : '');
  if (lastRec.daysFromInsemination != null && lastRec.daysFromInsemination !== undefined) detailsStr += ', дней от осеменения: ' + lastRec.daysFromInsemination;
  var pushHistFn = (typeof window !== 'undefined' && window.pushActionHistory) ? window.pushActionHistory : (typeof pushActionHistory === 'function' ? pushActionHistory : null);
  if (pushHistFn) pushHistFn(entry, 'УЗИ', detailsStr, { eventType: eventTypeUzi, result: result });
  return { eventTypeUzi: eventTypeUzi, detailsStr: detailsStr };
}

function applyDryRunToEntry(entry, dryStartDate) {
  if (!entry) throw new Error('Нет записи');
  entry.dryStartDate = dryStartDate || '';
  entry.status = entry.status || '';
  if (dryStartDate && entry.status.indexOf('Сухостой') === -1) entry.status = 'Сухостой';
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
  var detailsStr = 'Протокол: ' + protocolName + (startDate ? ', начало: ' + startDate : '');
  var _pushHist = typeof pushActionHistory === 'function' ? pushActionHistory : window.pushActionHistory;
  if (typeof _pushHist === 'function') _pushHist(entry, 'Постановка на протокол', detailsStr, { eventType: 'Постановка на протокол', protocolName: protocolName });
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
  var lastInsem = entry ? getLastInseminationDateBefore(entry, uziDate) : null;
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
  setupCattleAutocompleteFor('cattleIdUziInput', 'cattleIdUziList');
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

  var applied;
  try {
    applied = applyUziToEntry(entry, {
      uziDate: uziDate,
      result: result,
      specialist: specialist,
      daysFromInsemination: daysFromInsemination
    });
  } catch (errApply) {
    if (typeof showToast === 'function') showToast(errApply && errApply.message ? errApply.message : 'Ошибка', 'error'); else alert(errApply && errApply.message ? errApply.message : 'Ошибка');
    return;
  }
  var eventTypeUzi = applied.eventTypeUzi;
  var detailsStr = applied.detailsStr;
  var pushHistFn = (typeof window !== 'undefined' && window.pushActionHistory) ? window.pushActionHistory : (typeof pushActionHistory === 'function' ? pushActionHistory : null);

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
}

// Делаем функции доступными глобально (для inline onsubmit/onclick в формах и карточке)
if (typeof window !== 'undefined') {
  window.editEntry = editEntry;
  window.deleteSelectedEntries = deleteSelectedEntries;
  window.saveUziEntry = saveUziEntry;
  window.saveCalvingEntry = saveCalvingEntry;
  window.saveDryRunEntry = saveDryRunEntry;
  window.saveProtocolAssignEntry = saveProtocolAssignEntry;
  window.applyUziToEntry = applyUziToEntry;
  window.applyDryRunToEntry = applyDryRunToEntry;
  window.applyCalvingToEntry = applyCalvingToEntry;
  window.applyProtocolAssignToEntry = applyProtocolAssignToEntry;
  window.getLastInseminationRecordBefore = getLastInseminationRecordBefore;
  window.getLastInseminationDateBefore = getLastInseminationDateBefore;
  window.setupCattleAutocompleteFor = setupCattleAutocompleteFor;
  window.buildCalfEntryFromCalving = buildCalfEntryFromCalving;
  window.initUziScreen = initUziScreen;
  window.initDryScreen = initDryScreen;
  window.initCalvingScreen = initCalvingScreen;
  window.initProtocolAssignScreen = initProtocolAssignScreen;
}

// Экспорт функций
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    editEntry,
    deleteEntry,
    deleteSelectedEntries,
    fillFormFromCowEntry,
    fillCowEntryFromForm,
    cancelEdit
  };
}
export {};