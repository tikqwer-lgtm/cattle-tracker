// ui-helpers.js — Вспомогательные функции для UI

/**
 * Очищает форму ввода
 */
function clearForm() {
  const fields = [
    'cattleId', 'nickname', 'birthDate', 'lactation', 'calvingDate',
    'inseminationDate', 'attemptNumber', 'bull', 'inseminator', 'code',
    'status', 'protocolName', 'protocolStartDate', 'exitDate', 
    'dryStartDate', 'vwp', 'note'
  ];
  
  fields.forEach(fieldId => {
    const element = document.getElementById(fieldId);
    if (element) {
      if (element.type === 'select-one') {
        element.selectedIndex = 0;
      } else if (element.type === 'number') {
        element.value = fieldId === 'lactation' ? '1' : 
                       fieldId === 'attemptNumber' ? '1' :
                       fieldId === 'vwp' ? '60' : '';
      } else {
        element.value = '';
      }
    }
  });
  
  // Устанавливаем статус по умолчанию
  const statusElement = document.getElementById('status');
  if (statusElement) {
    statusElement.value = 'Охота';
  }
}

/**
 * Форматирует дату в виде "дд.мм.гггг"
 * @param {string} dateStr
 * @returns {string}
 */
function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("ru-RU");
}

/**
 * Обновляет отображение списка записей на экране добавления
 */
function updateList() {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/86c9a476-9b52-4c72-882a-524ec24c8a0a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ui-helpers.js:51',message:'updateList called',data:{entriesCount:entries?.length,listElementExists:!!document.getElementById('entriesList')},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
  // #endregion
  const list = document.getElementById("entriesList");
  if (!list) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/86c9a476-9b52-4c72-882a-524ec24c8a0a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ui-helpers.js:56',message:'updateList: list element not found',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
    return;
  }

  list.innerHTML = `<div><strong>Всего: ${entries.length}</strong></div>`;
  
  if (entries.length === 0) {
    list.innerHTML += `<div style="color: #999; margin-top: 10px;">Нет данных</div>`;
  } else {
    entries.forEach(entry => {
      const div = document.createElement("div");
      div.className = "entry" + (!entry.synced ? " unsynced" : "");
      div.innerHTML = `
        <strong>Корова:</strong> ${entry.cattleId} | 
        <strong>Кличка:</strong> ${entry.nickname || '—'}<br>
        <strong>Дата осеменения:</strong> ${formatDate(entry.inseminationDate)} | 
        <strong>Лактация:</strong> ${entry.lactation}<br>
        <strong>Бык:</strong> ${entry.bull || '—'} | 
        <strong>Попытка:</strong> ${entry.attemptNumber || '—'} | 
        <strong>Статус:</strong> ${entry.status}<br>
        <em style="color: #666;">
          ${entry.code ? 'Код: ' + entry.code + ' • ' : ''}
          ${entry.calvingDate ? 'Отёл: ' + formatDate(entry.calvingDate) + ' • ' : ''}
          ${entry.dryStartDate ? 'Сухостой: ' + formatDate(entry.dryStartDate) + ' • ' : ''}
          ${entry.note ? entry.note : ''}
        </em>
        ${!entry.synced ? '<span style="color: #ff9900; font-size: 12px;"> ● Не отправлено</span>' : ''}
      `;
      list.appendChild(div);
    });
  }
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/86c9a476-9b52-4c72-882a-524ec24c8a0a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ui-helpers.js:81',message:'updateList completed',data:{entriesDisplayed:entries?.length,listInnerHTMLLength:list.innerHTML?.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
  // #endregion
}

// Экспорт функций
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    clearForm,
    formatDate,
    updateList
  };
}