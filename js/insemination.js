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
  if (!Array.isArray(entries)) {
    return 1;
  }

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
      }
      // Вызываем авто-заполнение попытки напрямую
      autoFillInseminationAttempt();
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
  // Пробуем получить ID из обоих полей (input и select)
  const cattleIdInput = document.getElementById('cattleIdInsemInput');
  const cattleIdSelect = document.getElementById('cattleIdInsem');
  const cattleId = (cattleIdInput?.value.trim() || cattleIdSelect?.value.trim()) || '';
  const inseminationDate = document.getElementById('inseminationDateInsem')?.value;

  if (cattleId && inseminationDate) {
    // Получаем текущую лактацию коровы
    const entry = entries.find(e => e.cattleId === cattleId);
    const lactation = entry?.lactation || 1;
    
    const attempt = getInseminationAttempt(cattleId, lactation);
    const attemptField = document.getElementById('attemptNumberInsem');
    if (attemptField) {
      attemptField.value = attempt;
    }
  }
}

/**
 * Инициализирует слушатели событий для автоматического заполнения попытки
 * Вызывается при открытии экрана осеменения
 */
function initInseminationAttemptListeners() {
  const cattleIdInput = document.getElementById('cattleIdInsemInput');
  const cattleIdSelect = document.getElementById('cattleIdInsem');
  const inseminationDateField = document.getElementById('inseminationDateInsem');
  
  // Удаляем старые слушатели, если они есть
  if (cattleIdInput) {
    cattleIdInput.removeEventListener('input', autoFillInseminationAttempt);
    cattleIdInput.removeEventListener('change', autoFillInseminationAttempt);
    cattleIdInput.addEventListener('input', autoFillInseminationAttempt);
    cattleIdInput.addEventListener('change', autoFillInseminationAttempt);
  }
  
  if (cattleIdSelect) {
    cattleIdSelect.removeEventListener('change', autoFillInseminationAttempt);
    cattleIdSelect.addEventListener('change', autoFillInseminationAttempt);
  }
  
  if (inseminationDateField) {
    inseminationDateField.removeEventListener('change', autoFillInseminationAttempt);
    inseminationDateField.addEventListener('change', autoFillInseminationAttempt);
  }
}

// Инициализация слушателей при загрузке (если элементы уже есть)
if (document.getElementById('cattleIdInsemInput') || document.getElementById('cattleIdInsem')) {
  initInseminationAttemptListeners();
}

/**
 * Добавляет запись осеменения для существующей коровы
 */
function addInseminationEntry() {
  // Пробуем получить ID из обоих полей (для совместимости)
  const cattleIdInput = document.getElementById('cattleIdInsemInput');
  const cattleIdSelect = document.getElementById('cattleIdInsem');
  const cattleId = (cattleIdInput?.value.trim() || cattleIdSelect?.value.trim()) || '';
  const inseminationDate = document.getElementById('inseminationDateInsem')?.value;

  if (!cattleId || !inseminationDate) {
    alert('Заполните номер коровы и дату осеменения!');
    return;
  }

  // Ищем корову в списке записей
  const entry = entries.find(e => e.cattleId === cattleId);
  
  if (!entry) {
    alert('Корова с таким номером не найдена!');
    return;
  }

  // Заполняем поля осеменения
  entry.inseminationDate = inseminationDate;
  entry.attemptNumber = parseInt(document.getElementById('attemptNumberInsem')?.value) || 1;
  entry.bull = document.getElementById('bullInsem')?.value || '';
  entry.inseminator = document.getElementById('inseminatorInsem')?.value || '';
  entry.code = document.getElementById('codeInsem')?.value || '';
  entry.status = 'Осеменена'; // Обновляем статус

  // Сохраняем изменения
  try {
    saveLocally();
  } catch (error) {
    console.error('Ошибка сохранения:', error);
  }
  
  try {
    updateList(); // Обновляем список на экране добавления
  } catch (error) {
    console.error('Ошибка обновления списка:', error);
  }
  
  if (typeof updateViewList === 'function') {
    try {
      updateViewList(); // Обновляем список на экране просмотра
    } catch (error) {
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
    initInseminationAttemptListeners(); // Инициализируем слушатели
    autoFillInseminationAttempt(); // Пробуем заполнить сразу, если поля уже заполнены
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
      initInseminationAttemptListeners(); // Инициализируем слушатели при открытии экрана
      autoFillInseminationAttempt();
    }, 150);
  }
});

// Экспортируем функции, если используется модульная система
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getInseminationAttempt, addInseminationEntry };
}