/** __viewList part 1 */
(function () {
  'use strict';
  var root = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this);
  var NS = root['__viewList'] = root['__viewList'] || {};
  var global = typeof window !== 'undefined' ? window : this;

/** При большом числе строк — виртуальный список (меньше DOM и быстрее скролл) */
var VIRTUAL_LIST_THRESHOLD = 200;
var VIRTUAL_ROW_HEIGHT = 40;
var viewListSelectedIds = new Set();
var viewListEditorMode = false;

function _compareViewList(a, b, key, dir) {
  var mul = dir === 'asc' ? 1 : -1;
  var va = a[key];
  var vb = b[key];
  if (key === 'protocolStartDate') {
    va = (a.protocol && a.protocol.startDate) || a.protocolStartDate;
    vb = (b.protocol && b.protocol.startDate) || b.protocolStartDate;
  }
  if (key === 'inseminationDate' || key === 'calvingDate' || key === 'dryStartDate' || key === 'birthDate' || key === 'exitDate' || key === 'protocolStartDate') {
    var da = va ? new Date(va).getTime() : 0;
    var db = vb ? new Date(vb).getTime() : 0;
    return mul * (da - db);
  }
  if (key === 'daysPregnant') {
    var na = typeof getDaysPregnant === 'function' ? getDaysPregnant(a) : null;
    var nb = typeof getDaysPregnant === 'function' ? getDaysPregnant(b) : null;
    na = (na != null && na !== '—') ? Number(na) : 0;
    nb = (nb != null && nb !== '—') ? Number(nb) : 0;
    return mul * (na - nb);
  }
  if (key === 'attemptNumber' || key === 'lactation') {
    var na = parseInt(va, 10);
    var nb = parseInt(vb, 10);
    if (isNaN(na)) na = 0;
    if (isNaN(nb)) nb = 0;
    return mul * (na - nb);
  }
  if (key === 'synced') {
    var ba = va === true || va === 'true';
    var bb = vb === true || vb === 'true';
    return mul * ((ba ? 1 : 0) - (bb ? 1 : 0));
  }
  var sa = (va != null ? String(va) : '').toLowerCase();
  var sb = (vb != null ? String(vb) : '').toLowerCase();
  return mul * (sa.localeCompare(sb, 'ru'));
}

/**
 * Обновляет список на экране просмотра
 */
function updateViewList() {
  var bulkContainer = document.getElementById('viewBulkActions');
  var tableContainer = document.getElementById('viewEntriesList');
  if (!tableContainer) return;

  var listFilteredFn = (typeof window !== 'undefined' && typeof window.getListViewFilteredEntries === 'function') ? window.getListViewFilteredEntries : (typeof getFilteredEntries === 'function' ? getFilteredEntries : null);
  var baseList = listFilteredFn ? listFilteredFn() : (window.entries && Array.isArray(window.entries) ? window.entries : []);
  var listToShow = (typeof getVisibleEntries === 'function') ? getVisibleEntries(baseList) : baseList;
  if (listToShow && listToShow.length > 0 && globalThis['__viewList'].state.viewListSortKey) {
    listToShow = listToShow.slice();
    listToShow.sort(function (a, b) { return _compareViewList(a, b, globalThis['__viewList'].state.viewListSortKey, globalThis['__viewList'].state.viewListSortDir); });
  }

  var canBulkDelete = typeof canDelete !== 'function' || canDelete();
  var bulkBarHtml = '<div class="bulk-actions-bar">' +
    '<div class="bulk-actions-left">' +
    '<button type="button" data-bulk-action="select-all" class="bulk-action-btn">✓ Выделить все</button>' +
    '<button type="button" data-bulk-action="deselect-all" class="bulk-action-btn">✗ Снять выделение</button>' +
    '<span id="selectedCount" class="selected-count">Выделено: 0</span>' +
    '</div>' +
    '<div class="bulk-actions-right">' +
    (canBulkDelete
      ? '<button type="button" data-bulk-action="delete-selected" class="bulk-action-btn delete-bulk" id="deleteSelectedBtn" disabled>🗑️ Удалить выделенные</button>'
      : '') +
    '</div></div>';

  if (!listToShow || listToShow.length === 0) {
    var noResultsHint = (baseList.length === 0 && (window.entries || []).length > 0) ? ' (поиск/фильтр не дали результатов)' : (((window.entries || []).length > 0 && listToShow.length === 0 && baseList.length > 0) ? ' (нет доступа)' : '');
    if (bulkContainer) bulkContainer.innerHTML = bulkBarHtml;
    if (bulkContainer) {
      var bar = bulkContainer.querySelector('.bulk-actions-bar');
      if (bar) {
        var btns = bar.querySelectorAll('button');
        btns.forEach(function (b) { b.disabled = true; });
      }
    }
    var emptyHtml = '<p>Нет записей' + noResultsHint + '</p>';
    if (baseList.length === 0 && (window.entries || []).length > 0 && typeof resetFiltersToDefault === 'function') {
      emptyHtml += '<p><button type="button" class="action-btn" id="viewListResetFiltersBtn">Сбросить фильтры и показать все записи</button></p>';
    }
    tableContainer.innerHTML = emptyHtml;
    var resetFiltersBtn = document.getElementById('viewListResetFiltersBtn');
    if (resetFiltersBtn) {
      resetFiltersBtn.addEventListener('click', function () {
        if (typeof resetFiltersToDefault === 'function') resetFiltersToDefault();
      });
    }
    var scrollBtnHide = document.getElementById('viewScrollToTopBtn');
    if (scrollBtnHide) scrollBtnHide.style.display = 'none';
    globalThis['__viewList'].initViewFieldsSettings();
    globalThis['__viewList'].initViewEditorModeButton();
    return;
  }

  if (bulkContainer) bulkContainer.innerHTML = bulkBarHtml;

  var fields = getVisibleViewFields();
  var fieldKeys = fields.map(function (f) { return f.key; });
  if (globalThis['__viewList'].state.viewListSortKey && fieldKeys.indexOf(globalThis['__viewList'].state.viewListSortKey) === -1) {
    globalThis['__viewList'].state.viewListSortKey = '';
  }

  var sortAsc = globalThis['__viewList'].state.viewListSortDir === 'asc';
  var sortMark = function (key) {
    if (globalThis['__viewList'].state.viewListSortKey !== key) return '';
    return sortAsc ? ' <span class="sort-indicator" aria-hidden="true">▲</span>' : ' <span class="sort-indicator" aria-hidden="true">▼</span>';
  };
  var sortClass = function (key) {
    if (globalThis['__viewList'].state.viewListSortKey !== key) return '';
    return sortAsc ? ' sort-asc' : ' sort-desc';
  };

  if (listToShow.length > VIRTUAL_LIST_THRESHOLD && !viewListEditorMode) {
    _renderVirtualList(tableContainer, listToShow, fields, sortMark, sortClass, bulkContainer);
    var viewScreen = document.getElementById('view-screen');
    if (viewScreen) {
      viewScreen.removeEventListener('click', _handleViewListClick);
      viewScreen.addEventListener('click', _handleViewListClick);
      viewScreen.removeEventListener('keydown', _handleViewListKeydown);
      viewScreen.addEventListener('keydown', _handleViewListKeydown);
    }
    globalThis['__viewList'].initViewFieldsSettings();
    globalThis['__viewList'].initViewEditorModeButton();
    setTimeout(function () { globalThis['__viewList'].updateSelectedCount(); globalThis['__viewList']._assertBulkSelectionUI(); }, 0);
    var virtualBody = document.getElementById('viewVirtualBody');
    _setupScrollToTopForContainer(virtualBody || tableContainer);
    return;
  }

  viewListSelectedIds.clear();
  var tableClass = 'entries-table' + (viewListEditorMode ? ' view-list-editor-mode' : '');
  tableContainer.innerHTML = `
    <table class="${tableClass}">
      <thead>
        <tr>
          <th class="checkbox-column">
            <input type="checkbox" id="selectAllCheckbox" data-bulk-action="toggle-all" aria-label="Выделить все">
          </th>
          ${fields.map(field => {
            if (!field.sortable) return `<th>${field.label}</th>`;
            return `<th class="sortable-th${sortClass(field.key)}" data-sort-key="${field.key}" role="button" tabindex="0">${field.label}${sortMark(field.key)}</th>`;
          }).join('')}
        </tr>
      </thead>
      <tbody>
        ${listToShow.map((entry, index) => {
          const safeCattleId = window.viewListEscapeHtml(entry.cattleId);
          const checkboxId = `entry-checkbox-${index}`;
          const cells = fields.map(field => {
            const v = field.render(entry);
            const show = (field.key === 'lactation' && (v === 0 || v === '0')) ? '0' : v;
            var editable = viewListEditorMode && (window.VIEW_LIST_EDITABLE_KEYS || {})[field.key];
            return `<td data-field-key="${field.key}" ${editable ? ' class="editable-cell"' : ''}>${show}</td>`;
          }).join('');
          return `
          <tr class="view-entry-row ${entry.synced ? '' : 'unsynced'}" data-row-index="${index}" data-cattle-id="${safeCattleId.replace(/"/g, '&quot;')}" role="button" tabindex="0">
            <td class="checkbox-column">
              <input type="checkbox" id="${checkboxId}" class="entry-checkbox" data-cattle-id="${safeCattleId.replace(/"/g, '&quot;')}" aria-label="Выделить">
            </td>
            ${cells}
          </tr>
        `;
        }).join('')}
      </tbody>
    </table>
  `;

  var viewScreen = document.getElementById('view-screen');
  if (viewScreen) {
    viewScreen.removeEventListener('click', _handleViewListClick);
    viewScreen.addEventListener('click', _handleViewListClick);
    viewScreen.removeEventListener('keydown', _handleViewListKeydown);
    viewScreen.addEventListener('keydown', _handleViewListKeydown);
  }

  globalThis['__viewList'].initViewFieldsSettings();
  globalThis['__viewList'].initViewEditorModeButton();

  setTimeout(function () {
    globalThis['__viewList'].updateSelectedCount();
    globalThis['__viewList']._assertBulkSelectionUI();
  }, 0);

  _setupScrollToTopForContainer(tableContainer);
}

