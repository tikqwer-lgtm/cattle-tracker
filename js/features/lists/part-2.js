/** __lists part 2 */
(function () {
  'use strict';
  var root = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this);
  var NS = root['__lists'] = root['__lists'] || {};
  var global = typeof window !== 'undefined' ? window : this;

  function formatCalvingMonthLabel(year, month) {
    try {
      return new Date(year, month, 1).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
    } catch (e) {
      return year + '-' + (month + 1);
    }
  }

  var CALVING_LIST_KEYS = ['cattleId', 'nickname', 'inseminationDate', 'daysPregnant', 'expectedCalvingDate', 'actualCalvingDate', 'planFactDiffDays'];
  var CALVING_LIST_HEADERS = ['Номер', 'Кличка', 'Дата осеменения', 'Дни стельности', 'Ожидаемый отёл', 'Фактический отёл', 'Разница план/факт'];

  function formatCalvingDiffDays(val) {
    if (val === null || val === undefined || val === '') return '—';
    var n = Number(val);
    if (isNaN(n)) return '—';
    if (n > 0) return '+' + n;
    return String(n);
  }

  function mapCalvingRowForDisplay(row, formatDateFn) {
    return {
      cattleId: row.cattleId,
      nickname: row.nickname || '',
      inseminationDate: row.inseminationDate ? formatDateFn(row.inseminationDate) : '—',
      daysPregnant: row.daysPregnant != null ? String(row.daysPregnant) : '—',
      expectedCalvingDate: row.expectedCalvingDate ? formatDateFn(row.expectedCalvingDate) : '—',
      actualCalvingDate: row.actualCalvingDate ? formatDateFn(row.actualCalvingDate) : '—',
      planFactDiffDays: formatCalvingDiffDays(row.planFactDiffDays)
    };
  }

  function resolveCalvingListView(preset) {
    if (preset && preset.year != null && preset.month != null) return preset;
    if (typeof window !== 'undefined' && window._listsCalvingView) return window._listsCalvingView;
    if (typeof globalThis['__menu'] !== 'undefined' && typeof globalThis['__menu'].getMenuCalvingViewYearMonth === 'function') {
      return globalThis['__menu'].getMenuCalvingViewYearMonth();
    }
    var now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  }

  function persistCalvingListView(sub) {
    if (typeof window !== 'undefined' && sub && sub._calvingYear != null && sub._calvingMonth != null) {
      window._listsCalvingView = { year: sub._calvingYear, month: sub._calvingMonth };
    }
  }

  function renderCalvingListSubScreen(sub, preset) {
    var view = resolveCalvingListView(preset);
    sub._calvingYear = view.year;
    sub._calvingMonth = view.month;
    persistCalvingListView(sub);
    var printBtnHtml = globalThis['__lists'].listPrintButtonHtml('calvingListPrint');
    var html = '<div class="list-sub-header"><h3>Отёлы за месяц</h3>' +
      '<div class="menu-calving-header list-calving-month-nav">' +
      '<button type="button" id="calvingListPrev" class="menu-calving-nav-btn" aria-label="Предыдущий месяц">‹</button>' +
      '<span id="calvingListMonthLabel" class="menu-calving-month-label">—</span>' +
      '<button type="button" id="calvingListNext" class="menu-calving-nav-btn" aria-label="Следующий месяц">›</button>' +
      '</div>' +
      '<div class="list-actions list-actions-inline">' +
      '<button type="button" class="small-btn" id="calvingListRefresh">Обновить</button>' +
      printBtnHtml +
      '<button type="button" class="small-btn" id="calvingListExcel">Экспорт в Excel</button>' +
      '</div></div>' +
      '<div id="calving-list-table-wrap" class="list-table-wrap"></div>';
    sub.innerHTML = html;
    sub._activeRefresh = null;

    function refresh() {
      var year = sub._calvingYear;
      var month = sub._calvingMonth;
      var labelEl = sub.querySelector('#calvingListMonthLabel');
      if (labelEl) labelEl.textContent = formatCalvingMonthLabel(year, month);
      var list = (typeof getVisibleEntries === 'function') ? getVisibleEntries(global.entries || []) : (global.entries || []);
      var getStats = (typeof window !== 'undefined' && typeof window.getCalvingStatsForMonth === 'function')
        ? window.getCalvingStatsForMonth
        : (typeof getCalvingStatsForMonth === 'function' ? getCalvingStatsForMonth : null);
      var stats = getStats
        ? getStats(list, year, month, new Date())
        : { plan: { count: 0, items: [] }, fact: { count: 0, items: [], hasDataErrors: false }, rows: [] };
      var formatDateFn = typeof formatDate === 'function' ? formatDate : function (d) { return d || '—'; };
      var wrap = sub.querySelector('#calving-list-table-wrap');
      if (!wrap) return;
      sub._calvingStats = stats;
      sub._calvingMonthLabel = formatCalvingMonthLabel(year, month);
      var rows = stats.rows || [];

      if (!rows.length) {
        wrap.innerHTML = '<p class="list-empty">Нет записей за выбранный месяц</p>';
        wrap._listData = [];
        return;
      }

      wrap._listData = rows.map(function (r) { return mapCalvingRowForDisplay(r, formatDateFn); });
      var thead = '<tr>' + CALVING_LIST_HEADERS.map(function (h) { return '<th>' + globalThis['__lists'].escapeHtml(h) + '</th>'; }).join('') + '</tr>';
      var tbody = rows.map(function (it) {
        var disp = mapCalvingRowForDisplay(it, formatDateFn);
        var cid = (it.cattleId || '').replace(/"/g, '&quot;');
        var rowClass = it.overdue ? ' class="calving-row-overdue"' : '';
        return '<tr data-cattle-id="' + cid + '"' + rowClass + '>' +
          '<td>' + globalThis['__lists'].escapeHtml(disp.cattleId) + '</td>' +
          '<td>' + globalThis['__lists'].escapeHtml(disp.nickname) + '</td>' +
          '<td>' + globalThis['__lists'].escapeHtml(disp.inseminationDate) + '</td>' +
          '<td>' + globalThis['__lists'].escapeHtml(disp.daysPregnant) + '</td>' +
          '<td>' + globalThis['__lists'].escapeHtml(disp.expectedCalvingDate) + '</td>' +
          '<td>' + globalThis['__lists'].escapeHtml(disp.actualCalvingDate) + '</td>' +
          '<td>' + globalThis['__lists'].escapeHtml(disp.planFactDiffDays) + '</td></tr>';
      }).join('');
      wrap.innerHTML = '<table class="list-table"><thead>' + thead + '</thead><tbody>' + tbody + '</tbody></table>';
    }

    sub.addEventListener('click', function (e) {
      var tr = e.target && e.target.closest ? e.target.closest('tr[data-cattle-id]') : null;
      if (tr && typeof viewCow === 'function') viewCow(tr.getAttribute('data-cattle-id'));
    });

    sub._activeRefresh = refresh;
    refresh();

    var prevBtn = sub.querySelector('#calvingListPrev');
    var nextBtn = sub.querySelector('#calvingListNext');
    if (prevBtn) {
      prevBtn.addEventListener('click', function () {
        sub._calvingMonth -= 1;
        if (sub._calvingMonth < 0) { sub._calvingMonth = 11; sub._calvingYear -= 1; }
        persistCalvingListView(sub);
        refresh();
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', function () {
        sub._calvingMonth += 1;
        if (sub._calvingMonth > 11) { sub._calvingMonth = 0; sub._calvingYear += 1; }
        persistCalvingListView(sub);
        refresh();
      });
    }
    var refreshBtn = sub.querySelector('#calvingListRefresh');
    if (refreshBtn) refreshBtn.addEventListener('click', refresh);

    var printBtn = sub.querySelector('#calvingListPrint');
    if (printBtn) {
      printBtn.addEventListener('click', function () {
        if (!sub._calvingStats || !sub._calvingStats.rows || !sub._calvingStats.rows.length) {
          window.print();
          return;
        }
        var title = 'Отёлы за ' + (sub._calvingMonthLabel || '');
        var formatDateFn = typeof formatDate === 'function' ? formatDate : function (d) { return d || '—'; };
        var printRows = sub._calvingStats.rows.map(function (r) { return mapCalvingRowForDisplay(r, formatDateFn); });
        printListTable(title, printRows, CALVING_LIST_KEYS, CALVING_LIST_HEADERS);
      });
    }

    var excelBtn = sub.querySelector('#calvingListExcel');
    if (excelBtn) {
      excelBtn.addEventListener('click', function () {
        if (!sub._calvingStats || !sub._calvingStats.rows || !sub._calvingStats.rows.length) return;
        if (typeof XLSX === 'undefined') {
          if (typeof showToast === 'function') showToast('Библиотека Excel не загружена', 'error');
          return;
        }
        var formatDateFn = typeof formatDate === 'function' ? formatDate : function (d) { return d || ''; };
        var data = [CALVING_LIST_HEADERS];
        sub._calvingStats.rows.forEach(function (r) {
          var disp = mapCalvingRowForDisplay(r, formatDateFn);
          data.push(CALVING_LIST_KEYS.map(function (k) { return disp[k]; }));
        });
        var wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(data), 'Отёлы');
        var filename = 'Отёлы_' + sub._calvingYear + '-' + String(sub._calvingMonth + 1).padStart(2, '0') + '.xlsx';
        var binary = XLSX.write(wb, { bookType: 'xlsx', type: 'binary' });
        var blob = new Blob([s2ab(binary)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        if (typeof showToast === 'function') showToast('Файл сохранён', 'success');
      });
    }
  }

  function renderInseminationListSubScreen(sub) {
    sub.innerHTML = '<div id="list-insem-table" class="view-entries-wrapper list-table-wrap"></div>';
    var listEl = sub.querySelector('#list-insem-table');
    var vc = globalThis['__viewCow'];
    if (vc && typeof vc.setAllInseminationsRenderTarget === 'function') {
      vc.setAllInseminationsRenderTarget(listEl);
    }
    if (vc && typeof vc.renderAllInseminationsScreen === 'function') {
      vc.renderAllInseminationsScreen();
    }
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

  // register functions
  NS.renderInseminationListSubScreen = renderInseminationListSubScreen;
  NS.renderCalvingListSubScreen = renderCalvingListSubScreen;
  NS.formatCalvingMonthLabel = formatCalvingMonthLabel;
  NS.printListTable = printListTable;
  NS.s2ab = s2ab;
  NS.exportListToExcel = exportListToExcel;
  NS.getAllEvents = getAllEvents;
  NS.renderEventsScreen = renderEventsScreen;

  if (typeof global !== 'undefined') {
    global.getUziList = NS.getUziList;
    global.getInseminationProtocolList = NS.getInseminationProtocolList;
    global.renderListsScreen = NS.renderListsScreen;
    global.renderListSubScreen = NS.renderListSubScreen;
    global.renderUziListSubScreen = NS.renderUziListSubScreen;
    global.renderInseminationListSubScreen = NS.renderInseminationListSubScreen;
    global.renderCalvingListSubScreen = NS.renderCalvingListSubScreen;
    global.exportListToExcel = exportListToExcel;
    global.getAllEvents = getAllEvents;
    global.renderEventsScreen = renderEventsScreen;
  }
})();
export {};
