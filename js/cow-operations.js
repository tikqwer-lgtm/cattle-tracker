// cow-operations.js — Операции с записями коров

/**
 * Редактирует существующую запись
 * @param {string} cattleId - Номер коровы
 */
function editEntry(cattleId) {
  const entry = entries.find(e => e.cattleId === cattleId);
  if (!entry) {
    alert('Запись не найдена!');
    return;
  }

  // Устанавливаем режим редактирования
  window.currentEditingId = entry.cattleId;

  // Обновляем заголовок экрана
  const titleElement = document.getElementById('addScreenTitle');
  if (titleElement) {
    titleElement.textContent = '✏️ Редактирование коровы ' + entry.cattleId;
  }

  // Заполняем форму данными из записи
  fillFormFromCowEntry(entry);

  // Переключаемся на экран добавления/редактирования
  if (typeof navigate === 'function') {
    navigate('add');
  }
}

/**
 * Удаляет запись
 * @param {string} cattleId - Номер коровы
 */
function deleteEntry(cattleId) {
  if (!confirm(`Удалить запись о корове ${cattleId}?`)) {
    return;
  }

  const index = entries.findIndex(e => e.cattleId === cattleId);
  if (index !== -1) {
    entries.splice(index, 1);
    saveLocally();
    updateList();
    if (typeof updateViewList === 'function') {
      updateViewList();
    }
    alert('Запись удалена');
  } else {
    alert('Запись не найдена!');
  }
}

/**
 * Удаляет выделенные записи
 */
function deleteSelectedEntries() {
  const checkboxes = document.querySelectorAll('.entry-checkbox:checked');
  if (checkboxes.length === 0) {
    alert('Нет выделенных записей для удаления');
    return;
  }

  const selectedCattleIds = Array.from(checkboxes).map(checkbox => 
    checkbox.getAttribute('data-cattle-id')
  );

  const count = selectedCattleIds.length;
  const confirmMessage = `Вы уверены, что хотите удалить ${count} ${count === 1 ? 'запись' : count < 5 ? 'записи' : 'записей'}?`;
  
  if (!confirm(confirmMessage)) {
    return;
  }

  let deletedCount = 0;
  selectedCattleIds.forEach(cattleId => {
    const index = entries.findIndex(e => e.cattleId === cattleId);
    if (index !== -1) {
      entries.splice(index, 1);
      deletedCount++;
    }
  });

  if (deletedCount > 0) {
    saveLocally();
    updateList();
    if (typeof updateViewList === 'function') {
      updateViewList();
    }
    if (typeof updateHerdStats === 'function') {
      updateHerdStats();
    }
    alert(`Удалено записей: ${deletedCount}`);
  } else {
    alert('Не удалось найти записи для удаления');
  }
}

/**
 * Заполняет форму данными из записи коровы
 * @param {Object} entry - Запись коровы
 */
function fillFormFromCowEntry(entry) {
  document.getElementById('cattleId').value = entry.cattleId || '';
  document.getElementById('nickname').value = entry.nickname || '';
  document.getElementById('group').value = entry.group || '';
  document.getElementById('birthDate').value = entry.birthDate || '';
  document.getElementById('lactation').value = entry.lactation !== undefined && entry.lactation !== '' ? entry.lactation : '';
  document.getElementById('calvingDate').value = entry.calvingDate || '';
  document.getElementById('inseminationDate').value = entry.inseminationDate || '';
  document.getElementById('attemptNumber').value = entry.attemptNumber || 1;
  document.getElementById('bull').value = entry.bull || '';
  document.getElementById('inseminator').value = entry.inseminator || '';
  document.getElementById('code').value = entry.code || '';
  document.getElementById('status').value = entry.status || '';
  document.getElementById('exitDate').value = entry.exitDate || '';
  document.getElementById('dryStartDate').value = entry.dryStartDate || '';
  document.getElementById('vwp').value = (typeof getPDO === 'function' ? getPDO(entry) : entry.vwp) || '—';
  document.getElementById('protocolName').value = entry.protocol?.name || '';
  document.getElementById('protocolStartDate').value = entry.protocol?.startDate || '';
  document.getElementById('note').value = entry.note || '';
}

/**
 * Заполняет запись коровы данными из формы
 * @param {Object} entry - Запись коровы для заполнения
 */
function fillCowEntryFromForm(entry) {
  entry.cattleId = document.getElementById('cattleId').value.trim();
  entry.nickname = document.getElementById('nickname').value || '';
  entry.group = document.getElementById('group').value || '';
  entry.birthDate = document.getElementById('birthDate').value || '';
  var lactationVal = document.getElementById('lactation').value.trim();
  entry.lactation = lactationVal === '' ? '' : (parseInt(lactationVal, 10) || '');
  entry.calvingDate = document.getElementById('calvingDate').value || '';
  entry.inseminationDate = document.getElementById('inseminationDate').value;
  entry.attemptNumber = parseInt(document.getElementById('attemptNumber').value) || 1;
  entry.bull = document.getElementById('bull').value || '';
  entry.inseminator = document.getElementById('inseminator').value || '';
  entry.code = document.getElementById('code').value || '';
  entry.status = document.getElementById('status').value || '';
  entry.exitDate = document.getElementById('exitDate').value || '';
  entry.dryStartDate = document.getElementById('dryStartDate').value || '';
  // ПДО не сохраняем — рассчитывается автоматически; vwp оставляем для совместимости импорта
  entry.note = document.getElementById('note').value || '';
  
  // Протокол синхронизации
  if (!entry.protocol) entry.protocol = {};
  entry.protocol.name = document.getElementById('protocolName').value || '';
  entry.protocol.startDate = document.getElementById('protocolStartDate').value || '';

  // Синхронизация последней записи в истории осеменений с полями формы
  if (entry.inseminationHistory && entry.inseminationHistory.length > 0) {
    var last = entry.inseminationHistory[entry.inseminationHistory.length - 1];
    last.date = entry.inseminationDate || '';
    last.attemptNumber = entry.attemptNumber;
    last.bull = entry.bull || '';
    last.inseminator = entry.inseminator || '';
    last.code = entry.code || '';
  }
}

/**
 * Отменяет редактирование
 */
function cancelEdit() {
  if (window.currentEditingId) {
    delete window.currentEditingId;
    const titleElement = document.getElementById('addScreenTitle');
    if (titleElement) {
      titleElement.textContent = '➕ Добавить корову';
    }
  }
  clearForm();
  if (typeof navigate === 'function') {
    navigate('view');
  }
}

// Делаем функцию массового удаления доступной глобально
window.deleteSelectedEntries = deleteSelectedEntries;

// Экспорт функций
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    editEntry,
    deleteEntry,
    deleteSelectedEntries,
    fillFormFromCowEntry,
    fillCowEntryFromForm,
    cancelEdit
  };
}