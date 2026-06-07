/** __stallMap part 3 */
(function () {
  'use strict';
  var root = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this);
  var NS = root['__stallMap'] = root['__stallMap'] || {};
  var global = root;

function stallMapOnCellClick(yardKey, row, place) {
  var list = (typeof window.entries !== 'undefined' && Array.isArray(window.entries)) ? window.entries : [];
  var occ = globalThis['__stallMap'].stallMapFindAt(list, yardKey, row, place);
  if (occ) {
    globalThis['__stallMap'].stallMapOpenCellModal(yardKey, row, place, occ);
    return;
  }
  globalThis['__stallMap'].state._stallMapAssignTarget = { yardKey: yardKey, row: row, place: place };
  stallMapOpenAssignModal();
}

function stallMapApplyAssignModalInset() {
  if (globalThis['__stallMap'].state._stallMapInsetRaf != null) cancelAnimationFrame(globalThis['__stallMap'].state._stallMapInsetRaf);
  globalThis['__stallMap'].state._stallMapInsetRaf = requestAnimationFrame(function () {
    globalThis['__stallMap'].state._stallMapInsetRaf = null;
    var inner = document.querySelector('.stall-map-assign-modal-inner');
    if (!inner) return;
    var vv = window.visualViewport;
    var pad = 0;
    if (vv) {
      pad = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
    }
    inner.style.paddingBottom = 16 + pad + 'px';
  });
}

function stallMapBindAssignModalViewport() {
  if (globalThis['__stallMap'].state._stallMapViewportListenersBound) return;
  globalThis['__stallMap'].state._stallMapViewportListenersBound = true;
  var handler = function () {
    var modal = document.getElementById('stallMapAssignModal');
    if (modal && modal.classList.contains('active')) stallMapApplyAssignModalInset();
  };
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', handler);
    window.visualViewport.addEventListener('scroll', handler);
  }
  window.addEventListener('resize', handler);
}

function stallMapOpenAssignModal() {
  var modal = document.getElementById('stallMapAssignModal');
  var inp = document.getElementById('stallMapAssignInput');
  var listEl = document.getElementById('stallMapAssignList');
  if (!modal || !inp || !listEl) return;
  inp.value = '';
  listEl.innerHTML = '';
  globalThis['__stallMap'].stallMapRefreshAssignDatalist();
  globalThis['__stallMap'].stallMapSyncAssignInputDatalist();
  modal.classList.add('active');
  modal.setAttribute('aria-hidden', 'false');
  stallMapBindAssignModalViewport();
  stallMapFillAssignSuggestions('');
  globalThis['__stallMap'].stallMapStartAssignInputPoll();
  setTimeout(function () {
    stallMapApplyAssignModalInset();
    inp.focus();
  }, 0);
}

function stallMapCloseAssignModal() {
  globalThis['__stallMap'].stallMapStopAssignInputPoll();
  var modal = document.getElementById('stallMapAssignModal');
  if (!modal) return;
  modal.classList.remove('active');
  modal.setAttribute('aria-hidden', 'true');
  var inner = document.querySelector('.stall-map-assign-modal-inner');
  if (inner) inner.style.paddingBottom = '';
  globalThis['__stallMap'].state._stallMapAssignTarget = null;
}

function stallMapAssignIdMatchesNeedle(idRaw, needleLower) {
  if (!needleLower) return true;
  var id = String(idRaw == null ? '' : idRaw).trim();
  var idLow = id.toLowerCase();
  if (idLow.indexOf(needleLower) !== -1) return true;
  if (/^\d+$/.test(id) && /^\d+$/.test(needleLower)) {
    if (parseInt(id, 10) === parseInt(needleLower, 10)) return true;
    var idNorm = String(parseInt(id, 10));
    if (idNorm.indexOf(needleLower) === 0) return true;
  }
  return false;
}

