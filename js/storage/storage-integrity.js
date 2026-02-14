// storage-integrity.js — проверка целостности, очистка повреждённых данных, deleteAllData

/**
 * Очищает все записи от поврежденных данных
 */
function cleanAllEntries() {
  if (!window.entries || window.entries.length === 0) {
    if (typeof window.showToast === 'function') window.showToast('Нет данных для очистки', 'info'); else alert('Нет данных для очистки');
    return;
  }

  const beforeCount = window.entries.length;
  const cleanedEntries = [];
  let removedCount = 0;
  let cleanedCount = 0;

  console.log('Начало очистки данных...');

  for (let i = 0; i < window.entries.length; i++) {
    const entry = window.entries[i];

    if (!entry || typeof entry !== 'object') {
      console.warn('Пропущена невалидная запись ' + i + ':', entry);
      removedCount++;
      continue;
    }

    const hasBinary = window.entryHasBinaryChars(entry);
    const hasGarbage = window.isGarbageString(entry.cattleId) ||
                       (entry.nickname && window.isGarbageString(entry.nickname)) ||
                       (entry.note && window.isGarbageString(entry.note));

    const cleaned = window.cleanEntry(entry);

    if (!cleaned.cattleId || typeof cleaned.cattleId !== 'string' || cleaned.cattleId.trim().length === 0) {
      console.warn('Пропущена запись ' + i + ' без валидного cattleId:', cleaned);
      removedCount++;
      continue;
    }

    if (window.isGarbageString(cleaned.cattleId) || cleaned.cattleId.length > 100) {
      console.warn('Пропущена запись ' + i + ' с мусорным cattleId:', cleaned.cattleId.substring(0, 50));
      removedCount++;
      continue;
    }

    if (hasBinary || hasGarbage) {
      cleanedCount++;
      console.log('Очищена запись ' + i + ' (cattleId: ' + cleaned.cattleId + ')');
    }

    cleanedEntries.push(cleaned);
  }

  if (typeof window.replaceEntriesWith === 'function') window.replaceEntriesWith(cleanedEntries); else { window.entries.length = 0; cleanedEntries.forEach(function (e) { window.entries.push(e); }); }
  const afterCount = window.entries.length;

  try {
    window.saveLocally();
  } catch (error) {
    console.error('Ошибка сохранения после очистки:', error);
    if (typeof window.showToast === 'function') window.showToast('Ошибка сохранения данных после очистки. Проверьте консоль.', 'error'); else alert('Ошибка сохранения данных после очистки. Проверьте консоль.');
    return;
  }

  if (typeof window.updateList === 'function') {
    window.updateList();
  }
  if (typeof window.updateViewList === 'function') {
    window.updateViewList();
  }

  console.log('Очистка завершена. Было: ' + beforeCount + ', стало: ' + afterCount + ', удалено: ' + removedCount + ', очищено: ' + cleanedCount);

  if (removedCount > 0 || cleanedCount > 0) {
    if (typeof window.showToast === 'function') window.showToast('Очистка завершена. Очищено: ' + cleanedCount + ', удалено поврежденных: ' + removedCount + ', осталось: ' + afterCount, 'success', 5000); else alert('✅ Очистка завершена.\nОчищено записей: ' + cleanedCount + '\nУдалено поврежденных: ' + removedCount + '\nОсталось валидных: ' + afterCount);
  } else {
    if (typeof window.showToast === 'function') window.showToast('Проверка завершена. Все записи валидны: ' + afterCount, 'success'); else alert('✅ Проверка завершена.\nВсе записи валидны: ' + afterCount);
  }
}

/**
 * Проверяет данные на повреждения (для использования в консоли)
 */
function checkDataIntegrity() {
  var key = typeof window.getStorageKey === 'function' ? window.getStorageKey() : 'cattleEntries';
  const stored = localStorage.getItem(key);
  if (!stored) {
    console.log('❌ Данные не найдены в localStorage');
    return;
  }

  let entriesLocal;
  try {
    entriesLocal = JSON.parse(stored);
  } catch (error) {
    console.error('❌ Ошибка парсинга JSON:', error);
    return;
  }

  if (!Array.isArray(entriesLocal)) {
    console.error('❌ Данные не являются массивом');
    return;
  }

  console.log('📊 Всего записей: ' + entriesLocal.length);

  let damagedEntries = 0;
  let damagedFields = 0;
  const issues = [];

  entriesLocal.forEach(function (entry, i) {
    if (!entry || typeof entry !== 'object') {
      issues.push('Запись ' + i + ': не является объектом');
      damagedEntries++;
      return;
    }

    let entryHasIssues = false;
    for (const key in entry) {
      if (typeof entry[key] === 'string') {
        const value = entry[key];
        if (window.hasBinaryChars(value) || window.isGarbageString(value)) {
          const preview = value.length > 50 ? value.substring(0, 50) + '...' : value;
          issues.push('Запись ' + i + ' (cattleId: ' + (entry.cattleId || 'нет') + '), поле "' + key + '": содержит мусор/бинарные символы. Значение: "' + preview + '"');
          damagedFields++;
          entryHasIssues = true;
        }
      }
    }

    if (entryHasIssues) {
      damagedEntries++;
    }

    if (!entry.cattleId || typeof entry.cattleId !== 'string' || entry.cattleId.trim().length === 0) {
      issues.push('Запись ' + i + ': отсутствует или невалидный cattleId');
      damagedEntries++;
    } else if (window.isGarbageString(entry.cattleId) || window.hasBinaryChars(entry.cattleId)) {
      issues.push('Запись ' + i + ': cattleId содержит мусор: "' + entry.cattleId.substring(0, 50) + '"');
      damagedEntries++;
    }
  });

  if (issues.length > 0) {
    console.warn('⚠️ Найдено проблем:');
    console.warn('- Поврежденных записей: ' + damagedEntries);
    console.warn('- Поврежденных полей: ' + damagedFields);
    console.warn('Детали (первые 10):');
    issues.slice(0, 10).forEach(function (issue) { console.warn('  ' + issue); });
    if (issues.length > 10) {
      console.warn('  ... и еще ' + (issues.length - 10) + ' проблем');
    }
    console.log('\n💡 Используйте функцию cleanAllEntries() для очистки данных');
  } else {
    console.log('✅ Все данные валидны!');
  }

  return {
    total: entriesLocal.length,
    damaged: damagedEntries,
    damagedFields: damagedFields,
    issues: issues
  };
}

