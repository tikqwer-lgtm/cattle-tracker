/** __stallInv part 1 */
(function () {
  'use strict';
  var root = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this);
  var NS = root['__stallInv'] = root['__stallInv'] || {};
  var global = typeof window !== 'undefined' ? window : this;

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
  return globalThis['__stallInv'].state.INVENTORY_SESSION_PREFIX + invGetObjectId();
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
  if (!globalThis['__stallInv'].state._inventorySession) {
    try { sessionStorage.removeItem(invSessionKey()); } catch (e) {}
    return;
  }
  try {
    sessionStorage.setItem(invSessionKey(), JSON.stringify(globalThis['__stallInv'].state._inventorySession));
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
  globalThis['__stallInv'].state._inventorySession = null;
  _inventoryYardCells = [];
  try { sessionStorage.removeItem(invSessionKey()); } catch (e) {}
}

function invIsViewer() {
  var u = typeof window.getCurrentUser === 'function' ? window.getCurrentUser() : null;
  return !!(u && u.role === 'viewer');
}

function invToast(text, type) {
  if (typeof window.showToast === 'function') {
    window.showToast(text, type);
    return;
  }
  if (type === 'error') console.error(text);
  else console.log(text);
}

function invCanCreateCards() {
  if (typeof window.canAdd === 'function') return window.canAdd();
  return !invIsViewer();
}

function invGetActiveObjectId() {
  var oid = typeof window.getCurrentObjectId === 'function' ? window.getCurrentObjectId() : 'default';
  var pend = window.CattleTrackerApi && window.CattleTrackerApi.PENDING_OBJECT_ID;
  if (pend && oid === pend) return null;
  return oid || null;
}

function invPersistNewAnimalEntry(entry) {
  var useApi = !!(window.CATTLE_TRACKER_USE_API && window.CattleTrackerApi);
  var objectId = invGetActiveObjectId();
  if (useApi) {
    if (!objectId) {
      return Promise.reject(new Error('Сначала выберите базу в разделе «Синхронизация»'));
    }
    if (typeof window.createEntryViaApi === 'function') {
      return window.createEntryViaApi(entry);
    }
    return window.CattleTrackerApi.createEntry(objectId, entry).then(function (created) {
      if (typeof window.upsertEntryInStore === 'function') {
        window.upsertEntryInStore(created && created.cattleId ? created : entry);
      }
      globalThis['__stallInv'].invRefreshEntriesUi();
      return created || entry;
    });
  }
  if (typeof window.upsertEntryInStore === 'function') {
    window.upsertEntryInStore(entry);
  } else {
    var list = typeof window.entries !== 'undefined' && Array.isArray(window.entries) ? window.entries : [];
    list.unshift(entry);
    if (typeof window.replaceEntriesWith === 'function') window.replaceEntriesWith(list);
  }
  if (typeof window.saveLocally === 'function') window.saveLocally();
  globalThis['__stallInv'].invRefreshEntriesUi();
  return Promise.resolve(entry);
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

  globalThis['__stallInv'].refreshPrint();
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
  if (!globalThis['__stallInv'].state._inventorySession) return;
  _inventoryYardCells = buildYardCells(_inventoryLayout, globalThis['__stallInv'].state._inventorySession.yardKey, globalThis['__stallInv'].state._inventorySession.expectedSnapshot);
}

function invCurrentCell() {
  if (!globalThis['__stallInv'].state._inventorySession || !_inventoryYardCells.length) return null;
  var idx = globalThis['__stallInv'].state._inventorySession.currentCellIndex || 0;
  if (idx < 0 || idx >= _inventoryYardCells.length) return null;
  return _inventoryYardCells[idx];
}

function invCellAlreadyChecked(cell) {
  if (!cell || !globalThis['__stallInv'].state._inventorySession) return false;
  var key = cell.yard + '|' + cell.row + '|' + cell.place;
  return !!globalThis['__stallInv'].state._inventorySession.cellChecks[key];
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


  // register functions
  NS.invEscapeHtml = invEscapeHtml;
  NS.invGetObjectId = invGetObjectId;
  NS.invSessionKey = invSessionKey;
  NS.invGetEntries = invGetEntries;
  NS.invReadLayout = invReadLayout;
  NS.invYardKeys = invYardKeys;
  NS.invSaveSession = invSaveSession;
  NS.invLoadSession = invLoadSession;
  NS.invClearSession = invClearSession;
  NS.invIsViewer = invIsViewer;
  NS.invToast = invToast;
  NS.invCanCreateCards = invCanCreateCards;
  NS.invGetActiveObjectId = invGetActiveObjectId;
  NS.invPersistNewAnimalEntry = invPersistNewAnimalEntry;
  NS.invPrintButtonHtml = invPrintButtonHtml;
  NS.invYardSelectHtml = invYardSelectHtml;
  NS.invBuildPrintTableHtml = invBuildPrintTableHtml;
  NS.invBuildUnassignedTableHtml = invBuildUnassignedTableHtml;
  NS.invRenderPrintTab = invRenderPrintTab;
  NS.invPrepareYardCells = invPrepareYardCells;
  NS.invCurrentCell = invCurrentCell;
  NS.invCellAlreadyChecked = invCellAlreadyChecked;
  NS.invStopAssignPoll = invStopAssignPoll;
  NS.invStartAssignPoll = invStartAssignPoll;
  NS.invResolveCattleId = invResolveCattleId;
  NS.invParseActualInput = invParseActualInput;
})();
export {};
