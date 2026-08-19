/** __syncBases part 3 */
(function () {
  'use strict';
  var root = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this);
  var NS = root['__syncBases'] = root['__syncBases'] || {};
  var global = typeof window !== 'undefined' ? window : this;

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
      globalThis['__syncBases'].renderSyncServerBasesList();
      if (typeof window.loadObjectsFromApi === 'function') window.loadObjectsFromApi();
      if (typeof window.loadLocally === 'function') window.loadLocally({ forceFromServer: true });
      if (typeof window.updateObjectSwitcher === 'function') window.updateObjectSwitcher();
      window.CattleTrackerApi.setCurrentObjectId(newObj.id);
      if (typeof window.loadLocally === 'function') window.loadLocally({ forceFromServer: true });
      return;
    }
    var i = 0;
    function next() {
      if (i >= list.length) {
        if (statusEl) statusEl.textContent = 'Готово: база «' + name + '» на сервере, записей ' + list.length + '.';
        globalThis['__syncBases'].renderSyncServerBasesList();
        if (typeof window.loadObjectsFromApi === 'function') window.loadObjectsFromApi();
        window.CattleTrackerApi.setCurrentObjectId(newObj.id);
        if (typeof window.loadLocally === 'function') window.loadLocally({ forceFromServer: true });
        if (typeof window.updateObjectSwitcher === 'function') window.updateObjectSwitcher();
        return;
      }
      window.CattleTrackerApi.createEntry(newObj.id, list[i]).then(function () { i++; next(); }).catch(function (err) {
        if (statusEl) { statusEl.textContent = 'Ошибка: ' + (err && err.message ? err.message : ''); statusEl.className = 'sync-server-status sync-server-status-error'; }
      });
    }
    next();
  }).catch(function (err) {
    var em = err && err.message ? err.message : '';
    if (statusEl) { statusEl.textContent = 'Ошибка: ' + em; statusEl.className = 'sync-server-status sync-server-status-error'; }
    if (typeof showToast === 'function') showToast(em || 'Ошибка', 'error', 5000);
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

function normalizeEntriesList(raw) {
  if (Array.isArray(raw)) return raw;
  if (raw && Array.isArray(raw.entries)) return raw.entries;
  return [];
}

/**
 * Старый сервер без copyFromObjectId: копирование записей с клиента (медленно, на мобильных часто обрывается).
 */
function fallbackClientCopyEntriesFromServer(sourceId, targetId, baseName, statusEl) {
  if (statusEl) statusEl.textContent = 'Копирование записей (старый сервер)…';
  return window.CattleTrackerApi.loadEntries(sourceId).then(function (rawEntries) {
    var entries = normalizeEntriesList(rawEntries);
    if (!entries.length) {
      if (statusEl) statusEl.textContent = 'Объект «' + baseName + '» создан (записей 0).';
      if (typeof window.setServerBaseImportProgress === 'function') {
        window.setServerBaseImportProgress(0, 0, 'Готово');
      }
      globalThis['__syncBases'].renderSyncServerBasesList();
      return globalThis['__syncBases'].afterServerImportRefresh();
    }
    if (typeof window.setServerBaseImportProgress === 'function') {
      window.setServerBaseImportProgress(0, entries.length, 'Добавление записей на сервер…');
    }
    var i = 0;
    function next() {
      if (i >= entries.length) {
        if (statusEl) statusEl.textContent = 'Готово: объект «' + baseName + '», записей ' + entries.length + '.';
        if (typeof window.setServerBaseImportProgress === 'function') {
          window.setServerBaseImportProgress(entries.length, entries.length, 'Готово');
        }
        globalThis['__syncBases'].renderSyncServerBasesList();
        return globalThis['__syncBases'].afterServerImportRefresh();
      }
      var entry = entries[i];
      window.CattleTrackerApi.createEntry(targetId, entry).then(function () {
        i++;
        if (typeof window.setServerBaseImportProgress === 'function') {
          window.setServerBaseImportProgress(i, entries.length, 'Добавление записей на сервер…');
        }
        next();
      }).catch(function (err) {
        if (statusEl) statusEl.textContent = 'Ошибка: ' + (err && err.message ? err.message : ''); statusEl.className = 'sync-server-status sync-server-status-error';
        return Promise.reject(err);
      });
    }
    next();
  });
}

/**
 * Импорт базы с сервера в новый объект. Сервер с поддержкой copyFromObjectId копирует записи внутри БД (один HTTP-запрос).
 */
function loadServerBaseIntoNewObject(sourceId, name) {
  if (!window.CATTLE_TRACKER_USE_API || !window.CattleTrackerApi) return;
  if (_loadServerBaseImportBusy) {
    if (typeof showToast === 'function') showToast('Дождитесь завершения загрузки базы', 'info', 3000);
    return;
  }
  if (name === undefined || name === null) {
    name = prompt('Название нового объекта:', 'Копия базы');
    if (name === null || !String(name).trim()) return;
  }
  name = String(name).trim();
  globalThis['__syncBases'].backupCurrentLocalBaseBeforeSwitch('import-new-object');
  var statusEl = document.getElementById('syncServerStatus');
  if (statusEl) { statusEl.textContent = 'Копирование базы на сервере…'; statusEl.className = 'sync-server-status'; }
  _loadServerBaseImportBusy = true;
  if (typeof window.setSyncBasesImportButtonsDisabled === 'function') window.setSyncBasesImportButtonsDisabled(true);
  if (typeof window.setServerBaseImportProgressVisible === 'function') window.setServerBaseImportProgressVisible(true);
  if (typeof window.setServerBaseImportProgress === 'function') {
    window.setServerBaseImportProgress(0, 0, 'Копирование на сервере (один запрос)…');
  }
  window.CattleTrackerApi.createObject(name, sourceId).then(function (newObj) {
    if (!newObj || !newObj.id) {
      throw new Error('Сервер не вернул id новой базы');
    }
    window.CattleTrackerApi.setCurrentObjectId(newObj.id);
    if (newObj.entriesCopied !== undefined && newObj.entriesCopied !== null) {
      var c = Number(newObj.entriesCopied);
      if (statusEl) {
        statusEl.textContent = c
          ? ('Готово: объект «' + name + '», записей ' + c + '.')
          : ('Объект «' + name + '» создан (записей 0).');
      }
      if (typeof window.setServerBaseImportProgress === 'function') {
        if (c > 0) window.setServerBaseImportProgress(c, c, 'Готово');
        else window.setServerBaseImportProgress(0, 0, 'Готово');
      }
      globalThis['__syncBases'].renderSyncServerBasesList();
      return globalThis['__syncBases'].afterServerImportRefresh();
    }
    return fallbackClientCopyEntriesFromServer(sourceId, newObj.id, name, statusEl);
  }).catch(function (err) {
    var em = err && err.message ? err.message : '';
    if (statusEl) { statusEl.textContent = 'Ошибка: ' + em; statusEl.className = 'sync-server-status sync-server-status-error'; }
    if (typeof showToast === 'function') showToast(em || 'Ошибка', 'error', 5000);
  }).then(function () {
    _loadServerBaseImportBusy = false;
    if (typeof window.setSyncBasesImportButtonsDisabled === 'function') window.setSyncBasesImportButtonsDisabled(false);
    if (typeof window.setServerBaseImportProgressVisible === 'function') window.setServerBaseImportProgressVisible(false);
  });
}

/**
 * Скрыть базу только в списке на этом устройстве (сервер не меняется). Из экрана «Базы на сервере».
 */
function hideServerBaseLocalOnly(baseId, baseName) {
  if (!window.CATTLE_TRACKER_USE_API || !window.CattleTrackerApi || typeof window.CattleTrackerApi.hideObjectLocal !== 'function') return;
  var safe = String(baseName || baseId || '').replace(/</g, '&lt;');
  var msg = 'Скрыть базу «' + safe + '» на этом устройстве? На сервере она останется, снова появится после очистки данных приложения или на другом устройстве.';
  function run() {
    window.CattleTrackerApi.hideObjectLocal(baseId).then(function () {
      if (typeof window.afterLocalHideObject === 'function') {
        return window.afterLocalHideObject(baseId);
      }
    }).then(function () {
      if (typeof showToast === 'function') showToast('База скрыта на этом устройстве', 'info', 4000);
      if (typeof window.renderSyncServerBasesList === 'function') window.renderSyncServerBasesList();
    }).catch(function (err) {
      var m = err && err.message ? err.message : 'Ошибка';
      if (typeof showToast === 'function') showToast(m, 'error', 5000);
    });
  }
  if (typeof showConfirmModal === 'function') {
    showConfirmModal(msg).then(function (ok) { if (ok) run(); });
    return;
  }
  if (confirm(msg)) run();
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
        replaceServerBaseInObject(sourceId, targetId, typeof nameOpt === 'string' ? nameOpt : String(nameOpt || ''));
      });
    };
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
    document.body.style.overflow = 'hidden';
    document.body.appendChild(overlay);
  }).catch(function (err) { if (typeof showToast === 'function') showToast('Ошибка: ' + (err && err.message ? err.message : ''), 'error'); else alert('Ошибка: ' + (err && err.message ? err.message : '')); });
}

