/**
 * Инвентаризация стойломест: печатная опись и интерактивная сверка.
 */
import {
  buildStallChecklist,
  buildYardCells,
  createInventorySession,
  recordCellCheck,
  recordUnassignedCheck,
  computeInventoryResult,
  collectApplyUpdates,
  formatStallLabel,
  cattleIdEqual,
  normalizeLayout,
  finishInventorySession,
  getInventoryProgress
} from './stall-inventory-core.js';

var INVENTORY_SESSION_PREFIX = 'cattleTracker_stallInventory_';
var _inventoryTab = 'print';
var _inventorySession = null;
var _inventoryLayout = { yards: {} };
var _inventoryYardCells = [];
var _inventoryAssignPollTimer = null;
var _inventoryAssignPollLast = '';

function invEscapeHtml(text) {
  if (text === undefined || text === null) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function invGetObjectId() {
  return typeof window.getCurrentObjectId === 'function' ? window.getCurrentObjectId() : 'default';
}

function invSessionKey() {
  return INVENTORY_SESSION_PREFIX + invGetObjectId();
}

function invGetEntries() {
  var raw = typeof window.entries !== 'undefined' && Array.isArray(window.entries) ? window.entries : [];
  return typeof window.getVisibleEntries === 'function' ? window.getVisibleEntries(raw) : raw;
}

function invReadLayout() {
  if (typeof window.stallMapReadLayoutLocal === 'function') {
    return window.stallMapReadLayoutLocal(invGetObjectId());
  }
  return normalizeLayout({});
}

function invYardKeys(layout) {
  var yards = layout && layout.yards ? layout.yards : {};
  return Object.keys(yards).filter(function (k) { return String(k).trim(); }).sort(function (a, b) {
    return String(a).localeCompare(String(b), 'ru', { numeric: true });
  });
}

function invSaveSession() {
  if (!_inventorySession) {
    try { sessionStorage.removeItem(invSessionKey()); } catch (e) {}
    return;
  }
  try {
    sessionStorage.setItem(invSessionKey(), JSON.stringify(_inventorySession));
  } catch (e) {
    console.warn('invSaveSession:', e);
  }
}

function invLoadSession() {
  try {
    var raw = sessionStorage.getItem(invSessionKey());
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function invClearSession() {
  _inventorySession = null;
  _inventoryYardCells = [];
  try { sessionStorage.removeItem(invSessionKey()); } catch (e) {}
}

function invIsViewer() {
  var u = typeof window.getCurrentUser === 'function' ? window.getCurrentUser() : null;
  return !!(u && u.role === 'viewer');
}

function invPrintButtonHtml(id) {
  var isMobile = typeof window.isMobile === 'function' && window.isMobile();
  return isMobile ? '' : '<button type="button" class="small-btn" id="' + id + '">Печать</button>';
}

function invYardSelectHtml(id, layout, selected, includeAll) {
  var keys = invYardKeys(layout);
  var html = '<select id="' + id + '" aria-label="Выбор двора">';
  if (includeAll) {
    html += '<option value=""' + (!selected ? ' selected' : '') + '>Все дворы</option>';
  }
  keys.forEach(function (k) {
    html += '<option value="' + invEscapeHtml(k) + '"' + (selected === k ? ' selected' : '') + '>' + invEscapeHtml(k) + '</option>';
  });
  html += '</select>';
  return html;
}

function invBuildPrintTableHtml(checklist, title) {
  var rows = checklist.occupiedCells || [];
  var html = '<h3 class="stall-inventory-section-title">' + invEscapeHtml(title) + '</h3>';
  if (!rows.length) {
    html += '<p class="stall-inventory-muted">Нет занятых стойломест.</p>';
  } else {
    html += '<div class="list-table-wrap inventory-print-root"><table class="list-table inventory-print-table"><thead><tr>' +
      '<th>☐</th><th>Стойломесто</th><th>Номер</th><th>Кличка</th><th>Группа</th></tr></thead><tbody>';
    rows.forEach(function (r) {
      html += '<tr><td></td><td>' + invEscapeHtml(formatStallLabel(r.yard, r.row, r.place)) + '</td>' +
        '<td>' + invEscapeHtml(r.cattleId) + '</td><td>' + invEscapeHtml(r.nickname) + '</td><td>' + invEscapeHtml(r.group) + '</td></tr>';
    });
    html += '</tbody></table></div>';
  }
  return html;
}

function invBuildUnassignedTableHtml(unassigned, withStallCol) {
  var rows = unassigned || [];
  var html = '<h3 class="stall-inventory-section-title">Животные без стойломеста</h3>';
  if (!rows.length) {
    html += '<p class="stall-inventory-muted">Все животные привязаны к стойломестам.</p>';
    return html;
  }
  html += '<div class="list-table-wrap inventory-print-root"><table class="list-table inventory-print-table"><thead><tr>';
  if (withStallCol) html += '<th>☐</th>';
  html += '<th>Номер</th><th>Кличка</th><th>Группа</th></tr></thead><tbody>';
  rows.forEach(function (r) {
    html += '<tr>';
    if (withStallCol) html += '<td></td>';
    html += '<td>' + invEscapeHtml(r.cattleId) + '</td><td>' + invEscapeHtml(r.nickname) + '</td><td>' + invEscapeHtml(r.group) + '</td></tr>';
  });
  html += '</tbody></table></div>';
  return html;
}

function invRenderPrintTab(host) {
  var layout = _inventoryLayout;
  var keys = invYardKeys(layout);
  if (!keys.length) {
    host.innerHTML = '<p class="stall-inventory-muted">Сначала создайте двор на <button type="button" class="link-btn" id="stallInvGoMap">схеме стойломест</button>.</p>';
    var goMap = host.querySelector('#stallInvGoMap');
    if (goMap) goMap.addEventListener('click', function () { window.navigate('stall-map'); });
    return;
  }
  var yardSel = invYardSelectHtml('stallInvPrintYard', layout, '', true);
  host.innerHTML =
    '<div class="stall-inventory-toolbar no-print">' +
    '<label class="stall-map-field"><span>Двор</span>' + yardSel + '</label>' +
    '<div class="stall-inventory-actions">' + invPrintButtonHtml('stallInvPrintBtn') + '</div></div>' +
    '<div id="stallInvPrintWarnings"></div>' +
    '<div id="stallInvPrintBody"></div>';

  function refreshPrint() {
    var yardEl = host.querySelector('#stallInvPrintYard');
    var yardFilter = yardEl && yardEl.value ? yardEl.value : '';
    var checklist = buildStallChecklist(layout, invGetEntries(), yardFilter || undefined);
    var warnEl = host.querySelector('#stallInvPrintWarnings');
    var bodyEl = host.querySelector('#stallInvPrintBody');
    if (warnEl) {
      if (checklist.duplicateWarnings.length) {
        warnEl.innerHTML = '<p class="stall-inventory-warn">⚠ Дубли координат: ' +
          checklist.duplicateWarnings.map(function (w) {
            return invEscapeHtml(w.key) + ' (' + invEscapeHtml(w.cattleIds.join(', ')) + ')';
          }).join('; ') + '</p>';
      } else {
        warnEl.innerHTML = '';
      }
    }
    if (bodyEl) {
      bodyEl.innerHTML =
        invBuildPrintTableHtml(checklist, 'Занятые стойломеста') +
        invBuildUnassignedTableHtml(checklist.unassigned, true);
    }
  }

  refreshPrint();
  var yardEl = host.querySelector('#stallInvPrintYard');
  if (yardEl) yardEl.addEventListener('change', refreshPrint);
  var printBtn = host.querySelector('#stallInvPrintBtn');
  if (printBtn) {
    printBtn.addEventListener('click', function () {
      var titleEl = document.getElementById('print-doc-title');
      var dateEl = document.getElementById('print-doc-date');
      if (titleEl) titleEl.textContent = 'Опись стойломест для инвентаризации';
      if (dateEl) {
        var d = new Date();
        dateEl.textContent = d.toLocaleDateString('ru-RU');
      }
      window.print();
    });
  }
}

function invPrepareYardCells() {
  if (!_inventorySession) return;
  _inventoryYardCells = buildYardCells(_inventoryLayout, _inventorySession.yardKey, _inventorySession.expectedSnapshot);
}

function invCurrentCell() {
  if (!_inventorySession || !_inventoryYardCells.length) return null;
  var idx = _inventorySession.currentCellIndex || 0;
  if (idx < 0 || idx >= _inventoryYardCells.length) return null;
  return _inventoryYardCells[idx];
}

function invCellAlreadyChecked(cell) {
  if (!cell || !_inventorySession) return false;
  var key = cell.yard + '|' + cell.row + '|' + cell.place;
  return !!_inventorySession.cellChecks[key];
}

function invStopAssignPoll() {
  if (_inventoryAssignPollTimer) {
    clearInterval(_inventoryAssignPollTimer);
    _inventoryAssignPollTimer = null;
  }
  _inventoryAssignPollLast = '';
}

function invStartAssignPoll(inputEl) {
  invStopAssignPoll();
  if (typeof window.isMobile !== 'function' || !window.isMobile() || !inputEl) return;
  _inventoryAssignPollTimer = setInterval(function () {
    if (!inputEl.isConnected) {
      invStopAssignPoll();
      return;
    }
    var v = inputEl.value != null ? String(inputEl.value) : '';
    if (v !== _inventoryAssignPollLast) _inventoryAssignPollLast = v;
  }, 100);
}

function invResolveCattleId(raw) {
  var needle = String(raw || '').trim().toLowerCase();
  if (!needle) return null;
  var list = invGetEntries();
  for (var i = 0; i < list.length; i++) {
    var e = list[i];
    if (!e || e.cattleId == null) continue;
    if (String(e.cattleId).trim().toLowerCase() === needle) return String(e.cattleId).trim();
    if (e.nickname && String(e.nickname).trim().toLowerCase() === needle) return String(e.cattleId).trim();
  }
  return null;
}

function invParseActualInput(raw) {
  var v = String(raw || '').trim();
  if (!v) return null;
  var partId = v.split(/\s*[—–\-]\s*/)[0].trim();
  var resolved = invResolveCattleId(partId || v);
  if (resolved) return { cattleId: resolved, inHerd: true };
  var id = partId || v;
  if (!id) return null;
  return { cattleId: id, inHerd: false };
}

function invFilterPendingNewAnimals(newAnimals) {
  var created = (_inventorySession && _inventorySession.createdNewAnimals) || [];
  return (newAnimals || []).filter(function (row) {
    if (!row || !row.cattleId) return false;
    for (var i = 0; i < created.length; i++) {
      if (cattleIdEqual(created[i], row.cattleId)) return false;
    }
    var list = invGetEntries();
    for (var j = 0; j < list.length; j++) {
      if (list[j] && cattleIdEqual(list[j].cattleId, row.cattleId)) return false;
    }
    return true;
  });
}

function invCreateNewAnimalCards(newAnimals) {
  if (invIsViewer()) return Promise.resolve(0);
  var pending = invFilterPendingNewAnimals(newAnimals);
  if (!pending.length) {
    if (typeof showToast === 'function') showToast('Нет новых животных для создания', 'info');
    return Promise.resolve(0);
  }
  if (!_inventorySession.createdNewAnimals) _inventorySession.createdNewAnimals = [];

  var chain = Promise.resolve();
  var created = 0;
  pending.forEach(function (row) {
    chain = chain.then(function () {
      var list = typeof window.entries !== 'undefined' && Array.isArray(window.entries) ? window.entries : [];
      for (var i = 0; i < list.length; i++) {
        if (list[i] && cattleIdEqual(list[i].cattleId, row.cattleId)) {
          return Promise.resolve();
        }
      }
      var entry = typeof getDefaultCowEntry === 'function' ? getDefaultCowEntry() : { cattleId: '' };
      entry.cattleId = row.cattleId;
      entry.stallYard = row.foundAt.yard;
      entry.stallRow = row.foundAt.row;
      entry.stallPlace = row.foundAt.place;
      entry.synced = false;
      if (typeof getCurrentUser === 'function' && getCurrentUser()) {
        entry.userId = getCurrentUser().id;
        entry.lastModifiedBy = getCurrentUser().username;
      }
      var useApi = typeof window !== 'undefined' && window.CATTLE_TRACKER_USE_API && typeof window.createEntryViaApi === 'function';
      if (useApi) {
        return window.createEntryViaApi(entry).then(function () {
          _inventorySession.createdNewAnimals.push(row.cattleId);
          created++;
        });
      }
      if (list.some(function (e) { return e && cattleIdEqual(e.cattleId, row.cattleId); })) {
        return Promise.resolve();
      }
      list.unshift(entry);
      if (typeof saveLocally === 'function') saveLocally();
      _inventorySession.createdNewAnimals.push(row.cattleId);
      created++;
      return Promise.resolve();
    });
  });

  return chain.then(function () {
    invSaveSession();
    if (typeof updateViewList === 'function') updateViewList();
    if (typeof window.stallMapRedrawIfActive === 'function') window.stallMapRedrawIfActive();
    if (typeof showToast === 'function') showToast('Создано карточек: ' + created, created ? 'success' : 'info');
    invRenderActiveTab();
    return created;
  }).catch(function (err) {
    if (typeof showToast === 'function') showToast((err && err.message) || 'Ошибка создания карточек', 'error');
    throw err;
  });
}

function invAdvanceAfterCellCheck() {
  if (!_inventorySession) return;
  _inventorySession.currentCellIndex = (_inventorySession.currentCellIndex || 0) + 1;
  if (_inventorySession.currentCellIndex >= _inventoryYardCells.length) {
    _inventorySession.phase = 'unassigned';
    _inventorySession.currentCellIndex = 0;
  }
  invSaveSession();
  invRenderActiveTab();
}

function invFinishCheckComplete() {
  if (!_inventorySession) return;
  finishInventorySession(_inventorySession, { early: false });
  invSaveSession();
  _inventoryTab = 'result';
  invRenderActiveTab();
}

function invFinishCheckEarly() {
  if (!_inventorySession) return;
  var progress = getInventoryProgress(_inventorySession, _inventoryYardCells);
  var msg = 'Завершить сверку досрочно?\n\n' +
    'Проверено стойломест: ' + progress.cellsChecked + ' из ' + progress.cellsTotal + '.\n' +
    'Без места: ' + progress.unassignedChecked + ' из ' + progress.unassignedTotal + '.\n\n' +
    'Непроверенные позиции не войдут в несостыковки.';
  if (!confirm(msg)) return;
  finishInventorySession(_inventorySession, { early: true });
  invSaveSession();
  _inventoryTab = 'result';
  invRenderActiveTab();
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
        invClearSession();
        invRenderActiveTab();
      }
    });
  }
}

