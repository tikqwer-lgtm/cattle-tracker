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
   * Список на УЗИ: УЗИ1 (осемененная, 32+ дней от осеменения), УЗИ2 (стельная, 60+ дней, 1 проверка)
   * @param {string} fromDate - YYYY-MM-DD
   * @param {string} toDate - YYYY-MM-DD
   * @param {string} filterCowHeifer - 'cow' | 'heifer' | 'all'
   */
  function getUziList(fromDate, toDate, filterCowHeifer) {
    var list = (typeof getVisibleEntries === 'function' ? getVisibleEntries(global.entries || []) : (global.entries || []));
    var from = fromDate ? dateOnly(new Date(fromDate)).getTime() : 0;
    var to = toDate ? dateOnly(new Date(toDate)).getTime() : Number.MAX_SAFE_INTEGER;
    var getDaysPregnantFn = typeof getDaysPregnant === 'function' ? getDaysPregnant : function () { return null; };
    var result = [];
    list.forEach(function (entry) {
      if (!matchCowHeifer(entry, filterCowHeifer)) return;
      var status = (entry.status || '').toString();
      var uziHistory = entry.uziHistory || [];
      var lastInsem = getLastInseminationOnOrBefore(entry, toDate || '9999-12-31');
      var insemList = entry.inseminationHistory && entry.inseminationHistory.length > 0
        ? entry.inseminationHistory.slice()
        : (entry.inseminationDate ? [{ date: entry.inseminationDate, attemptNumber: entry.attemptNumber ?? 1 }] : []);
      if (insemList.length > 0) insemList.sort(function (a, b) { return String(a.date).localeCompare(String(b.date)); });
      var lastInsemRec = insemList.length > 0 ? insemList[insemList.length - 1] : null;
      var insemDate = lastInsem || (lastInsemRec && lastInsemRec.date) || entry.inseminationDate || '';
      var attempt = (lastInsemRec && (lastInsemRec.attemptNumber !== undefined && lastInsemRec.attemptNumber !== null)) ? lastInsemRec.attemptNumber : (entry.attemptNumber ?? '—');

      if (status.indexOf('Осеменен') !== -1 && lastInsem) {
        var firstDay32 = new Date(parseDate(lastInsem));
        firstDay32.setDate(firstDay32.getDate() + 32);
        var firstDay32Time = dateOnly(firstDay32).getTime();
        if (firstDay32Time <= to && firstDay32Time >= from) {
          var daysFrom = daysBetween(lastInsem, toDate);
          if (daysFrom === null) daysFrom = daysBetween(lastInsem, new Date().toISOString().slice(0, 10));
          result.push({
            cattleId: entry.cattleId || '',
            group: entry.group || '',
            inseminationDate: insemDate,
            daysFromInsemination: daysFrom,
            attemptNumber: attempt,
            note: 'УЗИ1'
          });
        }
      }
      if (status.indexOf('Стельная') !== -1 && uziHistory.length === 1) {
        var daysPreg = getDaysPregnantFn(entry);
        if (daysPreg !== null && daysPreg > 60) {
          result.push({
            cattleId: entry.cattleId || '',
            group: entry.group || '',
            inseminationDate: insemDate,
            daysFromInsemination: daysPreg,
            attemptNumber: attempt,
            note: 'УЗИ2'
          });
        }
      }
    });
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
      '<button type="button" class="action-btn" data-list="uzi">🩺 Список на УЗИ</button>' +
      '<button type="button" class="action-btn" data-list="insemination">🐄 Список на осеменение</button>' +
      '<button type="button" class="action-btn" data-list="tasks">💉 Список на уколы</button>' +
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

  function renderUziListSubScreen(sub) {
    var today = new Date();
    var todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
    var weekEnd = new Date(today);
    weekEnd.setDate(weekEnd.getDate() + 7);
    var toStr = weekEnd.getFullYear() + '-' + String(weekEnd.getMonth() + 1).padStart(2, '0') + '-' + String(weekEnd.getDate()).padStart(2, '0');
    var html = '<div class="list-sub-header"><h3>Список на УЗИ</h3>' +
      '<div class="list-filters">' +
      '<label>С <input type="date" id="uziListDateFrom" value="' + escapeHtml(todayStr) + '" /></label>' +
      '<label>По <input type="date" id="uziListDateTo" value="' + escapeHtml(toStr) + '" /></label>' +
      '<label>Категория: <select id="uziListCowHeifer"><option value="all">Все</option><option value="cow">Коровы</option><option value="heifer">Телки</option></select></label>' +
      '<button type="button" class="small-btn" id="uziListRefresh">Обновить</button>' +
      '</div>' +
      '<div class="list-actions">' +
      '<button type="button" class="small-btn" id="uziListPrint">Печать</button>' +
      '<button type="button" class="small-btn" id="uziListExcel">Экспорт в Excel</button>' +
      '</div></div>' +
      '<div id="uzi-list-table-wrap" class="list-table-wrap"></div>';
    sub.innerHTML = html;
    function refresh() {
      var fromEl = document.getElementById('uziListDateFrom');
      var toEl = document.getElementById('uziListDateTo');
      var cowHeiferEl = document.getElementById('uziListCowHeifer');
      var from = (fromEl && fromEl.value) || todayStr;
      var to = (toEl && toEl.value) || toStr;
      var filter = (cowHeiferEl && cowHeiferEl.value) || 'all';
      var rows = getUziList(from, to, filter);
      var wrap = document.getElementById('uzi-list-table-wrap');
      if (!wrap) return;
      if (rows.length === 0) {
        wrap.innerHTML = '<p class="list-empty">Нет записей по заданным фильтрам.</p>';
        return;
      }
      var formatDateFn = typeof formatDate === 'function' ? formatDate : function (d) { return d || '—'; };
      var thead = '<tr><th>Номер животного</th><th>Группа</th><th>Дата осеменения</th><th>Дни от осеменения</th><th>Попытка</th><th>Примечание</th></tr>';
      var tbody = rows.map(function (r) {
        return '<tr><td>' + escapeHtml(r.cattleId) + '</td><td>' + escapeHtml(r.group) + '</td><td>' + escapeHtml(formatDateFn(r.inseminationDate)) + '</td><td>' + escapeHtml(r.daysFromInsemination) + '</td><td>' + escapeHtml(r.attemptNumber) + '</td><td>' + escapeHtml(r.note) + '</td></tr>';
      }).join('');
      wrap.innerHTML = '<table class="list-table"><thead>' + thead + '</thead><tbody>' + tbody + '</tbody></table>';
      wrap._listData = rows;
      wrap._listType = 'uzi';
    }
    refresh();
    var refreshBtn = document.getElementById('uziListRefresh');
    if (refreshBtn) refreshBtn.addEventListener('click', refresh);
    var fromInput = document.getElementById('uziListDateFrom');
    var toInput = document.getElementById('uziListDateTo');
    if (fromInput) fromInput.addEventListener('change', refresh);
    if (toInput) toInput.addEventListener('change', refresh);
    var printBtn = document.getElementById('uziListPrint');
    if (printBtn) printBtn.addEventListener('click', function () {
      var wrap = document.getElementById('uzi-list-table-wrap');
      if (wrap && wrap._listData && wrap._listData.length) printListTable('Список на УЗИ', wrap._listData, ['cattleId', 'group', 'inseminationDate', 'daysFromInsemination', 'attemptNumber', 'note'], ['Номер животного', 'Группа', 'Дата осеменения', 'Дни от осеменения', 'Попытка', 'Примечание']);
    });
    var excelBtn = document.getElementById('uziListExcel');
    if (excelBtn) excelBtn.addEventListener('click', function () {
      var wrap = document.getElementById('uzi-list-table-wrap');
      if (wrap && wrap._listData) exportListToExcel('Список_на_УЗИ', wrap._listData, ['cattleId', 'group', 'inseminationDate', 'daysFromInsemination', 'attemptNumber', 'note'], ['Номер животного', 'Группа', 'Дата осеменения', 'Дни от осеменения', 'Попытка', 'Примечание']);
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
      '<button type="button" class="small-btn" id="insemListRefresh">Обновить</button>' +
      '</div>' +
      '<div class="list-actions">' +
      '<button type="button" class="small-btn" id="insemListPrint">Печать</button>' +
      '<button type="button" class="small-btn" id="insemListExcel">Экспорт в Excel</button>' +
      '</div></div>' +
      '<div id="insem-list-table-wrap" class="list-table-wrap"></div>';
    sub.innerHTML = html;
    function refresh() {
      var fromEl = document.getElementById('insemListDateFrom');
      var toEl = document.getElementById('insemListDateTo');
      var cowHeiferEl = document.getElementById('insemListCowHeifer');
      var groupEl = document.getElementById('insemListGroup');
      var from = (fromEl && fromEl.value) || todayStr;
      var to = (toEl && toEl.value) || toStr;
      var filter = (cowHeiferEl && cowHeiferEl.value) || 'all';
      var groupVal = (groupEl && groupEl.value) || '';
      var filterGroups = groupVal ? [groupVal] : null;
      var rows = getInseminationProtocolList(from, to, filter, filterGroups);
      var wrap = document.getElementById('insem-list-table-wrap');
      if (!wrap) return;
      if (rows.length === 0) {
        wrap.innerHTML = '<p class="list-empty">Нет записей по заданным фильтрам.</p>';
        wrap._listData = [];
        return;
      }
      var formatDateFn = typeof formatDate === 'function' ? formatDate : function (d) { return d || '—'; };
      var thead = '<tr><th>Номер животного</th><th>Группа</th><th>Попытка</th><th>Протокол синхронизации</th><th>Бык</th><th>День лактации</th><th>Дата</th></tr>';
      var tbody = rows.map(function (r) {
        return '<tr><td>' + escapeHtml(r.cattleId) + '</td><td>' + escapeHtml(r.group) + '</td><td>' + escapeHtml(r.attemptNumber) + '</td><td>' + escapeHtml(r.protocolName) + '</td><td>' + escapeHtml(r.bull) + '</td><td>' + escapeHtml(r.daysInMilk) + '</td><td>' + escapeHtml(formatDateFn(r.date)) + '</td></tr>';
      }).join('');
      wrap.innerHTML = '<table class="list-table"><thead>' + thead + '</thead><tbody>' + tbody + '</tbody></table>';
      wrap._listData = rows;
      wrap._listType = 'insemination';
    }
    refresh();
    var refreshBtn = document.getElementById('insemListRefresh');
    if (refreshBtn) refreshBtn.addEventListener('click', refresh);
    var fromInput = document.getElementById('insemListDateFrom');
    var toInput = document.getElementById('insemListDateTo');
    var groupInput = document.getElementById('insemListGroup');
    if (fromInput) fromInput.addEventListener('change', refresh);
    if (toInput) toInput.addEventListener('change', refresh);
    if (groupInput) groupInput.addEventListener('change', refresh);
    var printBtn = document.getElementById('insemListPrint');
    if (printBtn) printBtn.addEventListener('click', function () {
      var wrap = document.getElementById('insem-list-table-wrap');
      if (wrap && wrap._listData && wrap._listData.length) printListTable('Список на осеменение', wrap._listData, ['cattleId', 'group', 'attemptNumber', 'protocolName', 'bull', 'daysInMilk', 'date'], ['Номер животного', 'Группа', 'Попытка', 'Протокол синхронизации', 'Бык', 'День лактации', 'Дата']);
    });
    var excelBtn = document.getElementById('insemListExcel');
    if (excelBtn) excelBtn.addEventListener('click', function () {
      var wrap = document.getElementById('insem-list-table-wrap');
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
      window.printListTableImpl(title, headers, data);
    } else {
      window.print();
    }
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
    XLSX.writeFile(wb, filename);
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