function stallMapFillAssignSuggestions(q) {
  var listEl = document.getElementById('stallMapAssignList');
  if (!listEl) return;
  var raw = (typeof window.entries !== 'undefined' && Array.isArray(window.entries)) ? window.entries : [];
  var base = typeof window.getVisibleEntries === 'function' ? window.getVisibleEntries(raw) : raw;
  var needle = String(q || '').trim().toLowerCase();
  var max = 40;
  var items = [];
  for (var i = 0; i < base.length; i++) {
    var e = base[i];
    if (!e || e.cattleId == null || String(e.cattleId).trim() === '') continue;
    var nick = (e.nickname && String(e.nickname)) || '';
    if (needle) {
      var nickLow = nick.toLowerCase();
      if (!stallMapAssignIdMatchesNeedle(e.cattleId, needle) && nickLow.indexOf(needle) === -1) continue;
    }
    items.push(e);
    if (items.length >= max * 4) break;
  }
  if (needle) {
    items.sort(function (a, b) {
      var ida = String(a.cattleId).toLowerCase();
      var idb = String(b.cattleId).toLowerCase();
      var pa = ida.indexOf(needle) === 0 ? 0 : ida.indexOf(needle) === -1 ? 2 : 1;
      var pb = idb.indexOf(needle) === 0 ? 0 : idb.indexOf(needle) === -1 ? 2 : 1;
      if (pa !== pb) return pa - pb;
      return ida.localeCompare(idb, 'ru');
    });
    items = items.slice(0, max);
  }
  listEl.innerHTML = items
    .map(function (e) {
      var safeId = globalThis['__stallMap'].escapeAttrStallMap(e.cattleId);
      var label = globalThis['__stallMap'].escapeHtmlStallMap(e.cattleId) + (e.nickname ? ' — ' + globalThis['__stallMap'].escapeHtmlStallMap(e.nickname) : '');
      return '<li><button type="button" class="stall-map-assign-item" data-cattle-id="' + safeId + '">' + label + '</button></li>';
    })
    .join('');
  listEl.querySelectorAll('.stall-map-assign-item').forEach(function (b) {
    function go() {
      var cid = b.getAttribute('data-cattle-id');
      stallMapConfirmAssign(cid);
    }
    b.addEventListener('click', go);
    if (typeof window.isMobile === 'function' && window.isMobile()) {
      b.addEventListener(
        'touchend',
        function (ev) {
          ev.preventDefault();
          go();
        },
        { passive: false }
      );
    }
  });
}

function stallMapConfirmAssign(cattleId) {
  if (!globalThis['__stallMap'].state._stallMapAssignTarget || !cattleId || globalThis['__stallMap'].state._stallMapConfirmAssignBusy) return;
  globalThis['__stallMap'].state._stallMapConfirmAssignBusy = true;
  var t = globalThis['__stallMap'].state._stallMapAssignTarget;
  globalThis['__stallMap'].stallMapAssignCell(t.yardKey, t.row, t.place, cattleId).then(
    function () {
      globalThis['__stallMap'].state._stallMapConfirmAssignBusy = false;
      stallMapCloseAssignModal();
      globalThis['__stallMap'].stallMapRenderGrid();
      globalThis['__stallMap'].stallMapUpdateUnassignedCountUI();
      if (typeof showToast === 'function') showToast('Назначено на стойломесто', 'success');
    },
    function (err) {
      if (typeof showToast === 'function') {
        showToast(err && err.message ? err.message : 'Ошибка сохранения', 'error');
      }
      globalThis['__stallMap'].state._stallMapConfirmAssignBusy = false;
    }
  );
}

function stallMapGetVisibleEntriesForAssign() {
  var raw = (typeof window.entries !== 'undefined' && Array.isArray(window.entries)) ? window.entries : [];
  return typeof window.getVisibleEntries === 'function' ? window.getVisibleEntries(raw) : raw;
}

/**
 * Определяет cattleId по строке из поля: точный номер, «номер — кличка», точная кличка,
 * единственное совпадение по вхождению в номер или кличку.
 */