function replaceServerBaseInObject(sourceId, targetId, sourceName) {
  if (!window.CATTLE_TRACKER_USE_API || !window.CattleTrackerApi) return;
  var statusEl = document.getElementById('syncServerStatus');
  if (statusEl) statusEl.textContent = 'Загрузка и замена…';
  var newName = (sourceName != null && String(sourceName).trim()) ? String(sourceName).trim() : '';
  window.CattleTrackerApi.loadEntries(sourceId).then(function (rawSource) {
    var sourceEntries = normalizeEntriesList(rawSource);
    return window.CattleTrackerApi.loadEntries(targetId).then(function (rawTarget) {
      var targetEntries = normalizeEntriesList(rawTarget);
      var cache = typeof window.__getSyncBasesCache === 'function' ? window.__getSyncBasesCache() : [];
      var targetMeta = (cache || []).filter(function (o) { return o && o.id === targetId; })[0];
      var targetName = (targetMeta && (targetMeta.name || targetMeta.id)) ? String(targetMeta.name || targetMeta.id) : String(targetId);
      globalThis['__syncBases'].saveSnapshotBeforeServerOverwrite(targetId, targetName, targetEntries, 'replace-target-server');
      var deleteNext = function (idx) {
        if (idx >= targetEntries.length) {
          var addNext = function (i) {
            if (i >= sourceEntries.length) {
              function afterRename() {
                if (statusEl) statusEl.textContent = 'Готово: заменено записей ' + sourceEntries.length + '.';
                globalThis['__syncBases'].renderSyncServerBasesList();
                window.CattleTrackerApi.setCurrentObjectId(targetId);
                return globalThis['__syncBases'].afterServerImportRefresh({ forceFromServer: true });
              }
              if (newName) {
                return window.CattleTrackerApi.updateObject(targetId, { name: newName }).then(function () {
                  if (typeof window.loadObjectsFromApi === 'function') return window.loadObjectsFromApi();
                }).then(afterRename).catch(function (err) {
                  if (statusEl) { statusEl.textContent = 'Ошибка переименования: ' + (err && err.message ? err.message : ''); statusEl.className = 'sync-server-status sync-server-status-error'; }
                });
              }
              return afterRename();
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


  // register functions
  NS.uploadCurrentBaseToServer = uploadCurrentBaseToServer;
  NS.showImportNewObjectModal = showImportNewObjectModal;
  NS.normalizeEntriesList = normalizeEntriesList;
  NS.fallbackClientCopyEntriesFromServer = fallbackClientCopyEntriesFromServer;
  NS.loadServerBaseIntoNewObject = loadServerBaseIntoNewObject;
  NS.hideServerBaseLocalOnly = hideServerBaseLocalOnly;
  NS.showReplaceBaseModal = showReplaceBaseModal;
  NS.replaceServerBaseInObject = replaceServerBaseInObject;
})();
export {};
