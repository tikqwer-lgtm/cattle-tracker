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


/**
 * Возвращает новую запись коровы с полями по умолчанию
 * @returns {Object}
 */
function getDefaultCowEntry() {
  return {
    cattleId: '',
    nickname: '',
    birthDate: '',
    lactation: 1,
    calvingDate: '',
    inseminationDate: '',
    attemptNumber: 1,
    bull: '',
    inseminator: '',
    code: '',
    status: 'Охота',
    exitDate: '',
    dryStartDate: '',
    vwp: 60,
    note: '',
    protocol: {
      name: '',
      startDate: ''
    },
    dateAdded: nowFormatted(),
    synced: false
  };
}

// Экспорт функций
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    entries,
    saveLocally,
    loadLocally,
    getDefaultCowEntry
  };
}