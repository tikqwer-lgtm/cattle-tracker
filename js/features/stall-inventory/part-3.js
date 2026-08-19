/** __stallInv part 3 */
(function () {
  'use strict';
  var root = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this);
  var NS = root['__stallInv'] = root['__stallInv'] || {};
  var global = typeof window !== 'undefined' ? window : this;

function invUnassignedList() {
  if (!globalThis['__stallInv'].state._inventorySession) return [];
  var out = [];
  (globalThis['__stallInv'].state._inventorySession.expectedSnapshot || []).forEach(function (e) {
    if (!e || !e.cattleId) return;
    var has = e.stallYard && e.stallRow !== '' && e.stallPlace !== '';
    if (!has) out.push(e);
  });
  return out;
}

function invRenderUnassignedCheck(host) {
  var list = invUnassignedList();
  if (!list.length) {
    globalThis['__stallInv'].invFinishCheckComplete();
    return;
  }

  var idx = globalThis['__stallInv'].state._inventorySession.currentCellIndex || 0;
  if (idx >= list.length) {
    globalThis['__stallInv'].invFinishCheckComplete();
    return;
  }

  var entry = list[idx];
  host.innerHTML =
    '<div class="stall-inventory-progress">Без места: ' + (idx + 1) + ' из ' + list.length + '</div>' +
    '<div class="stall-inventory-cell-card">' +
    '<p><strong>' + globalThis['__stallInv'].invEscapeHtml(entry.cattleId) + '</strong>' +
    (entry.nickname ? ' — ' + globalThis['__stallInv'].invEscapeHtml(entry.nickname) : '') + '</p>' +
    '<div class="stall-inventory-found-fields" id="stallInvFoundWrap" hidden>' +
    '<label class="stall-map-field"><span>Двор</span><input type="text" id="stallInvFoundYard" /></label>' +
    '<label class="stall-map-field"><span>Ряд</span><input type="number" id="stallInvFoundRow" min="1" max="200" /></label>' +
    '<label class="stall-map-field"><span>Место</span><input type="number" id="stallInvFoundPlace" min="1" max="200" /></label></div>' +
    '<div class="stall-inventory-cell-actions">' +
    '<button type="button" class="small-btn" id="stallInvUnassignedNotFound">Не найдено</button>' +
    '<button type="button" class="action-btn" id="stallInvUnassignedFound">Найдено</button>' +
    '</div></div>' +
    '<div class="stall-inventory-check-footer">' +
    '<button type="button" class="small-btn stall-inventory-finish-early" id="stallInvFinishEarly">Завершить сверку</button>' +
    '<button type="button" class="small-btn stall-inventory-cancel" id="stallInvCancelCheck">Отменить сверку</button>' +
    '</div>';

  var foundWrap = host.querySelector('#stallInvFoundWrap');
  var foundBtn = host.querySelector('#stallInvUnassignedFound');
  var notFoundBtn = host.querySelector('#stallInvUnassignedNotFound');

  if (foundBtn && foundWrap) {
    foundBtn.addEventListener('click', function () {
      if (foundWrap.hidden) {
        foundWrap.hidden = false;
        var yIn = host.querySelector('#stallInvFoundYard');
        if (yIn) yIn.value = globalThis['__stallInv'].state._inventorySession.yardKey || '';
        return;
      }
      var yard = (host.querySelector('#stallInvFoundYard') || {}).value;
      var row = parseInt((host.querySelector('#stallInvFoundRow') || {}).value, 10);
      var place = parseInt((host.querySelector('#stallInvFoundPlace') || {}).value, 10);
      if (!String(yard || '').trim() || !Number.isFinite(row) || !Number.isFinite(place)) {
        if (typeof showToast === 'function') showToast('Укажите двор, ряд и место', 'error');
        return;
      }
      recordUnassignedCheck(globalThis['__stallInv'].state._inventorySession, entry.cattleId, 'found', { yard: yard, row: row, place: place });
      globalThis['__stallInv'].state._inventorySession.currentCellIndex = idx + 1;
      globalThis['__stallInv'].invSaveSession();
      globalThis['__stallInv'].invRenderActiveTab();
    });
  }
  if (notFoundBtn) {
    notFoundBtn.addEventListener('click', function () {
      recordUnassignedCheck(globalThis['__stallInv'].state._inventorySession, entry.cattleId, 'not_found');
      globalThis['__stallInv'].state._inventorySession.currentCellIndex = idx + 1;
      globalThis['__stallInv'].invSaveSession();
      globalThis['__stallInv'].invRenderActiveTab();
    });
  }

  globalThis['__stallInv'].invBindFinishEarlyButton(host);
  globalThis['__stallInv'].invBindCancelCheckButton(host);
}

function invRenderCheckStart(host) {
  var layout = NS.state._inventoryLayout;
  var keys = globalThis['__stallInv'].invYardKeys(layout);
  var saved = globalThis['__stallInv'].invLoadSession();
  var resumeHtml = saved
    ? '<p class="stall-inventory-resume">Есть незавершённая сверка (двор «' + globalThis['__stallInv'].invEscapeHtml(saved.yardKey || '') + '»). ' +
      '<button type="button" class="link-btn" id="stallInvResumeBtn">Продолжить</button></p>'
    : '';

  if (!keys.length) {
    host.innerHTML = '<p class="stall-inventory-muted">Сначала создайте двор на <button type="button" class="link-btn" id="stallInvGoMap">схеме стойломест</button>.</p>' +
      resumeHtml;
    var goMap = host.querySelector('#stallInvGoMap');
    if (goMap) goMap.addEventListener('click', function () { window.navigate('stall-map'); });
    var resumeBtn = host.querySelector('#stallInvResumeBtn');
    if (resumeBtn) {
      resumeBtn.addEventListener('click', function () {
        globalThis['__stallInv'].state._inventorySession = saved;
        globalThis['__stallInv'].invPrepareYardCells();
        globalThis['__stallInv'].invRenderActiveTab();
      });
    }
    return;
  }

  host.innerHTML =
    resumeHtml +
    '<div class="stall-inventory-toolbar">' +
    '<label class="stall-map-field"><span>Двор для обхода</span>' +
    globalThis['__stallInv'].invYardSelectHtml('stallInvCheckYard', layout, keys[0], false) + '</label>' +
    '<button type="button" class="action-btn" id="stallInvStartBtn">Начать сверку</button></div>' +
    '<p class="stall-inventory-muted">Обходите стойломеста по порядку: подтвердите ожидаемое животное, укажите другой номер или отметьте «Пусто».</p>';

  var startBtn = host.querySelector('#stallInvStartBtn');
  if (startBtn) {
    startBtn.addEventListener('click', function () {
      var yardEl = host.querySelector('#stallInvCheckYard');
      var yard = yardEl ? yardEl.value : keys[0];
      if (!yard) {
        if (typeof showToast === 'function') showToast('Выберите двор', 'error');
        return;
      }
      globalThis['__stallInv'].state._inventorySession = createInventorySession(globalThis['__stallInv'].invGetObjectId(), yard, globalThis['__stallInv'].invGetEntries());
      globalThis['__stallInv'].invPrepareYardCells();
      globalThis['__stallInv'].invSaveSession();
      globalThis['__stallInv'].invRenderActiveTab();
    });
  }
  var resumeBtn = host.querySelector('#stallInvResumeBtn');
  if (resumeBtn) {
    resumeBtn.addEventListener('click', function () {
      globalThis['__stallInv'].state._inventorySession = saved;
      globalThis['__stallInv'].invPrepareYardCells();
      globalThis['__stallInv'].invRenderActiveTab();
    });
  }
}

function invRenderCheckTab(host) {
  if (!globalThis['__stallInv'].state._inventorySession) {
    invRenderCheckStart(host);
    return;
  }
  if (globalThis['__stallInv'].state._inventorySession.phase === 'cells') {
    globalThis['__stallInv'].invRenderCellCheck(host);
    return;
  }
  if (globalThis['__stallInv'].state._inventorySession.phase === 'unassigned') {
    invRenderUnassignedCheck(host);
    return;
  }
  globalThis['__stallInv'].state._inventoryTab = 'result';
  globalThis['__stallInv'].invRenderActiveTab();
}

function invResultTableRows(rows, cols) {
  if (!rows.length) return '<p class="stall-inventory-muted">Нет записей.</p>';
  var html = '<div class="list-table-wrap"><table class="list-table"><thead><tr>';
  cols.forEach(function (c) { html += '<th>' + globalThis['__stallInv'].invEscapeHtml(c.label) + '</th>'; });
  html += '</tr></thead><tbody>';
  rows.forEach(function (r) {
    html += '<tr>';
    cols.forEach(function (c) {
      html += '<td>' + (typeof c.render === 'function' ? c.render(r) : globalThis['__stallInv'].invEscapeHtml(r[c.key])) + '</td>';
    });
    html += '</tr>';
  });
  html += '</tbody></table></div>';
  return html;
}

function invRenderResultTab(host) {
  if (!globalThis['__stallInv'].state._inventorySession || globalThis['__stallInv'].state._inventorySession.phase !== 'done') {
    host.innerHTML = '<p class="stall-inventory-muted">Сначала завершите сверку на вкладке «Сверка».</p>';
    return;
  }
  var result = computeInventoryResult(globalThis['__stallInv'].state._inventorySession, globalThis['__stallInv'].state._inventorySession.expectedSnapshot, {
    layout: NS.state._inventoryLayout,
    yardCells: NS.state._inventoryYardCells
  });
  var progress = result.progress || getInventoryProgress(globalThis['__stallInv'].state._inventorySession, NS.state._inventoryYardCells);
  var applyBtn = globalThis['__stallInv'].invIsViewer()
    ? ''
    : '<button type="button" class="action-btn" id="stallInvApplyBtn">Применить места по результатам</button>';

  var earlyBanner = '';
  if (globalThis['__stallInv'].state._inventorySession.finishedEarly) {
    var completedStr = globalThis['__stallInv'].state._inventorySession.completedAt
      ? new Date(globalThis['__stallInv'].state._inventorySession.completedAt).toLocaleString('ru-RU')
      : '';
    earlyBanner =
      '<div class="stall-inventory-early-banner">' +
      '<strong>Сверка завершена досрочно</strong>' +
      (completedStr ? ' — ' + globalThis['__stallInv'].invEscapeHtml(completedStr) : '') +
      '<p class="stall-inventory-early-banner-detail">Проверено стойломест: ' +
      progress.cellsChecked + ' из ' + progress.cellsTotal +
      '. Без места: ' + progress.unassignedChecked + ' из ' + progress.unassignedTotal + '.</p>' +
      '</div>';
  }

  var pendingNew = globalThis['__stallInv'].invFilterPendingNewAnimals(result.newAnimals || []);
  var createNewBtn = (globalThis['__stallInv'].invCanCreateCards() && pendingNew.length)
    ? '<button type="button" class="action-btn no-print" id="stallInvCreateNewBtn">Создать карточки (' + pendingNew.length + ')</button>'
    : '';

  var uncheckedSection = '';
  if (globalThis['__stallInv'].state._inventorySession.finishedEarly) {
    var hasUncheckedCells = result.uncheckedCells && result.uncheckedCells.length;
    var hasNotCheckedUnassigned = result.withoutPlace.notChecked && result.withoutPlace.notChecked.length;
    if (hasUncheckedCells || hasNotCheckedUnassigned) {
      uncheckedSection =
        '<h3 class="stall-inventory-section-title">5. Не проверено</h3>';
      if (hasUncheckedCells) {
        uncheckedSection +=
          '<h4 class="stall-inventory-subtitle">Стойломеста</h4>' +
          invResultTableRows(result.uncheckedCells, [
            { label: 'Стойломесто', render: function (r) { return globalThis['__stallInv'].invEscapeHtml(formatStallLabel(r.yard, r.row, r.place)); } },
            { label: 'Ожидалось', render: function (r) {
              return r.expected && r.expected.cattleId
                ? globalThis['__stallInv'].invEscapeHtml(r.expected.cattleId + (r.expected.nickname ? ' — ' + r.expected.nickname : ''))
                : 'пусто';
            } }
          ]);
      }
      if (hasNotCheckedUnassigned) {
        uncheckedSection +=
          '<h4 class="stall-inventory-subtitle">Животные без места</h4>' +
          invResultTableRows(result.withoutPlace.notChecked, [
            { label: 'Номер', key: 'cattleId' },
            { label: 'Кличка', key: 'nickname' },
            { label: 'Группа', key: 'group' }
          ]);
      }
    }
  }

  host.innerHTML =
    '<div class="inventory-print-root">' +
    '<div class="stall-inventory-actions no-print">' + applyBtn +
    globalThis['__stallInv'].invPrintButtonHtml('stallInvResultPrint') +
    '<button type="button" class="small-btn" id="stallInvNewCheck">Новая сверка</button></div>' +
    earlyBanner +
    '<h3 class="stall-inventory-section-title">1. Поменяли место</h3>' +
    invResultTableRows(result.moved, [
      { label: 'Номер', key: 'cattleId' },
      { label: 'Кличка', key: 'nickname' },
      { label: 'Было', render: function (r) { return globalThis['__stallInv'].invEscapeHtml(formatStallLabel(r.expected.yard, r.expected.row, r.expected.place)); } },
      { label: 'Факт', key: 'actualLabel' }
    ]) +
    '<h3 class="stall-inventory-section-title">2. Новые животные в стаде</h3>' +
    (createNewBtn ? '<div class="stall-inventory-actions no-print">' + createNewBtn + '</div>' : '') +
    invResultTableRows(pendingNew, [
      { label: 'Номер', key: 'cattleId' },
      { label: 'Стойломесто', render: function (r) { return globalThis['__stallInv'].invEscapeHtml(formatStallLabel(r.foundAt.yard, r.foundAt.row, r.foundAt.place)); } }
    ]) +
    '<h3 class="stall-inventory-section-title">3. Нераспределённые</h3>' +
    invResultTableRows(result.unallocated || [], [
      { label: 'Номер', key: 'cattleId' },
      { label: 'Кличка', key: 'nickname' },
      { label: 'Причина', key: 'reason' },
      { label: 'Место в базе', key: 'stallLabel' }
    ]) +
    '<h3 class="stall-inventory-section-title">4. Без места — найдены при обходе</h3>' +
    invResultTableRows(result.withoutPlace.foundDuringCheck, [
      { label: 'Номер', key: 'cattleId' },
      { label: 'Кличка', key: 'nickname' },
      { label: 'Найдено', render: function (r) { return globalThis['__stallInv'].invEscapeHtml(formatStallLabel(r.found.yard, r.found.row, r.found.place)); } }
    ]) +
    uncheckedSection +
    '</div>';

  var createNewEl = host.querySelector('#stallInvCreateNewBtn');
  if (createNewEl) {
    createNewEl.addEventListener('click', function () {
      var btn = createNewEl;
      btn.disabled = true;
      globalThis['__stallInv'].invCreateNewAnimalCards(result.newAnimals || []).finally(function () {
        if (btn.isConnected) btn.disabled = false;
      });
    });
  }

  var applyEl = host.querySelector('#stallInvApplyBtn');
  if (applyEl) {
    applyEl.addEventListener('click', function () {
      var updates = collectApplyUpdates(globalThis['__stallInv'].state._inventorySession, result);
      if (!updates.length) {
        if (typeof showToast === 'function') showToast('Нет изменений для применения', 'info');
        return;
      }
      var list = typeof window.entries !== 'undefined' && Array.isArray(window.entries) ? window.entries : [];
      var changed = [];
      updates.forEach(function (u) {
        for (var i = 0; i < list.length; i++) {
          if (list[i] && cattleIdEqual(list[i].cattleId, u.cattleId)) {
            list[i].stallYard = u.stallYard;
            list[i].stallRow = u.stallRow;
            list[i].stallPlace = u.stallPlace;
            list[i].synced = false;
            changed.push(list[i]);
            break;
          }
        }
      });
      var persist = typeof window.stallMapPersistEntries === 'function'
        ? window.stallMapPersistEntries(changed)
        : Promise.resolve();
      persist.then(function () {
        if (typeof showToast === 'function') showToast('Обновлено записей: ' + changed.length, 'success');
        if (typeof window.stallMapRedrawIfActive === 'function') window.stallMapRedrawIfActive();
        globalThis['__stallInv'].invClearSession();
        globalThis['__stallInv'].invRenderActiveTab();
      }).catch(function (err) {
        if (typeof showToast === 'function') showToast((err && err.message) || 'Ошибка сохранения', 'error');
      });
    });
  }

  var printBtn = host.querySelector('#stallInvResultPrint');
  if (printBtn) {
    printBtn.addEventListener('click', function () {
      var titleEl = document.getElementById('print-doc-title');
      var dateEl = document.getElementById('print-doc-date');
      if (titleEl) titleEl.textContent = 'Результаты инвентаризации стойломест';
      if (dateEl) dateEl.textContent = new Date().toLocaleDateString('ru-RU');
      window.print();
    });
  }

  var newBtn = host.querySelector('#stallInvNewCheck');
  if (newBtn) {
    newBtn.addEventListener('click', function () {
      globalThis['__stallInv'].invClearSession();
      globalThis['__stallInv'].state._inventoryTab = 'check';
      globalThis['__stallInv'].invRenderActiveTab();
    });
  }
}


  // register functions
  NS.invUnassignedList = invUnassignedList;
  NS.invRenderUnassignedCheck = invRenderUnassignedCheck;
  NS.invRenderCheckStart = invRenderCheckStart;
  NS.invRenderCheckTab = invRenderCheckTab;
  NS.invResultTableRows = invResultTableRows;
  NS.invRenderResultTab = invRenderResultTab;
})();
export {};