function stallMapResolveCattleIdFromAssignInput(raw) {
  var v = String(raw || '').trim();
  if (!v) return null;
  var base = stallMapGetVisibleEntriesForAssign();
  var i;
  var partId = v.split(/\s*[—–\-]\s*/)[0].trim();
  if (partId && partId !== v) {
    for (i = 0; i < base.length; i++) {
      var e0 = base[i];
      if (!e0 || e0.cattleId == null) continue;
      if (globalThis['__stallMap'].stallMapCattleIdEqual(e0.cattleId, partId)) return String(e0.cattleId).trim();
    }
  }
  for (i = 0; i < base.length; i++) {
    var e = base[i];
    if (!e || e.cattleId == null) continue;
    if (globalThis['__stallMap'].stallMapCattleIdEqual(e.cattleId, v)) return String(e.cattleId).trim();
  }
  var vLow = v.toLowerCase();
  var nickExact = base.filter(function (en) {
    return en && en.nickname && String(en.nickname).trim().toLowerCase() === vLow;
  });
  if (nickExact.length === 1) return String(nickExact[0].cattleId).trim();
  var idPart = base.filter(function (en) {
    if (!en || en.cattleId == null) return false;
    return stallMapAssignIdMatchesNeedle(en.cattleId, vLow);
  });
  if (idPart.length === 1) return String(idPart[0].cattleId).trim();
  var nickPart = base.filter(function (en) {
    if (!en || !en.nickname) return false;
    return String(en.nickname).toLowerCase().indexOf(vLow) !== -1;
  });
  if (nickPart.length === 1) return String(nickPart[0].cattleId).trim();
  return null;
}

function stallMapAssignSaveFromInput() {
  var inp = document.getElementById('stallMapAssignInput');
  if (!inp) return;
  var resolved = stallMapResolveCattleIdFromAssignInput(inp.value);
  if (!resolved) {
    if (typeof showToast === 'function') {
      showToast('Не найдено однозначное животное: введите точный номер или выберите в списке', 'error');
    }
    return;
  }
  stallMapConfirmAssign(resolved);
}

function stallMapSaveGridFromUI() {
  var objectId = typeof window.getCurrentObjectId === 'function' ? window.getCurrentObjectId() : '';
  var yk = globalThis['__stallMap'].stallMapGetCurrentYardKeyFromUI();
  if (!yk) yk = '1';
  var rowsInp = document.getElementById('stallMapRowsInput');
  var colsInp = document.getElementById('stallMapColsInput');
  var rows = rowsInp ? parseInt(rowsInp.value, 10) : 4;
  var cols = colsInp ? parseInt(colsInp.value, 10) : 10;
  if (!Number.isFinite(rows) || rows < 1) rows = 1;
  if (!Number.isFinite(cols) || cols < 1) cols = 1;
  globalThis['__stallMap'].stallMapSaveGrid(objectId, yk, rows, cols, function () {
    globalThis['__stallMap'].stallMapRenderGrid();
  });
}

function stallMapSyncToolbarInputs() {
  var rowsInp = document.getElementById('stallMapRowsInput');
  var colsInp = document.getElementById('stallMapColsInput');
  var yk = globalThis['__stallMap'].stallMapGetCurrentYardKeyFromUI();
  if (!yk) return;
  var dims = globalThis['__stallMap'].stallMapGetCurrentDims(yk);
  if (!dims) return;
  if (rowsInp) rowsInp.value = String(dims.rows);
  if (colsInp) colsInp.value = String(dims.cols);
}

function stallMapOpenCreateYardModal() {
  var modal = document.getElementById('stallMapCreateYardModal');
  var keyInp = document.getElementById('stallMapCreateYardKeyInput');
  var rowsInp = document.getElementById('stallMapCreateYardRowsInput');
  var colsInp = document.getElementById('stallMapCreateYardColsInput');
  if (!modal || !keyInp) return;
  var yards = (globalThis['__stallMap'].state._stallMapLayoutCache && globalThis['__stallMap'].state._stallMapLayoutCache.yards) || {};
  var nextNum = 1;
  while (yards[String(nextNum)]) nextNum++;
  keyInp.value = String(nextNum);
  if (rowsInp) rowsInp.value = '4';
  if (colsInp) colsInp.value = '10';
  modal.classList.add('active');
  modal.setAttribute('aria-hidden', 'false');
  setTimeout(function () {
    keyInp.focus();
    keyInp.select();
  }, 0);
}

