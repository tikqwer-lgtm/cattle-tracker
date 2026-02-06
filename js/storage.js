// storage.js — работа с localStorage

let entries = JSON.parse(localStorage.getItem('cattleEntries')) || [];

/**
 * Очищает строку от бинарных и невидимых символов
 */
function cleanString(str) {
  if (!str || typeof str !== 'string') return str || '';
  // Удаляем бинарные и невидимые символы, оставляем только печатные
  return str.replace(/[\x00-\x1F\x7F-\x9F]/g, '').trim();
}

/**
 * Очищает запись от бинарных и невидимых символов
 */
function cleanEntry(entry) {
  if (!entry || typeof entry !== 'object') return entry;
  
  const cleaned = {};
  for (const key in entry) {
    if (typeof entry[key] === 'string') {
      cleaned[key] = cleanString(entry[key]);
    } else if (typeof entry[key] === 'object' && entry[key] !== null && !Array.isArray(entry[key])) {
      // Для объектов (например, protocol)
      cleaned[key] = {};
      for (const subKey in entry[key]) {
        if (typeof entry[key][subKey] === 'string') {
          cleaned[key][subKey] = cleanString(entry[key][subKey]);
        } else {
          cleaned[key][subKey] = entry[key][subKey];
        }
      }
    } else {
      cleaned[key] = entry[key];
    }
  }
  return cleaned;
}

/**
 * Сохраняет записи в localStorage
 */
function saveLocally() {
  try {
    // Очищаем все записи перед сохранением
    const cleanedEntries = entries.map(entry => cleanEntry(entry));
    const jsonData = JSON.stringify(cleanedEntries);
    localStorage.setItem('cattleEntries', jsonData);
  } catch (error) {
    console.error('Ошибка сохранения в localStorage:', error);
    throw error;
  }
}

/**
 * Очищает все записи от поврежденных данных
 */
function cleanAllEntries() {
  if (!entries || entries.length === 0) {
    alert('Нет данных для очистки');
    return;
  }
  
  const beforeCount = entries.length;
  entries = entries.map(entry => cleanEntry(entry)).filter(entry => {
    // Удаляем записи с невалидными данными
    return entry && entry.cattleId && typeof entry.cattleId === 'string' && entry.cattleId.trim().length > 0;
  });
  
  const afterCount = entries.length;
  
  if (beforeCount !== afterCount) {
    console.warn(`Очищено записей: ${beforeCount - afterCount} поврежденных записей удалено`);
  }
  
  saveLocally();
  updateList();
  if (typeof updateViewList === 'function') {
    updateViewList();
  }
  
  alert(`✅ Очистка завершена. Записей: ${afterCount} (было: ${beforeCount})`);
}

/**
 * Загружает записи из localStorage при запуске
 */
function loadLocally() {
  try {
    const stored = localStorage.getItem('cattleEntries');
    if (!stored) {
      entries = [];
      return;
    }
    
    entries = JSON.parse(stored);
    
    // Очищаем все записи от бинарных символов
    entries = entries.map(entry => cleanEntry(entry)).filter(entry => {
      // Удаляем записи с невалидными данными
      return entry && entry.cattleId && typeof entry.cattleId === 'string' && entry.cattleId.trim().length > 0;
    });
    
    // Сохраняем очищенные данные обратно
    if (entries.length > 0) {
      saveLocally();
    }
    
    console.log("Загружено из localStorage:", entries.length, "записей");
    
    // Вызываем updateList если она существует
    if (typeof updateList === 'function') {
      updateList();
    }
  } catch (error) {
    console.error('Ошибка загрузки из localStorage:', error);
    entries = [];
    // Пытаемся очистить поврежденные данные
    try {
      localStorage.removeItem('cattleEntries');
    } catch (e) {
      console.error('Не удалось очистить localStorage:', e);
    }
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