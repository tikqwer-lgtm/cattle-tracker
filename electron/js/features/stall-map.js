// stall-map.js — схема стойломест (сетка по дворам), координаты на карточке животного

var STALL_LAYOUT_STORAGE_PREFIX = 'cattleTracker_stallLayout_';

var _stallMapLayoutCache = { yards: {} };
var _stallMapYardKey = '1';
var _stallMapAssignTarget = null;
var _stallMapCellModalCtx = null;

function stallMapNormalizeLayout(raw) {
  var out = { yards: {} };
  if (!raw || typeof raw !== 'object') return out;
  var yards = raw.yards;
  if (!yards || typeof yards !== 'object') return out;
  Object.keys(yards).forEach(function (k) {
    var key = String(k).trim();
    if (!key) return;
    var y = yards[k];
    if (!y || typeof y !== 'object') return;
    var rows = parseInt(y.rows, 10);
    var cols = parseInt(y.cols, 10);
    if (!Number.isFinite(rows) || rows < 1) rows = 1;
    if (rows > 200) rows = 200;
    if (!Number.isFinite(cols) || cols < 1) cols = 1;
    if (cols > 200) cols = 200;
    out.yards[key] = { rows: rows, cols: cols };
  });
  return out;
}

function stallMapReadLayoutLocal(objectId) {
  if (!objectId) return { yards: {} };
  try {
    var raw = localStorage.getItem(STALL_LAYOUT_STORAGE_PREFIX + objectId);
    if (!raw) return { yards: {} };
    var j = JSON.parse(raw);
    return stallMapNormalizeLayout(j);
  } catch (e) {
    return { yards: {} };
  }
}

function stallMapWriteLayoutLocal(objectId, layout) {
  if (!objectId) return;
  try {
    var norm = stallMapNormalizeLayout(layout);
    localStorage.setItem(STALL_LAYOUT_STORAGE_PREFIX + objectId, JSON.stringify(norm));
  } catch (e) {
    console.warn('stallMapWriteLayoutLocal:', e);
  }
}

function stallMapEntryYard(e) {
  if (!e || e.stallYard == null || e.stallYard === '') return '';
  return String(e.stallYard).trim();
}

function stallMapYardNorm(key) {
  return String(key == null ? '' : key).trim();
}