function stallMapCloseCreateYardModal() {
  var modal = document.getElementById('stallMapCreateYardModal');
  if (modal) {
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
  }
}

function stallMapSubmitCreateYard() {
  var keyInp = document.getElementById('stallMapCreateYardKeyInput');
  var rowsInp = document.getElementById('stallMapCreateYardRowsInput');
  var colsInp = document.getElementById('stallMapCreateYardColsInput');
  var yk = keyInp && keyInp.value != null ? String(keyInp.value).trim() : '';
  if (!yk) {
    if (typeof showToast === 'function') showToast('Укажите номер или имя двора', 'error');
    return;
  }
  var rows = rowsInp ? parseInt(rowsInp.value, 10) : 4;
  var cols = colsInp ? parseInt(colsInp.value, 10) : 10;
  if (!Number.isFinite(rows) || rows < 1) rows = 1;
  if (!Number.isFinite(cols) || cols < 1) cols = 1;
  var objectId = typeof window.getCurrentObjectId === 'function' ? window.getCurrentObjectId() : '';
  stallMapCloseCreateYardModal();
  globalThis['__stallMap'].stallMapSaveGrid(objectId, yk, rows, cols, function () {
    var sel = document.getElementById('stallMapYardSelect');
    if (sel) sel.value = yk;
    globalThis['__stallMap'].state._stallMapYardKey = yk;
    globalThis['__stallMap'].stallMapSetToolbarVisible(true);
    stallMapSyncToolbarInputs();
    globalThis['__stallMap'].stallMapRenderGrid();
  });
}

function stallMapBindEntriesUpdatedListener() {
  if (globalThis['__stallMap'].state._stallMapEntriesUiBound) return;
  if (typeof window.CattleTrackerEvents === 'undefined' || typeof window.CattleTrackerEvents.on !== 'function') return;
  globalThis['__stallMap'].state._stallMapEntriesUiBound = true;
  window.CattleTrackerEvents.on('entries:updated', function () {
    var scr = document.getElementById('stall-map-screen');
    if (scr && scr.classList.contains('active')) {
      globalThis['__stallMap'].stallMapUpdateUnassignedCountUI();
      globalThis['__stallMap'].stallMapRenderGrid();
    }
  });
}

/** Перерисовка сетки после возврата из фона / WebView (данные из window.entries не трогаем). */

  // register functions
  NS.stallMapOnCellClick = stallMapOnCellClick;
  NS.stallMapApplyAssignModalInset = stallMapApplyAssignModalInset;
  NS.stallMapBindAssignModalViewport = stallMapBindAssignModalViewport;
  NS.stallMapOpenAssignModal = stallMapOpenAssignModal;
  NS.stallMapCloseAssignModal = stallMapCloseAssignModal;
  NS.stallMapAssignIdMatchesNeedle = stallMapAssignIdMatchesNeedle;
  NS.stallMapFillAssignSuggestions = stallMapFillAssignSuggestions;
  NS.stallMapConfirmAssign = stallMapConfirmAssign;
  NS.stallMapGetVisibleEntriesForAssign = stallMapGetVisibleEntriesForAssign;
  NS.stallMapResolveCattleIdFromAssignInput = stallMapResolveCattleIdFromAssignInput;
  NS.stallMapAssignSaveFromInput = stallMapAssignSaveFromInput;
  NS.stallMapSaveGridFromUI = stallMapSaveGridFromUI;
  NS.stallMapSyncToolbarInputs = stallMapSyncToolbarInputs;
  NS.stallMapOpenCreateYardModal = stallMapOpenCreateYardModal;
  NS.stallMapCloseCreateYardModal = stallMapCloseCreateYardModal;
  NS.stallMapSubmitCreateYard = stallMapSubmitCreateYard;
  NS.stallMapBindEntriesUpdatedListener = stallMapBindEntriesUpdatedListener;
})();
export {};