/**
 * Принудительная очистка всех поврежденных записей
 */
function forceCleanDamagedEntries() {
  if (!window.entries || window.entries.length === 0) {
    if (typeof window.showToast === 'function') window.showToast('Нет данных для очистки', 'info'); else alert('Нет данных для очистки');
    return;
  }

  const beforeCount = window.entries.length;
  const validEntries = [];
  let removedCount = 0;

  console.log('Начало принудительной очистки...');

  for (let i = 0; i < window.entries.length; i++) {
    const entry = window.entries[i];

    if (!entry || typeof entry !== 'object') {
      console.warn('Удалена невалидная запись ' + i);
      removedCount++;
      continue;
    }

    const cleaned = window.cleanEntry(entry);

    if (!cleaned.cattleId || typeof cleaned.cattleId !== 'string' || cleaned.cattleId.trim().length === 0) {
      console.warn('Удалена запись ' + i + ' без валидного cattleId');
      removedCount++;
      continue;
    }

    if (window.isGarbageString(cleaned.cattleId) || window.hasBinaryChars(cleaned.cattleId) || cleaned.cattleId.length > 100) {
      console.warn('Удалена запись ' + i + ' с мусорным cattleId:', cleaned.cattleId.substring(0, 50));
      removedCount++;
      continue;
    }

    if (!/^[a-zA-Zа-яА-ЯёЁ0-9\s\-_]+$/.test(cleaned.cattleId)) {
      console.warn('Удалена запись ' + i + ' с недопустимыми символами в cattleId:', cleaned.cattleId);
      removedCount++;
      continue;
    }

    validEntries.push(cleaned);
  }

  if (typeof window.replaceEntriesWith === 'function') window.replaceEntriesWith(validEntries); else { window.entries.length = 0; validEntries.forEach(function (e) { window.entries.push(e); }); }
  const afterCount = window.entries.length;

  try {
    window.saveLocally();
  } catch (error) {
    console.error('Ошибка сохранения:', error);
    if (typeof window.showToast === 'function') window.showToast('Ошибка сохранения данных. Проверьте консоль.', 'error'); else alert('Ошибка сохранения данных. Проверьте консоль.');
    return;
  }

  if (typeof window.updateList === 'function') {
    window.updateList();
  }
  if (typeof window.updateViewList === 'function') {
    window.updateViewList();
  }

  console.log('Принудительная очистка завершена. Было: ' + beforeCount + ', стало: ' + afterCount + ', удалено: ' + removedCount);

  if (typeof window.showToast === 'function') window.showToast('Принудительная очистка завершена. Удалено: ' + removedCount + ', осталось: ' + afterCount, 'success', 5000); else alert('✅ Принудительная очистка завершена.\nУдалено поврежденных записей: ' + removedCount + '\nОсталось валидных: ' + afterCount);
}

/**
 * Удаляет все данные программы. Необратимо!
 */
function deleteAllData() {
  const beforeCount = window.entries.length;
  if (typeof window.replaceEntriesWith === 'function') window.replaceEntriesWith([]); else { window.entries.length = 0; }
  try {
    var keysToRemove = [];
    for (var i = 0; i < localStorage.length; i++) {
      var key = localStorage.key(i);
      if (key && (key === 'cattleEntries' || key.indexOf('cattleEntries_') === 0 || key.indexOf('cattleTracker_') === 0)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(function (k) { localStorage.removeItem(k); });
  } catch (e) {
    console.error('Ошибка при удалении данных:', e);
    if (typeof window.showToast === 'function') window.showToast('Ошибка при удалении данных. Проверьте консоль.', 'error'); else alert('Ошибка при удалении данных. Проверьте консоль.');
    return;
  }
  if (typeof window.CattleTrackerEvents !== 'undefined') {
    window.CattleTrackerEvents.emit('entries:updated', window.entries);
  }
  if (typeof window.updateList === 'function') window.updateList();
  if (typeof window.updateViewList === 'function') window.updateViewList();
  if (typeof window.showToast === 'function') window.showToast('Все данные удалены. Удалено записей: ' + beforeCount, 'success'); else alert('✅ Все данные удалены.\nУдалено записей: ' + beforeCount);
}

if (typeof window !== 'undefined') {
  window.checkDataIntegrity = checkDataIntegrity;
  window.cleanAllEntries = cleanAllEntries;
  window.forceCleanDamagedEntries = forceCleanDamagedEntries;
  window.deleteAllData = deleteAllData;
}
export {};
