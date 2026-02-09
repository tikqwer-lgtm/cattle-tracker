// storage-entries.js — загрузка/сохранение записей, очистка полей, getDefaultCowEntry

/**
 * Очищает строку от бинарных и невидимых символов
 */
function cleanString(str) {
  if (!str || typeof str !== 'string') return str || '';
  let cleaned = str.replace(/[\x00-\x1F\x7F-\x9F]/g, '');
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
    const cleanedEntries = entries.map(entry => cleanEntry(entry));
    const jsonData = JSON.stringify(cleanedEntries);
    localStorage.setItem(getStorageKey(), jsonData);
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
  const hasControlChars = /[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F-\x9F]/.test(str);
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
 * Загружает записи из localStorage при запуске
 */
function loadLocally() {
  try {
    ensureObjectsAndMigration();
    const stored = localStorage.getItem(getStorageKey());
    if (!stored) {
      entries = [];
      if (typeof window !== 'undefined') window.entries = entries;
      if (typeof window.CattleTrackerEvents !== 'undefined') {
        window.CattleTrackerEvents.emit('entries:updated', entries);
      }
      if (typeof updateList === 'function') updateList();
      return;
    }

    const rawEntries = JSON.parse(stored);

    const cleanedEntries = [];
    for (let i = 0; i < rawEntries.length; i++) {
      const entry = rawEntries[i];
      if (!entry || typeof entry !== 'object') continue;

      const cleaned = cleanEntry(entry);

      if (!cleaned.cattleId || typeof cleaned.cattleId !== 'string' || cleaned.cattleId.trim().length === 0) {
        console.warn('При загрузке пропущена запись ' + i + ' без валидного cattleId');
        continue;
      }

      if (isGarbageString(cleaned.cattleId) || cleaned.cattleId.length > 100) {
        console.warn('При загрузке пропущена запись ' + i + ' с мусорным cattleId');
        continue;
      }

      cleanedEntries.push(cleaned);
    }

    let migrated = false;
    for (let i = 0; i < cleanedEntries.length; i++) {
      const entry = cleanedEntries[i];
      if (entry.inseminationDate && (!entry.inseminationHistory || entry.inseminationHistory.length === 0)) {
        entry.inseminationHistory = [{
          date: entry.inseminationDate,
          attemptNumber: entry.attemptNumber ?? 1,
          bull: entry.bull ?? '',
          inseminator: entry.inseminator ?? '',
          code: entry.code ?? ''
        }];
        migrated = true;
      }
      if (!entry.inseminationHistory) entry.inseminationHistory = [];
      if (entry.group === undefined) entry.group = '';
    }

    entries = cleanedEntries;
    if (typeof window !== 'undefined') window.entries = entries;

    if (entries.length !== rawEntries.length || migrated) {
      console.log('При загрузке очищено записей: ' + (rawEntries.length - entries.length));
      saveLocally();
    }

    console.log('Загружено из localStorage:', entries.length, 'записей');
    if (typeof window.CattleTrackerEvents !== 'undefined') {
      window.CattleTrackerEvents.emit('entries:updated', entries);
    }
    if (typeof updateList === 'function') {
      updateList();
    }
  } catch (error) {
    console.error('Ошибка загрузки из localStorage:', error);
    entries = [];
    if (typeof window !== 'undefined') window.entries = entries;
    try {
      localStorage.removeItem(getStorageKey());
    } catch (e) {
      console.error('Не удалось очистить localStorage:', e);
    }
  }
}

/**
 * Возвращает новую запись коровы с полями по умолчанию
 */
function getDefaultCowEntry() {
  return {
    cattleId: '',
    nickname: '',
    group: '',
    birthDate: '',
    lactation: '',
    calvingDate: '',
    inseminationDate: '',
    attemptNumber: 1,
    bull: '',
    inseminator: '',
    code: '',
    status: '',
    exitDate: '',
    dryStartDate: '',
    vwp: 60,
    note: '',
    protocol: {
      name: '',
      startDate: ''
    },
    dateAdded: typeof nowFormatted === 'function' ? nowFormatted() : '',
    synced: false,
    userId: '',
    lastModifiedBy: '',
    inseminationHistory: []
  };
}

/**
 * Проверяет, является ли строка "мусорной"
 */
function isGarbageString(str) {
  if (!str || typeof str !== 'string') return false;
  const readableChars = str.match(/[\x20-\x7E\u0400-\u04FF\u0410-\u044F\u0451\u0401\s]/g);
  const readableRatio = readableChars ? readableChars.length / str.length : 0;
  return readableRatio < 0.7 || str.length > 100;
}