function invRenderCellCheck(host) {
  var cell = invCurrentCell();
  if (!cell) {
    _inventorySession.phase = 'unassigned';
    invSaveSession();
    invRenderActiveTab();
    return;
  }
  var idx = _inventorySession.currentCellIndex || 0;
  var total = _inventoryYardCells.length;
  var exp = cell.expected;
  var expText = exp
    ? (invEscapeHtml(exp.cattleId) + (exp.nickname ? ' — ' + invEscapeHtml(exp.nickname) : ''))
    : 'пусто';

  host.innerHTML =
    '<div class="stall-inventory-progress">Стойломесто ' + (idx + 1) + ' из ' + total + '</div>' +
    '<div class="stall-inventory-cell-card">' +
    '<p class="stall-inventory-cell-coords">' + invEscapeHtml(formatStallLabel(cell.yard, cell.row, cell.place)) + '</p>' +
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
    var parsed = invParseActualInput(otherInput.value);
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
    var parsed = invParseActualInput(otherInput ? otherInput.value : '');
    if (!parsed) {
      if (typeof showToast === 'function') showToast('Введите номер животного', 'error');
      return;
    }
    recordCellCheck(_inventorySession, cell.yard, cell.row, cell.place, 'other', parsed.cattleId, !parsed.inHerd);
    invStopAssignPoll();
    invAdvanceAfterCellCheck();
  }

  if (okBtn) {
    okBtn.addEventListener('click', function () {
      recordCellCheck(_inventorySession, cell.yard, cell.row, cell.place, 'ok');
      invAdvanceAfterCellCheck();
    });
  }
  if (emptyBtn) {
    emptyBtn.addEventListener('click', function () {
      recordCellCheck(_inventorySession, cell.yard, cell.row, cell.place, 'empty');
      invAdvanceAfterCellCheck();
    });
  }
  if (otherBtn && otherWrap && otherInput) {
    otherBtn.addEventListener('click', function () {
      otherMode = !otherMode;
      otherWrap.hidden = !otherMode;
      if (otherMode) {
        otherInput.focus();
        invStartAssignPoll(otherInput);
        updateOtherHint();
      } else {
        invStopAssignPoll();
        if (otherHint) otherHint.hidden = true;
      }
    });
    otherInput.addEventListener('input', updateOtherHint);
    otherInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        submitOther();
      }
    });
  }
  if (otherSaveBtn) {
    otherSaveBtn.addEventListener('click', submitOther);
  }

  invBindFinishEarlyButton(host);
  invBindCancelCheckButton(host);
}