function stallMapEntryIntField(v) {
  if (v === '' || v === undefined || v === null) return null;
  var n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

function stallMapFindAt(entries, yardKey, row, place) {
  var yk = stallMapYardNorm(yardKey);
  var list = entries || [];
  var r = parseInt(row, 10);
  var pl = parseInt(place, 10);
  if (!Number.isFinite(r) || !Number.isFinite(pl)) return null;
  for (var i = 0; i < list.length; i++) {
    var e = list[i];
    if (!e) continue;
    if (stallMapYardNorm(stallMapEntryYard(e)) !== yk) continue;
    if (stallMapEntryIntField(e.stallRow) !== r) continue;
    if (stallMapEntryIntField(e.stallPlace) !== pl) continue;
    return e;
  }
  return null;
}

function stallMapClearCoords(e) {
  if (!e) return;
  e.stallYard = '';
  e.stallRow = '';
  e.stallPlace = '';
}

function stallMapPersistEntry(entry) {
  if (!entry || !entry.cattleId) return Promise.resolve();
  entry.synced = false;
  if (typeof window.saveLocally === 'function') window.saveLocally();
  var useApi = window.CATTLE_TRACKER_USE_API && typeof window.updateEntryViaApi === 'function';
  if (useApi) {
    return window.updateEntryViaApi(entry.cattleId, entry).catch(function (err) {
      if (typeof showToast === 'function') showToast(err && err.message ? err.message : 'Ошибка сохранения', 'error');
    });
  }
  return Promise.resolve();
}

function stallMapPersistEntries(entries) {
  if (!entries || !entries.length) return Promise.resolve();
  var chain = Promise.resolve();
  entries.forEach(function (en) {
    chain = chain.then(function () {
      return stallMapPersistEntry(en);
    });
  });
  return chain;
}

function stallMapAssignCell(yardKey, row, place, cattleId) {
  var list = (typeof window.entries !== 'undefined' && Array.isArray(window.entries)) ? window.entries : [];
  var target = list.filter(function (e) { return e && e.cattleId === cattleId; })[0];
  if (!target) {
    if (typeof showToast === 'function') showToast('Животное не найдено', 'error');
    return Promise.resolve();
  }
  var changed = [];
  var prev = stallMapFindAt(list, yardKey, row, place);
  if (prev && prev.cattleId !== cattleId) {
    stallMapClearCoords(prev);
    changed.push(prev);
  }
  target.stallYard = stallMapYardNorm(yardKey);
  target.stallRow = row;
  target.stallPlace = place;
  if (changed.indexOf(target) === -1) changed.push(target);
  try {
    stallMapRenderGrid();
  } catch (grErr) {
    console.warn('stallMapRenderGrid:', grErr);
  }
  return stallMapPersistEntries(changed);
}

function stallMapUnassignCell(yardKey, row, place) {
  var list = (typeof window.entries !== 'undefined' && Array.isArray(window.entries)) ? window.entries : [];
  var e = stallMapFindAt(list, yardKey, row, place);
  if (!e) return Promise.resolve();
  stallMapClearCoords(e);
  try {
    stallMapRenderGrid();
  } catch (grErr2) {
    console.warn('stallMapRenderGrid:', grErr2);
  }
  return stallMapPersistEntry(e);
}

function stallMapLoadLayout(objectId, callback) {
  var done = typeof callback === 'function' ? callback : function () {};
  var useApi = window.CATTLE_TRACKER_USE_API && window.CattleTrackerApi && typeof window.CattleTrackerApi.getStallLayout === 'function';
  if (useApi && objectId) {
    window.CattleTrackerApi.getStallLayout(objectId).then(function (data) {
      _stallMapLayoutCache = stallMapNormalizeLayout(data);
      stallMapWriteLayoutLocal(objectId, _stallMapLayoutCache);
      stallMapRefreshYardDatalist();
      done(null, _stallMapLayoutCache);
    }).catch(function () {
      _stallMapLayoutCache = stallMapReadLayoutLocal(objectId);
      stallMapRefreshYardDatalist();
      done(null, _stallMapLayoutCache);
    });
    return;
  }
  _stallMapLayoutCache = stallMapReadLayoutLocal(objectId);
  stallMapRefreshYardDatalist();
  done(null, _stallMapLayoutCache);
}

function stallMapSaveGrid(objectId, yardKey, rows, cols, callback) {
  var yk = String(yardKey || '').trim() || '1';
  var layout = stallMapNormalizeLayout(_stallMapLayoutCache);
  layout.yards[yk] = { rows: rows, cols: cols };
  _stallMapLayoutCache = layout;
  stallMapWriteLayoutLocal(objectId, layout);
  var useApi = window.CATTLE_TRACKER_USE_API && window.CattleTrackerApi && typeof window.CattleTrackerApi.putStallLayout === 'function';
  if (useApi && objectId) {
    window.CattleTrackerApi.putStallLayout(objectId, layout).then(function (data) {
      _stallMapLayoutCache = stallMapNormalizeLayout(data);
      stallMapWriteLayoutLocal(objectId, _stallMapLayoutCache);
      stallMapRefreshYardDatalist();
      if (typeof showToast === 'function') showToast('Сетка сохранена', 'success');
      if (typeof callback === 'function') callback();
    }).catch(function (err) {
      if (typeof showToast === 'function') showToast(err && err.message ? err.message : 'Ошибка сохранения сетки', 'error');
      if (typeof callback === 'function') callback();
    });
    return;
  }
  stallMapRefreshYardDatalist();
  if (typeof showToast === 'function') showToast('Сетка сохранена локально', 'success');
  if (typeof callback === 'function') callback();
}

function stallMapGetCurrentDims(yardKey) {
  var yk = String(yardKey || '').trim() || '1';
  var y = _stallMapLayoutCache.yards && _stallMapLayoutCache.yards[yk];
  if (y && y.rows && y.cols) return { rows: y.rows, cols: y.cols };
  return { rows: 4, cols: 10 };
}

function stallMapRenderGrid() {
  var wrap = document.getElementById('stallMapGridWrap');
  if (!wrap) return;
  var yardInp = document.getElementById('stallMapYardInput');
  var yk = yardInp && yardInp.value != null ? String(yardInp.value).trim() : _stallMapYardKey;
  if (!yk) yk = '1';
  _stallMapYardKey = yk;
  var dims = stallMapGetCurrentDims(yk);
  var rows = dims.rows;
  var cols = dims.cols;
  var entries = (typeof window.entries !== 'undefined' && Array.isArray(window.entries)) ? window.entries : [];

  wrap.style.display = 'grid';
  /* Ряды (r) — столбцы сетки; места (p) — сверху вниз в столбце (grid-auto-flow: column) */
  wrap.style.gridAutoFlow = 'column';
  wrap.style.gridTemplateColumns = 'repeat(' + rows + ', minmax(64px, 1fr))';
  wrap.style.gridTemplateRows = 'repeat(' + cols + ', minmax(56px, auto))';
  wrap.className = 'stall-map-grid-wrap stall-map-grid-barn';

  var html = '';
  for (var r = 1; r <= rows; r++) {
    for (var p = 1; p <= cols; p++) {
      var occ = stallMapFindAt(entries, yk, r, p);
      var label = r + '·' + p;
      var titleBase = 'Ряд ' + r + ', место ' + p;
      var inner;
      var tip = titleBase;
      if (occ) {
        var stRaw = occ.status != null ? String(occ.status).trim() : '';
        var stDisp = stRaw ? escapeHtmlStallMap(stRaw) : '—';
        var dp = typeof window.getDaysPregnant === 'function' ? window.getDaysPregnant(occ) : null;
        var di = typeof window.getDaysSinceLastInsemination === 'function' ? window.getDaysSinceLastInsemination(occ) : null;
        var dl = typeof window.getDaysInLactation === 'function' ? window.getDaysInLactation(occ) : null;
        var metaParts = [];
        if (dp != null) metaParts.push('Ст' + dp);
        if (di != null) metaParts.push('Ос' + di);
        if (dl != null) metaParts.push('От' + dl);
        var metaHtml = metaParts.length
          ? '<span class="stall-map-cell-meta">' + escapeHtmlStallMap(metaParts.join(' · ')) + '</span>'
          : '';
        var nickHtml = occ.nickname ? '<span class="stall-map-cell-nick">' + escapeHtmlStallMap(occ.nickname) + '</span>' : '';
        inner =
          '<span class="stall-map-cell-id">' + escapeHtmlStallMap(occ.cattleId) + '</span>' +
          '<span class="stall-map-cell-status">' + stDisp + '</span>' +
          nickHtml +
          metaHtml;
        tip =
          titleBase +
          '. №' +
          occ.cattleId +
          (stRaw ? '. ' + stRaw : '') +
          (dp != null ? '. Дни стельности: ' + dp : '') +
          (di != null ? '. Дней от осеменения: ' + di : '') +
          (dl != null ? '. Дней от отёла: ' + dl : '');
      } else {
        inner = '<span class="stall-map-cell-empty">пусто</span>';
      }
      var cls = 'stall-map-cell' + (occ ? ' stall-map-cell-occupied' : ' stall-map-cell-free');
      html +=
        '<button type="button" class="' + cls + '" data-yard="' + escapeAttrStallMap(yk) + '" data-row="' + r + '" data-place="' + p + '" title="' + escapeAttrStallMap(tip) + '">' +
        '<span class="stall-map-cell-pos">' + label + '</span>' +
        inner +
        '</button>';
    }
  }
  wrap.innerHTML = html;

  var canEdit = typeof window.canEdit !== 'function' || window.canEdit();
  wrap.querySelectorAll('.stall-map-cell').forEach(function (btn) {
    if (!canEdit) {
      btn.disabled = true;
      btn.classList.add('stall-map-cell-readonly');
      return;
    }
    btn.addEventListener('click', function () {
      var yard = btn.getAttribute('data-yard') || yk;
      var row = parseInt(btn.getAttribute('data-row'), 10);
      var place = parseInt(btn.getAttribute('data-place'), 10);
      stallMapOnCellClick(yard, row, place);
    });
  });
}

function escapeHtmlStallMap(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttrStallMap(s) {
  return escapeHtmlStallMap(s).replace(/'/g, '&#39;');
}

/** Подсказки номеров/кличек для поля назначения (HTML datalist). */
function stallMapRefreshAssignDatalist() {
  var dl = document.getElementById('stallMapAssignDatalist');
  if (!dl) return;
  var raw = (typeof window.entries !== 'undefined' && Array.isArray(window.entries)) ? window.entries : [];
  var base = typeof window.getVisibleEntries === 'function' ? window.getVisibleEntries(raw) : raw;
  dl.innerHTML = '';
  var seen = {};
  for (var i = 0; i < base.length; i++) {
    var e = base[i];
    if (!e || !e.cattleId) continue;
    var id = String(e.cattleId).trim();
    if (!id || seen[id]) continue;
    seen[id] = true;
    var opt = document.createElement('option');
    opt.value = id;
    var nick = e.nickname != null ? String(e.nickname).trim() : '';
    opt.textContent = nick ? id + ' — ' + nick : id;
    dl.appendChild(opt);
  }
}

/** Подсказки номеров дворов из сохранённой сетки и текущего ввода. */
function stallMapRefreshYardDatalist() {
  var dl = document.getElementById('stallMapYardDatalist');
  if (!dl) return;
  var yards = _stallMapLayoutCache.yards || {};
  var keySet = {};
  Object.keys(yards).forEach(function (k) {
    var t = String(k).trim();
    if (t) keySet[t] = true;
  });
  var yardInp = document.getElementById('stallMapYardInput');
  var cur = yardInp && yardInp.value != null ? String(yardInp.value).trim() : '';
  if (cur) keySet[cur] = true;
  var keys = Object.keys(keySet);
  keys.sort(function (a, b) {
    var na = parseInt(a, 10);
    var nb = parseInt(b, 10);
    if (String(na) === a && String(nb) === b && !isNaN(na) && !isNaN(nb)) return na - nb;
    return String(a).localeCompare(String(b), 'ru');
  });
  dl.innerHTML = '';
  for (var j = 0; j < keys.length; j++) {
    var opt = document.createElement('option');
    opt.value = keys[j];
    dl.appendChild(opt);
  }
}

function stallMapCloseCellModal() {
  var modal = document.getElementById('stallMapCellModal');
  if (modal) {
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
  }
  _stallMapCellModalCtx = null;
}

function stallMapOpenCellModal(yardKey, row, place, occ) {
  var modal = document.getElementById('stallMapCellModal');
  var body = document.getElementById('stallMapCellModalBody');
  if (!modal || !body) {
    if (typeof showConfirmModal === 'function') {
      showConfirmModal('Снять животное с этого места?').then(function (ok) {
        if (ok) {
          stallMapUnassignCell(yardKey, row, place).then(function () {
            stallMapRenderGrid();
            if (typeof showToast === 'function') showToast('Место освобождено', 'success');
          });
        }
      });
    }
    return;
  }
  _stallMapCellModalCtx = { yardKey: yardKey, row: row, place: place, occupant: occ };
  body.innerHTML =
    'Двор <strong>' +
    escapeHtmlStallMap(yardKey) +
    '</strong>, ряд ' +
    row +
    ', место ' +
    place +
    '.<br/>' +
    (occ.nickname ? escapeHtmlStallMap(occ.nickname) + ' — ' : '') +
    '№' +
    escapeHtmlStallMap(occ.cattleId);
  modal.classList.add('active');
  modal.setAttribute('aria-hidden', 'false');
}

function stallMapOnCellClick(yardKey, row, place) {
  var list = (typeof window.entries !== 'undefined' && Array.isArray(window.entries)) ? window.entries : [];
  var occ = stallMapFindAt(list, yardKey, row, place);
  if (occ) {
    stallMapOpenCellModal(yardKey, row, place, occ);
    return;
  }
  _stallMapAssignTarget = { yardKey: yardKey, row: row, place: place };
  stallMapOpenAssignModal();
}

function stallMapOpenAssignModal() {
  var modal = document.getElementById('stallMapAssignModal');
  var inp = document.getElementById('stallMapAssignInput');
  var listEl = document.getElementById('stallMapAssignList');
  if (!modal || !inp || !listEl) return;
  inp.value = '';
  listEl.innerHTML = '';
  stallMapRefreshAssignDatalist();
  modal.classList.add('active');
  modal.setAttribute('aria-hidden', 'false');
  stallMapFillAssignSuggestions('');
  setTimeout(function () {
    inp.focus();
  }, 0);
}

function stallMapCloseAssignModal() {
  var modal = document.getElementById('stallMapAssignModal');
  if (!modal) return;
  modal.classList.remove('active');
  modal.setAttribute('aria-hidden', 'true');
  _stallMapAssignTarget = null;
}

function stallMapFillAssignSuggestions(q) {
  var listEl = document.getElementById('stallMapAssignList');
  if (!listEl) return;
  var raw = (typeof window.entries !== 'undefined' && Array.isArray(window.entries)) ? window.entries : [];
  var base = typeof window.getVisibleEntries === 'function' ? window.getVisibleEntries(raw) : raw;
  var needle = String(q || '').trim().toLowerCase();
  var max = 40;
  var items = [];
  for (var i = 0; i < base.length && items.length < max; i++) {
    var e = base[i];
    if (!e || !e.cattleId) continue;
    var id = String(e.cattleId);
    var nick = (e.nickname && String(e.nickname)) || '';
    if (needle) {
      if (id.toLowerCase().indexOf(needle) === -1 && nick.toLowerCase().indexOf(needle) === -1) continue;
    }
    items.push(e);
  }
  listEl.innerHTML = items
    .map(function (e) {
      var safeId = escapeAttrStallMap(e.cattleId);
      var label = escapeHtmlStallMap(e.cattleId) + (e.nickname ? ' — ' + escapeHtmlStallMap(e.nickname) : '');
      return '<li><button type="button" class="stall-map-assign-item" data-cattle-id="' + safeId + '">' + label + '</button></li>';
    })
    .join('');
  listEl.querySelectorAll('.stall-map-assign-item').forEach(function (b) {
    b.addEventListener('click', function () {
      var cid = b.getAttribute('data-cattle-id');
      stallMapConfirmAssign(cid);
    });
  });
}

function stallMapConfirmAssign(cattleId) {
  if (!_stallMapAssignTarget || !cattleId) return;
  var t = _stallMapAssignTarget;
  stallMapAssignCell(t.yardKey, t.row, t.place, cattleId).then(function () {
    stallMapCloseAssignModal();
    stallMapRenderGrid();
    if (typeof showToast === 'function') showToast('Назначено на стойломесто', 'success');
  });
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
      if (!e0 || !e0.cattleId) continue;
      if (String(e0.cattleId).trim() === partId) return String(e0.cattleId).trim();
    }
  }
  for (i = 0; i < base.length; i++) {
    var e = base[i];
    if (!e || !e.cattleId) continue;
    if (String(e.cattleId).trim() === v) return String(e.cattleId).trim();
  }
  var vLow = v.toLowerCase();
  var nickExact = base.filter(function (en) {
    return en && en.nickname && String(en.nickname).trim().toLowerCase() === vLow;
  });
  if (nickExact.length === 1) return String(nickExact[0].cattleId).trim();
  var idPart = base.filter(function (en) {
    if (!en || !en.cattleId) return false;
    return String(en.cattleId).toLowerCase().indexOf(vLow) !== -1;
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
  var yardInp = document.getElementById('stallMapYardInput');
  var rowsInp = document.getElementById('stallMapRowsInput');
  var colsInp = document.getElementById('stallMapColsInput');
  var yk = yardInp && yardInp.value != null ? String(yardInp.value).trim() : '1';
  if (!yk) yk = '1';
  var rows = rowsInp ? parseInt(rowsInp.value, 10) : 4;
  var cols = colsInp ? parseInt(colsInp.value, 10) : 10;
  if (!Number.isFinite(rows) || rows < 1) rows = 1;
  if (!Number.isFinite(cols) || cols < 1) cols = 1;
  stallMapSaveGrid(objectId, yk, rows, cols, function () {
    stallMapRenderGrid();
  });
}

function stallMapSyncToolbarInputs() {
  var yardInp = document.getElementById('stallMapYardInput');
  var rowsInp = document.getElementById('stallMapRowsInput');
  var colsInp = document.getElementById('stallMapColsInput');
  var yk = yardInp && yardInp.value != null ? String(yardInp.value).trim() : '1';
  if (!yk) yk = '1';
  var dims = stallMapGetCurrentDims(yk);
  if (rowsInp) rowsInp.value = String(dims.rows);
  if (colsInp) colsInp.value = String(dims.cols);
}

function initStallMapScreen() {
  var objectId = typeof window.getCurrentObjectId === 'function' ? window.getCurrentObjectId() : '';
  var yardInp = document.getElementById('stallMapYardInput');
  var rowsInp = document.getElementById('stallMapRowsInput');
  var colsInp = document.getElementById('stallMapColsInput');
  var saveBtn = document.getElementById('stallMapSaveGridBtn');
  var toolbar = document.getElementById('stallMapToolbar');
  var canEdit = typeof window.canEdit !== 'function' || window.canEdit();

  if (toolbar) {
    toolbar.querySelectorAll('input,button').forEach(function (el) {
      if (el.id === 'stallMapSaveGridBtn') el.style.display = canEdit ? '' : 'none';
    });
    if (yardInp) yardInp.readOnly = !canEdit;
    if (rowsInp) rowsInp.readOnly = !canEdit;
    if (colsInp) colsInp.readOnly = !canEdit;
  }

  if (yardInp && !yardInp.value.trim()) yardInp.value = '1';

  stallMapLoadLayout(objectId, function () {
    stallMapSyncToolbarInputs();
    stallMapRenderGrid();
  });

  if (yardInp && !yardInp.dataset.bound) {
    yardInp.dataset.bound = '1';
    yardInp.addEventListener('change', function () {
      stallMapSyncToolbarInputs();
      stallMapRenderGrid();
    });
    yardInp.addEventListener('input', function () {
      stallMapSyncToolbarInputs();
      stallMapRefreshYardDatalist();
    });
  }
  if (saveBtn && !saveBtn.dataset.bound) {
    saveBtn.dataset.bound = '1';
    saveBtn.addEventListener('click', function () {
      stallMapSaveGridFromUI();
    });
  }

  var modal = document.getElementById('stallMapAssignModal');
  var inp = document.getElementById('stallMapAssignInput');
  var assignSaveBtn = document.getElementById('stallMapAssignSaveBtn');
  var closeBtn = document.getElementById('stallMapAssignModalClose');
  if (inp && !inp.dataset.bound) {
    inp.dataset.bound = '1';
    inp.addEventListener('input', function () {
      stallMapFillAssignSuggestions(inp.value);
    });
    inp.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        stallMapAssignSaveFromInput();
      }
    });
  }
  if (assignSaveBtn && !assignSaveBtn.dataset.bound) {
    assignSaveBtn.dataset.bound = '1';
    assignSaveBtn.addEventListener('click', function () {
      stallMapAssignSaveFromInput();
    });
  }
  if (closeBtn && !closeBtn.dataset.bound) {
    closeBtn.dataset.bound = '1';
    closeBtn.addEventListener('click', stallMapCloseAssignModal);
  }
  if (modal && !modal.dataset.overlayBound) {
    modal.dataset.overlayBound = '1';
    modal.addEventListener('click', function (e) {
      if (e.target === modal) stallMapCloseAssignModal();
    });
  }

  var cellModal = document.getElementById('stallMapCellModal');
  var cellClose = document.getElementById('stallMapCellModalCancel');
  var cellUn = document.getElementById('stallMapCellModalUnassign');
  var cellRep = document.getElementById('stallMapCellModalReplace');
  if (cellClose && !cellClose.dataset.bound) {
    cellClose.dataset.bound = '1';
    cellClose.addEventListener('click', stallMapCloseCellModal);
  }
  if (cellUn && !cellUn.dataset.bound) {
    cellUn.dataset.bound = '1';
    cellUn.addEventListener('click', function () {
      var ctx = _stallMapCellModalCtx;
      if (!ctx) return;
      stallMapCloseCellModal();
      stallMapUnassignCell(ctx.yardKey, ctx.row, ctx.place).then(function () {
        stallMapRenderGrid();
        if (typeof showToast === 'function') showToast('Место освобождено', 'success');
      });
    });
  }
  if (cellRep && !cellRep.dataset.bound) {
    cellRep.dataset.bound = '1';
    cellRep.addEventListener('click', function () {
      var ctx = _stallMapCellModalCtx;
      if (!ctx) return;
      _stallMapAssignTarget = { yardKey: ctx.yardKey, row: ctx.row, place: ctx.place };
      stallMapCloseCellModal();
      stallMapOpenAssignModal();
    });
  }
  if (cellModal && !cellModal.dataset.overlayBound) {
    cellModal.dataset.overlayBound = '1';
    cellModal.addEventListener('click', function (e) {
      if (e.target === cellModal) stallMapCloseCellModal();
    });
  }
}

if (typeof window !== 'undefined') {
  window.initStallMapScreen = initStallMapScreen;
  window.stallMapSaveGridFromUI = stallMapSaveGridFromUI;
  window.stallMapCloseAssignModal = stallMapCloseAssignModal;
}

export {};
