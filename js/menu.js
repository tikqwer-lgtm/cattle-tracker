// menu.js — Навигация между экранами

/**
 * Навигация между экранами
 */
function navigate(screenId) {
  // Скрыть все экраны
  document.querySelectorAll('.screen').forEach(el => {
    el.classList.remove('active');
  });

  // Показать нужный
  const screen = document.getElementById(screenId + '-screen');
  if (screen) {
    screen.classList.add('active');
  }

  // Обновить список при открытии "Просмотр"
  if (screenId === 'view') {
    updateViewList();
  }
  if (screenId === 'all-inseminations' && typeof renderAllInseminationsScreen === 'function') {
    renderAllInseminationsScreen();
  }
  if (screenId === 'notifications' && typeof renderNotificationCenter === 'function') {
    renderNotificationCenter('notification-center-container');
  }
  if (screenId === 'analytics' && typeof renderAnalyticsScreen === 'function') {
    renderAnalyticsScreen();
  }
  if (screenId === 'backup' && typeof renderBackupUI === 'function') {
    renderBackupUI('backup-container');
  }
  
  // Обновить статистику и панель пользователя при открытии меню
  if (screenId === 'menu') {
    updateHerdStats();
    if (typeof updateAuthBar === 'function') updateAuthBar();
  }
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

  // Функция для экранирования HTML и очистки данных
  const escapeHtml = (text) => {
    if (!text) return '—';
    if (typeof text !== 'string') {
      try {
        text = String(text);
      } catch (e) {
        return '—';
      }
    }
    text = text.replace(/[\x00-\x1F\x7F-\x9F]/g, '').trim();
    if (!text) return '—';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  };

  tableContainer.innerHTML = `
    <table class="entries-table">
      <thead>
        <tr>
          <th class="checkbox-column">
            <input type="checkbox" id="selectAllCheckbox" data-bulk-action="toggle-all" aria-label="Выделить все">
          </th>
          <th>Корова</th>
          <th>Кличка</th>
          <th>Лактация</th>
          <th>Дата осеменения</th>
          <th>Бык</th>
          <th>Попытка</th>
          <th>Статус</th>
          <th>Отёл</th>
          <th>Сухостой</th>
          <th>Примечание</th>
          <th>Синхронизация</th>
        </tr>
      </thead>
      <tbody>
        ${listToShow.map((entry, index) => {
          const safeCattleId = escapeHtml(entry.cattleId);
          const checkboxId = `entry-checkbox-${index}`;
          return `
          <tr class="view-entry-row ${entry.synced ? '' : 'unsynced'}" data-row-index="${index}" data-cattle-id="${safeCattleId.replace(/"/g, '&quot;')}" role="button" tabindex="0">
            <td class="checkbox-column">
              <input type="checkbox" id="${checkboxId}" class="entry-checkbox" data-cattle-id="${safeCattleId.replace(/"/g, '&quot;')}" aria-label="Выделить">
            </td>
            <td>${safeCattleId}</td>
            <td>${escapeHtml(entry.nickname)}</td>
            <td>${entry.lactation || '—'}</td>
            <td>${formatDate(entry.inseminationDate) || '—'}</td>
            <td>${escapeHtml(entry.bull)}</td>
            <td>${entry.attemptNumber || '—'}</td>
            <td>${escapeHtml(entry.status)}</td>
            <td>${formatDate(entry.calvingDate) || '—'}</td>
            <td>${formatDate(entry.dryStartDate) || '—'}</td>
            <td>${escapeHtml(entry.note)}</td>
            <td>${entry.synced ? '✅' : '🟡'}</td>
          </tr>
        `;
        }).join('')}
      </tbody>
    </table>
  `;

  // Обработчик на экран просмотра — обрабатываем и панель, и таблицу
  var viewScreen = document.getElementById('view-screen');
  if (viewScreen) {
    viewScreen.removeEventListener('click', _handleViewListClick);
    viewScreen.addEventListener('click', _handleViewListClick);
    viewScreen.removeEventListener('keydown', _handleViewListKeydown);
    viewScreen.addEventListener('keydown', _handleViewListKeydown);
  }

  setTimeout(function () {
    updateSelectedCount();
    // Проверочный код: убедиться, что групповое выделение отрисовано
    _assertBulkSelectionUI();
  }, 0);
}

/**
 * Проверка наличия UI группового выделения (для отладки и надёжности).
 * Если элементов нет — в консоль пишется предупреждение.
 */
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

  // Кнопки панели массовых действий (панель вынесена в viewBulkActions)
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

  // Чекбокс «Выделить все» в шапке таблицы (он в viewEntriesList)
  if (bulkBtn && bulkBtn.getAttribute('data-bulk-action') === 'toggle-all') {
    ev.preventDefault();
    var cb = document.getElementById('selectAllCheckbox');
    if (cb) toggleSelectAll(cb.checked);
    return;
  }

  if (!tableContainer || !tableContainer.contains(target)) return;

  // Чекбокс строки — только обновляем счётчик выделения, не открываем карточку
  if (target.classList && target.classList.contains('entry-checkbox')) {
    ev.stopPropagation();
    setTimeout(updateSelectedCount, 0);
    return;
  }

  // Клик по строке — открыть карточку животного (редактирование там)
  var row = target.closest('tbody tr.view-entry-row');
  if (row) {
    ev.preventDefault();
    var cattleId = row.getAttribute('data-cattle-id');
    if (cattleId && typeof viewCow === 'function') viewCow(cattleId);
  }
}

