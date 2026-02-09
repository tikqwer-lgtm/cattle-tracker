// view-list.js — список на экране «Просмотр», массовое выделение

var viewListSortKey = '';
var viewListSortDir = 'asc';
var VIEW_LIST_FIELDS_KEY = 'cattleTracker_viewList_visibleFields';

function viewListEscapeHtml(text) {
  if (!text) return '—';
  if (typeof text !== 'string') {
    try { text = String(text); } catch (e) { return '—'; }
  }
  text = text.replace(/[\x00-\x1F\x7F-\x9F]/g, '').trim();
  if (!text) return '—';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

var VIEW_LIST_FIELDS = [
  { key: 'cattleId', label: 'Корова', sortable: true, render: function (entry) { return viewListEscapeHtml(entry.cattleId); } },
  { key: 'nickname', label: 'Кличка', sortable: true, render: function (entry) { return viewListEscapeHtml(entry.nickname); } },
  { key: 'group', label: 'Группа', sortable: true, render: function (entry) { return viewListEscapeHtml(entry.group || ''); } },
  { key: 'lactation', label: 'Лактация', sortable: true, render: function (entry) { return entry.lactation || '—'; } },
  { key: 'inseminationDate', label: 'Дата осеменения', sortable: true, render: function (entry) { return formatDate(entry.inseminationDate) || '—'; } },
  { key: 'bull', label: 'Бык', sortable: true, render: function (entry) { return viewListEscapeHtml(entry.bull); } },
  { key: 'attemptNumber', label: 'Попытка', sortable: true, render: function (entry) { return entry.attemptNumber || '—'; } },
  { key: 'status', label: 'Статус', sortable: true, render: function (entry) { return viewListEscapeHtml(entry.status); } },
  { key: 'calvingDate', label: 'Отёл', sortable: true, render: function (entry) { return formatDate(entry.calvingDate) || '—'; } },
  { key: 'dryStartDate', label: 'Сухостой', sortable: true, render: function (entry) { return formatDate(entry.dryStartDate) || '—'; } },
  { key: 'note', label: 'Примечание', sortable: true, render: function (entry) { return viewListEscapeHtml(entry.note); } },
  { key: 'synced', label: 'Синхронизация', sortable: true, render: function (entry) { return entry.synced ? '✅' : '🟡'; } }
];

function getVisibleFieldKeys() {
  try {
    var raw = localStorage.getItem(VIEW_LIST_FIELDS_KEY);
    if (raw) {
      var list = JSON.parse(raw);
      if (Array.isArray(list) && list.length > 0) return list;
    }
  } catch (e) {}
  return VIEW_LIST_FIELDS.map(function (f) { return f.key; });
}

function getVisibleViewFields() {
  var keys = getVisibleFieldKeys();
  var map = {};
  VIEW_LIST_FIELDS.forEach(function (f) { map[f.key] = f; });
  return keys.map(function (k) { return map[k]; }).filter(Boolean);
}

function _compareViewList(a, b, key, dir) {
  var mul = dir === 'asc' ? 1 : -1;
  var va = a[key];
  var vb = b[key];
  if (key === 'inseminationDate' || key === 'calvingDate' || key === 'dryStartDate') {
    var da = va ? new Date(va).getTime() : 0;
    var db = vb ? new Date(vb).getTime() : 0;
    return mul * (da - db);
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

  var baseList = (typeof getFilteredEntries === 'function') ? getFilteredEntries() : (entries || []);
  var listToShow = (typeof getVisibleEntries === 'function') ? getVisibleEntries(baseList) : baseList;
  if (listToShow && listToShow.length > 0 && viewListSortKey) {
    listToShow = listToShow.slice();
    listToShow.sort(function (a, b) { return _compareViewList(a, b, viewListSortKey, viewListSortDir); });
  }

  var bulkBarHtml = '<div class="bulk-actions-bar">' +
    '<div class="bulk-actions-left">' +
    '<button type="button" data-bulk-action="select-all" class="bulk-action-btn">✓ Выделить все</button>' +
    '<button type="button" data-bulk-action="deselect-all" class="bulk-action-btn">✗ Снять выделение</button>' +
    '<span id="selectedCount" class="selected-count">Выделено: 0</span>' +
    '</div>' +
    '<div class="bulk-actions-right">' +
    '<button type="button" data-bulk-action="delete-selected" class="bulk-action-btn delete-bulk" id="deleteSelectedBtn" disabled>🗑️ Удалить выделенные</button>' +
    '</div></div>';

  if (!listToShow || listToShow.length === 0) {
    var noResultsHint = (baseList.length === 0 && entries && entries.length > 0) ? ' (поиск/фильтр не дали результатов)' : ((entries && entries.length > 0 && listToShow.length === 0 && baseList.length > 0) ? ' (нет доступа)' : '');
    if (bulkContainer) bulkContainer.innerHTML = '';
    tableContainer.innerHTML = '<p>Нет записей' + noResultsHint + '</p>';
    return;
  }

  if (bulkContainer) bulkContainer.innerHTML = bulkBarHtml;

  var fields = getVisibleViewFields();
  var fieldKeys = fields.map(function (f) { return f.key; });
  if (viewListSortKey && fieldKeys.indexOf(viewListSortKey) === -1) {
    viewListSortKey = '';
  }

  var sortAsc = viewListSortDir === 'asc';
  var sortMark = function (key) {
    if (viewListSortKey !== key) return '';
    return sortAsc ? ' <span class="sort-indicator" aria-hidden="true">▲</span>' : ' <span class="sort-indicator" aria-hidden="true">▼</span>';
  };
  var sortClass = function (key) {
    if (viewListSortKey !== key) return '';
    return sortAsc ? ' sort-asc' : ' sort-desc';
  };
  tableContainer.innerHTML = `
    <table class="entries-table">
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
          const safeCattleId = viewListEscapeHtml(entry.cattleId);
          const checkboxId = `entry-checkbox-${index}`;
          const cells = fields.map(field => `<td>${field.render(entry)}</td>`).join('');
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

  initViewFieldsSettings();

  setTimeout(function () {
    updateSelectedCount();
    _assertBulkSelectionUI();
  }, 0);
}

function initViewFieldsSettings() {
  var btn = document.getElementById('viewFieldsSettingsBtn');
  var modal = document.getElementById('viewFieldsSettingsModal');
  var closeBtn = document.getElementById('viewFieldsCloseBtn');
  var saveBtn = document.getElementById('viewFieldsSaveBtn');
  var resetBtn = document.getElementById('viewFieldsResetBtn');
  if (!modal || !btn || btn.dataset.bound === '1') return;
  btn.dataset.bound = '1';
  btn.addEventListener('click', openViewFieldsSettings);
  if (closeBtn) closeBtn.addEventListener('click', closeViewFieldsSettings);
  if (resetBtn) resetBtn.addEventListener('click', function () {
    try { localStorage.removeItem(VIEW_LIST_FIELDS_KEY); } catch (e) {}
    renderViewFieldsSettings();
  });
  if (saveBtn) saveBtn.addEventListener('click', function () {
    var checked = Array.prototype.slice.call(modal.querySelectorAll('.view-fields-checkbox:checked'))
      .map(function (el) { return el.value; });
    if (checked.length === 0) {
      alert('Выберите хотя бы одно поле.');
      return;
    }
    try {
      localStorage.setItem(VIEW_LIST_FIELDS_KEY, JSON.stringify(checked));
    } catch (e) {}
    closeViewFieldsSettings();
    updateViewList();
  });
  modal.addEventListener('click', function (ev) {
    if (ev.target === modal) closeViewFieldsSettings();
  });
}

function renderViewFieldsSettings() {
  var modal = document.getElementById('viewFieldsSettingsModal');
  var listEl = document.getElementById('viewFieldsList');
  if (!modal || !listEl) return;
  var visible = getVisibleFieldKeys();
  var html = VIEW_LIST_FIELDS.map(function (field) {
    var checked = visible.indexOf(field.key) !== -1;
    return '<label class="view-fields-item">' +
      '<input type="checkbox" class="view-fields-checkbox" value="' + field.key + '"' + (checked ? ' checked' : '') + ' />' +
      '<span>' + field.label + '</span>' +
      '</label>';
  }).join('');
  listEl.innerHTML = html;
}

function openViewFieldsSettings() {
  var modal = document.getElementById('viewFieldsSettingsModal');
  if (!modal) return;
  renderViewFieldsSettings();
  modal.classList.add('active');
  modal.setAttribute('aria-hidden', 'false');
}

function closeViewFieldsSettings() {
  var modal = document.getElementById('viewFieldsSettingsModal');
  if (!modal) return;
  modal.classList.remove('active');
  modal.setAttribute('aria-hidden', 'true');
}

function _assertBulkSelectionUI() {
  var bulk = document.getElementById('viewBulkActions');
  var selectAll = document.getElementById('selectAllCheckbox');
  var checkboxes = document.querySelectorAll('.entry-checkbox');
  var bar = document.querySelector('.bulk-actions-bar');
  if (!bulk || !bulk.innerHTML) {
    console.warn('[Просмотр описи] Панель выделения (viewBulkActions) пуста');
    return;
  }
  if (!bar) {
    console.warn('[Просмотр описи] Элемент .bulk-actions-bar не найден');
    return;
  }
  if (!selectAll && checkboxes.length > 0) {
    console.warn('[Просмотр описи] Чекбокс «Выделить все» не найден');
    return;
  }
  if (checkboxes.length === 0 && document.getElementById('viewEntriesList') && document.querySelector('.entries-table tbody')) {
    console.warn('[Просмотр описи] В таблице нет чекбоксов строк (.entry-checkbox)');
  }
}

function _handleViewListKeydown(ev) {
  var sortTh = ev.target.closest('th[data-sort-key]');
  if (sortTh && (ev.key === 'Enter' || ev.key === ' ')) {
    ev.preventDefault();
    var key = sortTh.getAttribute('data-sort-key');
    if (key) {
      if (viewListSortKey === key) viewListSortDir = viewListSortDir === 'asc' ? 'desc' : 'asc';
      else { viewListSortKey = key; viewListSortDir = 'asc'; }
      updateViewList();
    }
    return;
  }
  if (ev.key !== 'Enter' && ev.key !== ' ') return;
  var row = ev.target.closest('tbody tr.view-entry-row');
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

  var sortTh = target.closest('th[data-sort-key]');
  if (sortTh && tableContainer && tableContainer.contains(sortTh)) {
    ev.preventDefault();
    var key = sortTh.getAttribute('data-sort-key');
    if (key) {
      if (viewListSortKey === key) viewListSortDir = viewListSortDir === 'asc' ? 'desc' : 'asc';
      else { viewListSortKey = key; viewListSortDir = 'asc'; }
      updateViewList();
    }
    return;
  }

  if (!tableContainer || !tableContainer.contains(target)) return;

  if (target.classList && target.classList.contains('entry-checkbox')) {
    ev.stopPropagation();
    setTimeout(updateSelectedCount, 0);
    return;
  }

  var row = target.closest('tbody tr.view-entry-row');
  if (row) {
    ev.preventDefault();
    var cattleId = row.getAttribute('data-cattle-id');
    if (cattleId && typeof viewCow === 'function') viewCow(cattleId);
  }
}

function selectAllEntries() {
  const checkboxes = document.querySelectorAll('.entry-checkbox');
  const selectAllCheckbox = document.getElementById('selectAllCheckbox');
  checkboxes.forEach(checkbox => { checkbox.checked = true; });
  if (selectAllCheckbox) selectAllCheckbox.checked = true;
  updateSelectedCount();
}

function deselectAllEntries() {
  const checkboxes = document.querySelectorAll('.entry-checkbox');
  const selectAllCheckbox = document.getElementById('selectAllCheckbox');
  checkboxes.forEach(checkbox => { checkbox.checked = false; });
  if (selectAllCheckbox) selectAllCheckbox.checked = false;
  updateSelectedCount();
}

function toggleSelectAll(checked) {
  const checkboxes = document.querySelectorAll('.entry-checkbox');
  checkboxes.forEach(checkbox => { checkbox.checked = checked; });
  updateSelectedCount();
}

function updateSelectedCount() {
  const checkboxes = document.querySelectorAll('.entry-checkbox:checked');
  const count = checkboxes.length;
  const countElement = document.getElementById('selectedCount');
  const deleteBtn = document.getElementById('deleteSelectedBtn');
  if (countElement) countElement.textContent = 'Выделено: ' + count;
  if (deleteBtn) deleteBtn.disabled = count === 0;
  const selectAllCheckbox = document.getElementById('selectAllCheckbox');
  const allCheckboxes = document.querySelectorAll('.entry-checkbox');
  if (selectAllCheckbox && allCheckboxes.length > 0) {
    selectAllCheckbox.checked = count === allCheckboxes.length;
  }
  const allRows = document.querySelectorAll('.entries-table tbody tr');
  allRows.forEach(row => {
    const checkbox = row.querySelector('.entry-checkbox');
    if (checkbox && checkbox.checked) row.classList.add('selected-row');
    else row.classList.remove('selected-row');
  });
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

window.selectAllEntries = selectAllEntries;
window.deselectAllEntries = deselectAllEntries;
window.toggleSelectAll = toggleSelectAll;
window.toggleRowSelection = toggleRowSelection;
window.updateSelectedCount = updateSelectedCount;
