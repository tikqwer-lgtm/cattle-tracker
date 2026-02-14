// === js/config.js
/**
 * Конфигурация приложения (адрес сервера по умолчанию и др.).
 * Используется кнопкой «Подключиться к серверу» на экране Синхронизация,
 * если пользователь ещё не вводил адрес вручную.
 */
(function (global) {
  'use strict';
  var DEFAULT_SERVER_URL = 'http://31.130.155.149:3000';
  global.CATTLE_TRACKER_DEFAULT_SERVER_URL = DEFAULT_SERVER_URL;
})(typeof window !== 'undefined' ? window : this);

// === js/utils/constants.js
/**
 * constants.js — единое место для ключей localStorage, лимитов и префиксов API.
 * Модули могут использовать эти константы или свои локальные переменные.
 */
var CATTLE_TRACKER_PREFIX = 'cattleTracker_';

var STORAGE_KEYS = {
  apiBase: CATTLE_TRACKER_PREFIX + 'apiBase',
  apiToken: CATTLE_TRACKER_PREFIX + 'apiToken',
  users: CATTLE_TRACKER_PREFIX + 'users',
  currentUser: CATTLE_TRACKER_PREFIX + 'currentUser',
  currentObject: CATTLE_TRACKER_PREFIX + 'currentObject',
  objects: CATTLE_TRACKER_PREFIX + 'objects',
  notificationsOpen: CATTLE_TRACKER_PREFIX + 'notifications_open',
  hasSeenHints: CATTLE_TRACKER_PREFIX + 'hasSeenHints',
  exportSelectedFields: CATTLE_TRACKER_PREFIX + 'export_selectedFields',
  exportFieldTemplates: CATTLE_TRACKER_PREFIX + 'export_fieldTemplates',
  viewListVisibleFields: CATTLE_TRACKER_PREFIX + 'viewList_visibleFields',
  viewListFieldTemplates: CATTLE_TRACKER_PREFIX + 'viewList_fieldTemplates',
  analyticsSettings: CATTLE_TRACKER_PREFIX + 'analytics_settings',
  searchFilter: CATTLE_TRACKER_PREFIX + 'search_filter',
  notificationHistory: CATTLE_TRACKER_PREFIX + 'notification_history',
  notifications: CATTLE_TRACKER_PREFIX + 'notifications',
  protocols: CATTLE_TRACKER_PREFIX + 'protocols',
  backupPrefix: CATTLE_TRACKER_PREFIX + 'backup_'
};

var LIMITS = {
  maxBackups: 10,
  notificationHistoryMax: 200
};

// === js/utils/utils.js
// utils.js — вспомогательные функции

// Формат даты: 2025-04-05 → 05.04.2025
function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString("ru-RU");
}

// Возвращает объект Date (а не строку)
function nowFormatted() {
  const now = new Date();
  return now.toLocaleDateString("ru-RU") + " " +
         now.toLocaleTimeString("ru-RU", { hour: '2-digit', minute: '2-digit' });
}

/**
 * Проверяет, что дата не в будущем. Для форм осеменения, отёла, УЗИ.
 * @param {string} dateStr — значение поля даты (YYYY-MM-DD или иной разборный формат)
 * @param {string} [fieldLabel] — подпись поля для сообщения об ошибке
 * @returns {string|null} — текст ошибки или null, если валидно
 */
function validateDateNotFuture(dateStr, fieldLabel) {
  if (!dateStr || !String(dateStr).trim()) return null;
  var d = new Date(dateStr);
  if (isNaN(d.getTime())) return (fieldLabel || 'Дата') + ': некорректный формат';
  var today = new Date();
  today.setHours(23, 59, 59, 999);
  if (d > today) return (fieldLabel || 'Дата') + ' не может быть в будущем';
  return null;
}

// === js/core/events.js
/**
 * events.js — Система событий (паттерн Observer)
 * Централизованная шина событий для приложения учёта коров
 */
(function (global) {
  'use strict';

  const listeners = {};

  /**
   * Подписка на событие
   * @param {string} eventName - Имя события
   * @param {Function} callback - Обработчик (payload)
   */
  function on(eventName, callback) {
    if (!eventName || typeof callback !== 'function') return;
    if (!listeners[eventName]) listeners[eventName] = [];
    listeners[eventName].push(callback);
  }

  /**
   * Отписка от события
   * @param {string} eventName - Имя события
   * @param {Function} [callback] - Если не указан — снимаются все подписчики события
   */
  function off(eventName, callback) {
    if (!listeners[eventName]) return;
    if (!callback) {
      listeners[eventName] = [];
      return;
    }
    listeners[eventName] = listeners[eventName].filter(cb => cb !== callback);
  }

  /**
   * Публикация события
   * @param {string} eventName - Имя события
   * @param {*} [payload] - Данные события
   */
  function emit(eventName, payload) {
    if (!listeners[eventName]) return;
    listeners[eventName].forEach(cb => {
      try {
        cb(payload);
      } catch (err) {
        console.error('[CattleTrackerEvents]', eventName, err);
      }
    });
  }

  const CattleTrackerEvents = { on, off, emit };
  global.CattleTrackerEvents = CattleTrackerEvents;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = CattleTrackerEvents;
  }
})(typeof window !== 'undefined' ? window : this);

// === js/api/api-client.js
/**
 * api-client.js — слой обращения к Cattle Tracker API.
 * Используется когда включён режим API (CATTLE_TRACKER_USE_API + CATTLE_TRACKER_API_BASE).
 */
(function (global) {
  'use strict';

  var TOKEN_KEY = 'cattleTracker_apiToken';
  var CURRENT_OBJECT_KEY = 'cattleTracker_currentObject';

  function getBaseUrl() {
    return (global.CATTLE_TRACKER_API_BASE || '').replace(/\/$/, '');
  }

  function getToken() {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch (e) {
      return null;
    }
  }

  function setToken(token) {
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token);
      else localStorage.removeItem(TOKEN_KEY);
    } catch (e) {}
  }

  function request(method, path, body) {
    var base = getBaseUrl();
    if (!base) return Promise.reject(new Error('CATTLE_TRACKER_API_BASE не задан'));
    var opts = {
      method: method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (method === 'GET') opts.cache = 'no-cache';
    var token = getToken();
    if (token) opts.headers['Authorization'] = 'Bearer ' + token;
    if (body !== undefined) opts.body = JSON.stringify(body);
    return fetch(base + path, opts).then(function (res) {
      var contentType = res.headers.get('Content-Type') || '';
      var isJson = contentType.indexOf('application/json') !== -1;
      var next = function () {
        if (res.ok) return isJson ? res.json() : Promise.resolve(null);
        return isJson ? res.json().then(function (data) {
          throw new Error(data.message || data.error || 'Ошибка ' + res.status);
        }) : Promise.reject(new Error('Ошибка ' + res.status));
      };
      return next();
    }).catch(function (err) {
      if (err && err.message === 'Failed to fetch') {
        return Promise.reject(new Error('Сервер недоступен. Проверьте адрес API (Настройки → Войти) и что сервер запущен.'));
      }
      return Promise.reject(err);
    });
  }

  function loadEntries(objectId) {
    return request('GET', '/api/objects/' + encodeURIComponent(objectId) + '/entries');
  }

  function createEntry(objectId, entry) {
    return request('POST', '/api/objects/' + encodeURIComponent(objectId) + '/entries', entry);
  }

  function updateEntry(objectId, cattleId, entry) {
    return request('PUT', '/api/objects/' + encodeURIComponent(objectId) + '/entries/' + encodeURIComponent(cattleId), entry);
  }

  function deleteEntry(objectId, cattleId) {
    return request('DELETE', '/api/objects/' + encodeURIComponent(objectId) + '/entries/' + encodeURIComponent(cattleId));
  }

  function getObjectsList() {
    return request('GET', '/api/objects?_=' + Date.now());
  }

  function getCurrentObjectId() {
    try {
      var id = sessionStorage.getItem(CURRENT_OBJECT_KEY);
      if (id && id.trim()) return id.trim();
      id = localStorage.getItem(CURRENT_OBJECT_KEY);
      if (id && id.trim()) {
        sessionStorage.setItem(CURRENT_OBJECT_KEY, id.trim());
        return id.trim();
      }
      return 'default';
    } catch (e) {
      return 'default';
    }
  }

  function setCurrentObjectId(id) {
    var val = (id || 'default').trim();
    try {
      sessionStorage.setItem(CURRENT_OBJECT_KEY, val);
      localStorage.setItem(CURRENT_OBJECT_KEY, val);
    } catch (e) {}
  }

  function updateObject(id, payload) {
    return request('PUT', '/api/objects/' + encodeURIComponent(id), payload || {});
  }

  function deleteObject(id) {
    return request('DELETE', '/api/objects/' + encodeURIComponent(id));
  }

  function addObject(name) {
    return request('POST', '/api/objects', { name: (name || 'Новая база').trim() }).then(function (obj) {
      setCurrentObjectId(obj.id);
      return obj.id;
    });
  }

  function createObject(name) {
    return request('POST', '/api/objects', { name: (name || 'Новая база').trim() });
  }

  function login(username, password) {
    return request('POST', '/api/auth/login', { username: username, password: password }).then(function (data) {
      if (data.token) setToken(data.token);
      return data;
    });
  }

  function logout() {
    request('POST', '/api/auth/logout').catch(function () {});
    setToken(null);
  }

  function register(username, password, role) {
    return request('POST', '/api/auth/register', { username: username, password: password, role: role || 'admin' });
  }

  function getCurrentUser() {
    return request('GET', '/api/auth/me').then(function (data) {
      return data.user || null;
    }).catch(function () {
      return null;
    });
  }

  function checkUsername(username) {
    var u = (username || '').trim();
    if (!u) return Promise.resolve({ available: true });
    return request('GET', '/api/auth/check-username?username=' + encodeURIComponent(u));
  }

  var api = {
    getBaseUrl: getBaseUrl,
    getToken: getToken,
    setToken: setToken,
    loadEntries: loadEntries,
    createEntry: createEntry,
    updateEntry: updateEntry,
    deleteEntry: deleteEntry,
    getObjectsList: getObjectsList,
    getCurrentObjectId: getCurrentObjectId,
    setCurrentObjectId: setCurrentObjectId,
    addObject: addObject,
    createObject: createObject,
    updateObject: updateObject,
    deleteObject: deleteObject,
    login: login,
    logout: logout,
    register: register,
    getCurrentUser: getCurrentUser,
    checkUsername: checkUsername
  };

  if (typeof global !== 'undefined') {
    global.CattleTrackerApi = api;
  }
})(typeof window !== 'undefined' ? window : this);

// === js/storage/storage-objects.js
// storage-objects.js — объекты/базы, текущий объект, миграция.
// Единственное место объявления массива записей (entries). Замена содержимого — через replaceEntriesWith().

var OBJECTS_KEY = 'cattleTracker_objects';
var CURRENT_OBJECT_KEY = 'cattleTracker_currentObject';

let entries = [];
if (typeof window !== 'undefined') window.entries = entries;

/**
 * Заменяет содержимое массива записей и синхронизирует с window.entries.
 * Единая точка замены (вместо прямого присваивания entries = ...).
 * @param {Array} arr - новый массив записей (или пустой массив)
 */
function replaceEntriesWith(arr) {
  entries.length = 0;
  if (arr && Array.isArray(arr) && arr.length > 0) {
    for (var i = 0; i < arr.length; i++) entries.push(arr[i]);
  }
  if (typeof window !== 'undefined') window.entries = entries;
}

function getCurrentObjectId() {
  try {
    var id = localStorage.getItem(CURRENT_OBJECT_KEY);
    return id && id.trim() ? id : 'default';
  } catch (e) {
    return 'default';
  }
}

function setCurrentObjectId(id) {
  if (!id || !id.trim()) id = 'default';
  try {
    localStorage.setItem(CURRENT_OBJECT_KEY, id.trim());
  } catch (e) {
    console.warn('setCurrentObjectId:', e);
  }
}

function getStorageKey() {
  return 'cattleEntries_' + getCurrentObjectId();
}

function getObjectsList() {
  try {
    var raw = localStorage.getItem(OBJECTS_KEY);
    if (raw) {
      var list = JSON.parse(raw);
      if (Array.isArray(list) && list.length > 0) return list;
    }
  } catch (e) {}
  return null;
}

function saveObjectsList(list) {
  try {
    localStorage.setItem(OBJECTS_KEY, JSON.stringify(list));
  } catch (e) {
    console.warn('saveObjectsList:', e);
  }
}

function ensureObjectsAndMigration() {
  var list = getObjectsList();
  if (list && list.length > 0) return;
  var legacyKey = 'cattleEntries';
  var legacyData = localStorage.getItem(legacyKey);
  var defaultId = 'default';
  var newList = [{ id: defaultId, name: 'Основная база' }];
  if (legacyData) {
    try {
      localStorage.setItem('cattleEntries_' + defaultId, legacyData);
    } catch (e) {}
  }
  saveObjectsList(newList);
  setCurrentObjectId(defaultId);
}

function switchToObject(objectId) {
  setCurrentObjectId(objectId);
  if (typeof loadLocally === 'function') loadLocally();
  if (typeof updateHerdStats === 'function') updateHerdStats();
  if (typeof updateViewList === 'function') updateViewList();
  if (typeof window.CattleTrackerEvents !== 'undefined') {
    window.CattleTrackerEvents.emit('entries:updated', entries);
  }
}

function addObject(name) {
  var list = getObjectsList();
  if (!list) list = [{ id: 'default', name: 'Основная база' }];
  var id = 'obj_' + Date.now();
  list.push({ id: id, name: (name || 'Новая база').trim() });
  saveObjectsList(list);
  switchToObject(id);
  return id;
}

function updateObject(id, payload) {
  var list = getObjectsList();
  if (!list) return Promise.resolve(false);
  var name = (payload && payload.name != null) ? String(payload.name).trim() : '';
  if (!name) return Promise.resolve(false);
  var idx = list.findIndex(function (o) { return o.id === id; });
  if (idx === -1) return Promise.resolve(false);
  list[idx].name = name;
  saveObjectsList(list);
  return Promise.resolve(true);
}

function deleteObject(id) {
  var list = getObjectsList();
  if (!list) return Promise.resolve(false);
  var idx = list.findIndex(function (o) { return o.id === id; });
  if (idx === -1) return Promise.resolve(false);
  var currentId = getCurrentObjectId();
  list.splice(idx, 1);
  if (list.length === 0) list = [{ id: 'default', name: 'Основная база' }];
  saveObjectsList(list);
  try {
    localStorage.removeItem('cattleEntries_' + id);
  } catch (e) {}
  if (currentId === id) {
    var nextId = list[0] ? list[0].id : 'default';
    setCurrentObjectId(nextId);
    if (typeof loadLocally === 'function') loadLocally();
  }
  if (typeof updateHerdStats === 'function') updateHerdStats();
  if (typeof updateViewList === 'function') updateViewList();
  return Promise.resolve(true);
}

if (typeof window !== 'undefined') {
  window.addObject = addObject;
  window.updateObject = updateObject;
  window.deleteObject = deleteObject;
  window.replaceEntriesWith = replaceEntriesWith;
}

// === js/storage/storage-entries.js
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
      if (typeof replaceEntriesWith === 'function') replaceEntriesWith([]); else { entries = []; if (typeof window !== 'undefined') window.entries = entries; }
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
      if (!entry.actionHistory) entry.actionHistory = [];
      if (!entry.uziHistory) entry.uziHistory = [];
      if (entry.group === undefined) entry.group = '';
    }

    if (typeof replaceEntriesWith === 'function') replaceEntriesWith(cleanedEntries); else { entries = cleanedEntries; if (typeof window !== 'undefined') window.entries = entries; }

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
    if (typeof replaceEntriesWith === 'function') replaceEntriesWith([]); else { entries.length = 0; if (typeof window !== 'undefined') window.entries = entries; }
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
    inseminationHistory: [],
    actionHistory: [],
    uziHistory: []
  };
}

/**
 * Добавляет запись в историю действий карточки животного.
 */
function pushActionHistory(entry, action, details) {
  if (!entry) return;
  if (!entry.actionHistory) entry.actionHistory = [];
  var userName = (typeof getCurrentUser === 'function' && getCurrentUser()) ? getCurrentUser().username : 'Admin';
  var dateTime = typeof nowFormatted === 'function' ? nowFormatted() : new Date().toISOString();
  entry.actionHistory.push({ dateTime: dateTime, userName: userName, action: action, details: details || '' });
}

if (typeof window !== 'undefined') {
  window.pushActionHistory = pushActionHistory;
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

// === js/storage/storage-integrity.js
// storage-integrity.js — проверка целостности, очистка повреждённых данных, deleteAllData

/**
 * Очищает все записи от поврежденных данных
 */
function cleanAllEntries() {
  if (!entries || entries.length === 0) {
    if (typeof showToast === 'function') showToast('Нет данных для очистки', 'info'); else alert('Нет данных для очистки');
    return;
  }

  const beforeCount = entries.length;
  const cleanedEntries = [];
  let removedCount = 0;
  let cleanedCount = 0;

  console.log('Начало очистки данных...');

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];

    if (!entry || typeof entry !== 'object') {
      console.warn('Пропущена невалидная запись ' + i + ':', entry);
      removedCount++;
      continue;
    }

    const hasBinary = entryHasBinaryChars(entry);
    const hasGarbage = isGarbageString(entry.cattleId) ||
                       (entry.nickname && isGarbageString(entry.nickname)) ||
                       (entry.note && isGarbageString(entry.note));

    const cleaned = cleanEntry(entry);

    if (!cleaned.cattleId || typeof cleaned.cattleId !== 'string' || cleaned.cattleId.trim().length === 0) {
      console.warn('Пропущена запись ' + i + ' без валидного cattleId:', cleaned);
      removedCount++;
      continue;
    }

    if (isGarbageString(cleaned.cattleId) || cleaned.cattleId.length > 100) {
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

  if (typeof replaceEntriesWith === 'function') replaceEntriesWith(cleanedEntries); else { entries = cleanedEntries; if (typeof window !== 'undefined') window.entries = entries; }
  const afterCount = entries.length;

  try {
    saveLocally();
  } catch (error) {
    console.error('Ошибка сохранения после очистки:', error);
    if (typeof showToast === 'function') showToast('Ошибка сохранения данных после очистки. Проверьте консоль.', 'error'); else alert('Ошибка сохранения данных после очистки. Проверьте консоль.');
    return;
  }

  if (typeof updateList === 'function') {
    updateList();
  }
  if (typeof updateViewList === 'function') {
    updateViewList();
  }

  console.log('Очистка завершена. Было: ' + beforeCount + ', стало: ' + afterCount + ', удалено: ' + removedCount + ', очищено: ' + cleanedCount);

  if (removedCount > 0 || cleanedCount > 0) {
    if (typeof showToast === 'function') showToast('Очистка завершена. Очищено: ' + cleanedCount + ', удалено поврежденных: ' + removedCount + ', осталось: ' + afterCount, 'success', 5000); else alert('✅ Очистка завершена.\nОчищено записей: ' + cleanedCount + '\nУдалено поврежденных: ' + removedCount + '\nОсталось валидных: ' + afterCount);
  } else {
    if (typeof showToast === 'function') showToast('Проверка завершена. Все записи валидны: ' + afterCount, 'success'); else alert('✅ Проверка завершена.\nВсе записи валидны: ' + afterCount);
  }
}

/**
 * Проверяет данные на повреждения (для использования в консоли)
 */
function checkDataIntegrity() {
  var key = typeof getStorageKey === 'function' ? getStorageKey() : 'cattleEntries';
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
        if (hasBinaryChars(value) || isGarbageString(value)) {
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
    } else if (isGarbageString(entry.cattleId) || hasBinaryChars(entry.cattleId)) {
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
  if (!entries || entries.length === 0) {
    if (typeof showToast === 'function') showToast('Нет данных для очистки', 'info'); else alert('Нет данных для очистки');
    return;
  }

  const beforeCount = entries.length;
  const validEntries = [];
  let removedCount = 0;

  console.log('Начало принудительной очистки...');

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];

    if (!entry || typeof entry !== 'object') {
      console.warn('Удалена невалидная запись ' + i);
      removedCount++;
      continue;
    }

    const cleaned = cleanEntry(entry);

    if (!cleaned.cattleId || typeof cleaned.cattleId !== 'string' || cleaned.cattleId.trim().length === 0) {
      console.warn('Удалена запись ' + i + ' без валидного cattleId');
      removedCount++;
      continue;
    }

    if (isGarbageString(cleaned.cattleId) || hasBinaryChars(cleaned.cattleId) || cleaned.cattleId.length > 100) {
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

  if (typeof replaceEntriesWith === 'function') replaceEntriesWith(validEntries); else { entries = validEntries; if (typeof window !== 'undefined') window.entries = entries; }
  const afterCount = entries.length;

  try {
    saveLocally();
  } catch (error) {
    console.error('Ошибка сохранения:', error);
    if (typeof showToast === 'function') showToast('Ошибка сохранения данных. Проверьте консоль.', 'error'); else alert('Ошибка сохранения данных. Проверьте консоль.');
    return;
  }

  if (typeof updateList === 'function') {
    updateList();
  }
  if (typeof updateViewList === 'function') {
    updateViewList();
  }

  console.log('Принудительная очистка завершена. Было: ' + beforeCount + ', стало: ' + afterCount + ', удалено: ' + removedCount);

  if (typeof showToast === 'function') showToast('Принудительная очистка завершена. Удалено: ' + removedCount + ', осталось: ' + afterCount, 'success', 5000); else alert('✅ Принудительная очистка завершена.\nУдалено поврежденных записей: ' + removedCount + '\nОсталось валидных: ' + afterCount);
}

/**
 * Удаляет все данные программы. Необратимо!
 */
function deleteAllData() {
  const beforeCount = entries.length;
  if (typeof replaceEntriesWith === 'function') replaceEntriesWith([]); else { entries.length = 0; if (typeof window !== 'undefined') window.entries = entries; }
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
    if (typeof showToast === 'function') showToast('Ошибка при удалении данных. Проверьте консоль.', 'error'); else alert('Ошибка при удалении данных. Проверьте консоль.');
    return;
  }
  if (typeof window.CattleTrackerEvents !== 'undefined') {
    window.CattleTrackerEvents.emit('entries:updated', entries);
  }
  if (typeof updateList === 'function') updateList();
  if (typeof updateViewList === 'function') updateViewList();
  if (typeof showToast === 'function') showToast('Все данные удалены. Удалено записей: ' + beforeCount, 'success'); else alert('✅ Все данные удалены.\nУдалено записей: ' + beforeCount);
}

// === js/storage/storage.js
// storage.js — фасад: реэкспорт и подмена при режиме API

var useApi = typeof window !== 'undefined' && window.CATTLE_TRACKER_USE_API && window.CattleTrackerApi;
if (useApi) {
  var _objectsCache = [];
  function loadObjectsFromApi() {
    return window.CattleTrackerApi.getObjectsList().then(function (list) {
      _objectsCache = list && list.length ? list : [{ id: 'default', name: 'Основная база' }];
      return _objectsCache;
    });
  }
  getCurrentObjectId = function () { return window.CattleTrackerApi.getCurrentObjectId(); };
  setCurrentObjectId = function (id) { window.CattleTrackerApi.setCurrentObjectId(id); };
  getObjectsList = function () { return _objectsCache.length ? _objectsCache : [{ id: 'default', name: 'Основная база' }]; };
  ensureObjectsAndMigration = function () { return loadObjectsFromApi(); };

  addObject = function (name) {
    return window.CattleTrackerApi.addObject(name).then(function (id) {
      return loadObjectsFromApi().then(function () {
        switchToObject(id);
        return id;
      });
    });
  };

  updateObject = function (id, payload) {
    return window.CattleTrackerApi.updateObject(id, payload || {}).then(function () {
      return loadObjectsFromApi();
    });
  };

  deleteObject = function (id) {
    var currentId = getCurrentObjectId();
    return window.CattleTrackerApi.deleteObject(id).then(function () {
      return loadObjectsFromApi().then(function () {
        var list = _objectsCache.length ? _objectsCache : [{ id: 'default', name: 'Основная база' }];
        if (currentId === id && list.length) {
          switchToObject(list[0].id);
        } else if (currentId === id) {
          setCurrentObjectId('default');
          if (typeof loadLocally === 'function') loadLocally();
        }
        if (typeof updateObjectSwitcher === 'function') updateObjectSwitcher();
      });
    });
  };

  switchToObject = function (objectId) {
    setCurrentObjectId(objectId);
    var p = loadLocally();
    if (p && typeof p.then === 'function') {
      p.then(function () {
        if (typeof updateHerdStats === 'function') updateHerdStats();
        if (typeof updateViewList === 'function') updateViewList();
        if (typeof window.CattleTrackerEvents !== 'undefined') {
          window.CattleTrackerEvents.emit('entries:updated', entries);
        }
      });
    } else {
      if (typeof updateHerdStats === 'function') updateHerdStats();
      if (typeof updateViewList === 'function') updateViewList();
      if (typeof window.CattleTrackerEvents !== 'undefined') {
        window.CattleTrackerEvents.emit('entries:updated', entries);
      }
    }
  };

  loadLocally = function () {
    return loadObjectsFromApi().then(function () {
      var objectId = getCurrentObjectId();
      return window.CattleTrackerApi.loadEntries(objectId).then(function (list) {
        if (typeof replaceEntriesWith === 'function') replaceEntriesWith(list || []); else { entries.length = 0; (list || []).forEach(function (e) { entries.push(e); }); if (typeof window !== 'undefined') window.entries = entries; }
        if (typeof window.CattleTrackerEvents !== 'undefined') {
          window.CattleTrackerEvents.emit('entries:updated', entries);
        }
        if (typeof updateList === 'function') updateList();
        return entries;
      }).catch(function (err) {
        console.error('Ошибка загрузки записей с API:', err);
        if (typeof replaceEntriesWith === 'function') replaceEntriesWith([]); else { entries.length = 0; if (typeof window !== 'undefined') window.entries = entries; }
        if (typeof updateList === 'function') updateList();
        throw err;
      });
    });
  };

  saveLocally = function () { /* no-op when API */ };

  function createEntryViaApi(entry) {
    var objectId = getCurrentObjectId();
    return window.CattleTrackerApi.createEntry(objectId, entry).then(function () {
      return loadLocally();
    });
  }
  function updateEntryViaApi(cattleId, entry) {
    var objectId = getCurrentObjectId();
    return window.CattleTrackerApi.updateEntry(objectId, cattleId, entry).then(function () {
      return loadLocally();
    });
  }
  function deleteEntryViaApi(cattleId) {
    var objectId = getCurrentObjectId();
    return window.CattleTrackerApi.deleteEntry(objectId, cattleId).then(function () {
      return loadLocally();
    });
  }
  window.createEntryViaApi = createEntryViaApi;
  window.updateEntryViaApi = updateEntryViaApi;
  window.deleteEntryViaApi = deleteEntryViaApi;
  window.loadObjectsFromApi = loadObjectsFromApi;
  window.loadLocally = loadLocally;
}

window.checkDataIntegrity = checkDataIntegrity;
window.cleanAllEntries = cleanAllEntries;
window.forceCleanDamagedEntries = forceCleanDamagedEntries;
window.deleteAllData = deleteAllData;
window.getCurrentObjectId = getCurrentObjectId;
window.getObjectsList = getObjectsList;
window.switchToObject = switchToObject;
window.addObject = addObject;
window.updateObject = updateObject;
window.deleteObject = deleteObject;
window.ensureObjectsAndMigration = ensureObjectsAndMigration;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    entries: entries,
    saveLocally: saveLocally,
    loadLocally: loadLocally,
    getDefaultCowEntry: getDefaultCowEntry,
    checkDataIntegrity: checkDataIntegrity,
    cleanAllEntries: cleanAllEntries
  };
}

// === js/core/core.js
/**
 * core.js — Основной класс приложения CattleTracker
 * Инкапсулирует доступ к данным и координацию модулей
 */
(function (global) {
  'use strict';

  /**
   * @param {Array} entriesRef - Ссылка на массив записей (глобальный entries из storage.js)
   */
  function CattleTracker(entriesRef) {
    this._entriesRef = entriesRef;
  }

  CattleTracker.prototype.getEntries = function () {
    return this._entriesRef || [];
  };

  CattleTracker.prototype.getEntry = function (cattleId) {
    const list = this.getEntries();
    return list.find(function (e) { return e.cattleId === cattleId; }) || null;
  };

  CattleTracker.prototype.emitEntriesUpdated = function () {
    if (typeof global.CattleTrackerEvents !== 'undefined') {
      global.CattleTrackerEvents.emit('entries:updated', this.getEntries());
    }
  };

  CattleTracker.prototype.load = function () {
    if (typeof loadLocally === 'function') {
      loadLocally();
    }
    this.emitEntriesUpdated();
  };

  CattleTracker.prototype.save = function () {
    if (typeof saveLocally === 'function') {
      saveLocally();
    }
    this.emitEntriesUpdated();
  };

  // Глобальный экземпляр будет инициализирован после загрузки storage.js
  function getInstance() {
    if (!global.CattleTrackerInstance && typeof entries !== 'undefined') {
      global.CattleTrackerInstance = new CattleTracker(entries);
    }
    return global.CattleTrackerInstance;
  }

  global.CattleTracker = CattleTracker;
  global.getCattleTracker = getInstance;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CattleTracker, getCattleTracker: getInstance };
  }
})(typeof window !== 'undefined' ? window : this);

// === js/core/users.js
/**
 * users.js — Многопользовательский режим (localStorage)
 */
(function (global) {
  'use strict';

  var USERS_KEY = 'cattleTracker_users';
  var CURRENT_USER_KEY = 'cattleTracker_currentUser';
  var LAST_USERNAMES_KEY = 'cattleTracker_lastUsernames';
  var MAX_LAST_USERNAMES = 15;
  var currentUser = null;

  function simpleHash(str) {
    var h = 0;
    for (var i = 0; i < str.length; i++) {
      h = ((h << 5) - h) + str.charCodeAt(i) | 0;
    }
    return Math.abs(h).toString(36);
  }

  function loadUsers() {
    try {
      var raw = localStorage.getItem(USERS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function saveUsers(users) {
    try {
      localStorage.setItem(USERS_KEY, JSON.stringify(users || []));
    } catch (e) {}
  }

  function loadCurrentUser() {
    try {
      var raw = localStorage.getItem(CURRENT_USER_KEY);
      if (raw) {
        currentUser = JSON.parse(raw);
        return currentUser;
      }
    } catch (e) {}
    currentUser = null;
    return null;
  }

  function saveCurrentUser(user) {
    currentUser = user;
    try {
      if (user) {
        localStorage.setItem(CURRENT_USER_KEY, JSON.stringify({ id: user.id, username: user.username, role: user.role }));
      } else {
        localStorage.removeItem(CURRENT_USER_KEY);
      }
    } catch (e) {}
  }

  function registerUser(username, password, role) {
    if (!username || !password) return { ok: false, message: 'Введите логин и пароль' };
    username = String(username).trim();
    if (!username) return { ok: false, message: 'Логин не может быть пустым' };
    var users = loadUsers();
    if (users.some(function (u) { return u.username.toLowerCase() === username.toLowerCase(); })) {
      return { ok: false, message: 'Пользователь с таким логином уже есть' };
    }
    var id = 'u_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
    var newUser = { id: id, username: username, passwordHash: simpleHash(password), role: role || 'admin' };
    users.push(newUser);
    saveUsers(users);
    return { ok: true, user: { id: newUser.id, username: newUser.username, role: newUser.role } };
  }

  function loginUser(username, password) {
    if (!username || !password) return { ok: false, message: 'Введите логин и пароль' };
    var users = loadUsers();
    var user = users.find(function (u) { return u.username.toLowerCase() === String(username).trim().toLowerCase(); });
    if (!user || user.passwordHash !== simpleHash(password)) {
      return { ok: false, message: 'Неверный логин или пароль' };
    }
    var session = { id: user.id, username: user.username, role: user.role };
    saveCurrentUser(session);
    addLastUsername(user.username);
    return { ok: true, user: session };
  }

  function getLastUsernames() {
    try {
      var raw = localStorage.getItem(LAST_USERNAMES_KEY);
      var list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (e) { return []; }
  }

  function addLastUsername(username) {
    if (!username || typeof username !== 'string') return;
    var u = username.trim();
    if (!u) return;
    var list = getLastUsernames();
    list = list.filter(function (x) { return x !== u; });
    list.unshift(u);
    list = list.slice(0, MAX_LAST_USERNAMES);
    try {
      localStorage.setItem(LAST_USERNAMES_KEY, JSON.stringify(list));
    } catch (e) {}
  }

  /** Список логинов для выбора при входе: в локальном режиме — все пользователи, при API — недавно входившие. */
  function getLoginUsernameList() {
    if (typeof global !== 'undefined' && global.CATTLE_TRACKER_USE_API) {
      return getLastUsernames();
    }
    return loadUsers().map(function (u) { return u.username || ''; }).filter(Boolean);
  }

  function fillAuthUsernameList() {
    var select = document.getElementById('authUsernameSelect');
    var input = document.getElementById('authUsername');
    if (!select) return;
    var list = getLoginUsernameList();
    var current = select.value;
    select.innerHTML = '';
    var empty = document.createElement('option');
    empty.value = '';
    empty.textContent = '— Выберите из списка —';
    select.appendChild(empty);
    list.forEach(function (u) {
      var opt = document.createElement('option');
      opt.value = u;
      opt.textContent = u;
      select.appendChild(opt);
    });
    if (current && list.indexOf(current) !== -1) select.value = current;
    if (input && select.value) input.value = select.value;
  }

  function initAuthUsernameSelect() {
    var select = document.getElementById('authUsernameSelect');
    var input = document.getElementById('authUsername');
    if (!select || !input) return;
    fillAuthUsernameList();
    select.addEventListener('change', function () {
      if (select.value) input.value = select.value;
    });
  }

  function logoutUser() {
    saveCurrentUser(null);
  }

  function getCurrentUser() {
    if (!currentUser) loadCurrentUser();
    return currentUser;
  }

  /**
   * Возвращает записи, видимые текущему пользователю. Все авторизованные видят все записи.
   */
  function getVisibleEntries(list) {
    if (!list || !Array.isArray(list)) return list || [];
    return list;
  }

  function canAdd() {
    var user = getCurrentUser();
    if (!user) return true;
    return user.role === 'admin' || user.role === 'operator';
  }

  function canEdit() {
    var user = getCurrentUser();
    if (!user) return true;
    return user.role === 'admin' || user.role === 'operator';
  }

  function canDelete() {
    var user = getCurrentUser();
    if (!user) return true;
    return user.role === 'admin' || user.role === 'operator';
  }

  var useApi = typeof global !== 'undefined' && global.CATTLE_TRACKER_USE_API && global.CattleTrackerApi;

  function getSavedServerBase() {
    try {
      var s = localStorage.getItem('cattleTracker_apiBase');
      return (s && (s = (s + '').trim())) ? s : '';
    } catch (e) { return ''; }
  }

  function saveServerBaseUrl() {
    var input = document.getElementById('serverApiBaseInput');
    var url = (input && input.value ? input.value : '').trim().replace(/\/$/, '');
    if (!url) {
      if (typeof showToast === 'function') showToast('Введите адрес сервера', 'error');
      else alert('Введите адрес сервера');
      return;
    }
    if (url.indexOf('https://') === 0 && (url.indexOf(':3000') !== -1 || url.indexOf(':3001') !== -1)) {
      url = url.replace(/^https:\/\//i, 'http://');
      if (input) input.value = url;
      if (typeof showToast === 'function') showToast('На порту 3000 обычно работает HTTP. Используется http://…', 'info', 5000);
    }
    if (url.indexOf('http://') === 0 && url.indexOf('localhost') === -1 && url.indexOf('127.0.0.1') === -1) {
      if (!confirm('Для доступа из интернета рекомендуется HTTPS. Продолжить с HTTP?')) return;
    }
    var useApiNow = typeof global !== 'undefined' && global.CATTLE_TRACKER_USE_API;
    var hasLocalEntries = !useApiNow && typeof global !== 'undefined' && global.entries && Array.isArray(global.entries) && global.entries.length > 0;
    if (hasLocalEntries && !confirm('После перезагрузки будут показаны данные с сервера (сейчас на сервере может не быть записей). Ваши локальные записи останутся в браузере, но не будут отображаться. Чтобы снова видеть их, уберите адрес сервера в Настройках. Рекомендуется создать резервную копию перед перезагрузкой. Продолжить?')) {
      return;
    }
    try {
      localStorage.setItem('cattleTracker_apiBase', url);
      if (typeof showToast === 'function') showToast('Адрес сохранён. Перезагрузка…', 'info');
      location.reload();
    } catch (e) {
      if (typeof showToast === 'function') showToast('Ошибка сохранения', 'error');
      else alert('Ошибка сохранения');
    }
  }

  function bindAuthControls() {
    var connectionBtn = document.getElementById('app-header-connection-btn');
    if (connectionBtn && !connectionBtn.dataset.authBound) {
      connectionBtn.dataset.authBound = '1';
      connectionBtn.addEventListener('click', function () {
        var nav = (typeof global !== 'undefined' && global.navigate) || (typeof window !== 'undefined' && window.navigate);
        if (typeof nav === 'function') nav('sync');
      });
    }
    var loginForm = document.getElementById('authLoginForm');
    if (loginForm && !loginForm.dataset.authBound) {
      loginForm.dataset.authBound = '1';
      loginForm.addEventListener('submit', function (ev) {
        ev.preventDefault();
        handleLogin(ev);
        return false;
      });
    }
    var regForm = document.getElementById('authRegisterForm');
    if (regForm && !regForm.dataset.authBound) {
      regForm.dataset.authBound = '1';
      regForm.addEventListener('submit', function (ev) {
        ev.preventDefault();
        handleRegister(ev);
        return false;
      });
    }
    var skipBtn = document.getElementById('auth-skip-btn');
    if (skipBtn && !skipBtn.dataset.authBound) {
      skipBtn.dataset.authBound = '1';
      skipBtn.addEventListener('click', function () {
        skipAuth();
      });
    }
  }

  function getDefaultLocalUsername() {
    var g = typeof global !== 'undefined' ? global : (typeof window !== 'undefined' ? window : null);
    var api = g && (g.electronAPI || g.electronapi);
    if (api && typeof api.getOsUsername === 'function') {
      return api.getOsUsername().then(function (u) {
        return 'admin(' + (u || 'local') + ')';
      }).catch(function () { return 'admin(local)'; });
    }
    return Promise.resolve('admin(local)');
  }

  function initUsers() {
    var base = getSavedServerBase();
    var authHint = document.getElementById('auth-api-hint');
    if (authHint) authHint.style.display = base ? '' : 'none';
    var userDataHint = document.getElementById('auth-user-data-hint');
    if (userDataHint) userDataHint.style.display = base ? '' : 'none';
    var skipBtn = document.getElementById('auth-skip-btn');
    if (skipBtn) skipBtn.style.display = base ? 'none' : '';
    initAuthUsernameSelect();
    bindAuthControls();
    if (useApi && typeof initRegisterUsernameCheck === 'function') {
      initRegisterUsernameCheck();
    }
    if (useApi) {
      global.CattleTrackerApi.getCurrentUser().then(function (u) {
        currentUser = u || null;
        updateAuthBar();
        // В Electron при запуске не переключаем на меню — показываем экран входа
        var isElectron = typeof window !== 'undefined' && window.electronAPI;
        if (currentUser && typeof navigate === 'function' && !isElectron) navigate('menu');
      }).catch(function () {
        currentUser = null;
        updateAuthBar();
      });
      return;
    }
    loadCurrentUser();
    updateAuthBar();
    // В Electron при запуске не переключаем на меню — показываем экран входа
    var isElectron = typeof window !== 'undefined' && window.electronAPI;
    if (getCurrentUser() && typeof navigate === 'function' && !isElectron) navigate('menu');
  }

  function updateAuthBar() {
    var bar = document.getElementById('auth-bar');
    var span = document.getElementById('authBarUser');
    var user = getCurrentUser();
    if (bar && span) {
      if (user) {
        bar.style.display = 'flex';
        span.textContent = 'Пользователь: ' + (user.username || '') + ' (' + (user.role || '') + ')';
      } else {
        bar.style.display = 'none';
      }
    }
  }

  function initRegisterUsernameCheck() {
    var input = document.getElementById('regUsername');
    var checkEl = document.getElementById('authUsernameCheck');
    if (!input || !checkEl || !global.CattleTrackerApi || typeof global.CattleTrackerApi.checkUsername !== 'function') return;
    var debounceTimer = null;
    function doCheck() {
      var u = (input.value || '').trim();
      checkEl.textContent = '';
      checkEl.className = 'auth-username-check';
      if (!u) return;
      checkEl.textContent = 'Проверка…';
      global.CattleTrackerApi.checkUsername(u).then(function (data) {
        if ((input.value || '').trim() !== u) return;
        if (data.available) {
          checkEl.textContent = 'Логин свободен';
          checkEl.className = 'auth-username-check auth-username-free';
        } else {
          checkEl.textContent = 'Логин уже занят';
          checkEl.className = 'auth-username-check auth-username-taken';
        }
      }).catch(function () {
        if ((input.value || '').trim() !== u) return;
        checkEl.textContent = '';
        checkEl.className = 'auth-username-check';
      });
    }
    function scheduleCheck() {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(doCheck, 400);
    }
    input.addEventListener('input', scheduleCheck);
    input.addEventListener('blur', function () {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(doCheck, 150);
    });
  }

  function showAuthLogin() {
    var loginForm = document.getElementById('authLoginForm');
    var regForm = document.getElementById('authRegisterForm');
    var checkEl = document.getElementById('authUsernameCheck');
    if (loginForm) loginForm.style.display = '';
    if (regForm) regForm.style.display = 'none';
    if (checkEl) { checkEl.textContent = ''; checkEl.className = 'auth-username-check'; }
  }
  function showAuthRegister() {
    var loginForm = document.getElementById('authLoginForm');
    var regForm = document.getElementById('authRegisterForm');
    var checkEl = document.getElementById('authUsernameCheck');
    if (loginForm) loginForm.style.display = 'none';
    if (regForm) regForm.style.display = '';
    if (checkEl) { checkEl.textContent = ''; checkEl.className = 'auth-username-check'; }
  }
  function handleLogin(ev) {
    if (ev && ev.preventDefault) ev.preventDefault();
    var username = document.getElementById('authUsername') && document.getElementById('authUsername').value;
    var password = document.getElementById('authPassword') && document.getElementById('authPassword').value;
    if (useApi) {
      global.CattleTrackerApi.login(username, password).then(function (data) {
        if (data && data.user) {
          saveCurrentUser(data.user);
          addLastUsername(data.user.username || username);
        }
        if (typeof showToast === 'function') showToast('Вход выполнен', 'success'); else alert('Вход выполнен');
        updateAuthBar();
        if (typeof navigate === 'function') navigate('menu');
      }).catch(function (err) {
        var msg = (err && err.message) ? err.message : 'Ошибка входа';
        if (typeof showToast === 'function') showToast(msg, 'error'); else alert(msg);
      });
      return false;
    }
    var result = loginUser(username, password);
    if (result.ok) {
      if (typeof showToast === 'function') showToast('Вход выполнен', 'success'); else alert('Вход выполнен');
      updateAuthBar();
      if (typeof navigate === 'function') navigate('menu');
    } else {
      if (typeof showToast === 'function') showToast(result.error || result.message || 'Ошибка входа', 'error'); else alert(result.error || result.message || 'Ошибка входа');
    }
    return false;
  }
  function handleRegister(ev) {
    if (ev && ev.preventDefault) ev.preventDefault();
    var username = document.getElementById('regUsername') && document.getElementById('regUsername').value;
    var password = document.getElementById('regPassword') && document.getElementById('regPassword').value;
    var role = document.getElementById('regRole') && document.getElementById('regRole').value;
    if (useApi) {
      global.CattleTrackerApi.register(username, password, role).then(function (data) {
        if (typeof showToast === 'function') showToast('Регистрация успешна. Войдите.', 'success'); else alert('Регистрация успешна. Войдите.');
        showAuthLogin();
      }).catch(function (err) {
        var msg = (err && err.message) ? err.message : 'Ошибка';
        if (typeof showToast === 'function') showToast(msg, 'error'); else alert(msg);
      });
      return false;
    }
    var result = registerUser(username, password, role);
    if (result.ok) {
      if (typeof showToast === 'function') showToast('Регистрация успешна. Войдите.', 'success'); else alert('Регистрация успешна. Войдите.');
      showAuthLogin();
    } else {
      if (typeof showToast === 'function') showToast(result.error || result.message || 'Ошибка', 'error'); else alert(result.error || result.message || 'Ошибка');
    }
    return false;
  }
  function skipAuth() {
    var nav = (typeof global !== 'undefined' && global.navigate) || (typeof window !== 'undefined' && window.navigate);
    getDefaultLocalUsername().then(function (username) {
      saveCurrentUser({ id: 'local_admin', username: username, role: 'admin' });
      updateAuthBar();
      if (typeof nav === 'function') nav('menu');
    }).catch(function () {
      saveCurrentUser({ id: 'local_admin', username: 'admin(local)', role: 'admin' });
      updateAuthBar();
      if (typeof nav === 'function') nav('menu');
    });
  }
  function handleLogout() {
    if (useApi) global.CattleTrackerApi.logout();
    saveCurrentUser(null);
    updateAuthBar();
    if (typeof showToast === 'function') showToast('Выход выполнен', 'info'); else alert('Выход выполнен');
    if (typeof navigate === 'function') navigate('menu');
  }

  if (typeof window !== 'undefined') {
    window.registerUser = registerUser;
    window.loginUser = loginUser;
    window.logoutUser = logoutUser;
    window.getCurrentUser = getCurrentUser;
    window.getVisibleEntries = getVisibleEntries;
    window.canAdd = canAdd;
    window.canEdit = canEdit;
    window.canDelete = canDelete;
    window.updateAuthBar = updateAuthBar;
    window.showAuthLogin = showAuthLogin;
    window.showAuthRegister = showAuthRegister;
    window.handleLogin = handleLogin;
    window.handleRegister = handleRegister;
    window.skipAuth = skipAuth;
    window.handleLogout = handleLogout;
    window.saveServerBaseUrl = saveServerBaseUrl;
    window.getSavedServerBase = getSavedServerBase;
    window.initRegisterUsernameCheck = initRegisterUsernameCheck;
    window.fillAuthUsernameList = fillAuthUsernameList;
    window.bindAuthControls = bindAuthControls;
  }

  if (typeof window !== 'undefined' && window.document) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initUsers);
    } else {
      initUsers();
    }
  }
})(typeof window !== 'undefined' ? window : this);

// === js/ui/ui-helpers.js
// ui-helpers.js — Вспомогательные функции для UI

/**
 * Показывает индикатор загрузки поверх контейнера
 * @param {HTMLElement|string} container - Элемент или id
 * @returns {function} - Функция для скрытия индикатора
 */
function showLoading(container) {
  const el = typeof container === 'string' ? document.getElementById(container) : container;
  if (!el) return function () {};
  const overlay = document.createElement('div');
  overlay.className = 'loading-overlay';
  overlay.innerHTML = '<div class="loading-spinner"></div><span class="loading-text">Загрузка...</span>';
  el.style.position = el.style.position || 'relative';
  el.appendChild(overlay);
  return function () {
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
  };
}

/**
 * Показывает всплывающее сообщение (тост)
 * @param {string} text - Текст сообщения
 * @param {string} type - 'success' | 'error' | 'info'
 * @param {number} duration - Длительность в мс
 */
function showToast(text, type, duration) {
  if (typeof type !== 'string') type = 'info';
  if (typeof duration !== 'number') duration = 3000;
  const container = document.getElementById('toast-container');
  const parent = container || document.body;
  var maxToasts = 5;
  if (container && container.children.length >= maxToasts) {
    container.removeChild(container.firstChild);
  }
  const toast = document.createElement('div');
  toast.className = 'toast toast-' + type;
  toast.textContent = text;
  parent.appendChild(toast);
  requestAnimationFrame(function () {
    toast.classList.add('toast-visible');
  });
  setTimeout(function () {
    toast.classList.remove('toast-visible');
    setTimeout(function () {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 300);
  }, duration);
}

/**
 * Показывает/обновляет панель прогресса скачивания обновления (Electron).
 * @param {number} percent - 0..100
 * @param {string} downloadPath - путь к папке загрузки (опционально)
 * @param {number} bytesPerSecond - скорость (опционально)
 */
function showUpdateProgress(percent, downloadPath, bytesPerSecond) {
  var id = 'update-progress-panel';
  var panel = document.getElementById(id);
  if (!panel) {
    panel = document.createElement('div');
    panel.id = id;
    panel.className = 'update-progress-panel';
    panel.innerHTML = '<div class="update-progress-title">Скачивание обновления</div>' +
      '<div class="update-progress-bar-wrap"><div class="update-progress-bar" style="width:0%"></div></div>' +
      '<div class="update-progress-text">0%</div>';
    document.body.appendChild(panel);
  }
  var bar = panel.querySelector('.update-progress-bar');
  var text = panel.querySelector('.update-progress-text');
  if (bar) bar.style.width = (percent || 0) + '%';
  if (text) {
    var speed = bytesPerSecond ? ' · ' + (bytesPerSecond < 1024 ? bytesPerSecond + ' Б/с' : (bytesPerSecond / 1024).toFixed(1) + ' КБ/с') : '';
    text.textContent = (percent || 0) + '%' + speed;
  }
  if (percent >= 100) {
    if (text) text.textContent = 'Готово';
    setTimeout(function () {
      if (panel.parentNode) panel.parentNode.removeChild(panel);
    }, 2500);
  }
}

/**
 * Модальное подтверждение (замена confirm): возвращает Promise<boolean>.
 * ОК → true, Отмена / Escape → false. Focus trap и закрытие по Escape.
 * @param {string} message - Текст вопроса
 * @param {{ confirmText?: string, cancelText?: string }} [options]
 * @returns {Promise<boolean>}
 */
function showConfirmModal(message, options) {
  var confirmText = (options && options.confirmText) || 'ОК';
  var cancelText = (options && options.cancelText) || 'Отмена';
  var resolved = false;
  var focusBefore = document.activeElement;

  var overlay = document.createElement('div');
  overlay.className = 'confirm-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'confirm-modal-title');

  var text = (message || 'Продолжить?').replace(/</g, '&lt;');
  overlay.innerHTML =
    '<div class="confirm-modal">' +
    '<p id="confirm-modal-title">' + text + '</p>' +
    '<div class="confirm-modal-actions">' +
    '<button type="button" class="small-btn confirm-cancel">' + cancelText.replace(/</g, '&lt;') + '</button>' +
    '<button type="button" class="btn primary confirm-ok">' + confirmText.replace(/</g, '&lt;') + '</button>' +
    '</div></div>';

  var dialog = overlay.querySelector('.confirm-modal');
  var btnOk = overlay.querySelector('.confirm-ok');
  var btnCancel = overlay.querySelector('.confirm-cancel');

  function finish(result) {
    if (resolved) return;
    resolved = true;
    overlay.remove();
    if (focusBefore && typeof focusBefore.focus === 'function') focusBefore.focus();
    resolvePromise(result);
  }

  var resolvePromise;
  var promise = new Promise(function (resolve) { resolvePromise = resolve; });

  btnOk.addEventListener('click', function () { finish(true); });
  btnCancel.addEventListener('click', function () { finish(false); });
  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) finish(false);
  });
  overlay.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { e.preventDefault(); finish(false); }
    if (e.key === 'Tab') {
      var focusable = [btnCancel, btnOk];
      var i = focusable.indexOf(document.activeElement);
      if (i === -1) return;
      if (e.shiftKey) {
        e.preventDefault();
        focusable[i === 0 ? focusable.length - 1 : i - 1].focus();
      } else {
        e.preventDefault();
        focusable[i === focusable.length - 1 ? 0 : i + 1].focus();
      }
    }
  });

  document.body.appendChild(overlay);
  btnOk.focus();
  return promise;
}

/**
 * Подтверждение действия (синхронная обёртка для совместимости — использует нативный confirm).
 * Для нового кода предпочтительно showConfirmModal (возвращает Promise).
 * @param {string} message
 * @returns {boolean}
 */
function confirmAction(message) {
  return confirm(message || 'Продолжить?');
}

/**
 * Очищает форму ввода
 */
function clearForm() {
  const fields = [
    'cattleId', 'nickname', 'group', 'birthDate', 'lactation', 'calvingDate',
    'inseminationDate', 'attemptNumber', 'bull', 'inseminator', 'code',
    'status', 'protocolName', 'protocolStartDate', 'exitDate', 
    'dryStartDate', 'vwp', 'note'
  ];
  
  fields.forEach(fieldId => {
    const element = document.getElementById(fieldId);
    if (element) {
      if (element.type === 'select-one') {
        element.selectedIndex = 0;
      } else if (element.type === 'number') {
        element.value = fieldId === 'lactation' ? '' : 
                       fieldId === 'attemptNumber' ? '1' :
                       fieldId === 'vwp' ? '' : '';
      } else {
        element.value = '';
      }
    }
  });
  
  // Статус без значения по умолчанию (поле может быть пустым)
  const statusElement = document.getElementById('status');
  if (statusElement) {
    statusElement.value = '';
  }
}

/**
 * Форматирует дату в виде "дд.мм.гггг"
 * @param {string} dateStr
 * @returns {string}
 */
function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("ru-RU");
}

/**
 * Обновляет отображение списка записей на экране добавления
 */
function updateList() {
  const list = document.getElementById("entriesList");
  if (!list) return;

  list.innerHTML = `<div><strong>Всего: ${entries.length}</strong></div>`;
  
  if (entries.length === 0) {
    list.innerHTML += `<div style="color: #999; margin-top: 10px;">Нет данных</div>`;
  } else {
    // Функция для очистки и экранирования данных
    const cleanAndEscape = (text) => {
      if (!text) return '—';
      if (typeof text !== 'string') {
        try {
          text = String(text);
        } catch (e) {
          return '—';
        }
      }
      // Удаляем бинарные и невидимые символы
      text = text.replace(/[\x00-\x1F\x7F-\x9F]/g, '').trim();
      if (!text) return '—';
      // Экранируем HTML
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    };

    entries.forEach(entry => {
      const div = document.createElement("div");
      div.className = "entry" + (!entry.synced ? " unsynced" : "");
      div.innerHTML = `
        <strong>Корова:</strong> ${cleanAndEscape(entry.cattleId)} | 
        <strong>Кличка:</strong> ${cleanAndEscape(entry.nickname)}<br>
        <strong>Дата осеменения:</strong> ${formatDate(entry.inseminationDate)} | 
        <strong>Лактация:</strong> ${(entry.lactation !== undefined && entry.lactation !== null && entry.lactation !== '') || entry.lactation === 0 ? String(entry.lactation) : '—'}<br>
        <strong>Бык:</strong> ${cleanAndEscape(entry.bull)} | 
        <strong>Попытка:</strong> ${entry.attemptNumber || '—'} | 
        <strong>Статус:</strong> ${cleanAndEscape(entry.status)}<br>
        <em style="color: #666;">
          ${entry.code ? 'Код: ' + cleanAndEscape(entry.code) + ' • ' : ''}
          ${entry.calvingDate ? 'Отёл: ' + formatDate(entry.calvingDate) + ' • ' : ''}
          ${entry.dryStartDate ? 'Сухостой: ' + formatDate(entry.dryStartDate) + ' • ' : ''}
          ${entry.note ? cleanAndEscape(entry.note) : ''}
        </em>
        ${!entry.synced ? '<span style="color: #ff9900; font-size: 12px;"> ● Не отправлено</span>' : ''}
      `;
      list.appendChild(div);
    });
  }
}

// Экспорт функций
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    clearForm,
    formatDate,
    updateList
  };
}

// === js/ui/cow-operations.js
// cow-operations.js — Операции с записями коров

/**
 * Редактирует существующую запись
 * @param {string} cattleId - Номер коровы
 */
function editEntry(cattleId) {
  const entry = entries.find(e => e.cattleId === cattleId);
  if (!entry) {
    if (typeof showToast === 'function') showToast('Запись не найдена!', 'error'); else alert('Запись не найдена!');
    return;
  }

  // Устанавливаем режим редактирования
  window.currentEditingId = entry.cattleId;

  var clearBtn = document.getElementById('clearFormButton');
  if (clearBtn) clearBtn.style.display = 'none';

  // Обновляем заголовок экрана
  const titleElement = document.getElementById('addScreenTitle');
  if (titleElement) {
    titleElement.textContent = '✏️ Редактирование коровы ' + entry.cattleId;
  }

  // Заполняем форму данными из записи
  fillFormFromCowEntry(entry);

  // Переключаемся на экран добавления/редактирования
  if (typeof navigate === 'function') {
    navigate('add');
  }
}

/**
 * Удаляет запись
 * @param {string} cattleId - Номер коровы
 */
function deleteEntry(cattleId) {
  var doDelete = function () {
    var useApi = typeof window !== 'undefined' && window.CATTLE_TRACKER_USE_API && typeof window.deleteEntryViaApi === 'function';
    if (useApi) {
      window.deleteEntryViaApi(cattleId).then(function () {
        updateList();
        if (typeof updateViewList === 'function') updateViewList();
        if (typeof showToast === 'function') showToast('Запись удалена', 'success'); else alert('Запись удалена');
      }).catch(function (err) {
        if (typeof showToast === 'function') showToast(err && err.message ? err.message : 'Ошибка удаления', 'error'); else alert(err && err.message ? err.message : 'Ошибка удаления');
      });
      return;
    }
    var index = entries.findIndex(function (e) { return e.cattleId === cattleId; });
    if (index !== -1) {
      entries.splice(index, 1);
      saveLocally();
      updateList();
      if (typeof updateViewList === 'function') updateViewList();
      if (typeof showToast === 'function') showToast('Запись удалена', 'success'); else alert('Запись удалена');
    } else {
      if (typeof showToast === 'function') showToast('Запись не найдена!', 'error'); else alert('Запись не найдена!');
    }
  };
  if (typeof showConfirmModal === 'function') {
    showConfirmModal('Удалить запись о корове ' + cattleId + '?').then(function (ok) { if (ok) doDelete(); });
    return;
  }
  if (!confirm('Удалить запись о корове ' + cattleId + '?')) return;
  doDelete();
}

/**
 * Удаляет выделенные записи
 */
function deleteSelectedEntries() {
  var selectedCattleIds = typeof window.getSelectedCattleIds === 'function'
    ? window.getSelectedCattleIds()
    : Array.prototype.map.call(document.querySelectorAll('.entry-checkbox:checked'), function (checkbox) {
        return checkbox.getAttribute('data-cattle-id');
      });
  if (!selectedCattleIds || selectedCattleIds.length === 0) {
    if (typeof showToast === 'function') showToast('Нет выделенных записей для удаления', 'info'); else alert('Нет выделенных записей для удаления');
    return;
  }
  var count = selectedCattleIds.length;
  var confirmMessage = 'Вы уверены, что хотите удалить ' + count + (count === 1 ? ' запись' : count < 5 ? ' записи' : ' записей') + '?';
  var doDeleteSelected = function () {
    var useApi = typeof window !== 'undefined' && window.CATTLE_TRACKER_USE_API && window.CattleTrackerApi && typeof window.loadLocally === 'function';
    if (useApi) {
      var objectId = typeof getCurrentObjectId === 'function' ? getCurrentObjectId() : 'default';
      var promises = selectedCattleIds.map(function (id) {
        return window.CattleTrackerApi.deleteEntry(objectId, id);
      });
      Promise.all(promises).then(function () {
        return window.loadLocally();
      }).then(function () {
        updateList();
        if (typeof updateViewList === 'function') updateViewList();
        if (typeof updateHerdStats === 'function') updateHerdStats();
        if (typeof showToast === 'function') showToast('Удалено записей: ' + count, 'success'); else alert('Удалено записей: ' + count);
      }).catch(function (err) {
        if (typeof showToast === 'function') showToast(err && err.message ? err.message : 'Ошибка удаления', 'error'); else alert(err && err.message ? err.message : 'Ошибка удаления');
      });
      return;
    }
    var deletedCount = 0;
    selectedCattleIds.forEach(function (cattleId) {
      var index = entries.findIndex(function (e) { return e.cattleId === cattleId; });
      if (index !== -1) {
        entries.splice(index, 1);
        deletedCount++;
      }
    });
    if (deletedCount > 0) {
      saveLocally();
      updateList();
      if (typeof updateViewList === 'function') updateViewList();
      if (typeof updateHerdStats === 'function') updateHerdStats();
      if (typeof showToast === 'function') showToast('Удалено записей: ' + deletedCount, 'success'); else alert('Удалено записей: ' + deletedCount);
    } else {
      if (typeof showToast === 'function') showToast('Не удалось найти записи для удаления', 'info'); else alert('Не удалось найти записи для удаления');
    }
  };
  if (typeof showConfirmModal === 'function') {
    showConfirmModal(confirmMessage).then(function (ok) { if (ok) doDeleteSelected(); });
    return;
  }
  if (!confirm(confirmMessage)) return;
  doDeleteSelected();
}

/**
 * Заполняет форму данными из записи коровы
 * @param {Object} entry - Запись коровы
 */
function fillFormFromCowEntry(entry) {
  document.getElementById('cattleId').value = entry.cattleId || '';
  document.getElementById('nickname').value = entry.nickname || '';
  document.getElementById('group').value = entry.group || '';
  document.getElementById('birthDate').value = entry.birthDate || '';
  document.getElementById('lactation').value = entry.lactation !== undefined && entry.lactation !== '' ? entry.lactation : '';
  document.getElementById('calvingDate').value = entry.calvingDate || '';
  document.getElementById('inseminationDate').value = entry.inseminationDate || '';
  document.getElementById('attemptNumber').value = entry.attemptNumber || 1;
  document.getElementById('bull').value = entry.bull || '';
  document.getElementById('inseminator').value = entry.inseminator || '';
  document.getElementById('code').value = entry.code || '';
  document.getElementById('status').value = entry.status || '';
  document.getElementById('exitDate').value = entry.exitDate || '';
  document.getElementById('dryStartDate').value = entry.dryStartDate || '';
  document.getElementById('vwp').value = (typeof getPDO === 'function' ? getPDO(entry) : entry.vwp) || '—';
  document.getElementById('protocolName').value = entry.protocol?.name || '';
  document.getElementById('protocolStartDate').value = entry.protocol?.startDate || '';
  document.getElementById('note').value = entry.note || '';
}

/**
 * Заполняет запись коровы данными из формы
 * @param {Object} entry - Запись коровы для заполнения
 */
function fillCowEntryFromForm(entry) {
  entry.cattleId = document.getElementById('cattleId').value.trim();
  entry.nickname = document.getElementById('nickname').value || '';
  entry.group = document.getElementById('group').value || '';
  entry.birthDate = document.getElementById('birthDate').value || '';
  var lactationVal = document.getElementById('lactation').value.trim();
  entry.lactation = lactationVal === '' ? '' : (parseInt(lactationVal, 10) || '');
  entry.calvingDate = document.getElementById('calvingDate').value || '';
  entry.inseminationDate = document.getElementById('inseminationDate').value;
  entry.attemptNumber = parseInt(document.getElementById('attemptNumber').value) || 1;
  entry.bull = document.getElementById('bull').value || '';
  entry.inseminator = document.getElementById('inseminator').value || '';
  entry.code = document.getElementById('code').value || '';
  entry.status = document.getElementById('status').value || '';
  entry.exitDate = document.getElementById('exitDate').value || '';
  entry.dryStartDate = document.getElementById('dryStartDate').value || '';
  // ПДО не сохраняем — рассчитывается автоматически; vwp оставляем для совместимости импорта
  entry.note = document.getElementById('note').value || '';
  
  // Протокол синхронизации
  if (!entry.protocol) entry.protocol = {};
  entry.protocol.name = document.getElementById('protocolName').value || '';
  entry.protocol.startDate = document.getElementById('protocolStartDate').value || '';

  // Синхронизация последней записи в истории осеменений с полями формы
  if (entry.inseminationHistory && entry.inseminationHistory.length > 0) {
    var last = entry.inseminationHistory[entry.inseminationHistory.length - 1];
    last.date = entry.inseminationDate || '';
    last.attemptNumber = entry.attemptNumber;
    last.bull = entry.bull || '';
    last.inseminator = entry.inseminator || '';
    last.code = entry.code || '';
  }
}

/**
 * Отменяет редактирование
 */
function cancelEdit() {
  if (window.currentEditingId) {
    delete window.currentEditingId;
    const titleElement = document.getElementById('addScreenTitle');
    if (titleElement) {
      titleElement.textContent = '➕ Добавить корову';
    }
  }
  clearForm();
  if (typeof navigate === 'function') {
    navigate('view');
  }
}

/**
 * Универсальное автодополнение по номеру коровы для экранов Запуск/Отел/Протокол
 * @param {string} inputId - id поля ввода
 * @param {string} listId - id списка подсказок
 */
function setupCattleAutocompleteFor(inputId, listId) {
  var input = document.getElementById(inputId);
  var list = document.getElementById(listId);
  if (!input || !list) return;
  function populate() {
    list.innerHTML = '';
    var filter = (input.value || '').toLowerCase();
    if (!filter) return;
    var matching = (entries || []).filter(function (e) {
      return (e.cattleId && e.cattleId.toLowerCase().indexOf(filter) !== -1) ||
        (e.nickname && e.nickname.toLowerCase().indexOf(filter) !== -1);
    }).slice(0, 10);
    matching.forEach(function (entry) {
      var li = document.createElement('li');
      li.textContent = entry.cattleId + (entry.nickname ? ' (' + entry.nickname + ')' : '');
      li.dataset.value = entry.cattleId;
      li.addEventListener('click', function () {
        input.value = entry.cattleId;
        list.innerHTML = '';
      });
      list.appendChild(li);
    });
  }
  input.removeEventListener('input', input._cattleAutocompleteInput);
  input._cattleAutocompleteInput = populate;
  input.addEventListener('input', populate);
}

/**
 * Обновляет запись: запуск в сухостой (dryStartDate)
 */
function saveDryRunEntry() {
  var cattleId = document.getElementById('cattleIdDryInput').value.trim();
  var dryStartDate = document.getElementById('dryStartDateInput').value;
  if (!cattleId) {
    if (typeof showToast === 'function') showToast('Укажите номер коровы', 'error'); else alert('Укажите номер коровы');
    return;
  }
  var entry = entries.find(function (e) { return e.cattleId === cattleId; });
  if (!entry) {
    if (typeof showToast === 'function') showToast('Корова не найдена', 'error'); else alert('Корова не найдена');
    return;
  }
  entry.dryStartDate = dryStartDate || '';
  entry.status = entry.status || '';
  if (dryStartDate && entry.status.indexOf('Сухостой') === -1) entry.status = 'Сухостой';
  if (typeof window !== 'undefined' && window.CATTLE_TRACKER_USE_API && typeof window.updateEntryViaApi === 'function') {
    window.updateEntryViaApi(cattleId, entry).then(function () {
      if (typeof loadLocally === 'function') return loadLocally();
    }).then(function () {
      if (typeof showToast === 'function') showToast('Сохранено', 'success');
      if (typeof updateViewList === 'function') updateViewList();
      if (typeof navigate === 'function') navigate('menu');
    }).catch(function (err) {
      if (typeof showToast === 'function') showToast(err && err.message ? err.message : 'Ошибка', 'error'); else alert(err && err.message ? err.message : 'Ошибка');
    });
    return;
  }
  saveLocally();
  if (typeof showToast === 'function') showToast('Сохранено', 'success');
  if (typeof updateViewList === 'function') updateViewList();
  if (typeof navigate === 'function') navigate('menu');
}

/**
 * Обновляет запись: отёл (calvingDate)
 */
function saveCalvingEntry() {
  var cattleId = document.getElementById('cattleIdCalvingInput').value.trim();
  var calvingDate = document.getElementById('calvingDateInput').value;
  if (!cattleId) {
    if (typeof showToast === 'function') showToast('Укажите номер коровы', 'error'); else alert('Укажите номер коровы');
    return;
  }
  var entry = entries.find(function (e) { return e.cattleId === cattleId; });
  if (!entry) {
    if (typeof showToast === 'function') showToast('Корова не найдена', 'error'); else alert('Корова не найдена');
    return;
  }
  if (calvingDate && typeof validateDateNotFuture === 'function') {
    var err = validateDateNotFuture(calvingDate, 'Дата отёла');
    if (err) {
      if (typeof showToast === 'function') showToast(err, 'error'); else alert(err);
      return;
    }
  }
  entry.calvingDate = calvingDate || '';
  if (calvingDate && entry.status !== 'Отёл') entry.status = 'Отёл';
  if (typeof window !== 'undefined' && window.CATTLE_TRACKER_USE_API && typeof window.updateEntryViaApi === 'function') {
    window.updateEntryViaApi(cattleId, entry).then(function () {
      if (typeof loadLocally === 'function') return loadLocally();
    }).then(function () {
      if (typeof showToast === 'function') showToast('Сохранено', 'success');
      if (typeof updateViewList === 'function') updateViewList();
      if (typeof navigate === 'function') navigate('menu');
    }).catch(function (err) {
      if (typeof showToast === 'function') showToast(err && err.message ? err.message : 'Ошибка', 'error'); else alert(err && err.message ? err.message : 'Ошибка');
    });
    return;
  }
  saveLocally();
  if (typeof showToast === 'function') showToast('Сохранено', 'success');
  if (typeof updateViewList === 'function') updateViewList();
  if (typeof navigate === 'function') navigate('menu');
}

/**
 * Обновляет запись: поставить на протокол (protocol.name, protocol.startDate)
 */
function saveProtocolAssignEntry() {
  var cattleId = document.getElementById('cattleIdProtocolInput').value.trim();
  var protocolName = document.getElementById('protocolSelectAssign').value;
  var startDate = document.getElementById('protocolStartDateInput').value;
  if (!cattleId) {
    if (typeof showToast === 'function') showToast('Укажите номер коровы', 'error'); else alert('Укажите номер коровы');
    return;
  }
  if (!protocolName) {
    if (typeof showToast === 'function') showToast('Выберите протокол', 'error'); else alert('Выберите протокол');
    return;
  }
  if (startDate && typeof validateDateNotFuture === 'function') {
    var errProto = validateDateNotFuture(startDate, 'Дата постановки на протокол');
    if (errProto) {
      if (typeof showToast === 'function') showToast(errProto, 'error'); else alert(errProto);
      return;
    }
  }
  var entry = entries.find(function (e) { return e.cattleId === cattleId; });
  if (!entry) {
    if (typeof showToast === 'function') showToast('Корова не найдена', 'error'); else alert('Корова не найдена');
    return;
  }
  if (!entry.protocol) entry.protocol = {};
  entry.protocol.name = protocolName;
  entry.protocol.startDate = startDate || '';
  if (typeof window !== 'undefined' && window.CATTLE_TRACKER_USE_API && typeof window.updateEntryViaApi === 'function') {
    window.updateEntryViaApi(cattleId, entry).then(function () {
      if (typeof loadLocally === 'function') return loadLocally();
    }).then(function () {
      if (typeof showToast === 'function') showToast('Сохранено', 'success');
      if (typeof updateViewList === 'function') updateViewList();
      if (typeof navigate === 'function') navigate('menu');
    }).catch(function (err) {
      if (typeof showToast === 'function') showToast(err && err.message ? err.message : 'Ошибка', 'error'); else alert(err && err.message ? err.message : 'Ошибка');
    });
    return;
  }
  saveLocally();
  if (typeof showToast === 'function') showToast('Сохранено', 'success');
  if (typeof updateViewList === 'function') updateViewList();
  if (typeof navigate === 'function') navigate('menu');
}

function initDryScreen() {
  setupCattleAutocompleteFor('cattleIdDryInput', 'cattleIdDryList');
  if (window._prefillCattleId) {
    var el = document.getElementById('cattleIdDryInput');
    if (el) { el.value = window._prefillCattleId; delete window._prefillCattleId; }
  }
}

function initCalvingScreen() {
  setupCattleAutocompleteFor('cattleIdCalvingInput', 'cattleIdCalvingList');
  if (window._prefillCattleId) {
    var el = document.getElementById('cattleIdCalvingInput');
    if (el) { el.value = window._prefillCattleId; delete window._prefillCattleId; }
  }
}

function initProtocolAssignScreen() {
  setupCattleAutocompleteFor('cattleIdProtocolInput', 'cattleIdProtocolList');
  var select = document.getElementById('protocolSelectAssign');
  if (select && typeof getProtocols === 'function') {
    var list = getProtocols();
    select.innerHTML = '<option value="">— Выберите протокол —</option>';
    list.forEach(function (p) {
      var opt = document.createElement('option');
      opt.value = p.name || p.id;
      opt.textContent = p.name || 'Без названия';
      select.appendChild(opt);
    });
  }
  if (window._prefillCattleId) {
    var el = document.getElementById('cattleIdProtocolInput');
    if (el) { el.value = window._prefillCattleId; delete window._prefillCattleId; }
  }
}

/**
 * Возвращает дату последнего осеменения до указанной даты (строго до неё).
 */
function getLastInseminationDateBefore(entry, beforeDate) {
  if (!entry || !beforeDate) return null;
  var dates = [];
  if (entry.inseminationHistory && entry.inseminationHistory.length > 0) {
    entry.inseminationHistory.forEach(function (h) {
      if (h.date && String(h.date) < String(beforeDate)) dates.push(h.date);
    });
  } else if (entry.inseminationDate && String(entry.inseminationDate) < String(beforeDate)) {
    dates.push(entry.inseminationDate);
  }
  if (dates.length === 0) return null;
  return dates.reduce(function (a, b) { return a > b ? a : b; });
}

function updateUziDaysFromInsemination() {
  var cattleIdEl = document.getElementById('cattleIdUziInput');
  var dateEl = document.getElementById('uziDateInput');
  var outEl = document.getElementById('uziDaysFromInsemination');
  if (!cattleIdEl || !dateEl || !outEl) return;
  var cattleId = cattleIdEl.value.trim();
  var uziDate = dateEl.value;
  if (!cattleId || !uziDate) {
    outEl.value = '';
    outEl.placeholder = '—';
    return;
  }
  var entry = entries.find(function (e) { return e.cattleId === cattleId; });
  var lastInsem = entry ? getLastInseminationDateBefore(entry, uziDate) : null;
  if (!lastInsem) {
    outEl.value = '';
    outEl.placeholder = '—';
    return;
  }
  var d1 = new Date(lastInsem);
  var d2 = new Date(uziDate);
  if (isNaN(d1.getTime()) || isNaN(d2.getTime())) {
    outEl.value = '';
    outEl.placeholder = '—';
    return;
  }
  var days = Math.round((d2 - d1) / (24 * 60 * 60 * 1000));
  outEl.value = days >= 0 ? String(days) : '—';
}

function initUziScreen() {
  setupCattleAutocompleteFor('cattleIdUziInput', 'cattleIdUziList');
  if (window._prefillCattleId) {
    var el = document.getElementById('cattleIdUziInput');
    if (el) { el.value = window._prefillCattleId; delete window._prefillCattleId; }
  }
  var cattleIdEl = document.getElementById('cattleIdUziInput');
  var dateEl = document.getElementById('uziDateInput');
  if (cattleIdEl) {
    cattleIdEl.removeEventListener('input', updateUziDaysFromInsemination);
    cattleIdEl.removeEventListener('change', updateUziDaysFromInsemination);
    cattleIdEl.addEventListener('input', updateUziDaysFromInsemination);
    cattleIdEl.addEventListener('change', updateUziDaysFromInsemination);
  }
  if (dateEl) {
    dateEl.removeEventListener('input', updateUziDaysFromInsemination);
    dateEl.removeEventListener('change', updateUziDaysFromInsemination);
    dateEl.addEventListener('input', updateUziDaysFromInsemination);
    dateEl.addEventListener('change', updateUziDaysFromInsemination);
  }
  updateUziDaysFromInsemination();
}

function saveUziEntry() {
  var cattleId = document.getElementById('cattleIdUziInput').value.trim();
  var uziDate = document.getElementById('uziDateInput').value;
  var result = document.getElementById('uziResultSelect').value;
  var specialist = document.getElementById('uziSpecialistInput').value.trim();
  var daysEl = document.getElementById('uziDaysFromInsemination');
  var daysFromInsemination = daysEl && daysEl.value !== '' ? parseInt(daysEl.value, 10) : null;

  if (!cattleId) {
    if (typeof showToast === 'function') showToast('Укажите номер коровы', 'error'); else alert('Укажите номер коровы');
    return;
  }
  if (!uziDate) {
    if (typeof showToast === 'function') showToast('Укажите дату проверки', 'error'); else alert('Укажите дату проверки');
    return;
  }
  if (typeof validateDateNotFuture === 'function') {
    var errUzi = validateDateNotFuture(uziDate, 'Дата УЗИ');
    if (errUzi) {
      if (typeof showToast === 'function') showToast(errUzi, 'error'); else alert(errUzi);
      return;
    }
  }
  if (!result) {
    if (typeof showToast === 'function') showToast('Выберите результат (Не стельная / Стельная)', 'error'); else alert('Выберите результат');
    return;
  }

  var entry = entries.find(function (e) { return e.cattleId === cattleId; });
  if (!entry) {
    if (typeof showToast === 'function') showToast('Корова не найдена', 'error'); else alert('Корова не найдена');
    return;
  }

  if (!entry.uziHistory) entry.uziHistory = [];
  var lastInsem = getLastInseminationDateBefore(entry, uziDate);
  var daysNum = null;
  if (daysFromInsemination != null && !isNaN(daysFromInsemination)) daysNum = daysFromInsemination;
  else if (lastInsem) {
    var d1 = new Date(lastInsem);
    var d2 = new Date(uziDate);
    if (!isNaN(d1.getTime()) && !isNaN(d2.getTime())) daysNum = Math.round((d2 - d1) / (24 * 60 * 60 * 1000));
  }
  entry.uziHistory.push({
    date: uziDate,
    result: result,
    specialist: specialist,
    daysFromInsemination: daysNum
  });

  if (result === 'Стельная') entry.status = 'Стельная';
  if (result === 'Не стельная') entry.status = 'Холостая';

  var lastRec = entry.uziHistory[entry.uziHistory.length - 1];
  var detailsStr = 'Дата: ' + uziDate + ', ' + result + (specialist ? ', специалист: ' + specialist : '');
  if (lastRec.daysFromInsemination != null && lastRec.daysFromInsemination !== undefined) detailsStr += ', дней от осеменения: ' + lastRec.daysFromInsemination;
  if (typeof pushActionHistory === 'function') pushActionHistory(entry, 'УЗИ', detailsStr);

  if (typeof window !== 'undefined' && window.CATTLE_TRACKER_USE_API && typeof window.updateEntryViaApi === 'function') {
    window.updateEntryViaApi(cattleId, entry).then(function () {
      if (typeof loadLocally === 'function') return loadLocally();
    }).then(function () {
      if (typeof showToast === 'function') showToast('Сохранено', 'success');
      if (typeof updateViewList === 'function') updateViewList();
      if (typeof navigate === 'function') navigate('view-cow');
      viewCow(cattleId);
    }).catch(function (err) {
      if (typeof showToast === 'function') showToast(err && err.message ? err.message : 'Ошибка', 'error'); else alert(err && err.message ? err.message : 'Ошибка');
    });
    return;
  }
  saveLocally();
  if (typeof showToast === 'function') showToast('Сохранено', 'success');
  if (typeof updateViewList === 'function') updateViewList();
  if (typeof navigate === 'function') navigate('view-cow');
  if (typeof viewCow === 'function') viewCow(cattleId);
}

// Делаем функцию массового удаления доступной глобально
window.deleteSelectedEntries = deleteSelectedEntries;

// Экспорт функций
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    editEntry,
    deleteEntry,
    deleteSelectedEntries,
    fillFormFromCowEntry,
    fillCowEntryFromForm,
    cancelEdit
  };
}
// === js/utils/voice-handler.js
// voice-handler.js — Обработка голосовых команд

/**
 * Обрабатывает распознанную голосовую команду
 * @param {string} command
 */
function parseVoiceCommand(command) {
  console.log("Обработка голосовой команды:", command);
  
  // Поиск номера коровы
  const cattleMatch = command.match(/(?:корова|номер)\s+(\d+)/i);
  // Поиск клички
  const nicknameMatch = command.match(/кличка\s+([^\s,]+)/i);
  // Поиск быка
  const bullMatch = command.match(/бык\s+([^\s,]+)/i);
  // Поиск попытки
  const attemptMatch = command.match(/попытка\s+(\d+)/i);
  // Поиск статуса
  const statusMatch = command.match(/статус\s+([^\s,]+)/i);
  // Поиск кода осеменения
  const codeMatch = command.match(/код\s+([^\s,]+)/i);
  // Поиск осеменатора
  const inseminatorMatch = command.match(/осеменатор\s+([^\s,]+)/i);
  
  // Поиск даты осеменения
  let inseminationDate = parseDateFromVoice(command);

  // Заполняем поля
  if (cattleMatch) document.getElementById('cattleId').value = cattleMatch[1];
  if (nicknameMatch) document.getElementById('nickname').value = nicknameMatch[1];
  if (inseminationDate) document.getElementById('inseminationDate').value = inseminationDate;
  if (bullMatch) document.getElementById('bull').value = bullMatch[1];
  if (attemptMatch) document.getElementById('attemptNumber').value = attemptMatch[1];
  if (statusMatch) document.getElementById('status').value = statusMatch[1];
  if (codeMatch) document.getElementById('code').value = codeMatch[1];
  if (inseminatorMatch) document.getElementById('inseminator').value = inseminatorMatch[1];

  // Обратная связь
  showStatus(`✅ Обработано: ${command.substring(0, 50)}...`, 3000);
}

/**
 * Извлекает дату из голосовой команды
 * @param {string} command
 * @returns {string}
 */
function parseDateFromVoice(command) {
  const dateMatch = command.match(/(\d{1,2})[^\w]*(январ[яь]|феврал[яь]|март[а]?|апрел[яь]|май[я]?|июн[яь]?|июл[яь]?|август[а]?|сентябр[яь]|октябр[яь]|ноябр[яь]|декабр[яь])/i);
  if (!dateMatch) return '';
  
  const day = dateMatch[1].padStart(2, '0');
  const monthNames = {
    'январь': '01', 'февраль': '02', 'март': '03', 'апрель': '04',
    'май': '05', 'июнь': '06', 'июль': '07', 'август': '08',
    'сентябрь': '09', 'октябрь': '10', 'ноябрь': '11', 'декабрь': '12'
  };
  const month = monthNames[dateMatch[2].toLowerCase()];
  const yearMatch = command.match(/(20\d{2})/);
  const year = yearMatch ? yearMatch[1] : new Date().getFullYear();
  
  return `${year}-${month}-${day}`;
}

/**
 * Добавляет запись из голосового помощника
 * @param {Object} data
 */
function addEntryFromVoice(data) {
  // Заполняем форму
  document.getElementById('cattleId').value = data.cattleId || '';
  document.getElementById('nickname').value = data.nickname || '';
  document.getElementById('inseminationDate').value = data.inseminationDate || '';
  document.getElementById('bull').value = data.bull || '';
  document.getElementById('attemptNumber').value = data.attemptNumber || '';
  document.getElementById('status').value = data.status || '';
  document.getElementById('code').value = data.code || '';
  document.getElementById('inseminator').value = data.inseminator || '';

  // Добавляем как обычную запись
  addEntry();
}

/**
 * Показывает статусное сообщение
 * @param {string} text
 * @param {number} duration
 */
function showStatus(text, duration = 3000) {
  const statusElement = document.getElementById('status');
  if (statusElement) {
    statusElement.textContent = text;
    setTimeout(() => {
      if (statusElement.textContent === text) {
        statusElement.textContent = '';
      }
    }, duration);
  }
}

// Экспорт функций
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    parseVoiceCommand,
    parseDateFromVoice,
    addEntryFromVoice,
    showStatus
  };
}
// === js/core/app.js
// app.js — Основной файл приложения
// Координация работы всех модулей

// Глобальная переменная для записей
// entries уже объявлено в storage.js

// Импортируем getDefaultCowEntry из storage.js, если доступно
if (typeof getDefaultCowEntry === 'undefined' && typeof module !== 'undefined' && module.exports) {
  // В Node.js окружении
} else if (typeof getDefaultCowEntry === 'undefined') {
  // В браузере, если не загружено — пытаемся получить из storage.js
  console.warn('getDefaultCowEntry не найдена. Убедитесь, что storage.js загружен.');
}

/* nowFormatted — в utils/utils.js */

/**
 * Инициализация приложения при загрузке
 */
function initApp() {
  console.log("Инициализация приложения...");
  var useApi = typeof window !== 'undefined' && window.CATTLE_TRACKER_USE_API && typeof window.loadObjectsFromApi === 'function';

  if (useApi) {
    window.loadObjectsFromApi().then(function () {
      return typeof loadLocally === 'function' ? loadLocally() : Promise.resolve();
    }).then(function () {
      if (typeof initInseminationModule === 'function') initInseminationModule();
      if (typeof updateList === 'function') updateList();
      var list = typeof getObjectsList === 'function' ? getObjectsList() : [];
      var currentId = typeof getCurrentObjectId === 'function' ? getCurrentObjectId() : '';
      if (list && list.length > 0 && currentId && !list.some(function (o) { return o.id === currentId; })) {
        if (typeof setCurrentObjectId === 'function') setCurrentObjectId(list[0].id);
        if (typeof loadLocally === 'function') loadLocally().then(function () {
          if (typeof updateObjectSwitcher === 'function') updateObjectSwitcher();
          if (typeof updateHerdStats === 'function') updateHerdStats();
          if (typeof updateViewList === 'function') updateViewList();
        });
      }
      if (typeof updateObjectSwitcher === 'function') updateObjectSwitcher();
      if (typeof updateHerdStats === 'function') updateHerdStats();
      console.log("Приложение инициализировано (API). Записей:", entries.length);
      if (entries.length === 0 && list && list.length === 0 && typeof showToast === 'function') {
        showToast('На сервере нет баз. Подключитесь и выберите «Синхронизация» → импорт в новый объект.', 'info', 8000);
      } else if (entries.length === 0 && list && list.length > 0 && typeof showToast === 'function') {
        showToast('В выбранной базе пока нет записей.', 'info', 4000);
      }
      if (typeof window.updateSyncServerStatusFromHealth === 'function') window.updateSyncServerStatusFromHealth();
    }).catch(function (err) {
      console.error("Ошибка инициализации (API):", err);
      if (typeof updateList === 'function') updateList();
      if (typeof window.updateSyncServerStatusFromHealth === 'function') window.updateSyncServerStatusFromHealth();
      var msg = (err && err.message) ? err.message : '';
      if (msg.indexOf('авторизац') !== -1 || msg.indexOf('401') !== -1) {
        if (typeof showToast === 'function') showToast('Войдите в учётную запись: Настройки → Войти / Пользователи → логин и пароль → Войти (или Регистрация).', 'info', 8000);
        if (typeof navigate === 'function') navigate('auth');
      }
    });
  } else {
    if (typeof loadLocally === 'function') loadLocally();
    else console.error('Функция loadLocally не найдена. Проверьте подключение storage.js');
    if (typeof updateList === 'function') updateList();
    if (typeof updateObjectSwitcher === 'function') updateObjectSwitcher();
    if (typeof updateHerdStats === 'function') updateHerdStats();
    console.log("Приложение инициализировано. Записей:", entries.length);
  }

  if (typeof VoiceAssistant !== 'undefined') {
    new VoiceAssistant();
  }
  if (!useApi && typeof initInseminationModule === 'function') {
    initInseminationModule();
  }

  var versionEl = document.getElementById('app-version');
  var versionHeaderEl = document.getElementById('app-version-header');
  function setVersionText(text) {
    if (versionEl) versionEl.textContent = text;
    if (versionHeaderEl) versionHeaderEl.textContent = text;
  }
  if (versionEl || versionHeaderEl) {
    if (typeof window.electronAPI !== 'undefined' && window.electronAPI.getAppVersion) {
      window.electronAPI.getAppVersion().then(function (v) {
        setVersionText('Версия ' + v);
      });
    } else {
      var fallback = (versionEl && versionEl.getAttribute('data-default-version')) || '1.0.0';
      setVersionText('Версия ' + fallback);
      fetch('package.json').then(function (r) { return r.ok ? r.json() : null; }).then(function (pkg) {
        if (pkg && pkg.version) setVersionText('Версия ' + pkg.version);
      }).catch(function () {});
    }
  }
  }

/**
 * Основная функция для добавления записи (вызывает другие модули)
 */
function addEntry() {
  console.log("Добавление записи...");
  var cattleId = (document.getElementById("cattleId") && document.getElementById("cattleId").value || '').trim();
  if (!cattleId) {
    if (typeof showToast === 'function') showToast('Заполните номер коровы!', 'error'); else alert('Заполните номер коровы!');
    return;
  }
  var entry = getDefaultCowEntry();
  fillCowEntryFromForm(entry);
  if (typeof getCurrentUser === 'function' && getCurrentUser()) {
    entry.userId = getCurrentUser().id;
    entry.lastModifiedBy = getCurrentUser().username;
  }
  var useApi = typeof window !== 'undefined' && window.CATTLE_TRACKER_USE_API && typeof window.createEntryViaApi === 'function';
  if (useApi) {
    window.createEntryViaApi(entry).then(function () {
      updateList();
      if (typeof updateViewList === 'function') updateViewList();
      clearForm();
      console.log("Запись добавлена:", entry);
    }).catch(function (err) {
      if (typeof showToast === 'function') showToast(err && err.message ? err.message : 'Ошибка сохранения на сервере', 'error'); else alert(err && err.message ? err.message : 'Ошибка сохранения на сервере');
    });
    return;
  }
  if (entries.some(function (e) { return e.cattleId === cattleId; })) {
    if (typeof showToast === 'function') showToast('Корова с таким номером уже существует!', 'error'); else alert('Корова с таким номером уже существует!');
    return;
  }
  entries.unshift(entry);
  saveLocally();
  updateList();
  if (typeof updateViewList === 'function') updateViewList();
  clearForm();
  console.log("Запись добавлена:", entry);
}

/**
 * Сохранение текущей записи (редактирование или новая)
 */
function saveCurrentEntry() {
  console.log("Сохранение записи...");
  var cattleId = (document.getElementById('cattleId') && document.getElementById('cattleId').value || '').trim();
  if (!cattleId) {
    if (typeof showToast === 'function') showToast('Заполните номер коровы!', 'error'); else alert('Заполните номер коровы!');
    return;
  }
  if (window.currentEditingId) {
    if (cattleId !== window.currentEditingId && entries.some(function (e) { return e.cattleId === cattleId; })) {
      if (typeof showToast === 'function') showToast('Корова с таким номером уже есть', 'error');
      else alert('Корова с таким номером уже есть');
      return;
    }
  } else {
    if (entries.some(function (e) { return e.cattleId === cattleId; })) {
      if (typeof showToast === 'function') showToast('Корова с таким номером уже есть', 'error');
      else alert('Корова с таким номером уже есть');
      return;
    }
  }
  var entry = getDefaultCowEntry();
  fillCowEntryFromForm(entry);
  if (typeof getCurrentUser === 'function' && getCurrentUser()) {
    entry.userId = getCurrentUser().id;
    entry.lastModifiedBy = getCurrentUser().username;
  }
  var useApi = typeof window !== 'undefined' && window.CATTLE_TRACKER_USE_API && typeof window.updateEntryViaApi === 'function' && typeof window.createEntryViaApi === 'function';
  if (useApi) {
    var p;
    if (window.currentEditingId) {
      entry.dateAdded = (entries.find(function (e) { return e.cattleId === window.currentEditingId; }) || {}).dateAdded || entry.dateAdded;
      entry.synced = (entries.find(function (e) { return e.cattleId === window.currentEditingId; }) || {}).synced || false;
      p = window.updateEntryViaApi(window.currentEditingId, entry);
      delete window.currentEditingId;
    } else {
      entry.dateAdded = nowFormatted();
      entry.synced = false;
      p = window.createEntryViaApi(entry);
    }
    p.then(function () {
      updateList();
      if (typeof updateViewList === 'function') updateViewList();
      clearForm();
      if (typeof navigate === 'function') navigate('view');
      console.log("Запись сохранена:", entry);
    }).catch(function (err) {
      if (typeof showToast === 'function') showToast(err && err.message ? err.message : 'Ошибка сохранения на сервере', 'error'); else alert(err && err.message ? err.message : 'Ошибка сохранения на сервере');
    });
    return;
  }
  if (window.currentEditingId) {
    var index = entries.findIndex(function (e) { return e.cattleId === window.currentEditingId; });
    if (index !== -1) {
      entry.dateAdded = entries[index].dateAdded;
      entry.synced = entries[index].synced;
      entries[index] = entry;
    }
    delete window.currentEditingId;
  } else {
    entry.dateAdded = nowFormatted();
    entry.synced = false;
    entries.unshift(entry);
  }
  saveLocally();
  updateList();
  if (typeof updateViewList === 'function') updateViewList();
  clearForm();
  if (typeof navigate === 'function') navigate('view');
  console.log("Запись сохранена:", entry);
}

function initOfflineIndicator() {
  var el = document.getElementById('offline-indicator');
  if (!el) return;
  var defaultOfflineText = el.textContent || 'Офлайн';
  function setOffline() {
    el.textContent = defaultOfflineText;
    el.hidden = false;
    el.setAttribute('aria-hidden', 'false');
  }
  function setOnline() {
    el.hidden = true;
    el.setAttribute('aria-hidden', 'true');
  }
  function update() {
    var online = typeof navigator !== 'undefined' && navigator.onLine;
    if (online) {
      if (window.CATTLE_TRACKER_USE_API && typeof window.refreshFromServer === 'function') {
        el.textContent = 'Синхронизация…';
        el.hidden = false;
        el.setAttribute('aria-hidden', 'false');
        window.refreshFromServer().then(function () {
          setOnline();
        }).catch(function () {
          setOnline();
        });
      } else {
        setOnline();
      }
    } else {
      setOffline();
    }
  }
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    setOffline();
  } else {
    setOnline();
  }
  window.addEventListener('online', update);
  window.addEventListener('offline', function () { setOffline(); });
}

// Запуск приложения при загрузке
document.addEventListener('DOMContentLoaded', function () {
  initApp();
  initOfflineIndicator();
});

// PWA: регистрация Service Worker (только для http/https; в Electron file:// не регистрируем)
if (typeof navigator !== 'undefined' && navigator.serviceWorker) {
  if (location.protocol === 'file:') {
    navigator.serviceWorker.getRegistrations().then(function (regs) {
      regs.forEach(function (r) { r.unregister(); });
    });
  } else {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('./sw.js').catch(function () {});
    });
  }
}

function handleCheckForUpdates() {
  if (typeof window.electronAPI !== 'undefined' && window.electronAPI.checkForUpdates) {
    window.electronAPI.checkForUpdates().then(function (r) {
      if (r.dev) {
        if (typeof showToast === 'function') showToast('Проверка обновлений работает только в установленной версии приложения', 'info');
        else alert('Проверка обновлений работает только в установленной версии приложения.');
        return;
      }
      if (!r.ok) {
        var msg = r.error ? ('Не удалось проверить обновления: ' + r.error) : 'Не удалось проверить обновления';
        if (typeof showToast === 'function') showToast(msg, 'error');
        else alert(msg);
        return;
      }
      if (r.version) {
        if (typeof showToast === 'function') showToast('Доступна версия ' + r.version + '. Скачивание…', 'info', 5000);
        else alert('Доступна версия ' + r.version + '. Скачивание…');
        return;
      }
      if (typeof showToast === 'function') showToast('Установлена последняя версия', 'success');
      else alert('Установлена последняя версия.');
    });
  } else {
    if (typeof showToast === 'function') showToast('Проверка обновлений доступна в десктопной версии', 'info');
    else alert('Проверка обновлений доступна в десктопной версии приложения.');
  }
}

// Подписка на прогресс и путь загрузки обновления (Electron)
if (typeof window.electronAPI !== 'undefined') {
  if (window.electronAPI.onUpdateDownloadPath && typeof showUpdateProgress === 'function') {
    window.electronAPI.onUpdateDownloadPath(function (downloadPath) {
      showUpdateProgress(0, downloadPath, 0);
    });
  }
  if (window.electronAPI.onUpdateDownloadProgress && typeof showUpdateProgress === 'function') {
    window.electronAPI.onUpdateDownloadProgress(function (data) {
      showUpdateProgress(data.percent, null, data.bytesPerSecond);
    });
  }
}

// Экспорт для других модулей
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    entries,
    nowFormatted,
    addEntry,
    saveCurrentEntry
  };
}
// === js/features/sync.js
/** Адрес сервера по умолчанию берётся из js/config.js (CATTLE_TRACKER_DEFAULT_SERVER_URL). */

/**
 * Синхронизация реализована через сервер API (Настройки → Войти → адрес сервера).
 * Кнопка «Подключиться к серверу» использует адрес из конфига (js/config.js), если задан.
 */

// --- Синхронизация с сервером API ---

/**
 * Подключиться к серверу: взять адрес из конфига (CATTLE_TRACKER_DEFAULT_SERVER_URL),
 * сохранить в localStorage и перезагрузить. Если в конфиге пусто — подсказать ввести адрес в Настройках.
 */
function connectToServer() {
  var url = (typeof window !== 'undefined' && window.CATTLE_TRACKER_DEFAULT_SERVER_URL != null)
    ? String(window.CATTLE_TRACKER_DEFAULT_SERVER_URL).trim().replace(/\/$/, '')
    : '';
  if (!url) {
    if (typeof showToast === 'function') showToast('Задайте адрес сервера в Настройки → Войти или укажите его в js/config.js.', 'info', 6000);
    return;
  }
  try {
    localStorage.setItem('cattleTracker_apiBase', url);
    if (typeof showToast === 'function') showToast('Подключение… Перезагрузка.', 'info');
    location.reload();
  } catch (e) {
    if (typeof showToast === 'function') showToast('Ошибка сохранения', 'error');
  }
}

/**
 * Отключиться от сервера: удалить адрес из localStorage и перезагрузить (режим локальных данных).
 */
function disconnectFromServer() {
  if (typeof showConfirmModal === 'function') {
    showConfirmModal('Отключиться от сервера? Приложение перейдёт на локальные данные и перезагрузится.').then(function (ok) {
      if (!ok) return;
      try {
        localStorage.removeItem('cattleTracker_apiBase');
        if (typeof showToast === 'function') showToast('Отключение… Перезагрузка.', 'info');
        location.reload();
      } catch (e) {
        if (typeof showToast === 'function') showToast('Ошибка', 'error');
      }
    });
    return;
  }
  if (!confirm('Отключиться от сервера? Приложение перейдёт на локальные данные и перезагрузится.')) return;
  try {
    localStorage.removeItem('cattleTracker_apiBase');
    if (typeof showToast === 'function') showToast('Отключение… Перезагрузка.', 'info');
    location.reload();
  } catch (e) {
    if (typeof showToast === 'function') showToast('Ошибка', 'error');
  }
}

/**
 * Обновляет индикатор подключения (лампочка) на экране Синхронизация и в шапке.
 * @param {boolean} connected - true: зелёный, false: красный
 */
function updateConnectionIndicator(connected) {
  var className = connected ? 'connection-indicator--connected' : 'connection-indicator--disconnected';
  var title = connected ? 'Подключено к серверу' : 'Сервер не подключён';
  var ids = ['connection-indicator-sync', 'connection-indicator-sync-connected', 'connection-indicator-global'];
  ids.forEach(function (id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.className = 'connection-indicator ' + className;
    el.setAttribute('aria-label', connected ? 'Подключено к серверу' : 'Сервер не подключён');
    el.title = title;
  });
  }

function updateSyncServerStatus(message, isError) {
  var el = document.getElementById('syncServerStatus');
  if (!el) return;
  el.textContent = message || '';
  el.className = 'sync-server-status' + (isError ? ' sync-server-status-error' : '');
}

/**
 * Обновить данные с сервера (режим API). Вызывается кнопкой «Обновить с сервера» и при событии online.
 */
function refreshFromServer() {
  if (typeof window === 'undefined' || !window.CATTLE_TRACKER_USE_API || !window.CattleTrackerApi || typeof window.loadLocally !== 'function') {
    return Promise.resolve();
  }
  updateSyncServerStatus('Обновление…');
  return window.loadLocally().then(function () {
    updateSyncServerStatus('Подключено к серверу: ' + (window.CattleTrackerApi.getBaseUrl ? window.CattleTrackerApi.getBaseUrl() : ''));
    updateConnectionIndicator(true);
    if (typeof updateList === 'function') updateList();
    if (typeof updateHerdStats === 'function') updateHerdStats();
    if (typeof updateViewList === 'function') updateViewList();
  }).catch(function (err) {
    var msg = (err && err.message) ? err.message : 'Ошибка подключения';
    updateSyncServerStatus('Ошибка: ' + msg, true);
    updateConnectionIndicator(false);
  });
}

/** Флаг: идёт ли синхронизация (чтобы не запускать повторно). */
var isSyncInProgress = false;

/**
 * Синхронизация текущей базы с сервером: отправить последние изменения на сервер (по уникальному cattleId — создать или обновить запись).
 */
function syncCurrentBaseToServer() {
  if (isSyncInProgress) return Promise.resolve();
  if (typeof window === 'undefined' || !window.CATTLE_TRACKER_USE_API || !window.CattleTrackerApi || typeof window.loadLocally !== 'function') {
    return Promise.resolve();
  }
  var objectId = typeof getCurrentObjectId === 'function' ? getCurrentObjectId() : '';
  if (!objectId) return Promise.resolve();
  var localEntries = (typeof window.entries !== 'undefined' && Array.isArray(window.entries)) ? window.entries : [];
  var total = localEntries.length;
  var progressBlock = document.getElementById('syncProgressBlock');
  var progressBar = document.getElementById('syncProgressBar');
  var progressLabel = document.getElementById('syncProgressLabel');
  var progressText = document.getElementById('syncProgressText');
  function setSyncButtonsDisabled(disabled) {
    document.querySelectorAll('.sync-current-base-btn').forEach(function (btn) { btn.disabled = disabled; });
  }
  function showSyncProgress(visible) {
    if (progressBlock) progressBlock.style.display = visible ? 'block' : 'none';
  }
  function setSyncProgress(current, label) {
    if (progressBar) {
      var pct = total ? Math.min(100, Math.round((current / total) * 100)) : 100;
      progressBar.style.width = pct + '%';
      progressBar.setAttribute('aria-valuenow', pct);
    }
    if (progressLabel && label !== undefined) progressLabel.textContent = label || 'Синхронизация…';
    if (progressText) progressText.textContent = current + ' / ' + total;
  }
  isSyncInProgress = true;
  setSyncButtonsDisabled(true);
  showSyncProgress(true);
  setSyncProgress(0, 'Синхронизация с сервером…');
  updateSyncServerStatus('Синхронизация с сервером…');
  function finish() {
    isSyncInProgress = false;
    setSyncButtonsDisabled(false);
    showSyncProgress(false);
  }
  return window.CattleTrackerApi.loadEntries(objectId).then(function (serverEntries) {
    var serverByCattleId = {};
    (serverEntries || []).forEach(function (e) {
      if (e && e.cattleId) serverByCattleId[e.cattleId] = e;
    });
    var index = 0;
    function next() {
      if (index >= localEntries.length) {
        finish();
        return window.loadLocally().then(function () {
          updateSyncServerStatus('Подключено к серверу. Данные синхронизированы.');
          updateConnectionIndicator(true);
          if (typeof updateList === 'function') updateList();
          if (typeof updateHerdStats === 'function') updateHerdStats();
          if (typeof updateViewList === 'function') updateViewList();
        });
      }
      var entry = localEntries[index];
      var cattleId = (entry && entry.cattleId) ? String(entry.cattleId).trim() : '';
      if (!cattleId) { index++; setSyncProgress(index, 'Синхронизация…'); return next(); }
      var isUpdate = !!serverByCattleId[cattleId];
      var p = isUpdate
        ? window.CattleTrackerApi.updateEntry(objectId, cattleId, entry)
        : window.CattleTrackerApi.createEntry(objectId, entry);
      return p.then(function () {
        index++;
        setSyncProgress(index, 'Синхронизация…');
        return next();
      }).catch(function (err) {
        finish();
        updateSyncServerStatus('Ошибка: ' + (err && err.message ? err.message : ''), true);
      });
    }
    return next();
  }).catch(function (err) {
    finish();
    var msg = (err && err.message) ? err.message : 'Ошибка синхронизации';
    updateSyncServerStatus(msg, true);
    updateConnectionIndicator(false);
  });
}

/**
 * Проверка доступности сервера (GET /api/health) и обновление статуса на экране синхронизации.
 */
function updateSyncServerStatusFromHealth() {
  if (typeof window === 'undefined' || !window.CATTLE_TRACKER_USE_API || !window.CattleTrackerApi) {
    updateConnectionIndicator(false);
    return;
  }
  var base = window.CattleTrackerApi.getBaseUrl ? window.CattleTrackerApi.getBaseUrl() : '';
  if (!base) {
    updateConnectionIndicator(false);
    return;
  }
  updateSyncServerStatus('Проверка…');
  fetch(base + '/api/health').then(function (res) {
    if (res.ok) {
      updateSyncServerStatus('Подключено к серверу: ' + base);
      updateConnectionIndicator(true);
    } else {
      updateSyncServerStatus('Ошибка подключения (код ' + res.status + ')', true);
      updateConnectionIndicator(false);
    }
  }).catch(function (err) {
    updateSyncServerStatus('Ошибка: ' + (err && err.message ? err.message : 'нет связи'), true);
    updateConnectionIndicator(false);
  });
}

function formatServerDate(isoStr) {
  if (!isoStr) return '—';
  var d = new Date(isoStr);
  if (isNaN(d.getTime())) return isoStr;
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function renderSyncServerBasesList() {
  var container = document.getElementById('syncServerBasesList');
  if (!container || !window.CATTLE_TRACKER_USE_API || !window.CattleTrackerApi) return;
  container.innerHTML = '<p class="sync-loading">Загрузка списка…</p>';
  window.CattleTrackerApi.getObjectsList().then(function (list) {
    var currentId = typeof getCurrentObjectId === 'function' ? getCurrentObjectId() : '';
    list = list || [];
    var currentOnServer = list.some(function (o) { return o.id === currentId; });
    var html = '<table class="sync-bases-table"><thead><tr><th>Название</th><th>Дата последнего изменения</th><th>Последний пользователь</th><th>Записей</th><th>Действия</th></tr></thead><tbody>';
    list.forEach(function (obj) {
      var name = (obj.name || '').replace(/</g, '&lt;').replace(/"/g, '&quot;');
      var dateRaw = obj.last_updated_at || obj.lastUpdatedAt || obj.created_at;
      var dateStr = formatServerDate(dateRaw);
      var lastUserRaw = obj.last_modified_by != null ? obj.last_modified_by : (obj.lastModifiedBy != null ? obj.lastModifiedBy : null);
      var lastUser = lastUserRaw !== null && lastUserRaw !== '' ? String(lastUserRaw).replace(/</g, '&lt;') : '—';
      var rawCount = obj.entries_count != null ? obj.entries_count : obj.entriesCount;
      var count = (rawCount !== undefined && rawCount !== null && rawCount !== '') ? Number(rawCount) : 0;
      html += '<tr><td>' + name + '</td><td>' + dateStr + '</td><td>' + lastUser + '</td><td>' + count + '</td><td class="sync-bases-actions">';
      if (obj.id === currentId) {
        html += '<button type="button" class="small-btn sync-current-base-btn" onclick="syncCurrentBaseToServer()">Синхронизация</button> ';
      }
      html += '<button type="button" class="small-btn" onclick="showImportNewObjectModal(\'' + String(obj.id).replace(/'/g, "\\'") + '\', \'' + String(obj.name || '').replace(/'/g, "\\'").replace(/"/g, '&quot;') + '\')">Импорт в новый объект</button> ';
      html += '<button type="button" class="small-btn" onclick="showReplaceBaseModal(\'' + String(obj.id).replace(/'/g, "\\'") + '\')">Импорт в существующий</button>';
      html += '</td></tr>';
    });
    if (!currentOnServer && currentId) {
      html += '<tr><td colspan="4">Текущая база не на сервере</td><td class="sync-bases-actions">';
      html += '<button type="button" class="small-btn sync-current-base-btn" onclick="uploadCurrentBaseToServer()">Синхронизация</button>';
      html += '</td></tr>';
    }
    html += '</tbody></table>';
    if (list.length === 0 && !currentId) {
      container.innerHTML = '<p class="sync-empty">На сервере пока нет баз.</p>';
      return;
    }
    if (list.length === 0) {
      html = '<table class="sync-bases-table"><thead><tr><th>Название</th><th>Дата последнего изменения</th><th>Последний пользователь</th><th>Записей</th><th>Действия</th></tr></thead><tbody>';
      html += '<tr><td colspan="4">Текущая база не на сервере</td><td class="sync-bases-actions">';
      html += '<button type="button" class="small-btn sync-current-base-btn" onclick="uploadCurrentBaseToServer()">Синхронизация</button>';
      html += '</td></tr></tbody></table>';
    }
    container.innerHTML = html;
  }).catch(function (err) {
    container.innerHTML = '<p class="sync-server-status-error">Ошибка загрузки списка: ' + (err && err.message ? err.message : '') + '</p>';
  });
}

/**
 * Загрузить текущую базу (записи) на сервер: создать объект и отправить все записи.
 */
function uploadCurrentBaseToServer() {
  if (!window.CATTLE_TRACKER_USE_API || !window.CattleTrackerApi) return;
  var name = prompt('Название базы на сервере:', 'Текущая база');
  if (name === null || !String(name).trim()) return;
  name = String(name).trim();
  var statusEl = document.getElementById('syncServerStatus');
  var list = (typeof window.entries !== 'undefined' && Array.isArray(window.entries)) ? window.entries : [];
  if (statusEl) statusEl.textContent = 'Создание объекта на сервере…';
  window.CattleTrackerApi.createObject(name).then(function (newObj) {
    if (!list.length) {
      if (statusEl) statusEl.textContent = 'Объект «' + name + '» создан на сервере (записей 0).';
      renderSyncServerBasesList();
      if (typeof window.loadObjectsFromApi === 'function') window.loadObjectsFromApi();
      if (typeof window.loadLocally === 'function') window.loadLocally();
      if (typeof window.updateObjectSwitcher === 'function') window.updateObjectSwitcher();
      window.CattleTrackerApi.setCurrentObjectId(newObj.id);
      if (typeof window.loadLocally === 'function') window.loadLocally();
      return;
    }
    var i = 0;
    function next() {
      if (i >= list.length) {
        if (statusEl) statusEl.textContent = 'Готово: база «' + name + '» на сервере, записей ' + list.length + '.';
        renderSyncServerBasesList();
        if (typeof window.loadObjectsFromApi === 'function') window.loadObjectsFromApi();
        window.CattleTrackerApi.setCurrentObjectId(newObj.id);
        if (typeof window.loadLocally === 'function') window.loadLocally();
        if (typeof window.updateObjectSwitcher === 'function') window.updateObjectSwitcher();
        return;
      }
      window.CattleTrackerApi.createEntry(newObj.id, list[i]).then(function () { i++; next(); }).catch(function (err) {
        if (statusEl) { statusEl.textContent = 'Ошибка: ' + (err && err.message ? err.message : ''); statusEl.className = 'sync-server-status sync-server-status-error'; }
      });
    }
    next();
  }).catch(function (err) {
    if (statusEl) { statusEl.textContent = 'Ошибка: ' + (err && err.message ? err.message : ''); statusEl.className = 'sync-server-status sync-server-status-error'; }
  });
}

/**
 * Открыть модальное окно для ввода имени нового объекта при импорте с сервера.
 */
function showImportNewObjectModal(sourceId, sourceName) {
  var modal = document.getElementById('addObjectModal');
  var input = document.getElementById('addObjectNameInput');
  var titleEl = document.getElementById('addObjectModalTitle');
  var okBtn = document.getElementById('addObjectModalOkBtn');
  if (!modal || !input) return;
  modal.setAttribute('data-editing-id', '');
  modal.setAttribute('data-import-source-id', sourceId || '');
  if (titleEl) titleEl.textContent = 'Импорт в новый объект';
  if (okBtn) okBtn.textContent = 'Импортировать';
  input.value = (sourceName && String(sourceName).trim()) ? String(sourceName).trim() + ' (копия)' : 'Копия базы';
  modal.classList.add('active');
  modal.setAttribute('aria-hidden', 'false');
  modal.removeAttribute('hidden');
  setTimeout(function () { if (input) input.focus(); }, 0);
}

/**
 * Импорт базы с сервера в новый объект. name — если передан, не показывать prompt (уже введено в модалке).
 */
function loadServerBaseIntoNewObject(sourceId, name) {
  if (!window.CATTLE_TRACKER_USE_API || !window.CattleTrackerApi) return;
  if (name === undefined || name === null) {
    name = prompt('Название нового объекта:', 'Копия базы');
    if (name === null || !String(name).trim()) return;
  }
  name = String(name).trim();
  var statusEl = document.getElementById('syncServerStatus');
  if (statusEl) statusEl.textContent = 'Создание объекта и копирование записей…';
  window.CattleTrackerApi.createObject(name).then(function (newObj) {
    return window.CattleTrackerApi.loadEntries(sourceId).then(function (entries) {
      if (!entries || !entries.length) {
        if (statusEl) statusEl.textContent = 'Объект «' + name + '» создан (записей 0).';
        renderSyncServerBasesList();
        if (typeof window.loadLocally === 'function') window.loadLocally();
        return;
      }
      var i = 0;
      function next() {
        if (i >= entries.length) {
          if (statusEl) statusEl.textContent = 'Готово: объект «' + name + '», записей ' + entries.length + '.';
          renderSyncServerBasesList();
          if (typeof window.loadLocally === 'function') window.loadLocally();
          if (typeof window.updateObjectSwitcher === 'function') window.updateObjectSwitcher();
          return;
        }
        var entry = entries[i];
        window.CattleTrackerApi.createEntry(newObj.id, entry).then(function () { i++; next(); }).catch(function (err) {
          if (statusEl) statusEl.textContent = 'Ошибка: ' + (err && err.message ? err.message : ''); statusEl.className = 'sync-server-status sync-server-status-error';
        });
      }
      next();
    });
  }).catch(function (err) {
    if (statusEl) { statusEl.textContent = 'Ошибка: ' + (err && err.message ? err.message : ''); statusEl.className = 'sync-server-status sync-server-status-error'; }
  });
}

function showReplaceBaseModal(sourceId) {
  if (!window.CATTLE_TRACKER_USE_API || !window.CattleTrackerApi) return;
  window.CattleTrackerApi.getObjectsList().then(function (list) {
    var targets = list.filter(function (o) { return o.id !== sourceId; });
    if (!targets.length) { if (typeof showToast === 'function') showToast('Нет другого объекта для замены (нужна минимум ещё одна база).', 'info'); return; }
    var overlay = document.createElement('div');
    overlay.className = 'sync-replace-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-label', 'Выбор объекта для замены');
    var nameOpt = (list.filter(function (o) { return o.id === sourceId; })[0] || {}).name || sourceId;
    overlay.innerHTML = '<div class="sync-replace-modal">' +
      '<h4>Заменить данные в существующем объекте</h4>' +
      '<p>Источник: «' + String(nameOpt).replace(/</g, '&lt;') + '». Выберите объект, в котором заменить данные (текущие записи будут удалены):</p>' +
      '<select id="syncReplaceTargetSelect" class="sync-replace-select"></select>' +
      '<div class="sync-replace-actions">' +
      '<button type="button" class="small-btn" data-action="cancel">Отмена</button> ' +
      '<button type="button" class="action-btn" data-action="replace">Заменить</button>' +
      '</div></div>';
    var select = overlay.querySelector('#syncReplaceTargetSelect');
    targets.forEach(function (o) {
      var opt = document.createElement('option');
      opt.value = o.id;
      opt.textContent = o.name || o.id;
      select.appendChild(opt);
    });
    function close() {
      overlay.remove();
      document.body.style.overflow = '';
    }
    overlay.querySelector('[data-action="cancel"]').onclick = close;
    overlay.querySelector('[data-action="replace"]').onclick = function () {
      var targetId = select.value;
      if (!targetId) return;
      (typeof showConfirmModal === 'function' ? showConfirmModal('Заменить все данные в выбранном объекте? Текущие записи будут удалены.') : Promise.resolve(confirm('Заменить все данные в выбранном объекте? Текущие записи будут удалены.'))).then(function (ok) {
        if (!ok) return;
        close();
        replaceServerBaseInObject(sourceId, targetId);
      });
    };
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
    document.body.style.overflow = 'hidden';
    document.body.appendChild(overlay);
  }).catch(function (err) { if (typeof showToast === 'function') showToast('Ошибка: ' + (err && err.message ? err.message : ''), 'error'); else alert('Ошибка: ' + (err && err.message ? err.message : '')); });
}

function replaceServerBaseInObject(sourceId, targetId) {
  if (!window.CATTLE_TRACKER_USE_API || !window.CattleTrackerApi) return;
  var statusEl = document.getElementById('syncServerStatus');
  if (statusEl) statusEl.textContent = 'Загрузка и замена…';
  window.CattleTrackerApi.loadEntries(sourceId).then(function (sourceEntries) {
    return window.CattleTrackerApi.loadEntries(targetId).then(function (targetEntries) {
      var deleteNext = function (idx) {
        if (idx >= targetEntries.length) {
          var addNext = function (i) {
            if (i >= sourceEntries.length) {
              if (statusEl) statusEl.textContent = 'Готово: заменено записей ' + sourceEntries.length + '.';
              renderSyncServerBasesList();
              if (typeof window.loadLocally === 'function') window.loadLocally();
              return;
            }
            window.CattleTrackerApi.createEntry(targetId, sourceEntries[i]).then(function () { addNext(i + 1); }).catch(function (err) {
              if (statusEl) { statusEl.textContent = 'Ошибка: ' + (err && err.message ? err.message : ''); statusEl.className = 'sync-server-status sync-server-status-error'; }
            });
          };
          addNext(0);
          return;
        };
        window.CattleTrackerApi.deleteEntry(targetId, targetEntries[idx].cattleId).then(function () { deleteNext(idx + 1); }).catch(function (err) {
          if (statusEl) { statusEl.textContent = 'Ошибка удаления: ' + (err && err.message ? err.message : ''); statusEl.className = 'sync-server-status sync-server-status-error'; }
        });
      };
      deleteNext(0);
    });
  }).catch(function (err) {
    if (statusEl) { statusEl.textContent = 'Ошибка: ' + (err && err.message ? err.message : ''); statusEl.className = 'sync-server-status sync-server-status-error'; }
  });
}

function initSyncServerBlock() {
  var connectBlock = document.getElementById('sync-connect-block');
  var serverBlock = document.getElementById('sync-server-block');
  var useApi = typeof window !== 'undefined' && window.CATTLE_TRACKER_USE_API && window.CattleTrackerApi;
  if (connectBlock) connectBlock.style.display = useApi ? 'none' : '';
  if (serverBlock) serverBlock.style.display = useApi ? '' : 'none';
  if (useApi) {
    updateSyncServerStatusFromHealth();
    renderSyncServerBasesList();
  } else {
    updateConnectionIndicator(false);
    var serverInput = document.getElementById('serverApiBaseInput');
    if (serverInput) {
      var saved = typeof getSavedServerBase === 'function' ? getSavedServerBase() : '';
      var def = (typeof window !== 'undefined' && window.CATTLE_TRACKER_DEFAULT_SERVER_URL) ? String(window.CATTLE_TRACKER_DEFAULT_SERVER_URL).trim().replace(/\/$/, '') : '';
      serverInput.value = saved || def || '';
    }
  }
}

if (typeof window !== 'undefined') {
  window.connectToServer = connectToServer;
  window.disconnectFromServer = disconnectFromServer;
  window.updateConnectionIndicator = updateConnectionIndicator;
  window.refreshFromServer = refreshFromServer;
  window.syncCurrentBaseToServer = syncCurrentBaseToServer;
  window.updateSyncServerStatusFromHealth = updateSyncServerStatusFromHealth;
  window.initSyncServerBlock = initSyncServerBlock;
  window.renderSyncServerBasesList = renderSyncServerBasesList;
  window.loadServerBaseIntoNewObject = loadServerBaseIntoNewObject;
  window.showReplaceBaseModal = showReplaceBaseModal;
  window.replaceServerBaseInObject = replaceServerBaseInObject;
  window.uploadCurrentBaseToServer = uploadCurrentBaseToServer;
  window.showImportNewObjectModal = showImportNewObjectModal;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSyncServerBlock);
  } else {
    initSyncServerBlock();
  }
}

// === js/features/export-import-parse.js
// export-import-parse.js — нормализация полей и парсинг CSV/Excel для импорта

/**
 * Приводит дату из CSV к формату YYYY-MM-DD для хранения и input type="date"
 */
function normalizeDateForStorage(str) {
  if (str === null || str === undefined) return '';
  var numVal = null;
  if (typeof str === 'number' && !isNaN(str)) numVal = str;
  else if (typeof str === 'string' && /^\d+$/.test(str.trim())) numVal = parseInt(str.trim(), 10);
  if (numVal !== null && typeof XLSX !== 'undefined' && XLSX.SSF && XLSX.SSF.parse_date_code) {
    try {
      var d = XLSX.SSF.parse_date_code(numVal);
      if (d && d.y >= 1900 && d.y <= 2100) {
        var y = d.y, m = (d.m || 1), day = (d.d || 1);
        return y + '-' + String(m).padStart(2, '0') + '-' + String(day).padStart(2, '0');
      }
    } catch (e) { /* игнор */ }
  }
  var s = String(str).trim();
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  var m = s.match(/^(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})$/);
  if (m) return m[3] + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0');
  var mShort = s.match(/^(\d{1,2})[.\/](\d{1,2})[.\/](\d{2})$/);
  if (mShort) {
    var yy = parseInt(mShort[3], 10);
    var fullYear = yy <= 30 ? 2000 + yy : 1900 + yy;
    return fullYear + '-' + mShort[2].padStart(2, '0') + '-' + mShort[1].padStart(2, '0');
  }
  var m2 = s.match(/^(\d{4})[.\/-](\d{1,2})[.\/-](\d{1,2})$/);
  if (m2) return m2[1] + '-' + m2[2].padStart(2, '0') + '-' + m2[3].padStart(2, '0');
  return s;
}

function normalizeStatusFromImport(raw) {
  if (raw === null || raw === undefined) return '';
  var s = String(raw).trim().toLowerCase().replace(/\.$/, '');
  if (!s) return '';
  if (s === 'осем' || s === 'осемененная') return 'Осемененная';
  if (s === 'не стел' || s === 'нестельная') return 'Холостая';
  if (s === 'яловая' || s === 'ял') return 'Холостая';
  if (s === 'ст' || s === 'стел' || s === 'стельная') return 'Стельная';
  return String(raw).trim();
}

function separateCattleIdAndDate(value) {
  if (!value || typeof value !== 'string') return { cattleId: value || '', date: '' };
  const datePatterns = [
    /(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})/,
    /(\d{4})[.\/-](\d{1,2})[.\/-](\d{1,2})/
  ];
  for (const pattern of datePatterns) {
    const match = value.match(pattern);
    if (match) {
      const dateStart = match.index;
      const cattleId = value.substring(0, dateStart).trim();
      let dateStr = match[0];
      if (match[0].includes('-')) {
        const parts = match[0].split(/[.\/-]/);
        if (parts.length === 3) {
          if (parts[0].length === 4) dateStr = parts[2] + '.' + parts[1] + '.' + parts[0];
          else dateStr = parts[0] + '.' + parts[1] + '.' + parts[2];
        }
      } else if (match[0].includes('/')) dateStr = match[0].replace(/\//g, '.');
      if (cattleId && cattleId.length > 0) return { cattleId: cattleId, date: dateStr };
    }
  }
  return { cattleId: value, date: '' };
}

/**
 * Нормализует результат проверки на стельность для uziHistory (Стельная / Не стельная)
 */
function normalizePregnancyCheckResult(raw) {
  if (!raw || typeof raw !== 'string') return '';
  var s = raw.trim().toLowerCase();
  if (!s) return '';
  if (s === 'ст' || s === 'стел' || s === 'стельная' || s === 'стел.' || s === 'да') return 'Стельная';
  if (s === 'не стел' || s === 'нестельная' || s === 'яловая' || s === 'ял' || s === 'нет' || s === 'холостая') return 'Не стельная';
  return raw.trim();
}

/**
 * Возвращает список полей для маппинга при импорте (ключ + подпись). Включает данные из COW_FIELDS и спец. поля УЗИ.
 */
function getImportMappingFields() {
  var skipKeys = { cattleId: 1, pdo: 1, synced: 1, dateAdded: 1, lastModifiedBy: 1, daysPregnant: 1 };
  var list = [];
  if (typeof window.COW_FIELDS !== 'undefined' && window.COW_FIELDS.length > 0) {
    window.COW_FIELDS.forEach(function (f) {
      if (!skipKeys[f.key]) list.push({ key: f.key, label: f.label || f.key });
    });
  } else {
    var defaults = [
      { key: 'nickname', label: 'Кличка' }, { key: 'group', label: 'Группа' }, { key: 'birthDate', label: 'Дата рождения' },
      { key: 'lactation', label: 'Лактация' }, { key: 'calvingDate', label: 'Дата отёла' }, { key: 'inseminationDate', label: 'Дата осеменения' },
      { key: 'attemptNumber', label: 'Номер попытки' }, { key: 'bull', label: 'Бык' }, { key: 'inseminator', label: 'Техник ИО' },
      { key: 'code', label: 'Код' }, { key: 'status', label: 'Статус' }, { key: 'exitDate', label: 'Дата выбытия' },
      { key: 'dryStartDate', label: 'Начало сухостоя' }, { key: 'protocolName', label: 'Протокол' }, { key: 'protocolStartDate', label: 'Начало протокола' },
      { key: 'note', label: 'Примечание' }
    ];
    list = defaults.slice();
  }
  list.push({ key: 'pregnancyCheckResult', label: 'Результат проверки на стельность' });
  list.push({ key: 'pregnancyCheckDate', label: 'Дата проверки на стельность' });
  return list;
}

/**
 * Добавляет days дней к дате YYYY-MM-DD, возвращает YYYY-MM-DD
 */
function addDaysToDate(dateStr, days) {
  if (!dateStr || typeof dateStr !== 'string') return '';
  var d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  d.setDate(d.getDate() + days);
  var y = d.getFullYear(), m = d.getMonth() + 1, day = d.getDate();
  return y + '-' + String(m).padStart(2, '0') + '-' + String(day).padStart(2, '0');
}

function countCyrillic(str) {
  if (!str || typeof str !== 'string') return 0;
  var n = 0;
  for (var i = 0; i < str.length; i++) {
    if (str.charCodeAt(i) >= 0x0400 && str.charCodeAt(i) <= 0x04FF) n++;
  }
  return n;
}

function decodeCsvFileContent(buffer) {
  var bytes = new Uint8Array(buffer);
  if (bytes.length >= 3 && bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
    try { return new TextDecoder('utf-8').decode(buffer); } catch (e) {}
  }
  var utf8 = '';
  try { utf8 = new TextDecoder('utf-8').decode(buffer); } catch (e) { utf8 = ''; }
  if (utf8.indexOf('\uFFFD') !== -1) {
    try { return new TextDecoder('windows-1251').decode(buffer); } catch (e2) { return utf8; }
  }
  try {
    var win1251 = new TextDecoder('windows-1251').decode(buffer);
    if (countCyrillic(win1251) > countCyrillic(utf8)) return win1251;
  } catch (e2) {}
  return utf8;
}

/**
 * Парсит файл (CSV или XLSX) в заголовки (первая строка) и строки данных.
 * @param {File} file
 * @returns {Promise<{ headers: string[], rows: string[][] }>}
 */
function parseFileToHeadersAndRows(file) {
  var name = (file.name || '').toLowerCase();
  if (name.endsWith('.xlsx')) {
    return new Promise(function (resolve, reject) {
      if (typeof XLSX === 'undefined') {
        reject(new Error('Библиотека SheetJS (XLSX) не загружена.'));
        return;
      }
      var reader = new FileReader();
      reader.onload = function (e) {
        try {
          var ab = e.target.result;
          var wb = XLSX.read(ab, { type: 'array', cellDates: false, raw: true });
          var ws = wb.Sheets[wb.SheetNames[0]];
          var rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' });
          if (!rows || rows.length < 2) {
            reject(new Error('В файле нет данных (нужна минимум первая строка заголовков и одна строка данных).'));
            return;
          }
          var cleanStr = function (val) {
            if (val === null || val === undefined) return '';
            if (typeof val === 'number' && isNaN(val)) return '';
            return String(val).trim().replace(/[\x00-\x1F\x7F-\x9F]/g, '');
          };
          var headerRow = rows[0];
          var headers = [];
          var maxCol = Array.isArray(headerRow) ? headerRow.length : 0;
          for (var c = 0; c < maxCol; c++) {
            var h = headerRow[c];
            headers.push(cleanStr(h !== undefined && h !== null ? h : ''));
          }
          var dataRows = [];
          for (var r = 1; r < rows.length; r++) {
            var row = rows[r];
            if (!row || !Array.isArray(row)) continue;
            var cells = [];
            for (var c = 0; c < maxCol; c++) {
              var cell = row[c];
              if (cell === null || cell === undefined) cells.push('');
              else cells.push(cleanStr(cell));
            }
            while (cells.length < maxCol) cells.push('');
            dataRows.push(cells);
          }
          resolve({ headers: headers, rows: dataRows });
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = function () { reject(new Error('Не удалось прочитать файл.')); };
      reader.readAsArrayBuffer(file);
    });
  }
  return new Promise(function (resolve, reject) {
    if (typeof Papa === 'undefined') {
      reject(new Error('Библиотека PapaParse не загружена.'));
      return;
    }
    var reader = new FileReader();
    reader.onload = function () {
      var buffer = reader.result;
      if (!buffer || !(buffer instanceof ArrayBuffer)) {
        reject(new Error('Не удалось прочитать файл'));
        return;
      }
      var csvString = decodeCsvFileContent(buffer);
      Papa.parse(csvString, {
        encoding: 'UTF-8',
        header: false,
        skipEmptyLines: true,
        delimiter: '',
        newline: '',
        quoteChar: '"',
        escapeChar: '"',
        complete: function (results) {
          if (results.errors && results.errors.length > 0) console.warn('Предупреждения при парсинге CSV:', results.errors);
          var data = results.data;
          if (!data || data.length <= 1) {
            reject(new Error('Файл пуст или содержит только заголовки'));
            return;
          }
          var firstLine = data[0];
          var delimiter = ';';
          if (firstLine && firstLine.length > 0) {
            var firstLineStr = Array.isArray(firstLine) ? firstLine.join('') : String(firstLine[0] || '');
            if (firstLineStr.indexOf(';') !== -1) delimiter = ';';
            else if (firstLineStr.indexOf(',') !== -1) delimiter = ',';
          }
          if (data[0].length === 1 && typeof data[0][0] === 'string' && data[0][0].indexOf(delimiter) !== -1) {
            Papa.parse(csvString, {
              encoding: 'UTF-8', header: false, skipEmptyLines: true, delimiter: delimiter, newline: '', quoteChar: '"', escapeChar: '"',
              complete: function (results2) {
                var d = results2.data;
                if (!d || d.length < 2) {
                  reject(new Error('Файл пуст или содержит только заголовки'));
                  return;
                }
                var headers = (d[0] || []).map(function (c) {
                  var s = c === null || c === undefined ? '' : String(c).trim();
                  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) s = s.slice(1, -1);
                  return s.replace(/[\x00-\x1F\x7F-\x9F]/g, '').trim();
                });
                var rows = [];
                for (var i = 1; i < d.length; i++) {
                  var row = (d[i] || []).map(function (c) {
                    if (c === null || c === undefined) return '';
                    var s = String(c).trim();
                    if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) s = s.slice(1, -1);
                    return s.replace(/[\x00-\x1F\x7F-\x9F]/g, '').trim();
                  });
                  rows.push(row);
                }
                resolve({ headers: headers, rows: rows });
              },
              error: function (err) { reject(err || new Error('Ошибка разбора CSV')); }
            });
            return;
          }
          var headers = (data[0] || []).map(function (c) {
            var s = c === null || c === undefined ? '' : String(c).trim();
            if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) s = s.slice(1, -1);
            return s.replace(/[\x00-\x1F\x7F-\x9F]/g, '').trim();
          });
          var rows = [];
          for (var i = 1; i < data.length; i++) {
            var row = (data[i] || []).map(function (c) {
              if (c === null || c === undefined) return '';
              var s = String(c).trim();
              if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) s = s.slice(1, -1);
              return s.replace(/[\x00-\x1F\x7F-\x9F]/g, '').trim();
            });
            rows.push(row);
          }
          resolve({ headers: headers, rows: rows });
        },
        error: function (err) { reject(err || new Error('Ошибка разбора CSV')); }
      });
    };
    reader.onerror = function () { reject(new Error('Ошибка при чтении файла')); };
    reader.readAsArrayBuffer(file);
  });
}

// === js/features/export-import.js
// export-import.js — импорт CSV/Excel/JSON, нормализация полей для импорта

/**
 * Импорт JSON с экрана «Синхронизация» (переиспользует логику резервной копии)
 */
function importData(event) {
  var file = event && event.target && event.target.files && event.target.files[0];
  if (!file) return;
  if (typeof window.importBackupFromFile !== 'function') {
    if (typeof showToast === 'function') showToast('Импорт JSON недоступен. Убедитесь, что загружен модуль резервного копирования.', 'error'); else alert('Импорт JSON недоступен. Убедитесь, что загружен модуль резервного копирования.');
    if (event.target) event.target.value = '';
    return;
  }
  window.importBackupFromFile(file).then(function (r) {
    if (r.ok) {
      if (typeof showToast === 'function') showToast('Импортировано записей: ' + r.count, 'success');
      else alert('Импортировано записей: ' + r.count);
    } else {
      if (typeof showToast === 'function') showToast(r.message || 'Ошибка', 'error');
      else alert(r.message || 'Ошибка');
    }
    if (event.target) event.target.value = '';
  });
}

function handleImportFile(event) {
  var file = event.target.files[0];
  if (!file) return;
  var name = (file.name || '').toLowerCase();
  if (!name.endsWith('.csv') && !name.endsWith('.xlsx')) {
    if (typeof showToast === 'function') showToast('Выберите файл CSV или XLSX.', 'error'); else alert('Выберите файл CSV или XLSX.');
    event.target.value = '';
    return;
  }
  parseFileToHeadersAndRows(file).then(function (parsed) {
    if (!parsed.headers || parsed.headers.length === 0 || !parsed.rows) {
      if (typeof showToast === 'function') showToast('В файле нет заголовков или данных.', 'error'); else alert('В файле нет заголовков или данных.');
      event.target.value = '';
      return;
    }
    openImportMappingModal(parsed.headers, parsed.rows);
    event.target.value = '';
  }).catch(function (err) {
    if (typeof showToast === 'function') showToast('Ошибка: ' + (err && err.message ? err.message : String(err)), 'error'); else alert('Ошибка: ' + (err && err.message ? err.message : String(err)));
    event.target.value = '';
  });
}

/**
 * Импорт с маппингом: группировка по cattleId, слияние профиля, истории осеменений и проверок на стельность.
 * @param {string[][]} rows — строки данных (без заголовка)
 * @param {Object} columnMapping — ключ: индекс столбца (число), значение: ключ поля (cattleId, nickname, inseminationDate, pregnancyCheckResult, ...)
 * @param {string[]} headers — заголовки (для количества столбцов)
 */
function runImportWithMapping(rows, columnMapping, headers) {
  var cleanStr = function (str) {
    if (!str || typeof str !== 'string') return '';
    return str.replace(/[\x00-\x1F\x7F-\x9F]/g, '').trim();
  };
  var getCell = function (row, col) {
    if (col < 0 || col >= row.length) return '';
    var v = row[col];
    return (v === null || v === undefined) ? '' : String(v).trim();
  };

  var dateCols = [], bullCols = [];
  for (var col in columnMapping) {
    if (col === 'cattleIdColumnIndex') continue;
    var idx = parseInt(col, 10);
    if (isNaN(idx)) continue;
    if (columnMapping[col] === 'inseminationDate') dateCols.push(idx);
    if (columnMapping[col] === 'bull') bullCols.push(idx);
  }
  dateCols.sort(function (a, b) { return a - b; });
  bullCols.sort(function (a, b) { return a - b; });

  var rowObjects = [];
  for (var r = 0; r < rows.length; r++) {
    var row = rows[r];
    if (!row || !Array.isArray(row)) continue;
    var cattleIdCol = columnMapping.cattleIdColumnIndex;
    if (cattleIdCol === undefined || cattleIdCol === null) continue;
    var cattleId = cleanStr(getCell(row, cattleIdCol));
    if (!cattleId) continue;
    var obj = { cattleId: cattleId, _rowIndex: r, inseminationPairs: [] };
    for (var col in columnMapping) {
      if (col === 'cattleIdColumnIndex') continue;
          var fieldKey = columnMapping[col];
      if (!fieldKey || fieldKey === '_skip') continue;
      var colIdx = parseInt(col, 10);
      if (isNaN(colIdx)) continue;
      var raw = getCell(row, colIdx);
      if (fieldKey === 'birthDate' || fieldKey === 'calvingDate' || fieldKey === 'inseminationDate' || fieldKey === 'exitDate' || fieldKey === 'dryStartDate' || fieldKey === 'protocolStartDate' || fieldKey === 'pregnancyCheckDate') {
        obj[fieldKey] = normalizeDateForStorage(row[colIdx]);
      } else if (fieldKey === 'pregnancyCheckResult') {
        obj[fieldKey] = normalizePregnancyCheckResult(raw);
      } else if (fieldKey === 'status') {
        obj[fieldKey] = normalizeStatusFromImport(raw);
      } else if (fieldKey === 'lactation') {
        var lactNum = parseInt(raw, 10);
        obj[fieldKey] = (raw === '' || raw === null || raw === undefined) ? '' : (isNaN(lactNum) ? '' : lactNum);
      } else if (fieldKey === 'attemptNumber') {
        obj[fieldKey] = parseInt(raw, 10) || '';
      } else if (fieldKey === 'protocolName') {
        obj[fieldKey] = raw;
      } else {
        obj[fieldKey] = raw;
      }
    }
    for (var pi = 0; pi < dateCols.length || pi < bullCols.length; pi++) {
      var dCol = dateCols[pi], bCol = bullCols[pi];
      var pairDate = dCol !== undefined ? normalizeDateForStorage(getCell(row, dCol)) : '';
      var pairBull = bCol !== undefined ? cleanStr(getCell(row, bCol)) : '';
      if (pairDate || pairBull) {
        obj.inseminationPairs.push({
          date: pairDate,
          attemptNumber: pi + 1,
          bull: pairBull,
          inseminator: cleanStr(obj.inseminator) || '',
          code: cleanStr(obj.code) || ''
        });
      }
    }
    if (obj.inseminationPairs.length > 0) {
      var lastP = obj.inseminationPairs[obj.inseminationPairs.length - 1];
      obj.inseminationDate = lastP.date;
      obj.bull = lastP.bull;
    }
    rowObjects.push(obj);
  }

  var byCattleId = {};
  for (var i = 0; i < rowObjects.length; i++) {
    var o = rowObjects[i];
    var id = o.cattleId;
    if (!byCattleId[id]) byCattleId[id] = [];
    byCattleId[id].push(o);
  }

  var newCount = 0, updateCount = 0, errors = [];
  var profileKeys = ['nickname', 'group', 'birthDate', 'lactation', 'calvingDate', 'status', 'exitDate', 'dryStartDate', 'note', 'protocolName', 'protocolStartDate', 'inseminator', 'code'];

  for (var cattleId in byCattleId) {
    var group = byCattleId[cattleId];
    try {
      var entry = typeof getDefaultCowEntry === 'function' ? getDefaultCowEntry() : {
        cattleId: '', nickname: '', group: '', birthDate: '', lactation: '', calvingDate: '', inseminationDate: '', attemptNumber: '', bull: '', inseminator: '', code: '', status: '', exitDate: '', dryStartDate: '', vwp: 60, note: '', protocol: { name: '', startDate: '' }, dateAdded: typeof nowFormatted === 'function' ? nowFormatted() : '', synced: false, userId: '', lastModifiedBy: '', inseminationHistory: [], actionHistory: [], uziHistory: []
      };
      entry.cattleId = cattleId;
      if (entry.dateAdded === '') entry.dateAdded = typeof nowFormatted === 'function' ? nowFormatted() : '';

      for (var k = 0; k < profileKeys.length; k++) {
        var pk = profileKeys[k];
        for (var g = group.length - 1; g >= 0; g--) {
          var val = group[g][pk];
          var hasVal = val !== undefined && val !== null && (val !== '' || (pk === 'lactation' && val === 0));
          if (hasVal) {
            if (pk === 'protocolName') { entry.protocol = entry.protocol || {}; entry.protocol.name = val; }
            else if (pk === 'protocolStartDate') { entry.protocol = entry.protocol || {}; entry.protocol.startDate = val; }
            else entry[pk] = val;
            break;
          }
        }
      }

      var insemList = [];
      for (var g = 0; g < group.length; g++) {
        var rowObj = group[g];
        if (rowObj.inseminationPairs && rowObj.inseminationPairs.length > 0) {
          for (var ip = 0; ip < rowObj.inseminationPairs.length; ip++) {
            var rec = rowObj.inseminationPairs[ip];
            var nd = rec.date ? normalizeDateForStorage(rec.date) : '';
            if (nd || (rec.bull && cleanStr(rec.bull))) {
              insemList.push({
                date: nd,
                attemptNumber: rec.attemptNumber !== undefined && rec.attemptNumber !== '' ? parseInt(rec.attemptNumber, 10) || 1 : 1,
                bull: cleanStr(rec.bull) || '',
                inseminator: cleanStr(rec.inseminator) || '',
                code: cleanStr(rec.code) || ''
              });
            }
          }
        } else {
          var idate = rowObj.inseminationDate;
          if (idate && normalizeDateForStorage(idate)) {
            insemList.push({
              date: normalizeDateForStorage(idate),
              attemptNumber: rowObj.attemptNumber !== undefined && rowObj.attemptNumber !== '' ? parseInt(rowObj.attemptNumber, 10) || 1 : 1,
              bull: cleanStr(rowObj.bull) || '',
              inseminator: cleanStr(rowObj.inseminator) || '',
              code: cleanStr(rowObj.code) || ''
            });
          }
        }
      }
      insemList.sort(function (a, b) { var da = (a.date || '').toString(), db = (b.date || '').toString(); return da < db ? -1 : da > db ? 1 : 0; });
      var allInsemDates = insemList.map(function (x) { return x.date; });

      for (var g = 0; g < group.length; g++) {
        var rowObj = group[g];
        var pcr = rowObj.pregnancyCheckResult;
        if (!pcr || (pcr !== 'Стельная' && pcr !== 'Не стельная')) continue;
        var checkDate = '';
        if (rowObj.pregnancyCheckDate && normalizeDateForStorage(rowObj.pregnancyCheckDate)) {
          checkDate = normalizeDateForStorage(rowObj.pregnancyCheckDate);
        } else {
          var rowInsemDate = rowObj.inseminationDate ? normalizeDateForStorage(rowObj.inseminationDate) : '';
          var nextInsemAfter = null;
          for (var ii = 0; ii < allInsemDates.length; ii++) {
            if (rowInsemDate && allInsemDates[ii] > rowInsemDate) { nextInsemAfter = allInsemDates[ii]; break; }
          }
          if (nextInsemAfter) checkDate = nextInsemAfter;
          else {
            var lastInsem = allInsemDates.length > 0 ? allInsemDates[allInsemDates.length - 1] : '';
            checkDate = lastInsem ? addDaysToDate(lastInsem, 32) : '';
          }
        }
        if (!checkDate) continue;
        var daysNum = null;
        var lastInsemBefore = null;
        for (var j = allInsemDates.length - 1; j >= 0; j--) {
          if (allInsemDates[j] && String(allInsemDates[j]) < String(checkDate)) { lastInsemBefore = allInsemDates[j]; break; }
        }
        if (lastInsemBefore) {
          var d1 = new Date(lastInsemBefore), d2 = new Date(checkDate);
          if (!isNaN(d1.getTime()) && !isNaN(d2.getTime())) daysNum = Math.round((d2 - d1) / (24 * 60 * 60 * 1000));
        }
        if (!entry.uziHistory) entry.uziHistory = [];
        var duplicate = entry.uziHistory.some(function (u) { return u.date === checkDate && u.result === pcr; });
        if (!duplicate) {
          entry.uziHistory.push({ date: checkDate, result: pcr, specialist: '', daysFromInsemination: daysNum });
        }
      }
      if (entry.uziHistory && entry.uziHistory.length > 0) {
        entry.uziHistory.sort(function (a, b) { var da = (a.date || '').toString(), db = (b.date || '').toString(); return da < db ? -1 : da > db ? 1 : 0; });
        var lastUzi = entry.uziHistory[entry.uziHistory.length - 1];
        if (lastUzi.result === 'Стельная') entry.status = 'Стельная';
        if (lastUzi.result === 'Не стельная') entry.status = 'Холостая';
      }

      entry.inseminationHistory = insemList;
      var lastInsemRec = insemList.length > 0 ? insemList[insemList.length - 1] : null;
      entry.inseminationDate = lastInsemRec ? lastInsemRec.date : '';
      entry.attemptNumber = lastInsemRec ? lastInsemRec.attemptNumber : '';
      entry.bull = lastInsemRec ? lastInsemRec.bull : '';
      entry.inseminator = lastInsemRec ? lastInsemRec.inseminator : '';
      entry.code = lastInsemRec ? lastInsemRec.code : '';
      if (!entry.status && lastInsemRec) entry.status = 'Осеменена';

      var existing = typeof entries !== 'undefined' && entries.find(function (e) { return e.cattleId === cattleId; });
      if (existing) {
        for (var pk2 = 0; pk2 < profileKeys.length; pk2++) {
          var key = profileKeys[pk2];
          if (key === 'protocolName' && entry.protocol && entry.protocol.name) { existing.protocol = existing.protocol || {}; existing.protocol.name = entry.protocol.name; }
          else if (key === 'protocolStartDate' && entry.protocol && entry.protocol.startDate) { existing.protocol = existing.protocol || {}; existing.protocol.startDate = entry.protocol.startDate; }
          else if (entry[key]) existing[key] = entry[key];
        }
        var existingInsem = existing.inseminationHistory || [];
        var mergedInsem = existingInsem.slice();
        var seen = {};
        existingInsem.forEach(function (h) { seen[(h.date || '') + '-' + (h.bull || '')] = true; });
        insemList.forEach(function (h) {
          var k = (h.date || '') + '-' + (h.bull || '');
          if (!seen[k]) { mergedInsem.push(h); seen[k] = true; }
        });
        mergedInsem.sort(function (a, b) { var da = (a.date || '').toString(), db = (b.date || '').toString(); return da < db ? -1 : da > db ? 1 : 0; });
        existing.inseminationHistory = mergedInsem;
        var lastM = mergedInsem.length > 0 ? mergedInsem[mergedInsem.length - 1] : null;
        existing.inseminationDate = lastM ? lastM.date : (existing.inseminationDate || '');
        existing.attemptNumber = lastM ? lastM.attemptNumber : (existing.attemptNumber || '');
        existing.bull = lastM ? lastM.bull : (existing.bull || '');
        existing.inseminator = lastM ? lastM.inseminator : (existing.inseminator || '');
        existing.code = lastM ? lastM.code : (existing.code || '');
        var existingUzi = existing.uziHistory || [];
        entry.uziHistory.forEach(function (u) {
          var dup = existingUzi.some(function (eu) { return eu.date === u.date && eu.result === u.result; });
          if (!dup) existingUzi.push(u);
        });
        existing.uziHistory = existingUzi.sort(function (a, b) { var da = (a.date || '').toString(), db = (b.date || '').toString(); return da < db ? -1 : da > db ? 1 : 0; });
        if (entry.status) existing.status = entry.status;
        updateCount++;
      } else {
        entries.unshift(entry);
        newCount++;
      }
    } catch (err) {
      errors.push('Животное ' + cattleId + ': ' + (err.message || String(err)));
    }
  }

  if (newCount > 0 || updateCount > 0) {
    saveLocally();
    if (typeof updateList === 'function') updateList();
    if (typeof updateViewList === 'function') updateViewList();
    var msg = 'Импортировано: ' + newCount + ' новых, обновлено: ' + updateCount;
    if (errors.length > 0) msg += '. Ошибок: ' + errors.length;
    if (typeof showToast === 'function') showToast(msg, 'success');
    else alert(msg);
    if (errors.length > 0) console.warn('Ошибки импорта:', errors);
  } else {
    var msgErr = 'Нет данных для импорта или все строки пропущены.';
    if (errors.length > 0) msgErr += ' Ошибки: ' + errors.slice(0, 3).join('; ');
    if (typeof showToast === 'function') showToast(msgErr, 'error');
    else alert(msgErr);
  }
}

/**
 * Открывает модальное окно маппинга столбцов импорта и по кнопке «Импортировать» запускает runImportWithMapping.
 */
function openImportMappingModal(headers, rows) {
  var modal = document.getElementById('importMappingModal');
  if (!modal) return;
  var cattleSelect = document.getElementById('importMappingCattleColumn');
  var mappingList = document.getElementById('importMappingFieldsList');
  var importBtn = document.getElementById('importMappingImportBtn');
  var closeBtn = document.getElementById('importMappingCloseBtn');
  var closeBtn2 = document.getElementById('importMappingCloseBtn2');
  if (!cattleSelect || !mappingList || !importBtn) return;

  modal._importHeaders = headers;
  modal._importRows = rows;

  function closeImportMappingModal() {
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
  }

  cattleSelect.innerHTML = '';
  var opt0 = document.createElement('option');
  opt0.value = '';
  opt0.textContent = '— Выберите столбец с номером животного —';
  cattleSelect.appendChild(opt0);
  for (var i = 0; i < headers.length; i++) {
    var opt = document.createElement('option');
    opt.value = i;
    opt.textContent = (headers[i] || 'Столбец ' + (i + 1));
    cattleSelect.appendChild(opt);
  }

  mappingList.innerHTML = '';
  var mappingFields = getImportMappingFields();
  for (var i = 0; i < headers.length; i++) {
    var row = document.createElement('div');
    row.className = 'import-mapping-row';
    row.dataset.columnIndex = String(i);
    var label = document.createElement('label');
    label.className = 'import-mapping-col-label';
    label.textContent = (headers[i] || 'Столбец ' + (i + 1));
    var select = document.createElement('select');
    select.className = 'import-mapping-field-select';
    select.dataset.columnIndex = String(i);
    var optSkip = document.createElement('option');
    optSkip.value = '_skip';
    optSkip.textContent = 'Не импортировать';
    select.appendChild(optSkip);
    for (var f = 0; f < mappingFields.length; f++) {
      var o = document.createElement('option');
      o.value = mappingFields[f].key;
      o.textContent = mappingFields[f].label;
      select.appendChild(o);
    }
    row.appendChild(label);
    row.appendChild(select);
    mappingList.appendChild(row);
  }

  function updateCattleColumnVisibility() {
    var cattleCol = cattleSelect.value;
    var rows = mappingList.querySelectorAll('.import-mapping-row');
    for (var r = 0; r < rows.length; r++) {
      var rw = rows[r];
      rw.style.display = (rw.dataset.columnIndex === cattleCol) ? 'none' : '';
    }
  }
  if (!cattleSelect.dataset.visibilityBound) {
    cattleSelect.dataset.visibilityBound = '1';
    cattleSelect.addEventListener('change', updateCattleColumnVisibility);
  }
  updateCattleColumnVisibility();

  function buildColumnMapping() {
    var cattleCol = cattleSelect.value;
    if (cattleCol === '' || cattleCol === null) return null;
    var mapping = { cattleIdColumnIndex: parseInt(cattleCol, 10) };
    var selects = mappingList.querySelectorAll('.import-mapping-field-select');
    for (var s = 0; s < selects.length; s++) {
      var sel = selects[s];
      var colIdx = parseInt(sel.dataset.columnIndex, 10);
      if (colIdx === mapping.cattleIdColumnIndex) continue;
      var val = sel.value;
      if (val && val !== '_skip') mapping[colIdx] = val;
    }
    return mapping;
  }

  if (importBtn && !importBtn.dataset.bound) {
    importBtn.dataset.bound = '1';
    importBtn.addEventListener('click', function () {
      var currentRows = modal._importRows;
      var currentHeaders = modal._importHeaders;
      if (!currentRows || !currentHeaders) {
        alert('Нет данных для импорта. Выберите файл заново.');
        return;
      }
      var cattleCol = cattleSelect.value;
      if (cattleCol === '' || cattleCol === null) {
        alert('Сначала выберите столбец с номером животного.');
        return;
      }
      var mapping = buildColumnMapping();
      if (!mapping) return;
      runImportWithMapping(currentRows, mapping, currentHeaders);
      closeImportMappingModal();
    });
  }

  if (closeBtn && !closeBtn.dataset.bound) {
    closeBtn.dataset.bound = '1';
    closeBtn.addEventListener('click', closeImportMappingModal);
  }
  if (closeBtn2 && !closeBtn2.dataset.bound) {
    closeBtn2.dataset.bound = '1';
    closeBtn2.addEventListener('click', closeImportMappingModal);
  }

  if (!modal.dataset.overlayBound) {
    modal.dataset.overlayBound = '1';
    modal.addEventListener('click', function (e) {
      if (e.target === modal) closeImportMappingModal();
    });
  }

  modal.classList.add('active');
  modal.setAttribute('aria-hidden', 'false');
  if (cattleSelect) cattleSelect.focus();
}

function importFromCSV(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (typeof Papa === 'undefined') {
    if (typeof showToast === 'function') showToast('Библиотека PapaParse не загружена.', 'error'); else alert('❌ Библиотека PapaParse не загружена.');
    event.target.value = '';
    return;
  }
  var reader = new FileReader();
  reader.onload = function () {
    var buffer = reader.result;
    if (!buffer || !(buffer instanceof ArrayBuffer)) {
      if (typeof showToast === 'function') showToast('Не удалось прочитать файл', 'error'); else alert('❌ Не удалось прочитать файл');
      event.target.value = '';
      return;
    }
    var csvString = decodeCsvFileContent(buffer);
    Papa.parse(csvString, {
      encoding: 'UTF-8', header: false, skipEmptyLines: true, delimiter: '', newline: '', quoteChar: '"', escapeChar: '"',
      complete: function (results) {
        if (results.errors && results.errors.length > 0) console.warn('Предупреждения при парсинге CSV:', results.errors);
        var data = results.data;
        if (!data || data.length <= 1) { alert('❌ Файл пуст или содержит только заголовки'); event.target.value = ''; return; }
        var firstLine = data[0];
        var delimiter = ';';
        if (firstLine && firstLine.length > 0) {
          var firstLineStr = Array.isArray(firstLine) ? firstLine.join('') : String(firstLine[0] || '');
          if (firstLineStr.indexOf(';') !== -1) delimiter = ';';
          else if (firstLineStr.indexOf(',') !== -1) delimiter = ',';
        }
        if (data[0].length === 1 && typeof data[0][0] === 'string' && data[0][0].indexOf(delimiter) !== -1) {
          Papa.parse(csvString, {
            encoding: 'UTF-8', header: false, skipEmptyLines: true, delimiter: delimiter, newline: '', quoteChar: '"', escapeChar: '"',
            complete: function (results2) { processImportData(results2.data, delimiter, event); },
            error: function (error) { if (typeof showToast === 'function') showToast('Ошибка при разборе файла: ' + (error && error.message ? error.message : ''), 'error'); else alert('❌ Ошибка при разборе файла: ' + (error && error.message ? error.message : '')); event.target.value = ''; }
          });
          return;
        }
        processImportData(data, delimiter, event);
      },
      error: function (error) { if (typeof showToast === 'function') showToast('Ошибка при разборе файла: ' + (error && error.message ? error.message : ''), 'error'); else alert('❌ Ошибка при разборе файла: ' + (error && error.message ? error.message : '')); event.target.value = ''; }
    });
  };
  reader.onerror = function () { if (typeof showToast === 'function') showToast('Ошибка при чтении файла', 'error'); else alert('❌ Ошибка при чтении файла'); event.target.value = ''; };
  reader.readAsArrayBuffer(file);
}
function importFromExcelWide(event) {
  var file = event.target.files[0];
  if (!file) return;
  if (typeof XLSX === 'undefined') {
    if (typeof showToast === 'function') showToast('Библиотека SheetJS (XLSX) не загружена.', 'error'); else alert('❌ Библиотека SheetJS (XLSX) не загружена.');
    event.target.value = '';
    return;
  }
  var reader = new FileReader();
  reader.onload = function (e) {
    try {
      var ab = e.target.result;
      var wb = XLSX.read(ab, { type: 'array', cellDates: false, raw: true });
      var ws = wb.Sheets[wb.SheetNames[0]];
      var rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' });
      if (!rows || rows.length < 2) {
        if (typeof showToast === 'function') showToast('В файле нет данных.', 'error'); else alert('❌ В файле нет данных.');
        event.target.value = '';
        return;
      }
      var newCount = 0, updateCount = 0, skipped = 0;
      var cleanStr = function (val) {
        if (val === null || val === undefined) return '';
        if (typeof val === 'number' && isNaN(val)) return '';
        return String(val).trim().replace(/[\x00-\x1F\x7F-\x9F]/g, '').trim();
      };
      var getCell = function (row, col) { var v = row[col]; return (v === null || v === undefined) ? '' : v; };
      for (var i = 1; i < rows.length; i++) {
        var row = rows[i];
        if (!row || !Array.isArray(row)) continue;
        var cattleId = cleanStr(getCell(row, 0));
        if (!cattleId) { skipped++; continue; }
        var lactation = cleanStr(getCell(row, 1)), nickname = cleanStr(getCell(row, 2));
        var birthDate = normalizeDateForStorage(getCell(row, 3)), calvingDate = normalizeDateForStorage(getCell(row, 4));
        var status = normalizeStatusFromImport(cleanStr(getCell(row, 19)));
        var history = [];
        for (var attempt = 1; attempt <= 7; attempt++) {
          var dateCol = 4 + (attempt - 1) * 2 + 1, bullCol = dateCol + 1;
          var dateStr = normalizeDateForStorage(getCell(row, dateCol)), bullVal = cleanStr(getCell(row, bullCol));
          if (dateStr || bullVal) history.push({ date: dateStr || '', attemptNumber: attempt, bull: bullVal || '', inseminator: '', code: '' });
        }
        history.sort(function (a, b) { var da = (a.date || '').toString(), db = (b.date || '').toString(); return da < db ? -1 : da > db ? 1 : 0; });
        var lastInsem = history.length > 0 ? history[history.length - 1] : null;
        var existing = entries.find(function (e) { return e.cattleId === cattleId; });
        if (existing) {
          existing.lactation = lactation || existing.lactation;
          existing.nickname = nickname || existing.nickname;
          existing.birthDate = birthDate || existing.birthDate;
          existing.calvingDate = calvingDate || existing.calvingDate;
          existing.status = status || existing.status;
          existing.inseminationHistory = history;
          existing.inseminationDate = lastInsem ? lastInsem.date : (existing.inseminationDate || '');
          existing.attemptNumber = lastInsem ? lastInsem.attemptNumber : (existing.attemptNumber || 1);
          existing.bull = lastInsem ? lastInsem.bull : (existing.bull || '');
          updateCount++;
        } else {
          var entry = typeof getDefaultCowEntry === 'function' ? getDefaultCowEntry() : { cattleId: '', nickname: '', birthDate: '', lactation: '', calvingDate: '', inseminationDate: '', attemptNumber: 1, bull: '', inseminator: '', code: '', status: '', exitDate: '', dryStartDate: '', vwp: 60, note: '', protocol: { name: '', startDate: '' }, dateAdded: typeof nowFormatted === 'function' ? nowFormatted() : '', synced: false, userId: '', lastModifiedBy: '', inseminationHistory: [] };
          entry.cattleId = cattleId; entry.lactation = lactation; entry.nickname = nickname; entry.birthDate = birthDate; entry.calvingDate = calvingDate; entry.status = status; entry.inseminationHistory = history; entry.inseminationDate = lastInsem ? lastInsem.date : ''; entry.attemptNumber = lastInsem ? lastInsem.attemptNumber : 1; entry.bull = lastInsem ? lastInsem.bull : '';
          if (entry.dateAdded === '') entry.dateAdded = typeof nowFormatted === 'function' ? nowFormatted() : '';
          entries.unshift(entry);
          newCount++;
        }
      }
      if (newCount > 0 || updateCount > 0) {
        saveLocally();
        if (typeof updateList === 'function') updateList();
        if (typeof updateViewList === 'function') updateViewList();
        var msg = '✅ Импорт таблицы осеменений: добавлено ' + newCount + ', обновлено ' + updateCount;
        if (skipped > 0) msg += ', пропущено строк: ' + skipped;
        alert(msg);
      } else {
        alert('⚠️ Нет данных для импорта.');
      }
    } catch (err) {
      console.error(err);
      alert('❌ Ошибка при чтении Excel: ' + (err.message || String(err)));
    }
    event.target.value = '';
  };
  reader.onerror = function () { alert('❌ Не удалось прочитать файл.'); event.target.value = ''; };
  reader.readAsArrayBuffer(file);
}
function processImportData(data, delimiter, event) {
  if (!data || data.length <= 1) { alert('❌ Файл пуст или содержит только заголовки'); event.target.value = ''; return; }
  const dataLines = data.slice(1);
  let duplicates = 0, newEntries = 0, skipped = 0, errors = [], fixedCount = 0;
  for (let i = 0; i < dataLines.length; i++) {
    const row = dataLines[i];
    if (!row || row.length === 0) { skipped++; continue; }
    const cleanRow = row.map(cell => {
      if (cell === null || cell === undefined) return '';
      let cleaned = String(cell).trim();
      if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || (cleaned.startsWith("'") && cleaned.endsWith("'"))) cleaned = cleaned.slice(1, -1);
      return cleaned;
    });
    if (cleanRow.length < 1 || !cleanRow[0] || cleanRow[0].trim() === '') { skipped++; continue; }
    try {
      const cleanString = (str) => { if (!str || typeof str !== 'string') return ''; return str.replace(/[\x00-\x1F\x7F-\x9F]/g, '').trim(); };
      let cattleIdRaw = cleanString(cleanRow[0]), separated = separateCattleIdAndDate(cattleIdRaw);
      if (separated.date && separated.cattleId !== cattleIdRaw) {
        fixedCount++;
        var insemCol = cleanRow.length >= 19 ? 6 : 5;
        if ((!cleanRow[insemCol] || cleanRow[insemCol].trim() === '') && separated.date) cleanRow[insemCol] = separated.date;
      }
      var hasGroupColumn = cleanRow.length >= 19;
      var idx = function (oldIdx, newIdx) { return hasGroupColumn ? cleanRow[newIdx] : cleanRow[oldIdx]; };
      var birthDateRaw = cleanString(hasGroupColumn ? cleanRow[3] : cleanRow[2]), calvingDateRaw = cleanString(hasGroupColumn ? cleanRow[5] : cleanRow[4]), inseminationDateRaw = cleanString(hasGroupColumn ? cleanRow[6] : cleanRow[5]), protocolStartRaw = cleanString(hasGroupColumn ? cleanRow[13] : cleanRow[12]), exitDateRaw = cleanString(hasGroupColumn ? cleanRow[14] : cleanRow[13]), dryStartRaw = cleanString(hasGroupColumn ? cleanRow[15] : cleanRow[14]);
      const newEntry = {
        cattleId: separated.cattleId || '', nickname: cleanString(cleanRow[1]) || '', group: hasGroupColumn ? cleanString(cleanRow[2]) || '' : '',
        birthDate: normalizeDateForStorage(birthDateRaw), lactation: (idx(3, 4) && String(idx(3, 4)).trim() !== '') ? (parseInt(idx(3, 4), 10) || '') : '', calvingDate: normalizeDateForStorage(calvingDateRaw), inseminationDate: normalizeDateForStorage(inseminationDateRaw), attemptNumber: parseInt(idx(6, 7)) || 1, bull: cleanString(idx(7, 8)) || '', inseminator: cleanString(idx(8, 9)) || '', code: cleanString(idx(9, 10)) || '', status: normalizeStatusFromImport(cleanString(idx(10, 11))), protocol: { name: cleanString(idx(11, 12)) || '', startDate: normalizeDateForStorage(protocolStartRaw) }, exitDate: normalizeDateForStorage(exitDateRaw), dryStartDate: normalizeDateForStorage(dryStartRaw), vwp: parseInt(idx(15, 16)) || 60, note: cleanString(idx(16, 17)) || '', synced: (hasGroupColumn ? cleanRow[18] : cleanRow[17]) === 'Да' || (hasGroupColumn ? cleanRow[18] : cleanRow[17]) === 'да' || (hasGroupColumn ? cleanRow[18] : cleanRow[17]) === '1', dateAdded: nowFormatted(), userId: '', lastModifiedBy: '', inseminationHistory: []
      };
      if (!newEntry.cattleId || newEntry.cattleId.length === 0) { skipped++; continue; }
      const existingEntry = entries.find(e => e.cattleId === newEntry.cattleId);
      if (existingEntry) {
        let updated = false;
        for (const key in newEntry) {
          if (key === 'dateAdded' || key === 'synced') continue;
          if (typeof newEntry[key] === 'object' && newEntry[key] !== null) {
            if (!existingEntry[key]) existingEntry[key] = {};
            for (const subKey in newEntry[key]) { if (newEntry[key][subKey]) { existingEntry[key][subKey] = newEntry[key][subKey]; updated = true; } }
          } else if (newEntry[key] && newEntry[key] !== '') { existingEntry[key] = newEntry[key]; updated = true; }
        }
        if (updated) duplicates++; else skipped++;
      } else { entries.unshift(newEntry); newEntries++; }
    } catch (error) { errors.push('Строка ' + (i + 2) + ': ' + error.message); skipped++; }
  }
  let message = '';
  if (newEntries > 0 || duplicates > 0) {
    saveLocally(); updateList();
    if (typeof updateViewList === 'function') updateViewList();
    message = '✅ Импортировано: ' + newEntries + ' новых, обновлено: ' + duplicates + ' существующих';
    if (fixedCount > 0) message += '\n🔧 Автоматически исправлено записей с объединенными данными: ' + fixedCount;
    if (skipped > 0) message += ', пропущено: ' + skipped;
    if (errors.length > 0) { message += '\n⚠️ Ошибок: ' + errors.length; console.warn('Ошибки импорта:', errors); }
  } else {
    message = '⚠️ Файл содержит ' + dataLines.length + ' строк данных, но новых: 0, обновлено: 0, пропущено: ' + skipped;
    if (errors.length > 0) message += '\n\nОшибки:\n' + errors.slice(0, 5).join('\n');
  }
  alert(message);
  event.target.value = '';
}

// === js/features/export-excel.js
// export-excel.js — экспорт в Excel/CSV, шаблон для импорта, диалог настройки экспорта

/** Порядок колонок CSV (для шаблона и экспорта). Разделитель — точка с запятой. */
var CSV_HEADERS = [
  'Номер', 'Кличка', 'Группа', 'Дата рождения', 'Лактация', 'Дата отёла', 'Дата осеменения',
  'Номер попытки', 'Бык', 'Техник ИО', 'Код', 'Статус', 'Протокол', 'Начало протокола',
  'Дата выбытия', 'Начало сухостоя', 'ПДО', 'Примечание', 'Синхронизировано'
];
var CSV_DELIMITER = ';';

var EXPORT_FIELD_TEMPLATES_KEY = 'cattleTracker_export_fieldTemplates';

function getExportFieldTemplates() {
  try {
    var raw = localStorage.getItem(EXPORT_FIELD_TEMPLATES_KEY);
    if (raw) {
      var list = JSON.parse(raw);
      if (Array.isArray(list)) return list;
    }
  } catch (e) {}
  return [];
}

function saveExportFieldTemplates(list) {
  try {
    localStorage.setItem(EXPORT_FIELD_TEMPLATES_KEY, JSON.stringify(list || []));
  } catch (e) {}
}

function getDefaultExportFieldKeys() {
  if (typeof window.COW_FIELDS !== 'undefined' && window.COW_FIELDS.length > 0) {
    return window.COW_FIELDS.map(function (f) { return f.key; });
  }
  return ['cattleId', 'nickname', 'group', 'birthDate', 'lactation', 'calvingDate', 'inseminationDate', 'attemptNumber', 'bull', 'inseminator', 'code', 'status', 'protocolName', 'protocolStartDate', 'exitDate', 'dryStartDate', 'pdo', 'note', 'synced'];
}

function formatDateForExport(dateStr) {
  if (!dateStr) return '';
  return String(dateStr).trim();
}

function escapeCsvCell(val) {
  var s = val === null || val === undefined ? '' : String(val);
  if (s.indexOf(CSV_DELIMITER) !== -1 || s.indexOf('"') !== -1 || s.indexOf('\n') !== -1 || s.indexOf('\r') !== -1) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function getPDOForExport(entry) {
  if (typeof getPDO === 'function') return getPDO(entry);
  return entry.vwp !== undefined ? String(entry.vwp) : '';
}

/**
 * Строит книгу Excel и скачивает файл.
 */
function buildAndDownloadExcel(fieldKeys, includeInseminations, includeTasks, tasksFrom, tasksTo) {
  if (typeof entries === 'undefined' || !Array.isArray(entries) || entries.length === 0) {
    if (typeof showToast === 'function') showToast('Нет данных для экспорта', 'error'); else alert('Нет данных для экспорта.');
    return;
  }
  var dateStr = new Date().toISOString().slice(0, 10);
  var fields = [];
  var byKey = {};
  if (typeof window.COW_FIELDS !== 'undefined' && window.COW_FIELDS.length > 0) {
    window.COW_FIELDS.forEach(function (f) { byKey[f.key] = f; });
    fieldKeys.forEach(function (k) {
      if (byKey[k]) fields.push(byKey[k]);
    });
  }
  if (fields.length === 0) {
    fields = [{ key: 'cattleId', label: 'Корова', exportRender: function (e) { return e ? String(e.cattleId) : ''; } }];
    fieldKeys.forEach(function (k) {
      if (k !== 'cattleId' && byKey[k]) fields.push(byKey[k]);
    });
  }

  if (typeof XLSX === 'undefined') {
    var BOM = '\uFEFF';
    var headers = fields.map(function (f) { return f.label || f.key; });
    var lines = [headers.join(CSV_DELIMITER)];
    for (var i = 0; i < entries.length; i++) {
      var e = entries[i];
      var row = fields.map(function (f) {
        var fn = f.exportRender || f.render;
        var v = fn ? fn(e) : (e[f.key] != null ? String(e[f.key]) : '');
        return escapeCsvCell(v);
      });
      lines.push(row.join(CSV_DELIMITER));
    }
    var csv = BOM + lines.join('\r\n');
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'коровы_' + dateStr + '.csv';
    a.click();
    URL.revokeObjectURL(url);
    return;
  }

  var cowHeaders = [fields.map(function (f) { return f.label || f.key; })];
  var cowRows = [];
  for (var i = 0; i < entries.length; i++) {
    var e = entries[i];
    cowRows.push(fields.map(function (f) {
      var fn = f.exportRender || f.render;
      return fn ? fn(e) : (e[f.key] != null ? String(e[f.key]) : '');
    }));
  }
  var wsCows = XLSX.utils.aoa_to_sheet(cowHeaders.concat(cowRows));
  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsCows, 'Коровы');

  if (includeInseminations && typeof getAllInseminationsFlat === 'function') {
    var insemHeaders = [['Номер коровы', 'Кличка', 'Лактация', 'Дата осеменения', 'Попытка', 'Бык', 'Техник ИО', 'Дней от предыдущего', 'Код']];
    var flat = getAllInseminationsFlat();
    var insemRows = flat.map(function (r) {
      return [
        r.cattleId || '', r.nickname || '',
        (r.lactation !== undefined && r.lactation !== null && r.lactation !== '') || r.lactation === 0 ? String(r.lactation) : '',
        formatDateForExport(r.date),
        r.attemptNumber !== undefined ? String(r.attemptNumber) : '',
        r.bull || '', r.inseminator || '',
        r.daysFromPrevious !== undefined && r.daysFromPrevious !== '—' ? String(r.daysFromPrevious) : '',
        r.code || ''
      ];
    });
    var wsInsem = XLSX.utils.aoa_to_sheet(insemHeaders.concat(insemRows));
    XLSX.utils.book_append_sheet(wb, wsInsem, 'Осеменения');
  }

  if (includeTasks && typeof window.getProtocolTasks === 'function') {
    var tasks = window.getProtocolTasks(tasksFrom, tasksTo);
    var taskHeaders = [['Дата', 'Номер коровы', 'Группа', 'Препарат/задача', 'Протокол']];
    var taskRows = tasks.map(function (t) {
      return [t.date || '', t.cattleId || '', t.group || '', t.drug || '', t.protocolName || ''];
    });
    var wsTasks = XLSX.utils.aoa_to_sheet(taskHeaders.concat(taskRows));
    XLSX.utils.book_append_sheet(wb, wsTasks, 'Список задач');
  }

  XLSX.writeFile(wb, 'коровы_' + dateStr + '.xlsx');
}

function renderExportDialog() {
  var listEl = document.getElementById('exportFieldsList');
  var templatesEl = document.getElementById('exportTemplatesList');
  if (!listEl) return;
  var fields = typeof window.COW_FIELDS !== 'undefined' && window.COW_FIELDS.length > 0
    ? window.COW_FIELDS
    : getDefaultExportFieldKeys().map(function (k) { return { key: k, label: k }; });
  var savedKeys = [];
  try {
    var raw = localStorage.getItem('cattleTracker_export_selectedFields');
    if (raw) {
      var arr = JSON.parse(raw);
      if (Array.isArray(arr) && arr.length > 0) savedKeys = arr;
    }
  } catch (e) {}
  if (savedKeys.length === 0) savedKeys = getDefaultExportFieldKeys();
  var keySet = {};
  savedKeys.forEach(function (k) { keySet[k] = true; });
  var html = fields.map(function (field) {
    var key = field.key;
    var label = field.label || key;
    var checked = keySet[key] !== false;
    return '<label class="view-fields-item">' +
      '<input type="checkbox" class="export-field-checkbox" value="' + String(key).replace(/"/g, '&quot;') + '"' + (checked ? ' checked' : '') + ' />' +
      '<span>' + String(label).replace(/</g, '&lt;') + '</span></label>';
  }).join('');
  listEl.innerHTML = html;

  if (templatesEl) {
    var templates = getExportFieldTemplates();
    templatesEl.innerHTML = templates.length === 0
      ? '<p class="view-fields-templates-empty">Нет сохранённых шаблонов</p>'
      : templates.map(function (t, idx) {
          var name = (t.name || '').replace(/</g, '&lt;').replace(/"/g, '&quot;');
          return '<div class="view-fields-template-item">' +
            '<span class="view-fields-template-name">' + name + '</span>' +
            ' <button type="button" class="small-btn export-template-apply" data-export-template-index="' + idx + '">Применить</button>' +
            '</div>';
        }).join('');
  }

  var includeTasksCb = document.getElementById('exportIncludeTasks');
  var periodRow = document.getElementById('exportTasksPeriodRow');
  if (includeTasksCb && periodRow) {
    periodRow.style.display = includeTasksCb.checked ? '' : 'none';
    includeTasksCb.addEventListener('change', function () {
      periodRow.style.display = includeTasksCb.checked ? '' : 'none';
    });
  }
  var today = new Date();
  var weekEnd = new Date(today);
  weekEnd.setDate(weekEnd.getDate() + 7);
  function pad(n) { return n < 10 ? '0' + n : String(n); }
  var fromInput = document.getElementById('exportTasksDateFrom');
  var toInput = document.getElementById('exportTasksDateTo');
  if (fromInput) fromInput.value = today.getFullYear() + '-' + pad(today.getMonth() + 1) + '-' + pad(today.getDate());
  if (toInput) toInput.value = weekEnd.getFullYear() + '-' + pad(weekEnd.getMonth() + 1) + '-' + pad(weekEnd.getDate());
}

function openExportDialog() {
  var modal = document.getElementById('exportSettingsModal');
  if (!modal) return;
  renderExportDialog();
  modal.classList.add('active');
  modal.setAttribute('aria-hidden', 'false');
  var firstFocus = document.querySelector('#exportSettingsModal .export-field-checkbox, #exportSettingsModal .small-btn');
  if (firstFocus) firstFocus.focus();

  var closeBtn = document.getElementById('exportSettingsCloseBtn');
  var cancelBtn = document.getElementById('exportSettingsCancelBtn');
  var exportBtn = document.getElementById('exportSettingsExportBtn');
  function closeExportDialog() {
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
  }
  if (closeBtn && !closeBtn.dataset.bound) {
    closeBtn.dataset.bound = '1';
    closeBtn.addEventListener('click', closeExportDialog);
  }
  if (cancelBtn && !cancelBtn.dataset.bound) {
    cancelBtn.dataset.bound = '1';
    cancelBtn.addEventListener('click', closeExportDialog);
  }
  modal.addEventListener('click', function (ev) {
    if (ev.target === modal) closeExportDialog();
    var applyBtn = ev.target.closest('.export-template-apply');
    if (applyBtn && applyBtn.dataset.exportTemplateIndex !== undefined) {
      var idx = parseInt(applyBtn.dataset.exportTemplateIndex, 10);
      var templates = getExportFieldTemplates();
      if (templates[idx] && templates[idx].fieldKeys && templates[idx].fieldKeys.length > 0) {
        var keys = templates[idx].fieldKeys;
        modal.querySelectorAll('.export-field-checkbox').forEach(function (cb) {
          cb.checked = keys.indexOf(cb.value) !== -1;
        });
        renderExportDialog();
      }
      ev.preventDefault();
    }
  });

  var selectAllBtn = document.getElementById('exportSelectAllBtn');
  var resetBtn = document.getElementById('exportResetBtn');
  if (selectAllBtn) {
    selectAllBtn.addEventListener('click', function () {
      modal.querySelectorAll('.export-field-checkbox').forEach(function (cb) { cb.checked = true; });
    });
  }
  if (resetBtn) {
    resetBtn.addEventListener('click', function () {
      getDefaultExportFieldKeys().forEach(function (k) {
        var cb = modal.querySelector('.export-field-checkbox[value="' + k.replace(/"/g, '&quot;') + '"]');
        if (cb) cb.checked = true;
      });
      modal.querySelectorAll('.export-field-checkbox').forEach(function (cb) {
        if (getDefaultExportFieldKeys().indexOf(cb.value) === -1) cb.checked = false;
      });
    });
  }

  var saveTemplateBtn = document.getElementById('exportSaveTemplateBtn');
  var templateNameInput = document.getElementById('exportTemplateNameInput');
  if (saveTemplateBtn && templateNameInput) {
    saveTemplateBtn.addEventListener('click', function () {
      var name = (templateNameInput.value || '').trim();
      if (!name) {
        if (typeof showToast === 'function') showToast('Введите название шаблона.', 'error'); else alert('Введите название шаблона.');
        return;
      }
      var checked = Array.prototype.slice.call(modal.querySelectorAll('.export-field-checkbox:checked')).map(function (el) { return el.value; });
      if (checked.length === 0) {
        if (typeof showToast === 'function') showToast('Выберите хотя бы одно поле.', 'error'); else alert('Выберите хотя бы одно поле.');
        return;
      }
      var list = getExportFieldTemplates();
      list.push({ name: name, fieldKeys: checked });
      saveExportFieldTemplates(list);
      templateNameInput.value = '';
      renderExportDialog();
    });
  }

  if (exportBtn && !exportBtn.dataset.bound) {
    exportBtn.dataset.bound = '1';
    exportBtn.addEventListener('click', function () {
      var checked = Array.prototype.slice.call(modal.querySelectorAll('.export-field-checkbox:checked')).map(function (el) { return el.value; });
      if (checked.length === 0) {
        if (typeof showToast === 'function') showToast('Выберите хотя бы одно поле для листа «Коровы».', 'error'); else alert('Выберите хотя бы одно поле для листа «Коровы».');
        return;
      }
      try {
        localStorage.setItem('cattleTracker_export_selectedFields', JSON.stringify(checked));
      } catch (e) {}
      var includeInsem = document.getElementById('exportIncludeInseminations');
      var includeTasks = document.getElementById('exportIncludeTasks');
      var tasksFrom = document.getElementById('exportTasksDateFrom');
      var tasksTo = document.getElementById('exportTasksDateTo');
      buildAndDownloadExcel(
        checked,
        includeInsem ? includeInsem.checked : true,
        includeTasks ? includeTasks.checked : false,
        tasksFrom ? tasksFrom.value : undefined,
        tasksTo ? tasksTo.value : undefined
      );
      closeExportDialog();
      if (typeof showToast === 'function') showToast('Экспорт выполнен', 'success');
    });
  }
}

function exportToExcel() {
  openExportDialog();
}

function downloadTemplate() {
  var BOM = '\uFEFF';
  var line = CSV_HEADERS.join(CSV_DELIMITER);
  var csv = BOM + line + '\r\n';
  var blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'шаблон_импорта_коров.csv';
  a.click();
  URL.revokeObjectURL(url);
}

// === js/features/insemination.js
/**
 * Модуль для работы с осеменением
 * Функции: автоматический расчёт попытки, добавление данных осеменения
 */

// Глобальная переменная для хранения записей (предполагается, что она уже объявлена)
// let entries = []; // Удалено: уже объявлено в storage.js

/**
 * Возвращает номер попытки осеменения для коровы в текущей лактации
 * @param {string} cattleId - номер коровы
 * @param {number} currentLactation - текущая лактация
 * @returns {number} - следующий номер попытки
 */
function getInseminationAttempt(cattleId, currentLactation) {
  if (!Array.isArray(entries)) {
    return 1;
  }

  const attemptsInLactation = entries
    .filter(entry => 
      entry.cattleId === cattleId && 
      entry.lactation === currentLactation && 
      entry.inseminationDate
    )
    .sort((a, b) => new Date(a.inseminationDate) - new Date(b.inseminationDate));

  return attemptsInLactation.length + 1;
}

/**
 * Автоматически заполняет номер попытки при выборе номера коровы и даты осеменения
 */
function autoFillAttempt() {
  const cattleId = document.getElementById('cattleId')?.value.trim();
  const lactation = parseInt(document.getElementById('lactation')?.value) || 1;
  const inseminationDate = document.getElementById('inseminationDate')?.value;

  if (cattleId && inseminationDate) {
    const attempt = getInseminationAttempt(cattleId, lactation);
    document.getElementById('attemptNumber').value = attempt;
  }
}

// Добавляем слушатели для автоматического заполнения попытки на основном экране
if (document.getElementById('cattleId') && document.getElementById('inseminationDate')) {
  document.getElementById('cattleId').addEventListener('change', autoFillAttempt);
  document.getElementById('inseminationDate').addEventListener('change', autoFillAttempt);
}

/**
 * Заполняет список коров для автодополнения
 */
function populateCattleAutocomplete(inputId, listId) {
  const input = document.getElementById(inputId);
  const list = document.getElementById(listId);
  if (!input || !list) return;

  // Очищаем список
  list.innerHTML = '';

  const filter = input.value.toLowerCase();
  const matchingEntries = entries.filter(entry => 
    entry.cattleId.toLowerCase().includes(filter) || 
    (entry.nickname && entry.nickname.toLowerCase().includes(filter))
  ).slice(0, 10); // Ограничиваем 10 результатами

  matchingEntries.forEach(entry => {
    const li = document.createElement('li');
    li.textContent = `${entry.cattleId} (${entry.nickname || '—'})`;
    li.dataset.value = entry.cattleId;
    li.addEventListener('click', () => {
      input.value = entry.cattleId;
      list.innerHTML = '';
      // Синхронизируем со скрытым селектором
      const select = document.getElementById('cattleIdInsem');
      if (select) {
        select.value = entry.cattleId;
      }
      // Вызываем авто-заполнение попытки напрямую
      autoFillInseminationAttempt();
    });
    list.appendChild(li);
  });
}

/**
 * Инициализирует автодополнение для ввода номера коровы
 */
function initCattleAutocomplete() {
  const input = document.getElementById('cattleIdInsemInput');
  if (!input) return;

  // Обновляем список при вводе
  input.addEventListener('input', () => {
    populateCattleAutocomplete('cattleIdInsemInput', 'cattleIdInsemList');
  });

  // Скрываем список при клике вне поля
  document.addEventListener('click', (e) => {
    const list = document.getElementById('cattleIdInsemList');
    if (list && input !== e.target && !list.contains(e.target)) {
      list.innerHTML = '';
    }
  });
}

// Заменяем populateCattleSelect на использование автодополнения
function populateCattleSelect() {
  // Теперь используем автодополнение, оставляем для обратной совместимости
  initCattleAutocomplete();
}

/**
 * Автоматически заполняет номер попытки на экране ввода осеменения
 */
function autoFillInseminationAttempt() {
  // Пробуем получить ID из обоих полей (input и select)
  const cattleIdInput = document.getElementById('cattleIdInsemInput');
  const cattleIdSelect = document.getElementById('cattleIdInsem');
  const cattleId = (cattleIdInput?.value.trim() || cattleIdSelect?.value.trim()) || '';
  const inseminationDate = document.getElementById('inseminationDateInsem')?.value;

  if (cattleId && inseminationDate) {
    // Получаем текущую лактацию коровы
    const entry = entries.find(e => e.cattleId === cattleId);
    const lactation = entry?.lactation || 1;
    
    const attempt = getInseminationAttempt(cattleId, lactation);
    const attemptField = document.getElementById('attemptNumberInsem');
    if (attemptField) {
      attemptField.value = attempt;
    }
  }
}

/**
 * Инициализирует слушатели событий для автоматического заполнения попытки
 * Вызывается при открытии экрана осеменения
 */
function initInseminationAttemptListeners() {
  const cattleIdInput = document.getElementById('cattleIdInsemInput');
  const cattleIdSelect = document.getElementById('cattleIdInsem');
  const inseminationDateField = document.getElementById('inseminationDateInsem');
  
  // Удаляем старые слушатели, если они есть
  if (cattleIdInput) {
    cattleIdInput.removeEventListener('input', autoFillInseminationAttempt);
    cattleIdInput.removeEventListener('change', autoFillInseminationAttempt);
    cattleIdInput.addEventListener('input', autoFillInseminationAttempt);
    cattleIdInput.addEventListener('change', autoFillInseminationAttempt);
  }
  
  if (cattleIdSelect) {
    cattleIdSelect.removeEventListener('change', autoFillInseminationAttempt);
    cattleIdSelect.addEventListener('change', autoFillInseminationAttempt);
  }
  
  if (inseminationDateField) {
    inseminationDateField.removeEventListener('change', autoFillInseminationAttempt);
    inseminationDateField.addEventListener('change', autoFillInseminationAttempt);
  }
}

// Инициализация слушателей при загрузке (если элементы уже есть)
if (document.getElementById('cattleIdInsemInput') || document.getElementById('cattleIdInsem')) {
  initInseminationAttemptListeners();
}

/**
 * Добавляет запись осеменения для существующей коровы
 */
function addInseminationEntry() {
  // Пробуем получить ID из обоих полей (для совместимости)
  const cattleIdInput = document.getElementById('cattleIdInsemInput');
  const cattleIdSelect = document.getElementById('cattleIdInsem');
  const cattleId = (cattleIdInput?.value.trim() || cattleIdSelect?.value.trim()) || '';
  const inseminationDate = document.getElementById('inseminationDateInsem')?.value;

  if (!cattleId) {
    if (typeof showToast === 'function') showToast('Заполните номер коровы!', 'error'); else alert('Заполните номер коровы!');
    return;
  }

  // Ищем корову в списке записей
  const entry = entries.find(e => e.cattleId === cattleId);
  
  if (!entry) {
    if (typeof showToast === 'function') showToast('Корова с таким номером не найдена!', 'error'); else alert('Корова с таким номером не найдена!');
    return;
  }

  if (inseminationDate && typeof validateDateNotFuture === 'function') {
    var err = validateDateNotFuture(inseminationDate, 'Дата осеменения');
    if (err) {
      if (typeof showToast === 'function') showToast(err && err.message ? err.message : err, 'error'); else alert(err);
      return;
    }
  }

  const attemptNumber = parseInt(document.getElementById('attemptNumberInsem')?.value) || 1;
  const bull = document.getElementById('bullInsem')?.value || '';
  const inseminator = document.getElementById('inseminatorInsem')?.value || '';
  const code = document.getElementById('codeInsem')?.value || '';

  // Добавляем в историю осеменений
  if (!entry.inseminationHistory) entry.inseminationHistory = [];
  entry.inseminationHistory.push({
    date: inseminationDate,
    attemptNumber: attemptNumber,
    bull: bull,
    inseminator: inseminator,
    code: code
  });

  // Заполняем основные поля осеменения (последнее осеменение)
  entry.inseminationDate = inseminationDate;
  entry.attemptNumber = attemptNumber;
  entry.bull = bull;
  entry.inseminator = inseminator;
  entry.code = code;
  entry.status = 'Осеменена';

  // Сохраняем изменения
  try {
    saveLocally();
  } catch (error) {
    console.error('Ошибка сохранения:', error);
  }
  
  try {
    updateList(); // Обновляем список на экране добавления
  } catch (error) {
    console.error('Ошибка обновления списка:', error);
  }
  
  if (typeof updateViewList === 'function') {
    try {
      updateViewList(); // Обновляем список на экране просмотра
    } catch (error) {
      console.error('Ошибка обновления списка просмотра:', error);
    }
  }

  // Очищаем форму
  if (cattleIdInput) cattleIdInput.value = '';
  if (cattleIdSelect) cattleIdSelect.value = '';
  document.getElementById('inseminationDateInsem').value = '';
  document.getElementById('attemptNumberInsem').value = '1';
  document.getElementById('bullInsem').value = '';
  document.getElementById('inseminatorInsem').value = '';
  document.getElementById('codeInsem').value = '';

  if (typeof showToast === 'function') showToast('Данные осеменения добавлены!', 'success'); else alert('Данные осеменения добавлены!');
}

/**
 * Инициализация модуля осеменения
 */
function initInseminationModule() {
  // Проверяем, находимся ли мы на экране добавления
  if (document.getElementById('add-screen')?.classList.contains('active')) {
    autoFillAttempt();
  }
  
  // Проверяем, находимся ли мы на экране ввода осеменения
  const inseminationScreen = document.getElementById('insemination-screen');
  if (inseminationScreen?.classList.contains('active')) {
    initCattleAutocomplete();
    initInseminationAttemptListeners(); // Инициализируем слушатели
    autoFillInseminationAttempt(); // Пробуем заполнить сразу, если поля уже заполнены
  }
}

// Инициализация при загрузке и при навигации
document.addEventListener('DOMContentLoaded', initInseminationModule);
document.addEventListener('click', (e) => {
  // Если клик был по кнопке навигации, подождем и инициализируем
  setTimeout(initInseminationModule, 100);
});

// Дополнительная инициализация при показе экрана осеменения
document.addEventListener('click', (e) => {
  const target = e.target;
  if (
    target.matches('[onclick*="navigate(\'insemination\'"]') ||
    target.closest('[onclick*="navigate(\'insemination\'"]')
  ) {
    setTimeout(() => {
      populateCattleSelect();
      initInseminationAttemptListeners(); // Инициализируем слушатели при открытии экрана
      autoFillInseminationAttempt();
    }, 150);
  }
});

// Экспортируем функции, если используется модульная система
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getInseminationAttempt, addInseminationEntry };
}
// === js/features/view-cow.js
// view-cow.js — Логика просмотра карточки животного

/**
 * Экранирование HTML для безопасного вывода в карточке
 */
function escapeHtmlCard(text) {
  if (text === undefined || text === null) return '—';
  var s = String(text);
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * ПДО — дней от отёла до первой даты осеменения
 * @param {Object} entry — запись животного
 * @returns {number|string} — количество дней или '—'
 */
function getPDO(entry) {
  if (!entry) return '—';
  var calvingDate = entry.calvingDate;
  if (!calvingDate) return '—';
  var firstInsemDate = null;
  if (entry.inseminationHistory && entry.inseminationHistory.length > 0) {
    var dates = entry.inseminationHistory.map(function (h) { return h.date; }).filter(Boolean);
    if (dates.length > 0) {
      firstInsemDate = dates.reduce(function (a, b) { return a < b ? a : b; });
    }
  }
  if (!firstInsemDate && entry.inseminationDate) firstInsemDate = entry.inseminationDate;
  if (!firstInsemDate) return '—';
  var d1 = new Date(calvingDate);
  var d2 = new Date(firstInsemDate);
  if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return '—';
  var diff = Math.round((d2 - d1) / (24 * 60 * 60 * 1000));
  return diff >= 0 ? diff : '—';
}

/**
 * Дни стельности: от последнего осеменения до сегодня (только при статусе «Стельная»).
 * @param {Object} entry — запись животного
 * @returns {number|null} — количество дней или null
 */
function getDaysPregnant(entry) {
  if (!entry) return null;
  var status = (entry.status || '').toString();
  if (status.indexOf('Стельная') === -1) return null;
  var lastInsemDate = null;
  if (entry.inseminationHistory && entry.inseminationHistory.length > 0) {
    var dates = entry.inseminationHistory.map(function (h) { return h.date; }).filter(Boolean);
    if (dates.length > 0) {
      lastInsemDate = dates.reduce(function (a, b) { return a > b ? a : b; });
    }
  }
  if (!lastInsemDate && entry.inseminationDate) lastInsemDate = entry.inseminationDate;
  if (!lastInsemDate) return null;
  var d = new Date(lastInsemDate);
  var today = new Date();
  if (isNaN(d.getTime())) return null;
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  var diff = Math.round((today - d) / (24 * 60 * 60 * 1000));
  return diff >= 0 ? diff : null;
}

/**
 * Парсит строку даты в timestamp (мс) для расчёта интервалов. Поддерживает YYYY-MM-DD, DD.MM.YYYY, DD.MM.YY.
 * @param {string} dateStr
 * @returns {number} timestamp или NaN
 */
function parseInseminationDateToTime(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return NaN;
  var s = dateStr.trim();
  if (!s) return NaN;
  var d = new Date(s);
  if (!isNaN(d.getTime())) return d.getTime();
  var dmY = s.match(/^(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})$/);
  if (dmY) {
    d = new Date(parseInt(dmY[3], 10), parseInt(dmY[2], 10) - 1, parseInt(dmY[1], 10));
    return isNaN(d.getTime()) ? NaN : d.getTime();
  }
  var dmYy = s.match(/^(\d{1,2})[.\/](\d{1,2})[.\/](\d{2})$/);
  if (dmYy) {
    var yy = parseInt(dmYy[3], 10);
    var year = yy <= 30 ? 2000 + yy : 1900 + yy;
    d = new Date(year, parseInt(dmYy[2], 10) - 1, parseInt(dmYy[1], 10));
    return isNaN(d.getTime()) ? NaN : d.getTime();
  }
  return NaN;
}

/**
 * Определяет номер лактации для осеменения.
 * Если у животного задана лактация (0, 1, 2, …) — возвращаем её. Иначе: по дате отёла до/после = 1 или 2.
 */
function getInseminationLactation(insemDate, calvingDate, entryLactation) {
  var lact = entryLactation !== undefined && entryLactation !== null && entryLactation !== '' ? parseInt(entryLactation, 10) : null;
  if (lact !== null && !isNaN(lact) && lact >= 0) return lact;
  if (!calvingDate || !insemDate) return 1;
  var tInsem = parseInseminationDateToTime(insemDate);
  var tCalv = parseInseminationDateToTime(calvingDate);
  if (isNaN(tInsem) || isNaN(tCalv)) return 1;
  return tInsem < tCalv ? 1 : 2;
}

/**
 * Строит список осеменений для одной записи (отсортированный по дате), с полем daysFromPrevious и lactation.
 * Интервал «дней от предыдущего» считается только внутри одной лактации.
 */
function getInseminationListForEntry(entry) {
  var list = [];
  if (entry.inseminationHistory && entry.inseminationHistory.length > 0) {
    list = entry.inseminationHistory.slice();
  } else if (entry.inseminationDate) {
    list = [{
      date: entry.inseminationDate,
      attemptNumber: entry.attemptNumber ?? 1,
      bull: entry.bull || '',
      inseminator: entry.inseminator || '',
      code: entry.code || ''
    }];
  }
  list.sort(function (a, b) {
    var ta = parseInseminationDateToTime(a.date);
    var tb = parseInseminationDateToTime(b.date);
    if (isNaN(ta) && isNaN(tb)) return 0;
    if (isNaN(ta)) return 1;
    if (isNaN(tb)) return -1;
    return ta < tb ? -1 : ta > tb ? 1 : 0;
  });
  var calvingDate = entry.calvingDate || '';
  for (var i = 0; i < list.length; i++) {
    list[i].lactation = getInseminationLactation(list[i].date, calvingDate, entry.lactation);
    if (i === 0) {
      list[i].daysFromPrevious = '—';
    } else {
      if (list[i].lactation !== list[i - 1].lactation) {
        list[i].daysFromPrevious = '—';
      } else {
        var prevTime = parseInseminationDateToTime(list[i - 1].date);
        var currTime = parseInseminationDateToTime(list[i].date);
        if (!isNaN(prevTime) && !isNaN(currTime)) {
          list[i].daysFromPrevious = Math.round((currTime - prevTime) / (24 * 60 * 60 * 1000));
        } else {
          list[i].daysFromPrevious = '—';
        }
      }
    }
  }
  return list;
}

/**
 * Просмотр полной карточки животного
 */
function viewCow(cattleId) {
  const entry = entries.find(e => e.cattleId === cattleId);
  if (!entry) {
    console.warn('Животное не найдено:', cattleId);
    return;
  }

  // Перейти на экран просмотра карточки (с cattleId для роутинга)
  navigate('view-cow', { cattleId: cattleId });

  // Заполнить карточку
  const card = document.getElementById('viewCowCard');
  if (!card) return;

  var pdoVal = getPDO(entry);
  var pdoStr = (pdoVal === '—' || pdoVal === '') ? '—' : String(pdoVal);
  var daysPreg = getDaysPregnant(entry);
  var daysPregStr = (daysPreg === null || daysPreg === undefined) ? '—' : String(daysPreg);

  var insemList = getInseminationListForEntry(entry);
  var historyRows = insemList.map(function (row) {
    return (
      '<tr><td>' + (formatDate(row.date) || '—') + '</td><td>' + escapeHtmlCard(row.attemptNumber) + '</td><td>' + escapeHtmlCard(row.bull) + '</td><td>' + escapeHtmlCard(row.inseminator) + '</td><td>' + (row.daysFromPrevious !== undefined ? escapeHtmlCard(row.daysFromPrevious) : '—') + '</td><td>' + escapeHtmlCard(row.code) + '</td></tr>'
    );
  }).join('');
  var historyTableHtml = insemList.length > 0
    ? '<table class="cow-insemination-table"><thead><tr><th>Дата осеменения</th><th>Попытка</th><th>Бык</th><th>Техник ИО</th><th>Дней от предыдущего</th><th>Код</th></tr></thead><tbody>' + historyRows + '</tbody></table>'
    : '<p class="cow-insemination-empty">Нет данных об осеменениях.</p>';

  var rawId = (entry.cattleId || '');
  var safeCattleId = rawId.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;');

  card.innerHTML =
    '<div class="cow-card">' +
    '<h2>Карточка животного №' + escapeHtmlCard(entry.cattleId) + '</h2>' +
    '<div class="cow-details-grid">' +
    '<div><strong>Кличка:</strong> ' + escapeHtmlCard(entry.nickname) + '</div>' +
    '<div><strong>Группа:</strong> ' + escapeHtmlCard(entry.group || '') + '</div>' +
    '<div><strong>Дата рождения:</strong> ' + (formatDate(entry.birthDate) || '—') + '</div>' +
    '<div><strong>Лактация:</strong> ' + escapeHtmlCard(entry.lactation) + '</div>' +
    '<div><strong>Дата отёла:</strong> ' + (formatDate(entry.calvingDate) || '—') + '</div>' +
    '<div><strong>Дата осеменения:</strong> ' + (formatDate(entry.inseminationDate) || '—') + '</div>' +
    '<div class="cow-details-cell-with-button"><strong>Номер попытки:</strong> ' + escapeHtmlCard(entry.attemptNumber) + ' <button type="button" class="small-btn cow-insemination-toggle" onclick="toggleViewCowInseminationHistory()">Все осеменения</button></div>' +
    '<div><strong>Бык:</strong> ' + escapeHtmlCard(entry.bull) + '</div>' +
    '<div><strong>Техник ИО:</strong> ' + escapeHtmlCard(entry.inseminator) + '</div>' +
    '<div><strong>Код:</strong> ' + escapeHtmlCard(entry.code) + '</div>' +
    '<div><strong>Статус:</strong> ' + escapeHtmlCard(entry.status) + '</div>' +
    '<div><strong>Дата выбытия:</strong> ' + (formatDate(entry.exitDate) || '—') + '</div>' +
    '<div><strong>Начало сухостоя:</strong> ' + (formatDate(entry.dryStartDate) || '—') + '</div>' +
    '<div><strong>ПДО (дней от отёла до 1-го осеменения):</strong> ' + pdoStr + '</div>' +
    '<div><strong>Дни стельности:</strong> ' + daysPregStr + '</div>' +
    '<div><strong>Протокол:</strong> ' + escapeHtmlCard((entry.protocol && entry.protocol.name) || entry.protocolName) + '</div>' +
    '<div><strong>Начало протокола:</strong> ' + (formatDate((entry.protocol && entry.protocol.startDate) || entry.protocolStartDate) || '—') + '</div>' +
    '<div><strong>Примечание:</strong> ' + escapeHtmlCard(entry.note) + '</div>' +
    '<div><strong>Синхронизация:</strong> ' + (entry.synced ? '✅' : '🟡') + '</div>' +
    '<div><strong>Дата добавления:</strong> ' + escapeHtmlCard(entry.dateAdded) + '</div>' +
    '<div><strong>Изменено пользователем:</strong> ' + escapeHtmlCard(entry.lastModifiedBy) + '</div>' +
    '</div>' +
    '<div id="viewCowInseminationHistory" class="cow-insemination-history" style="display:none;">' + historyTableHtml + '</div>' +
    '<div class="cow-card-actions">' +
    '<button type="button" onclick="editEntry(\'' + safeCattleId + '\');" class="small-btn" aria-label="Редактировать">✏️ Редактировать</button> ' +
    '<button type="button" onclick="window._prefillCattleId=\'' + safeCattleId + '\'; navigate(\'dry\');" class="small-btn" aria-label="Запуск в сухостой">🐄 Запуск</button> ' +
    '<button type="button" onclick="window._prefillCattleId=\'' + safeCattleId + '\'; navigate(\'calving\');" class="small-btn" aria-label="Отел">🐄 Отел</button> ' +
    '<button type="button" onclick="window._prefillCattleId=\'' + safeCattleId + '\'; navigate(\'protocol-assign\');" class="small-btn" aria-label="Поставить на протокол">📋 Поставить на протокол</button> ' +
    '<button type="button" onclick="window._prefillCattleId=\'' + safeCattleId + '\'; navigate(\'uzi\');" class="small-btn" aria-label="УЗИ">🩺 УЗИ</button> ' +
    '<button type="button" onclick="openViewCowActionHistory(\'' + safeCattleId + '\');" class="small-btn" aria-label="История действий">📜 История</button> ' +
    '<button type="button" onclick="navigate(\'view\')" class="small-btn cow-card-back" aria-label="Назад к списку">← Назад к списку</button>' +
    '</div>' +
    '</div>';
}

/**
 * Переключает видимость таблицы «Все осеменения» в карточке животного
 */
function toggleViewCowInseminationHistory() {
  var el = document.getElementById('viewCowInseminationHistory');
  if (!el) return;
  el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

/**
 * Открывает модальное окно истории действий по карточке животного
 */
function openViewCowActionHistory(cattleId) {
  var modal = document.getElementById('viewCowActionHistoryModal');
  var listEl = document.getElementById('viewCowActionHistoryList');
  var closeBtn = document.getElementById('viewCowActionHistoryCloseBtn');
  if (!modal || !listEl) return;
  modal.setAttribute('data-current-cattle-id', cattleId || '');
  renderViewCowActionHistoryModal(cattleId);
  modal.classList.add('active');
  modal.setAttribute('aria-hidden', 'false');
  setTimeout(function () {
    var first = modal.querySelector('button, [href], input, [tabindex]:not([tabindex="-1"])');
    if (first) first.focus();
  }, 0);
  if (closeBtn && !closeBtn.dataset.bound) {
    closeBtn.dataset.bound = '1';
    closeBtn.addEventListener('click', closeViewCowActionHistoryModal);
  }
  if (!modal.dataset.overlayBound) {
    modal.dataset.overlayBound = '1';
    modal.addEventListener('click', function (e) {
      if (e.target === modal) closeViewCowActionHistoryModal();
    });
  }
}

function closeViewCowActionHistoryModal() {
  var modal = document.getElementById('viewCowActionHistoryModal');
  if (!modal) return;
  modal.classList.remove('active');
  modal.setAttribute('aria-hidden', 'true');
}

/**
 * Заполняет список записей в модальном окне истории (с кнопкой удаления у каждой записи)
 */
function renderViewCowActionHistoryModal(cattleId) {
  var listEl = document.getElementById('viewCowActionHistoryList');
  if (!listEl) return;
  var entry = entries.find(function (e) { return e.cattleId === cattleId; });
  var rawHistory = (entry && entry.actionHistory) ? entry.actionHistory : [];
  var withIndex = rawHistory.map(function (item, idx) { return { item: item, index: idx }; });
  withIndex.sort(function (a, b) {
    var ta = (a.item.dateTime || '').toString();
    var tb = (b.item.dateTime || '').toString();
    return ta > tb ? -1 : ta < tb ? 1 : 0;
  });
  if (withIndex.length === 0) {
    listEl.innerHTML = '<p class="cow-insemination-empty">Нет записей в истории.</p>';
    return;
  }
  var html = withIndex.map(function (row) {
    var item = row.item;
    var origIndex = row.index;
    var safeId = (cattleId || '').replace(/"/g, '&quot;');
    var dt = escapeHtmlCard(item.dateTime);
    var user = escapeHtmlCard(item.userName);
    var action = escapeHtmlCard(item.action);
    var details = escapeHtmlCard(item.details);
    return '<div class="action-history-item" data-cattle-id="' + safeId + '" data-action-index="' + origIndex + '">' +
      '<span class="action-history-date">' + dt + '</span> ' +
      '<span class="action-history-user">' + user + '</span> — ' +
      '<span class="action-history-action">' + action + '</span>' +
      (details ? ' <span class="action-history-details">(' + details + ')</span>' : '') +
      ' <button type="button" class="small-btn action-history-delete" onclick="deleteActionHistoryItem(\'' + safeId + '\', ' + origIndex + ')" title="Удалить запись">🗑️</button>' +
      '</div>';
  }).join('');
  listEl.innerHTML = html;
}

/**
 * Удаляет запись из истории действий; сохраняет данные и обновляет список в модалке
 */
function deleteActionHistoryItem(cattleId, index) {
  var entry = entries.find(function (e) { return e.cattleId === cattleId; });
  if (!entry || !entry.actionHistory || index < 0 || index >= entry.actionHistory.length) return;
  entry.actionHistory.splice(index, 1);
  if (typeof saveLocally === 'function') saveLocally();
  if (typeof window.CATTLE_TRACKER_USE_API !== 'undefined' && window.CATTLE_TRACKER_USE_API && typeof window.updateEntryViaApi === 'function') {
    window.updateEntryViaApi(cattleId, entry).then(function () {
      renderViewCowActionHistoryModal(cattleId);
    }).catch(function () { renderViewCowActionHistoryModal(cattleId); });
  } else {
    renderViewCowActionHistoryModal(cattleId);
  }
}

/**
 * Собирает плоский список всех осеменений по всем животным (для экрана и экспорта)
 * Каждый элемент: { cattleId, nickname, lactation, date, attemptNumber, bull, inseminator, code, daysFromPrevious }
 */
function getAllInseminationsFlat() {
  var flat = [];
  var list = typeof entries !== 'undefined' ? entries : [];
  for (var i = 0; i < list.length; i++) {
    var entry = list[i];
    var rows = getInseminationListForEntry(entry);
    for (var j = 0; j < rows.length; j++) {
      flat.push({
        cattleId: entry.cattleId || '',
        nickname: entry.nickname || '',
        lactation: (rows[j].lactation !== undefined && rows[j].lactation !== null) ? rows[j].lactation : (entry.lactation !== undefined && entry.lactation !== null) ? entry.lactation : '',
        date: rows[j].date,
        attemptNumber: rows[j].attemptNumber,
        bull: rows[j].bull || '',
        inseminator: rows[j].inseminator || '',
        code: rows[j].code || '',
        daysFromPrevious: rows[j].daysFromPrevious
      });
    }
  }
  flat.sort(function (a, b) {
    var ta = parseInseminationDateToTime(a.date);
    var tb = parseInseminationDateToTime(b.date);
    if (isNaN(ta) && isNaN(tb)) return 0;
    if (isNaN(ta)) return 1;
    if (isNaN(tb)) return -1;
    return ta < tb ? -1 : ta > tb ? 1 : 0;
  });
  return flat;
}

var allInseminationsSortKey = 'date';
var allInseminationsSortDir = 'asc';
var allInseminationsFilter = { query: '', dateFrom: '', dateTo: '', lactation: null };

function getFilteredAllInseminations(flat) {
  if (!flat || !flat.length) return flat;
  var list = flat.slice();
  var q = (allInseminationsFilter.query || '').toLowerCase().trim();
  if (q) {
    list = list.filter(function (row) {
      var cattleId = (row.cattleId || '').toLowerCase();
      var nickname = (row.nickname || '').toLowerCase();
      var bull = (row.bull || '').toLowerCase();
      var code = (row.code || '').toLowerCase();
      var inseminator = (row.inseminator || '').toLowerCase();
      return cattleId.indexOf(q) !== -1 || nickname.indexOf(q) !== -1 ||
        bull.indexOf(q) !== -1 || code.indexOf(q) !== -1 || inseminator.indexOf(q) !== -1;
    });
  }
  if (allInseminationsFilter.dateFrom) {
    list = list.filter(function (row) { return (row.date || '') >= allInseminationsFilter.dateFrom; });
  }
  if (allInseminationsFilter.dateTo) {
    list = list.filter(function (row) { return (row.date || '') <= allInseminationsFilter.dateTo; });
  }
  if (allInseminationsFilter.lactation != null && allInseminationsFilter.lactation !== '') {
    var lact = parseInt(allInseminationsFilter.lactation, 10);
    if (!isNaN(lact)) {
      list = list.filter(function (row) { return (row.lactation !== undefined && parseInt(row.lactation, 10) === lact) || (row.lactation === lact); });
    }
  }
  return list;
}

function compareAllInseminationsRow(a, b, key, dir) {
  var mul = dir === 'asc' ? 1 : -1;
  var va = a[key];
  var vb = b[key];
  if (key === 'date') {
    var ta = parseInseminationDateToTime(va);
    var tb = parseInseminationDateToTime(vb);
    return mul * (ta - tb);
  }
  if (key === 'lactation' || key === 'attemptNumber') {
    var na = parseInt(va, 10);
    var nb = parseInt(vb, 10);
    if (isNaN(na)) na = 0;
    if (isNaN(nb)) nb = 0;
    return mul * (na - nb);
  }
  if (key === 'daysFromPrevious') {
    var na = (va !== '—' && va !== undefined && va !== null && va !== '') ? parseInt(va, 10) : -1;
    var nb = (vb !== '—' && vb !== undefined && vb !== null && vb !== '') ? parseInt(vb, 10) : -1;
    return mul * (na - nb);
  }
  var sa = (va != null ? String(va) : '').toLowerCase();
  var sb = (vb != null ? String(vb) : '').toLowerCase();
  return mul * sa.localeCompare(sb, 'ru');
}

function renderAllInseminationsFilterUI() {
  var container = document.getElementById('allInseminationsFilterContainer');
  if (!container) return;
  var q = (allInseminationsFilter.query || '').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  var lactVal = allInseminationsFilter.lactation !== null && allInseminationsFilter.lactation !== '' ? allInseminationsFilter.lactation : '';
  container.innerHTML =
    '<div class="search-filter-bar">' +
      '<div class="search-row">' +
        '<input type="text" id="allInsemSearchInput" class="search-input" placeholder="Поиск по номеру, кличке, быку, осеменителю..." value="' + q + '">' +
        '<button type="button" id="allInsemFilterClearBtn" class="small-btn">Сбросить фильтры</button>' +
      '</div>' +
      '<div class="filter-row">' +
        '<span class="filter-label">Период (дата осеменения):</span>' +
        '<input type="date" id="allInsemDateFrom" value="' + (allInseminationsFilter.dateFrom || '') + '"> — ' +
        '<input type="date" id="allInsemDateTo" value="' + (allInseminationsFilter.dateTo || '') + '">' +
        '<span class="filter-label">Лактация:</span>' +
        '<input type="number" id="allInsemFilterLactation" min="1" max="20" placeholder="—" value="' + lactVal + '">' +
      '</div>' +
    '</div>';
  var searchInput = document.getElementById('allInsemSearchInput');
  var clearBtn = document.getElementById('allInsemFilterClearBtn');
  var dateFrom = document.getElementById('allInsemDateFrom');
  var dateTo = document.getElementById('allInsemDateTo');
  var filterLact = document.getElementById('allInsemFilterLactation');
  function applyFilterAndRender() {
    allInseminationsFilter.query = searchInput ? searchInput.value.trim() : '';
    allInseminationsFilter.dateFrom = dateFrom ? dateFrom.value : '';
    allInseminationsFilter.dateTo = dateTo ? dateTo.value : '';
    allInseminationsFilter.lactation = filterLact && filterLact.value !== '' ? parseInt(filterLact.value, 10) : null;
    renderAllInseminationsScreen();
  }
  if (searchInput) {
    searchInput.addEventListener('input', function () { applyFilterAndRender(); });
    searchInput.addEventListener('keyup', function (e) { if (e.key === 'Enter') applyFilterAndRender(); });
  }
  if (clearBtn) {
    clearBtn.addEventListener('click', function () {
      allInseminationsFilter = { query: '', dateFrom: '', dateTo: '', lactation: null };
      if (searchInput) searchInput.value = '';
      if (dateFrom) dateFrom.value = '';
      if (dateTo) dateTo.value = '';
      if (filterLact) filterLact.value = '';
      renderAllInseminationsScreen();
      renderAllInseminationsFilterUI();
    });
  }
  [dateFrom, dateTo, filterLact].forEach(function (el) {
    if (el) el.addEventListener('change', applyFilterAndRender);
  });
}

/**
 * Заполняет экран «Все осеменения» таблицей по всем животным (с фильтром и сортировкой)
 */
function renderAllInseminationsScreen() {
  var container = document.getElementById('allInseminationsList');
  var filterContainer = document.getElementById('allInseminationsFilterContainer');
  if (!container) return;
  if (filterContainer && !filterContainer.dataset.rendered) {
    filterContainer.dataset.rendered = '1';
    renderAllInseminationsFilterUI();
  }
  var flat = getAllInseminationsFlat();
  var listToShow = getFilteredAllInseminations(flat);
  if (listToShow.length > 0 && allInseminationsSortKey) {
    listToShow = listToShow.slice();
    listToShow.sort(function (a, b) {
      return compareAllInseminationsRow(a, b, allInseminationsSortKey, allInseminationsSortDir);
    });
  }
  if (listToShow.length === 0) {
    container.innerHTML = '<p class="cow-insemination-empty">Нет данных об осеменениях.' + (flat.length > 0 ? ' Измените фильтры.' : '') + '</p>';
    return;
  }
  var sortAsc = allInseminationsSortDir === 'asc';
  var sortMark = function (key) {
    if (allInseminationsSortKey !== key) return '';
    return sortAsc ? ' <span class="sort-indicator" aria-hidden="true">▲</span>' : ' <span class="sort-indicator" aria-hidden="true">▼</span>';
  };
  var sortClass = function (key) {
    if (allInseminationsSortKey !== key) return '';
    return sortAsc ? ' sort-asc' : ' sort-desc';
  };
  var th = function (key, label) {
    return '<th class="sortable-th' + sortClass(key) + '" data-sort-key="' + String(key).replace(/"/g, '&quot;') + '" role="button" tabindex="0">' + (label || key) + sortMark(key) + '</th>';
  };
  var rows = listToShow.map(function (row) {
    var attrId = (row.cattleId || '').replace(/"/g, '&quot;');
    return '<tr class="all-insem-row" data-cattle-id="' + attrId + '" role="button" tabindex="0">' +
      '<td>' + escapeHtmlCard(row.cattleId) + '</td>' +
      '<td>' + escapeHtmlCard(row.nickname) + '</td>' +
      '<td>' + escapeHtmlCard((row.lactation !== undefined && row.lactation !== null && row.lactation !== '') || row.lactation === 0 ? row.lactation : '—') + '</td>' +
      '<td>' + (formatDate(row.date) || '—') + '</td>' +
      '<td>' + escapeHtmlCard(row.attemptNumber) + '</td>' +
      '<td>' + escapeHtmlCard(row.bull) + '</td>' +
      '<td>' + escapeHtmlCard(row.inseminator) + '</td>' +
      '<td>' + escapeHtmlCard(row.daysFromPrevious) + '</td>' +
      '<td>' + escapeHtmlCard(row.code) + '</td>' +
      '</tr>';
  }).join('');
  container.innerHTML =
    '<table class="cow-insemination-table all-inseminations-table">' +
    '<thead><tr>' +
    th('cattleId', 'Номер коровы') + th('nickname', 'Кличка') + th('lactation', 'Лактация') + th('date', 'Дата осеменения') +
    th('attemptNumber', 'Попытка') + th('bull', 'Бык') + th('inseminator', 'Техник ИО') +
    th('daysFromPrevious', 'Дней от предыдущего') + th('code', 'Код') +
    '</tr></thead><tbody>' + rows + '</tbody></table>';
  container.querySelectorAll('.all-insem-row').forEach(function (tr) {
    var id = tr.getAttribute('data-cattle-id');
    if (id) tr.addEventListener('click', function () { viewCow(id); });
  });
  container.querySelectorAll('.all-inseminations-table th[data-sort-key]').forEach(function (thEl) {
    thEl.addEventListener('click', function () {
      var key = thEl.getAttribute('data-sort-key');
      if (!key) return;
      if (allInseminationsSortKey === key) allInseminationsSortDir = allInseminationsSortDir === 'asc' ? 'desc' : 'asc';
      else { allInseminationsSortKey = key; allInseminationsSortDir = 'asc'; }
      renderAllInseminationsScreen();
    });
    thEl.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        thEl.click();
      }
    });
  });
}

// Список записей с групповым выделением рисуется в menu.js (updateViewList).
// Открытие карточки животного — по кнопке «Карточка» в строке или по вызову viewCow(cattleId).

// === js/ui/field-config.js
// field-config.js — единый конфиг полей карточки/списка/экспорта

(function () {
  'use strict';

  function safeStr(val) {
    if (val === undefined || val === null) return '';
    return String(val);
  }

  var COW_FIELDS = [
    { key: 'cattleId', label: 'Корова', sortable: true, render: function (e) { return e ? safeStr(e.cattleId) : ''; } },
    { key: 'nickname', label: 'Кличка', sortable: true, render: function (e) { return e ? safeStr(e.nickname) : ''; } },
    { key: 'group', label: 'Группа', sortable: true, render: function (e) { return e ? safeStr(e.group) : ''; } },
    { key: 'birthDate', label: 'Дата рождения', sortable: true, render: function (e) { return e && typeof formatDate === 'function' ? formatDate(e.birthDate) : ''; } },
    { key: 'lactation', label: 'Лактация', sortable: true, render: function (e) { return e && ((e.lactation !== undefined && e.lactation !== null && e.lactation !== '') || e.lactation === 0) ? String(e.lactation) : ''; } },
    { key: 'calvingDate', label: 'Дата отёла', sortable: true, render: function (e) { return e && typeof formatDate === 'function' ? formatDate(e.calvingDate) : ''; } },
    { key: 'inseminationDate', label: 'Дата осеменения', sortable: true, render: function (e) { return e && typeof formatDate === 'function' ? formatDate(e.inseminationDate) : ''; } },
    { key: 'attemptNumber', label: 'Номер попытки', sortable: true, render: function (e) { return e && (e.attemptNumber !== undefined && e.attemptNumber !== '') ? String(e.attemptNumber) : ''; } },
    { key: 'bull', label: 'Бык', sortable: true, render: function (e) { return e ? safeStr(e.bull) : ''; } },
    { key: 'inseminator', label: 'Техник ИО', sortable: true, render: function (e) { return e ? safeStr(e.inseminator) : ''; } },
    { key: 'code', label: 'Код', sortable: true, render: function (e) { return e ? safeStr(e.code) : ''; } },
    { key: 'status', label: 'Статус', sortable: true, render: function (e) { return e ? safeStr(e.status) : ''; } },
    { key: 'exitDate', label: 'Дата выбытия', sortable: true, render: function (e) { return e && typeof formatDate === 'function' ? formatDate(e.exitDate) : ''; } },
    { key: 'dryStartDate', label: 'Начало сухостоя', sortable: true, render: function (e) { return e && typeof formatDate === 'function' ? formatDate(e.dryStartDate) : ''; } },
    { key: 'pdo', label: 'ПДО (дней от отёла до 1-го осеменения)', sortable: true, render: function (e) { if (!e || typeof getPDO !== 'function') return ''; var v = getPDO(e); return (v === '—' || v === '' || v === undefined) ? '' : String(v); } },
    { key: 'protocolName', label: 'Протокол', sortable: true, render: function (e) { return e ? safeStr((e.protocol && e.protocol.name) || e.protocolName) : ''; } },
    { key: 'protocolStartDate', label: 'Начало протокола', sortable: true, render: function (e) { if (!e) return ''; var d = (e.protocol && e.protocol.startDate) || e.protocolStartDate; return typeof formatDate === 'function' ? formatDate(d) : ''; } },
    { key: 'note', label: 'Примечание', sortable: true, render: function (e) { return e ? safeStr(e.note) : ''; } },
    { key: 'synced', label: 'Синхронизация', sortable: true, render: function (e) { return e && e.synced ? '✅' : (e ? '🟡' : ''); } },
    { key: 'dateAdded', label: 'Дата добавления', sortable: true, render: function (e) { return e ? safeStr(e.dateAdded) : ''; } },
    { key: 'lastModifiedBy', label: 'Изменено пользователем', sortable: true, render: function (e) { return e ? safeStr(e.lastModifiedBy) : ''; } },
    { key: 'daysPregnant', label: 'Дни стельности', sortable: true, render: function (e) { if (!e || typeof getDaysPregnant !== 'function') return ''; var v = getDaysPregnant(e); return v === null || v === undefined ? '' : String(v); } }
  ];

  function rawDate(e, key) {
    if (!e) return '';
    if (key === 'protocolStartDate') return (e.protocol && e.protocol.startDate) || e.protocolStartDate || '';
    return e[key] || '';
  }

  COW_FIELDS.forEach(function (f) {
    if (!f.exportRender && (f.key.indexOf('Date') !== -1 || f.key === 'birthDate' || f.key === 'exitDate' || f.key === 'calvingDate' || f.key === 'inseminationDate' || f.key === 'dryStartDate' || f.key === 'protocolStartDate')) {
      f.exportRender = function (e) { return rawDate(e, f.key); };
    } else if (f.key === 'synced') {
      f.exportRender = function (e) { return e && e.synced ? 'Да' : 'Нет'; };
    } else if (!f.exportRender) {
      f.exportRender = f.render;
    }
  });

  if (typeof window !== 'undefined') {
    window.COW_FIELDS = COW_FIELDS;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { COW_FIELDS: COW_FIELDS };
  }
})();

// === js/features/search-filter.js
/**
 * search-filter.js — Поиск и фильтрация записей
 */
(function (global) {
  'use strict';

  var searchQuery = '';
  var filters = {
    status: [],
    lactation: null,
    dateFrom: '',
    dateTo: '',
    synced: null,
    group: '',
    bull: ''
  };
  var STORAGE_KEY = 'cattleTracker_search_filter';

  function loadSavedFilters() {
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        var parsed = JSON.parse(saved);
        if (parsed.status) filters.status = parsed.status;
        if (parsed.lactation != null) filters.lactation = parsed.lactation;
        if (parsed.dateFrom) filters.dateFrom = parsed.dateFrom;
        if (parsed.dateTo) filters.dateTo = parsed.dateTo;
        if (parsed.synced != null) filters.synced = parsed.synced;
        if (parsed.group) filters.group = parsed.group;
        if (parsed.bull) filters.bull = parsed.bull;
      }
    } catch (e) {
      console.warn('search-filter: не удалось загрузить сохранённые фильтры', e);
    }
  }

  function saveFilters() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
    } catch (e) {
      console.warn('search-filter: не удалось сохранить фильтры', e);
    }
  }

  /**
   * Поиск по всем полям записи
   * @param {string} query
   * @param {Array} list
   * @returns {Array}
   */
  function searchEntries(query, list) {
    if (!list) list = (typeof entries !== 'undefined' ? entries : []);
    var q = (query || '').toLowerCase().trim();
    if (!q) return list;
    return list.filter(function (entry) {
      var cattleId = (entry.cattleId || '').toLowerCase();
      var nickname = (entry.nickname || '').toLowerCase();
      var status = (entry.status || '').toLowerCase();
      var bull = (entry.bull || '').toLowerCase();
      var code = (entry.code || '').toLowerCase();
      var note = (entry.note || '').toLowerCase();
      var inseminator = (entry.inseminator || '').toLowerCase();
      var protocolName = (entry.protocol && entry.protocol.name) ? entry.protocol.name.toLowerCase() : '';
      var group = (entry.group || '').toLowerCase();
      return cattleId.indexOf(q) !== -1 ||
             nickname.indexOf(q) !== -1 ||
             group.indexOf(q) !== -1 ||
             status.indexOf(q) !== -1 ||
             bull.indexOf(q) !== -1 ||
             code.indexOf(q) !== -1 ||
             note.indexOf(q) !== -1 ||
             inseminator.indexOf(q) !== -1 ||
             protocolName.indexOf(q) !== -1;
    });
  }

  /**
   * Фильтрация по критериям
   * @param {Object} f
   * @param {Array} list
   * @returns {Array}
   */
  function filterEntries(f, list) {
    if (!list) list = (typeof entries !== 'undefined' ? entries : []);
    var result = list;

    if (f.status && f.status.length > 0) {
      var statusSet = {};
      f.status.forEach(function (s) { statusSet[s] = true; });
      result = result.filter(function (e) { return statusSet[e.status]; });
    }
    if (f.lactation != null && f.lactation !== '') {
      var lact = parseInt(f.lactation, 10);
      if (!isNaN(lact)) {
        result = result.filter(function (e) { return (e.lactation || 0) === lact; });
      }
    }
    if (f.dateFrom) {
      result = result.filter(function (e) {
        var d = e.inseminationDate || e.calvingDate || e.dateAdded || '';
        return d >= f.dateFrom;
      });
    }
    if (f.dateTo) {
      result = result.filter(function (e) {
        var d = e.inseminationDate || e.calvingDate || e.dateAdded || '';
        return d <= f.dateTo;
      });
    }
    if (f.synced === true) {
      result = result.filter(function (e) { return e.synced === true; });
    } else if (f.synced === false) {
      result = result.filter(function (e) { return e.synced !== true; });
    }
    if (f.group && String(f.group).trim() !== '') {
      var g = String(f.group).trim().toLowerCase();
      result = result.filter(function (e) { return (e.group || '').toLowerCase().indexOf(g) !== -1; });
    }
    if (f.bull && String(f.bull).trim() !== '') {
      var b = String(f.bull).trim().toLowerCase();
      result = result.filter(function (e) { return (e.bull || '').toLowerCase().indexOf(b) !== -1; });
    }
    return result;
  }

  /**
   * Комбинированный поиск и фильтрация
   * @param {Array} [list]
   * @returns {Array}
   */
  function applySearchAndFilter(list) {
    if (!list || !list.length) list = (typeof window !== 'undefined' && window.entries && Array.isArray(window.entries)) ? window.entries : (typeof entries !== 'undefined' ? entries : []);
    var step = searchEntries(searchQuery, list);
    return filterEntries(filters, step);
  }

  /**
   * Возвращает массив записей для отображения (с учётом поиска и фильтров)
   */
  function getFilteredEntries() {
    if (typeof window !== 'undefined' && window._forceAllEntriesForViewList) {
      window._forceAllEntriesForViewList = false;
      var all = (window.entries && Array.isArray(window.entries)) ? window.entries : [];
      return all;
    }
    var list = (typeof window !== 'undefined' && window.entries && Array.isArray(window.entries)) ? window.entries : (typeof entries !== 'undefined' ? entries : []);
    return applySearchAndFilter(list);
  }

  function setSearchQuery(q) {
    searchQuery = (q || '').trim();
  }

  function setFilters(f) {
    if (f && typeof f === 'object') {
      if (f.status !== undefined) filters.status = Array.isArray(f.status) ? f.status : [];
      if (f.lactation !== undefined) filters.lactation = f.lactation;
      if (f.dateFrom !== undefined) filters.dateFrom = f.dateFrom;
      if (f.dateTo !== undefined) filters.dateTo = f.dateTo;
      if (f.synced !== undefined) filters.synced = f.synced;
      if (f.group !== undefined) filters.group = f.group;
      if (f.bull !== undefined) filters.bull = f.bull;
      saveFilters();
    }
  }

  function getFilters() {
    return {
      status: filters.status.slice(),
      lactation: filters.lactation,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      synced: filters.synced,
      group: filters.group,
      bull: filters.bull
    };
  }

  /**
   * Рендер UI поиска и фильтров в контейнер
   */
  function renderSearchFilterUI(containerId) {
    var container = document.getElementById(containerId);
    if (!container) return;

    var statusOptions = ['Осемененная', 'Холостая', 'Стельная', 'Сухостой', 'Отёл', 'Брак'];
    var statusChecks = statusOptions.map(function (s) {
      var checked = filters.status.indexOf(s) !== -1 ? ' checked' : '';
      return '<label class="filter-check"><input type="checkbox" data-filter-status="' + s.replace(/"/g, '&quot;') + '"' + checked + '> ' + s + '</label>';
    }).join('');

    var groupVal = (filters.group || '').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    var bullVal = (filters.bull || '').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    container.innerHTML =
      '<div class="search-filter-bar">' +
        '<div class="search-row">' +
          '<input type="text" id="searchEntriesInput" class="search-input" placeholder="Поиск по номеру, кличке, группе, статусу, быку..." value="' + (searchQuery.replace(/"/g, '&quot;').replace(/</g, '&lt;')) + '">' +
          '<button type="button" id="searchFilterClearBtn" class="small-btn">Сбросить фильтры</button>' +
        '</div>' +
        '<div class="filter-row">' +
          '<span class="filter-label">Статус:</span>' + statusChecks +
          '<span class="filter-label">Группа:</span>' +
          '<input type="text" id="filterGroup" placeholder="часть названия" value="' + groupVal + '">' +
          '<span class="filter-label">Бык:</span>' +
          '<input type="text" id="filterBull" placeholder="часть имени" value="' + bullVal + '">' +
          '<span class="filter-label">Лактация:</span>' +
          '<input type="number" id="filterLactation" min="0" max="20" placeholder="—" value="' + ((filters.lactation !== null && filters.lactation !== '') || filters.lactation === 0 ? filters.lactation : '') + '">' +
          '<span class="filter-label">Период (осеменение):</span>' +
          '<input type="date" id="filterDateFrom" value="' + (filters.dateFrom || '') + '"> — ' +
          '<input type="date" id="filterDateTo" value="' + (filters.dateTo || '') + '">' +
          '<label class="filter-check"><input type="radio" name="filterSynced" value="" ' + (filters.synced === null || filters.synced === '' ? ' checked' : '') + '> Все</label>' +
          '<label class="filter-check"><input type="radio" name="filterSynced" value="1" ' + (filters.synced === true ? ' checked' : '') + '> Синхр.</label>' +
          '<label class="filter-check"><input type="radio" name="filterSynced" value="0" ' + (filters.synced === false ? ' checked' : '') + '> Не синхр.</label>' +
        '</div>' +
      '</div>';

    var searchInput = document.getElementById('searchEntriesInput');
    var clearBtn = document.getElementById('searchFilterClearBtn');
    var filterLactation = document.getElementById('filterLactation');
    var filterDateFrom = document.getElementById('filterDateFrom');
    var filterDateTo = document.getElementById('filterDateTo');
    var filterGroup = document.getElementById('filterGroup');
    var filterBull = document.getElementById('filterBull');

    function applyAndUpdateView() {
      searchQuery = searchInput ? searchInput.value.trim() : '';
      filters.lactation = filterLactation && filterLactation.value !== '' ? parseInt(filterLactation.value, 10) : null;
      filters.dateFrom = filterDateFrom ? filterDateFrom.value : '';
      filters.dateTo = filterDateTo ? filterDateTo.value : '';
      filters.group = filterGroup ? filterGroup.value.trim() : '';
      filters.bull = filterBull ? filterBull.value.trim() : '';
      var syncedRadio = document.querySelector('input[name="filterSynced"]:checked');
      if (syncedRadio) {
        if (syncedRadio.value === '1') filters.synced = true;
        else if (syncedRadio.value === '0') filters.synced = false;
        else filters.synced = null;
      }
      var statusChecks = container.querySelectorAll('input[data-filter-status]');
      filters.status = [];
      if (statusChecks && statusChecks.length) {
        statusChecks.forEach(function (cb) {
          if (cb.checked) filters.status.push(cb.getAttribute('data-filter-status'));
        });
      }
      saveFilters();
      if (typeof updateViewList === 'function') updateViewList();
    }

    if (searchInput) {
      searchInput.addEventListener('input', function () {
        setSearchQuery(searchInput.value);
        if (typeof updateViewList === 'function') updateViewList();
      });
      searchInput.addEventListener('keyup', function (e) {
        if (e.key === 'Enter') applyAndUpdateView();
      });
    }
    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        searchQuery = '';
        filters = { status: [], lactation: null, dateFrom: '', dateTo: '', synced: null, group: '', bull: '' };
        saveFilters();
        if (searchInput) searchInput.value = '';
        if (filterLactation) filterLactation.value = '';
        if (filterDateFrom) filterDateFrom.value = '';
        if (filterDateTo) filterDateTo.value = '';
        if (filterGroup) filterGroup.value = '';
        if (filterBull) filterBull.value = '';
        var radios = container.querySelectorAll('input[name="filterSynced"]');
        if (radios.length) radios[0].checked = true;
        container.querySelectorAll('input[data-filter-status]').forEach(function (cb) { cb.checked = false; });
        if (typeof updateViewList === 'function') updateViewList();
      });
    }
    container.querySelectorAll('input[data-filter-status], #filterLactation, #filterDateFrom, #filterDateTo, #filterGroup, #filterBull, input[name="filterSynced"]').forEach(function (el) {
      el.addEventListener('change', applyAndUpdateView);
    });
  }

  function initSearchFilter() {
    loadSavedFilters();
    var container = document.getElementById('search-filter-container');
    if (container) renderSearchFilterUI('search-filter-container');
  }

  /**
   * Сбрасывает поиск и фильтры, сохраняет в localStorage, обновляет UI и список.
   */
  function resetFiltersToDefault() {
    searchQuery = '';
    filters = { status: [], lactation: null, dateFrom: '', dateTo: '', synced: null, group: '', bull: '' };
    saveFilters();
    if (typeof window !== 'undefined') window._forceAllEntriesForViewList = true;
    var container = document.getElementById('search-filter-container');
    if (container) renderSearchFilterUI('search-filter-container');
    if (typeof updateViewList === 'function') updateViewList();
  }

  var globalObj = (typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
  globalObj.searchEntries = searchEntries;
  globalObj.filterEntries = filterEntries;
  globalObj.applySearchAndFilter = applySearchAndFilter;
  globalObj.getFilteredEntries = getFilteredEntries;
  globalObj.getListViewFilteredEntries = getFilteredEntries;
  globalObj.setSearchQuery = setSearchQuery;
  globalObj.setFilters = setFilters;
  globalObj.getFilters = getFilters;
  globalObj.renderSearchFilterUI = renderSearchFilterUI;
  globalObj.initSearchFilter = initSearchFilter;
  globalObj.resetFiltersToDefault = resetFiltersToDefault;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { searchEntries: searchEntries, filterEntries: filterEntries, applySearchAndFilter: applySearchAndFilter };
  }

  if (typeof window !== 'undefined' && window.document) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initSearchFilter);
    } else {
      initSearchFilter();
    }
  }
})(typeof window !== 'undefined' ? window : this);

// === js/features/notifications.js
/**
 * notifications.js — Уведомления и напоминания
 */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'cattleTracker_notifications';
  var LIST_KEY = 'cattleTracker_notification_history';
  var CHECK_INTERVAL_MS = 60 * 1000;
  var timerId = null;
  var VWP_DAYS = 60;
  var CALVING_REMINDER_DAYS = [7, 3, 1];

  function parseDate(str) {
    if (!str) return null;
    var d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
  }

  function dateOnly(d) {
    if (!d) return null;
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  function daysBetween(from, to) {
    if (!from || !to) return null;
    var a = dateOnly(from);
    var b = dateOnly(to);
    return Math.round((b - a) / (24 * 60 * 60 * 1000));
  }

  function loadHistory() {
    try {
      var raw = localStorage.getItem(LIST_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function saveHistory(list) {
    try {
      localStorage.setItem(LIST_KEY, JSON.stringify((list || []).slice(-200)));
    } catch (e) {}
  }

  function normalizeHistory(list) {
    if (!Array.isArray(list)) return [];
    var changed = false;
    list.forEach(function (n) {
      if (typeof n.read !== 'boolean') {
        n.read = true;
        changed = true;
      }
    });
    if (changed) saveHistory(list);
    return list;
  }

  var CATEGORY_LABELS = {
    calving: 'Предстоящий отёл',
    insemination: 'Осеменение',
    dry: 'Сухостой',
    sync: 'Синхронизация',
    other: 'Прочее'
  };

  function inferCategory(n) {
    if (n.category) return n.category;
    var msg = (n.message || '').toLowerCase();
    if (msg.indexOf('отёл') !== -1 || msg.indexOf('отел') !== -1) return 'calving';
    if (msg.indexOf('осеменен') !== -1) return 'insemination';
    if (msg.indexOf('сухостой') !== -1) return 'dry';
    if (msg.indexOf('синхрониз') !== -1) return 'sync';
    return 'other';
  }

  function createNotification(type, message, cowId, meta, options) {
    meta = meta || {};
    options = options || {};
    var showToastOpt = options.showToast !== false;
    var showSystemOpt = options.showSystem !== false;
    var item = {
      id: 'n_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9),
      type: type || 'info',
      message: message || '',
      cattleId: cowId || '',
      meta: meta,
      category: meta.category || 'other',
      createdAt: new Date().toISOString(),
      read: false
    };
    var history = loadHistory();
    history.push(item);
    saveHistory(history);
    if (showToastOpt && typeof window.showToast === 'function') {
      window.showToast(message, type === 'error' ? 'error' : 'info', 4000);
    }
    if (showSystemOpt && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification('Учёт коров', { body: message, tag: item.id });
      } catch (err) {}
    }
    if (typeof window.CattleTrackerEvents !== 'undefined') {
      window.CattleTrackerEvents.emit('notification:created', item);
    }
    if (typeof updateNotificationIndicators === 'function') {
      updateNotificationIndicators();
    }
    if (document.getElementById('menuNotificationsBody')) {
      renderNotificationSummary('menuNotificationsBody');
    }
    return item;
  }

  function checkUpcomingEvents() {
    var list = typeof entries !== 'undefined' ? entries : [];
    if (!list.length) return [];
    var today = dateOnly(new Date());
    var now = Date.now();
    var notified = {};
    var out = [];

    list.forEach(function (entry) {
      var cattleId = entry.cattleId || '';
      var calvingDate = parseDate(entry.calvingDate);
      var inseminationDate = parseDate(entry.inseminationDate);
      var dryStartDate = parseDate(entry.dryStartDate);
      var exitDate = parseDate(entry.exitDate);
      if (exitDate && exitDate <= today) return;

      if (calvingDate && calvingDate >= today) {
        var daysToCalving = daysBetween(new Date(), calvingDate);
        if (CALVING_REMINDER_DAYS.indexOf(daysToCalving) !== -1) {
          var key = 'calving_' + cattleId + '_' + daysToCalving;
          if (!notified[key]) {
            notified[key] = true;
            out.push(createNotification('info', 'Предстоящий отёл: корова ' + cattleId + ' через ' + daysToCalving + ' дн.', cattleId, { daysToCalving: daysToCalving, category: 'calving' }, { showToast: false, showSystem: false }));
          }
        }
      }

      var lastCalving = calvingDate;
      if (lastCalving && !inseminationDate) {
        var daysSinceCalving = daysBetween(lastCalving, new Date());
        if (daysSinceCalving >= VWP_DAYS) {
          var key2 = 'insem_' + cattleId;
          if (!notified[key2]) {
            notified[key2] = true;
            out.push(createNotification('info', 'Рекомендуется осеменение: корова ' + cattleId + ' (прошло ' + daysSinceCalving + ' дн. после отёла)', cattleId, { daysSinceCalving: daysSinceCalving, category: 'insemination' }, { showToast: false, showSystem: false }));
          }
        }
      }

      if (calvingDate && calvingDate > today) {
        var dryOffDue = daysBetween(new Date(), calvingDate);
        if (dryOffDue <= VWP_DAYS && dryOffDue >= VWP_DAYS - 14) {
          var key3 = 'dry_' + cattleId;
          if (!notified[key3]) {
            notified[key3] = true;
            out.push(createNotification('info', 'Запуск в сухостой: корова ' + cattleId + ' (отёл через ~' + dryOffDue + ' дн.)', cattleId, { daysToCalving: dryOffDue, category: 'dry' }, { showToast: false, showSystem: false }));
          }
        }
      }

      if (entry.status && String(entry.status).indexOf('Стельная') !== -1 && typeof getDaysPregnant === 'function') {
        var daysPreg = getDaysPregnant(entry);
        if (daysPreg !== null && daysPreg > 275) {
          var keyOverdue = 'overdue_' + cattleId;
          if (!notified[keyOverdue]) {
            notified[keyOverdue] = true;
            out.push(createNotification('info', 'Проверить отел: корова ' + cattleId + ' (дней стельности: ' + daysPreg + ')', cattleId, { daysPregnant: daysPreg, category: 'calving' }, { showToast: false, showSystem: false }));
          }
        }
      }
    });

    var unsynced = list.filter(function (e) { return e.synced !== true; });
    if (unsynced.length > 0) {
      var key4 = 'unsynced_count';
      if (!notified[key4]) {
        notified[key4] = true;
        out.push(createNotification('info', 'Не синхронизировано записей: ' + unsynced.length, '', { count: unsynced.length, category: 'sync' }, { showToast: false, showSystem: false }));
      }
    }
    return out;
  }

  function scheduleReminders() {
    if (timerId) clearInterval(timerId);
    checkUpcomingEvents();
    timerId = setInterval(checkUpcomingEvents, CHECK_INTERVAL_MS);
  }

  function stopReminders() {
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }
  }

  function requestNotificationPermission() {
    if (!('Notification' in window)) return Promise.resolve(false);
    if (Notification.permission === 'granted') return Promise.resolve(true);
    if (Notification.permission === 'denied') return Promise.resolve(false);
    return Notification.requestPermission().then(function (p) { return p === 'granted'; });
  }

  function getNotificationHistory() {
    return normalizeHistory(loadHistory());
  }

  function getUnreadCount() {
    var list = getNotificationHistory();
    return list.filter(function (n) { return n.read === false; }).length;
  }

  function markNotificationRead(id) {
    if (!id) return false;
    var history = normalizeHistory(loadHistory());
    var changed = false;
    history.forEach(function (n) {
      if (n.id === id && n.read === false) {
        n.read = true;
        changed = true;
      }
    });
    if (changed) {
      saveHistory(history);
      if (typeof updateNotificationIndicators === 'function') {
        updateNotificationIndicators();
      }
    }
    return changed;
  }

  function updateNotificationIndicators() {
    var count = getUnreadCount();
    var badge = document.getElementById('menuNotificationsBadge');
    if (badge) {
      badge.textContent = count ? String(count) : '';
      badge.style.display = count ? 'inline-flex' : 'none';
    }
    var btnBadge = document.getElementById('menuNotificationsButtonBadge');
    if (btnBadge) {
      btnBadge.textContent = count ? String(count) : '';
      btnBadge.style.display = count ? 'inline-flex' : 'none';
    }
  }

  function renderNotificationSummary(containerId) {
    var body = document.getElementById(containerId);
    if (!body) return;
    var list = getNotificationHistory().slice().reverse();
    var limit = 5;
    var items = list.slice(0, limit);
    var html = '';
    if (items.length === 0) {
      html = '<div class="menu-notifications-empty">Нет уведомлений</div>';
    } else {
      html = '<ul class="menu-notifications-list">';
      items.forEach(function (n) {
        var cls = 'menu-notifications-item' + (n.read === false ? ' notification-item-unread' : '');
        html += '<li class="' + cls + '" data-notif-id="' + (n.id || '').replace(/"/g, '&quot;') + '">' +
          '<div class="menu-notifications-message">' + (n.message || '').replace(/</g, '&lt;') + '</div>' +
          '<div class="menu-notifications-time">' + (n.createdAt ? new Date(n.createdAt).toLocaleString('ru-RU') : '') + '</div>' +
          '</li>';
      });
      html += '</ul>';
    }
    html += '<div class="menu-notifications-actions">' +
      '<button type="button" class="small-btn" data-action="open-notifications">Все уведомления</button>' +
      '</div>';
    body.innerHTML = html;
    updateNotificationIndicators();
    body.querySelectorAll('.menu-notifications-item').forEach(function (item) {
      item.addEventListener('click', function () {
        var id = item.getAttribute('data-notif-id');
        if (markNotificationRead(id)) {
          renderNotificationSummary(containerId);
        }
      });
    });
    var openBtn = body.querySelector('[data-action="open-notifications"]');
    if (openBtn) {
      openBtn.addEventListener('click', function () {
        if (typeof navigate === 'function') navigate('notifications');
      });
    }
  }

  /**
   * Собирает задачи по протоколам: для записей с protocol.name и protocol.startDate
   * по каждому этапу протокола вычисляет дату инъекции и возвращает список задач.
   * @param {string} fromDate - YYYY-MM-DD
   * @param {string} toDate - YYYY-MM-DD
   * @returns {Array<{date: string, dateKey: string, cattleId: string, group: string, drug: string, protocolName: string}>}
   */
  function getProtocolTasks(fromDate, toDate) {
    var list = typeof entries !== 'undefined' ? entries : [];
    var getProtocolsFn = typeof getProtocols === 'function' ? getProtocols : function () { return []; };
    var protocols = getProtocolsFn();
    var byName = {};
    protocols.forEach(function (p) { byName[p.name || p.id] = p; });
    var from = fromDate ? dateOnly(new Date(fromDate)).getTime() : 0;
    var to = toDate ? dateOnly(new Date(toDate)).getTime() : Number.MAX_SAFE_INTEGER;
    var tasks = [];
    list.forEach(function (entry) {
      var protocol = entry.protocol;
      if (!protocol || !protocol.name || !protocol.startDate) return;
      var def = byName[protocol.name];
      if (!def || !def.steps || !def.steps.length) return;
      var start = parseDate(protocol.startDate);
      if (!start) return;
      var cattleId = entry.cattleId || '';
      var group = entry.group || '';
      def.steps.forEach(function (step) {
        var d = new Date(start);
        d.setDate(d.getDate() + (parseInt(step.day, 10) || 0));
        var taskDate = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        var taskTime = dateOnly(d).getTime();
        if (taskTime >= from && taskTime <= to) {
          tasks.push({
            date: taskDate,
            dateKey: taskDate,
            cattleId: cattleId,
            group: group,
            drug: (step.drug || '').trim() || '—',
            protocolName: protocol.name
          });
        }
      });
    });
    tasks.sort(function (a, b) { return a.dateKey.localeCompare(b.dateKey); });
    return tasks;
  }

  function renderTasksList(containerEl, fromDate, toDate) {
    if (!containerEl) return;
    var today = new Date();
    var todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + String(today.getDate()).padStart(2, '0');
    if (!fromDate && !toDate) { fromDate = todayStr; toDate = todayStr; }
    var tasks = getProtocolTasks(fromDate, toDate);
    var byDate = {};
    tasks.forEach(function (t) {
      if (!byDate[t.dateKey]) byDate[t.dateKey] = [];
      byDate[t.dateKey].push(t);
    });
    var dates = Object.keys(byDate).sort();
    var html = '<div class="tasks-list-block">';
    html += '<h4 class="tasks-list-title">Список задач (инъекции по протоколам)</h4>';
    html += '<div class="tasks-period">';
    html += '<button type="button" class="small-btn tasks-period-btn" data-range="today">Сегодня</button>';
    html += '<button type="button" class="small-btn tasks-period-btn" data-range="tomorrow">Завтра</button>';
    html += '<button type="button" class="small-btn tasks-period-btn" data-range="week">Неделя вперёд</button>';
    html += '<label>С <input type="date" id="tasksDateFrom" class="tasks-date-input" /></label>';
    html += '<label>По <input type="date" id="tasksDateTo" class="tasks-date-input" /></label>';
    html += '</div>';
    if (dates.length === 0) {
      html += '<p class="tasks-empty">Нет задач на выбранный период.</p>';
    } else {
      html += '<div class="tasks-by-date">';
      dates.forEach(function (dateKey) {
        var dayTasks = byDate[dateKey];
        html += '<div class="tasks-date-group">';
        html += '<div class="tasks-date-header">' + (dateKey || '').replace(/</g, '&lt;') + '</div>';
        html += '<ul class="tasks-date-list">';
        dayTasks.forEach(function (t) {
          html += '<li class="tasks-item">' +
            '<span class="tasks-cattle">' + (t.cattleId || '').replace(/</g, '&lt;') + '</span>' +
            ' | <span class="tasks-group">' + (t.group || '—').replace(/</g, '&lt;') + '</span>' +
            ' | <span class="tasks-drug">' + (t.drug || '—').replace(/</g, '&lt;') + '</span>' +
            ' | <span class="tasks-date">' + (t.date || '').replace(/</g, '&lt;') + '</span>' +
            '</li>';
        });
        html += '</ul></div>';
      });
      html += '</div>';
    }
    html += '</div>';
    containerEl.innerHTML = html;
    var todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + String(today.getDate()).padStart(2, '0');
    function applyRange(range) {
      var from = '';
      var to = '';
      if (range === 'today') {
        from = to = todayStr;
      } else if (range === 'tomorrow') {
        var t2 = new Date(today);
        t2.setDate(t2.getDate() + 1);
        from = to = t2.getFullYear() + '-' + String(t2.getMonth() + 1).padStart(2, '0') + String(t2.getDate()).padStart(2, '0');
      } else if (range === 'week') {
        from = todayStr;
        var t7 = new Date(today);
        t7.setDate(t7.getDate() + 7);
        to = t7.getFullYear() + '-' + String(t7.getMonth() + 1).padStart(2, '0') + String(t7.getDate()).padStart(2, '0');
      }
      var fromEl = document.getElementById('tasksDateFrom');
      var toEl = document.getElementById('tasksDateTo');
      if (fromEl) fromEl.value = from;
      if (toEl) toEl.value = to;
      renderTasksList(containerEl, from || undefined, to || undefined);
    }
    containerEl.querySelectorAll('.tasks-period-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        applyRange(btn.getAttribute('data-range'));
      });
    });
    var fromInput = document.getElementById('tasksDateFrom');
    var toInput = document.getElementById('tasksDateTo');
    if (fromInput) fromInput.addEventListener('change', function () {
      renderTasksList(containerEl, fromInput.value || undefined, toInput ? toInput.value : undefined);
    });
    if (toInput) toInput.addEventListener('change', function () {
      renderTasksList(containerEl, fromInput ? fromInput.value : undefined, toInput.value || undefined);
    });
  }

  function renderNotificationCenter(containerId) {
    var container = document.getElementById(containerId);
    if (!container) return;
    var history = getNotificationHistory().slice().reverse().slice(0, 50);
    var order = ['calving', 'insemination', 'dry', 'sync', 'other'];
    var byCategory = {};
    order.forEach(function (cat) { byCategory[cat] = []; });
    history.forEach(function (n) {
      var cat = inferCategory(n);
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(n);
    });
    var listHtml = '';
    order.forEach(function (cat) {
      var items = byCategory[cat] || [];
      if (items.length === 0) return;
      listHtml += '<div class="notification-group">';
      listHtml += '<h4 class="notification-group-title">' + (CATEGORY_LABELS[cat] || cat).replace(/</g, '&lt;') + '</h4>';
      listHtml += '<ul class="notification-list">';
      items.forEach(function (n) {
        var unreadClass = n.read === false ? ' notification-item-unread' : '';
        var cattleIdSafe = (n.cattleId || '').replace(/"/g, '&quot;');
        var cardBtn = n.cattleId
          ? '<button type="button" class="small-btn notification-view-card-btn" data-cattle-id="' + cattleIdSafe + '" aria-label="Посмотреть карточку">Посмотреть карточку</button>'
          : '';
        listHtml += '<li class="notification-item notification-' + (n.type || 'info') + unreadClass + '" data-notif-id="' + (n.id || '').replace(/"/g, '&quot;') + '" data-cattle-id="' + cattleIdSafe + '">' +
          '<div class="notification-item-content">' +
            '<span class="notification-message">' + (n.message || '').replace(/</g, '&lt;') + '</span>' +
            '<span class="notification-time">' + (n.createdAt ? new Date(n.createdAt).toLocaleString('ru-RU') : '') + '</span>' +
          '</div>' +
          (cardBtn ? '<div class="notification-item-actions">' + cardBtn + '</div>' : '') +
          '</li>';
      });
      listHtml += '</ul></div>';
    });
    if (!listHtml) listHtml = '<ul class="notification-list"><li class="notification-item notification-empty">Нет уведомлений</li></ul>';
    container.innerHTML =
      '<div class="notification-center">' +
        '<section class="notification-section" aria-labelledby="notif-section-title">' +
          '<h2 id="notif-section-title" class="notification-section-title">Уведомления</h2>' +
          '<div class="notification-center-header">' +
            '<button type="button" class="small-btn" id="notifCheckNow">Проверить сейчас</button>' +
            '<button type="button" class="small-btn" id="notifClearHistory">Очистить историю</button>' +
          '</div>' +
          '<div class="notification-groups">' + listHtml + '</div>' +
        '</section>' +
        '<section class="notification-section plans-section" aria-labelledby="plans-section-title">' +
          '<h2 id="plans-section-title" class="notification-section-title">Планы</h2>' +
          '<div id="tasks-list-container" class="tasks-list-container"></div>' +
        '</section>' +
      '</div>';
    var tasksContainer = document.getElementById('tasks-list-container');
    if (tasksContainer) renderTasksList(tasksContainer);
    var checkBtn = document.getElementById('notifCheckNow');
    var clearBtn = document.getElementById('notifClearHistory');
    if (checkBtn) {
      checkBtn.addEventListener('click', function () {
        checkUpcomingEvents();
        renderNotificationCenter(containerId);
      });
    }
    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        saveHistory([]);
        renderNotificationCenter(containerId);
        updateNotificationIndicators();
      });
    }
    container.querySelectorAll('.notification-item[data-notif-id]').forEach(function (item) {
      item.addEventListener('click', function (ev) {
        if (ev.target.closest('.notification-view-card-btn')) return;
        var id = item.getAttribute('data-notif-id');
        if (markNotificationRead(id)) renderNotificationCenter(containerId);
      });
    });
    container.querySelectorAll('.notification-view-card-btn').forEach(function (btn) {
      btn.addEventListener('click', function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        var cattleId = btn.getAttribute('data-cattle-id');
        if (cattleId && typeof viewCow === 'function') viewCow(cattleId);
      });
    });
    updateNotificationIndicators();
  }

  function initNotifications() {
    scheduleReminders();
    if (typeof window.requestNotificationPermission === 'undefined') {
      window.requestNotificationPermission = requestNotificationPermission;
    }
    if (document.getElementById('menuNotificationsBody')) {
      renderNotificationSummary('menuNotificationsBody');
    } else {
      updateNotificationIndicators();
    }
  }

  if (typeof window !== 'undefined') {
    window.checkUpcomingEvents = checkUpcomingEvents;
    window.createNotification = createNotification;
    window.scheduleReminders = scheduleReminders;
    window.getNotificationHistory = getNotificationHistory;
    window.getUnreadNotificationCount = getUnreadCount;
    window.markNotificationRead = markNotificationRead;
    window.updateNotificationIndicators = updateNotificationIndicators;
    window.renderNotificationSummary = renderNotificationSummary;
    window.renderNotificationCenter = renderNotificationCenter;
    window.requestNotificationPermission = requestNotificationPermission;
    window.renderTasksScreen = function () {
      var el = document.getElementById('tasksScreenContainer');
      if (el) renderTasksList(el);
    };
    window.getProtocolTasks = getProtocolTasks;
  }

  if (typeof window !== 'undefined' && window.document) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initNotifications);
    } else {
      initNotifications();
    }
  }
})(typeof window !== 'undefined' ? window : this);

// === js/features/analytics-calc.js
/**
 * analytics-calc.js — расчёты аналитики: PR, CR, HDR, сервис-период, границы периода.
 * Использует глобальные entries. Подключать перед analytics.js.
 */
function parseDate(str) {
  if (!str) return null;
  var d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

function getPeriodBounds(period, dateFrom, dateTo) {
  if (period === 'custom') {
    var start = parseDate(dateFrom);
    var end = parseDate(dateTo);
    if (start && end) return { start: start, end: end };
    var now = new Date();
    return { start: new Date(now.getFullYear(), now.getMonth() - 1, 1), end: new Date(now) };
  }
  var now = new Date();
  var start = new Date(now);
  if (period === 'month') {
    start.setMonth(start.getMonth() - 1);
  } else if (period === 'quarter') {
    start.setMonth(start.getMonth() - 3);
  } else if (period === 'year') {
    start.setFullYear(start.getFullYear() - 1);
  } else {
    start.setMonth(start.getMonth() - 1);
  }
  return { start: start, end: new Date(now) };
}

function addDays(d, days) {
  var r = new Date(d);
  r.setDate(r.getDate() + days);
  return r;
}

function getInseminationDates(entry) {
  var list = [];
  if (entry.inseminationHistory && entry.inseminationHistory.length > 0) {
    entry.inseminationHistory.forEach(function (h) {
      if (h.date) list.push(h.date);
    });
  } else if (entry.inseminationDate) {
    list.push(entry.inseminationDate);
  }
  list.sort();
  return list;
}

function getLastInseminationDateInPeriod(entry, bounds) {
  var dates = getInseminationDates(entry);
  var last = null;
  for (var i = 0; i < dates.length; i++) {
    var d = parseDate(dates[i]);
    if (d && d >= bounds.start && d <= bounds.end) last = d;
  }
  return last;
}

function countInseminationsInPeriod(entry, bounds, pdo) {
  var calv = parseDate(entry.calvingDate);
  var pdoEnd = calv ? addDays(calv, pdo) : null;
  var dates = getInseminationDates(entry);
  var n = 0;
  for (var i = 0; i < dates.length; i++) {
    var d = parseDate(dates[i]);
    if (!d || d < bounds.start || d > bounds.end) continue;
    if (pdoEnd && d < pdoEnd) continue;
    n++;
  }
  return n;
}

function isPregnant(entry) {
  var s = (entry.status || '').toString();
  return s.indexOf('Отёл') !== -1 || s.indexOf('Стельная') !== -1;
}

function isBrak(entry) {
  return (entry.status || '').toString().indexOf('Брак') !== -1;
}

function hasLactationOnePlus(entry) {
  var l = entry.lactation;
  if (l === undefined || l === null || l === '') return false;
  var n = parseInt(l, 10);
  return !isNaN(n) && n >= 1;
}

function getFilteredEntries(period, dateFrom, dateTo, pdo) {
  var list = typeof entries !== 'undefined' ? entries : [];
  var bounds = getPeriodBounds(period, dateFrom, dateTo);
  pdo = parseInt(pdo, 10) || 0;
  return list.filter(function (e) {
    if (isBrak(e)) return false;
    if (!hasLactationOnePlus(e)) return false;
    var calv = parseDate(e.calvingDate);
    if (!calv) return false;
    var pdoEnd = addDays(calv, pdo);
    if (pdoEnd > bounds.end) return false;
    var d = parseDate(e.inseminationDate) || parseDate(e.calvingDate) || parseDate(e.dateAdded);
    return d && d >= bounds.start && d <= bounds.end;
  });
}

function daysBetween(from, to) {
  if (!from || !to) return null;
  var a = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  var b = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((b - a) / (24 * 60 * 60 * 1000));
}

function calculateCR(list, bounds, pdo) {
  if (!list || list.length === 0) return 0;
  pdo = parseInt(pdo, 10) || 0;
  var totalInsem = 0;
  var pregnantFromPeriod = 0;
  for (var i = 0; i < list.length; i++) {
    var e = list[i];
    var n = countInseminationsInPeriod(e, bounds, pdo);
    totalInsem += n;
    if (isPregnant(e) && getLastInseminationDateInPeriod(e, bounds)) {
      pregnantFromPeriod++;
    }
  }
  if (totalInsem === 0) return 0;
  return Math.round((pregnantFromPeriod / totalInsem) * 1000) / 10;
}

function calculateHDR(list, bounds, pdo) {
  if (!list || list.length === 0) return 0;
  pdo = parseInt(pdo, 10) || 0;
  var sumRatio = 0;
  var count = 0;
  for (var i = 0; i < list.length; i++) {
    var e = list[i];
    var lastInPeriod = getLastInseminationDateInPeriod(e, bounds);
    if (!lastInPeriod) continue;
    var calv = parseDate(e.calvingDate);
    if (!calv) continue;
    var pdoDate = addDays(calv, pdo);
    if (lastInPeriod < pdoDate) continue;
    var days = daysBetween(pdoDate, lastInPeriod);
    if (days == null) continue;
    var ratio = days / 21;
    sumRatio += Math.min(1, ratio);
    count++;
  }
  if (count === 0) return 0;
  var avg = (sumRatio / count) * 100;
  return Math.round(Math.min(100, avg) * 10) / 10;
}

function calculatePR(hdr, cr) {
  return Math.round((hdr / 100) * (cr / 100) * 1000) / 10;
}

function averageServicePeriod(list) {
  if (!list) return null;
  var withBoth = list.filter(function (e) { return e.calvingDate && (getInseminationDates(e).length > 0); });
  if (withBoth.length === 0) return null;
  var sum = 0, count = 0;
  withBoth.forEach(function (e) {
    var calv = parseDate(e.calvingDate);
    var dates = getInseminationDates(e);
    if (!calv || dates.length === 0) return;
    var firstInsem = parseDate(dates[0]);
    if (firstInsem && firstInsem >= calv) {
      sum += daysBetween(calv, firstInsem);
      count++;
    }
  });
  return count ? Math.round(sum / count) : null;
}

function generateReport(period, dateFrom, dateTo, pdo, listOverride) {
  var list = listOverride != null ? listOverride : getFilteredEntries(period, dateFrom, dateTo, pdo);
  var bounds = getPeriodBounds(period, dateFrom, dateTo);
  pdo = parseInt(pdo, 10) || 0;
  var cr = calculateCR(list, bounds, pdo);
  var hdr = calculateHDR(list, bounds, pdo);
  var pr = calculatePR(hdr, cr);
  var serv = averageServicePeriod(list);
  var inseminatedCount = 0;
  var pregnantCount = 0;
  list.forEach(function (e) {
    if (countInseminationsInPeriod(e, bounds, pdo) > 0) inseminatedCount++;
    if (isPregnant(e)) pregnantCount++;
  });
  var totalInseminations = 0;
  list.forEach(function (e) { totalInseminations += countInseminationsInPeriod(e, bounds, pdo); });
  return {
    period: period,
    bounds: bounds,
    dateFrom: dateFrom,
    dateTo: dateTo,
    pdo: pdo,
    totalCows: list.length,
    pr: pr,
    cr: cr,
    hdr: hdr,
    servicePeriodDays: serv,
    inseminatedCount: inseminatedCount,
    pregnantCount: pregnantCount,
    totalInseminations: totalInseminations
  };
}

function getBreakdownKey(entry, breakdownBy) {
  if (breakdownBy === 'group') return (entry.group || '').trim() || '—';
  if (breakdownBy === 'lactation') return entry.lactation !== undefined && entry.lactation !== '' ? String(entry.lactation) : '—';
  if (breakdownBy === 'inseminator') return (entry.inseminator || '').trim() || '—';
  if (breakdownBy === 'bull') return (entry.bull || '').trim() || '—';
  return '—';
}

function getMonthsInRange(bounds) {
  var months = [];
  var d = new Date(bounds.start.getFullYear(), bounds.start.getMonth(), 1);
  var end = new Date(bounds.end.getFullYear(), bounds.end.getMonth(), 1);
  while (d <= end) {
    months.push({
      start: new Date(d.getFullYear(), d.getMonth(), 1),
      end: new Date(d.getFullYear(), d.getMonth() + 1, 0)
    });
    d.setMonth(d.getMonth() + 1);
  }
  return months;
}

function monthLabel(m) {
  var names = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  return names[m.start.getMonth()] + ' ' + m.start.getFullYear();
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    parseDate: parseDate,
    getPeriodBounds: getPeriodBounds,
    addDays: addDays,
    getInseminationDates: getInseminationDates,
    daysBetween: daysBetween,
    calculateCR: calculateCR,
    calculateHDR: calculateHDR,
    calculatePR: calculatePR,
    isPregnant: isPregnant,
    averageServicePeriod: averageServicePeriod,
    generateReport: generateReport
  };
}

// === js/features/analytics.js
/**
 * analytics.js — Аналитика и отчёты (PR, CR, HDR, сервис-период, графики)
 * План: произвольный период, ПДО, формулы PR=HDR*CR, разбивка, динамика по месяцам, настройки.
 */
(function (global) {
  'use strict';

  var chartInstances = [];
  var SETTINGS_KEY = 'cattleTracker_analytics_settings';

  /* Расчёты PR/CR/HDR и периода — в analytics-calc.js (глобальные функции) */

  function renderCharts(containerId, report, monthlyData, bounds, pdo) {
    var container = document.getElementById(containerId);
    if (!container || typeof Chart === 'undefined') return;
    chartInstances.forEach(function (c) { try { c.destroy(); } catch (e) {} });
    chartInstances = [];

    var pdoVal = (report && report.pdo !== undefined) ? report.pdo : (pdo || 0);
    var list = getFilteredEntries(report.period, report.dateFrom, report.dateTo, pdoVal);
    var statusCounts = {};
    list.forEach(function (e) {
      var s = (e.status || '—').toString();
      if (isBrak(e)) return;
      statusCounts[s] = (statusCounts[s] || 0) + 1;
    });

    var html = '';
    if (monthlyData && monthlyData.length > 0) {
      html += '<div class="analytics-chart-wrapper"><canvas id="analyticsChartMonthly"></canvas></div>';
    }
    html += '<div class="analytics-chart-wrapper"><canvas id="analyticsChartIndicators"></canvas></div>';
    html += '<div class="analytics-chart-wrapper"><canvas id="analyticsChartStatus"></canvas></div>';
    container.innerHTML = html;

    if (monthlyData && monthlyData.length > 0) {
      var ctxM = document.getElementById('analyticsChartMonthly');
      if (ctxM) {
        var chM = new Chart(ctxM.getContext('2d'), {
          type: 'line',
          data: {
            labels: monthlyData.map(function (m) { return m.label; }),
            datasets: [
              { label: 'PR %', data: monthlyData.map(function (m) { return m.pr; }), borderColor: '#4a90e2', backgroundColor: 'transparent', tension: 0.2 },
              { label: 'CR %', data: monthlyData.map(function (m) { return m.cr; }), borderColor: '#4caf50', backgroundColor: 'transparent', tension: 0.2 },
              { label: 'HDR %', data: monthlyData.map(function (m) { return m.hdr; }), borderColor: '#ff9800', backgroundColor: 'transparent', tension: 0.2 }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: true,
            scales: { y: { beginAtZero: true, max: 100 } },
            plugins: { legend: { position: 'top' } }
          }
        });
        chartInstances.push(chM);
      }
    }

    var ctx1 = document.getElementById('analyticsChartIndicators');
    if (ctx1) {
      var ch1 = new Chart(ctx1.getContext('2d'), {
        type: 'bar',
        data: {
          labels: ['PR (%)', 'CR (%)', 'HDR (%)', 'Сервис-период (дн.)'],
          datasets: [{
            label: 'Значение',
            data: [
              report ? report.pr : 0,
              report ? report.cr : 0,
              report ? report.hdr : 0,
              report && report.servicePeriodDays != null ? report.servicePeriodDays : 0
            ],
            backgroundColor: ['#4a90e2', '#4caf50', '#ff9800', '#9c27b0']
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          scales: { y: { beginAtZero: true } },
          plugins: { legend: { display: false } }
        }
      });
      chartInstances.push(ch1);
    }
    var ctx2 = document.getElementById('analyticsChartStatus');
    if (ctx2 && Object.keys(statusCounts).length > 0) {
      var ch2 = new Chart(ctx2.getContext('2d'), {
        type: 'doughnut',
        data: {
          labels: Object.keys(statusCounts),
          datasets: [{
            data: Object.keys(statusCounts).map(function (k) { return statusCounts[k]; }),
            backgroundColor: ['#4a90e2', '#4caf50', '#ff9800', '#f44336', '#9c27b0', '#00bcd4']
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: { legend: { position: 'right' } }
        }
      });
      chartInstances.push(ch2);
    }
  }

  function getAnalyticsSettings() {
    try {
      var raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        var o = JSON.parse(raw);
        return {
          period: o.period || 'month',
          dateFrom: o.dateFrom || '',
          dateTo: o.dateTo || '',
          pdo: o.pdo !== undefined ? o.pdo : 50,
          breakdownBy: o.breakdownBy || ''
        };
      }
    } catch (e) {}
    var now = new Date();
    var start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return {
      period: 'month',
      dateFrom: start.toISOString().slice(0, 10),
      dateTo: now.toISOString().slice(0, 10),
      pdo: 50,
      breakdownBy: ''
    };
  }

  function saveAnalyticsSettings() {
    var periodSelect = document.getElementById('analyticsPeriod');
    var dateFromEl = document.getElementById('analyticsDateFrom');
    var dateToEl = document.getElementById('analyticsDateTo');
    var pdoEl = document.getElementById('analyticsPdo');
    var breakdownEl = document.getElementById('analyticsBreakdown');
    var o = {
      period: (periodSelect && periodSelect.value) ? periodSelect.value : 'month',
      dateFrom: (dateFromEl && dateFromEl.value) ? dateFromEl.value : '',
      dateTo: (dateToEl && dateToEl.value) ? dateToEl.value : '',
      pdo: (pdoEl && pdoEl.value !== '') ? parseInt(pdoEl.value, 10) : 50,
      breakdownBy: (breakdownEl && breakdownEl.value) ? breakdownEl.value : ''
    };
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(o));
    } catch (e) {}
  }

  function applySettingsToUI(settings) {
    var periodSelect = document.getElementById('analyticsPeriod');
    var dateFromEl = document.getElementById('analyticsDateFrom');
    var dateToEl = document.getElementById('analyticsDateTo');
    var pdoEl = document.getElementById('analyticsPdo');
    var breakdownEl = document.getElementById('analyticsBreakdown');
    var customDates = document.getElementById('analyticsCustomDates');
    if (periodSelect) periodSelect.value = settings.period || 'month';
    if (dateFromEl) dateFromEl.value = settings.dateFrom || '';
    if (dateToEl) dateToEl.value = settings.dateTo || '';
    if (pdoEl) pdoEl.value = String(settings.pdo !== undefined ? settings.pdo : 50);
    if (breakdownEl) breakdownEl.value = settings.breakdownBy || '';
    if (customDates) customDates.style.display = (settings.period === 'custom') ? 'inline-flex' : 'none';
  }

  function updatePeriodDatesFromPreset(period) {
    var bounds = getPeriodBounds(period, null, null);
    var dateFromEl = document.getElementById('analyticsDateFrom');
    var dateToEl = document.getElementById('analyticsDateTo');
    if (dateFromEl) dateFromEl.value = bounds.start.toISOString().slice(0, 10);
    if (dateToEl) dateToEl.value = bounds.end.toISOString().slice(0, 10);
  }

  function renderAnalyticsScreen() {
    var periodSelect = document.getElementById('analyticsPeriod');
    var period = (periodSelect && periodSelect.value) ? periodSelect.value : 'month';
    var dateFromEl = document.getElementById('analyticsDateFrom');
    var dateToEl = document.getElementById('analyticsDateTo');
    var dateFrom = (dateFromEl && dateFromEl.value) ? dateFromEl.value : '';
    var dateTo = (dateToEl && dateToEl.value) ? dateToEl.value : '';
    var pdoEl = document.getElementById('analyticsPdo');
    var pdo = (pdoEl && pdoEl.value !== '') ? parseInt(pdoEl.value, 10) : 50;
    var breakdownEl = document.getElementById('analyticsBreakdown');
    var breakdownBy = (breakdownEl && breakdownEl.value) ? breakdownEl.value : '';

    if (period !== 'custom') updatePeriodDatesFromPreset(period);

    var report = generateReport(period, dateFrom, dateTo, pdo);
    var indicatorsEl = document.getElementById('analyticsIndicators');
    if (indicatorsEl) {
      indicatorsEl.innerHTML =
        '<div class="analytics-cards">' +
          '<div class="analytics-card"><div class="analytics-card-value">' + report.pr + '%</div><div class="analytics-card-label">PR (стельность)</div></div>' +
          '<div class="analytics-card"><div class="analytics-card-value">' + report.cr + '%</div><div class="analytics-card-label">CR (оплодотворение)</div></div>' +
          '<div class="analytics-card"><div class="analytics-card-value">' + report.hdr + '%</div><div class="analytics-card-label">HDR (охота)</div></div>' +
          '<div class="analytics-card"><div class="analytics-card-value">' + (report.servicePeriodDays != null ? report.servicePeriodDays : '—') + '</div><div class="analytics-card-label">Сервис-период (дн.)</div></div>' +
          '<div class="analytics-card"><div class="analytics-card-value">' + report.inseminatedCount + '</div><div class="analytics-card-label">Осеменено</div></div>' +
          '<div class="analytics-card"><div class="analytics-card-value">' + report.pregnantCount + '</div><div class="analytics-card-label">Стельных</div></div>' +
        '</div>';
    }

    var breakdownTableEl = document.getElementById('analyticsBreakdownTable');
    if (breakdownTableEl) {
      if (breakdownBy) {
        var list = getFilteredEntries(period, dateFrom, dateTo, pdo);
        var groups = {};
        list.forEach(function (e) {
          var k = getBreakdownKey(e, breakdownBy);
          if (!groups[k]) groups[k] = [];
          groups[k].push(e);
        });
        var colLabel = breakdownBy === 'group' ? 'Группа' : breakdownBy === 'lactation' ? 'Лактация' : breakdownBy === 'inseminator' ? 'Осеменатор' : 'Бык';
        var rows = [];
        Object.keys(groups).sort().forEach(function (k) {
          var subList = groups[k];
          var subReport = generateReport(period, dateFrom, dateTo, pdo, subList);
          rows.push({
            key: k,
            pr: subReport.pr,
            cr: subReport.cr,
            hdr: subReport.hdr,
            inseminatedCount: subReport.inseminatedCount,
            pregnantCount: subReport.pregnantCount
          });
        });
        var tableHtml = '<table class="analytics-breakdown-table"><thead><tr><th>' + colLabel + '</th><th>PR %</th><th>CR %</th><th>HDR %</th><th>Осеменено</th><th>Стельных</th></tr></thead><tbody>';
        rows.forEach(function (r) {
          tableHtml += '<tr><td>' + escapeHtml(r.key) + '</td><td>' + r.pr + '</td><td>' + r.cr + '</td><td>' + r.hdr + '</td><td>' + r.inseminatedCount + '</td><td>' + r.pregnantCount + '</td></tr>';
        });
        tableHtml += '</tbody></table>';
        breakdownTableEl.innerHTML = tableHtml;
        breakdownTableEl.style.display = 'block';
      } else {
        breakdownTableEl.innerHTML = '';
        breakdownTableEl.style.display = 'none';
      }
    }

    var monthlyData = [];
    var bounds = getPeriodBounds(period, dateFrom, dateTo);
    var months = getMonthsInRange(bounds);
    months.forEach(function (m) {
      var fromStr = m.start.toISOString().slice(0, 10);
      var toStr = m.end.toISOString().slice(0, 10);
      var listM = getFilteredEntries('custom', fromStr, toStr, pdo);
      var r = generateReport('custom', fromStr, toStr, pdo, listM);
      monthlyData.push({
        label: monthLabel(m),
        pr: r.pr,
        cr: r.cr,
        hdr: r.hdr
      });
    });

    renderCharts('analyticsCharts', report, monthlyData, bounds, pdo);
    saveAnalyticsSettings();
  }

  function escapeHtml(text) {
    var s = String(text == null ? '' : text);
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function initAnalytics() {
    var settings = getAnalyticsSettings();
    applySettingsToUI(settings);

    var periodSelect = document.getElementById('analyticsPeriod');
    var customDates = document.getElementById('analyticsCustomDates');
    if (periodSelect) {
      periodSelect.addEventListener('change', function () {
        var isCustom = periodSelect.value === 'custom';
        if (customDates) customDates.style.display = isCustom ? 'inline-flex' : 'none';
        if (!isCustom) updatePeriodDatesFromPreset(periodSelect.value);
        renderAnalyticsScreen();
      });
    }
    var dateFromEl = document.getElementById('analyticsDateFrom');
    var dateToEl = document.getElementById('analyticsDateTo');
    if (dateFromEl) dateFromEl.addEventListener('change', renderAnalyticsScreen);
    if (dateToEl) dateToEl.addEventListener('change', renderAnalyticsScreen);
    var pdoEl = document.getElementById('analyticsPdo');
    if (pdoEl) pdoEl.addEventListener('change', renderAnalyticsScreen);
    var breakdownEl = document.getElementById('analyticsBreakdown');
    if (breakdownEl) breakdownEl.addEventListener('change', renderAnalyticsScreen);

    var refreshBtn = document.getElementById('analyticsRefreshBtn');
    if (refreshBtn) refreshBtn.addEventListener('click', renderAnalyticsScreen);
  }

  /** Интервалы между ИО для интервального анализа: подписи и границы (дни) */
  var INTERVAL_BUCKETS = [
    { label: '1-3 дня', min: 1, max: 3 },
    { label: '4-17 дней', min: 4, max: 17 },
    { label: '18-24 дня', min: 18, max: 24 },
    { label: '25-35 дней', min: 25, max: 35 },
    { label: '36-48 дней', min: 36, max: 48 },
    { label: 'Свыше 48 дней', min: 49, max: null }
  ];

  var intervalAnalysisFilter = { lactation: null };

  /**
   * Собирает статистику по интервалам между осеменениями (по всем животным, внутри лактации).
   * В анализ не включаются животные с одной попыткой осеменения (только попытка 1).
   * «Нет данных» — для осеменений с попыткой 2 и более, у которых нет предыдущего осеменения в той же лактации для расчёта интервала.
   * Фильтр по лактации: '' = все, '0' = тёлки, '1' = первотелки, '2+' = 2 и более, '1+2+' = лактирующие (1 и 2+).
   * @param {{ lactation: string|null }} [filter] — lactation: null/'' = все, '0', '1', '2+', '1+2+'
   * @returns {{ buckets: Array<{label: string, count: number}>, noDataCount: number, total: number }}
   */
  function getIntervalAnalysisData(filter) {
    var counts = {};
    INTERVAL_BUCKETS.forEach(function (b) { counts[b.label] = 0; });
    var noDataCount = 0;
    var list = typeof entries !== 'undefined' ? entries : [];
    var filterLact = filter && filter.lactation !== undefined && filter.lactation !== null && filter.lactation !== '' ? String(filter.lactation) : '';
    var getList = typeof getInseminationListForEntry === 'function' ? getInseminationListForEntry : function () { return []; };
    for (var i = 0; i < list.length; i++) {
      var entry = list[i];
      if (filterLact !== '') {
        var entryLact = entry.lactation === undefined || entry.lactation === null || entry.lactation === '' ? null : parseInt(entry.lactation, 10);
        if (entryLact === null || isNaN(entryLact)) continue;
        if (filterLact === '0' && entryLact !== 0) continue;
        if (filterLact === '1' && entryLact !== 1) continue;
        if (filterLact === '2+' && entryLact < 2) continue;
        if (filterLact === '1+2+' && entryLact < 1) continue;
      }
      var rows = getList(entry);
      if (rows.length < 2) continue;
      for (var j = 0; j < rows.length; j++) {
        var val = rows[j].daysFromPrevious;
        if (val === '—' || val === undefined || val === null || val === '') {
          noDataCount++;
          continue;
        }
        var num = parseInt(val, 10);
        if (isNaN(num)) {
          noDataCount++;
          continue;
        }
        var found = false;
        for (var k = 0; k < INTERVAL_BUCKETS.length; k++) {
          var b = INTERVAL_BUCKETS[k];
          if (b.max !== null && num >= b.min && num <= b.max) {
            counts[b.label]++;
            found = true;
            break;
          }
          if (b.max === null && num >= b.min) {
            counts[b.label]++;
            found = true;
            break;
          }
        }
        if (!found) noDataCount++;
      }
    }
    var total = noDataCount;
    INTERVAL_BUCKETS.forEach(function (b) { total += counts[b.label]; });
    return {
      buckets: INTERVAL_BUCKETS.map(function (b) { return { label: b.label, count: counts[b.label] }; }),
      noDataCount: noDataCount,
      total: total
    };
  }

  function renderIntervalAnalysisFilterUI() {
    var container = document.getElementById('intervalAnalysisFilter');
    if (!container) return;
    var lactVal = intervalAnalysisFilter.lactation !== null && intervalAnalysisFilter.lactation !== '' ? String(intervalAnalysisFilter.lactation) : '';
    var options = '<option value="">Все лактации</option>' +
      '<option value="0"' + (lactVal === '0' ? ' selected' : '') + '>0 (тёлки)</option>' +
      '<option value="1"' + (lactVal === '1' ? ' selected' : '') + '>1 (первотелки)</option>' +
      '<option value="2+"' + (lactVal === '2+' ? ' selected' : '') + '>2+ (коровы)</option>' +
      '<option value="1+2+"' + (lactVal === '1+2+' ? ' selected' : '') + '>1 + 2+ (лактирующие)</option>';
    container.innerHTML =
      '<div class="search-filter-bar analytics-interval-filter-bar">' +
        '<div class="filter-row">' +
          '<span class="filter-label">Лактация:</span>' +
          '<select id="intervalAnalysisLactation" class="analytics-interval-select" aria-label="Фильтр по лактации">' + options + '</select>' +
        '</div>' +
      '</div>';
    var selectEl = document.getElementById('intervalAnalysisLactation');
    if (selectEl) {
      selectEl.addEventListener('change', function () {
        var v = selectEl.value;
        intervalAnalysisFilter.lactation = (v === '' || v === null) ? null : v;
        renderIntervalAnalysisScreen();
      });
    }
  }

  function renderIntervalAnalysisScreen() {
    var filterContainer = document.getElementById('intervalAnalysisFilter');
    if (filterContainer && !filterContainer.dataset.rendered) {
      filterContainer.dataset.rendered = '1';
      renderIntervalAnalysisFilterUI();
    }
    var container = document.getElementById('intervalAnalysisTable');
    if (!container) return;
    var data = getIntervalAnalysisData(intervalAnalysisFilter);
    var total = data.total;
    var rows = data.buckets.map(function (b) {
      var pct = total > 0 ? Math.round((b.count / total) * 100) : 0;
      return '<tr><td>' + escapeHtml(b.label) + '</td><td>' + b.count + '</td><td>' + pct + '%</td></tr>';
    });
    var noDataPct = total > 0 ? Math.round((data.noDataCount / total) * 100) : 0;
    rows.push('<tr><td>Нет данных</td><td>' + data.noDataCount + '</td><td>' + noDataPct + '%</td></tr>');
    var totalPct = total > 0 ? 100 : 0;
    rows.push('<tr class="analytics-interval-total"><td>Всего</td><td>' + total + '</td><td>' + totalPct + '%</td></tr>');
    container.innerHTML =
      '<table class="analytics-interval-table">' +
      '<thead><tr><th>Интервал между ИО</th><th>Количество, шт</th><th>Процент, %</th></tr></thead>' +
      '<tbody>' + rows.join('') + '</tbody></table>';
  }

  if (typeof window !== 'undefined') {
    window.calculatePR = function (hdr, cr) { return calculatePR(hdr, cr); };
    window.calculateCR = calculateCR;
    window.calculateHDR = calculateHDR;
    window.generateReport = generateReport;
    window.renderCharts = renderCharts;
    window.renderAnalyticsScreen = renderAnalyticsScreen;
    window.renderIntervalAnalysisScreen = renderIntervalAnalysisScreen;
    window.getAnalyticsFilteredEntries = getFilteredEntries;
    window.getPeriodBounds = getPeriodBounds;
  }

  if (typeof window !== 'undefined' && window.document) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initAnalytics);
    } else {
      initAnalytics();
    }
  }
})(typeof window !== 'undefined' ? window : this);

// === js/features/backup.js
/**
 * backup.js — Резервное копирование и восстановление
 */
(function (global) {
  'use strict';

  var BACKUP_PREFIX = 'cattleTracker_backup_';
  var MAX_BACKUPS = 10;

  function listBackups() {
    var keys = [];
    for (var i = 0; i < localStorage.length; i++) {
      var key = localStorage.key(i);
      if (key && key.indexOf(BACKUP_PREFIX) === 0) {
        keys.push(key);
      }
    }
    return keys.slice(0, MAX_BACKUPS * 2).map(function (key) {
      try {
        var raw = localStorage.getItem(key);
        var data = raw ? JSON.parse(raw) : {};
        return {
          key: key,
          createdAt: data.createdAt || key.replace(BACKUP_PREFIX, ''),
          count: (data.entries && data.entries.length) || 0
        };
      } catch (e) {
        return { key: key, createdAt: '', count: 0 };
      }
    }).sort(function (a, b) {
      return (b.createdAt || '').localeCompare(a.createdAt || '');
    });
  }

  function createBackup() {
    try {
      var entries = typeof window.entries !== 'undefined' ? window.entries : [];
      var stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      var key = BACKUP_PREFIX + stamp;
      var payload = {
        entries: JSON.parse(JSON.stringify(entries)),
        createdAt: new Date().toISOString(),
        count: entries.length
      };
      localStorage.setItem(key, JSON.stringify(payload));
      trimBackups();
      return { ok: true, key: key, count: entries.length };
    } catch (e) {
      return { ok: false, message: e && e.message };
    }
  }

  function trimBackups() {
    var keys = [];
    for (var i = 0; i < localStorage.length; i++) {
      var key = localStorage.key(i);
      if (key && key.indexOf(BACKUP_PREFIX) === 0) keys.push(key);
    }
    if (keys.length <= MAX_BACKUPS) return;
    keys.sort();
    keys.slice(0, keys.length - MAX_BACKUPS).forEach(function (k) {
      try { localStorage.removeItem(k); } catch (e) {}
    });
  }

  function restoreBackup(backupKey) {
    try {
      var raw = localStorage.getItem(backupKey);
      if (!raw) return { ok: false, message: 'Резервная копия не найдена' };
      var data = JSON.parse(raw);
      if (!data.entries || !Array.isArray(data.entries)) {
        return { ok: false, message: 'Неверный формат копии' };
      }
      if (typeof window.entries !== 'undefined') {
        window.entries.length = 0;
        data.entries.forEach(function (e) { window.entries.push(e); });
      }
      if (typeof saveLocally === 'function') saveLocally();
      if (typeof updateViewList === 'function') updateViewList();
      if (typeof updateList === 'function') updateList();
      if (typeof updateHerdStats === 'function') updateHerdStats();
      return { ok: true, count: data.entries.length };
    } catch (e) {
      return { ok: false, message: e && e.message };
    }
  }

  function exportBackupToFile() {
    var entries = typeof window.entries !== 'undefined' ? window.entries : [];
    var payload = {
      entries: entries,
      exportedAt: new Date().toISOString(),
      count: entries.length
    };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'cattle-tracker-backup-' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  function importBackupFromFile(file) {
    return new Promise(function (resolve) {
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var data = JSON.parse(reader.result);
          var list = data.entries || (Array.isArray(data) ? data : []);
          if (!Array.isArray(list)) {
            resolve({ ok: false, message: 'Неверный формат файла' });
            return;
          }
          if (typeof window.entries !== 'undefined') {
            window.entries.length = 0;
            list.forEach(function (e) { window.entries.push(e); });
          }
          if (typeof saveLocally === 'function') saveLocally();
          if (typeof updateViewList === 'function') updateViewList();
          if (typeof updateList === 'function') updateList();
          if (typeof updateHerdStats === 'function') updateHerdStats();
          resolve({ ok: true, count: list.length });
        } catch (e) {
          resolve({ ok: false, message: e && e.message });
        }
      };
      reader.onerror = function () { resolve({ ok: false, message: 'Ошибка чтения файла' }); };
      reader.readAsText(file, 'UTF-8');
    });
  }

  function deleteBackup(backupKey) {
    try {
      localStorage.removeItem(backupKey);
      return { ok: true };
    } catch (e) {
      return { ok: false, message: e && e.message };
    }
  }

  function renderBackupUI(containerId) {
    var container = document.getElementById(containerId);
    if (!container) return;
    var backups = listBackups();
    container.innerHTML =
      '<div class="backup-actions">' +
        '<button type="button" class="action-btn small" id="backupCreateBtn">Создать резервную копию</button>' +
        '<button type="button" class="action-btn small" id="backupExportBtn">Экспорт в файл</button>' +
        '<label class="backup-import-label">Импорт из файла <input type="file" id="backupImportInput" accept=".json" style="display:none"></label>' +
      '</div>' +
      '<div class="backup-list-header">Сохранённые копии (localStorage)</div>' +
      '<ul class="backup-list">' +
        (backups.length === 0
          ? '<li class="backup-item backup-empty">Нет сохранённых копий</li>'
          : backups.map(function (b) {
              return '<li class="backup-item">' +
                '<span class="backup-info">' + (b.createdAt || b.key) + ' — записей: ' + (b.count || 0) + '</span>' +
                '<div class="backup-item-actions">' +
                  '<button type="button" class="small-btn" data-restore="' + b.key + '">Восстановить</button>' +
                  '<button type="button" class="small-btn delete" data-delete="' + b.key + '">Удалить</button>' +
                '</div></li>';
            }).join('')) +
      '</ul>';
    var createBtn = document.getElementById('backupCreateBtn');
    var exportBtn = document.getElementById('backupExportBtn');
    var importInput = document.getElementById('backupImportInput');
    if (createBtn) {
      createBtn.addEventListener('click', function () {
        var r = createBackup();
        if (r.ok) {
          if (typeof showToast === 'function') showToast('Копия создана, записей: ' + r.count, 'success');
          else alert('Копия создана');
          renderBackupUI(containerId);
        } else {
          if (typeof showToast === 'function') showToast(r.message || 'Ошибка', 'error');
          else alert(r.message);
        }
      });
    }
    if (exportBtn) exportBtn.addEventListener('click', exportBackupToFile);
    if (importInput) {
      importInput.addEventListener('change', function () {
        var file = importInput.files && importInput.files[0];
        if (!file) return;
        importBackupFromFile(file).then(function (r) {
          if (r.ok) {
            if (typeof showToast === 'function') showToast('Восстановлено записей: ' + r.count, 'success');
            else alert('Восстановлено');
            renderBackupUI(containerId);
          } else {
            if (typeof showToast === 'function') showToast(r.message || 'Ошибка', 'error');
            else alert(r.message);
          }
          importInput.value = '';
        });
      });
    }
    container.querySelectorAll('[data-restore]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var key = btn.getAttribute('data-restore');
        function doRestore() {
          var r = restoreBackup(key);
          if (r.ok) {
            if (typeof showToast === 'function') showToast('Восстановлено записей: ' + r.count, 'success');
            else alert('Восстановлено');
            renderBackupUI(containerId);
          } else {
            if (typeof showToast === 'function') showToast(r.message || 'Ошибка', 'error');
            else alert(r.message);
          }
        }
        if (typeof showConfirmModal === 'function') {
          showConfirmModal('Восстановить эту копию? Текущие данные будут заменены.').then(function (ok) { if (ok) doRestore(); });
          return;
        }
        if (!confirm('Восстановить эту копию? Текущие данные будут заменены.')) return;
        doRestore();
      });
    });
    container.querySelectorAll('[data-delete]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var key = btn.getAttribute('data-delete');
        deleteBackup(key);
        renderBackupUI(containerId);
      });
    });
  }

  if (typeof window !== 'undefined') {
    window.createBackup = createBackup;
    window.listBackups = listBackups;
    window.restoreBackup = restoreBackup;
    window.exportBackupToFile = exportBackupToFile;
    window.importBackupFromFile = importBackupFromFile;
    window.renderBackupUI = renderBackupUI;
  }
})(typeof window !== 'undefined' ? window : this);

// === js/features/view-list-fields.js
// view-list-fields.js — конфиг полей списка просмотра, шаблоны колонок, утилиты рендера

var VIEW_LIST_FIELDS_KEY = 'cattleTracker_viewList_visibleFields';
var VIEW_LIST_FIELD_TEMPLATES_KEY = 'cattleTracker_viewList_fieldTemplates';

/** Поля, которые можно редактировать прямо в списке (остальные только просмотр) */
var VIEW_LIST_EDITABLE_KEYS = {
  cattleId: 'text', nickname: 'text', group: 'text', birthDate: 'date', lactation: 'number',
  calvingDate: 'date', inseminationDate: 'date', attemptNumber: 'number', bull: 'text',
  inseminator: 'text', code: 'text', status: 'select', exitDate: 'date', dryStartDate: 'date',
  protocolName: 'text', protocolStartDate: 'date', note: 'text'
};
var STATUS_OPTIONS = ['Осемененная', 'Холостая', 'Стельная', 'Сухостой', 'Отёл', 'Брак'];

function viewListEscapeHtml(text) {
  if (!text) return '—';
  if (typeof text !== 'string') {
    try { text = String(text); } catch (e) { return '—'; }
  }
  text = text.replace(/[\x00-\x1F\x7F-\x9F]/g, '').trim();
  if (!text) return '—';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

var VIEW_LIST_FIELDS_DEFAULT = [
  { key: 'cattleId', label: 'Корова', sortable: true, render: function (entry) { return viewListEscapeHtml(entry.cattleId); } },
  { key: 'nickname', label: 'Кличка', sortable: true, render: function (entry) { return viewListEscapeHtml(entry.nickname); } },
  { key: 'group', label: 'Группа', sortable: true, render: function (entry) { return viewListEscapeHtml(entry.group || ''); } },
  { key: 'lactation', label: 'Лактация', sortable: true, render: function (entry) { return (entry.lactation !== undefined && entry.lactation !== null && entry.lactation !== '') || entry.lactation === 0 ? String(entry.lactation) : '—'; } },
  { key: 'inseminationDate', label: 'Дата осеменения', sortable: true, render: function (entry) { return formatDate(entry.inseminationDate) || '—'; } },
  { key: 'bull', label: 'Бык', sortable: true, render: function (entry) { return viewListEscapeHtml(entry.bull); } },
  { key: 'attemptNumber', label: 'Попытка', sortable: true, render: function (entry) { return entry.attemptNumber || '—'; } },
  { key: 'status', label: 'Статус', sortable: true, render: function (entry) { return viewListEscapeHtml(entry.status); } },
  { key: 'calvingDate', label: 'Отёл', sortable: true, render: function (entry) { return formatDate(entry.calvingDate) || '—'; } },
  { key: 'dryStartDate', label: 'Сухостой', sortable: true, render: function (entry) { return formatDate(entry.dryStartDate) || '—'; } },
  { key: 'note', label: 'Примечание', sortable: true, render: function (entry) { return viewListEscapeHtml(entry.note); } },
  { key: 'synced', label: 'Синхронизация', sortable: true, render: function (entry) { return entry.synced ? '✅' : '🟡'; } }
];
var VIEW_LIST_FIELDS = (typeof window.COW_FIELDS !== 'undefined' && window.COW_FIELDS.length > 0) ? window.COW_FIELDS : VIEW_LIST_FIELDS_DEFAULT;

function getVisibleFieldKeys() {
  try {
    var raw = localStorage.getItem(VIEW_LIST_FIELDS_KEY);
    if (raw) {
      var list = JSON.parse(raw);
      if (Array.isArray(list) && list.length > 0) return list;
    }
  } catch (e) {}
  return VIEW_LIST_FIELDS.map(function (f) { return f.key; });
}

function getFieldTemplates() {
  try {
    var raw = localStorage.getItem(VIEW_LIST_FIELD_TEMPLATES_KEY);
    if (raw) {
      var list = JSON.parse(raw);
      if (Array.isArray(list)) return list;
    }
  } catch (e) {}
  return [];
}

function saveFieldTemplates(list) {
  try {
    localStorage.setItem(VIEW_LIST_FIELD_TEMPLATES_KEY, JSON.stringify(list || []));
  } catch (e) {}
}

function getVisibleViewFields() {
  var keys = getVisibleFieldKeys();
  var map = {};
  VIEW_LIST_FIELDS.forEach(function (f) { map[f.key] = f; });
  return keys.map(function (k) { return map[k]; }).filter(Boolean);
}

// === js/features/view-list.js
// view-list.js — список на экране «Просмотр», массовое выделение (зависит от view-list-fields.js)

var viewListSortKey = '';
var viewListSortDir = 'asc';
var VIRTUAL_LIST_THRESHOLD = 200;
var VIRTUAL_ROW_HEIGHT = 40;
var viewListSelectedIds = new Set();
var viewListEditorMode = false;

function _compareViewList(a, b, key, dir) {
  var mul = dir === 'asc' ? 1 : -1;
  var va = a[key];
  var vb = b[key];
  if (key === 'protocolStartDate') {
    va = (a.protocol && a.protocol.startDate) || a.protocolStartDate;
    vb = (b.protocol && b.protocol.startDate) || b.protocolStartDate;
  }
  if (key === 'inseminationDate' || key === 'calvingDate' || key === 'dryStartDate' || key === 'birthDate' || key === 'exitDate' || key === 'protocolStartDate') {
    var da = va ? new Date(va).getTime() : 0;
    var db = vb ? new Date(vb).getTime() : 0;
    return mul * (da - db);
  }
  if (key === 'daysPregnant') {
    var na = typeof getDaysPregnant === 'function' ? getDaysPregnant(a) : null;
    var nb = typeof getDaysPregnant === 'function' ? getDaysPregnant(b) : null;
    na = (na != null && na !== '—') ? Number(na) : 0;
    nb = (nb != null && nb !== '—') ? Number(nb) : 0;
    return mul * (na - nb);
  }
  if (key === 'attemptNumber' || key === 'lactation') {
    var na = parseInt(va, 10);
    var nb = parseInt(vb, 10);
    if (isNaN(na)) na = 0;
    if (isNaN(nb)) nb = 0;
    return mul * (na - nb);
  }
  if (key === 'synced') {
    var ba = va === true || va === 'true';
    var bb = vb === true || vb === 'true';
    return mul * ((ba ? 1 : 0) - (bb ? 1 : 0));
  }
  var sa = (va != null ? String(va) : '').toLowerCase();
  var sb = (vb != null ? String(vb) : '').toLowerCase();
  return mul * (sa.localeCompare(sb, 'ru'));
}

/**
 * Обновляет список на экране просмотра
 */
function updateViewList() {
  var bulkContainer = document.getElementById('viewBulkActions');
  var tableContainer = document.getElementById('viewEntriesList');
  if (!tableContainer) return;

  var listFilteredFn = (typeof window !== 'undefined' && typeof window.getListViewFilteredEntries === 'function') ? window.getListViewFilteredEntries : (typeof getFilteredEntries === 'function' ? getFilteredEntries : null);
  var baseList = listFilteredFn ? listFilteredFn() : ((typeof window !== 'undefined' && window.entries && Array.isArray(window.entries)) ? window.entries : (entries || []));
  var listToShow = (typeof getVisibleEntries === 'function') ? getVisibleEntries(baseList) : baseList;
  if (listToShow && listToShow.length > 0 && viewListSortKey) {
    listToShow = listToShow.slice();
    listToShow.sort(function (a, b) { return _compareViewList(a, b, viewListSortKey, viewListSortDir); });
  }

  var bulkBarHtml = '<div class="bulk-actions-bar">' +
    '<div class="bulk-actions-left">' +
    '<button type="button" data-bulk-action="select-all" class="bulk-action-btn">✓ Выделить все</button>' +
    '<button type="button" data-bulk-action="deselect-all" class="bulk-action-btn">✗ Снять выделение</button>' +
    '<span id="selectedCount" class="selected-count">Выделено: 0</span>' +
    '</div>' +
    '<div class="bulk-actions-right">' +
    '<button type="button" data-bulk-action="delete-selected" class="bulk-action-btn delete-bulk" id="deleteSelectedBtn" disabled>🗑️ Удалить выделенные</button>' +
    '</div></div>';

  if (!listToShow || listToShow.length === 0) {
    var noResultsHint = (baseList.length === 0 && entries && entries.length > 0) ? ' (поиск/фильтр не дали результатов)' : ((entries && entries.length > 0 && listToShow.length === 0 && baseList.length > 0) ? ' (нет доступа)' : '');
    if (bulkContainer) bulkContainer.innerHTML = bulkBarHtml;
    if (bulkContainer) {
      var bar = bulkContainer.querySelector('.bulk-actions-bar');
      if (bar) {
        var btns = bar.querySelectorAll('button');
        btns.forEach(function (b) { b.disabled = true; });
      }
    }
    var emptyHtml = '<p>Нет записей' + noResultsHint + '</p>';
    if (baseList.length === 0 && entries && entries.length > 0 && typeof resetFiltersToDefault === 'function') {
      emptyHtml += '<p><button type="button" class="action-btn" id="viewListResetFiltersBtn">Сбросить фильтры и показать все записи</button></p>';
    }
    tableContainer.innerHTML = emptyHtml;
    var resetFiltersBtn = document.getElementById('viewListResetFiltersBtn');
    if (resetFiltersBtn) {
      resetFiltersBtn.addEventListener('click', function () {
        if (typeof resetFiltersToDefault === 'function') resetFiltersToDefault();
      });
    }
    var scrollBtnHide = document.getElementById('viewScrollToTopBtn');
    if (scrollBtnHide) scrollBtnHide.style.display = 'none';
    initViewFieldsSettings();
    initViewEditorModeButton();
    return;
  }

  if (bulkContainer) bulkContainer.innerHTML = bulkBarHtml;

  var fields = getVisibleViewFields();
  var fieldKeys = fields.map(function (f) { return f.key; });
  if (viewListSortKey && fieldKeys.indexOf(viewListSortKey) === -1) {
    viewListSortKey = '';
  }

  var sortAsc = viewListSortDir === 'asc';
  var sortMark = function (key) {
    if (viewListSortKey !== key) return '';
    return sortAsc ? ' <span class="sort-indicator" aria-hidden="true">▲</span>' : ' <span class="sort-indicator" aria-hidden="true">▼</span>';
  };
  var sortClass = function (key) {
    if (viewListSortKey !== key) return '';
    return sortAsc ? ' sort-asc' : ' sort-desc';
  };

  if (listToShow.length > VIRTUAL_LIST_THRESHOLD && !viewListEditorMode) {
    _renderVirtualList(tableContainer, listToShow, fields, sortMark, sortClass, bulkContainer);
    var viewScreen = document.getElementById('view-screen');
    if (viewScreen) {
      viewScreen.removeEventListener('click', _handleViewListClick);
      viewScreen.addEventListener('click', _handleViewListClick);
      viewScreen.removeEventListener('keydown', _handleViewListKeydown);
      viewScreen.addEventListener('keydown', _handleViewListKeydown);
    }
    initViewFieldsSettings();
    initViewEditorModeButton();
    setTimeout(function () { updateSelectedCount(); _assertBulkSelectionUI(); }, 0);
    var virtualBody = document.getElementById('viewVirtualBody');
    _setupScrollToTopForContainer(virtualBody || tableContainer);
    return;
  }

  viewListSelectedIds.clear();
  var tableClass = 'entries-table' + (viewListEditorMode ? ' view-list-editor-mode' : '');
  tableContainer.innerHTML = `
    <table class="${tableClass}">
      <thead>
        <tr>
          <th class="checkbox-column">
            <input type="checkbox" id="selectAllCheckbox" data-bulk-action="toggle-all" aria-label="Выделить все">
          </th>
          ${fields.map(field => {
            if (!field.sortable) return `<th>${field.label}</th>`;
            return `<th class="sortable-th${sortClass(field.key)}" data-sort-key="${field.key}" role="button" tabindex="0">${field.label}${sortMark(field.key)}</th>`;
          }).join('')}
        </tr>
      </thead>
      <tbody>
        ${listToShow.map((entry, index) => {
          const safeCattleId = viewListEscapeHtml(entry.cattleId);
          const checkboxId = `entry-checkbox-${index}`;
          const cells = fields.map(field => {
            const v = field.render(entry);
            const show = (field.key === 'lactation' && (v === 0 || v === '0')) ? '0' : v;
            var editable = viewListEditorMode && VIEW_LIST_EDITABLE_KEYS[field.key];
            return `<td data-field-key="${field.key}" ${editable ? ' class="editable-cell"' : ''}>${show}</td>`;
          }).join('');
          return `
          <tr class="view-entry-row ${entry.synced ? '' : 'unsynced'}" data-row-index="${index}" data-cattle-id="${safeCattleId.replace(/"/g, '&quot;')}" role="button" tabindex="0">
            <td class="checkbox-column">
              <input type="checkbox" id="${checkboxId}" class="entry-checkbox" data-cattle-id="${safeCattleId.replace(/"/g, '&quot;')}" aria-label="Выделить">
            </td>
            ${cells}
          </tr>
        `;
        }).join('')}
      </tbody>
    </table>
  `;

  var viewScreen = document.getElementById('view-screen');
  if (viewScreen) {
    viewScreen.removeEventListener('click', _handleViewListClick);
    viewScreen.addEventListener('click', _handleViewListClick);
    viewScreen.removeEventListener('keydown', _handleViewListKeydown);
    viewScreen.addEventListener('keydown', _handleViewListKeydown);
  }

  initViewFieldsSettings();
  initViewEditorModeButton();

  setTimeout(function () {
    updateSelectedCount();
    _assertBulkSelectionUI();
  }, 0);

  _setupScrollToTopForContainer(tableContainer);
}

function _setupScrollToTopForContainer(tableContainer) {
  var scrollBtn = document.getElementById('viewScrollToTopBtn');
  if (!scrollBtn) return;
  if (!tableContainer) {
    if (scrollBtn._scrollContainer) {
      scrollBtn._scrollContainer.removeEventListener('scroll', scrollBtn._scrollHandler);
      scrollBtn._scrollContainer = null;
      scrollBtn._scrollHandler = null;
    }
    scrollBtn.style.display = 'none';
    return;
  }
  var prevContainer = scrollBtn._scrollContainer;
  if (prevContainer && prevContainer !== tableContainer) {
    prevContainer.removeEventListener('scroll', scrollBtn._scrollHandler);
    scrollBtn._scrollContainer = null;
    scrollBtn._scrollHandler = null;
  }
  scrollBtn.style.display = tableContainer.scrollTop > 200 ? '' : 'none';
  if (scrollBtn._scrollContainer !== tableContainer) {
    scrollBtn._scrollContainer = tableContainer;
    scrollBtn._scrollHandler = function () {
      if (scrollBtn && scrollBtn._scrollContainer) scrollBtn.style.display = scrollBtn._scrollContainer.scrollTop > 200 ? '' : 'none';
    };
    tableContainer.addEventListener('scroll', scrollBtn._scrollHandler);
  }
  if (!scrollBtn.dataset.scrollClickBound) {
    scrollBtn.dataset.scrollClickBound = '1';
    scrollBtn.addEventListener('click', function () {
      var c = scrollBtn._scrollContainer;
      if (c) { c.scrollTop = 0; }
      if (scrollBtn) scrollBtn.style.display = 'none';
    });
  }
}

function _renderVirtualList(container, listToShow, fields, sortMark, sortClass, bulkContainer) {
  var totalHeight = listToShow.length * VIRTUAL_ROW_HEIGHT;
  var gridCols = '40px ' + fields.map(function () { return 'minmax(70px,1fr)'; }).join(' ');
  var headHtml = '<div class="view-virtual-head" style="grid-template-columns:' + gridCols + '">' +
    '<div class="view-virtual-head-cell view-virtual-checkbox"><input type="checkbox" id="selectAllCheckbox" data-bulk-action="toggle-all" aria-label="Выделить все"></div>' +
    fields.map(function (f) {
      if (!f.sortable) return '<div class="view-virtual-head-cell">' + (f.label || '').replace(/</g, '&lt;') + '</div>';
      return '<div class="view-virtual-head-cell sortable-th' + sortClass(f.key) + '" data-sort-key="' + (f.key || '').replace(/"/g, '&quot;') + '" role="button" tabindex="0">' + (f.label || '').replace(/</g, '&lt;') + sortMark(f.key) + '</div>';
    }).join('') +
    '</div>';
  container.innerHTML =
    '<div class="view-virtual-wrap">' +
    headHtml +
    '<div class="view-virtual-body" id="viewVirtualBody">' +
    '<div class="view-virtual-viewport" id="viewVirtualViewport" style="height:' + totalHeight + 'px"></div>' +
    '<div class="view-virtual-rows" id="viewVirtualRows"></div>' +
    '</div></div>';
  container._virtualData = { list: listToShow, fields: fields, renderVisible: null };
  function renderVisible() {
    var body = document.getElementById('viewVirtualBody');
    var viewport = document.getElementById('viewVirtualViewport');
    var rowsEl = document.getElementById('viewVirtualRows');
    if (!body || !viewport || !rowsEl) return;
    var scrollTop = body.scrollTop || 0;
    var height = body.clientHeight || 400;
    var start = Math.max(0, Math.floor(scrollTop / VIRTUAL_ROW_HEIGHT) - 5);
    var end = Math.min(listToShow.length, start + Math.ceil(height / VIRTUAL_ROW_HEIGHT) + 10);
    var html = '';
    for (var i = start; i < end; i++) {
      var entry = listToShow[i];
      var safeCattleId = viewListEscapeHtml(entry.cattleId).replace(/"/g, '&quot;');
      var checked = viewListSelectedIds.has(entry.cattleId) ? ' checked' : '';
      var cells = fields.map(function (field) {
        var v = field.render(entry);
        if (field.key === 'lactation' && (v === 0 || v === '0')) v = '0';
        return '<div class="view-virtual-cell">' + (v || '') + '</div>';
      }).join('');
      html += '<div class="view-virtual-row view-entry-row ' + (entry.synced ? '' : 'unsynced') + (viewListSelectedIds.has(entry.cattleId) ? ' selected-row' : '') + '" style="top:' + (i * VIRTUAL_ROW_HEIGHT) + 'px;grid-template-columns:' + gridCols + '" data-row-index="' + i + '" data-cattle-id="' + safeCattleId + '" role="button" tabindex="0">' +
        '<div class="view-virtual-cell view-virtual-checkbox"><input type="checkbox" class="entry-checkbox" data-cattle-id="' + safeCattleId + '" aria-label="Выделить"' + checked + '></div>' +
        cells + '</div>';
    }
    rowsEl.innerHTML = html;
  }
  container._virtualData.renderVisible = renderVisible;
  renderVisible();
  var body = document.getElementById('viewVirtualBody');
  if (body) {
    body.addEventListener('scroll', renderVisible);
  }
  requestAnimationFrame(function () {
    if (container._virtualData && container._virtualData.renderVisible) container._virtualData.renderVisible();
  });
  setTimeout(function () {
    if (container._virtualData && container._virtualData.renderVisible) container._virtualData.renderVisible();
  }, 0);
}

function refreshViewListVisible() {
  var container = document.getElementById('viewEntriesList');
  if (container && container._virtualData && container._virtualData.renderVisible) {
    container._virtualData.renderVisible();
  }
}

function initViewFieldsSettings() {
  var btn = document.getElementById('viewFieldsSettingsBtn');
  var modal = document.getElementById('viewFieldsSettingsModal');
  var closeBtn = document.getElementById('viewFieldsCloseBtn');
  var saveBtn = document.getElementById('viewFieldsSaveBtn');
  var resetBtn = document.getElementById('viewFieldsResetBtn');
  if (!modal || !btn || btn.dataset.bound === '1') return;
  btn.dataset.bound = '1';
  btn.addEventListener('click', openViewFieldsSettings);
  if (closeBtn) closeBtn.addEventListener('click', closeViewFieldsSettings);
  if (resetBtn) resetBtn.addEventListener('click', function () {
    try { localStorage.removeItem(VIEW_LIST_FIELDS_KEY); } catch (e) {}
    renderViewFieldsSettings();
  });
  if (saveBtn) saveBtn.addEventListener('click', function () {
    var checked = Array.prototype.slice.call(modal.querySelectorAll('.view-fields-checkbox:checked'))
      .map(function (el) { return el.value; });
    if (checked.length === 0) {
      if (typeof showToast === 'function') showToast('Выберите хотя бы одно поле.', 'error'); else alert('Выберите хотя бы одно поле.');
      return;
    }
    try {
      localStorage.setItem(VIEW_LIST_FIELDS_KEY, JSON.stringify(checked));
    } catch (e) {}
    closeViewFieldsSettings();
    updateViewList();
  });
  modal.addEventListener('click', function (ev) {
    if (ev.target === modal) closeViewFieldsSettings();
    var applyBtn = ev.target.closest('.view-fields-template-apply');
    if (applyBtn && applyBtn.dataset.templateIndex !== undefined) {
      var idx = parseInt(applyBtn.dataset.templateIndex, 10);
      var templates = getFieldTemplates();
      if (templates[idx] && templates[idx].fieldKeys && templates[idx].fieldKeys.length > 0) {
        try {
          localStorage.setItem(VIEW_LIST_FIELDS_KEY, JSON.stringify(templates[idx].fieldKeys));
        } catch (e) {}
        renderViewFieldsSettings();
        updateViewList();
      }
      ev.preventDefault();
      return;
    }
    var deleteBtn = ev.target.closest('.view-fields-template-delete');
    if (deleteBtn && deleteBtn.dataset.templateIndex !== undefined) {
      var idxDel = parseInt(deleteBtn.dataset.templateIndex, 10);
      var list = getFieldTemplates();
      list.splice(idxDel, 1);
      saveFieldTemplates(list);
      renderViewFieldsSettings();
      ev.preventDefault();
      return;
    }
  });

  var saveTemplateBtn = document.getElementById('viewFieldsSaveTemplateBtn');
  var templateNameInput = document.getElementById('viewFieldsTemplateNameInput');
  if (saveTemplateBtn && templateNameInput) {
    saveTemplateBtn.addEventListener('click', function () {
      var name = (templateNameInput.value || '').trim();
      if (!name) {
        if (typeof showToast === 'function') showToast('Введите название шаблона.', 'error'); else alert('Введите название шаблона.');
        return;
      }
      var checked = Array.prototype.slice.call(modal.querySelectorAll('.view-fields-checkbox:checked'))
        .map(function (el) { return el.value; });
      if (checked.length === 0) {
        if (typeof showToast === 'function') showToast('Выберите хотя бы одно поле.', 'error'); else alert('Выберите хотя бы одно поле.');
        return;
      }
      var list = getFieldTemplates();
      list.push({ name: name, fieldKeys: checked });
      saveFieldTemplates(list);
      templateNameInput.value = '';
      renderViewFieldsSettings();
    });
  }
}

function renderViewFieldsSettings() {
  var modal = document.getElementById('viewFieldsSettingsModal');
  var listEl = document.getElementById('viewFieldsList');
  if (!modal || !listEl) return;
  var visible = getVisibleFieldKeys();
  var html = VIEW_LIST_FIELDS.map(function (field) {
    var checked = visible.indexOf(field.key) !== -1;
    return '<label class="view-fields-item">' +
      '<input type="checkbox" class="view-fields-checkbox" value="' + field.key + '"' + (checked ? ' checked' : '') + ' />' +
      '<span>' + field.label + '</span>' +
      '</label>';
  }).join('');
  listEl.innerHTML = html;

  var templatesListEl = document.getElementById('viewFieldsTemplatesList');
  if (templatesListEl) {
    var templates = getFieldTemplates();
    templatesListEl.innerHTML = templates.length === 0
      ? '<p class="view-fields-templates-empty">Нет сохранённых шаблонов</p>'
      : templates.map(function (t, idx) {
          var name = (t.name || '').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
          return '<div class="view-fields-template-item">' +
            '<span class="view-fields-template-name">' + name + '</span>' +
            ' <button type="button" class="small-btn view-fields-template-apply" data-template-index="' + idx + '" aria-label="Применить">Применить</button>' +
            ' <button type="button" class="small-btn view-fields-template-delete" data-template-index="' + idx + '" aria-label="Удалить">Удалить</button>' +
            '</div>';
        }).join('');
  }
}

function openViewFieldsSettings() {
  var modal = document.getElementById('viewFieldsSettingsModal');
  if (!modal) return;
  renderViewFieldsSettings();
  modal.classList.add('active');
  modal.setAttribute('aria-hidden', 'false');
  setTimeout(function () {
    var first = modal.querySelector('.view-fields-checkbox, .view-fields-template-apply, #viewFieldsCloseBtn');
    if (first) first.focus();
  }, 0);
}

function closeViewFieldsSettings() {
  var modal = document.getElementById('viewFieldsSettingsModal');
  if (!modal) return;
  modal.classList.remove('active');
  modal.setAttribute('aria-hidden', 'true');
}

function initViewEditorModeButton() {
  var btn = document.getElementById('viewEditorModeBtn');
  if (!btn || btn.dataset.editorBound === '1') return;
  btn.dataset.editorBound = '1';
  btn.addEventListener('click', function () {
    viewListEditorMode = !viewListEditorMode;
    btn.textContent = viewListEditorMode ? '✎ Выкл. редактор' : '✎ Режим редактора';
    btn.classList.toggle('active', viewListEditorMode);
    updateViewList();
  });
  btn.textContent = viewListEditorMode ? '✎ Выкл. редактор' : '✎ Режим редактора';
  btn.classList.toggle('active', viewListEditorMode);
}

function _getEntryRawValue(entry, fieldKey) {
  if (fieldKey === 'protocolName') return (entry.protocol && entry.protocol.name) || entry.protocolName || '';
  if (fieldKey === 'protocolStartDate') return (entry.protocol && entry.protocol.startDate) || entry.protocolStartDate || '';
  var v = entry[fieldKey];
  if (v === undefined || v === null) return '';
  return String(v).trim();
}

function _setEntryValue(entry, fieldKey, value) {
  if (fieldKey === 'protocolName') {
    entry.protocol = entry.protocol || {};
    entry.protocol.name = value;
    return;
  }
  if (fieldKey === 'protocolStartDate') {
    entry.protocol = entry.protocol || {};
    entry.protocol.startDate = value;
    return;
  }
  entry[fieldKey] = value;
}

function _setCellDisplay(td, entry, fieldKey) {
  var fields = getVisibleViewFields();
  var field = fields.filter(function (f) { return f.key === fieldKey; })[0];
  if (!field) return;
  var v = field.render(entry);
  var show = (fieldKey === 'lactation' && (v === 0 || v === '0')) ? '0' : v;
  td.textContent = show || '—';
  td.classList.add('editable-cell');
}

function startInlineEdit(td, cattleId, fieldKey) {
  if (!td || !cattleId || !fieldKey || !VIEW_LIST_EDITABLE_KEYS[fieldKey]) return;
  var entriesList = typeof entries !== 'undefined' ? entries : [];
  var entry = entriesList.find(function (e) { return e.cattleId === cattleId; });
  if (!entry) return;
  var fieldType = VIEW_LIST_EDITABLE_KEYS[fieldKey];
  var currentVal = _getEntryRawValue(entry, fieldKey);
  var input;
  if (fieldType === 'select' && fieldKey === 'status') {
    input = document.createElement('select');
    input.className = 'view-list-inline-select';
    STATUS_OPTIONS.forEach(function (opt) {
      var o = document.createElement('option');
      o.value = opt;
      o.textContent = opt;
      if (opt === currentVal) o.selected = true;
      input.appendChild(o);
    });
  } else {
    input = document.createElement('input');
    input.className = 'view-list-inline-input';
    input.type = fieldType === 'date' ? 'date' : fieldType === 'number' ? 'number' : 'text';
    if (fieldKey === 'lactation') input.min = 0;
    if (fieldKey === 'attemptNumber') input.min = 1;
    input.value = currentVal;
  }
  td.innerHTML = '';
  td.appendChild(input);
  input.focus();
  var editCommitted = false;
  function finishEdit(save) {
    if (save) {
      var newVal = input.value.trim();
      if (fieldType === 'number') {
        var num = parseInt(newVal, 10);
        newVal = (newVal === '' || isNaN(num)) ? '' : num;
      }
      _setEntryValue(entry, fieldKey, newVal);
      if (typeof saveLocally === 'function') saveLocally();
    }
    _setCellDisplay(td, entry, fieldKey);
  }
  input.addEventListener('blur', function () {
    if (editCommitted) return;
    editCommitted = true;
    finishEdit(true);
  });
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); editCommitted = true; finishEdit(true); }
    if (e.key === 'Escape') { e.preventDefault(); editCommitted = true; finishEdit(false); }
  });
  input.addEventListener('click', function (e) { e.stopPropagation(); });
}

function _assertBulkSelectionUI() {
  var bulk = document.getElementById('viewBulkActions');
  var selectAll = document.getElementById('selectAllCheckbox');
  var checkboxes = document.querySelectorAll('.entry-checkbox');
  var bar = document.querySelector('.bulk-actions-bar');
  if (!bulk || !bulk.innerHTML) {
    console.warn('[Просмотр описи] Панель выделения (viewBulkActions) пуста');
    return;
  }
  if (!bar) {
    console.warn('[Просмотр описи] Элемент .bulk-actions-bar не найден');
    return;
  }
  if (!selectAll && checkboxes.length > 0) {
    console.warn('[Просмотр описи] Чекбокс «Выделить все» не найден');
    return;
  }
  if (checkboxes.length === 0 && document.getElementById('viewEntriesList') && document.querySelector('.entries-table tbody')) {
    console.warn('[Просмотр описи] В таблице нет чекбоксов строк (.entry-checkbox)');
  }
}

function _handleViewListKeydown(ev) {
  var sortTh = ev.target.closest('th[data-sort-key], .view-virtual-head-cell[data-sort-key]');
  if (sortTh && (ev.key === 'Enter' || ev.key === ' ')) {
    ev.preventDefault();
    var key = sortTh.getAttribute('data-sort-key');
    if (key) {
      if (viewListSortKey === key) viewListSortDir = viewListSortDir === 'asc' ? 'desc' : 'asc';
      else { viewListSortKey = key; viewListSortDir = 'asc'; }
      updateViewList();
    }
    return;
  }
  if (ev.key !== 'Enter' && ev.key !== ' ') return;
  var row = ev.target.closest('tbody tr.view-entry-row, .view-virtual-row.view-entry-row');
  if (!row) return;
  ev.preventDefault();
  var cattleId = row.getAttribute('data-cattle-id');
  if (cattleId && typeof viewCow === 'function') viewCow(cattleId);
}

function _handleViewListClick(ev) {
  var target = ev.target;
  var bulkContainer = document.getElementById('viewBulkActions');
  var tableContainer = document.getElementById('viewEntriesList');

  var bulkBtn = target.closest('[data-bulk-action]');
  if (bulkBtn && bulkContainer && bulkContainer.contains(bulkBtn)) {
    ev.preventDefault();
    var action = bulkBtn.getAttribute('data-bulk-action');
    if (action === 'select-all') {
      selectAllEntries();
      return;
    }
    if (action === 'deselect-all') {
      deselectAllEntries();
      return;
    }
    if (action === 'delete-selected') {
      if (typeof deleteSelectedEntries === 'function') deleteSelectedEntries();
      return;
    }
  }

  if (bulkBtn && bulkBtn.getAttribute('data-bulk-action') === 'toggle-all') {
    ev.preventDefault();
    var cb = document.getElementById('selectAllCheckbox');
    if (cb) toggleSelectAll(cb.checked);
    return;
  }

  var sortTh = target.closest('th[data-sort-key], .view-virtual-head-cell[data-sort-key]');
  if (sortTh && tableContainer && tableContainer.contains(sortTh)) {
    ev.preventDefault();
    var key = sortTh.getAttribute('data-sort-key');
    if (key) {
      if (viewListSortKey === key) viewListSortDir = viewListSortDir === 'asc' ? 'desc' : 'asc';
      else { viewListSortKey = key; viewListSortDir = 'asc'; }
      updateViewList();
    }
    return;
  }

  if (!tableContainer || !tableContainer.contains(target)) return;

  if (target.classList && target.classList.contains('entry-checkbox')) {
    ev.stopPropagation();
    var virtualBody = document.getElementById('viewVirtualBody');
    if (virtualBody && tableContainer && tableContainer._virtualData && tableContainer._virtualData.renderVisible) {
      var cattleId = target.getAttribute('data-cattle-id');
      if (cattleId) {
        if (viewListSelectedIds.has(cattleId)) viewListSelectedIds.delete(cattleId);
        else viewListSelectedIds.add(cattleId);
        tableContainer._virtualData.renderVisible();
      }
    }
    setTimeout(updateSelectedCount, 0);
    return;
  }

  if (viewListEditorMode) {
    var cell = target.closest('td.editable-cell, td[data-field-key]');
    if (cell && cell.classList && cell.classList.contains('editable-cell')) {
      ev.preventDefault();
      ev.stopPropagation();
      var row = cell.closest('tr.view-entry-row');
      if (row) {
        var cattleId = row.getAttribute('data-cattle-id');
        var fieldKey = cell.getAttribute('data-field-key');
        if (cattleId && fieldKey && VIEW_LIST_EDITABLE_KEYS[fieldKey]) {
          startInlineEdit(cell, cattleId, fieldKey);
        }
      }
      return;
    }
  }

  var row = target.closest('tbody tr.view-entry-row, .view-virtual-row.view-entry-row');
  if (row) {
    ev.preventDefault();
    var cattleId = row.getAttribute('data-cattle-id');
    if (cattleId && typeof viewCow === 'function') viewCow(cattleId);
  }
}

function selectAllEntries() {
  var container = document.getElementById('viewEntriesList');
  if (container && container._virtualData && container._virtualData.list) {
    container._virtualData.list.forEach(function (entry) { viewListSelectedIds.add(entry.cattleId); });
    if (container._virtualData.renderVisible) container._virtualData.renderVisible();
  } else {
    var checkboxes = document.querySelectorAll('.entry-checkbox');
    checkboxes.forEach(function (checkbox) { checkbox.checked = true; });
  }
  var selectAllCheckbox = document.getElementById('selectAllCheckbox');
  if (selectAllCheckbox) selectAllCheckbox.checked = true;
  updateSelectedCount();
}

function deselectAllEntries() {
  viewListSelectedIds.clear();
  var container = document.getElementById('viewEntriesList');
  if (container && container._virtualData && container._virtualData.renderVisible) {
    container._virtualData.renderVisible();
  } else {
    var checkboxes = document.querySelectorAll('.entry-checkbox');
    checkboxes.forEach(function (checkbox) { checkbox.checked = false; });
  }
  var selectAllCheckbox = document.getElementById('selectAllCheckbox');
  if (selectAllCheckbox) selectAllCheckbox.checked = false;
  updateSelectedCount();
}

function toggleSelectAll(checked) {
  var container = document.getElementById('viewEntriesList');
  if (container && container._virtualData && container._virtualData.list) {
    if (checked) {
      container._virtualData.list.forEach(function (entry) { viewListSelectedIds.add(entry.cattleId); });
    } else {
      viewListSelectedIds.clear();
    }
    if (container._virtualData.renderVisible) container._virtualData.renderVisible();
  } else {
    var checkboxes = document.querySelectorAll('.entry-checkbox');
    checkboxes.forEach(function (checkbox) { checkbox.checked = checked; });
  }
  updateSelectedCount();
}

function updateSelectedCount() {
  var container = document.getElementById('viewEntriesList');
  var count;
  var total;
  if (container && container._virtualData && container._virtualData.list) {
    count = viewListSelectedIds.size;
    total = container._virtualData.list.length;
  } else {
    var checkboxes = document.querySelectorAll('.entry-checkbox:checked');
    var allCheckboxes = document.querySelectorAll('.entry-checkbox');
    count = checkboxes.length;
    total = allCheckboxes.length;
  }
  var countElement = document.getElementById('selectedCount');
  var deleteBtn = document.getElementById('deleteSelectedBtn');
  if (countElement) countElement.textContent = 'Выделено: ' + count;
  if (deleteBtn) deleteBtn.disabled = count === 0;
  var selectAllCheckbox = document.getElementById('selectAllCheckbox');
  if (selectAllCheckbox && total > 0) {
    selectAllCheckbox.checked = count === total;
  }
  if (!container || !container._virtualData) {
    var allRows = document.querySelectorAll('.entries-table tbody tr');
    allRows.forEach(function (row) {
      var checkbox = row.querySelector('.entry-checkbox');
      if (checkbox && checkbox.checked) row.classList.add('selected-row');
      else row.classList.remove('selected-row');
    });
  }
}

function getSelectedCattleIds() {
  var container = document.getElementById('viewEntriesList');
  if (container && container._virtualData && container._virtualData.list) {
    return Array.from(viewListSelectedIds);
  }
  var checkboxes = document.querySelectorAll('.entry-checkbox:checked');
  return Array.prototype.map.call(checkboxes, function (cb) { return cb.getAttribute('data-cattle-id'); });
}

function toggleRowSelection(event, checkboxId) {
  if (event.target.tagName === 'BUTTON' || event.target.closest('button') || event.target.closest('.actions-cell')) {
    return;
  }
  const checkbox = document.getElementById(checkboxId);
  if (checkbox) {
    checkbox.checked = !checkbox.checked;
    updateSelectedCount();
  }
}

window.selectAllEntries = selectAllEntries;
window.deselectAllEntries = deselectAllEntries;
window.toggleSelectAll = toggleSelectAll;
window.toggleRowSelection = toggleRowSelection;
window.updateSelectedCount = updateSelectedCount;
window.getSelectedCattleIds = getSelectedCattleIds;
window.refreshViewListVisible = refreshViewListVisible;

// === js/features/protocols.js
// protocols.js — справочник протоколов синхронизации (схемы гормональной терапии)

var PROTOCOLS_STORAGE_KEY = 'cattleTracker_protocols';

/**
 * Возвращает массив протоколов из localStorage
 * @returns {Array<{id: string, name: string, steps: Array<{day: number, drug: string}>}>}
 */
function getProtocols() {
  try {
    var raw = localStorage.getItem(PROTOCOLS_STORAGE_KEY);
    if (!raw) return [];
    var arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    return [];
  }
}

/**
 * Сохраняет массив протоколов в localStorage
 * @param {Array} arr
 */
function saveProtocols(arr) {
  localStorage.setItem(PROTOCOLS_STORAGE_KEY, JSON.stringify(Array.isArray(arr) ? arr : []));
}

/**
 * Генерирует уникальный id протокола
 */
function nextProtocolId() {
  var list = getProtocols();
  var max = 0;
  for (var i = 0; i < list.length; i++) {
    var n = parseInt(list[i].id, 10);
    if (!isNaN(n) && n > max) max = n;
  }
  return String(max + 1);
}

/**
 * Находит протокол по id
 * @param {string} id
 * @returns {Object|undefined}
 */
function getProtocolById(id) {
  var list = getProtocols();
  for (var i = 0; i < list.length; i++) {
    if (list[i].id === id) return list[i];
  }
  return undefined;
}

/**
 * Добавляет протокол
 * @param {Object} protocol - { name, steps: [{ day, drug }] }
 * @returns {Object} добавленный протокол с id
 */
function addProtocol(protocol) {
  var list = getProtocols();
  var item = {
    id: nextProtocolId(),
    name: (protocol && protocol.name) ? String(protocol.name).trim() : '',
    steps: Array.isArray(protocol && protocol.steps) ? protocol.steps.map(function (s) {
      return { day: parseInt(s.day, 10) || 0, drug: String(s.drug || '').trim() };
    }) : []
  };
  list.push(item);
  saveProtocols(list);
  return item;
}

/**
 * Обновляет протокол по id
 * @param {string} id
 * @param {Object} protocol - { name, steps }
 */
function updateProtocol(id, protocol) {
  var list = getProtocols();
  for (var i = 0; i < list.length; i++) {
    if (list[i].id === id) {
      list[i].name = (protocol && protocol.name) ? String(protocol.name).trim() : list[i].name;
      list[i].steps = Array.isArray(protocol && protocol.steps) ? protocol.steps.map(function (s) {
        return { day: parseInt(s.day, 10) || 0, drug: String(s.drug || '').trim() };
      }) : list[i].steps;
      saveProtocols(list);
      return list[i];
    }
  }
}

/**
 * Удаляет протокол по id
 * @param {string} id
 */
function deleteProtocol(id) {
  var list = getProtocols().filter(function (p) { return p.id !== id; });
  saveProtocols(list);
}

/**
 * Рендерит экран «Протоколы синхронизации»
 * @param {string} containerId - id контейнера (например 'protocols-container')
 */
function renderProtocolsScreen(containerId) {
  var container = document.getElementById(containerId);
  if (!container) return;

  var list = getProtocols();
  var editingId = window._protocolsEditingId || null;
  var editing = editingId ? getProtocolById(editingId) : null;

  var html = '<div class="protocols-screen-inner">';
  html += '<div class="protocols-list-section">';
  html += '<h3>Список протоколов</h3>';
  html += '<ul id="protocols-list" class="protocols-list">';
  for (var i = 0; i < list.length; i++) {
    var p = list[i];
    var name = (p.name || 'Без названия').replace(/</g, '&lt;');
    html += '<li class="protocols-list-item" data-id="' + String(p.id).replace(/"/g, '&quot;') + '">';
    html += '<span class="protocol-name">' + name + '</span>';
    html += ' <button type="button" class="small-btn edit-protocol-btn" data-id="' + String(p.id).replace(/"/g, '&quot;') + '" aria-label="Редактировать">Изменить</button>';
    html += ' <button type="button" class="small-btn delete-protocol-btn" data-id="' + String(p.id).replace(/"/g, '&quot;') + '" aria-label="Удалить">Удалить</button>';
    html += '</li>';
  }
  html += '</ul>';
  html += '<button type="button" class="action-btn" id="protocols-add-btn">➕ Добавить протокол</button>';
  html += '</div>';

  html += '<div class="protocols-form-section">';
  html += '<h3 id="protocols-form-title">' + (editing ? 'Редактировать протокол' : 'Новый протокол') + '</h3>';
  html += '<form id="protocol-form" class="form">';
  html += '<label for="protocol-name-input">Название протокола</label>';
  html += '<input type="text" id="protocol-name-input" value="' + (editing ? (editing.name || '').replace(/"/g, '&quot;').replace(/</g, '&lt;') : '') + '" placeholder="Например: Синхрон-1" />';
  html += '<label>Этапы (инъекции)</label>';
  html += '<div id="protocol-steps-container"></div>';
  html += '<button type="button" class="small-btn" id="protocol-add-step-btn">➕ Добавить этап</button>';
  html += '<div class="form-actions">';
  html += '<button type="button" id="protocol-cancel-btn">Отмена</button>';
  html += '<button type="submit" id="protocol-save-btn">Сохранить</button>';
  html += '</div>';
  html += '</form>';
  html += '</div>';
  html += '</div>';

  container.innerHTML = html;

  renderProtocolStepsList(editing ? editing.steps : []);

  document.getElementById('protocols-add-btn').onclick = function () {
    window._protocolsEditingId = null;
    navigate('protocols');
    if (typeof renderProtocolsScreen === 'function') renderProtocolsScreen(containerId);
  };

  container.querySelectorAll('.edit-protocol-btn').forEach(function (btn) {
    btn.onclick = function () {
      window._protocolsEditingId = btn.getAttribute('data-id');
      navigate('protocols');
      if (typeof renderProtocolsScreen === 'function') renderProtocolsScreen(containerId);
    };
  });

  container.querySelectorAll('.delete-protocol-btn').forEach(function (btn) {
    btn.onclick = function () {
      var id = btn.getAttribute('data-id');
      if (!id) return;
      if (typeof showConfirmModal === 'function') {
        showConfirmModal('Удалить этот протокол?').then(function (ok) {
          if (!ok) return;
          deleteProtocol(id);
          window._protocolsEditingId = null;
          if (typeof renderProtocolsScreen === 'function') renderProtocolsScreen(containerId);
        });
        return;
      }
      if (!confirm('Удалить этот протокол?')) return;
      deleteProtocol(id);
      window._protocolsEditingId = null;
      if (typeof renderProtocolsScreen === 'function') renderProtocolsScreen(containerId);
    };
  });

  document.getElementById('protocol-add-step-btn').onclick = function () {
    var steps = getCurrentStepsFromForm();
    steps.push({ day: 0, drug: '' });
    renderProtocolStepsList(steps);
  };

  document.getElementById('protocol-cancel-btn').onclick = function () {
    window._protocolsEditingId = null;
    navigate('protocols');
    if (typeof renderProtocolsScreen === 'function') renderProtocolsScreen(containerId);
  };

  document.getElementById('protocol-form').onsubmit = function (e) {
    e.preventDefault();
    var name = document.getElementById('protocol-name-input').value.trim();
    var steps = getCurrentStepsFromForm();
    if (!name) {
      if (typeof showToast === 'function') showToast('Введите название протокола', 'error');
      return;
    }
    if (editingId) {
      updateProtocol(editingId, { name: name, steps: steps });
      if (typeof showToast === 'function') showToast('Протокол сохранён', 'success');
    } else {
      addProtocol({ name: name, steps: steps });
      if (typeof showToast === 'function') showToast('Протокол добавлен', 'success');
    }
    window._protocolsEditingId = null;
    if (typeof renderProtocolsScreen === 'function') renderProtocolsScreen(containerId);
  };
}

function getCurrentStepsFromForm() {
  var steps = [];
  var container = document.getElementById('protocol-steps-container');
  if (!container) return steps;
  var rows = container.querySelectorAll('.protocol-step-row');
  for (var i = 0; i < rows.length; i++) {
    var dayInput = rows[i].querySelector('.step-day');
    var drugInput = rows[i].querySelector('.step-drug');
    steps.push({
      day: dayInput ? (parseInt(dayInput.value, 10) || 0) : 0,
      drug: drugInput ? drugInput.value.trim() : ''
    });
  }
  return steps;
}

function renderProtocolStepsList(steps) {
  var container = document.getElementById('protocol-steps-container');
  if (!container) return;
  if (!Array.isArray(steps)) steps = [];
  var html = '';
  for (var i = 0; i < steps.length; i++) {
    var s = steps[i];
    html += '<div class="protocol-step-row">';
    html += '<label class="step-label">День</label>';
    html += '<input type="number" class="step-day" value="' + (s.day || 0) + '" min="0" step="1" />';
    html += '<label class="step-label">Препарат</label>';
    html += '<input type="text" class="step-drug" value="' + (s.drug || '').replace(/"/g, '&quot;').replace(/</g, '&lt;') + '" placeholder="Название инъекции" />';
    html += '<button type="button" class="small-btn remove-step-btn" aria-label="Удалить этап">✕</button>';
    html += '</div>';
  }
  container.innerHTML = html;
  container.querySelectorAll('.remove-step-btn').forEach(function (btn, index) {
    btn.onclick = function () {
      var steps = getCurrentStepsFromForm();
      steps.splice(index, 1);
      renderProtocolStepsList(steps);
    };
  });
}

// === js/core/menu.js
// menu.js — Навигация между экранами, переключатель объектов, статистика стада

/** Конфиг групп главного меню: id группы → { title, buttons: [{ icon, text, onclick }] } */
var MENU_GROUPS = {
  data: {
    title: 'Работа с данными',
    buttons: [
      { icon: '➕', text: 'Добавить животное', onclick: "navigate('add')" },
      { icon: '📤', text: 'Экспорт в Excel', onclick: 'exportToExcel()' },
      { icon: '📋', text: 'Шаблон импорта', onclick: 'downloadTemplate()' },
      { icon: '📥', text: 'Импорт из Excel', onclick: "document.getElementById('importFile').click()" },
      { icon: '📋', text: 'Список всех животных', onclick: "navigate('view')" },
      { icon: '📑', text: 'Все осеменения', onclick: "navigate('all-inseminations')" }
    ]
  },
  actions: {
    title: 'Действия',
    buttons: [
      { icon: '🐄', text: 'Ввести осеменение', onclick: "navigate('insemination')" },
      { icon: '🐄', text: 'Запуск', onclick: "navigate('dry')" },
      { icon: '🐄', text: 'Отел', onclick: "navigate('calving')" },
      { icon: '🩺', text: 'УЗИ', onclick: "navigate('uzi')" },
      { icon: '📋', text: 'Поставить на протокол', onclick: "navigate('protocol-assign')" }
    ]
  },
  analytics: {
    title: 'Аналитика',
    buttons: [
      { icon: '📊', text: 'Аналитика', onclick: "navigate('analytics')" },
      { icon: '📈', text: 'Интервальный анализ', onclick: "navigate('interval-analysis')" }
    ]
  },
  notifications: {
    title: 'Уведомления и планы',
    buttons: [
      { icon: '🔔', text: 'Уведомления', onclick: "navigate('notifications')" },
      { icon: '📋', text: 'Планы', onclick: "navigate('tasks')" }
    ]
  },
  settings: {
    title: 'Настройки',
    buttons: [
      { icon: '👤', text: 'Войти / Пользователи', onclick: "navigate('auth')" },
      { icon: '🔄', text: 'Синхронизация', onclick: "navigate('sync')" },
      { icon: '📋', text: 'Протоколы синхронизации', onclick: "navigate('protocols')" }
    ]
  }
};

/**
 * Переход на экран подменю с заданной группой
 */
function navigateToSubmenu(groupId) {
  window._submenuGroup = groupId;
  navigate('submenu');
}

/**
 * Навигация между экранами
 * @param {string} screenId - id экрана (без суффикса -screen)
 * @param {Object} [options] - опции (например { group: 'data' } для подменю)
 */
function navigate(screenId, options) {
  if (options && options.group !== undefined) {
    window._submenuGroup = options.group;
  }

  var currentUser = (typeof getCurrentUser === 'function') ? getCurrentUser() : null;
  if (screenId !== 'auth' && screenId !== 'sync' && !currentUser) {
    screenId = 'auth';
  }

  document.querySelectorAll('.screen').forEach(el => {
    el.classList.remove('active');
  });

  const screen = document.getElementById(screenId + '-screen');
  if (screen) {
    screen.classList.add('active');
  }

  if (typeof updateWindowModeForScreen === 'function') {
    updateWindowModeForScreen(screenId);
  }

  if (screenId === 'submenu') {
    renderSubmenu();
  }
  if (screenId === 'protocols' && typeof renderProtocolsScreen === 'function') {
    renderProtocolsScreen('protocols-container');
  }
  if (screenId === 'dry' && typeof initDryScreen === 'function') initDryScreen();
  if (screenId === 'calving' && typeof initCalvingScreen === 'function') initCalvingScreen();
  if (screenId === 'protocol-assign' && typeof initProtocolAssignScreen === 'function') initProtocolAssignScreen();
  if (screenId === 'uzi' && typeof initUziScreen === 'function') initUziScreen();
  if (screenId === 'view') {
    updateViewList();
    setTimeout(function () {
      if (typeof refreshViewListVisible === 'function') refreshViewListVisible();
    }, 0);
  }
  if (screenId === 'all-inseminations' && typeof renderAllInseminationsScreen === 'function') {
    renderAllInseminationsScreen();
  }
  if (screenId === 'notifications' && typeof renderNotificationCenter === 'function') {
    renderNotificationCenter('notification-center-container');
  }
  if (screenId === 'sync' && typeof window.initSyncServerBlock === 'function') {
    window.initSyncServerBlock();
    if (window.CATTLE_TRACKER_USE_API && typeof window.updateSyncServerStatusFromHealth === 'function') {
      window.updateSyncServerStatusFromHealth();
    }
  }
  if (screenId === 'auth') {
    if (typeof window.bindAuthControls === 'function') window.bindAuthControls();
    if (typeof fillAuthUsernameList === 'function') fillAuthUsernameList();
    requestAnimationFrame(function () {
      setTimeout(function () {
        var loginInput = document.getElementById('authUsername');
        if (loginInput) {
          loginInput.focus({ preventScroll: false });
        }
      }, 120);
    });
  }
  if (screenId === 'tasks' && typeof renderTasksScreen === 'function') {
    renderTasksScreen();
  }
  if (screenId === 'analytics' && typeof renderAnalyticsScreen === 'function') {
    renderAnalyticsScreen();
  }
  if (screenId === 'interval-analysis' && typeof renderIntervalAnalysisScreen === 'function') {
    renderIntervalAnalysisScreen();
  }
  if (screenId === 'sync' && typeof renderBackupUI === 'function') {
    renderBackupUI('sync-backup-container');
  }
  if (screenId === 'add') {
    var clearBtn = document.getElementById('clearFormButton');
    if (clearBtn) clearBtn.style.display = window.currentEditingId ? 'none' : 'inline-block';
    if (!window.currentEditingId) {
      var titleEl = document.getElementById('addScreenTitle');
      if (titleEl) titleEl.textContent = '➕ Добавить корову';
      if (typeof clearForm === 'function') clearForm();
    }
    setTimeout(function () {
      var firstField = document.getElementById('cattleId');
      if (firstField) firstField.focus();
    }, 0);
  }

  if (screenId === 'menu') {
    updateObjectSwitcher();
    updateHerdStats();
    if (typeof updateAuthBar === 'function') updateAuthBar();
    if (typeof renderNotificationSummary === 'function') renderNotificationSummary('menuNotificationsBody');
    if (typeof initMenuNotificationsToggle === 'function') initMenuNotificationsToggle();
    if (typeof initFirstRunHints === 'function') initFirstRunHints();
    if (typeof maybeShowFirstRunHints === 'function') maybeShowFirstRunHints();
  }
  if (typeof updateNotificationIndicators === 'function') updateNotificationIndicators();

  var newHash = '#' + (screenId || 'menu');
  if (screenId === 'view-cow' && options && options.cattleId) newHash += '/' + String(options.cattleId).replace(/[#/]/g, '');
  if (typeof location !== 'undefined' && location.hash !== newHash) location.hash = newHash;
}

function syncRouteToScreen() {
  var hash = (typeof location !== 'undefined' && location.hash ? location.hash.slice(1) : '') || 'menu';
  var parts = hash.split('/');
  var screenId = parts[0] || 'menu';
  if (screenId === 'view-cow' && parts[1]) {
    if (typeof viewCow === 'function') viewCow(parts[1]);
  } else {
    navigate(screenId);
  }
}

function updateWindowModeForScreen(screenId) {
  if (typeof window === 'undefined' || !window.electronAPI || !window.electronAPI.setWindowMode) return;
  if (screenId === 'menu') window.electronAPI.setWindowMode('menu');
  else window.electronAPI.setWindowMode('default');
}

function initMenuNotificationsToggle() {
  var toggle = document.getElementById('menuNotificationsToggle');
  var body = document.getElementById('menuNotificationsBody');
  if (!toggle || !body || toggle.dataset.bound === '1') return;
  toggle.dataset.bound = '1';
  var savedOpen = false;
  try {
    savedOpen = localStorage.getItem('cattleTracker_notifications_open') === '1';
  } catch (e) {}
  setMenuNotificationsOpen(savedOpen);
  toggle.addEventListener('click', function () {
    var isOpen = toggle.getAttribute('aria-expanded') === 'true';
    setMenuNotificationsOpen(!isOpen);
  });
}

function setMenuNotificationsOpen(isOpen) {
  var toggle = document.getElementById('menuNotificationsToggle');
  var body = document.getElementById('menuNotificationsBody');
  if (!toggle || !body) return;
  toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  body.hidden = !isOpen;
  if (isOpen && typeof renderNotificationSummary === 'function') {
    renderNotificationSummary('menuNotificationsBody');
  }
  try {
    localStorage.setItem('cattleTracker_notifications_open', isOpen ? '1' : '0');
  } catch (e) {}
}

function initFirstRunHints() {
  var modal = document.getElementById('firstRunHints');
  if (!modal || modal.dataset.bound === '1') return;
  modal.dataset.bound = '1';
  var closeBtn = document.getElementById('firstRunHintsClose');
  var skipBtn = document.getElementById('firstRunHintsSkip');
  if (closeBtn) closeBtn.addEventListener('click', function () { closeFirstRunHints(true); });
  if (skipBtn) skipBtn.addEventListener('click', function () { closeFirstRunHints(true); });
  modal.addEventListener('click', function (ev) {
    if (ev.target === modal) closeFirstRunHints(true);
  });
}

function maybeShowFirstRunHints() {
  var modal = document.getElementById('firstRunHints');
  if (!modal) return;
  var seen = false;
  try {
    seen = localStorage.getItem('cattleTracker_hasSeenHints') === '1';
  } catch (e) {}
  if (seen) return;
  modal.classList.add('active');
  modal.setAttribute('aria-hidden', 'false');
}

function closeFirstRunHints(setFlag) {
  var modal = document.getElementById('firstRunHints');
  if (!modal) return;
  modal.classList.remove('active');
  modal.setAttribute('aria-hidden', 'true');
  if (setFlag !== false) {
    try {
      localStorage.setItem('cattleTracker_hasSeenHints', '1');
    } catch (e) {}
  }
}

/**
 * Рендерит экран подменю: заголовок и кнопки выбранной группы
 */
function renderSubmenu() {
  var groupId = window._submenuGroup || 'data';
  var group = MENU_GROUPS[groupId];
  var titleEl = document.getElementById('submenu-title');
  var containerEl = document.getElementById('submenu-buttons');
  if (!titleEl || !containerEl || !group) return;
  titleEl.textContent = group.title;
  var html = '';
  for (var i = 0; i < group.buttons.length; i++) {
    var btn = group.buttons[i];
    var styleAttr = btn.style ? ' style="' + String(btn.style).replace(/"/g, '&quot;') + '"' : '';
    html += '<button class="action-btn"' + styleAttr + ' onclick="' + String(btn.onclick).replace(/"/g, '&quot;').replace(/</g, '&lt;') + '">';
    html += '<span>' + (btn.icon || '') + '</span><span>' + (btn.text || '').replace(/</g, '&lt;') + '</span></button>';
  }
  containerEl.innerHTML = html;
}

/**
 * Показать модальное окно «Добавить объект»
 */
function showAddObjectModal() {
  var modal = document.getElementById('addObjectModal');
  var input = document.getElementById('addObjectNameInput');
  var titleEl = document.getElementById('addObjectModalTitle');
  var okBtn = document.getElementById('addObjectModalOkBtn');
  if (!modal || !input) return;
  modal.setAttribute('data-editing-id', '');
  modal.removeAttribute('data-import-source-id');
  if (titleEl) titleEl.textContent = 'Новая база (объект)';
  if (okBtn) okBtn.textContent = 'Добавить';
  input.value = 'Новая база';
  modal.classList.add('active');
  modal.setAttribute('aria-hidden', 'false');
  modal.removeAttribute('hidden');
  setTimeout(function () { if (input) input.focus(); }, 0);
}

/**
 * Показать модальное окно «Редактировать объект» для выбранной базы
 */
function showEditObjectModal() {
  var select = document.getElementById('currentObjectSelect');
  var list = typeof getObjectsList === 'function' ? getObjectsList() : null;
  if (!select || !list || !list.length) return;
  var id = select.value;
  var obj = list.filter(function (o) { return o.id === id; })[0];
  if (!obj) return;
  var modal = document.getElementById('addObjectModal');
  var input = document.getElementById('addObjectNameInput');
  var titleEl = document.getElementById('addObjectModalTitle');
  var okBtn = document.getElementById('addObjectModalOkBtn');
  if (!modal || !input) return;
  modal.setAttribute('data-editing-id', id);
  modal.removeAttribute('data-import-source-id');
  if (titleEl) titleEl.textContent = 'Редактировать объект';
  if (okBtn) okBtn.textContent = 'Сохранить';
  input.value = (obj.name || '').trim() || 'Новая база';
  modal.classList.add('active');
  modal.setAttribute('aria-hidden', 'false');
  modal.removeAttribute('hidden');
  setTimeout(function () { if (input) input.focus(); }, 0);
}

/**
 * Обработчик кнопки «Изменить» — открывает модалку редактирования текущего объекта
 */
function handleEditObjectClick() {
  showEditObjectModal();
}

/**
 * Обработчик кнопки «Удалить» — удаляет текущий объект с подтверждением
 */
function handleDeleteObjectClick() {
  var select = document.getElementById('currentObjectSelect');
  var list = typeof getObjectsList === 'function' ? getObjectsList() : null;
  if (!select || !list || !list.length) return;
  var id = select.value;
  if (id === 'default') {
    if (typeof showToast === 'function') showToast('Нельзя удалить базовый объект default', 'error', 4000);
    return;
  }
  var obj = list.filter(function (o) { return o.id === id; })[0];
  var name = (obj && obj.name) ? obj.name : id;
  var msg = 'Удалить базу «' + String(name).replace(/</g, '&lt;') + '»? Все записи в ней будут удалены.';
  var doDelete = function () {
    if (typeof deleteObject !== 'function') return;
    var p = deleteObject(id);
    if (p && typeof p.then === 'function') {
      p.then(function () {
        if (typeof updateObjectSwitcher === 'function') updateObjectSwitcher();
        if (typeof showToast === 'function') showToast('Объект удалён', 'info');
      }).catch(function (err) {
        var m = err && err.message ? err.message : 'Ошибка удаления';
        if (typeof showToast === 'function') showToast(m, 'error', 5000);
      });
    } else {
      if (typeof updateObjectSwitcher === 'function') updateObjectSwitcher();
    }
  };
  if (typeof showConfirmModal === 'function') {
    showConfirmModal(msg).then(function (ok) { if (ok) doDelete(); });
    return;
  }
  if (!confirm(msg)) return;
  doDelete();
}

/**
 * Скрыть модальное окно «Добавить объект»
 */
function hideAddObjectModal() {
  var modal = document.getElementById('addObjectModal');
  if (!modal) return;
  modal.classList.remove('active');
  modal.setAttribute('aria-hidden', 'true');
  modal.setAttribute('hidden', '');
}

/**
 * Обработчик кнопки «Добавить объект» — открывает модальное окно (без prompt)
 */
function handleAddObjectClick() {
  showAddObjectModal();
}

/**
 * Создать или обновить объект (вызывается из модального окна). Поддерживает режим «Импорт в новый объект».
 */
function confirmAddObject() {
  var modal = document.getElementById('addObjectModal');
  var input = document.getElementById('addObjectNameInput');
  var name = input && (input.value || '').trim();
  var editingId = modal && modal.getAttribute('data-editing-id');
  var importSourceId = modal && modal.getAttribute('data-import-source-id');
  if (importSourceId) {
    modal.removeAttribute('data-import-source-id');
    hideAddObjectModal();
    if (!name) return;
    if (typeof window.loadServerBaseIntoNewObject === 'function') {
      window.loadServerBaseIntoNewObject(importSourceId, name);
    }
    return;
  }
  hideAddObjectModal();
  if (!name) return;
  if (editingId) {
    if (typeof updateObject !== 'function') {
      if (typeof updateObjectSwitcher === 'function') updateObjectSwitcher();
      return;
    }
    var result = updateObject(editingId, { name: name });
    if (result && typeof result.then === 'function') {
      result.then(function () {
        if (typeof updateObjectSwitcher === 'function') updateObjectSwitcher();
        if (typeof showToast === 'function') showToast('Название сохранено', 'success');
      }).catch(function (err) {
        var msg = err && err.message ? err.message : 'Ошибка сохранения';
        if (typeof showToast === 'function') showToast(msg, 'error', 5000);
      });
    } else {
      if (typeof updateObjectSwitcher === 'function') updateObjectSwitcher();
    }
    return;
  }
  if (typeof addObject !== 'function') {
    if (typeof updateObjectSwitcher === 'function') updateObjectSwitcher();
    return;
  }
  var result = addObject(name);
  if (result && typeof result.then === 'function') {
    result.then(function () {
      if (typeof updateObjectSwitcher === 'function') updateObjectSwitcher();
    }).catch(function (err) {
      var msg = err && err.message ? err.message : 'Ошибка создания объекта';
      if (typeof showToast === 'function') showToast(msg, 'error', 5000);
      else if (typeof console !== 'undefined') console.error(msg);
    });
  } else {
    if (typeof updateObjectSwitcher === 'function') updateObjectSwitcher();
  }
}

/**
 * Обновляет переключатель объектов (баз) на экране меню
 */
function updateObjectSwitcher() {
  var select = document.getElementById('currentObjectSelect');
  var addBtn = document.getElementById('addObjectBtn');
  if (!select) return;
  var list = typeof getObjectsList === 'function' ? getObjectsList() : null;
  if (!list || list.length === 0) {
    if (typeof ensureObjectsAndMigration === 'function') ensureObjectsAndMigration();
    list = typeof getObjectsList === 'function' ? getObjectsList() : [{ id: 'default', name: 'Основная база' }];
  }
  var currentId = typeof getCurrentObjectId === 'function' ? getCurrentObjectId() : 'default';
  select.innerHTML = list.map(function (obj) {
    var name = (obj.name || obj.id || '').replace(/</g, '&lt;').replace(/"/g, '&quot;');
    return '<option value="' + (obj.id || '').replace(/"/g, '&quot;') + '"' + (obj.id === currentId ? ' selected' : '') + '>' + name + '</option>';
  }).join('');
  var deleteBtn = document.getElementById('deleteObjectBtn');
  if (deleteBtn) deleteBtn.disabled = (select.value === 'default');
  select.onchange = function () {
    var id = select.value;
    if (deleteBtn) deleteBtn.disabled = (id === 'default');
    if (id && typeof switchToObject === 'function') switchToObject(id);
  };
  if (addBtn && !addBtn.getAttribute('onclick')) {
    addBtn.onclick = function () { handleAddObjectClick(); };
  }
}

/**
 * Обновляет статистику стада на главном экране
 */
function updateHerdStats() {
  var list = (typeof getVisibleEntries === 'function') ? getVisibleEntries(entries || []) : (entries || []);
  if (!list || list.length === 0) {
    var totalEl = document.getElementById('totalCows');
    if (totalEl) totalEl.textContent = '0';
    var pEl = document.getElementById('pregnantCows');
    if (pEl) pEl.textContent = '0';
    var dEl = document.getElementById('dryCows');
    if (dEl) dEl.textContent = '0';
    var iEl = document.getElementById('inseminatedCows');
    if (iEl) iEl.textContent = '0';
    var cEl = document.getElementById('cullCows');
    if (cEl) cEl.textContent = '0';
    var percentsRow0 = document.getElementById('herdStatsPercentsRow');
    if (percentsRow0) { percentsRow0.setAttribute('aria-hidden', 'true'); percentsRow0.style.display = 'none'; }
    return;
  }

  const totalCows = list.length;
  const pregnantCows = list.filter(e => e.status && (e.status.includes('Стельная') || e.status.includes('Отёл'))).length;
  const dryCows = list.filter(e => e.status && e.status.includes('Сухостой')).length;
  const inseminatedCows = list.filter(e => e.status && (e.status.includes('Осеменен') || (e.status.toLowerCase && e.status.toLowerCase().includes('осеменен')))).length;
  const cullCows = list.filter(e => e.status && (e.status.toLowerCase ? e.status.toLowerCase().includes('брак') : e.status.includes('Брак'))).length;
  const notInseminatedCows = list.filter(e => !e.status || (e.status && (e.status.toLowerCase ? e.status.toLowerCase().includes('холостая') : e.status.includes('Холостая')))).length;

  document.getElementById('totalCows').textContent = totalCows;
  document.getElementById('pregnantCows').textContent = pregnantCows;
  document.getElementById('dryCows').textContent = dryCows;
  document.getElementById('inseminatedCows').textContent = inseminatedCows;
  document.getElementById('cullCows').textContent = cullCows;

  var percentsRow = document.getElementById('herdStatsPercentsRow');
  if (percentsRow) {
    if (totalCows === 0) {
      percentsRow.setAttribute('aria-hidden', 'true');
      percentsRow.style.display = 'none';
    } else {
      percentsRow.setAttribute('aria-hidden', 'false');
      percentsRow.style.display = '';
      var pct = function (n) { return Math.round((n / totalCows) * 100); };
      var pElPct = document.getElementById('pregnantCowsPct');
      var dElPct = document.getElementById('dryCowsPct');
      var iElPct = document.getElementById('inseminatedCowsPct');
      var cElPct = document.getElementById('cullCowsPct');
      var notInsElPct = document.getElementById('notInseminatedCowsPct');
      if (pElPct) pElPct.textContent = pct(pregnantCows) + '%';
      if (dElPct) dElPct.textContent = pct(dryCows) + '%';
      if (iElPct) iElPct.textContent = pct(inseminatedCows) + '%';
      if (cElPct) cElPct.textContent = pct(cullCows) + '%';
      if (notInsElPct) notInsElPct.textContent = pct(notInseminatedCows) + '%';
    }
  }
}

function initAddObjectModal() {
  var modal = document.getElementById('addObjectModal');
  var input = document.getElementById('addObjectNameInput');
  var closeBtn = document.getElementById('addObjectModalCloseBtn');
  var cancelBtn = document.getElementById('addObjectModalCancelBtn');
  var okBtn = document.getElementById('addObjectModalOkBtn');
  if (!modal || !input || modal.dataset.inited === '1') return;
  modal.dataset.inited = '1';
  function close() { hideAddObjectModal(); }
  if (closeBtn) closeBtn.addEventListener('click', close);
  if (cancelBtn) cancelBtn.addEventListener('click', close);
  if (okBtn) okBtn.addEventListener('click', confirmAddObject);
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); confirmAddObject(); }
    if (e.key === 'Escape') { e.preventDefault(); close(); }
  });
  modal.addEventListener('click', function (e) {
    if (e.target === modal) close();
  });
}

document.addEventListener('DOMContentLoaded', function () {
  initAddObjectModal();
  var currentUser = (typeof getCurrentUser === 'function') ? getCurrentUser() : null;
  // В Electron при каждом запуске показываем экран входа (удобно для проверки авторизации)
  var isElectron = typeof window !== 'undefined' && window.electronAPI;
  if (isElectron) {
    navigate('auth');
  } else if (currentUser) {
    syncRouteToScreen();
  } else {
    navigate('auth');
  }
});
if (typeof window !== 'undefined') {
  window.navigate = navigate;
  window.addEventListener('hashchange', syncRouteToScreen);
}

window.addEventListener('load', () => {
  if (document.getElementById('menu-screen').classList.contains('active')) {
    updateHerdStats();
  }
});

