// storage.js — работа с localStorage

let entries = JSON.parse(localStorage.getItem('cattleEntries')) || [];

/**
 * Очищает строку от бинарных и невидимых символов
 */
function cleanString(str) {
  if (!str || typeof str !== 'string') return str || '';
  // Удаляем бинарные и невидимые символы, оставляем только печатные
  // Также удаляем подозрительные нечитаемые символы
  let cleaned = str.replace(/[\x00-\x1F\x7F-\x9F]/g, '');
  // Удаляем последовательности нечитаемых символов (3 и более подряд)
  cleaned = cleaned.replace(/[^\x20-\x7E\u0400-\u04FF\u0410-\u044F\u0451\u0401\s]{3,}/g, '');
  return cleaned.trim();
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
    if (typeof window.CattleTrackerEvents !== 'undefined') {
      window.CattleTrackerEvents.emit('entries:updated', entries);
    }
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
  // Также проверяем на нечитаемые символы Unicode (иероглифы, мусор)
  const hasControlChars = /[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F-\x9F]/.test(str);
  // Проверяем на подозрительные последовательности (много нечитаемых символов подряд)
  const hasGarbage = /[^\x20-\x7E\u0400-\u04FF\u0410-\u044F\u0451\u0401\s]{3,}/.test(str);
  return hasControlChars || hasGarbage;
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
    
    // Проверяем на бинарные символы и мусор ДО очистки
    const hasBinary = entryHasBinaryChars(entry);
    const hasGarbage = isGarbageString(entry.cattleId) || 
                       (entry.nickname && isGarbageString(entry.nickname)) ||
                       (entry.note && isGarbageString(entry.note));
    
    // Очищаем запись
    const cleaned = cleanEntry(entry);
    
    // Проверяем, что cattleId валиден после очистки
    if (!cleaned.cattleId || typeof cleaned.cattleId !== 'string' || cleaned.cattleId.trim().length === 0) {
      console.warn(`Пропущена запись ${i} без валидного cattleId:`, cleaned);
      removedCount++;
      continue;
    }
    
    // Проверяем, что cattleId не является мусором после очистки
    if (isGarbageString(cleaned.cattleId) || cleaned.cattleId.length > 100) {
      console.warn(`Пропущена запись ${i} с мусорным cattleId:`, cleaned.cattleId.substring(0, 50));
      removedCount++;
      continue;
    }
    
    // Если были бинарные символы или мусор, считаем что запись была очищена
    if (hasBinary || hasGarbage) {
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
    
    const rawEntries = JSON.parse(stored);
    
    // Очищаем все записи от бинарных символов и мусора
    const cleanedEntries = [];
    for (let i = 0; i < rawEntries.length; i++) {
      const entry = rawEntries[i];
      if (!entry || typeof entry !== 'object') continue;
      
      const cleaned = cleanEntry(entry);
      
      // Проверяем валидность
      if (!cleaned.cattleId || typeof cleaned.cattleId !== 'string' || cleaned.cattleId.trim().length === 0) {
        console.warn(`При загрузке пропущена запись ${i} без валидного cattleId`);
        continue;
      }
      
      // Проверяем на мусор
      if (isGarbageString(cleaned.cattleId) || cleaned.cattleId.length > 100) {
        console.warn(`При загрузке пропущена запись ${i} с мусорным cattleId`);
        continue;
      }
      
      cleanedEntries.push(cleaned);
    }
    
entries = cleanedEntries;

    // Сохраняем очищенные данные обратно, если были изменения
    if (entries.length !== rawEntries.length) {
      console.log(`При загрузке очищено записей: ${rawEntries.length - entries.length}`);
      saveLocally();
    }
    
    console.log("Загружено из localStorage:", entries.length, "записей");
    if (typeof window.CattleTrackerEvents !== 'undefined') {
      window.CattleTrackerEvents.emit('entries:updated', entries);
    }
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
    synced: false,
    userId: '',
    lastModifiedBy: ''
  };
}

/**
 * Проверяет, является ли строка "мусорной" (содержит нечитаемые символы)
 */
