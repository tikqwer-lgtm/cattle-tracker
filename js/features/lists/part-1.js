import { formatMonthLabel, shiftMonth, snapshotDateForMonth, monthNavHtml } from '../../ui/month-nav.js';
/** __lists part 1 */
(function () {
  'use strict';
  var root = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this);
  var NS = root['__lists'] = root['__lists'] || {};
  var global = typeof window !== 'undefined' ? window : this;

function dateOnly(d) {
    if (!d) return null;
    var x = new Date(d);
    return new Date(x.getFullYear(), x.getMonth(), x.getDate());
  }

  function parseDate(str) {
    if (!str) return null;
    var d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
  }

  /** Последняя дата осеменения по записи (на или до указанной даты) */
  function getLastInseminationOnOrBefore(entry, onOrBeforeDate) {
    if (!entry || !onOrBeforeDate) return null;
    var beforeStr = String(onOrBeforeDate);
    var dates = [];
    if (entry.inseminationHistory && entry.inseminationHistory.length > 0) {
      entry.inseminationHistory.forEach(function (h) {
        if (h.date && String(h.date) <= beforeStr) dates.push(h.date);
      });
    } else if (entry.inseminationDate && String(entry.inseminationDate) <= beforeStr) {
      dates.push(entry.inseminationDate);
    }
    if (dates.length === 0) return null;
    return dates.reduce(function (a, b) { return a > b ? a : b; });
  }

  function daysBetween(fromStr, toStr) {
    if (!fromStr || !toStr) return null;
    var a = dateOnly(new Date(fromStr));
    var b = dateOnly(new Date(toStr));
    if (!a || !b) return null;
    return Math.round((b - a) / (24 * 60 * 60 * 1000));
  }

  /** Коровы: lactation не 0 и не пусто; Телки: lactation 0 или пусто */
  function matchCowHeifer(entry, filter) {
    if (!filter || filter === 'all') return true;
    var lact = entry.lactation;
    var isHeifer = lact === 0 || lact === '' || lact === null || lact === undefined;
    if (filter === 'heifer') return isHeifer;
    if (filter === 'cow') return !isHeifer;
    return true;
  }

  /**
   * Список на УЗИ: одна дата. УЗИ1 (осемененная, на дату >= 32 дней от осеменения), УЗИ2 (стельная, на дату >= 60 дней, 1 проверка УЗИ1).
   * @param {string} date - YYYY-MM-DD
   * @param {Set|Array} [filterLactationSet] - если передан и не пуст, оставить только строки с lactation из набора; если пустой — вернуть []
   */
  function getUziList(date, filterLactationSet) {
    var list = (typeof getVisibleEntries === 'function' ? getVisibleEntries(global.entries || []) : (global.entries || []));
    var dateStr = date ? String(date).slice(0, 10) : (new Date().toISOString().slice(0, 10));
    var result = [];
    list.forEach(function (entry) {
      var status = (entry.status || '').toString();
      var uziHistory = entry.uziHistory || [];
      var lastInsem = getLastInseminationOnOrBefore(entry, dateStr);
      var insemList = entry.inseminationHistory && entry.inseminationHistory.length > 0
        ? entry.inseminationHistory.slice()
        : (entry.inseminationDate ? [{ date: entry.inseminationDate, attemptNumber: entry.attemptNumber ?? 1, inseminator: entry.inseminator }] : []);
      if (insemList.length > 0) insemList.sort(function (a, b) { return String(a.date).localeCompare(String(b.date)); });
      var lastInsemRec = insemList.length > 0 ? insemList[insemList.length - 1] : null;
      var insemDate = lastInsem || (lastInsemRec && lastInsemRec.date) || entry.inseminationDate || '';
      var attempt = (lastInsemRec && (lastInsemRec.attemptNumber !== undefined && lastInsemRec.attemptNumber !== null)) ? lastInsemRec.attemptNumber : (entry.attemptNumber ?? '—');
      var inseminator = (lastInsemRec && (lastInsemRec.inseminator !== undefined && lastInsemRec.inseminator !== null && lastInsemRec.inseminator !== '')) ? lastInsemRec.inseminator : (entry.inseminator || '');
      var lactation = entry.lactation !== undefined && entry.lactation !== null && entry.lactation !== '' ? entry.lactation : '';

      if (status.indexOf('Осеменен') !== -1 && lastInsem) {
        var daysFrom = daysBetween(lastInsem, dateStr);
        if (daysFrom !== null && daysFrom >= 32) {
          result.push({
            cattleId: entry.cattleId || '',
            group: entry.group || '',
            inseminationDate: insemDate,
            daysFromInsemination: daysFrom,
            attemptNumber: attempt,
            inseminator: inseminator || '—',
            lactation: lactation,
            note: 'УЗИ1'
          });
        }
      }
      if (status.indexOf('Стельная') !== -1 && uziHistory.length === 1) {
        var daysFromPreg = daysBetween(lastInsem, dateStr);
        if (daysFromPreg !== null && daysFromPreg >= 60) {
          result.push({
            cattleId: entry.cattleId || '',
            group: entry.group || '',
            inseminationDate: insemDate,
            daysFromInsemination: daysFromPreg,
            attemptNumber: attempt,
            inseminator: inseminator || '—',
            lactation: lactation,
            note: 'УЗИ2'
          });
        }
      }
    });
    if (filterLactationSet !== undefined) {
      var set = filterLactationSet && (filterLactationSet.size !== undefined ? filterLactationSet.size : filterLactationSet.length);
      if (!set || set === 0) return [];
      var has = function (val) {
        if (filterLactationSet instanceof Set) return filterLactationSet.has(val);
        for (var i = 0; i < filterLactationSet.length; i++) {
          if (String(filterLactationSet[i]) === String(val)) return true;
        }
        return false;
      };
      result = result.filter(function (r) {
        var lact = r.lactation;
        if (lact === '' || lact === null || lact === undefined) return has('');
        return has(lact) || has(String(lact));
      });
    }
    return result;
  }

  /**
   * Список на осеменение по протоколу (шаги с названием инъекции «Осеменение»)
   */
  function getInseminationProtocolList(fromDate, toDate, filterCowHeifer, filterGroups) {
    var getProtocolTasksFn = typeof global.getProtocolTasks === 'function' ? global.getProtocolTasks : function () { return []; };
    var tasks = getProtocolTasksFn(fromDate, toDate);
    var insemTasks = tasks.filter(function (t) {
      var drug = (t.drug || '').trim();
      return drug === 'Осеменение';
    });
    var list = global.entries || [];
    var byId = {};
    list.forEach(function (e) { byId[e.cattleId] = e; });
    var result = [];
    var groupSet = filterGroups && filterGroups.length ? { } : null;
    if (groupSet && filterGroups) filterGroups.forEach(function (g) { groupSet[g] = true; });
    insemTasks.forEach(function (t) {
      var entry = byId[t.cattleId];
      if (!entry) return;
      if (!matchCowHeifer(entry, filterCowHeifer)) return;
      if (groupSet && !groupSet[entry.group]) return;
      var calvingDate = entry.calvingDate || '';
      var daysInMilk = null;
      if (calvingDate && t.date) {
        daysInMilk = daysBetween(calvingDate, t.date);
      }
      var attemptNumber = (entry.inseminationHistory && entry.inseminationHistory.length) ? entry.inseminationHistory.length + 1 : (entry.attemptNumber || 1);
      result.push({
        cattleId: t.cattleId,
        group: t.group || '',
        attemptNumber: attemptNumber,
        protocolName: t.protocolName || '',
        bull: entry.bull || '—',
        daysInMilk: daysInMilk !== null ? daysInMilk : '—',
        date: t.date
      });
    });
    result.sort(function (a, b) { return (a.date || '').localeCompare(b.date || ''); });
    return result;
  }

  function escapeHtml(s) {
    if (s === undefined || s === null) return '—';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function getUniqueGroups() {
    var list = global.entries || [];
    var set = {};
    list.forEach(function (e) {
      var g = (e.group || '').trim();
      if (g) set[g] = true;
    });
    return Object.keys(set).sort();
  }

  function renderListsScreen() {
    var container = document.getElementById('lists-screen-container');
    if (!container) return;
    var hideCalving = typeof getUiRole === 'function' && getUiRole() === 'service';
    container.innerHTML =
      '<div class="lists-buttons">' +
      '<button type="button" class="lists-hub-btn" data-list="uzi">УЗИ</button>' +
      '<button type="button" class="lists-hub-btn" data-list="insemination">Осеменение</button>' +
      (hideCalving ? '' : '<button type="button" class="lists-hub-btn" data-list="calving">Отёлы</button>') +
      '<button type="button" class="lists-hub-btn" data-list="tasks">Список задач на дату</button>' +
      '</div>';
    container.querySelectorAll('.lists-buttons button').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var listType = btn.getAttribute('data-list');
        if (listType === 'tasks') {
          if (typeof global.navigate === 'function') global.navigate('tasks');
          return;
        }
        if (typeof global.navigate === 'function') global.navigate('list-' + listType);
      });
    });
  }

  function renderListSubScreen(listType, preset) {
    var sub = document.getElementById('lists-sub-container');
    if (!sub) return;
    if (listType === 'uzi') {
      renderUziListSubScreen(sub);
    } else if (listType === 'insemination') {
      globalThis['__lists'].renderInseminationListSubScreen(sub);
    } else if (listType === 'calving') {
      globalThis['__lists'].renderCalvingListSubScreen(sub, preset);
    }
  }

  var UZI_LIST_KEYS = ['cattleId', 'group', 'inseminationDate', 'daysFromInsemination', 'attemptNumber', 'inseminator', 'lactation', 'note'];
  var UZI_LIST_HEADERS = ['Номер животного', 'Группа', 'Дата осеменения', 'Дни от осеменения', 'Попытка', 'Осеменатор', 'Лактация', 'Примечание'];

  function sortUziListData(rows, key, dir) {
    var mult = dir === 'desc' ? -1 : 1;
    return rows.slice().sort(function (a, b) {
      var va = a[key];
      var vb = b[key];
      var na = va === '' || va === null || va === undefined;
      var nb = vb === '' || vb === null || vb === undefined;
      if (na && nb) return 0;
      if (na) return 1;
      if (nb) return -1;
      if (key === 'inseminationDate' || key === 'daysFromInsemination') {
        var numA = key === 'daysFromInsemination' ? (Number(va) || 0) : (parseDate(va) ? parseDate(va).getTime() : 0);
        var numB = key === 'daysFromInsemination' ? (Number(vb) || 0) : (parseDate(vb) ? parseDate(vb).getTime() : 0);
        return mult * (numA < numB ? -1 : numA > numB ? 1 : 0);
      }
      return mult * String(va).localeCompare(String(vb));
    });
  }

  function listPrintButtonHtml(printBtnId) {
    var isMobile = typeof window.isMobile === 'function' && window.isMobile();
    return isMobile
      ? ''
      : '<button type="button" class="small-btn" id="' + printBtnId + '">Печать</button>';
  }

  function renderUziListSubScreen(sub) {
    var today = new Date();
    if (sub._uziYear == null) sub._uziYear = today.getFullYear();
    if (sub._uziMonth == null) sub._uziMonth = today.getMonth();
    var html = '<div class="list-sub-header">' +
      monthNavHtml({ prev: 'uziListPrev', next: 'uziListNext', label: 'uziListMonthLabel' }) +
      '<div id="uziListLactationFilter" class="list-filters list-filters-lactation"></div>' +
      '<div class="list-actions list-actions-inline">' +
      '<button type="button" class="small-btn" id="uziListRefresh">Обновить</button>' +
      listPrintButtonHtml('uziListPrint') +
      '<button type="button" class="small-btn" id="uziListExcel">Экспорт в Excel</button>' +
      '</div></div>' +
      '<div id="uzi-list-table-wrap" class="list-table-wrap"></div>';
    sub.innerHTML = html;
    sub._activeRefresh = null;
    function refresh() {
      var dateStr = snapshotDateForMonth(sub._uziYear, sub._uziMonth, new Date());
      var labelEl = sub.querySelector('#uziListMonthLabel');
      if (labelEl) labelEl.textContent = formatMonthLabel(sub._uziYear, sub._uziMonth);
      var fullRows = getUziList(dateStr);
      var lactFilterEl = sub.querySelector('#uziListLactationFilter');
      var wrap = sub.querySelector('#uzi-list-table-wrap');
      if (!wrap) return;

      if (fullRows.length === 0) {
        if (wrap._pinchZoomDestroy) { try { wrap._pinchZoomDestroy(); } catch (e) {} wrap._pinchZoomDestroy = null; }
        if (lactFilterEl) lactFilterEl.innerHTML = '';
        wrap.innerHTML = '<p class="list-empty">Нет записей по заданным фильтрам.</p>';
        wrap._listData = [];
        return;
      }

      var lactSet = {};
      fullRows.forEach(function (r) {
        var L = (r.lactation === '' || r.lactation === null || r.lactation === undefined) ? '' : String(r.lactation);
        lactSet[L] = true;
      });
      var lactList = Object.keys(lactSet).sort(function (a, b) {
        if (a === '') return -1;
        if (b === '') return 1;
        var na = parseInt(a, 10), nb = parseInt(b, 10);
        if (!isNaN(na) && !isNaN(nb)) return na - nb;
        if (!isNaN(na)) return -1;
        if (!isNaN(nb)) return 1;
        return String(a).localeCompare(String(b));
      });

      var wasChecked = {};
      if (lactFilterEl && lactFilterEl.querySelectorAll('.uzi-lactation-cb').length) {
        lactFilterEl.querySelectorAll('.uzi-lactation-cb').forEach(function (cb) { wasChecked[cb.getAttribute('data-lactation')] = cb.checked; });
      } else {
        lactList.forEach(function (l) { wasChecked[l] = true; });
      }
      if (lactFilterEl) {
        var lactHtml = '<span class="list-lactation-toggle" role="button" tabindex="0" title="Нажмите: выделить все / убрать все">Лактация:</span> ';
        lactList.forEach(function (l, idx) {
          if (idx > 0) lactHtml += ' <span class="list-lactation-dot">.</span> ';
          var checked = wasChecked[l] ? ' checked' : '';
          var displayVal = (l === '' ? '—' : escapeHtml(l));
          lactHtml += '<label class="list-lactation-cb-wrap"><input type="checkbox" class="uzi-lactation-cb" data-lactation="' + escapeHtml(l) + '"' + checked + ' /> ' + displayVal + '</label>';
        });
        lactFilterEl.innerHTML = lactHtml;
        var lactToggle = lactFilterEl.querySelector('.list-lactation-toggle');
        if (lactToggle) {
          lactToggle.addEventListener('click', function () {
            var cbs = lactFilterEl.querySelectorAll('.uzi-lactation-cb');
            var allChecked = cbs.length > 0 && Array.prototype.every.call(cbs, function (cb) { return cb.checked; });
            cbs.forEach(function (cb) { cb.checked = !allChecked; });
            globalThis['__lists'].refresh();
          });
        }
        lactFilterEl.querySelectorAll('.uzi-lactation-cb').forEach(function (cb) {
          cb.addEventListener('change', refresh);
        });
      }

      var selected = [];
      if (lactFilterEl) lactFilterEl.querySelectorAll('.uzi-lactation-cb:checked').forEach(function (cb) { selected.push(cb.getAttribute('data-lactation')); });
      var rows = fullRows.filter(function (r) {
        if (selected.length === 0) return false;
        var L = (r.lactation === '' || r.lactation === null || r.lactation === undefined) ? '' : String(r.lactation);
        return selected.indexOf(L) !== -1;
      });

      if (rows.length === 0) {
        if (wrap._pinchZoomDestroy) { try { wrap._pinchZoomDestroy(); } catch (e) {} wrap._pinchZoomDestroy = null; }
        wrap.innerHTML = '<p class="list-empty">Нет записей по заданным фильтрам.</p>';
        wrap._listData = [];
        return;
      }

      var sortKey = (wrap._sortKey !== undefined) ? wrap._sortKey : 'cattleId';
      var sortDir = (wrap._sortDir !== undefined) ? wrap._sortDir : 'asc';
      rows = sortUziListData(rows, sortKey, sortDir);
      wrap._listData = rows;
      wrap._sortKey = sortKey;
      wrap._sortDir = sortDir;

      if (wrap._pinchZoomDestroy) { try { wrap._pinchZoomDestroy(); } catch (e) {} wrap._pinchZoomDestroy = null; }
      var formatDateFn = typeof formatDate === 'function' ? formatDate : function (d) { return d || '—'; };
      function lactDisplay(l) { return (l === '' || l === null || l === undefined) ? '—' : String(l); }
      function makeTh(key, label) {
        var dir = (sortKey === key) ? (sortDir === 'asc' ? ' ↑' : ' ↓') : '';
        return '<th class="list-th-sortable" data-sort-key="' + escapeHtml(key) + '" role="button" tabindex="0">' + escapeHtml(label) + dir + '</th>';
      }
      var thead = '<tr>' + UZI_LIST_KEYS.map(function (k, i) { return globalThis['__lists'].makeTh(k, UZI_LIST_HEADERS[i]); }).join('') + '</tr>';
      var tbody = rows.map(function (r) {
        var cid = (r.cattleId || '').replace(/"/g, '&quot;');
        return '<tr data-cattle-id="' + cid + '"><td>' + escapeHtml(r.cattleId) + '</td><td>' + escapeHtml(r.group) + '</td><td>' + escapeHtml(formatDateFn(r.inseminationDate)) + '</td><td>' + escapeHtml(r.daysFromInsemination) + '</td><td>' + escapeHtml(r.attemptNumber) + '</td><td>' + escapeHtml(r.inseminator) + '</td><td>' + escapeHtml(globalThis['__lists'].lactDisplay(r.lactation)) + '</td><td>' + escapeHtml(r.note) + '</td></tr>';
      }).join('');
      wrap.innerHTML = '<table class="list-table"><thead>' + thead + '</thead><tbody>' + tbody + '</tbody></table>';
      wrap.querySelector('tbody') && wrap.querySelector('tbody').addEventListener('click', function (e) {
        var tr = e.target && e.target.closest ? e.target.closest('tr[data-cattle-id]') : null;
        if (tr && typeof viewCow === 'function') viewCow(tr.getAttribute('data-cattle-id'));
      });
      wrap._listType = 'uzi';

      function applySortAndRender() {
        var key = wrap._sortKey || 'cattleId';
        var dir = wrap._sortDir || 'asc';
        var sorted = sortUziListData(wrap._listData, key, dir);
        wrap._listData = sorted;
        var fmt = typeof formatDate === 'function' ? formatDate : function (d) { return d || '—'; };
        var tbodyEl = wrap.querySelector('tbody');
        if (tbodyEl) tbodyEl.innerHTML = sorted.map(function (r) {
          var cid = (r.cattleId || '').replace(/"/g, '&quot;');
          return '<tr data-cattle-id="' + cid + '"><td>' + escapeHtml(r.cattleId) + '</td><td>' + escapeHtml(r.group) + '</td><td>' + escapeHtml(fmt(r.inseminationDate)) + '</td><td>' + escapeHtml(r.daysFromInsemination) + '</td><td>' + escapeHtml(r.attemptNumber) + '</td><td>' + escapeHtml(r.inseminator) + '</td><td>' + escapeHtml(globalThis['__lists'].lactDisplay(r.lactation)) + '</td><td>' + escapeHtml(r.note) + '</td></tr>';
        }).join('');
        var theadTr = wrap.querySelector('thead tr');
        if (theadTr) theadTr.innerHTML = UZI_LIST_KEYS.map(function (k, i) {
          var d = (wrap._sortKey === k) ? (wrap._sortDir === 'asc' ? ' ↑' : ' ↓') : '';
          return '<th class="list-th-sortable" data-sort-key="' + escapeHtml(k) + '" role="button" tabindex="0">' + escapeHtml(UZI_LIST_HEADERS[i]) + d + '</th>';
        }).join('');
        wrap.querySelectorAll('th.list-th-sortable').forEach(function (cell) {
          cell.addEventListener('click', function onSortClick() {
            var sortKey = cell.getAttribute('data-sort-key');
            if (!sortKey) return;
            wrap._sortDir = (wrap._sortKey === sortKey && wrap._sortDir === 'asc') ? 'desc' : 'asc';
            wrap._sortKey = sortKey;
            globalThis['__lists'].applySortAndRender();
          });
        });
      }
      wrap.querySelectorAll('th.list-th-sortable').forEach(function (th) {
        th.addEventListener('click', function () {
          var key = th.getAttribute('data-sort-key');
          if (!key) return;
          wrap._sortDir = (wrap._sortKey === key && wrap._sortDir === 'asc') ? 'desc' : 'asc';
          wrap._sortKey = key;
          globalThis['__lists'].applySortAndRender();
        });
      });

      if (typeof window.initPinchZoom === 'function') wrap._pinchZoomDestroy = window.initPinchZoom(wrap, { innerSelector: 'table', minScale: 0.7, maxScale: 1.5 });
    }
    sub._activeRefresh = refresh;
    refresh();
    var refreshBtn = sub.querySelector('#uziListRefresh');
    if (refreshBtn) refreshBtn.addEventListener('click', function () { if (sub._activeRefresh) sub._activeRefresh(); });
    var prevBtn = sub.querySelector('#uziListPrev');
    var nextBtn = sub.querySelector('#uziListNext');
    if (prevBtn) prevBtn.addEventListener('click', function () {
      var n = shiftMonth(sub._uziYear, sub._uziMonth, -1);
      sub._uziYear = n.year;
      sub._uziMonth = n.month;
      refresh();
    });
    if (nextBtn) nextBtn.addEventListener('click', function () {
      var n = shiftMonth(sub._uziYear, sub._uziMonth, 1);
      sub._uziYear = n.year;
      sub._uziMonth = n.month;
      refresh();
    });
    var printBtn = sub.querySelector('#uziListPrint');
    if (printBtn) printBtn.addEventListener('click', function () {
      var wrap = sub.querySelector('#uzi-list-table-wrap');
      if (wrap && wrap._listData && wrap._listData.length) globalThis['__lists'].printListTable('Список на УЗИ', wrap._listData, UZI_LIST_KEYS, UZI_LIST_HEADERS);
    });
    var excelBtn = sub.querySelector('#uziListExcel');
    if (excelBtn) excelBtn.addEventListener('click', function () {
      var wrap = sub.querySelector('#uzi-list-table-wrap');
      if (wrap && wrap._listData) globalThis['__lists'].exportListToExcel('Список_на_УЗИ', wrap._listData, UZI_LIST_KEYS, UZI_LIST_HEADERS);
    });
  }


  // register functions
  NS.dateOnly = dateOnly;
  NS.parseDate = parseDate;
  NS.getLastInseminationOnOrBefore = getLastInseminationOnOrBefore;
  NS.daysBetween = daysBetween;
  NS.matchCowHeifer = matchCowHeifer;
  NS.getUziList = getUziList;
  NS.getInseminationProtocolList = getInseminationProtocolList;
  NS.escapeHtml = escapeHtml;
  NS.getUniqueGroups = getUniqueGroups;
  NS.renderListsScreen = renderListsScreen;
  NS.renderListSubScreen = renderListSubScreen;
  NS.sortUziListData = sortUziListData;
  NS.listPrintButtonHtml = listPrintButtonHtml;
  NS.renderUziListSubScreen = renderUziListSubScreen;
})();
export {};
