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
      if (typeof window.refreshFarmDatalists === 'function') {
        try { window.refreshFarmDatalists(); } catch (e) {}
      }
    }).catch(function (err) {
      console.error("Ошибка инициализации (API):", err);
      if (typeof updateList === 'function') updateList();
      var msg = (err && err.message) ? err.message : '';
      if (msg.indexOf('авторизац') !== -1 || msg.indexOf('401') !== -1) {
        if (typeof showToast === 'function') showToast('Требуется вход: Настройки → Синхронизация или Войти → логин и пароль.', 'info', 8000);
        if (typeof window.updateSyncServerStatus === 'function') window.updateSyncServerStatus('Требуется вход. Настройки → Синхронизация или Войти.', true);
        if (typeof window.updateConnectionIndicator === 'function') window.updateConnectionIndicator(false);
      } else {
        if (typeof window.updateSyncServerStatusFromHealth === 'function') window.updateSyncServerStatusFromHealth();
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
  if (typeof window.refreshFarmDatalists === 'function') {
    try { window.refreshFarmDatalists(); } catch (e) {}
  }

  var versionEl = document.getElementById('app-version');
  var versionHeaderEl = document.getElementById('app-version-header');
  function setVersionText(text, versionValue) {
    if (versionEl) {
      versionEl.textContent = text;
      if (versionValue != null) versionEl.setAttribute('data-default-version', String(versionValue));
    }
    if (versionHeaderEl) versionHeaderEl.textContent = text;
  }
  if (versionEl || versionHeaderEl) {
    if (typeof window.electronAPI !== 'undefined' && window.electronAPI.getAppVersion) {
      window.electronAPI.getAppVersion().then(function (v) {
        setVersionText('Версия ' + v, v);
      });
    } else {
      var fallback = (versionEl && versionEl.getAttribute('data-default-version')) || '1.0.0';
      setVersionText('Версия ' + fallback, fallback);
      fetch('package.json').then(function (r) { return r.ok ? r.json() : null; }).then(function (pkg) {
        if (pkg && pkg.version) setVersionText('Версия ' + pkg.version, pkg.version);
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
 * Глубокая копия записи при редактировании из карточки (сохраняет actionHistory, inseminationHistory и т.д.).
 */
function cloneEntryForEdit(prev) {
  if (!prev || typeof prev !== 'object') return null;
  try {
    if (typeof structuredClone === 'function') return structuredClone(prev);
  } catch (e) {}
  try {
    return JSON.parse(JSON.stringify(prev));
  } catch (e2) {
    return null;
  }
}

function entriesEqualForSync(a, b) {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch (e) {
    return false;
  }
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
  var prev = window.currentEditingId
    ? entries.find(function (e) { return e.cattleId === window.currentEditingId; })
    : null;
  var wasEditingFromCard = !!window.currentEditingId;
  var editingIdSnap = window.currentEditingId;

  var entry;
  if (prev) {
    entry = cloneEntryForEdit(prev);
    if (!entry) entry = getDefaultCowEntry();
  } else {
    entry = getDefaultCowEntry();
  }
  fillCowEntryFromForm(entry);
  if (typeof getCurrentUser === 'function' && getCurrentUser()) {
    entry.userId = getCurrentUser().id;
    entry.lastModifiedBy = getCurrentUser().username;
  }

  function finalizeSave() {
    if (prev && !entriesEqualForSync(prev, entry)) entry.synced = false;
    var useApi = typeof window !== 'undefined' && window.CATTLE_TRACKER_USE_API && typeof window.updateEntryViaApi === 'function' && typeof window.createEntryViaApi === 'function';
    if (useApi) {
      var p;
      if (editingIdSnap) {
        entry.dateAdded = (entries.find(function (e) { return e.cattleId === editingIdSnap; }) || {}).dateAdded || entry.dateAdded;
        var prevEntryApi = entries.find(function (e) { return e.cattleId === editingIdSnap; }) || {};
        var hasChangesApi = !entriesEqualForSync(prevEntryApi, entry);
        entry.synced = hasChangesApi ? false : (prevEntryApi.synced === true);
        p = window.updateEntryViaApi(editingIdSnap, entry);
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
        if (wasEditingFromCard && cattleId) {
          if (typeof navigate === 'function') navigate('view-cow', { cattleId: cattleId });
          if (typeof viewCow === 'function') viewCow(cattleId);
        } else if (typeof navigate === 'function') navigate('view');
        console.log("Запись сохранена:", entry);
      }).catch(function (err) {
        if (typeof showToast === 'function') showToast(err && err.message ? err.message : 'Ошибка сохранения на сервере', 'error'); else alert(err && err.message ? err.message : 'Ошибка сохранения на сервере');
      });
      return;
    }
    if (editingIdSnap) {
      var index = entries.findIndex(function (e) { return e.cattleId === editingIdSnap; });
      if (index !== -1) {
        entry.dateAdded = entries[index].dateAdded;
        var hasChangesLocal = !entriesEqualForSync(entries[index], entry);
        entry.synced = hasChangesLocal ? false : (entries[index].synced === true);
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
    if (wasEditingFromCard && cattleId) {
      if (typeof navigate === 'function') navigate('view-cow', { cattleId: cattleId });
      if (typeof viewCow === 'function') viewCow(cattleId);
    } else if (typeof navigate === 'function') navigate('view');
    console.log("Запись сохранена:", entry);
  }

  if (!prev) {
    finalizeSave();
    return;
  }

  var G = window.ActionInputGuards;
  var chain = Promise.resolve(true);

  var prevCalvingDate = (prev.calvingDate || '').trim();
  var nextCalvingDate = (entry.calvingDate || '').trim();
  if (nextCalvingDate && prevCalvingDate !== nextCalvingDate && typeof window.applyCalvingToEntry === 'function') {
    chain = chain.then(function (cont) {
      if (cont === false) return false;
      if (!G || typeof G.confirmCalvingFlow !== 'function') {
        try {
          window.applyCalvingToEntry(entry, nextCalvingDate);
        } catch (err) {
          var msg = err && err.message ? err.message : String(err);
          if (typeof showToast === 'function') showToast(msg, 'error'); else alert(msg);
          return false;
        }
        return true;
      }
      return G.confirmCalvingFlow(prev, nextCalvingDate).then(function (dec) {
        if (dec === 'cancel') return false;
        try {
          if (dec === 'abort' && typeof window.applyAbortToEntry === 'function') {
            window.applyAbortToEntry(entry, nextCalvingDate, '');
          } else {
            window.applyCalvingToEntry(entry, nextCalvingDate);
          }
        } catch (err2) {
          var msg2 = err2 && err2.message ? err2.message : String(err2);
          if (typeof showToast === 'function') showToast(msg2, 'error'); else alert(msg2);
          return false;
        }
        return true;
      });
    });
  }

  var prevDryStartDate = (prev.dryStartDate || '').trim();
  var nextDryStartDate = (entry.dryStartDate || '').trim();
  if (nextDryStartDate && prevDryStartDate !== nextDryStartDate && typeof window.applyDryRunToEntry === 'function') {
    chain = chain.then(function (cont) {
      if (cont === false) return false;
      if (!G || typeof G.confirmDryFlow !== 'function') {
        window.applyDryRunToEntry(entry, nextDryStartDate);
        return true;
      }
      return G.confirmDryFlow(prev, nextDryStartDate).then(function (ok) {
        if (!ok) return false;
        window.applyDryRunToEntry(entry, nextDryStartDate);
        return true;
      });
    });
  }

  var prevPn = ((prev.protocol && prev.protocol.name) || '').trim();
  var entryPn = ((entry.protocol && entry.protocol.name) || '').trim();
  var prevSd = ((prev.protocol && prev.protocol.startDate) || '').trim();
  var entrySd = ((entry.protocol && entry.protocol.startDate) || '').trim();
  if (entryPn && (prevPn !== entryPn || prevSd !== entrySd) && typeof window.applyProtocolAssignToEntry === 'function') {
    chain = chain.then(function (cont) {
      if (cont === false) return false;
      if (!G || typeof G.confirmProtocolAssignFlow !== 'function') {
        try {
          window.applyProtocolAssignToEntry(entry, entryPn, entrySd);
        } catch (errP) {
          var msgP = errP && errP.message ? errP.message : String(errP);
          if (typeof showToast === 'function') showToast(msgP, 'error'); else alert(msgP);
          return false;
        }
        return true;
      }
      return G.confirmProtocolAssignFlow(prev, entryPn, entrySd).then(function (res) {
        if (!res || res.mode === 'cancel') return false;
        try {
          if (res.mode === 'replace_previous' && typeof window.applyProtocolClearToEntry === 'function') {
            window.applyProtocolClearToEntry(entry);
          }
          window.applyProtocolAssignToEntry(entry, entryPn, entrySd);
        } catch (errPr) {
          var msgPr = errPr && errPr.message ? errPr.message : String(errPr);
          if (typeof showToast === 'function') showToast(msgPr, 'error'); else alert(msgPr);
          return false;
        }
        return true;
      });
    });
  }

  chain.then(function (cont) {
    if (cont === false) return;
    finalizeSave();
  });
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
    entries: window.entries,
    nowFormatted: window.nowFormatted,
    addEntry,
    saveCurrentEntry
  };
}
export {};