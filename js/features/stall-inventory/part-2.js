/** __stallInv part 2 */
(function () {
  'use strict';
  var root = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this);
  var NS = root['__stallInv'] = root['__stallInv'] || {};
  var global = typeof window !== 'undefined' ? window : this;

function invFilterPendingNewAnimals(newAnimals) {
  var created = (globalThis['__stallInv'].state._inventorySession && globalThis['__stallInv'].state._inventorySession.createdNewAnimals) || [];
  return (newAnimals || []).filter(function (row) {
    if (!row || !row.cattleId) return false;
    for (var i = 0; i < created.length; i++) {
      if (cattleIdEqual(created[i], row.cattleId)) return false;
    }
    var list = typeof window.entries !== 'undefined' && Array.isArray(window.entries) ? window.entries : [];
    for (var j = 0; j < list.length; j++) {
      if (list[j] && cattleIdEqual(list[j].cattleId, row.cattleId)) return false;
    }
    return true;
  });
}

function invBuildEntryFromNewAnimal(row) {
  var getDef = typeof window.getDefaultCowEntry === 'function' ? window.getDefaultCowEntry : null;
  var entry = getDef ? getDef() : {
    cattleId: '',
    nickname: '',
    group: '',
    inseminationHistory: [],
    actionHistory: [],
    uziHistory: [],
    lactationHistory: [],
    protocol: { name: '', startDate: '' }
  };
  entry.cattleId = String(row.cattleId).trim();
  entry.stallYard = row.foundAt && row.foundAt.yard != null ? String(row.foundAt.yard) : '';
  entry.stallRow = row.foundAt && row.foundAt.row != null ? row.foundAt.row : '';
  entry.stallPlace = row.foundAt && row.foundAt.place != null ? row.foundAt.place : '';
  entry.synced = false;
  if (typeof window.getCurrentUser === 'function' && window.getCurrentUser()) {
    entry.userId = window.getCurrentUser().id;
    entry.lastModifiedBy = window.getCurrentUser().username;
  }
  if (typeof window.nowFormatted === 'function' && !entry.dateAdded) {
    entry.dateAdded = window.nowFormatted();
  }
  return entry;
}

function invAddToExpectedSnapshot(entry) {
  if (!globalThis['__stallInv'].state._inventorySession || !entry || !entry.cattleId) return;
  if (!globalThis['__stallInv'].state._inventorySession.expectedSnapshot) globalThis['__stallInv'].state._inventorySession.expectedSnapshot = [];
  for (var i = 0; i < globalThis['__stallInv'].state._inventorySession.expectedSnapshot.length; i++) {
    if (cattleIdEqual(globalThis['__stallInv'].state._inventorySession.expectedSnapshot[i].cattleId, entry.cattleId)) return;
  }
  globalThis['__stallInv'].state._inventorySession.expectedSnapshot.push({
    cattleId: String(entry.cattleId).trim(),
    nickname: entry.nickname || '',
    group: entry.group || '',
    stallYard: entry.stallYard || '',
    stallRow: entry.stallRow !== '' && entry.stallRow != null ? entry.stallRow : '',
    stallPlace: entry.stallPlace !== '' && entry.stallPlace != null ? entry.stallPlace : ''
  });
}

function invRefreshEntriesUi() {
  if (typeof window.updateList === 'function') window.updateList();
  if (typeof window.updateViewList === 'function') window.updateViewList();
  if (typeof window.updateHerdStats === 'function') window.updateHerdStats();
  if (typeof window.stallMapRedrawIfActive === 'function') window.stallMapRedrawIfActive();
  if (typeof window.CattleTrackerEvents !== 'undefined') {
    try {
      window.CattleTrackerEvents.emit('entries:updated', window.entries || []);
    } catch (e) {}
  }
}

function invEntryExistsInHerd(cattleId) {
  var list = typeof window.entries !== 'undefined' && Array.isArray(window.entries) ? window.entries : [];
  for (var i = 0; i < list.length; i++) {
    if (list[i] && cattleIdEqual(list[i].cattleId, cattleId)) return true;
  }
  return false;
}

function invCreateNewAnimalCards(newAnimals) {
  if (!globalThis['__stallInv'].invCanCreateCards()) {
    globalThis['__stallInv'].invToast('Недостаточно прав для создания карточек', 'error');
    return Promise.resolve(0);
  }
  if (!globalThis['__stallInv'].state._inventorySession) {
    globalThis['__stallInv'].invToast('Сессия инвентаризации не найдена', 'error');
    return Promise.resolve(0);
  }
  if (window.CATTLE_TRACKER_USE_API && !globalThis['__stallInv'].invGetActiveObjectId()) {
    globalThis['__stallInv'].invToast('Сначала выберите базу в разделе «Синхронизация»', 'error');
    return Promise.resolve(0);
  }
  var pending = invFilterPendingNewAnimals(newAnimals);
  if (!pending.length) {
    globalThis['__stallInv'].invToast('Нет новых животных для создания', 'info');
    return Promise.resolve(0);
  }
  if (!globalThis['__stallInv'].state._inventorySession.createdNewAnimals) globalThis['__stallInv'].state._inventorySession.createdNewAnimals = [];

  globalThis['__stallInv'].invToast('Создание карточек: ' + pending.length + '…', 'info');

  var chain = Promise.resolve();
  var created = 0;
  var skipped = 0;

  pending.forEach(function (row) {
    chain = chain.then(function () {
      if (invEntryExistsInHerd(row.cattleId)) {
        skipped++;
        return Promise.resolve();
      }
      var entry = invBuildEntryFromNewAnimal(row);
      return globalThis['__stallInv'].invPersistNewAnimalEntry(entry).then(function () {
        globalThis['__stallInv'].state._inventorySession.createdNewAnimals.push(row.cattleId);
        invAddToExpectedSnapshot(entry);
        created++;
      });
    });
  });

  return chain.then(function () {
    globalThis['__stallInv'].invSaveSession();
    invRefreshEntriesUi();
    if (created > 0) {
      globalThis['__stallInv'].invToast('Создано карточек: ' + created, 'success');
    } else if (skipped > 0) {
      globalThis['__stallInv'].invToast('Карточки уже есть в стаде (' + skipped + ')', 'info');
    } else {
      globalThis['__stallInv'].invToast('Не удалось создать карточки', 'error');
    }
    globalThis['__stallInv'].invRenderActiveTab();
    return created;
  }).catch(function (err) {
    invRefreshEntriesUi();
    globalThis['__stallInv'].invToast((err && err.message) || 'Ошибка создания карточек', 'error');
    globalThis['__stallInv'].invRenderActiveTab();
    return 0;
  });
}

function invAdvanceAfterCellCheck() {
  if (!globalThis['__stallInv'].state._inventorySession) return;
  globalThis['__stallInv'].state._inventorySession.currentCellIndex = (globalThis['__stallInv'].state._inventorySession.currentCellIndex || 0) + 1;
  if (globalThis['__stallInv'].state._inventorySession.currentCellIndex >= _inventoryYardCells.length) {
    globalThis['__stallInv'].state._inventorySession.phase = 'unassigned';
    globalThis['__stallInv'].state._inventorySession.currentCellIndex = 0;
  }
  globalThis['__stallInv'].invSaveSession();
  globalThis['__stallInv'].invRenderActiveTab();
}

function invFinishCheckComplete() {
  if (!globalThis['__stallInv'].state._inventorySession) return;
  finishInventorySession(globalThis['__stallInv'].state._inventorySession, { early: false });
  globalThis['__stallInv'].invSaveSession();
  globalThis['__stallInv'].state._inventoryTab = 'result';
  globalThis['__stallInv'].invRenderActiveTab();
}

function invFinishCheckEarly() {
  if (!globalThis['__stallInv'].state._inventorySession) return;
  var progress = getInventoryProgress(globalThis['__stallInv'].state._inventorySession, _inventoryYardCells);
  var msg = 'Завершить сверку досрочно?\n\n' +
    'Проверено стойломест: ' + progress.cellsChecked + ' из ' + progress.cellsTotal + '.\n' +
    'Без места: ' + progress.unassignedChecked + ' из ' + progress.unassignedTotal + '.\n\n' +
    'Непроверенные позиции не войдут в несостыковки.';
  if (!confirm(msg)) return;
  finishInventorySession(globalThis['__stallInv'].state._inventorySession, { early: true });
  globalThis['__stallInv'].invSaveSession();
  globalThis['__stallInv'].state._inventoryTab = 'result';
  globalThis['__stallInv'].invRenderActiveTab();
}

function invBindFinishEarlyButton(host) {
  var btn = host.querySelector('#stallInvFinishEarly');
  if (btn && !btn.dataset.bound) {
    btn.dataset.bound = '1';
    btn.addEventListener('click', invFinishCheckEarly);
  }
}

function invBindCancelCheckButton(host) {
  var cancelBtn = host.querySelector('#stallInvCancelCheck');
  if (cancelBtn && !cancelBtn.dataset.bound) {
    cancelBtn.dataset.bound = '1';
    cancelBtn.addEventListener('click', function () {
      if (confirm('Отменить текущую сверку?')) {
        globalThis['__stallInv'].invClearSession();
        globalThis['__stallInv'].invRenderActiveTab();
      }
    });
  }
}

function invRenderCellCheck(host) {
  var cell = globalThis['__stallInv'].invCurrentCell();
  if (!cell) {
    globalThis['__stallInv'].state._inventorySession.phase = 'unassigned';
    globalThis['__stallInv'].invSaveSession();
    globalThis['__stallInv'].invRenderActiveTab();
    return;
  }
  var idx = globalThis['__stallInv'].state._inventorySession.currentCellIndex || 0;
  var total = _inventoryYardCells.length;
  var exp = cell.expected;
  var expText = exp
    ? (globalThis['__stallInv'].invEscapeHtml(exp.cattleId) + (exp.nickname ? ' — ' + globalThis['__stallInv'].invEscapeHtml(exp.nickname) : ''))
    : 'пусто';

  host.innerHTML =
    '<div class="stall-inventory-progress">Стойломесто ' + (idx + 1) + ' из ' + total + '</div>' +
    '<div class="stall-inventory-cell-card">' +
    '<p class="stall-inventory-cell-coords">' + globalThis['__stallInv'].invEscapeHtml(formatStallLabel(cell.yard, cell.row, cell.place)) + '</p>' +
    '<p class="stall-inventory-cell-expected"><span>Ожидается:</span> ' + expText + '</p>' +
    '<div class="stall-inventory-other-input" id="stallInvOtherWrap" hidden>' +
    '<label class="stall-map-field"><span>Фактический номер</span></label>' +
    '<div class="stall-inventory-assign-input-row">' +
    '<input type="text" id="stallInvOtherInput" class="stall-map-assign-input" placeholder="Номер или кличка" autocomplete="off" />' +
    '<button type="button" class="action-btn stall-inventory-other-save" id="stallInvOtherSave">Сохранить</button>' +
    '</div>' +
    '<p id="stallInvOtherHint" class="stall-inventory-muted" hidden></p></div>' +
    '<div class="stall-inventory-cell-actions">' +
    '<button type="button" class="action-btn" id="stallInvCellOk">Верно</button>' +
    '<button type="button" class="small-btn" id="stallInvCellOther">Другой номер</button>' +
    '<button type="button" class="small-btn" id="stallInvCellEmpty">Пусто</button>' +
    '</div></div>' +
    '<div class="stall-inventory-check-footer">' +
    '<button type="button" class="small-btn stall-inventory-finish-early" id="stallInvFinishEarly">Завершить сверку</button>' +
    '<button type="button" class="small-btn stall-inventory-cancel" id="stallInvCancelCheck">Отменить сверку</button>' +
    '</div>';

  var okBtn = host.querySelector('#stallInvCellOk');
  var otherBtn = host.querySelector('#stallInvCellOther');
  var emptyBtn = host.querySelector('#stallInvCellEmpty');
  var otherWrap = host.querySelector('#stallInvOtherWrap');
  var otherInput = host.querySelector('#stallInvOtherInput');
  var otherSaveBtn = host.querySelector('#stallInvOtherSave');
  var otherHint = host.querySelector('#stallInvOtherHint');
  var otherMode = false;

  function updateOtherHint() {
    if (!otherHint || !otherInput || otherWrap.hidden) return;
    var parsed = globalThis['__stallInv'].invParseActualInput(otherInput.value);
    if (!parsed) {
      otherHint.hidden = true;
      otherHint.textContent = '';
      return;
    }
    if (!parsed.inHerd) {
      otherHint.hidden = false;
      otherHint.textContent = 'Нет в стаде — будет добавлена в список новых животных';
    } else {
      otherHint.hidden = true;
      otherHint.textContent = '';
    }
  }

  function submitOther() {
    var parsed = globalThis['__stallInv'].invParseActualInput(otherInput ? otherInput.value : '');
    if (!parsed) {
      if (typeof showToast === 'function') showToast('Введите номер животного', 'error');
      return;
    }
    recordCellCheck(globalThis['__stallInv'].state._inventorySession, cell.yard, cell.row, cell.place, 'other', parsed.cattleId, !parsed.inHerd);
    globalThis['__stallInv'].invStopAssignPoll();
    invAdvanceAfterCellCheck();
  }

  if (okBtn) {
    okBtn.addEventListener('click', function () {
      recordCellCheck(globalThis['__stallInv'].state._inventorySession, cell.yard, cell.row, cell.place, 'ok');
      invAdvanceAfterCellCheck();
    });
  }
  if (emptyBtn) {
    emptyBtn.addEventListener('click', function () {
      recordCellCheck(globalThis['__stallInv'].state._inventorySession, cell.yard, cell.row, cell.place, 'empty');
      invAdvanceAfterCellCheck();
    });
  }
  if (otherBtn && otherWrap && otherInput) {
    otherBtn.addEventListener('click', function () {
      otherMode = !otherMode;
      otherWrap.hidden = !otherMode;
      if (otherMode) {
        otherInput.focus();
        globalThis['__stallInv'].invStartAssignPoll(otherInput);
        globalThis['__stallInv'].updateOtherHint();
      } else {
        globalThis['__stallInv'].invStopAssignPoll();
        if (otherHint) otherHint.hidden = true;
      }
    });
    otherInput.addEventListener('input', updateOtherHint);
    otherInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        globalThis['__stallInv'].submitOther();
      }
    });
  }
  if (otherSaveBtn) {
    otherSaveBtn.addEventListener('click', submitOther);
  }

  invBindFinishEarlyButton(host);
  invBindCancelCheckButton(host);
}


  // register functions
  NS.invFilterPendingNewAnimals = invFilterPendingNewAnimals;
  NS.invBuildEntryFromNewAnimal = invBuildEntryFromNewAnimal;
  NS.invAddToExpectedSnapshot = invAddToExpectedSnapshot;
  NS.invRefreshEntriesUi = invRefreshEntriesUi;
  NS.invEntryExistsInHerd = invEntryExistsInHerd;
  NS.invCreateNewAnimalCards = invCreateNewAnimalCards;
  NS.invAdvanceAfterCellCheck = invAdvanceAfterCellCheck;
  NS.invFinishCheckComplete = invFinishCheckComplete;
  NS.invFinishCheckEarly = invFinishCheckEarly;
  NS.invBindFinishEarlyButton = invBindFinishEarlyButton;
  NS.invBindCancelCheckButton = invBindCancelCheckButton;
  NS.invRenderCellCheck = invRenderCellCheck;
})();
export {};
