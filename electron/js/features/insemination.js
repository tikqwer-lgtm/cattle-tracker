/**
 * Модуль для работы с осеменением
 * Функции: автоматический расчёт попытки, добавление данных осеменения
 */

// Глобальная переменная для хранения записей (предполагается, что она уже объявлена)
// let entries = []; // Удалено: уже объявлено в storage.js

/**
 * Возвращает номер попытки осеменения для коровы в текущей лактации.
 * inseminationHistory сбрасывается при отёле, поэтому содержит только осеменения текущей лактации.
 * @param {string} cattleId - номер коровы
 * @param {number} [currentLactation] - не используется (оставлен для совместимости вызовов)
 * @returns {number} - следующий номер попытки
 */
function getInseminationAttempt(cattleId, currentLactation) {
  if (!Array.isArray(entries)) return 1;
  var entry = entries.find(function (e) { return e.cattleId === cattleId; });
  if (!entry || !Array.isArray(entry.inseminationHistory)) return 1;
  return entry.inseminationHistory.length + 1;
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

  if (!cattleId) {
    if (typeof showToast === 'function') showToast('Заполните номер коровы!', 'error'); else alert('Заполните номер коровы!');
    return;
  }

  // Ищем корову в списке записей
  const entry = entries.find(e => e.cattleId === cattleId);
  
  if (!entry) {
    if (typeof showToast === 'function') showToast('Корова с таким номером не найдена!', 'error'); else alert('Корова с таким номером не найдена!');
    return;
  }

  if (inseminationDate && typeof validateDateNotFuture === 'function') {
    var err = validateDateNotFuture(inseminationDate, 'Дата осеменения');
    if (err) {
      if (typeof showToast === 'function') showToast(err && err.message ? err.message : err, 'error'); else alert(err);
      return;
    }
  }

  const attemptNumber = parseInt(document.getElementById('attemptNumberInsem')?.value) || 1;
  const bull = document.getElementById('bullInsem')?.value || '';
  const inseminator = document.getElementById('inseminatorInsem')?.value || '';
  const code = document.getElementById('codeInsem')?.value || '';

  // Добавляем в историю осеменений
  if (!entry.inseminationHistory) entry.inseminationHistory = [];
  entry.inseminationHistory.push({
    date: inseminationDate,
    attemptNumber: attemptNumber,
    bull: bull,
    inseminator: inseminator,
    code: code
  });

  // Заполняем основные поля осеменения (последнее осеменение)
  entry.inseminationDate = inseminationDate;
  entry.attemptNumber = attemptNumber;
  entry.bull = bull;
  entry.inseminator = inseminator;
  entry.code = code;
  entry.status = 'Осеменена';

  var detailsStr = (inseminationDate ? 'Дата: ' + inseminationDate : '') + (attemptNumber ? ', попытка: ' + attemptNumber : '') + (bull ? ', бык: ' + bull : '') + (inseminator ? ', осеменатор: ' + inseminator : '') + (code ? ', код: ' + code : '');
  var _pushHist = typeof pushActionHistory === 'function' ? pushActionHistory : window.pushActionHistory;
  if (typeof _pushHist === 'function') _pushHist(entry, 'Осеменение', detailsStr, { eventType: 'Осеменение', attemptNumber: attemptNumber, bull: bull, inseminator: inseminator, code: code });

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

  if (typeof showToast === 'function') showToast('Данные осеменения добавлены!', 'success'); else alert('Данные осеменения добавлены!');
  if (typeof window !== 'undefined' && window._returnToViewCow) {
    if (typeof navigate === 'function') navigate('view-cow');
    if (typeof viewCow === 'function') viewCow(cattleId);
    window._returnToViewCow = null;
  } else if (typeof navigate === 'function') navigate('menu');
}

/**
 * Инициализация модуля осеменения
 */
/**
 * Инициализация экрана ввода осеменения при навигации. Заполняет номер коровы из _prefillCattleId.
 */
function initInseminationScreen() {
  initCattleAutocomplete();
  initInseminationAttemptListeners();
  if (typeof window !== 'undefined' && window._prefillCattleId) {
    var el = document.getElementById('cattleIdInsemInput');
    if (el) { el.value = window._prefillCattleId; }
    var sel = document.getElementById('cattleIdInsem');
    if (sel) { sel.value = window._prefillCattleId; }
    delete window._prefillCattleId;
  }
  autoFillInseminationAttempt();
}

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
export {};