function invUnassignedList() {
  if (!_inventorySession) return [];
  var out = [];
  (_inventorySession.expectedSnapshot || []).forEach(function (e) {
    if (!e || !e.cattleId) return;
    var has = e.stallYard && e.stallRow !== '' && e.stallPlace !== '';
    if (!has) out.push(e);
  });
  return out;
}

function invRenderUnassignedCheck(host) {
  var list = invUnassignedList();
  if (!list.length) {
    invFinishCheckComplete();
    return;
  }

  var idx = _inventorySession.currentCellIndex || 0;
  if (idx >= list.length) {
    invFinishCheckComplete();
    return;
  }

  var entry = list[idx];
  host.innerHTML =
    '<div class="stall-inventory-progress">Без места: ' + (idx + 1) + ' из ' + list.length + '</div>' +
    '<div class="stall-inventory-cell-card">' +
    '<p><strong>' + invEscapeHtml(entry.cattleId) + '</strong>' +
    (entry.nickname ? ' — ' + invEscapeHtml(entry.nickname) : '') + '</p>' +
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
        if (yIn) yIn.value = _inventorySession.yardKey || '';
        return;
      }
      var yard = (host.querySelector('#stallInvFoundYard') || {}).value;
      var row = parseInt((host.querySelector('#stallInvFoundRow') || {}).value, 10);
      var place = parseInt((host.querySelector('#stallInvFoundPlace') || {}).value, 10);
      if (!String(yard || '').trim() || !Number.isFinite(row) || !Number.isFinite(place)) {
        if (typeof showToast === 'function') showToast('Укажите двор, ряд и место', 'error');
        return;
      }
      recordUnassignedCheck(_inventorySession, entry.cattleId, 'found', { yard: yard, row: row, place: place });
      _inventorySession.currentCellIndex = idx + 1;
      invSaveSession();
      invRenderActiveTab();
    });
  }
  if (notFoundBtn) {
    notFoundBtn.addEventListener('click', function () {
      recordUnassignedCheck(_inventorySession, entry.cattleId, 'not_found');
      _inventorySession.currentCellIndex = idx + 1;
      invSaveSession();
      invRenderActiveTab();
    });
  }

  invBindFinishEarlyButton(host);
  invBindCancelCheckButton(host);
}

