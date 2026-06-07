// stall-map.js — схема стойломест (сетка по дворам), координаты на карточке животного

var STALL_LAYOUT_STORAGE_PREFIX = 'cattleTracker_stallLayout_';

var _stallMapLayoutCache = { yards: {} };
var _stallMapYardKey = '';
var _stallMapAssignTarget = null;
var _stallMapCellModalCtx = null;
var _stallMapViewportListenersBound = false;
var _stallMapEntriesUiBound = false;
var _stallMapLifecycleBound = false;
var _stallMapInsetRaf = null;
var _stallMapAssignPollTimer = null;
var _stallMapAssignPollLastValue = '';
var _stallMapConfirmAssignBusy = false;

/** На части мобильных WebView событие input не срабатывает при наборе — опрос значения. */
function stallMapStartAssignInputPoll() {
  stallMapStopAssignInputPoll();
  if (typeof window.isMobile !== 'function' || !window.isMobile()) return;
  _stallMapAssignPollLastValue = '';
  _stallMapAssignPollTimer = setInterval(function () {
    var modal = document.getElementById('stallMapAssignModal');
    var inp = document.getElementById('stallMapAssignInput');
    if (!modal || !modal.classList.contains('active') || !inp) {
      stallMapStopAssignInputPoll();
      return;
    }
    var v = inp.value != null ? String(inp.value) : '';
    if (v !== _stallMapAssignPollLastValue) {
      _stallMapAssignPollLastValue = v;
      stallMapFillAssignSuggestions(v);
    }
  }, 100);
}

function stallMapStopAssignInputPoll() {
  if (_stallMapAssignPollTimer) {
    clearInterval(_stallMapAssignPollTimer);
    _stallMapAssignPollTimer = null;
  }
  _stallMapAssignPollLastValue = '';
}

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

