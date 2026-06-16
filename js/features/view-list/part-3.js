/** __viewList part 3 */
(function () {
  'use strict';
  var root = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this);
  var NS = root['__viewList'] = root['__viewList'] || {};
  var global = typeof window !== 'undefined' ? window : this;

function _handleViewListKeydown(ev) {
  var sortTh = ev.target.closest('th[data-sort-key], .view-virtual-head-cell[data-sort-key]');
  if (sortTh && (ev.key === 'Enter' || ev.key === ' ')) {
    ev.preventDefault();
    var key = sortTh.getAttribute('data-sort-key');
    if (key) {
      if (globalThis['__viewList'].state.viewListSortKey === key) globalThis['__viewList'].state.viewListSortDir = globalThis['__viewList'].state.viewListSortDir === 'asc' ? 'desc' : 'asc';
      else { globalThis['__viewList'].state.viewListSortKey = key; globalThis['__viewList'].state.viewListSortDir = 'asc'; }
      globalThis['__viewList'].updateViewList();
    }
    return;
  }
  if (ev.key !== 'Enter' && ev.key !== ' ') return;
  var row = ev.target.closest('tbody tr.view-entry-row, .view-virtual-row.view-entry-row');
  if (!row) return;
  ev.preventDefault();
  var cattleId = row.getAttribute('data-cattle-id');
  if (cattleId && typeof viewCow === 'function') viewCow(cattleId);
}

function _handleViewListClick(ev) {
  var target = ev.target;
  var bulkContainer = document.getElementById('viewBulkActions');
  var tableContainer = document.getElementById('viewEntriesList');

  var bulkBtn = target.closest('[data-bulk-action]');
  if (bulkBtn && bulkContainer && bulkContainer.contains(bulkBtn)) {
    ev.preventDefault();
    var action = bulkBtn.getAttribute('data-bulk-action');
    if (action === 'select-all') {
      selectAllEntries();
      return;
    }
    if (action === 'deselect-all') {
      deselectAllEntries();
      return;
    }
    if (action === 'delete-selected') {
      if (typeof deleteSelectedEntries === 'function') deleteSelectedEntries();
      return;
    }
  }

  if (bulkBtn && bulkBtn.getAttribute('data-bulk-action') === 'toggle-all') {
    ev.preventDefault();
    var cb = document.getElementById('selectAllCheckbox');
    if (cb) toggleSelectAll(cb.checked);
    return;
  }

  var sortTh = target.closest('th[data-sort-key], .view-virtual-head-cell[data-sort-key]');
  if (sortTh && tableContainer && tableContainer.contains(sortTh)) {
    ev.preventDefault();
    var key = sortTh.getAttribute('data-sort-key');
    if (key) {
      if (globalThis['__viewList'].state.viewListSortKey === key) globalThis['__viewList'].state.viewListSortDir = globalThis['__viewList'].state.viewListSortDir === 'asc' ? 'desc' : 'asc';
      else { globalThis['__viewList'].state.viewListSortKey = key; globalThis['__viewList'].state.viewListSortDir = 'asc'; }
      globalThis['__viewList'].updateViewList();
    }
    return;
  }

  if (!tableContainer || !tableContainer.contains(target)) return;

  if (target.classList && target.classList.contains('entry-checkbox')) {
    ev.stopPropagation();
    var virtualBody = document.getElementById('viewVirtualBody');
    if (virtualBody && tableContainer && tableContainer._virtualData && tableContainer._virtualData.renderVisible) {
      var cattleId = target.getAttribute('data-cattle-id');
      if (cattleId) {
        if (globalThis.viewListSelectedIds.has(cattleId)) globalThis.viewListSelectedIds.delete(cattleId);
        else globalThis.viewListSelectedIds.add(cattleId);
        tableContainer._virtualData.globalThis['__viewList'].renderVisible();
      }
    }
    setTimeout(updateSelectedCount, 0);
    return;
  }

  if (globalThis.viewListEditorMode) {
    var cell = target.closest('td.editable-cell, td[data-field-key]');
    if (cell && cell.classList && cell.classList.contains('editable-cell')) {
      ev.preventDefault();
      ev.stopPropagation();
      var row = cell.closest('tr.view-entry-row');
      if (row) {
        var cattleId = row.getAttribute('data-cattle-id');
        var fieldKey = cell.getAttribute('data-field-key');
        if (cattleId && fieldKey && (window.VIEW_LIST_EDITABLE_KEYS || {})[fieldKey]) {
          globalThis['__viewList'].startInlineEdit(cell, cattleId, fieldKey);
        }
      }
      return;
    }
  }

  var row = target.closest('tbody tr.view-entry-row, .view-virtual-row.view-entry-row');
  if (row) {
    ev.preventDefault();
    var cattleId = row.getAttribute('data-cattle-id');
    if (cattleId && typeof viewCow === 'function') viewCow(cattleId);
  }
}

function selectAllEntries() {
  var container = document.getElementById('viewEntriesList');
  if (container && container._virtualData && container._virtualData.list) {
    container._virtualData.list.forEach(function (entry) { globalThis.viewListSelectedIds.add(entry.cattleId); });
    if (container._virtualData.renderVisible) container._virtualData.globalThis['__viewList'].renderVisible();
  } else {
    var checkboxes = document.querySelectorAll('.entry-checkbox');
    checkboxes.forEach(function (checkbox) { checkbox.checked = true; });
  }
  var selectAllCheckbox = document.getElementById('selectAllCheckbox');
  if (selectAllCheckbox) selectAllCheckbox.checked = true;
  updateSelectedCount();
}

function deselectAllEntries() {
  globalThis.viewListSelectedIds.clear();
  var container = document.getElementById('viewEntriesList');
  if (container && container._virtualData && container._virtualData.renderVisible) {
    container._virtualData.globalThis['__viewList'].renderVisible();
  } else {
    var checkboxes = document.querySelectorAll('.entry-checkbox');
    checkboxes.forEach(function (checkbox) { checkbox.checked = false; });
  }
  var selectAllCheckbox = document.getElementById('selectAllCheckbox');
  if (selectAllCheckbox) selectAllCheckbox.checked = false;
  updateSelectedCount();
}

function toggleSelectAll(checked) {
  var container = document.getElementById('viewEntriesList');
  if (container && container._virtualData && container._virtualData.list) {
    if (checked) {
      container._virtualData.list.forEach(function (entry) { globalThis.viewListSelectedIds.add(entry.cattleId); });
    } else {
      globalThis.viewListSelectedIds.clear();
    }
    if (container._virtualData.renderVisible) container._virtualData.globalThis['__viewList'].renderVisible();
  } else {
    var checkboxes = document.querySelectorAll('.entry-checkbox');
    checkboxes.forEach(function (checkbox) { checkbox.checked = checked; });
  }
  updateSelectedCount();
}

function updateSelectedCount() {
  var container = document.getElementById('viewEntriesList');
  var count;
  var total;
  if (container && container._virtualData && container._virtualData.list) {
    count = globalThis.viewListSelectedIds.size;
    total = container._virtualData.list.length;
  } else {
    var checkboxes = document.querySelectorAll('.entry-checkbox:checked');
    var allCheckboxes = document.querySelectorAll('.entry-checkbox');
    count = checkboxes.length;
    total = allCheckboxes.length;
  }
  var countElement = document.getElementById('selectedCount');
  var deleteBtn = document.getElementById('deleteSelectedBtn');
  if (countElement) countElement.textContent = 'Выделено: ' + count;
  if (deleteBtn) deleteBtn.disabled = count === 0;
  var selectAllCheckbox = document.getElementById('selectAllCheckbox');
  if (selectAllCheckbox && total > 0) {
    selectAllCheckbox.checked = count === total;
  }
  if (!container || !container._virtualData) {
    var allRows = document.querySelectorAll('.entries-table tbody tr');
    allRows.forEach(function (row) {
      var checkbox = row.querySelector('.entry-checkbox');
      if (checkbox && checkbox.checked) row.classList.add('selected-row');
      else row.classList.remove('selected-row');
    });
  }
}

function getSelectedCattleIds() {
  var container = document.getElementById('viewEntriesList');
  if (container && container._virtualData && container._virtualData.list) {
    return Array.from(globalThis.viewListSelectedIds);
  }
  var checkboxes = document.querySelectorAll('.entry-checkbox:checked');
  return Array.prototype.map.call(checkboxes, function (cb) { return cb.getAttribute('data-cattle-id'); });
}

function toggleRowSelection(event, checkboxId) {
  if (event.target.tagName === 'BUTTON' || event.target.closest('button') || event.target.closest('.actions-cell')) {
    return;
  }
  const checkbox = document.getElementById(checkboxId);
  if (checkbox) {
    checkbox.checked = !checkbox.checked;
    updateSelectedCount();
  }
}


  // register functions
  NS._handleViewListKeydown = _handleViewListKeydown;
  NS._handleViewListClick = _handleViewListClick;
  NS.selectAllEntries = selectAllEntries;
  NS.deselectAllEntries = deselectAllEntries;
  NS.toggleSelectAll = toggleSelectAll;
  NS.updateSelectedCount = updateSelectedCount;
  NS.getSelectedCattleIds = getSelectedCattleIds;
  NS.toggleRowSelection = toggleRowSelection;
})();
export {};
