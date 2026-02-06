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
 * Проверяет, содержит ли строка бинарные или невидимые символы
 */
function hasBinaryChars(str) {
  if (!str || typeof str !== 'string') return false;
  // Проверяем на бинарные и невидимые символы (кроме пробелов, табуляции, переноса строки)
  return /[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F-\x9F]/.test(str);
}

/**
 * Проверяет, содержит ли запись бинарные символы в любом поле
 */
function entryHasBinaryChars(entry) {
  if (!entry || typeof entry !== 'object') return false;
  
  for (const key in entry) {
    if (typeof entry[key] === 'string' && hasBinaryChars(entry[key])) {
      return true;
    } else if (typeof entry[key] === 'object' && entry[key] !== null && !Array.isArray(entry[key])) {
      // Проверяем вложенные объекты
      for (const subKey in entry[key]) {
        if (typeof entry[key][subKey] === 'string' && hasBinaryChars(entry[key][subKey])) {
          return true;
        }
      }
    }
  }
  return false;
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
  let removedCount = 0;
  let cleanedCount = 0;
  
  console.log('Начало очистки данных...');
  
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    
    // Пропускаем невалидные записи
    if (!entry || typeof entry !== 'object') {
      console.warn(`Пропущена невалидная запись ${i}:`, entry);
      removedCount++;
      continue;
    }
    
    // Проверяем на бинарные символы ДО очистки
    const hasBinary = entryHasBinaryChars(entry);
    
    // Очищаем запись
    const cleaned = cleanEntry(entry);
    
    // Проверяем, что cattleId валиден после очистки
    if (!cleaned.cattleId || typeof cleaned.cattleId !== 'string' || cleaned.cattleId.trim().length === 0) {
      console.warn(`Пропущена запись ${i} без валидного cattleId:`, cleaned);
      removedCount++;
      continue;
    }
    
    // Если были бинарные символы, считаем что запись была очищена
    if (hasBinary) {
      cleanedCount++;
      console.log(`Очищена запись ${i} (cattleId: ${cleaned.cattleId})`);
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
  
  console.log(`Очистка завершена. Было: ${beforeCount}, стало: ${afterCount}, удалено: ${removedCount}, очищено: ${cleanedCount}`);
  
  if (removedCount > 0 || cleanedCount > 0) {
    alert(`✅ Очистка завершена.\nОчищено записей: ${cleanedCount}\nУдалено поврежденных: ${removedCount}\nОсталось валидных: ${afterCount}`);
  } else {
    alert(`✅ Проверка завершена.\nВсе записи валидны: ${afterCount}`);
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

/**
 * Проверяет данные на повреждения (для использования в консоли)
 * Вызывайте: checkDataIntegrity()
 */
function checkDataIntegrity() {
  const stored = localStorage.getItem('cattleEntries');
  if (!stored) {
    console.log('❌ Данные не найдены в localStorage');
    return;
  }
  
  let entries;
  try {
    entries = JSON.parse(stored);
  } catch (error) {
    console.error('❌ Ошибка парсинга JSON:', error);
    return;
  }
  
  if (!Array.isArray(entries)) {
    console.error('❌ Данные не являются массивом');
    return;
  }
  
  console.log(`📊 Всего записей: ${entries.length}`);
  
  let damagedEntries = 0;
  let damagedFields = 0;
  const issues = [];
  
  entries.forEach((entry, i) => {
    if (!entry || typeof entry !== 'object') {
      issues.push(`Запись ${i}: не является объектом`);
      damagedEntries++;
      return;
    }
    
    let entryHasIssues = false;
    for (const key in entry) {
      if (typeof entry[key] === 'string' && hasBinaryChars(entry[key])) {
        issues.push(`Запись ${i} (cattleId: ${entry.cattleId || 'нет'}), поле "${key}": содержит бинарные символы`);
        damagedFields++;
        entryHasIssues = true;
      }
    }
    
    if (entryHasIssues) {
      damagedEntries++;
    }
    
    if (!entry.cattleId || typeof entry.cattleId !== 'string' || entry.cattleId.trim().length === 0) {
      issues.push(`Запись ${i}: отсутствует или невалидный cattleId`);
      damagedEntries++;
    }
  });
  
  if (issues.length > 0) {
    console.warn(`⚠️ Найдено проблем:`);
    console.warn(`- Поврежденных записей: ${damagedEntries}`);
    console.warn(`- Поврежденных полей: ${damagedFields}`);
    console.warn('Детали:');
    issues.slice(0, 10).forEach(issue => console.warn('  ' + issue));
    if (issues.length > 10) {
      console.warn(`  ... и еще ${issues.length - 10} проблем`);
    }
    console.log('\n💡 Используйте функцию cleanAllEntries() для очистки данных');
  } else {
    console.log('✅ Все данные валидны!');
  }
  
  return {
    total: entries.length,
    damaged: damagedEntries,
    damagedFields: damagedFields,
    issues: issues
  };
}

// Делаем функцию доступной глобально для использования в консоли
window.checkDataIntegrity = checkDataIntegrity;
window.cleanAllEntries = cleanAllEntries;

// Экспорт функций
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    entries,
    saveLocally,
    loadLocally,
    getDefaultCowEntry,
    checkDataIntegrity,
    cleanAllEntries
  };
}