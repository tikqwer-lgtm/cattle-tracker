/** __cowOps part 1 */
(function () {
  'use strict';
  var root = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this);
  var NS = root['__cowOps'] = root['__cowOps'] || {};
  var global = typeof window !== 'undefined' ? window : this;

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
  var stallY = document.getElementById('stallYard');
  var stallR = document.getElementById('stallRow');
  var stallP = document.getElementById('stallPlace');
  if (stallY) stallY.value = entry.stallYard != null && entry.stallYard !== '' ? String(entry.stallYard) : '';
  if (stallR) stallR.value = entry.stallRow !== '' && entry.stallRow != null ? String(entry.stallRow) : '';
  if (stallP) stallP.value = entry.stallPlace !== '' && entry.stallPlace != null ? String(entry.stallPlace) : '';
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
  var stallYEl = document.getElementById('stallYard');
  var stallREl = document.getElementById('stallRow');
  var stallPEl = document.getElementById('stallPlace');
  entry.stallYard = stallYEl && stallYEl.value != null ? String(stallYEl.value).trim() : '';
  var sr = stallREl && stallREl.value != null ? String(stallREl.value).trim() : '';
  var sp = stallPEl && stallPEl.value != null ? String(stallPEl.value).trim() : '';
  entry.stallRow = sr === '' ? '' : (parseInt(sr, 10) || '');
  entry.stallPlace = sp === '' ? '' : (parseInt(sp, 10) || '');

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
 * Один общий capture-обработчик на document вместо множества (иначе в Electron со временем
 * клики/фокус начинают вести себя нестабильно).
 */
var _cattleAutocompleteRegistry = [];
var _cattleAutocompleteDocBound = false;

function _cattleAutocompleteOnDocumentClick(e) {
  for (var i = _cattleAutocompleteRegistry.length - 1; i >= 0; i--) {
    var reg = _cattleAutocompleteRegistry[i];
    if (!reg.input || !reg.input.isConnected) {
      _cattleAutocompleteRegistry.splice(i, 1);
      continue;
    }
    var outer = reg.outer || reg.wrap;
    if (outer && outer.contains(e.target)) continue;
    reg.globalThis['__cowOps'].closeList();
  }
}

function unregisterCattleAutocompleteInput(input) {
  if (!input) return;
  for (var i = _cattleAutocompleteRegistry.length - 1; i >= 0; i--) {
    if (_cattleAutocompleteRegistry[i].input === input) {
      _cattleAutocompleteRegistry.splice(i, 1);
    }
  }
}

function registerCattleAutocomplete(reg) {
  if (!_cattleAutocompleteDocBound) {
    // Всплытие (false), не capture — в Electron capture на document иногда ломает фокус/клики по полю и списку
    document.addEventListener('click', _cattleAutocompleteOnDocumentClick, false);
    _cattleAutocompleteDocBound = true;
  }
  unregisterCattleAutocompleteInput(reg.input);
  _cattleAutocompleteRegistry.push(reg);
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
  list.innerHTML = '';
  var wrap = input.closest('.autocomplete') || input.parentElement;
  var outer = input.closest('.action-batch-add-block') || input.closest('.autocomplete') || wrap;
  function getEntries() {
    if (typeof window !== 'undefined' && window.entries && Array.isArray(window.entries)) return window.entries;
    return [];
  }
  function closeList() {
    list.innerHTML = '';
  }
  function pickEntry(entry) {
    input.value = entry.cattleId;
    globalThis['__cowOps'].closeList();
    if (typeof onPick === 'function') onPick(entry.cattleId);
  }
  function tryPickFromTypedValue(e) {
    if (e.key !== 'Enter') return;
    if (e.isComposing || e.keyCode === 229) return;
    var v = (input.value || '').trim();
    if (!v) return;
    var source = globalThis['__cowOps'].getEntries();
    var exact = null;
    for (var i = 0; i < source.length; i++) {
      if (String(source[i].cattleId || '').trim() === v) {
        exact = source[i];
        break;
      }
    }
    if (exact) {
      e.preventDefault();
      globalThis['__cowOps'].pickEntry(exact);
      return;
    }
    var lv = v.toLowerCase();
    var matching = source
      .filter(function (ent) {
        return (
          (ent.cattleId && ent.cattleId.toLowerCase().indexOf(lv) !== -1) ||
          (ent.nickname && ent.nickname.toLowerCase().indexOf(lv) !== -1)
        );
      })
      .slice(0, 10);
    if (matching.length === 1) {
      e.preventDefault();
      globalThis['__cowOps'].pickEntry(matching[0]);
    }
  }
  function populate() {
    list.innerHTML = '';
    var filter = (input.value || '').toLowerCase().trim();
    var source = globalThis['__cowOps'].getEntries();
    var matching = filter
      ? source.filter(function (e) {
          return (e.cattleId && e.cattleId.toLowerCase().indexOf(filter) !== -1) ||
            (e.nickname && e.nickname.toLowerCase().indexOf(filter) !== -1);
        }).slice(0, 10)
      : source.slice(0, 10);
    matching.forEach(function (entry) {
      var li = document.createElement('li');
      li.textContent = entry.cattleId + (entry.nickname ? ' (' + entry.nickname + ')' : '');
      li.dataset.value = entry.cattleId;
      li.setAttribute('role', 'option');
      li.tabIndex = 0;
      // Как в типичном datalist: mousedown preventDefault — поле не теряет фокус до выбора; выбор по click.
      li.addEventListener('mousedown', function (e) {
        e.preventDefault();
      });
      li.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        globalThis['__cowOps'].pickEntry(entry);
      });
      li.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          globalThis['__cowOps'].pickEntry(entry);
        }
      });
      list.appendChild(li);
    });
    /* Electron: после пересборки списка подсказок иногда «плывёт» ввод; один softRepaint на кадр. */
    if (typeof window !== 'undefined' && window.electronAPI && typeof window.softRepaintCattleTrackerView === 'function') {
      if (!input._cattleAutocompleteRepaintScheduled) {
        input._cattleAutocompleteRepaintScheduled = true;
        var doRepaint = function () {
          input._cattleAutocompleteRepaintScheduled = false;
          if (document.activeElement !== input) return;
          try {
            window.softRepaintCattleTrackerView();
          } catch (e) {}
        };
        if (typeof requestAnimationFrame === 'function') {
          requestAnimationFrame(doRepaint);
        } else {
          setTimeout(doRepaint, 0);
        }
      }
    }
  }
  input.removeEventListener('input', input._cattleAutocompleteInput);
  input.removeEventListener('keydown', input._cattleAutocompleteKeydown);
  input.removeEventListener('focus', input._cattleAutocompleteFocus);
  if (input._cattleAutocompleteComposition) {
    input.removeEventListener('compositionend', input._cattleAutocompleteComposition);
    input._cattleAutocompleteComposition = null;
  }
  if (input._cattleAutocompleteEntriesCb && typeof window.CattleTrackerEvents !== 'undefined' && typeof window.CattleTrackerEvents.off === 'function') {
    window.CattleTrackerEvents.off('entries:updated', input._cattleAutocompleteEntriesCb);
    input._cattleAutocompleteEntriesCb = null;
  }
  if (input._cattleAutocompleteEntriesTimer) {
    clearTimeout(input._cattleAutocompleteEntriesTimer);
    input._cattleAutocompleteEntriesTimer = null;
  }
  unregisterCattleAutocompleteInput(input);
  input._cattleAutocompleteInput = populate;
  input.addEventListener('input', populate);
  input._cattleAutocompleteKeydown = tryPickFromTypedValue;
  input.addEventListener('keydown', input._cattleAutocompleteKeydown);
  input._cattleAutocompleteComposition = function () {
    globalThis['__cowOps'].populate();
  };
  input.addEventListener('compositionend', input._cattleAutocompleteComposition);
  input._cattleAutocompleteFocus = function () {
    globalThis['__cowOps'].populate();
  };
  input.addEventListener('focus', input._cattleAutocompleteFocus);
  input._cattleAutocompleteEntriesCb = function () {
    if (document.activeElement !== input) return;
    if (input._cattleAutocompleteEntriesTimer) clearTimeout(input._cattleAutocompleteEntriesTimer);
    input._cattleAutocompleteEntriesTimer = setTimeout(function () {
      input._cattleAutocompleteEntriesTimer = null;
      if (document.activeElement === input && typeof input._cattleAutocompleteInput === 'function') {
        input._cattleAutocompleteInput();
      }
    }, 120);
  };
  if (typeof window.CattleTrackerEvents !== 'undefined' && typeof window.CattleTrackerEvents.on === 'function') {
    window.CattleTrackerEvents.on('entries:updated', input._cattleAutocompleteEntriesCb);
  }
  registerCattleAutocomplete({ input: input, wrap: wrap, outer: outer, closeList: closeList });
}

/**
 * Обновляет запись: запуск в сухостой (dryStartDate)
 */

  // register functions
  NS.editEntry = editEntry;
  NS.deleteEntry = deleteEntry;
  NS.deleteSelectedEntries = deleteSelectedEntries;
  NS.fillFormFromCowEntry = fillFormFromCowEntry;
  NS.fillCowEntryFromForm = fillCowEntryFromForm;
  NS.cancelEdit = cancelEdit;
  NS._cattleAutocompleteOnDocumentClick = _cattleAutocompleteOnDocumentClick;
  NS.unregisterCattleAutocompleteInput = unregisterCattleAutocompleteInput;
  NS.registerCattleAutocomplete = registerCattleAutocomplete;
  NS.setupCattleAutocompleteFor = setupCattleAutocompleteFor;
})();
export {};
