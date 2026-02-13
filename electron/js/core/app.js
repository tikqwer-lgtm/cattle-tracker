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
      if (typeof updateObjectSwitcher === 'function') updateObjectSwitcher();
      if (typeof updateHerdStats === 'function') updateHerdStats();
      console.log("Приложение инициализировано (API). Записей:", entries.length);
      if (entries.length === 0 && typeof showToast === 'function') {
        showToast('На сервере пока нет записей. Локальные данные остались в браузере — уберите адрес сервера в Настройках, чтобы снова с ними работать.', 'info', 8000);
      }
    }).catch(function (err) {
      console.error("Ошибка инициализации (API):", err);
      if (typeof updateList === 'function') updateList();
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
  if (versionEl) {
    if (typeof window.electronAPI !== 'undefined' && window.electronAPI.getAppVersion) {
      window.electronAPI.getAppVersion().then(function (v) {
        versionEl.textContent = 'Версия ' + v;
      });
    } else {
      var fallback = versionEl.getAttribute('data-default-version') || '1.0.0';
      versionEl.textContent = 'Версия ' + fallback;
      fetch('package.json').then(function (r) { return r.ok ? r.json() : null; }).then(function (pkg) {
        if (pkg && pkg.version) versionEl.textContent = 'Версия ' + pkg.version;
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