function invRenderCheckStart(host) {
  var layout = _inventoryLayout;
  var keys = invYardKeys(layout);
  var saved = invLoadSession();
  var resumeHtml = saved
    ? '<p class="stall-inventory-resume">Есть незавершённая сверка (двор «' + invEscapeHtml(saved.yardKey || '') + '»). ' +
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
        _inventorySession = saved;
        invPrepareYardCells();
        invRenderActiveTab();
      });
    }
    return;
  }

  host.innerHTML =
    resumeHtml +
    '<div class="stall-inventory-toolbar">' +
    '<label class="stall-map-field"><span>Двор для обхода</span>' +
    invYardSelectHtml('stallInvCheckYard', layout, keys[0], false) + '</label>' +
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
      _inventorySession = createInventorySession(invGetObjectId(), yard, invGetEntries());
      invPrepareYardCells();
      invSaveSession();
      invRenderActiveTab();
    });
  }
  var resumeBtn = host.querySelector('#stallInvResumeBtn');
  if (resumeBtn) {
    resumeBtn.addEventListener('click', function () {
      _inventorySession = saved;
      invPrepareYardCells();
      invRenderActiveTab();
    });
  }
}

function invRenderCheckTab(host) {
  if (!_inventorySession) {
    invRenderCheckStart(host);
    return;
  }
  if (_inventorySession.phase === 'cells') {
    invRenderCellCheck(host);
    return;
  }
  if (_inventorySession.phase === 'unassigned') {
    invRenderUnassignedCheck(host);
    return;
  }
  _inventoryTab = 'result';
  invRenderActiveTab();
}

