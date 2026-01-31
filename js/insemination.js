/**
 * Модуль для работы с осеменением
 * Функции: автоматический расчёт попытки, добавление данных осеменения
 */

// Глобальная переменная для хранения записей (предполагается, что она уже объявлена)
// let entries = [];

/**
 * Возвращает номер попытки осеменения для коровы в текущей лактации
 * @param {string} cattleId - номер коровы
 * @param {number} currentLactation - текущая лактация
 * @returns {number} - следующий номер попытки
 */
function getInseminationAttempt(cattleId, currentLactation) {
  // Фильтруем все записи коровы в текущей лактации
  const attemptsInLactation = entries
    .filter(entry => 
      entry.cattleId === cattleId && 
      entry.lactation === currentLactation && 
      entry.inseminationDate
    )
    .sort((a, b) => new Date(a.inseminationDate) - new Date(b.inseminationDate));

  // Если есть предыдущие попытки, возвращаем следующий номер
  if (attemptsInLactation.length > 0) {
    return attemptsInLactation.length + 1;
  }
  
  // Иначе начинаем с 1
  return 1;
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
 * Автоматически заполняет номер попытки на экране ввода осеменения
 */
function autoFillInseminationAttempt() {
  const cattleId = document.getElementById('cattleIdInsem')?.value.trim();
  const lactation = parseInt(document.getElementById('lactationInsem')?.value) || 1;
  const inseminationDate = document.getElementById('inseminationDateInsem')?.value;

  if (cattleId && inseminationDate) {
    const attempt = getInseminationAttempt(cattleId, lactation);
    document.getElementById('attemptNumberInsem').value = attempt;
  }
}

// Добавляем слушатели для автоматического заполнения на экране ввода осеменения
if (document.getElementById('cattleIdInsem') && document.getElementById('inseminationDateInsem')) {
  document.getElementById('cattleIdInsem').addEventListener('change', autoFillInseminationAttempt);
  document.getElementById('inseminationDateInsem').addEventListener('change', autoFillInseminationAttempt);
}

/**
 * Добавляет запись осеменения для существующей коровы
 */
function addInseminationEntry() {
  const cattleId = document.getElementById('cattleIdInsem')?.value.trim();
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
  saveLocally();
  updateList(); // Обновляем список на экране добавления
  updateViewList(); // Обновляем список на экране просмотра

  // Очищаем форму
  document.getElementById('cattleIdInsem').value = '';
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
  // Проверяем, находимся ли мы на экране добавления или осеменения
  if (document.getElementById('add-screen')?.classList.contains('active')) {
    autoFillAttempt();
  }
  if (document.getElementById('insemination-screen')?.classList.contains('active')) {
    autoFillInseminationAttempt();
  }
}

// Инициализация при загрузке и при навигации
document.addEventListener('DOMContentLoaded', initInseminationModule);
document.addEventListener('click', (e) => {
  // Если клик был по кнопке навигации, подождем и инициализируем
  setTimeout(initInseminationModule, 100);
});

// Экспортируем функции, если используется модульная система
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getInseminationAttempt, addInseminationEntry };
}