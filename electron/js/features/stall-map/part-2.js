/** __stallMap part 2 */
(function () {
  'use strict';
  var root = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this);
  var NS = root['__stallMap'] = root['__stallMap'] || {};
  var global = root;

function stallMapSaveGrid(objectId, yardKey, rows, cols, callback) {
  var yk = String(yardKey || '').trim() || '1';
  var layout = globalThis['__stallMap'].stallMapNormalizeLayout(globalThis['__stallMap'].state._stallMapLayoutCache);
  layout.yards[yk] = { rows: rows, cols: cols };
  globalThis['__stallMap'].state._stallMapLayoutCache = layout;
  globalThis['__stallMap'].stallMapWriteLayoutLocal(objectId, layout);
  var useApi = window.CATTLE_TRACKER_USE_API && window.CattleTrackerApi && typeof window.CattleTrackerApi.putStallLayout === 'function';
  if (useApi && objectId) {
    window.CattleTrackerApi.putStallLayout(objectId, layout)
      .then(function (data) {
        globalThis['__stallMap'].state._stallMapLayoutCache = globalThis['__stallMap'].stallMapNormalizeLayout(data);
        globalThis['__stallMap'].stallMapWriteLayoutLocal(objectId, globalThis['__stallMap'].state._stallMapLayoutCache);
        stallMapRefreshYardDatalist();
        stallMapPopulateYardSelect();
        if (typeof showToast === 'function') showToast('Сетка сохранена', 'success');
        if (typeof callback === 'function') callback();
      })
      .catch(function (err) {
        if (typeof showToast === 'function') showToast(err && err.message ? err.message : 'Ошибка сохранения сетки', 'error');
        if (typeof callback === 'function') callback();
      });
    return;
  }
  stallMapRefreshYardDatalist();
  stallMapPopulateYardSelect();
  if (typeof showToast === 'function') showToast('Сетка сохранена локально', 'success');
  if (typeof callback === 'function') callback();
}

function stallMapGetCurrentYardKeyFromUI() {
  var sel = document.getElementById('stallMapYardSelect');
  if (sel && sel.value != null && String(sel.value).trim()) return String(sel.value).trim();
  return globalThis['__stallMap'].state._stallMapYardKey || '';
}

function stallMapGetCurrentDims(yardKey) {
  var yk = String(yardKey || '').trim();
  if (!yk) return null;
  var y = globalThis['__stallMap'].state._stallMapLayoutCache.yards && globalThis['__stallMap'].state._stallMapLayoutCache.yards[yk];
  if (y && y.rows && y.cols) return { rows: y.rows, cols: y.cols };
  return null;
}

function stallMapPopulateYardSelect() {
  var sel = document.getElementById('stallMapYardSelect');
  if (!sel) return;
  var yards = (globalThis['__stallMap'].state._stallMapLayoutCache && globalThis['__stallMap'].state._stallMapLayoutCache.yards) || {};
  var keys = Object.keys(yards);
  keys.sort(function (a, b) {
    var na = parseInt(a, 10);
    var nb = parseInt(b, 10);
    if (String(na) === a && String(nb) === b && !isNaN(na) && !isNaN(nb)) return na - nb;
    return String(a).localeCompare(String(b), 'ru');
  });
  var prev = sel.value;
  sel.innerHTML = '';
  keys.forEach(function (k) {
    var opt = document.createElement('option');
    opt.value = k;
    opt.textContent = 'Двор ' + k;
    sel.appendChild(opt);
  });
  if (keys.length) {
    if (prev && keys.indexOf(prev) !== -1) sel.value = prev;
    else sel.value = keys[0];
    globalThis['__stallMap'].state._stallMapYardKey = sel.value;
  } else {
    globalThis['__stallMap'].state._stallMapYardKey = '';
  }
}

function stallMapSetToolbarVisible(show) {
  var w = document.getElementById('stallMapToolbarWrap');
  var ph = document.getElementById('stallMapGridPlaceholder');
  var grid = document.getElementById('stallMapGridWrap');
  if (w) w.style.display = show ? '' : 'none';
  if (ph) ph.style.display = show ? 'none' : '';
  if (grid && !show) grid.style.display = 'none';
}

function stallMapRenderGrid() {
  var wrap = document.getElementById('stallMapGridWrap');
  if (!wrap) return;
  globalThis['__stallMap'].stallMapUpdateUnassignedCountUI();

  if (!globalThis['__stallMap'].stallMapLayoutHasYards()) {
    wrap.style.display = 'none';
    wrap.innerHTML = '';
    return;
  }

  var yk = stallMapGetCurrentYardKeyFromUI();
  if (!yk) {
    var sel = document.getElementById('stallMapYardSelect');
    if (sel && sel.options.length) {
      yk = sel.options[0].value;
      sel.value = yk;
    }
  }
  if (!yk) {
    wrap.style.display = 'none';
    wrap.innerHTML = '';
    return;
  }
  globalThis['__stallMap'].state._stallMapYardKey = yk;

  var dims = stallMapGetCurrentDims(yk);
  if (!dims) {
    wrap.style.display = 'none';
    wrap.innerHTML = '';
    return;
  }

  var rows = dims.rows;
  var cols = dims.cols;
  var entries = (typeof window.entries !== 'undefined' && Array.isArray(window.entries)) ? window.entries : [];

  wrap.style.display = 'grid';
  /* Ряды (r) — столбцы сетки; места (p) — сверху вниз в столбце (grid-auto-flow: column) */
  wrap.style.gridAutoFlow = 'column';
  wrap.style.gridTemplateColumns = 'repeat(' + rows + ', minmax(76px, 1fr))';
  wrap.style.gridTemplateRows = 'repeat(' + cols + ', minmax(72px, auto))';
  wrap.className = 'stall-map-grid-wrap stall-map-grid-barn';

  var html = '';
  for (var r = 1; r <= rows; r++) {
    for (var p = 1; p <= cols; p++) {
      var occ = globalThis['__stallMap'].stallMapFindAt(entries, yk, r, p);
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
      globalThis['__stallMap'].stallMapOnCellClick(yard, row, place);
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

/** Подсказки номеров/кличек для поля назначения (datalist — только на широких экранах, см. stallMapSyncAssignInputDatalist). */
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

function stallMapSyncAssignInputDatalist() {
  var inp = document.getElementById('stallMapAssignInput');
  if (!inp) return;
  /* На любом мобильном (в т.ч. планшет в альбоме) нативный datalist ломает ввод — только десктоп. */
  var desktop =
    typeof window.isMobile === 'function'
      ? !window.isMobile()
      : typeof window.matchMedia === 'function' && window.matchMedia('(min-width: 769px)').matches;
  if (desktop) {
    inp.setAttribute('list', 'stallMapAssignDatalist');
  } else {
    inp.removeAttribute('list');
  }
}

/** Подсказки номеров дворов из сохранённой сетки и текущего ввода. */
function stallMapRefreshYardDatalist() {
  var dl = document.getElementById('stallMapYardDatalist');
  if (!dl) return;
  var yards = globalThis['__stallMap'].state._stallMapLayoutCache.yards || {};
  var keySet = {};
  Object.keys(yards).forEach(function (k) {
    var t = String(k).trim();
    if (t) keySet[t] = true;
  });
  var cur = stallMapGetCurrentYardKeyFromUI();
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
  globalThis['__stallMap'].state._stallMapCellModalCtx = null;
}

function stallMapOpenCellModal(yardKey, row, place, occ) {
  var modal = document.getElementById('stallMapCellModal');
  var body = document.getElementById('stallMapCellModalBody');
  if (!modal || !body) {
    if (typeof showConfirmModal === 'function') {
      showConfirmModal('Снять животное с этого места?').then(function (ok) {
        if (ok) {
          globalThis['__stallMap'].stallMapUnassignCell(yardKey, row, place).then(function () {
            stallMapRenderGrid();
            if (typeof showToast === 'function') showToast('Место освобождено', 'success');
          });
        }
      });
    }
    return;
  }
  globalThis['__stallMap'].state._stallMapCellModalCtx = { yardKey: yardKey, row: row, place: place, occupant: occ };
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


  // register functions
  NS.stallMapSaveGrid = stallMapSaveGrid;
  NS.stallMapGetCurrentYardKeyFromUI = stallMapGetCurrentYardKeyFromUI;
  NS.stallMapGetCurrentDims = stallMapGetCurrentDims;
  NS.stallMapPopulateYardSelect = stallMapPopulateYardSelect;
  NS.stallMapSetToolbarVisible = stallMapSetToolbarVisible;
  NS.stallMapRenderGrid = stallMapRenderGrid;
  NS.escapeHtmlStallMap = escapeHtmlStallMap;
  NS.escapeAttrStallMap = escapeAttrStallMap;
  NS.stallMapRefreshAssignDatalist = stallMapRefreshAssignDatalist;
  NS.stallMapSyncAssignInputDatalist = stallMapSyncAssignInputDatalist;
  NS.stallMapRefreshYardDatalist = stallMapRefreshYardDatalist;
  NS.stallMapCloseCellModal = stallMapCloseCellModal;
  NS.stallMapOpenCellModal = stallMapOpenCellModal;
})();
export {};
