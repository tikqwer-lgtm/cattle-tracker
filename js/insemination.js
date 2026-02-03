/**
 * Модуль для работы с осеменением
 * Функции: автоматический расчёт попытки, добавление данных осеменения
 */

// Глобальная переменная для хранения записей (предполагается, что она уже объявлена)
// let entries = []; // Удалено: уже объявлено в storage.js

/**
 * Возвращает номер попытки осеменения для коровы в текущей лактации
 * @param {string} cattleId - номер коровы
 * @param {number} currentLactation - текущая лактация
 * @returns {number} - следующий номер попытки
 */
function getInseminationAttempt(cattleId, currentLactation) {
  if (!Array.isArray(entries)) return 1;

  const attemptsInLactation = entries
    .filter(entry => 
      entry.cattleId === cattleId && 
      entry.lactation === currentLactation && 
      entry.inseminationDate
    )
    .sort((a, b) => new Date(a.inseminationDate) - new Date(b.inseminationDate));

  return attemptsInLactation.length + 1;
}

/**
 * Автоматически заполняет номер попытки при выборе номера коровы и даты осеменения
 */
function autoFillAttempt() {
  const cattleId = document.getElementById('cattleId')?.value.trim();
  const lactation = parseInt(document.getElementById('lactation')?.value) || 1;
  const inseminationDate = document.getElementById('inseminationDate')?.value;

  if (cattleId && inseminationDate) {
    const attempt = getInseminationAttempt(cattleId, lactation);
    document.getElementById('attemptNumber').value = attempt;
  }
}

// Добавляем слушатели для автоматического заполнения попытки на основном экране
if (document.getElementById('cattleId') && document.getElementById('inseminationDate')) {
  document.getElementById('cattleId').addEventListener('change', autoFillAttempt);
  document.getElementById('inseminationDate').addEventListener('change', autoFillAttempt);
}

/**
 * Заполняет список коров для автодополнения
 */
function populateCattleAutocomplete(inputId, listId) {
  const input = document.getElementById(inputId);
  const list = document.getElementById(listId);
  if (!input || !list) return;

  // Очищаем список
  list.innerHTML = '';

  const filter = input.value.toLowerCase();
  const matchingEntries = entries.filter(entry => 
    entry.cattleId.toLowerCase().includes(filter) || 
    (entry.nickname && entry.nickname.toLowerCase().includes(filter))
  ).slice(0, 10); // Ограничиваем 10 результатами

  matchingEntries.forEach(entry => {
    const li = document.createElement('li');
    li.textContent = `${entry.cattleId} (${entry.nickname || '—'})`;
    li.dataset.value = entry.cattleId;
    li.addEventListener('click', () => {
      input.value = entry.cattleId;
      list.innerHTML = '';
      // Синхронизируем со скрытым селектором
      const select = document.getElementById('cattleIdInsem');
      if (select) {
        select.value = entry.cattleId;
        // Вызываем change событие для авто-заполнения попытки
        const event = new Event('change');
        select.dispatchEvent(event);
      }
    });
    list.appendChild(li);
  });
}

/**
 * Инициализирует автодополнение для ввода номера коровы
 */
function initCattleAutocomplete() {
  const input = document.getElementById('cattleIdInsemInput');
  if (!input) return;

  // Обновляем список при вводе
  input.addEventListener('input', () => {
    populateCattleAutocomplete('cattleIdInsemInput', 'cattleIdInsemList');
  });

  // Скрываем список при клике вне поля
  document.addEventListener('click', (e) => {
    const list = document.getElementById('cattleIdInsemList');
    if (list && input !== e.target && !list.contains(e.target)) {
      list.innerHTML = '';
    }
  });
}

// Заменяем populateCattleSelect на использование автодополнения
function populateCattleSelect() {
  // Теперь используем автодополнение, оставляем для обратной совместимости
  initCattleAutocomplete();
}

/**
 * Автоматически заполняет номер попытки на экране ввода осеменения
 */
function autoFillInseminationAttempt() {
  const cattleId = document.getElementById('cattleIdInsem')?.value.trim();
  const inseminationDate = document.getElementById('inseminationDateInsem')?.value;

  if (cattleId && inseminationDate) {
    // Получаем текущую лактацию коровы
    const entry = entries.find(e => e.cattleId === cattleId);
    const lactation = entry?.lactation || 1;
    
    const attempt = getInseminationAttempt(cattleId, lactation);
    document.getElementById('attemptNumberInsem').value = attempt;
  }
}

// Добавляем слушатели для автоматического заполнения на экране ввода осеменения
if (document.getElementById('cattleIdInsem') && document.getElementById('inseminationDateInsem')) {
  document.getElementById('cattleIdInsem').addEventListener('change', () => {
    autoFillInseminationAttempt();
  });
  document.getElementById('inseminationDateInsem').addEventListener('change', () => {
    autoFillInseminationAttempt();
  });
}

/**
 * Добавляет запись осеменения для существующей коровы
 */
