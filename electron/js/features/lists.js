/**
 * lists.js — Списки (на УЗИ, на осеменение, на уколы) и экран списков
 */
(function (global) {
  'use strict';

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
    container.innerHTML =
      '<div class="lists-buttons">' +
      '<button type="button" class="action-btn" data-list="uzi">🩺 УЗИ</button>' +
      '<button type="button" class="action-btn" data-list="insemination">🐄 Осеменение</button>' +
      '<button type="button" class="action-btn" data-list="tasks">💉 Уколы</button>' +
      '</div>' +
      '<div id="lists-sub-container" class="lists-sub-container"></div>';
    container.querySelectorAll('.lists-buttons button').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var listType = btn.getAttribute('data-list');
        if (listType === 'tasks') {
          if (typeof global.navigate === 'function') global.navigate('tasks');
          return;
        }
        renderListSubScreen(listType);
      });
    });
  }

  function renderListSubScreen(listType) {
    var sub = document.getElementById('lists-sub-container');
    if (!sub) return;
    if (listType === 'uzi') {
      renderUziListSubScreen(sub);
    } else if (listType === 'insemination') {
      renderInseminationListSubScreen(sub);
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

  function renderUziListSubScreen(sub) {
    var today = new Date();
    var todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
    var html = '<div class="list-sub-header"><h3>Список на УЗИ</h3>' +
      '<div class="list-filters">' +
      '<label>Дата <input type="date" id="uziListDate" value="' + escapeHtml(todayStr) + '" /></label>' +
      '</div>' +
      '<div id="uziListLactationFilter" class="list-filters list-filters-lactation"></div>' +
      '<div class="list-actions list-actions-inline">' +
      '<button type="button" class="small-btn" id="uziListRefresh">Обновить</button>' +
      '<button type="button" class="small-btn" id="uziListPrint">Печать</button>' +
      '<button type="button" class="small-btn" id="uziListExcel">Экспорт в Excel</button>' +
      '</div></div>' +
      '<div id="uzi-list-table-wrap" class="list-table-wrap"></div>';
    sub.innerHTML = html;
    sub._activeRefresh = null;
    function refresh() {
      var dateEl = sub.querySelector('#uziListDate');
      var dateStr = (dateEl && dateEl.value) ? dateEl.value : todayStr;
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
        var na = a === '' ? -1 : (parseInt(a, 10) || 0);
        var nb = b === '' ? -1 : (parseInt(b, 10) || 0);
        if (!isNaN(parseInt(a, 10)) && !isNaN(parseInt(b, 10))) return na - nb;
        return String(a).localeCompare(String(b));
      });

      var wasChecked = {};
      if (lactFilterEl && lactFilterEl.querySelectorAll('.uzi-lactation-cb').length) {
        lactFilterEl.querySelectorAll('.uzi-lactation-cb').forEach(function (cb) { wasChecked[cb.getAttribute('data-lactation')] = cb.checked; });
      } else {
        lactList.forEach(function (l) { wasChecked[l] = true; });
      }
      if (lactFilterEl) {
        var lactHtml = '<span class="list-lactation-label">Лактация:</span> ';
        lactList.forEach(function (l) {
          var checked = wasChecked[l] ? ' checked' : '';
          lactHtml += '<label class="list-lactation-cb-wrap"><input type="checkbox" class="uzi-lactation-cb" data-lactation="' + escapeHtml(l) + '"' + checked + ' /> ' + (l === '' ? '—' : escapeHtml(l)) + '</label> ';
        });
        lactHtml += '<button type="button" class="small-btn" id="uziLactSelectAll">Выделить все</button> <button type="button" class="small-btn" id="uziLactDeselectAll">Убрать все</button>';
        lactFilterEl.innerHTML = lactHtml;
        var selectAllBtn = lactFilterEl.querySelector('#uziLactSelectAll');
        var deselectAllBtn = lactFilterEl.querySelector('#uziLactDeselectAll');
        if (selectAllBtn) selectAllBtn.addEventListener('click', function () { lactFilterEl.querySelectorAll('.uzi-lactation-cb').forEach(function (cb) { cb.checked = true; }); refresh(); });
        if (deselectAllBtn) deselectAllBtn.addEventListener('click', function () { lactFilterEl.querySelectorAll('.uzi-lactation-cb').forEach(function (cb) { cb.checked = false; }); refresh(); });
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
      var thead = '<tr>' + UZI_LIST_KEYS.map(function (k, i) { return makeTh(k, UZI_LIST_HEADERS[i]); }).join('') + '</tr>';
      var tbody = rows.map(function (r) {
        return '<tr><td>' + escapeHtml(r.cattleId) + '</td><td>' + escapeHtml(r.group) + '</td><td>' + escapeHtml(formatDateFn(r.inseminationDate)) + '</td><td>' + escapeHtml(r.daysFromInsemination) + '</td><td>' + escapeHtml(r.attemptNumber) + '</td><td>' + escapeHtml(r.inseminator) + '</td><td>' + escapeHtml(lactDisplay(r.lactation)) + '</td><td>' + escapeHtml(r.note) + '</td></tr>';
      }).join('');
      wrap.innerHTML = '<table class="list-table"><thead>' + thead + '</thead><tbody>' + tbody + '</tbody></table>';
      wrap._listType = 'uzi';

      function applySortAndRender() {
        var key = wrap._sortKey || 'cattleId';
        var dir = wrap._sortDir || 'asc';
        var sorted = sortUziListData(wrap._listData, key, dir);
        wrap._listData = sorted;
        var fmt = typeof formatDate === 'function' ? formatDate : function (d) { return d || '—'; };
        var tbodyEl = wrap.querySelector('tbody');
        if (tbodyEl) tbodyEl.innerHTML = sorted.map(function (r) {
          return '<tr><td>' + escapeHtml(r.cattleId) + '</td><td>' + escapeHtml(r.group) + '</td><td>' + escapeHtml(fmt(r.inseminationDate)) + '</td><td>' + escapeHtml(r.daysFromInsemination) + '</td><td>' + escapeHtml(r.attemptNumber) + '</td><td>' + escapeHtml(r.inseminator) + '</td><td>' + escapeHtml(lactDisplay(r.lactation)) + '</td><td>' + escapeHtml(r.note) + '</td></tr>';
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
            applySortAndRender();
          });
        });
      }
      wrap.querySelectorAll('th.list-th-sortable').forEach(function (th) {
        th.addEventListener('click', function () {
          var key = th.getAttribute('data-sort-key');
          if (!key) return;
          wrap._sortDir = (wrap._sortKey === key && wrap._sortDir === 'asc') ? 'desc' : 'asc';
          wrap._sortKey = key;
          applySortAndRender();
        });
      });

      if (typeof window.initPinchZoom === 'function') wrap._pinchZoomDestroy = window.initPinchZoom(wrap, { innerSelector: 'table', minScale: 0.7, maxScale: 1.5 });
    }
    sub._activeRefresh = refresh;
    refresh();
    var refreshBtn = sub.querySelector('#uziListRefresh');
    if (refreshBtn) refreshBtn.addEventListener('click', function () { if (sub._activeRefresh) sub._activeRefresh(); });
    var dateInput = sub.querySelector('#uziListDate');
    if (dateInput) dateInput.addEventListener('change', refresh);
    var printBtn = sub.querySelector('#uziListPrint');
    if (printBtn) printBtn.addEventListener('click', function () {
      var wrap = sub.querySelector('#uzi-list-table-wrap');
      if (wrap && wrap._listData && wrap._listData.length) printListTable('Список на УЗИ', wrap._listData, UZI_LIST_KEYS, UZI_LIST_HEADERS);
    });
    var excelBtn = sub.querySelector('#uziListExcel');
    if (excelBtn) excelBtn.addEventListener('click', function () {
      var wrap = sub.querySelector('#uzi-list-table-wrap');
      if (wrap && wrap._listData) exportListToExcel('Список_на_УЗИ', wrap._listData, UZI_LIST_KEYS, UZI_LIST_HEADERS);
    });
  }

  function renderInseminationListSubScreen(sub) {
    var today = new Date();
    var todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
    var weekEnd = new Date(today);
    weekEnd.setDate(weekEnd.getDate() + 7);
    var toStr = weekEnd.getFullYear() + '-' + String(weekEnd.getMonth() + 1).padStart(2, '0') + '-' + String(weekEnd.getDate()).padStart(2, '0');
    var groups = getUniqueGroups();
    var groupOptions = '<option value="">Все группы</option>' + groups.map(function (g) { return '<option value="' + escapeHtml(g) + '">' + escapeHtml(g) + '</option>'; }).join('');
    var html = '<div class="list-sub-header"><h3>Список на осеменение</h3>' +
      '<div class="list-filters">' +
      '<label>С <input type="date" id="insemListDateFrom" value="' + escapeHtml(todayStr) + '" /></label>' +
      '<label>По <input type="date" id="insemListDateTo" value="' + escapeHtml(toStr) + '" /></label>' +
      '<label>Категория: <select id="insemListCowHeifer"><option value="all">Все</option><option value="cow">Коровы</option><option value="heifer">Телки</option></select></label>' +
      '<label>Группа: <select id="insemListGroup">' + groupOptions + '</select></label>' +
      '</div>' +
      '<div class="list-actions list-actions-inline">' +
      '<button type="button" class="small-btn" id="insemListRefresh">Обновить</button>' +
      '<button type="button" class="small-btn" id="insemListPrint">Печать</button>' +
      '<button type="button" class="small-btn" id="insemListExcel">Экспорт в Excel</button>' +
      '</div></div>' +
      '<div id="insem-list-table-wrap" class="list-table-wrap"></div>';
    sub.innerHTML = html;
    sub._activeRefresh = null;
    function refresh() {
      var fromEl = sub.querySelector('#insemListDateFrom');
      var toEl = sub.querySelector('#insemListDateTo');
      var cowHeiferEl = sub.querySelector('#insemListCowHeifer');
      var groupEl = sub.querySelector('#insemListGroup');
      var from = (fromEl && fromEl.value) || todayStr;
      var to = (toEl && toEl.value) || toStr;
      var filter = (cowHeiferEl && cowHeiferEl.value) || 'all';
      var groupVal = (groupEl && groupEl.value) || '';
      var filterGroups = groupVal ? [groupVal] : null;
      var rows = getInseminationProtocolList(from, to, filter, filterGroups);
      var wrap = sub.querySelector('#insem-list-table-wrap');
      if (!wrap) return;
      if (rows.length === 0) {
        if (wrap._pinchZoomDestroy) { try { wrap._pinchZoomDestroy(); } catch (e) {} wrap._pinchZoomDestroy = null; }
        wrap.innerHTML = '<p class="list-empty">Нет записей по заданным фильтрам.</p>';
        wrap._listData = [];
        return;
      }
      if (wrap._pinchZoomDestroy) { try { wrap._pinchZoomDestroy(); } catch (e) {} wrap._pinchZoomDestroy = null; }
      var formatDateFn = typeof formatDate === 'function' ? formatDate : function (d) { return d || '—'; };
      var thead = '<tr><th>Номер животного</th><th>Группа</th><th>Попытка</th><th>Протокол синхронизации</th><th>Бык</th><th>День лактации</th><th>Дата</th></tr>';
      var tbody = rows.map(function (r) {
        return '<tr><td>' + escapeHtml(r.cattleId) + '</td><td>' + escapeHtml(r.group) + '</td><td>' + escapeHtml(r.attemptNumber) + '</td><td>' + escapeHtml(r.protocolName) + '</td><td>' + escapeHtml(r.bull) + '</td><td>' + escapeHtml(r.daysInMilk) + '</td><td>' + escapeHtml(formatDateFn(r.date)) + '</td></tr>';
      }).join('');
      wrap.innerHTML = '<table class="list-table"><thead>' + thead + '</thead><tbody>' + tbody + '</tbody></table>';
      wrap._listData = rows;
      wrap._listType = 'insemination';
      if (typeof window.initPinchZoom === 'function') wrap._pinchZoomDestroy = window.initPinchZoom(wrap, { innerSelector: 'table', minScale: 0.7, maxScale: 1.5 });
    }
    sub._activeRefresh = refresh;
    refresh();
    var refreshBtn = sub.querySelector('#insemListRefresh');
    if (refreshBtn) refreshBtn.addEventListener('click', function () { if (sub._activeRefresh) sub._activeRefresh(); });
    var fromInput = sub.querySelector('#insemListDateFrom');
    var toInput = sub.querySelector('#insemListDateTo');
    var groupInput = sub.querySelector('#insemListGroup');
    if (fromInput) fromInput.addEventListener('change', refresh);
    if (toInput) toInput.addEventListener('change', refresh);
    if (groupInput) groupInput.addEventListener('change', refresh);
    var printBtn = sub.querySelector('#insemListPrint');
    if (printBtn) printBtn.addEventListener('click', function () {
      var wrap = sub.querySelector('#insem-list-table-wrap');
      if (wrap && wrap._listData && wrap._listData.length) printListTable('Список на осеменение', wrap._listData, ['cattleId', 'group', 'attemptNumber', 'protocolName', 'bull', 'daysInMilk', 'date'], ['Номер животного', 'Группа', 'Попытка', 'Протокол синхронизации', 'Бык', 'День лактации', 'Дата']);
    });
    var excelBtn = sub.querySelector('#insemListExcel');
    if (excelBtn) excelBtn.addEventListener('click', function () {
      var wrap = sub.querySelector('#insem-list-table-wrap');
      if (wrap && wrap._listData) exportListToExcel('Список_на_осеменение', wrap._listData, ['cattleId', 'group', 'attemptNumber', 'protocolName', 'bull', 'daysInMilk', 'date'], ['Номер животного', 'Группа', 'Попытка', 'Протокол синхронизации', 'Бык', 'День лактации', 'Дата']);
    });
  }

  function printListTable(title, rows, keys, headers) {
    var formatDateFn = typeof formatDate === 'function' ? formatDate : function (d) { return d || ''; };
    var data = rows.map(function (r) {
      return keys.map(function (k) {
        var v = r[k];
        if (k.indexOf('Date') !== -1 || k === 'inseminationDate' || k === 'date') return formatDateFn(v);
        return v !== undefined && v !== null ? String(v) : '';
      });
    });
    if (typeof window.printListTableImpl === 'function') {
      try {
        window.printListTableImpl(title, headers, data);
      } catch (e) {
        if (typeof showToast === 'function') showToast('Печать на этом устройстве может быть недоступна', 'error');
        else window.print();
      }
    } else {
      try {
        window.print();
      } catch (e) {
        if (typeof showToast === 'function') showToast('Печать на этом устройстве может быть недоступна', 'error');
      }
    }
  }

  function s2ab(s) {
    var buf = new ArrayBuffer(s.length);
    var view = new Uint8Array(buf);
    for (var i = 0; i < s.length; i++) view[i] = s.charCodeAt(i) & 0xFF;
    return buf;
  }

  function exportListToExcel(sheetName, rows, keys, headers) {
    if (typeof XLSX === 'undefined') {
      if (typeof showToast === 'function') showToast('Библиотека Excel не загружена', 'error');
      return;
    }
    var formatDateFn = typeof formatDate === 'function' ? formatDate : function (d) { return d || ''; };
    var data = [headers];
    rows.forEach(function (r) {
      data.push(keys.map(function (k) {
        var v = r[k];
        if (k.indexOf('Date') !== -1 || k === 'inseminationDate' || k === 'date') return formatDateFn(v);
        return v !== undefined && v !== null ? String(v) : '';
      }));
    });
    var ws = XLSX.utils.aoa_to_sheet(data);
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    var filename = (sheetName || 'list') + '_' + new Date().toISOString().slice(0, 10) + '.xlsx';
    var binary = XLSX.write(wb, { bookType: 'xlsx', type: 'binary' });
    var blob = new Blob([s2ab(binary)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    if (typeof showToast === 'function') showToast('Файл сохранён', 'success');
  }

  /**
   * Собирает все события из actionHistory всех записей для экрана «Список событий».
   */
  function getAllEvents(filters) {
    filters = filters || {};
    var list = global.entries || [];
    var events = [];
    list.forEach(function (entry) {
      var hist = entry.actionHistory || [];
      hist.forEach(function (item) {
        events.push({
          cattleId: entry.cattleId || '',
          group: entry.group || '',
          lactation: (entry.lactation !== undefined && entry.lactation !== null && entry.lactation !== '') || entry.lactation === 0 ? String(entry.lactation) : '—',
          dateTime: item.dateTime || '',
          userName: item.userName || '',
          action: item.action || '',
          eventType: item.eventType || item.action || '',
          result: item.result,
          attemptNumber: item.attemptNumber,
          bull: item.bull,
          inseminator: item.inseminator,
          code: item.code,
          protocolName: item.protocolName,
          details: item.details
        });
      });
    });
    events.sort(function (a, b) {
      var ta = (a.dateTime || '').toString();
      var tb = (b.dateTime || '').toString();
      return ta > tb ? -1 : ta < tb ? 1 : 0;
    });
    if (filters.eventType) {
      events = events.filter(function (e) { return (e.eventType || e.action || '') === filters.eventType; });
    }
    if (filters.fromDate || filters.toDate) {
      events = events.filter(function (e) {
        var d = (e.dateTime || '').slice(0, 10);
        if (filters.fromDate && d < filters.fromDate) return false;
        if (filters.toDate && d > filters.toDate) return false;
        return true;
      });
    }
    if (filters.cattleId) {
      var id = (filters.cattleId || '').trim().toLowerCase();
      if (id) events = events.filter(function (e) { return (e.cattleId || '').toLowerCase().indexOf(id) !== -1; });
    }
    if (filters.group) {
      events = events.filter(function (e) { return (e.group || '') === filters.group; });
    }
    return events;
  }

  function renderEventsScreen() {
    var container = document.getElementById('events-screen-container');
    var filtersEl = document.getElementById('events-screen-filters');
    var actionsEl = document.getElementById('events-screen-actions');
    if (!container) return;
    var eventTypes = ['', 'УЗИ1', 'УЗИ2', 'Осеменение', 'Постановка на протокол', 'УЗИ'];
    var typeOptions = '<option value="">Все события</option>' + eventTypes.filter(Boolean).map(function (t) { return '<option value="' + escapeHtml(t) + '">' + escapeHtml(t) + '</option>'; }).join('');
    var groups = getUniqueGroups();
    var groupOptions = '<option value="">Все группы</option>' + groups.map(function (g) { return '<option value="' + escapeHtml(g) + '">' + escapeHtml(g) + '</option>'; }).join('');
    if (filtersEl) {
      filtersEl.innerHTML =
        '<div class="events-filters-row">' +
        '<label>Тип: <select id="eventsFilterType">' + typeOptions + '</select></label>' +
        '<label>Группа: <select id="eventsFilterGroup">' + groupOptions + '</select></label>' +
        '<label>Номер: <input type="text" id="eventsFilterCattleId" placeholder="Номер животного" /></label>' +
        '<label>С <input type="date" id="eventsFilterFrom" /></label>' +
        '<label>По <input type="date" id="eventsFilterTo" /></label>' +
        '<button type="button" class="small-btn" id="eventsFilterRefresh">Обновить</button>' +
        '</div>';
    }
    if (actionsEl) {
      actionsEl.innerHTML = '<button type="button" class="small-btn" id="eventsPrintBtn">Печать</button><button type="button" class="small-btn" id="eventsExcelBtn">Экспорт в Excel</button>';
    }
    function refresh() {
      var typeEl = document.getElementById('eventsFilterType');
      var groupEl = document.getElementById('eventsFilterGroup');
      var cattleEl = document.getElementById('eventsFilterCattleId');
      var fromEl = document.getElementById('eventsFilterFrom');
      var toEl = document.getElementById('eventsFilterTo');
      var eventsList = getAllEvents({
        eventType: (typeEl && typeEl.value) || undefined,
        group: (groupEl && groupEl.value) || undefined,
        cattleId: (cattleEl && cattleEl.value) || undefined,
        fromDate: (fromEl && fromEl.value) || undefined,
        toDate: (toEl && toEl.value) || undefined
      });
      container._eventsList = eventsList;
      if (eventsList.length === 0) {
        container.innerHTML = '<p class="list-empty">Нет событий по заданным фильтрам.</p>';
        return;
      }
      var thead = '<tr><th>Номер животного</th><th>Группа</th><th>Лактация</th><th>Дата события</th><th>Пользователь</th><th>Событие</th><th>Результат</th><th>Попытка</th><th>Бык</th><th>Осеменатор</th><th>Код</th><th>Протокол</th></tr>';
      var tbody = eventsList.map(function (e) {
        var result = (e.eventType === 'УЗИ1' || e.eventType === 'УЗИ2' || e.eventType === 'УЗИ') ? (e.result || '—') : '—';
        var attempt = (e.eventType === 'Осеменение') ? (e.attemptNumber !== undefined && e.attemptNumber !== null ? String(e.attemptNumber) : '—') : '—';
        var bull = (e.eventType === 'Осеменение') ? (e.bull || '—') : '—';
        var insem = (e.eventType === 'Осеменение') ? (e.inseminator || '—') : '—';
        var code = (e.eventType === 'Осеменение') ? (e.code || '—') : '—';
        var protocol = (e.eventType === 'Постановка на протокол') ? (e.protocolName || '—') : '—';
        return '<tr><td>' + escapeHtml(e.cattleId) + '</td><td>' + escapeHtml(e.group) + '</td><td>' + escapeHtml(e.lactation) + '</td><td>' + escapeHtml(e.dateTime) + '</td><td>' + escapeHtml(e.userName) + '</td><td>' + escapeHtml(e.eventType) + '</td><td>' + escapeHtml(result) + '</td><td>' + escapeHtml(attempt) + '</td><td>' + escapeHtml(bull) + '</td><td>' + escapeHtml(insem) + '</td><td>' + escapeHtml(code) + '</td><td>' + escapeHtml(protocol) + '</td></tr>';
      }).join('');
      container.innerHTML = '<table class="list-table events-table"><thead>' + thead + '</thead><tbody>' + tbody + '</tbody></table>';
    }
    refresh();
    var refreshBtn = document.getElementById('eventsFilterRefresh');
    if (refreshBtn) refreshBtn.addEventListener('click', refresh);
    var typeSelect = document.getElementById('eventsFilterType');
    var groupSelect = document.getElementById('eventsFilterGroup');
    if (typeSelect) typeSelect.addEventListener('change', refresh);
    if (groupSelect) groupSelect.addEventListener('change', refresh);
    var cattleInput = document.getElementById('eventsFilterCattleId');
    if (cattleInput) cattleInput.addEventListener('input', refresh);
    var printBtn = document.getElementById('eventsPrintBtn');
    if (printBtn) printBtn.addEventListener('click', function () {
      if (container._eventsList && container._eventsList.length && typeof window.printEventsTable === 'function') {
        window.printEventsTable(container._eventsList);
      } else {
        window.print();
      }
    });
    var excelBtn = document.getElementById('eventsExcelBtn');
    if (excelBtn) excelBtn.addEventListener('click', function () {
      if (container._eventsList && container._eventsList.length) {
        var keys = ['cattleId', 'group', 'lactation', 'dateTime', 'userName', 'eventType', 'result', 'attemptNumber', 'bull', 'inseminator', 'code', 'protocolName'];
        var headers = ['Номер животного', 'Группа', 'Лактация', 'Дата события', 'Пользователь', 'Событие', 'Результат', 'Попытка', 'Бык', 'Осеменатор', 'Код', 'Протокол'];
        exportListToExcel('Список_событий', container._eventsList, keys, headers);
      }
    });
  }

  if (typeof global !== 'undefined') {
    global.getUziList = getUziList;
    global.getInseminationProtocolList = getInseminationProtocolList;
    global.renderListsScreen = renderListsScreen;
    global.exportListToExcel = exportListToExcel;
    global.getAllEvents = getAllEvents;
    global.renderEventsScreen = renderEventsScreen;
  }
})(typeof window !== 'undefined' ? window : this);
export {};