function _setupScrollToTopForContainer(tableContainer) {
  var scrollBtn = document.getElementById('viewScrollToTopBtn');
  if (!scrollBtn) return;
  if (!tableContainer) {
    if (scrollBtn._scrollContainer) {
      scrollBtn._scrollContainer.removeEventListener('scroll', scrollBtn._scrollHandler);
      scrollBtn._scrollContainer = null;
      scrollBtn._scrollHandler = null;
    }
    scrollBtn.style.display = 'none';
    return;
  }
  var prevContainer = scrollBtn._scrollContainer;
  if (prevContainer && prevContainer !== tableContainer) {
    prevContainer.removeEventListener('scroll', scrollBtn._scrollHandler);
    scrollBtn._scrollContainer = null;
    scrollBtn._scrollHandler = null;
  }
  var canScroll = tableContainer.scrollHeight > tableContainer.clientHeight + 200;
  scrollBtn.style.display = (tableContainer.scrollTop > 200 || canScroll) ? '' : 'none';
  if (scrollBtn._scrollContainer !== tableContainer) {
    scrollBtn._scrollContainer = tableContainer;
    scrollBtn._scrollHandler = function () {
      if (!scrollBtn || !scrollBtn._scrollContainer) return;
      var c = scrollBtn._scrollContainer;
      var canScroll = c.scrollHeight > c.clientHeight + 200;
      scrollBtn.style.display = (c.scrollTop > 200 || canScroll) ? '' : 'none';
    };
    tableContainer.addEventListener('scroll', scrollBtn._scrollHandler);
  }
  if (!scrollBtn.dataset.scrollClickBound) {
    scrollBtn.dataset.scrollClickBound = '1';
    scrollBtn.addEventListener('click', function () {
      var c = scrollBtn._scrollContainer;
      if (c) { c.scrollTop = 0; }
      if (scrollBtn) scrollBtn.style.display = 'none';
    });
  }
}

