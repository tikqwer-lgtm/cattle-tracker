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
  if (typeof window.rejectIfPreviewMutation === 'function' && window.rejectIfPreviewMutation()) {
    return;
  }
  try {
    const cleanedEntries = window.entries.map(entry => cleanEntry(entry));
    const jsonData = JSON.stringify(cleanedEntries);
    localStorage.setItem(window.getStorageKey(), jsonData);
    if (typeof window.CattleTrackerEvents !== 'undefined') {
      window.CattleTrackerEvents.emit('entries:updated', window.entries);
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

function hasActionEvent(entry, eventType, needle) {
  var hist = entry && Array.isArray(entry.actionHistory) ? entry.actionHistory : [];
  for (var i = 0; i < hist.length; i++) {
    var item = hist[i] || {};
    var itemType = (item.eventType || item.action || '').toString();
    var details = (item.details || '').toString();
    if (itemType !== eventType) continue;
    if (!needle || details.indexOf(needle) !== -1) return true;
  }
  return false;
}

function pushRecoveredAction(entry, eventType, details) {
  if (!entry.actionHistory) entry.actionHistory = [];
  entry.actionHistory.push({
    dateTime: typeof window.nowFormatted === 'function' ? window.nowFormatted() : new Date().toISOString(),
    userName: 'Система',
    action: eventType,
    eventType: eventType,
    details: details + ' (восстановлено)'
  });
}

function backfillMissingActionHistory(entry) {
  if (!entry || typeof entry !== 'object') return false;
  if (!Array.isArray(entry.actionHistory)) entry.actionHistory = [];
  var changed = false;

  if (entry.dryStartDate) {
    var dryNeedle = 'Дата запуска: ' + entry.dryStartDate;
    if (!hasActionEvent(entry, 'Запуск в сухостой', dryNeedle)) {
      pushRecoveredAction(entry, 'Запуск в сухостой', dryNeedle);
      changed = true;
    }
  }

  if (entry.calvingDate) {
    var calvingNeedle = 'Дата отёла: ' + entry.calvingDate;
    if (!hasActionEvent(entry, 'Отёл', calvingNeedle)) {
      pushRecoveredAction(entry, 'Отёл', calvingNeedle);
      changed = true;
    }
  }

  var protocolName = entry.protocol && entry.protocol.name ? String(entry.protocol.name).trim() : '';
  var protocolStartDate = entry.protocol && entry.protocol.startDate ? String(entry.protocol.startDate).trim() : '';
  if (protocolName) {
    var protocolNeedle = 'Протокол: ' + protocolName + (protocolStartDate ? ', начало: ' + protocolStartDate : '');
    if (!hasActionEvent(entry, 'Постановка на протокол', protocolNeedle)) {
      pushRecoveredAction(entry, 'Постановка на протокол', protocolNeedle);
      changed = true;
    }
  }

  var insems = Array.isArray(entry.inseminationHistory) ? entry.inseminationHistory : [];
  insems.forEach(function (h) {
    if (!h || !h.date) return;
    var insemNeedle = 'Дата: ' + h.date;
    if (hasActionEvent(entry, 'Осеменение', insemNeedle)) return;
    var details = insemNeedle +
      (h.attemptNumber ? ', попытка: ' + h.attemptNumber : '') +
      (h.bull ? ', бык: ' + h.bull : '') +
      (h.inseminator ? ', осеменатор: ' + h.inseminator : '') +
      (h.code ? ', код: ' + h.code : '');
    pushRecoveredAction(entry, 'Осеменение', details);
    changed = true;
  });

  var uzis = Array.isArray(entry.uziHistory) ? entry.uziHistory : [];
  uzis.forEach(function (u, idx) {
    if (!u || !u.date) return;
    var uziType = (idx === 0 && u.result === 'Стельная') ? 'УЗИ1' : (idx > 0 && u.result === 'Стельная' ? 'УЗИ2' : 'УЗИ');
    var uziNeedle = 'Дата: ' + u.date;
    if (hasActionEvent(entry, uziType, uziNeedle) || hasActionEvent(entry, 'УЗИ', uziNeedle)) return;
    var uziDetails = uziNeedle + ', ' + (u.result || '—') + (u.specialist ? ', специалист: ' + u.specialist : '');
    if (u.daysFromInsemination !== undefined && u.daysFromInsemination !== null && u.daysFromInsemination !== '') {
      uziDetails += ', дней от осеменения: ' + u.daysFromInsemination;
    }
    pushRecoveredAction(entry, uziType, uziDetails);
    changed = true;
  });

  if (changed) entry.synced = false;
  return changed;
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
    window.ensureObjectsAndMigration();
    const stored = localStorage.getItem(window.getStorageKey());
    if (!stored) {
      if (typeof window.replaceEntriesWith === 'function') window.replaceEntriesWith([]); else { window.entries.length = 0; }
      if (typeof window.CattleTrackerEvents !== 'undefined') {
        window.CattleTrackerEvents.emit('entries:updated', window.entries);
      }
      if (typeof window.updateList === 'function') window.updateList();
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
      if (!entry.actionHistory) entry.actionHistory = [];
      if (!entry.uziHistory) entry.uziHistory = [];
      if (entry.lactationHistory === undefined) entry.lactationHistory = [];
      if (entry.group === undefined) entry.group = '';
      if (entry.stallYard === undefined) entry.stallYard = '';
      if (entry.stallRow === undefined) entry.stallRow = '';
      if (entry.stallPlace === undefined) entry.stallPlace = '';
      if (backfillMissingActionHistory(entry)) migrated = true;
    }

    if (typeof window.replaceEntriesWith === 'function') window.replaceEntriesWith(cleanedEntries); else { window.entries.length = 0; cleanedEntries.forEach(function (e) { window.entries.push(e); }); }

    if (window.entries.length !== rawEntries.length || migrated) {
      console.log('При загрузке очищено записей: ' + (rawEntries.length - window.entries.length));
      saveLocally();
    }

    console.log('Загружено из localStorage:', window.entries.length, 'записей');
    if (typeof window.CattleTrackerEvents !== 'undefined') {
      window.CattleTrackerEvents.emit('entries:updated', window.entries);
    }
    if (typeof window.updateList === 'function') {
      window.updateList();
    }
  } catch (error) {
    console.error('Ошибка загрузки из localStorage:', error);
    if (typeof window.replaceEntriesWith === 'function') window.replaceEntriesWith([]); else { window.entries.length = 0; }
    try {
      localStorage.removeItem(window.getStorageKey());
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
    dateAdded: typeof window.nowFormatted === 'function' ? window.nowFormatted() : '',
    synced: false,
    userId: '',
    lastModifiedBy: '',
    inseminationHistory: [],
    actionHistory: [],
    uziHistory: [],
    lactationHistory: [],
    parentMother: '',
    parentFather: '',
    birthWeight: '',
    stallYard: '',
    stallRow: '',
    stallPlace: ''
  };
}

/**
 * Архивирует текущую лактацию в lactationHistory перед записью отёла.
 * Вычисляет dryDuration (дней сухостоя), копирует осеменения и УЗИ текущей лактации.
 * @param {Object} entry - запись животного
 * @param {string} newCalvingDate - дата отёла (завершение текущей лактации)
 * @returns {Object} снимок архивированной лактации (уже добавлен в entry.lactationHistory)
 */
function archiveCurrentLactation(entry, newCalvingDate) {
  if (!entry) return null;
  if (!entry.lactationHistory) entry.lactationHistory = [];
  var dryStartDate = entry.dryStartDate || '';
  var dryDuration = null;
  if (dryStartDate && newCalvingDate) {
    var d1 = new Date(dryStartDate);
    var d2 = new Date(newCalvingDate);
    if (!isNaN(d1.getTime()) && !isNaN(d2.getTime())) {
      dryDuration = Math.round((d2 - d1) / (24 * 60 * 60 * 1000));
    }
  }
  var snapshot = {
    number: parseInt(entry.lactation, 10) || 0,
    calvingDate: newCalvingDate || '',
    dryStartDate: dryStartDate,
    dryDuration: dryDuration,
    inseminationDate: entry.inseminationDate || '',
    attemptNumber: entry.attemptNumber ?? 1,
    bull: entry.bull || '',
    inseminator: entry.inseminator || '',
    code: entry.code || '',
    inseminationHistory: Array.isArray(entry.inseminationHistory) ? entry.inseminationHistory.slice() : [],
    uziHistory: Array.isArray(entry.uziHistory) ? entry.uziHistory.slice() : [],
    status: entry.status || '',
    protocol: entry.protocol && typeof entry.protocol === 'object' ? { name: entry.protocol.name || '', startDate: entry.protocol.startDate || '' } : { name: '', startDate: '' }
  };
  entry.lactationHistory.push(snapshot);
  return snapshot;
}

/**
 * Добавляет запись в историю действий карточки животного.
 * @param {Object} entry - запись животного
 * @param {string} action - название действия (УЗИ, Осеменение, Постановка на протокол и т.д.)
 * @param {string} [details] - текстовая строка с деталями
 * @param {Object} [options] - опциональные поля для общего списка событий: eventType, result, attemptNumber, bull, inseminator, code, protocolName
 */
function pushActionHistory(entry, action, details, options) {
  if (!entry) return;
  if (!entry.actionHistory) entry.actionHistory = [];
  var userName = (typeof window.getCurrentUser === 'function' && window.getCurrentUser()) ? window.getCurrentUser().username : 'Admin';
  var dateTime = typeof window.nowFormatted === 'function' ? window.nowFormatted() : new Date().toISOString();
  var item = { dateTime: dateTime, userName: userName, action: action, details: details || '' };
  if (options && typeof options === 'object') {
    if (options.eventType !== undefined) item.eventType = options.eventType;
    if (options.result !== undefined) item.result = options.result;
    if (options.attemptNumber !== undefined) item.attemptNumber = options.attemptNumber;
    if (options.bull !== undefined) item.bull = options.bull;
    if (options.inseminator !== undefined) item.inseminator = options.inseminator;
    if (options.code !== undefined) item.code = options.code;
    if (options.protocolName !== undefined) item.protocolName = options.protocolName;
  }
  entry.actionHistory.push(item);
}

if (typeof window !== 'undefined') {
  window.pushActionHistory = pushActionHistory;
  window.loadLocally = loadLocally;
  window.saveLocally = saveLocally;
  window.getDefaultCowEntry = getDefaultCowEntry;
  window.archiveCurrentLactation = archiveCurrentLactation;
  window.cleanEntry = cleanEntry;
  window.cleanString = cleanString;
  window.hasBinaryChars = hasBinaryChars;
  window.entryHasBinaryChars = entryHasBinaryChars;
  window.isGarbageString = isGarbageString;
}
export {};

/**
 * Проверяет, является ли строка "мусорной"
 */
function isGarbageString(str) {
  if (!str || typeof str !== 'string') return false;
  const readableChars = str.match(/[\x20-\x7E\u0400-\u04FF\u0410-\u044F\u0451\u0401\s]/g);
  const readableRatio = readableChars ? readableChars.length / str.length : 0;
  return readableRatio < 0.7 || str.length > 100;
}
