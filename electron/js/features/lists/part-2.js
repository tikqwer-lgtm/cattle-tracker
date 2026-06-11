/** __lists part 2 */
(function () {
  'use strict';
  var root = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this);
  var NS = root['__lists'] = root['__lists'] || {};
  var global = typeof window !== 'undefined' ? window : this;

  function renderInseminationListSubScreen(sub) {
    var today = new Date();
    var todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
    var weekEnd = new Date(today);
    weekEnd.setDate(weekEnd.getDate() + 7);
    var toStr = weekEnd.getFullYear() + '-' + String(weekEnd.getMonth() + 1).padStart(2, '0') + '-' + String(weekEnd.getDate()).padStart(2, '0');
    var groups = globalThis['__lists'].getUniqueGroups();
    var groupOptions = '<option value="">Все группы</option>' + groups.map(function (g) { return '<option value="' + globalThis['__lists'].escapeHtml(g) + '">' + globalThis['__lists'].escapeHtml(g) + '</option>'; }).join('');
    var printBtnHtml = globalThis['__lists'].listPrintButtonHtml('insemListPrint');
    var html = '<div class="list-sub-header"><h3>Список на осеменение</h3>' +
      '<div class="list-filters">' +
      '<label>С <input type="date" id="insemListDateFrom" value="' + globalThis['__lists'].escapeHtml(todayStr) + '" /></label>' +
      '<label>По <input type="date" id="insemListDateTo" value="' + globalThis['__lists'].escapeHtml(toStr) + '" /></label>' +
      '<label>Категория: <select id="insemListCowHeifer"><option value="all">Все</option><option value="cow">Коровы</option><option value="heifer">Телки</option></select></label>' +
      '<label>Группа: <select id="insemListGroup">' + groupOptions + '</select></label>' +
      '</div>' +
      '<div class="list-actions list-actions-inline">' +
      '<button type="button" class="small-btn" id="insemListRefresh">Обновить</button>' +
      printBtnHtml +
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
      var rows = globalThis['__lists'].getInseminationProtocolList(from, to, filter, filterGroups);
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
        var cid = (r.cattleId || '').replace(/"/g, '&quot;');
        return '<tr data-cattle-id="' + cid + '"><td>' + globalThis['__lists'].escapeHtml(r.cattleId) + '</td><td>' + globalThis['__lists'].escapeHtml(r.group) + '</td><td>' + globalThis['__lists'].escapeHtml(r.attemptNumber) + '</td><td>' + globalThis['__lists'].escapeHtml(r.protocolName) + '</td><td>' + globalThis['__lists'].escapeHtml(r.bull) + '</td><td>' + globalThis['__lists'].escapeHtml(r.daysInMilk) + '</td><td>' + globalThis['__lists'].escapeHtml(formatDateFn(r.date)) + '</td></tr>';
      }).join('');
      wrap.innerHTML = '<table class="list-table"><thead>' + thead + '</thead><tbody>' + tbody + '</tbody></table>';
      wrap.querySelector('tbody') && wrap.querySelector('tbody').addEventListener('click', function (e) {
        var tr = e.target && e.target.closest ? e.target.closest('tr[data-cattle-id]') : null;
        if (tr && typeof viewCow === 'function') viewCow(tr.getAttribute('data-cattle-id'));
      });
      wrap._listData = rows;
      wrap._listType = 'insemination';
      if (typeof window.initPinchZoom === 'function') wrap._pinchZoomDestroy = window.initPinchZoom(wrap, { innerSelector: 'table', minScale: 0.7, maxScale: 1.5 });
    }
    sub._activeRefresh = refresh;
    globalThis['__lists'].globalThis['__lists'].globalThis['__lists'].refresh();
    var refreshBtn = sub.querySelector('#insemListRefresh');
    if (refreshBtn) refreshBtn.addEventListener('click', function () { if (sub._activeRefresh) sub._activeRefresh(); });
    var fromInput = sub.querySelector('#insemListDateFrom');
    var toInput = sub.querySelector('#insemListDateTo');
    var groupInput = sub.querySelector('#insemListGroup');
    if (fromInput) fromInput.addEventListener('change', refresh);
    if (toInput) toInput.addEventListener('change', refresh);
    if (groupInput) groupInput.addEventListener('change', refresh);
    var printBtn = sub.querySelector('#insemListPrint');
    if (printBtn) {
      printBtn.addEventListener('click', function () {
        var wrap = sub.querySelector('#insem-list-table-wrap');
        if (wrap && wrap._listData && wrap._listData.length) printListTable('Список на осеменение', wrap._listData, ['cattleId', 'group', 'attemptNumber', 'protocolName', 'bull', 'daysInMilk', 'date'], ['Номер животного', 'Группа', 'Попытка', 'Протокол синхронизации', 'Бык', 'День лактации', 'Дата']);
      });
    }
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
    var eventTypes = ['', 'УЗИ1', 'УЗИ2', 'Осеменение', 'Постановка на протокол', 'УЗИ', 'Отёл', 'Запуск в сухостой'];
    var typeOptions = '<option value="">Все события</option>' + eventTypes.filter(Boolean).map(function (t) { return '<option value="' + globalThis['__lists'].escapeHtml(t) + '">' + globalThis['__lists'].escapeHtml(t) + '</option>'; }).join('');
    var groups = globalThis['__lists'].getUniqueGroups();
    var groupOptions = '<option value="">Все группы</option>' + groups.map(function (g) { return '<option value="' + globalThis['__lists'].escapeHtml(g) + '">' + globalThis['__lists'].escapeHtml(g) + '</option>'; }).join('');
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
      actionsEl.innerHTML =
        globalThis['__lists'].listPrintButtonHtml('eventsPrintBtn') +
        '<button type="button" class="small-btn" id="eventsExcelBtn">Экспорт в Excel</button>';
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
        var cid = (e.cattleId || '').replace(/"/g, '&quot;');
        return '<tr data-cattle-id="' + cid + '"><td>' + globalThis['__lists'].escapeHtml(e.cattleId) + '</td><td>' + globalThis['__lists'].escapeHtml(e.group) + '</td><td>' + globalThis['__lists'].escapeHtml(e.lactation) + '</td><td>' + globalThis['__lists'].escapeHtml(e.dateTime) + '</td><td>' + globalThis['__lists'].escapeHtml(e.userName) + '</td><td>' + globalThis['__lists'].escapeHtml(e.eventType) + '</td><td>' + globalThis['__lists'].escapeHtml(result) + '</td><td>' + globalThis['__lists'].escapeHtml(attempt) + '</td><td>' + globalThis['__lists'].escapeHtml(bull) + '</td><td>' + globalThis['__lists'].escapeHtml(insem) + '</td><td>' + globalThis['__lists'].escapeHtml(code) + '</td><td>' + globalThis['__lists'].escapeHtml(protocol) + '</td></tr>';
      }).join('');
      container.innerHTML = '<table class="list-table events-table"><thead>' + thead + '</thead><tbody>' + tbody + '</tbody></table>';
      container.querySelector('tbody') && container.querySelector('tbody').addEventListener('click', function (ev) {
        var tr = ev.target && ev.target.closest ? ev.target.closest('tr[data-cattle-id]') : null;
        if (tr && typeof viewCow === 'function') viewCow(tr.getAttribute('data-cattle-id'));
      });
    }
    globalThis['__lists'].globalThis['__lists'].globalThis['__lists'].refresh();
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
    global.getUziList = NS.getUziList;
    global.getInseminationProtocolList = NS.getInseminationProtocolList;
    global.renderListsScreen = NS.renderListsScreen;
    global.exportListToExcel = exportListToExcel;
    global.getAllEvents = getAllEvents;
    global.renderEventsScreen = renderEventsScreen;
  }



  // register functions
  NS.renderInseminationListSubScreen = renderInseminationListSubScreen;
  NS.printListTable = printListTable;
  NS.s2ab = s2ab;
  NS.exportListToExcel = exportListToExcel;
  NS.getAllEvents = getAllEvents;
  NS.renderEventsScreen = renderEventsScreen;
})();
export {};