function _renderVirtualList(container, listToShow, fields, sortMark, sortClass, bulkContainer) {
  var totalHeight = listToShow.length * VIRTUAL_ROW_HEIGHT;
  var gridCols = '40px ' + fields.map(function () { return 'minmax(70px,1fr)'; }).join(' ');
  var headHtml = '<div class="view-virtual-head" style="grid-template-columns:' + gridCols + '">' +
    '<div class="view-virtual-head-cell view-virtual-checkbox"><input type="checkbox" id="selectAllCheckbox" data-bulk-action="toggle-all" aria-label="Выделить все"></div>' +
    fields.map(function (f) {
      if (!f.sortable) return '<div class="view-virtual-head-cell">' + (f.label || '').replace(/</g, '&lt;') + '</div>';
      return '<div class="view-virtual-head-cell sortable-th' + sortClass(f.key) + '" data-sort-key="' + (f.key || '').replace(/"/g, '&quot;') + '" role="button" tabindex="0">' + (f.label || '').replace(/</g, '&lt;') + sortMark(f.key) + '</div>';
    }).join('') +
    '</div>';
  if (container._pinchZoomDestroy) {
    try { container._pinchZoomDestroy(); } catch (e) {}
    container._pinchZoomDestroy = null;
  }
  container.innerHTML =
    '<div class="view-virtual-wrap">' +
    headHtml +
    '<div class="view-virtual-body" id="viewVirtualBody">' +
    '<div class="view-virtual-viewport" id="viewVirtualViewport" style="height:' + totalHeight + 'px"></div>' +
    '<div class="view-virtual-rows" id="viewVirtualRows"></div>' +
    '</div></div>';
  container._virtualData = { list: listToShow, fields: fields, renderVisible: null };
  if (typeof window.initPinchZoom === 'function') {
    container._pinchZoomDestroy = window.initPinchZoom(container, { innerSelector: '.view-virtual-wrap', minScale: 0.7, maxScale: 1.5 });
  }
  function renderVisible() {
    var body = document.getElementById('viewVirtualBody');
    var viewport = document.getElementById('viewVirtualViewport');
    var rowsEl = document.getElementById('viewVirtualRows');
    if (!body || !viewport || !rowsEl) return;
    var scrollTop = body.scrollTop || 0;
    var height = body.clientHeight || 400;
    var start = Math.max(0, Math.floor(scrollTop / VIRTUAL_ROW_HEIGHT) - 5);
    var end = Math.min(listToShow.length, start + Math.ceil(height / VIRTUAL_ROW_HEIGHT) + 10);
    var html = '';
    for (var i = start; i < end; i++) {
      var entry = listToShow[i];
      var safeCattleId = window.viewListEscapeHtml(entry.cattleId).replace(/"/g, '&quot;');
      var checked = viewListSelectedIds.has(entry.cattleId) ? ' checked' : '';
      var cells = fields.map(function (field) {
        var v = field.render(entry);
        if (field.key === 'lactation' && (v === 0 || v === '0')) v = '0';
        return '<div class="view-virtual-cell">' + (v || '') + '</div>';
      }).join('');
      html += '<div class="view-virtual-row view-entry-row ' + (entry.synced ? '' : 'unsynced') + (viewListSelectedIds.has(entry.cattleId) ? ' selected-row' : '') + '" style="top:' + (i * VIRTUAL_ROW_HEIGHT) + 'px;grid-template-columns:' + gridCols + '" data-row-index="' + i + '" data-cattle-id="' + safeCattleId + '" role="button" tabindex="0">' +
        '<div class="view-virtual-cell view-virtual-checkbox"><input type="checkbox" class="entry-checkbox" data-cattle-id="' + safeCattleId + '" aria-label="Выделить"' + checked + '></div>' +
        cells + '</div>';
    }
    rowsEl.innerHTML = html;
  }
  container._virtualData.renderVisible = renderVisible;
  globalThis['__viewList'].renderVisible();
  var body = document.getElementById('viewVirtualBody');
  if (body) {
    body.addEventListener('scroll', renderVisible);
  }
  requestAnimationFrame(function () {
    if (container._virtualData && container._virtualData.renderVisible) container._virtualData.globalThis['__viewList'].renderVisible();
  });
  setTimeout(function () {
    if (container._virtualData && container._virtualData.renderVisible) container._virtualData.globalThis['__viewList'].renderVisible();
  }, 0);
}


  // register functions
  NS._compareViewList = _compareViewList;
  NS.updateViewList = updateViewList;
  NS._setupScrollToTopForContainer = _setupScrollToTopForContainer;
  NS._renderVirtualList = _renderVirtualList;
})();
export {};