function isGarbageString(str) {
  if (!str || typeof str !== 'string') return false;
  // Проверяем на наличие множества нечитаемых символов
  // Если больше 30% символов нечитаемые - это мусор
  const readableChars = str.match(/[\x20-\x7E\u0400-\u04FF\u0410-\u044F\u0451\u0401\s]/g);
  const readableRatio = readableChars ? readableChars.length / str.length : 0;
  return readableRatio < 0.7 || str.length > 100; // Если меньше 70% читаемых или очень длинная строка
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
      if (typeof entry[key] === 'string') {
        const value = entry[key];
        if (hasBinaryChars(value) || isGarbageString(value)) {
          const preview = value.length > 50 ? value.substring(0, 50) + '...' : value;
          issues.push(`Запись ${i} (cattleId: ${entry.cattleId || 'нет'}), поле "${key}": содержит мусор/бинарные символы. Значение: "${preview}"`);
          damagedFields++;
          entryHasIssues = true;
        }
      }
    }
    
    if (entryHasIssues) {
      damagedEntries++;
    }
    
    if (!entry.cattleId || typeof entry.cattleId !== 'string' || entry.cattleId.trim().length === 0) {
      issues.push(`Запись ${i}: отсутствует или невалидный cattleId`);
      damagedEntries++;
    } else if (isGarbageString(entry.cattleId) || hasBinaryChars(entry.cattleId)) {
      issues.push(`Запись ${i}: cattleId содержит мусор: "${entry.cattleId.substring(0, 50)}"`);
      damagedEntries++;
    }
  });
  
  if (issues.length > 0) {
    console.warn(`⚠️ Найдено проблем:`);
    console.warn(`- Поврежденных записей: ${damagedEntries}`);
    console.warn(`- Поврежденных полей: ${damagedFields}`);
    console.warn('Детали (первые 10):');
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

/**
 * Принудительная очистка всех поврежденных записей (удаляет их полностью)
 * Используйте осторожно!
 */
function forceCleanDamagedEntries() {
  if (!entries || entries.length === 0) {
    alert('Нет данных для очистки');
    return;
  }
  
  const beforeCount = entries.length;
  const validEntries = [];
  let removedCount = 0;
  
  console.log('Начало принудительной очистки...');
  
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    
    // Пропускаем невалидные записи
    if (!entry || typeof entry !== 'object') {
      console.warn(`Удалена невалидная запись ${i}`);
      removedCount++;
      continue;
    }
    
    // Очищаем запись
    const cleaned = cleanEntry(entry);
    
    // Проверяем валидность cattleId
    if (!cleaned.cattleId || typeof cleaned.cattleId !== 'string' || cleaned.cattleId.trim().length === 0) {
      console.warn(`Удалена запись ${i} без валидного cattleId`);
      removedCount++;
      continue;
    }
    
    // Проверяем на мусор в cattleId
    if (isGarbageString(cleaned.cattleId) || hasBinaryChars(cleaned.cattleId) || cleaned.cattleId.length > 100) {
      console.warn(`Удалена запись ${i} с мусорным cattleId:`, cleaned.cattleId.substring(0, 50));
      removedCount++;
      continue;
    }
    
    // Проверяем, что cattleId содержит только допустимые символы (цифры, буквы, дефисы)
    if (!/^[a-zA-Zа-яА-ЯёЁ0-9\s\-_]+$/.test(cleaned.cattleId)) {
      console.warn(`Удалена запись ${i} с недопустимыми символами в cattleId:`, cleaned.cattleId);
      removedCount++;
      continue;
    }
    
    validEntries.push(cleaned);
  }
  
  // Присваиваем валидные записи
  entries = validEntries;
  const afterCount = entries.length;
  
  // Сохраняем
  try {
    saveLocally();
  } catch (error) {
    console.error('Ошибка сохранения:', error);
    alert('Ошибка сохранения данных. Проверьте консоль.');
    return;
  }
  
  // Обновляем UI
  if (typeof updateList === 'function') {
    updateList();
  }
  if (typeof updateViewList === 'function') {
    updateViewList();
  }
  
  console.log(`Принудительная очистка завершена. Было: ${beforeCount}, стало: ${afterCount}, удалено: ${removedCount}`);
  
  alert(`✅ Принудительная очистка завершена.\nУдалено поврежденных записей: ${removedCount}\nОсталось валидных: ${afterCount}`);
}

/**
 * Удаляет все данные программы (записи коров, пользователи, копии, уведомления, фильтры).
 * Необратимо!
 */
function deleteAllData() {
  const beforeCount = entries.length;
  entries = [];
  try {
    localStorage.removeItem('cattleEntries');
    // Очищаем все ключи приложения
    var keysToRemove = [];
    for (var i = 0; i < localStorage.length; i++) {
      var key = localStorage.key(i);
      if (key && (key === 'cattleEntries' || key.indexOf('cattleTracker_') === 0)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(function (k) { localStorage.removeItem(k); });
  } catch (e) {
    console.error('Ошибка при удалении данных:', e);
    alert('Ошибка при удалении данных. Проверьте консоль.');
    return;
  }
  if (typeof window.CattleTrackerEvents !== 'undefined') {
    window.CattleTrackerEvents.emit('entries:updated', entries);
  }
  if (typeof updateList === 'function') updateList();
  if (typeof updateViewList === 'function') updateViewList();
  alert('✅ Все данные удалены.\nУдалено записей: ' + beforeCount);
}

// Делаем функции доступными глобально для использования в консоли
window.checkDataIntegrity = checkDataIntegrity;
window.cleanAllEntries = cleanAllEntries;
window.forceCleanDamagedEntries = forceCleanDamagedEntries;
window.deleteAllData = deleteAllData;

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