function invResultTableRows(rows, cols) {
  if (!rows.length) return '<p class="stall-inventory-muted">Нет записей.</p>';
  var html = '<div class="list-table-wrap"><table class="list-table"><thead><tr>';
  cols.forEach(function (c) { html += '<th>' + invEscapeHtml(c.label) + '</th>'; });
  html += '</tr></thead><tbody>';
  rows.forEach(function (r) {
    html += '<tr>';
    cols.forEach(function (c) {
      html += '<td>' + (typeof c.render === 'function' ? c.render(r) : invEscapeHtml(r[c.key])) + '</td>';
    });
    html += '</tr>';
  });
  html += '</tbody></table></div>';
  return html;
}

function invRenderResultTab(host) {
  if (!_inventorySession || _inventorySession.phase !== 'done') {
    host.innerHTML = '<p class="stall-inventory-muted">Сначала завершите сверку на вкладке «Сверка».</p>';
    return;
  }
  var result = computeInventoryResult(_inventorySession, _inventorySession.expectedSnapshot, {
    layout: _inventoryLayout,
    yardCells: _inventoryYardCells
  });
  var progress = result.progress || getInventoryProgress(_inventorySession, _inventoryYardCells);
  var applyBtn = invIsViewer()
    ? ''
    : '<button type="button" class="action-btn" id="stallInvApplyBtn">Применить места по результатам</button>';

  var earlyBanner = '';
  if (_inventorySession.finishedEarly) {
    var completedStr = _inventorySession.completedAt
      ? new Date(_inventorySession.completedAt).toLocaleString('ru-RU')
      : '';
    earlyBanner =
      '<div class="stall-inventory-early-banner">' +
      '<strong>Сверка завершена досрочно</strong>' +
      (completedStr ? ' — ' + invEscapeHtml(completedStr) : '') +
      '<p class="stall-inventory-early-banner-detail">Проверено стойломест: ' +
      progress.cellsChecked + ' из ' + progress.cellsTotal +
      '. Без места: ' + progress.unassignedChecked + ' из ' + progress.unassignedTotal + '.</p>' +
      '</div>';
  }

  var pendingNew = invFilterPendingNewAnimals(result.newAnimals || []);
  var createNewBtn = (!invIsViewer() && pendingNew.length)
    ? '<button type="button" class="action-btn no-print" id="stallInvCreateNewBtn">Создать карточки (' + pendingNew.length + ')</button>'
    : '';

  var uncheckedSection = '';
  if (_inventorySession.finishedEarly) {
    var hasUncheckedCells = result.uncheckedCells && result.uncheckedCells.length;
    var hasNotCheckedUnassigned = result.withoutPlace.notChecked && result.withoutPlace.notChecked.length;
    if (hasUncheckedCells || hasNotCheckedUnassigned) {
      uncheckedSection =
        '<h3 class="stall-inventory-section-title">5. Не проверено</h3>';
      if (hasUncheckedCells) {
        uncheckedSection +=
          '<h4 class="stall-inventory-subtitle">Стойломеста</h4>' +
          invResultTableRows(result.uncheckedCells, [
            { label: 'Стойломесто', render: function (r) { return invEscapeHtml(formatStallLabel(r.yard, r.row, r.place)); } },
            { label: 'Ожидалось', render: function (r) {
              return r.expected && r.expected.cattleId
                ? invEscapeHtml(r.expected.cattleId + (r.expected.nickname ? ' — ' + r.expected.nickname : ''))
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
    invPrintButtonHtml('stallInvResultPrint') +
    '<button type="button" class="small-btn" id="stallInvNewCheck">Новая сверка</button></div>' +
    earlyBanner +
    '<h3 class="stall-inventory-section-title">1. Поменяли место</h3>' +
    invResultTableRows(result.moved, [
      { label: 'Номер', key: 'cattleId' },
      { label: 'Кличка', key: 'nickname' },
      { label: 'Было', render: function (r) { return invEscapeHtml(formatStallLabel(r.expected.yard, r.expected.row, r.expected.place)); } },
      { label: 'Факт', key: 'actualLabel' }
    ]) +
    '<h3 class="stall-inventory-section-title">2. Новые животные в стаде</h3>' +
    (createNewBtn ? '<div class="stall-inventory-actions no-print">' + createNewBtn + '</div>' : '') +
    invResultTableRows(pendingNew.length ? pendingNew : (result.newAnimals || []), [
      { label: 'Номер', key: 'cattleId' },
      { label: 'Стойломесто', render: function (r) { return invEscapeHtml(formatStallLabel(r.foundAt.yard, r.foundAt.row, r.foundAt.place)); } }
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
      { label: 'Найдено', render: function (r) { return invEscapeHtml(formatStallLabel(r.found.yard, r.found.row, r.found.place)); } }
    ]) +
    uncheckedSection +
    '</div>';

  var createNewEl = host.querySelector('#stallInvCreateNewBtn');
  if (createNewEl) {
    createNewEl.addEventListener('click', function () {
      invCreateNewAnimalCards(result.newAnimals);
    });
  }

  var applyEl = host.querySelector('#stallInvApplyBtn');
  if (applyEl) {
    applyEl.addEventListener('click', function () {
      var updates = collectApplyUpdates(_inventorySession, result);
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
        invClearSession();
        invRenderActiveTab();
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
      invClearSession();
      _inventoryTab = 'check';
      invRenderActiveTab();
    });
  }
}

function invRenderActiveTab() {
  var host = document.getElementById('stallInventoryContent');
  if (!host) return;
  invStopAssignPoll();

  document.querySelectorAll('.stall-inventory-tab').forEach(function (btn) {
    btn.classList.toggle('active', btn.getAttribute('data-tab') === _inventoryTab);
  });

  if (_inventoryTab === 'print') invRenderPrintTab(host);
  else if (_inventoryTab === 'check') invRenderCheckTab(host);
  else invRenderResultTab(host);
}

function initStallInventoryScreen() {
  _inventoryLayout = invReadLayout();
  if (!_inventorySession) {
    var saved = invLoadSession();
    if (saved && saved.objectId === invGetObjectId()) {
      _inventorySession = saved;
      invPrepareYardCells();
      if (saved.phase === 'done') _inventoryTab = 'result';
      else if (saved.phase) _inventoryTab = 'check';
    }
  }

  document.querySelectorAll('.stall-inventory-tab').forEach(function (btn) {
    if (btn.dataset.bound) return;
    btn.dataset.bound = '1';
    btn.addEventListener('click', function () {
      _inventoryTab = btn.getAttribute('data-tab') || 'print';
      invRenderActiveTab();
    });
  });

  invRenderActiveTab();
}

if (typeof window !== 'undefined') {
  window.initStallInventoryScreen = initStallInventoryScreen;
}

export {};
