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
  const container = document.getElementById('viewEntriesList');
  if (!container) return;

  var baseList = (typeof getFilteredEntries === 'function') ? getFilteredEntries() : (entries || []);
  var listToShow = (typeof getVisibleEntries === 'function') ? getVisibleEntries(baseList) : baseList;
  if (!listToShow || listToShow.length === 0) {
    var noResultsHint = (baseList.length === 0 && entries && entries.length > 0) ? ' (поиск/фильтр не дали результатов)' : ((entries && entries.length > 0 && listToShow.length === 0 && baseList.length > 0) ? ' (нет доступа)' : '');
    container.innerHTML = '<p>Нет записей' + noResultsHint + '</p>';
    return;
  }

  // Функция для экранирования HTML и очистки данных
  const escapeHtml = (text) => {
    if (!text) return '—';
    if (typeof text !== 'string') {
      // Если это не строка, пытаемся преобразовать
      try {
        text = String(text);
      } catch (e) {
        return '—';
      }
    }
    // Удаляем бинарные и невидимые символы
    text = text.replace(/[\x00-\x1F\x7F-\x9F]/g, '').trim();
    if (!text) return '—';
    // Экранируем HTML
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  };

  container.innerHTML = `
    <div class="bulk-actions-bar">
      <div class="bulk-actions-left">
        <button onclick="selectAllEntries()" class="bulk-action-btn">✓ Выделить все</button>
        <button onclick="deselectAllEntries()" class="bulk-action-btn">✗ Снять выделение</button>
        <span id="selectedCount" class="selected-count">Выделено: 0</span>
      </div>
      <div class="bulk-actions-right">
        <button onclick="deleteSelectedEntries()" class="bulk-action-btn delete-bulk" id="deleteSelectedBtn" disabled>🗑️ Удалить выделенные</button>
      </div>
    </div>
    <table class="entries-table">
      <thead>
        <tr>
          <th class="checkbox-column">
            <input type="checkbox" id="selectAllCheckbox" onchange="toggleSelectAll(this.checked)">
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
          <th>Действия</th>
        </tr>
      </thead>
      <tbody>
        ${listToShow.map((entry, index) => {
          const safeCattleId = escapeHtml(entry.cattleId);
          const checkboxId = `entry-checkbox-${index}`;
          return `
          <tr class="${entry.synced ? '' : 'unsynced'}" data-cattle-id="${safeCattleId.replace(/"/g, '&quot;')}" onclick="toggleRowSelection(event, '${checkboxId}')">
            <td class="checkbox-column" onclick="event.stopPropagation()">
              <input type="checkbox" id="${checkboxId}" class="entry-checkbox" onchange="updateSelectedCount()" data-cattle-id="${safeCattleId.replace(/"/g, '&quot;')}">
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
            <td class="actions-cell">
              <button onclick="event.stopPropagation(); viewCow('${safeCattleId.replace(/'/g, "\\'")}')" class="small-btn view" title="Карточка">👁</button>
              <button onclick="event.stopPropagation(); editEntry('${safeCattleId.replace(/'/g, "\\'")}')" class="small-btn edit">✏️</button>
              <button onclick="event.stopPropagation(); deleteEntry('${safeCattleId.replace(/'/g, "\\'")}')" class="small-btn delete">🗑️</button>
            </td>
          </tr>
        `;
        }).join('')}
      </tbody>
    </table>
  `;
  
  // Инициализируем счетчик выделенных записей после рендеринга
  setTimeout(() => {
    updateSelectedCount();
  }, 0);
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