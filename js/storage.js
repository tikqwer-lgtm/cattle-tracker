// storage.js — работа с localStorage

let entries = JSON.parse(localStorage.getItem('cattleEntries')) || [];

/**
 * Сохраняет записи в localStorage
 */
function saveLocally() {
  try {
    const jsonData = JSON.stringify(entries);
    localStorage.setItem('cattleEntries', jsonData);
  } catch (error) {
    console.error('Ошибка сохранения в localStorage:', error);
    throw error;
  }
}

/**
 * Загружает записи из localStorage при запуске
 */
function loadLocally() {
  try {
    const stored = localStorage.getItem('cattleEntries');
    entries = stored ? JSON.parse(stored) : [];
    console.log("Загружено из localStorage:", entries.length, "записей");
    
    // Вызываем updateList если она существует
    if (typeof updateList === 'function') {
      updateList();
    }
  } catch (error) {
    console.error('Ошибка загрузки из localStorage:', error);
    entries = [];
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