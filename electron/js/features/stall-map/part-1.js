/** __stallMap part 1 */
(function () {
  'use strict';
  var root = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this);
  var NS = root['__stallMap'] = root['__stallMap'] || {};
  var global = root;

/** На части мобильных WebView событие input не срабатывает при наборе — опрос значения. */
function stallMapStartAssignInputPoll() {
  stallMapStopAssignInputPoll();
  if (typeof window.isMobile !== 'function' || !window.isMobile()) return;
  globalThis['__stallMap'].state._stallMapAssignPollLastValue = '';
  globalThis['__stallMap'].state._stallMapAssignPollTimer = setInterval(function () {
    var modal = document.getElementById('stallMapAssignModal');
    var inp = document.getElementById('stallMapAssignInput');
    if (!modal || !modal.classList.contains('active') || !inp) {
      stallMapStopAssignInputPoll();
      return;
    }
    var v = inp.value != null ? String(inp.value) : '';
    if (v !== globalThis['__stallMap'].state._stallMapAssignPollLastValue) {
      globalThis['__stallMap'].state._stallMapAssignPollLastValue = v;
      globalThis['__stallMap'].stallMapFillAssignSuggestions(v);
    }
  }, 100);
}

function stallMapStopAssignInputPoll() {
  if (globalThis['__stallMap'].state._stallMapAssignPollTimer) {
    clearInterval(globalThis['__stallMap'].state._stallMapAssignPollTimer);
    globalThis['__stallMap'].state._stallMapAssignPollTimer = null;
  }
  globalThis['__stallMap'].state._stallMapAssignPollLastValue = '';
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
    var raw = localStorage.getItem(globalThis['__stallMap'].state.STALL_LAYOUT_STORAGE_PREFIX + objectId);
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
    localStorage.setItem(globalThis['__stallMap'].state.STALL_LAYOUT_STORAGE_PREFIX + objectId, JSON.stringify(norm));
  } catch (e) {
    console.warn('stallMapWriteLayoutLocal:', e);
  }
}

function stallMapLayoutHasYards() {
  var y = globalThis['__stallMap'].state._stallMapLayoutCache && globalThis['__stallMap'].state._stallMapLayoutCache.yards;
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
    globalThis['__stallMap'].stallMapRenderGrid();
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
    globalThis['__stallMap'].stallMapRenderGrid();
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
        globalThis['__stallMap'].state._stallMapLayoutCache = stallMapNormalizeLayout(data);
        stallMapWriteLayoutLocal(objectId, globalThis['__stallMap'].state._stallMapLayoutCache);
        globalThis['__stallMap'].stallMapRefreshYardDatalist();
        globalThis['__stallMap'].stallMapPopulateYardSelect();
        done(null, globalThis['__stallMap'].state._stallMapLayoutCache);
      })
      .catch(function () {
        globalThis['__stallMap'].state._stallMapLayoutCache = stallMapReadLayoutLocal(objectId);
        globalThis['__stallMap'].stallMapRefreshYardDatalist();
        globalThis['__stallMap'].stallMapPopulateYardSelect();
        done(null, globalThis['__stallMap'].state._stallMapLayoutCache);
      });
    return;
  }
  globalThis['__stallMap'].state._stallMapLayoutCache = stallMapReadLayoutLocal(objectId);
  globalThis['__stallMap'].stallMapRefreshYardDatalist();
  globalThis['__stallMap'].stallMapPopulateYardSelect();
  done(null, globalThis['__stallMap'].state._stallMapLayoutCache);
}

function stallMapDeleteYard(objectId, yardKey, callback) {
  var yk = String(yardKey || '').trim();
  if (!yk) {
    if (typeof showToast === 'function') showToast('Выберите двор для удаления', 'error');
    return;
  }
  var layout = stallMapNormalizeLayout(globalThis['__stallMap'].state._stallMapLayoutCache);
  if (!layout.yards || !layout.yards[yk]) {
    if (typeof showToast === 'function') showToast('Двор не найден', 'error');
    return;
  }
  var msg = 'Удалить двор «' + yk + '»? Животные будут сняты с мест, карточки останутся.';
  if (!confirm(msg)) return;

  delete layout.yards[yk];
  globalThis['__stallMap'].state._stallMapLayoutCache = layout;
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
    globalThis['__stallMap'].stallMapRefreshYardDatalist();
    globalThis['__stallMap'].stallMapPopulateYardSelect();
    if (!stallMapLayoutHasYards()) {
      globalThis['__stallMap'].stallMapSetToolbarVisible(false);
      globalThis['__stallMap'].state._stallMapYardKey = '';
    } else {
      var sel = document.getElementById('stallMapYardSelect');
      if (sel && sel.options.length) {
        globalThis['__stallMap'].state._stallMapYardKey = sel.value;
      }
      globalThis['__stallMap'].stallMapSyncToolbarInputs();
    }
    globalThis['__stallMap'].stallMapRenderGrid();
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
      globalThis['__stallMap'].state._stallMapLayoutCache = stallMapNormalizeLayout(data);
      stallMapWriteLayoutLocal(objectId, globalThis['__stallMap'].state._stallMapLayoutCache);
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


  // register functions
  NS.stallMapStartAssignInputPoll = stallMapStartAssignInputPoll;
  NS.stallMapStopAssignInputPoll = stallMapStopAssignInputPoll;
  NS.stallMapNormalizeLayout = stallMapNormalizeLayout;
  NS.stallMapReadLayoutLocal = stallMapReadLayoutLocal;
  NS.stallMapWriteLayoutLocal = stallMapWriteLayoutLocal;
  NS.stallMapLayoutHasYards = stallMapLayoutHasYards;
  NS.stallMapEntryYard = stallMapEntryYard;
  NS.stallMapYardNorm = stallMapYardNorm;
  NS.stallMapEntryIntField = stallMapEntryIntField;
  NS.stallMapEntryHasStallCoords = stallMapEntryHasStallCoords;
  NS.stallMapCountUnassigned = stallMapCountUnassigned;
  NS.stallMapUpdateUnassignedCountUI = stallMapUpdateUnassignedCountUI;
  NS.stallMapFindAt = stallMapFindAt;
  NS.stallMapClearCoords = stallMapClearCoords;
  NS.stallMapCattleIdEqual = stallMapCattleIdEqual;
  NS.stallMapPersistEntries = stallMapPersistEntries;
  NS.stallMapAssignCell = stallMapAssignCell;
  NS.stallMapUnassignCell = stallMapUnassignCell;
  NS.stallMapLoadLayout = stallMapLoadLayout;
  NS.stallMapDeleteYard = stallMapDeleteYard;
})();
export {};
