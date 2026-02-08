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

/**
 * Возвращает текущую дату и время в формате строки "дд.мм.гггг чч:мм"
 * @returns {string}
 */
function nowFormatted() {
  const now = new Date();
  return now.toLocaleDateString("ru-RU") + " " +
         now.toLocaleTimeString("ru-RU", { hour: '2-digit', minute: '2-digit' });
}

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
      if (typeof updateObjectSwitcher === 'function') updateObjectSwitcher();
      if (typeof updateHerdStats === 'function') updateHerdStats();
      console.log("Приложение инициализировано (API). Записей:", entries.length);
    }).catch(function (err) {
      console.error("Ошибка инициализации (API):", err);
      if (typeof updateList === 'function') updateList();
    });
  } else {
    if (typeof loadLocally === 'function') loadLocally();
    else console.error('Функция loadLocally не найдена. Проверьте подключение storage.js');
    if (typeof updateList === 'function') updateList();
    console.log("Приложение инициализировано. Записей:", entries.length);
  }

  if (typeof VoiceAssistant !== 'undefined') {
    new VoiceAssistant();
  }
  if (!useApi && typeof initInseminationModule === 'function') {
    initInseminationModule();
  }
}

/**
 * Основная функция для добавления записи (вызывает другие модули)
 */
function addEntry() {
  console.log("Добавление записи...");
  var cattleId = (document.getElementById("cattleId") && document.getElementById("cattleId").value || '').trim();
  if (!cattleId) {
    alert("Заполните номер коровы!");
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
      alert(err && err.message ? err.message : "Ошибка сохранения на сервере");
    });
    return;
  }
  if (entries.some(function (e) { return e.cattleId === cattleId; })) {
    alert("Корова с таким номером уже существует!");
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
    alert('Заполните номер коровы!');
    return;
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
      alert(err && err.message ? err.message : "Ошибка сохранения на сервере");
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

// Запуск приложения при загрузке
document.addEventListener('DOMContentLoaded', initApp);

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
        if (typeof showToast === 'function') showToast('Проверка обновлений доступна в установленной версии', 'info');
        else alert('Проверка обновлений доступна в установленной версии.');
        return;
      }
      if (!r.ok) {
        if (typeof showToast === 'function') showToast('Не удалось проверить обновления', 'error');
        else alert('Не удалось проверить обновления.');
        return;
      }
      if (r.version) {
        if (typeof showToast === 'function') showToast('Доступна версия ' + r.version + '. Скачивание…', 'info');
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

// Экспорт для других модулей
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    entries,
    nowFormatted,
    addEntry,
    saveCurrentEntry
  };
}