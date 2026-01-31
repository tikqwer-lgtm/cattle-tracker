// storage.js — работа с localStorage

let entries = JSON.parse(localStorage.getItem('cattleEntries')) || [];

/**
 * Сохраняет записи в localStorage
 */
function saveLocally() {
  localStorage.setItem('cattleEntries', JSON.stringify(entries));
}

/**
 * Загружает записи из localStorage при запуске
 */
function loadLocally() {
  entries = JSON.parse(localStorage.getItem('cattleEntries')) || [];
  console.log("Загружено из localStorage:", entries.length, "записей");
  
  // Вызываем updateList если она существует
  if (typeof updateList === 'function') {
    updateList();
  }
}

// getDefaultCowEntry теперь определена только в storage.js
// И удалена из app.js чтобы избежать дублирования