function addInseminationEntry() {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/86c9a476-9b52-4c72-882a-524ec24c8a0a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'insemination.js:143',message:'addInseminationEntry called',data:{timestamp:Date.now()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  
  // Пробуем получить ID из обоих полей (для совместимости)
  const cattleIdInput = document.getElementById('cattleIdInsemInput');
  const cattleIdSelect = document.getElementById('cattleIdInsem');
  const cattleId = (cattleIdInput?.value.trim() || cattleIdSelect?.value.trim()) || '';
  const inseminationDate = document.getElementById('inseminationDateInsem')?.value;

  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/86c9a476-9b52-4c72-882a-524ec24c8a0a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'insemination.js:150',message:'Form values extracted',data:{cattleId,cattleIdInputValue:cattleIdInput?.value,cattleIdSelectValue:cattleIdSelect?.value,inseminationDate,entriesCount:entries?.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion

  if (!cattleId || !inseminationDate) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/86c9a476-9b52-4c72-882a-524ec24c8a0a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'insemination.js:155',message:'Validation failed',data:{cattleId:!!cattleId,inseminationDate:!!inseminationDate},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    alert('Заполните номер коровы и дату осеменения!');
    return;
  }

  // Ищем корову в списке записей
  const entry = entries.find(e => e.cattleId === cattleId);
  
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/86c9a476-9b52-4c72-882a-524ec24c8a0a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'insemination.js:163',message:'Entry search result',data:{cattleId,entryFound:!!entry,entryBefore:entry?JSON.stringify(entry):null,entriesCount:entries?.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
  // #endregion
  
  if (!entry) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/86c9a476-9b52-4c72-882a-524ec24c8a0a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'insemination.js:168',message:'Entry not found - returning',data:{cattleId,entriesCount:entries?.length,allCattleIds:entries?.map(e=>e.cattleId)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    alert('Корова с таким номером не найдена!');
    return;
  }

  // Заполняем поля осеменения
  const entryBefore = JSON.parse(JSON.stringify(entry));
  entry.inseminationDate = inseminationDate;
  entry.attemptNumber = parseInt(document.getElementById('attemptNumberInsem')?.value) || 1;
  entry.bull = document.getElementById('bullInsem')?.value || '';
  entry.inseminator = document.getElementById('inseminatorInsem')?.value || '';
  entry.code = document.getElementById('codeInsem')?.value || '';
  entry.status = 'Осеменена'; // Обновляем статус

  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/86c9a476-9b52-4c72-882a-524ec24c8a0a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'insemination.js:182',message:'Entry updated before save',data:{entryBefore,entryAfter:JSON.stringify(entry)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
  // #endregion

  // Сохраняем изменения
  try {
    saveLocally();
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/86c9a476-9b52-4c72-882a-524ec24c8a0a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'insemination.js:189',message:'saveLocally called',data:{entriesCount:entries?.length,localStorageCheck:localStorage.getItem('cattleEntries')?.substring(0,100)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
  } catch (error) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/86c9a476-9b52-4c72-882a-524ec24c8a0a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'insemination.js:193',message:'saveLocally error',data:{error:error.message,errorStack:error.stack},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    console.error('Ошибка сохранения:', error);
  }
  
  try {
    updateList(); // Обновляем список на экране добавления
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/86c9a476-9b52-4c72-882a-524ec24c8a0a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'insemination.js:200',message:'updateList called',data:{updateListExists:typeof updateList === 'function'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
  } catch (error) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/86c9a476-9b52-4c72-882a-524ec24c8a0a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'insemination.js:204',message:'updateList error',data:{error:error.message,errorStack:error.stack},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
    console.error('Ошибка обновления списка:', error);
  }
  
  if (typeof updateViewList === 'function') {
    try {
      updateViewList(); // Обновляем список на экране просмотра
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/86c9a476-9b52-4c72-882a-524ec24c8a0a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'insemination.js:211',message:'updateViewList called',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
    } catch (error) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/86c9a476-9b52-4c72-882a-524ec24c8a0a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'insemination.js:215',message:'updateViewList error',data:{error:error.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      console.error('Ошибка обновления списка просмотра:', error);
    }
  }

  // Очищаем форму
  if (cattleIdInput) cattleIdInput.value = '';
  if (cattleIdSelect) cattleIdSelect.value = '';
  document.getElementById('inseminationDateInsem').value = '';
  document.getElementById('attemptNumberInsem').value = '1';
  document.getElementById('bullInsem').value = '';
  document.getElementById('inseminatorInsem').value = '';
  document.getElementById('codeInsem').value = '';

  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/86c9a476-9b52-4c72-882a-524ec24c8a0a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'insemination.js:230',message:'addInseminationEntry completed',data:{entrySaved:JSON.stringify(entry),entriesCount:entries?.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
  // #endregion

  alert('Данные осеменения добавлены!');
}

/**
 * Инициализация модуля осеменения
 */
function initInseminationModule() {
  // Проверяем, находимся ли мы на экране добавления
  if (document.getElementById('add-screen')?.classList.contains('active')) {
    autoFillAttempt();
  }
  
  // Проверяем, находимся ли мы на экране ввода осеменения
  const inseminationScreen = document.getElementById('insemination-screen');
  if (inseminationScreen?.classList.contains('active')) {
    initCattleAutocomplete();
    autoFillInseminationAttempt();
  }
}

// Инициализация при загрузке и при навигации
document.addEventListener('DOMContentLoaded', initInseminationModule);
document.addEventListener('click', (e) => {
  // Если клик был по кнопке навигации, подождем и инициализируем
  setTimeout(initInseminationModule, 100);
});

// Дополнительная инициализация при показе экрана осеменения
document.addEventListener('click', (e) => {
  const target = e.target;
  if (
    target.matches('[onclick*="navigate(\'insemination\'"]') ||
    target.closest('[onclick*="navigate(\'insemination\'"]')
  ) {
    setTimeout(() => {
      populateCattleSelect();
      autoFillInseminationAttempt();
    }, 150);
  }
});

// Экспортируем функции, если используется модульная система
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getInseminationAttempt, addInseminationEntry };
}