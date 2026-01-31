// app.js — Основной файл приложения
// Координация работы всех модулей

// Глобальная переменная для записей
// entries уже объявлено в storage.js

/**
 * Возвращает текущую дату и время в формате строки "дд.мм.гггг чч:мм"
 * @returns {string}
 */
function nowFormatted() {
  const now = new Date();
  return now.toLocaleDateString("ru-RU") + " " +
         now.toLocaleTimeString("ru-RU", { hour: '2-digit', minute: '2-digit' });
}

/**
 * Инициализация приложения при загрузке
 */
function initApp() {
  console.log("Инициализация приложения...");
  
  // Загрузка данных из localStorage
  if (typeof loadLocally === 'function') {
    loadLocally();
  }
  
  // Инициализация голосового помощника
  if (typeof VoiceAssistant !== 'undefined') {
    new VoiceAssistant();
  }
  
  // Инициализация модуля осеменения
  if (typeof initInseminationModule === 'function') {
    initInseminationModule();
  }
  
  // Обновление UI
  if (typeof updateList === 'function') {
    updateList();
  }
  
  console.log("Приложение инициализировано. Записей:", entries.length);
}

/**
 * Основная функция для добавления записи (вызывает другие модули)
 */
function addEntry() {
  console.log("Добавление записи...");
  
  // Валидация
  const cattleId = document.getElementById("cattleId").value.trim();
  const inseminationDate = document.getElementById("inseminationDate").value;

  if (!cattleId || !inseminationDate) {
    alert("Заполните номер коровы и дату осеменения!");
    return;
  }

  // Создание записи через storage.js
  const entry = getDefaultCowEntry();

  // Заполнение полей
  fillCowEntryFromForm(entry);
  
  // Добавление в массив
  entries.unshift(entry);
  
  // Сохранение
  saveLocally();
  
  // Обновление UI
  updateList();
  if (typeof updateViewList === 'function') {
    updateViewList();
  }
  
  // Очистка формы
  clearForm();
  
  console.log("Запись добавлена:", entry);
}

/**
 * Сохранение текущей записи (редактирование или новая)
 */
function saveCurrentEntry() {
  console.log("Сохранение записи...");
  
  const cattleId = document.getElementById('cattleId').value.trim();
  const inseminationDate = document.getElementById('inseminationDate').value;

  if (!cattleId || !inseminationDate) {
    alert('Заполните номер коровы и дату осеменения!');
    return;
  }

  const entry = getDefaultCowEntry();
  fillCowEntryFromForm(entry);

  // Обработка редактирования существующей записи
  if (window.currentEditingId) {
    const index = entries.findIndex(e => e.cattleId === window.currentEditingId);
    if (index !== -1) {
      // Сохраняем метаданные
      entry.dateAdded = entries[index].dateAdded;
      entry.synced = entries[index].synced;
      entries[index] = entry;
    }
    delete window.currentEditingId;
  } else {
    // Новая запись
    entry.dateAdded = nowFormatted();
    entry.synced = false;
    entries.unshift(entry);
  }

  saveLocally();
  updateList();
  if (typeof updateViewList === 'function') {
    updateViewList();
  }
  
  clearForm();
  
  // Возврат к просмотру
  if (typeof navigate === 'function') {
    navigate('view');
  }
  
  console.log("Запись сохранена:", entry);
}

// Запуск приложения при загрузке
document.addEventListener('DOMContentLoaded', initApp);

// Экспорт для других модулей
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    entries,
    nowFormatted,
    addEntry,
    saveCurrentEntry
  };
}