function stallMapLayoutHasYards() {
  var y = _stallMapLayoutCache && _stallMapLayoutCache.yards;
  return !!(y && typeof y === 'object' && Object.keys(y).length);
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

function stallMapEntryHasStallCoords(e) {
  if (!e) return false;
  if (!stallMapYardNorm(stallMapEntryYard(e))) return false;
  if (stallMapEntryIntField(e.stallRow) == null) return false;
  if (stallMapEntryIntField(e.stallPlace) == null) return false;
  return true;
}

function stallMapCountUnassigned() {
  var raw = (typeof window.entries !== 'undefined' && Array.isArray(window.entries)) ? window.entries : [];
  var base = typeof window.getVisibleEntries === 'function' ? window.getVisibleEntries(raw) : raw;
  var n = 0;
  for (var i = 0; i < base.length; i++) {
    if (!stallMapEntryHasStallCoords(base[i])) n++;
  }
  return n;
}

function stallMapUpdateUnassignedCountUI() {
  var el = document.getElementById('stallMapUnassignedCount');
  if (!el) return;
  el.textContent = 'Не на стойломестах: ' + stallMapCountUnassigned();
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

/** Единое сравнение номеров (строка/число, ведущие нули). */
function stallMapCattleIdEqual(a, b) {
  if (a == null || b == null) return false;
  var sa = String(a).trim();
  var sb = String(b).trim();
  if (sa === sb) return true;
  if (/^\d+$/.test(sa) && /^\d+$/.test(sb)) {
    return parseInt(sa, 10) === parseInt(sb, 10);
  }
  return false;
}

/**
 * Сохраняет несколько записей подряд; после каждого PUT loadLocally подменяет window.entries —
 * перед каждым следующим PUT подставляется свежий объект и на него накладывается снимок stall-полей.
 */
function stallMapPersistEntries(entries) {
  if (!entries || !entries.length) return Promise.resolve();
  var stallSnapshot = {};
  entries.forEach(function (en) {
    if (!en || en.cattleId == null || String(en.cattleId).trim() === '') return;
    stallSnapshot[String(en.cattleId).trim()] = {
      stallYard: en.stallYard,
      stallRow: en.stallRow,
      stallPlace: en.stallPlace
    };
  });
  var ids = entries
    .map(function (en) {
      return en && en.cattleId != null && String(en.cattleId).trim() !== '' ? String(en.cattleId).trim() : null;
    })
    .filter(Boolean);
  var chain = Promise.resolve();
  ids.forEach(function (cid, idx) {
    chain = chain.then(function () {
      var list = typeof window.entries !== 'undefined' && Array.isArray(window.entries) ? window.entries : [];
      var fresh = null;
      for (var i = 0; i < list.length; i++) {
        if (list[i] && stallMapCattleIdEqual(list[i].cattleId, cid)) {
          fresh = list[i];
          break;
        }
      }
      if (!fresh) {
        return Promise.reject(new Error('Запись не найдена после синхронизации'));
      }
      var snap = stallSnapshot[cid];
      if (!snap) {
        for (var sk in stallSnapshot) {
          if (Object.prototype.hasOwnProperty.call(stallSnapshot, sk) && stallMapCattleIdEqual(sk, cid)) {
            snap = stallSnapshot[sk];
            break;
          }
        }
      }
      if (snap) {
        fresh.stallYard = snap.stallYard;
        fresh.stallRow = snap.stallRow;
        fresh.stallPlace = snap.stallPlace;
      }
      fresh.synced = false;
      if (typeof window.saveLocally === 'function') window.saveLocally();
      var useApi = window.CATTLE_TRACKER_USE_API && typeof window.updateEntryViaApi === 'function';
      var isLast = idx === ids.length - 1;
      if (useApi) {
        return window
          .updateEntryViaApi(fresh.cattleId, fresh, { skipReload: !isLast })
          .catch(function (err) {
            return Promise.reject(err || new Error('Ошибка сохранения'));
          });
      }
      return Promise.resolve();
    });
  });
  return chain;
}

function stallMapAssignCell(yardKey, row, place, cattleId) {
  var list = (typeof window.entries !== 'undefined' && Array.isArray(window.entries)) ? window.entries : [];
  var target = list.filter(function (e) {
    return e && stallMapCattleIdEqual(e.cattleId, cattleId);
  })[0];
  if (!target) {
    if (typeof showToast === 'function') showToast('Животное не найдено', 'error');
    return Promise.reject(new Error('Животное не найдено'));
  }
  cattleId = String(target.cattleId).trim();
  var r = parseInt(row, 10);
  var p = parseInt(place, 10);
  if (!Number.isFinite(r) || !Number.isFinite(p) || r < 1 || p < 1) {
    if (typeof showToast === 'function') showToast('Некорректные координаты ячейки', 'error');
    return Promise.reject(new Error('Некорректные координаты ячейки'));
  }
  var changed = [];
  var prev = stallMapFindAt(list, yardKey, r, p);
  if (prev && !stallMapCattleIdEqual(prev.cattleId, cattleId)) {
    stallMapClearCoords(prev);
    changed.push(prev);
  }
  target.stallYard = stallMapYardNorm(yardKey);
  target.stallRow = r;
  target.stallPlace = p;
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
  return stallMapPersistEntries([e]).catch(function (err) {
    if (typeof showToast === 'function') showToast(err && err.message ? err.message : 'Ошибка сохранения', 'error');
    return Promise.reject(err);
  });
}

function stallMapLoadLayout(objectId, callback) {
  var done = typeof callback === 'function' ? callback : function () {};
  var useApi = window.CATTLE_TRACKER_USE_API && window.CattleTrackerApi && typeof window.CattleTrackerApi.getStallLayout === 'function';
  if (useApi && objectId) {
    window.CattleTrackerApi.getStallLayout(objectId)
      .then(function (data) {
        _stallMapLayoutCache = stallMapNormalizeLayout(data);
        stallMapWriteLayoutLocal(objectId, _stallMapLayoutCache);
        stallMapRefreshYardDatalist();
        stallMapPopulateYardSelect();
        done(null, _stallMapLayoutCache);
      })
      .catch(function () {
        _stallMapLayoutCache = stallMapReadLayoutLocal(objectId);
        stallMapRefreshYardDatalist();
        stallMapPopulateYardSelect();
        done(null, _stallMapLayoutCache);
      });
    return;
  }
  _stallMapLayoutCache = stallMapReadLayoutLocal(objectId);
  stallMapRefreshYardDatalist();
  stallMapPopulateYardSelect();
  done(null, _stallMapLayoutCache);
}

function stallMapDeleteYard(objectId, yardKey, callback) {
  var yk = String(yardKey || '').trim();
  if (!yk) {
    if (typeof showToast === 'function') showToast('Выберите двор для удаления', 'error');
    return;
  }
  var layout = stallMapNormalizeLayout(_stallMapLayoutCache);
  if (!layout.yards || !layout.yards[yk]) {
    if (typeof showToast === 'function') showToast('Двор не найден', 'error');
    return;
  }
  var msg = 'Удалить двор «' + yk + '»? Животные будут сняты с мест, карточки останутся.';
  if (!confirm(msg)) return;

  delete layout.yards[yk];
  _stallMapLayoutCache = layout;
  stallMapWriteLayoutLocal(objectId, layout);

  var list = (typeof window.entries !== 'undefined' && Array.isArray(window.entries)) ? window.entries : [];
  var changed = [];
  list.forEach(function (e) {
    if (!e) return;
    if (stallMapYardNorm(stallMapEntryYard(e)) === stallMapYardNorm(yk)) {
      stallMapClearCoords(e);
      changed.push(e);
    }
  });

  function afterLayoutSaved() {
    stallMapRefreshYardDatalist();
    stallMapPopulateYardSelect();
    if (!stallMapLayoutHasYards()) {
      stallMapSetToolbarVisible(false);
      _stallMapYardKey = '';
    } else {
      var sel = document.getElementById('stallMapYardSelect');
      if (sel && sel.options.length) {
        _stallMapYardKey = sel.value;
      }
      stallMapSyncToolbarInputs();
    }
    stallMapRenderGrid();
    if (typeof showToast === 'function') showToast('Двор удалён', 'success');
    if (typeof callback === 'function') callback();
  }

  var persistEntries = changed.length
    ? stallMapPersistEntries(changed).catch(function (err) {
        if (typeof showToast === 'function') showToast(err && err.message ? err.message : 'Ошибка снятия животных с мест', 'error');
      })
    : Promise.resolve();

  var useApi = window.CATTLE_TRACKER_USE_API && window.CattleTrackerApi && typeof window.CattleTrackerApi.putStallLayout === 'function';
  if (useApi && objectId) {
    persistEntries.then(function () {
      return window.CattleTrackerApi.putStallLayout(objectId, layout);
    }).then(function (data) {
      _stallMapLayoutCache = stallMapNormalizeLayout(data);
      stallMapWriteLayoutLocal(objectId, _stallMapLayoutCache);
      afterLayoutSaved();
    }).catch(function (err) {
      if (typeof showToast === 'function') showToast(err && err.message ? err.message : 'Ошибка удаления двора', 'error');
    });
    return;
  }

  persistEntries.then(function () {
    afterLayoutSaved();
  });
}

function stallMapSaveGrid(objectId, yardKey, rows, cols, callback) {
  var yk = String(yardKey || '').trim() || '1';
  var layout = stallMapNormalizeLayout(_stallMapLayoutCache);
  layout.yards[yk] = { rows: rows, cols: cols };
  _stallMapLayoutCache = layout;
  stallMapWriteLayoutLocal(objectId, layout);
  var useApi = window.CATTLE_TRACKER_USE_API && window.CattleTrackerApi && typeof window.CattleTrackerApi.putStallLayout === 'function';
  if (useApi && objectId) {
    window.CattleTrackerApi.putStallLayout(objectId, layout)
      .then(function (data) {
        _stallMapLayoutCache = stallMapNormalizeLayout(data);
        stallMapWriteLayoutLocal(objectId, _stallMapLayoutCache);
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
  return _stallMapYardKey || '';
}

function stallMapGetCurrentDims(yardKey) {
  var yk = String(yardKey || '').trim();
  if (!yk) return null;
  var y = _stallMapLayoutCache.yards && _stallMapLayoutCache.yards[yk];
  if (y && y.rows && y.cols) return { rows: y.rows, cols: y.cols };
  return null;
}

function stallMapPopulateYardSelect() {
  var sel = document.getElementById('stallMapYardSelect');
  if (!sel) return;
  var yards = (_stallMapLayoutCache && _stallMapLayoutCache.yards) || {};
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
    _stallMapYardKey = sel.value;
  } else {
    _stallMapYardKey = '';
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
  stallMapUpdateUnassignedCountUI();

  if (!stallMapLayoutHasYards()) {
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
  _stallMapYardKey = yk;

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
  var yards = _stallMapLayoutCache.yards || {};
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

function stallMapApplyAssignModalInset() {
  if (_stallMapInsetRaf != null) cancelAnimationFrame(_stallMapInsetRaf);
  _stallMapInsetRaf = requestAnimationFrame(function () {
    _stallMapInsetRaf = null;
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
  if (_stallMapViewportListenersBound) return;
  _stallMapViewportListenersBound = true;
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
  stallMapRefreshAssignDatalist();
  stallMapSyncAssignInputDatalist();
  modal.classList.add('active');
  modal.setAttribute('aria-hidden', 'false');
  stallMapBindAssignModalViewport();
  stallMapFillAssignSuggestions('');
  stallMapStartAssignInputPoll();
  setTimeout(function () {
    stallMapApplyAssignModalInset();
    inp.focus();
  }, 0);
}

function stallMapCloseAssignModal() {
  stallMapStopAssignInputPoll();
  var modal = document.getElementById('stallMapAssignModal');
  if (!modal) return;
  modal.classList.remove('active');
  modal.setAttribute('aria-hidden', 'true');
  var inner = document.querySelector('.stall-map-assign-modal-inner');
  if (inner) inner.style.paddingBottom = '';
  _stallMapAssignTarget = null;
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
      var safeId = escapeAttrStallMap(e.cattleId);
      var label = escapeHtmlStallMap(e.cattleId) + (e.nickname ? ' — ' + escapeHtmlStallMap(e.nickname) : '');
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
  if (!_stallMapAssignTarget || !cattleId || _stallMapConfirmAssignBusy) return;
  _stallMapConfirmAssignBusy = true;
  var t = _stallMapAssignTarget;
  stallMapAssignCell(t.yardKey, t.row, t.place, cattleId).then(
    function () {
      _stallMapConfirmAssignBusy = false;
      stallMapCloseAssignModal();
      stallMapRenderGrid();
      stallMapUpdateUnassignedCountUI();
      if (typeof showToast === 'function') showToast('Назначено на стойломесто', 'success');
    },
    function (err) {
      if (typeof showToast === 'function') {
        showToast(err && err.message ? err.message : 'Ошибка сохранения', 'error');
      }
      _stallMapConfirmAssignBusy = false;
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
      if (stallMapCattleIdEqual(e0.cattleId, partId)) return String(e0.cattleId).trim();
    }
  }
  for (i = 0; i < base.length; i++) {
    var e = base[i];
    if (!e || e.cattleId == null) continue;
    if (stallMapCattleIdEqual(e.cattleId, v)) return String(e.cattleId).trim();
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
  var yk = stallMapGetCurrentYardKeyFromUI();
  if (!yk) yk = '1';
  var rowsInp = document.getElementById('stallMapRowsInput');
  var colsInp = document.getElementById('stallMapColsInput');
  var rows = rowsInp ? parseInt(rowsInp.value, 10) : 4;
  var cols = colsInp ? parseInt(colsInp.value, 10) : 10;
  if (!Number.isFinite(rows) || rows < 1) rows = 1;
  if (!Number.isFinite(cols) || cols < 1) cols = 1;
  stallMapSaveGrid(objectId, yk, rows, cols, function () {
    stallMapRenderGrid();
  });
}

function stallMapSyncToolbarInputs() {
  var rowsInp = document.getElementById('stallMapRowsInput');
  var colsInp = document.getElementById('stallMapColsInput');
  var yk = stallMapGetCurrentYardKeyFromUI();
  if (!yk) return;
  var dims = stallMapGetCurrentDims(yk);
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
  var yards = (_stallMapLayoutCache && _stallMapLayoutCache.yards) || {};
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
  stallMapSaveGrid(objectId, yk, rows, cols, function () {
    var sel = document.getElementById('stallMapYardSelect');
    if (sel) sel.value = yk;
    _stallMapYardKey = yk;
    stallMapSetToolbarVisible(true);
    stallMapSyncToolbarInputs();
    stallMapRenderGrid();
  });
}

function stallMapBindEntriesUpdatedListener() {
  if (_stallMapEntriesUiBound) return;
  if (typeof window.CattleTrackerEvents === 'undefined' || typeof window.CattleTrackerEvents.on !== 'function') return;
  _stallMapEntriesUiBound = true;
  window.CattleTrackerEvents.on('entries:updated', function () {
    var scr = document.getElementById('stall-map-screen');
    if (scr && scr.classList.contains('active')) {
      stallMapUpdateUnassignedCountUI();
      stallMapRenderGrid();
    }
  });
}

/** Перерисовка сетки после возврата из фона / WebView (данные из window.entries не трогаем). */
function stallMapRedrawIfActive() {
  var scr = document.getElementById('stall-map-screen');
  if (!scr || !scr.classList.contains('active')) return;
  try {
    stallMapUpdateUnassignedCountUI();
    stallMapRenderGrid();
  } catch (e) {
    console.warn('stallMapRedrawIfActive:', e);
  }
}

function stallMapBindLifecycleRefresh() {
  if (_stallMapLifecycleBound) return;
  _stallMapLifecycleBound = true;
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState !== 'visible') return;
    stallMapRedrawIfActive();
    if (typeof window.softRepaintCattleTrackerView === 'function') window.softRepaintCattleTrackerView();
  });
  window.addEventListener(
    'pageshow',
    function (ev) {
      if (ev.persisted) stallMapRedrawIfActive();
    },
    false
  );
  window.addEventListener('resize', function () {
    var scr = document.getElementById('stall-map-screen');
    if (!scr || !scr.classList.contains('active')) return;
    if (document.getElementById('stallMapAssignModal') && document.getElementById('stallMapAssignModal').classList.contains('active')) {
      stallMapApplyAssignModalInset();
    }
  });
}

function initStallMapScreen() {
  stallMapBindEntriesUpdatedListener();
  stallMapBindLifecycleRefresh();
  var objectId = typeof window.getCurrentObjectId === 'function' ? window.getCurrentObjectId() : '';
  var yardSel = document.getElementById('stallMapYardSelect');
  var rowsInp = document.getElementById('stallMapRowsInput');
  var colsInp = document.getElementById('stallMapColsInput');
  var saveBtn = document.getElementById('stallMapSaveGridBtn');
  var deleteBtn = document.getElementById('stallMapDeleteYardBtn');
  var createBtn = document.getElementById('stallMapCreateYardBtn');
  var toolbar = document.getElementById('stallMapToolbar');
  var canEdit = typeof window.canEdit !== 'function' || window.canEdit();

  if (toolbar) {
    toolbar.querySelectorAll('input,button,select').forEach(function (el) {
      if (el.id === 'stallMapSaveGridBtn' || el.id === 'stallMapDeleteYardBtn') el.style.display = canEdit ? '' : 'none';
    });
    if (yardSel) yardSel.disabled = !canEdit;
    if (rowsInp) rowsInp.readOnly = !canEdit;
    if (colsInp) colsInp.readOnly = !canEdit;
  }
  if (createBtn) createBtn.style.display = canEdit ? '' : 'none';

  stallMapLoadLayout(objectId, function () {
    var has = stallMapLayoutHasYards();
    stallMapSetToolbarVisible(has);
    stallMapUpdateUnassignedCountUI();
    if (has) {
      stallMapSyncToolbarInputs();
      stallMapRenderGrid();
    }
  });

  if (yardSel && !yardSel.dataset.bound) {
    yardSel.dataset.bound = '1';
    yardSel.addEventListener('change', function () {
      _stallMapYardKey = yardSel.value;
      stallMapSyncToolbarInputs();
      stallMapRenderGrid();
    });
  }

  if (createBtn && !createBtn.dataset.bound) {
    createBtn.dataset.bound = '1';
    createBtn.addEventListener('click', function () {
      if (!canEdit) return;
      stallMapOpenCreateYardModal();
    });
  }

  var createModal = document.getElementById('stallMapCreateYardModal');
  var createSubmit = document.getElementById('stallMapCreateYardSubmit');
  var createCancel = document.getElementById('stallMapCreateYardCancel');
  if (createSubmit && !createSubmit.dataset.bound) {
    createSubmit.dataset.bound = '1';
    createSubmit.addEventListener('click', function () {
      if (!canEdit) return;
      stallMapSubmitCreateYard();
    });
  }
  if (createCancel && !createCancel.dataset.bound) {
    createCancel.dataset.bound = '1';
    createCancel.addEventListener('click', stallMapCloseCreateYardModal);
  }
  if (createModal && !createModal.dataset.overlayBound) {
    createModal.dataset.overlayBound = '1';
    createModal.addEventListener('click', function (e) {
      if (e.target === createModal) stallMapCloseCreateYardModal();
    });
  }

  var createKeyInp = document.getElementById('stallMapCreateYardKeyInput');
  var createRowsInp = document.getElementById('stallMapCreateYardRowsInput');
  var createColsInp = document.getElementById('stallMapCreateYardColsInput');
  function stallMapCreateYardKeydown(ev) {
    if (ev.key === 'Enter') {
      ev.preventDefault();
      if (canEdit) stallMapSubmitCreateYard();
    }
  }
  [createKeyInp, createRowsInp, createColsInp].forEach(function (el) {
    if (el && !el.dataset.enterBound) {
      el.dataset.enterBound = '1';
      el.addEventListener('keydown', stallMapCreateYardKeydown);
    }
  });

  if (saveBtn && !saveBtn.dataset.bound) {
    saveBtn.dataset.bound = '1';
    saveBtn.addEventListener('click', function () {
      stallMapSaveGridFromUI();
    });
  }

  if (deleteBtn && !deleteBtn.dataset.bound) {
    deleteBtn.dataset.bound = '1';
    deleteBtn.addEventListener('click', function () {
      if (!canEdit) return;
      var yk = stallMapGetCurrentYardKeyFromUI();
      stallMapDeleteYard(objectId, yk);
    });
  }

  var modal = document.getElementById('stallMapAssignModal');
  var inp = document.getElementById('stallMapAssignInput');
  var assignSaveBtn = document.getElementById('stallMapAssignSaveBtn');
  var closeBtn = document.getElementById('stallMapAssignModalClose');
  if (inp && !inp.dataset.bound) {
    inp.dataset.bound = '1';
    function stallMapOnAssignInputChanged() {
      var el = document.getElementById('stallMapAssignInput');
      if (!el) return;
      stallMapFillAssignSuggestions(el.value);
    }
    inp.addEventListener('input', stallMapOnAssignInputChanged);
    inp.addEventListener('keyup', stallMapOnAssignInputChanged);
    inp.addEventListener('paste', function () {
      setTimeout(stallMapOnAssignInputChanged, 0);
    });
    inp.addEventListener('compositionend', stallMapOnAssignInputChanged);
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
      stallMapUnassignCell(ctx.yardKey, ctx.row, ctx.place).then(
        function () {
          stallMapRenderGrid();
          stallMapUpdateUnassignedCountUI();
          if (typeof showToast === 'function') showToast('Место освобождено', 'success');
        },
        function () {}
      );
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
  window.stallMapDeleteYard = stallMapDeleteYard;
  window.stallMapSaveGridFromUI = stallMapSaveGridFromUI;
  window.stallMapCloseAssignModal = stallMapCloseAssignModal;
  window.stallMapRedrawIfActive = stallMapRedrawIfActive;
  window.stallMapEntryHasStallCoords = stallMapEntryHasStallCoords;
  window.stallMapFindAt = stallMapFindAt;
  window.stallMapCattleIdEqual = stallMapCattleIdEqual;
  window.stallMapReadLayoutLocal = stallMapReadLayoutLocal;
  window.stallMapNormalizeLayout = stallMapNormalizeLayout;
  window.stallMapPersistEntries = stallMapPersistEntries;
}

export {};
