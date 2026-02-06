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
  const cleanedEntries = [];
  
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    
    // Пропускаем невалидные записи
    if (!entry || typeof entry !== 'object') {
      console.warn(`Пропущена невалидная запись ${i}:`, entry);
      continue;
    }
    
    // Очищаем запись
    const cleaned = cleanEntry(entry);
    
    // Проверяем, что cattleId валиден
    if (!cleaned.cattleId || typeof cleaned.cattleId !== 'string' || cleaned.cattleId.trim().length === 0) {
      console.warn(`Пропущена запись без валидного cattleId:`, cleaned);
      continue;
    }
    
    // Проверяем на бинарные символы в cattleId
    if (/[\x00-\x1F\x7F-\x9F]/.test(cleaned.cattleId)) {
      console.warn(`Пропущена запись с бинарными символами в cattleId:`, cleaned.cattleId);
      continue;
    }
    
    cleanedEntries.push(cleaned);
  }
  
  // Присваиваем очищенные записи
  entries = cleanedEntries;
  const afterCount = entries.length;
  
  // Сохраняем очищенные данные
  try {
    saveLocally();
  } catch (error) {
    console.error('Ошибка сохранения после очистки:', error);
    alert('Ошибка сохранения данных после очистки. Проверьте консоль.');
    return;
  }
  
  // Обновляем UI
  if (typeof updateList === 'function') {
    updateList();
  }
  if (typeof updateViewList === 'function') {
    updateViewList();
  }
  
  const removedCount = beforeCount - afterCount;
  if (removedCount > 0) {
    alert(`✅ Очистка завершена.\nУдалено поврежденных записей: ${removedCount}\nОсталось валидных: ${afterCount}`);
  } else {
    alert(`✅ Очистка завершена.\nВсе записи валидны: ${afterCount}`);
  }
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