/**
 * Обновляет статистику стада на главном экране
 */
function updateHerdStats() {
  var list = (typeof getVisibleEntries === 'function') ? getVisibleEntries(entries || []) : (entries || []);
  if (!list || list.length === 0) {
    var totalEl = document.getElementById('totalCows');
    if (totalEl) totalEl.textContent = '0';
    var pEl = document.getElementById('pregnantCows');
    if (pEl) pEl.textContent = '0';
    var dEl = document.getElementById('dryCows');
    if (dEl) dEl.textContent = '0';
    var iEl = document.getElementById('inseminatedCows');
    if (iEl) iEl.textContent = '0';
    var cEl = document.getElementById('cullCows');
    if (cEl) cEl.textContent = '0';
    return;
  }

  const totalCows = list.length;
  const pregnantCows = list.filter(e => e.status && e.status.includes('Отёл')).length;
  const dryCows = list.filter(e => e.status && e.status.includes('Сухостой')).length;
  const inseminatedCows = list.filter(e => e.inseminationDate).length;
  const cullCows = list.filter(e => e.status && e.status.includes('брак')).length;

  document.getElementById('totalCows').textContent = totalCows;
  document.getElementById('pregnantCows').textContent = pregnantCows;
  document.getElementById('dryCows').textContent = dryCows;
  document.getElementById('inseminatedCows').textContent = inseminatedCows;
  document.getElementById('cullCows').textContent = cullCows;
}

// При загрузке сразу открываем меню
document.addEventListener('DOMContentLoaded', () => {
  navigate('menu');
});

// Обновить статистику при загрузке
window.addEventListener('load', () => {
  if (document.getElementById('menu-screen').classList.contains('active')) {
    updateHerdStats();
  }
});

/**
 * Выделяет все записи
 */
function selectAllEntries() {
  const checkboxes = document.querySelectorAll('.entry-checkbox');
  const selectAllCheckbox = document.getElementById('selectAllCheckbox');
  checkboxes.forEach(checkbox => {
    checkbox.checked = true;
  });
  if (selectAllCheckbox) {
    selectAllCheckbox.checked = true;
  }
  updateSelectedCount();
}

/**
 * Снимает выделение со всех записей
 */
function deselectAllEntries() {
  const checkboxes = document.querySelectorAll('.entry-checkbox');
  const selectAllCheckbox = document.getElementById('selectAllCheckbox');
  checkboxes.forEach(checkbox => {
    checkbox.checked = false;
  });
  if (selectAllCheckbox) {
    selectAllCheckbox.checked = false;
  }
  updateSelectedCount();
}

/**
 * Переключает выделение всех записей
 */
function toggleSelectAll(checked) {
  const checkboxes = document.querySelectorAll('.entry-checkbox');
  checkboxes.forEach(checkbox => {
    checkbox.checked = checked;
  });
  updateSelectedCount();
}

/**
 * Обновляет счетчик выделенных записей и состояние кнопки удаления
 */
function updateSelectedCount() {
  const checkboxes = document.querySelectorAll('.entry-checkbox:checked');
  const count = checkboxes.length;
  const countElement = document.getElementById('selectedCount');
  const deleteBtn = document.getElementById('deleteSelectedBtn');
  
  if (countElement) {
    countElement.textContent = `Выделено: ${count}`;
  }
  
  if (deleteBtn) {
    deleteBtn.disabled = count === 0;
  }
  
  // Обновляем состояние чекбокса "Выделить все"
  const selectAllCheckbox = document.getElementById('selectAllCheckbox');
  const allCheckboxes = document.querySelectorAll('.entry-checkbox');
  if (selectAllCheckbox && allCheckboxes.length > 0) {
    selectAllCheckbox.checked = count === allCheckboxes.length;
  }
  
  // Обновляем визуальное выделение строк
  const allRows = document.querySelectorAll('.entries-table tbody tr');
  allRows.forEach(row => {
    const checkbox = row.querySelector('.entry-checkbox');
    if (checkbox && checkbox.checked) {
      row.classList.add('selected-row');
    } else {
      row.classList.remove('selected-row');
    }
  });
}

/**
 * Переключает выделение строки при клике на неё
 */
function toggleRowSelection(event, checkboxId) {
  // Не переключаем, если клик был на кнопке или ссылке
  if (event.target.tagName === 'BUTTON' || event.target.closest('button') || event.target.closest('.actions-cell')) {
    return;
  }
  
  const checkbox = document.getElementById(checkboxId);
  if (checkbox) {
    checkbox.checked = !checkbox.checked;
    updateSelectedCount();
  }
}

// Делаем функции доступными глобально
window.selectAllEntries = selectAllEntries;
window.deselectAllEntries = deselectAllEntries;
window.toggleSelectAll = toggleSelectAll;
window.toggleRowSelection = toggleRowSelection;
window.updateSelectedCount = updateSelectedCount;