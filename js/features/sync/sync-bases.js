/** Фрагмент модуля синхронизации; фасад: ../sync.js */
function formatServerDate(isoStr) {
  if (!isoStr) return '—';
  var d = new Date(isoStr);
  if (isNaN(d.getTime())) return isoStr;
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

var _syncBasesData = [];
window.__getSyncBasesCache = function () { return _syncBasesData; };
var _syncBasesSort = { key: 'name', dir: 'asc' };
var _syncBasesFilterName = '';
var _syncBasesFilterUser = '';

/** На телефоне: только скачать с сервера под новым именем, без выгрузки/удаления/замены в другую базу. */
function isSyncMobileLimited() {
  return typeof window.isMobile === 'function' && window.isMobile();
}

/** Полномочия как у администратора в интерфейсе баз (в т.ч. удаление любой базы на сервере — у manager). */
function isSyncUserElevated() {
  if (typeof window.getCurrentUser !== 'function') return false;
  var u = window.getCurrentUser();
  return !!(u && (u.role === 'admin' || u.role === 'manager'));
}

function normalizeBaseName(s) {
  return String(s || '').trim().toLowerCase();
}

function maxEntryUpdatedIso(entries) {
  var m = '';
  (entries || []).forEach(function (e) {
    var t = e && (e.updated_at != null ? e.updated_at : e.updatedAt);
    if (t != null && String(t).trim() && String(t) > String(m)) m = String(t);
  });
  return m;
}

/**
 * Если у локальной базы с тем же названием записи новее метки сервера — запрос подтверждения.
 */
function confirmDownloadIfStale(sourceName, sourceDateRaw, targetId) {
  var targetList = typeof window.getObjectsList === 'function' ? window.getObjectsList() : [];
  var tMeta = (targetList || []).filter(function (o) { return o && o.id === targetId; })[0];
  var tName = (tMeta && tMeta.name) ? String(tMeta.name) : '';
  if (normalizeBaseName(tName) !== normalizeBaseName(sourceName)) return Promise.resolve(true);
  var cached = typeof window.readApiEntriesCache === 'function' ? window.readApiEntriesCache(targetId) : null;
  if (cached == null || !cached.length) return Promise.resolve(true);
  var localMax = maxEntryUpdatedIso(cached);
  var srv = String(sourceDateRaw || '').trim();
  if (!localMax || !srv || localMax <= srv) return Promise.resolve(true);
  var msg = 'У локальной базы «' + tName.replace(/</g, '&lt;') + '» данные новее, чем у копии на сервере. Всё равно загрузить с сервера и заменить локальные записи?';
  if (typeof showConfirmModal === 'function') return showConfirmModal(msg);
  return Promise.resolve(confirm(msg));
}

var _overwriteServerBusy = false;

/**
 * Полная замена записей на сервере для текущего objectId содержимым локальных window.entries.
 */
function overwriteCurrentServerBaseWithLocal() {
  if (!window.CATTLE_TRACKER_USE_API || !window.CattleTrackerApi) return Promise.resolve();
  if (_overwriteServerBusy) return Promise.resolve();
  var objectId = typeof getCurrentObjectId === 'function' ? getCurrentObjectId() : '';
  var pend = window.CattleTrackerApi && window.CattleTrackerApi.PENDING_OBJECT_ID;
  if (!objectId || (pend && objectId === pend)) {
    if (typeof showToast === 'function') showToast('Выберите базу', 'info');
    return Promise.resolve();
  }
  var localEntries = (typeof window.entries !== 'undefined' && Array.isArray(window.entries)) ? window.entries : [];
  var msg = 'Заменить на сервере все записи этой базы текущими локальными? Старые записи на сервере для этой базы будут удалены.';
  function runOverwrite() {
    _overwriteServerBusy = true;
    var progressBlock = document.getElementById('syncProgressBlock');
    var progressBar = document.getElementById('syncProgressBar');
    var progressLabel = document.getElementById('syncProgressLabel');
    var progressText = document.getElementById('syncProgressText');
    var statusEl = document.getElementById('syncServerStatus');
    function setBtns(disabled) {
      document.querySelectorAll('.sync-current-base-btn').forEach(function (btn) { btn.disabled = !!disabled; });
    }
    function showProg(on) {
      if (progressBlock) progressBlock.style.display = on ? 'block' : 'none';
    }
    function setProg(done, total, label) {
      var pct = total ? Math.min(100, Math.round((done / total) * 100)) : (done > 0 ? 50 : 0);
      if (progressBar) {
        progressBar.style.width = pct + '%';
        progressBar.setAttribute('aria-valuenow', pct);
      }
      if (progressLabel && label !== undefined) progressLabel.textContent = label;
      if (progressText) progressText.textContent = total ? (done + ' / ' + total) : '—';
    }
    setBtns(true);
    showProg(true);
    setProg(0, 0, 'Чтение сервера…');
    if (statusEl) { statusEl.textContent = 'Подготовка выгрузки…'; statusEl.className = 'sync-server-status'; }
    function finishOk() {
      _overwriteServerBusy = false;
      setBtns(false);
      showProg(false);
    }
    function finishErr(text) {
      finishOk();
      if (statusEl) { statusEl.textContent = text || 'Ошибка'; statusEl.className = 'sync-server-status sync-server-status-error'; }
      if (typeof showToast === 'function') showToast(text || 'Ошибка', 'error', 5000);
    }
    return window.CattleTrackerApi.loadEntries(objectId).then(function (rawServer) {
      var serverEntries = normalizeEntriesList(rawServer);
      var totalSteps = serverEntries.length + localEntries.length;
      var step = 0;
      function deleteNext(idx) {
        if (idx >= serverEntries.length) {
          var i = 0;
          function addNext() {
            if (i >= localEntries.length) {
              finishOk();
              if (statusEl) statusEl.textContent = 'Выгрузка на сервер завершена.';
              return (typeof window.loadLocally === 'function' ? window.loadLocally({ forceFromServer: true }) : Promise.resolve()).then(function () {
                if (typeof updateList === 'function') updateList();
                if (typeof updateHerdStats === 'function') updateHerdStats();
                if (typeof updateViewList === 'function') updateViewList();
                if (typeof window.renderSyncServerBasesList === 'function') window.renderSyncServerBasesList();
              });
            }
            var entry = localEntries[i];
            var cattleId = (entry && entry.cattleId) ? String(entry.cattleId).trim() : '';
            if (!cattleId) {
              i++;
              return addNext();
            }
            window.CattleTrackerApi.createEntry(objectId, entry).then(function () {
              if (entry) entry.synced = true;
              i++;
              step++;
              setProg(step, Math.max(1, totalSteps), 'Выгрузка на сервер…');
              return addNext();
            }).catch(function (err) {
              finishErr(err && err.message ? err.message : 'Ошибка выгрузки');
            });
          }
          return addNext();
        }
        var row = serverEntries[idx];
        var cid = row && row.cattleId ? String(row.cattleId).trim() : '';
        if (!cid) {
          deleteNext(idx + 1);
          return;
        }
        window.CattleTrackerApi.deleteEntry(objectId, cid).then(function () {
          idx++;
          step++;
          setProg(step, Math.max(1, totalSteps), 'Очистка старых записей на сервере…');
          deleteNext(idx);
        }).catch(function (err) {
          finishErr(err && err.message ? err.message : 'Ошибка удаления на сервере');
        });
      }
      deleteNext(0);
    }).catch(function (err) {
      finishErr(err && err.message ? err.message : 'Ошибка чтения с сервера');
    });
  }
  if (typeof showConfirmModal === 'function') {
    return showConfirmModal(msg).then(function (ok) {
      if (!ok) return Promise.resolve();
      return runOverwrite();
    });
  }
  if (!confirm(msg)) return Promise.resolve();
  return runOverwrite();
}

/**
 * Одна слот резервной копии перед загрузкой/заменой данных с сервера (старый снимок перезаписывается).
 * Ключ фиксированный — «файл с тем же именем» в смысле одного слота хранилища.
 */
var SYNC_PRE_LOAD_BACKUP_KEY = 'cattleTracker_syncPreLoadBackup';

function saveSnapshotBeforeServerOverwrite(objectId, objectName, entries, reason) {
  try {
    var oid = objectId != null ? String(objectId) : '';
    var name = (objectName != null && String(objectName).trim()) ? String(objectName).trim() : (oid || 'база');
    var arr = Array.isArray(entries) ? JSON.parse(JSON.stringify(entries)) : [];
    var payload = {
      objectId: oid,
      objectName: name,
      entries: arr,
      savedAt: new Date().toISOString(),
      reason: reason || ''
    };
    localStorage.setItem(SYNC_PRE_LOAD_BACKUP_KEY, JSON.stringify(payload));
  } catch (e) {}
}

function backupCurrentLocalBaseBeforeSwitch(reason) {
  if (!window.CATTLE_TRACKER_USE_API) return;
  var oid = typeof getCurrentObjectId === 'function' ? getCurrentObjectId() : '';
  var pend = window.CattleTrackerApi && window.CattleTrackerApi.PENDING_OBJECT_ID;
  if (!oid || (pend && oid === pend)) return;
  var list = typeof getObjectsList === 'function' ? getObjectsList() : [];
  var meta = (list || []).filter(function (o) { return o && o.id === oid; })[0];
  var name = (meta && (meta.name || meta.id)) ? String(meta.name || meta.id) : String(oid);
  var entries = (typeof window.entries !== 'undefined' && Array.isArray(window.entries)) ? window.entries : [];
  saveSnapshotBeforeServerOverwrite(oid, name, entries, reason);
}

/**
 * @param {{ forceFromServer?: boolean }} [opt] — после замены данных на сервере передать { forceFromServer: true }
 */
function afterServerImportRefresh(opt) {
  var force = opt && opt.forceFromServer === true;
  var p = typeof window.loadLocally === 'function'
    ? window.loadLocally(force ? { forceFromServer: true } : undefined)
    : Promise.resolve();
  return Promise.resolve(p).then(function () {
    if (typeof window.updateObjectSwitcher === 'function') window.updateObjectSwitcher();
    if (typeof window.updateHerdStats === 'function') window.updateHerdStats();
    if (typeof window.updateViewList === 'function') window.updateViewList();
  });
}

function getCurrentUsername() {
  if (typeof window.getCurrentUser === 'function') {
    var u = window.getCurrentUser();
    return u && u.username ? String(u.username) : '';
  }
  return '';
}

var _loadServerBaseImportBusy = false;

/**
 * Мобильный сценарий: открыть существующую базу на сервере без создания клона; скачивание с прогрессом.
 */
function openServerBaseOnMobile(sourceId, sourceName) {
  if (!window.CATTLE_TRACKER_USE_API || !window.CattleTrackerApi) return;
  if (typeof window.CattleTrackerApi.loadEntriesWithProgress !== 'function') {
    if (typeof showToast === 'function') showToast('Обновите приложение для загрузки с прогрессом', 'error');
    return;
  }
  if (_loadServerBaseImportBusy) {
    if (typeof showToast === 'function') showToast('Дождитесь завершения загрузки базы', 'info', 3000);
    return;
  }
  var statusEl = document.getElementById('syncServerStatus');
  _loadServerBaseImportBusy = true;
  if (typeof window.setSyncBasesImportButtonsDisabled === 'function') window.setSyncBasesImportButtonsDisabled(true);
  if (typeof window.setServerBaseImportProgressVisible === 'function') window.setServerBaseImportProgressVisible(true);
  if (typeof window.setServerBaseImportProgress === 'function') {
    window.setServerBaseImportProgress(0, 0, 'Скачивание записей…');
  }
  if (statusEl) {
    statusEl.textContent = 'Загрузка базы «' + String(sourceName || '').replace(/</g, '&lt;') + '»…';
    statusEl.className = 'sync-server-status';
  }

  backupCurrentLocalBaseBeforeSwitch('mobile-open');
  window.CattleTrackerApi.setCurrentObjectId(sourceId);
  window.CattleTrackerApi.loadEntriesWithProgress(sourceId, function (ev) {
    var t = ev.total || 0;
    var l = ev.loaded || 0;
    if (typeof window.setServerBaseImportProgress === 'function') {
      if (t > 0) window.setServerBaseImportProgress(l, t, 'Скачивание записей…');
      else window.setServerBaseImportProgress(l, 0, 'Скачивание записей…');
    }
  }).then(function (list) {
    list = list || [];
    if (typeof window.writeApiEntriesCache === 'function') window.writeApiEntriesCache(sourceId, list);
    if (typeof window.replaceEntriesWith === 'function') window.replaceEntriesWith(list);
    else {
      window.entries.length = 0;
      list.forEach(function (e) { window.entries.push(e); });
      if (typeof window !== 'undefined') window.entries = window.entries;
    }
    if (typeof window.CattleTrackerEvents !== 'undefined') {
      window.CattleTrackerEvents.emit('entries:updated', window.entries);
    }
    if (typeof window.updateList === 'function') window.updateList();
    if (typeof window.setServerBaseImportProgress === 'function') {
      var n = list.length;
      window.setServerBaseImportProgress(n > 0 ? n : 1, n > 0 ? n : 1, 'Готово');
    }
    if (statusEl) {
      statusEl.textContent = 'База «' + String(sourceName || '').replace(/</g, '&lt;') + '» загружена (' + list.length + ' записей).';
    }
    if (typeof window.ensureProtocolsLoaded === 'function') {
      try { window.ensureProtocolsLoaded(function () {}); } catch (e) {}
    }
    if (typeof window.loadObjectsFromApi === 'function') return window.loadObjectsFromApi();
  }).then(function () {
    if (typeof window.updateObjectSwitcher === 'function') window.updateObjectSwitcher();
    if (typeof window.updateHerdStats === 'function') window.updateHerdStats();
    if (typeof window.updateViewList === 'function') window.updateViewList();
    if (typeof window.renderSyncServerBasesList === 'function') window.renderSyncServerBasesList();
  }).catch(function (err) {
    var msg = err && err.message ? err.message : 'Ошибка загрузки';
    if (statusEl) {
      statusEl.textContent = 'Ошибка: ' + msg;
      statusEl.className = 'sync-server-status sync-server-status-error';
    }
    if (typeof showToast === 'function') showToast(msg, 'error', 6000);
  }).then(function () {
    _loadServerBaseImportBusy = false;
    if (typeof window.setSyncBasesImportButtonsDisabled === 'function') window.setSyncBasesImportButtonsDisabled(false);
    if (typeof window.setServerBaseImportProgressVisible === 'function') window.setServerBaseImportProgressVisible(false);
  });
}

function renderSyncBasesFilters() {
  var filterEl = document.getElementById('syncBasesFilter');
  if (!filterEl) return;
  var userNames = [];
  _syncBasesData.forEach(function (o) {
    var u = (o._user || '').trim();
    if (u && userNames.indexOf(u) === -1) userNames.push(u);
  });
  userNames.sort(function (a, b) { return a.localeCompare(b, 'ru'); });
  var userOpts =
    '<option value="">Все пользователи</option>' +
    userNames.map(function (u) {
      var sel = _syncBasesFilterUser === u ? ' selected' : '';
      return '<option value="' + u.replace(/"/g, '&quot;') + '"' + sel + '>' + u.replace(/</g, '&lt;').replace(/&/g, '&amp;') + '</option>';
    }).join('');
  filterEl.innerHTML =
    '<div class="sync-bases-filter-row">' +
    '<input type="text" id="syncFilterName" class="sync-filter-input" placeholder="Фильтр по названию" value="' + (_syncBasesFilterName || '').replace(/"/g, '&quot;') + '" />' +
    '<label class="sync-filter-user-label" for="syncFilterUserSelect">Пользователь</label>' +
    '<select id="syncFilterUserSelect" class="sync-filter-input sync-filter-user-select" aria-label="Фильтр по пользователю">' +
    userOpts +
    '</select>' +
    '</div>';
  var nameInp = document.getElementById('syncFilterName');
  var userSel = document.getElementById('syncFilterUserSelect');
  function onFilter() {
    _syncBasesFilterName = (nameInp ? nameInp.value : '').trim().toLowerCase();
    _syncBasesFilterUser = (userSel ? userSel.value : '').trim();
    renderSyncBasesTable();
  }
  if (nameInp) nameInp.addEventListener('input', onFilter);
  if (userSel) userSel.addEventListener('change', onFilter);
}

function renderSyncBasesTable() {
  var container = document.getElementById('syncServerBasesList');
  if (!container) return;
  var currentId = typeof getCurrentObjectId === 'function' ? getCurrentObjectId() : '';
  var currentUser = getCurrentUsername();
  var filtered = _syncBasesData.filter(function (obj) {
    var n = (obj.name || '').toLowerCase();
    var u = (obj._user || '').trim();
    if (_syncBasesFilterName && n.indexOf(_syncBasesFilterName) === -1) return false;
    if (_syncBasesFilterUser && u !== _syncBasesFilterUser) return false;
    return true;
  });
  var sk = _syncBasesSort.key;
  var sd = _syncBasesSort.dir === 'asc' ? 1 : -1;
  filtered.sort(function (a, b) {
    var va = '', vb = '';
    if (sk === 'name') { va = (a.name || '').toLowerCase(); vb = (b.name || '').toLowerCase(); }
    else if (sk === 'date') { va = a._dateRaw || ''; vb = b._dateRaw || ''; }
    else if (sk === 'user') { va = (a._user || '').toLowerCase(); vb = (b._user || '').toLowerCase(); }
    else if (sk === 'count') { return (a._count - b._count) * sd; }
    return va < vb ? -sd : (va > vb ? sd : 0);
  });

  var arrow = function (key) { return _syncBasesSort.key === key ? (_syncBasesSort.dir === 'asc' ? ' ▲' : ' ▼') : ''; };
  var html = '<table class="sync-bases-table"><thead><tr>' +
    '<th class="sync-sortable" data-sort="name">Название' + arrow('name') + '</th>' +
    '<th class="sync-sortable" data-sort="date">Дата изменения' + arrow('date') + '</th>' +
    '<th class="sync-sortable" data-sort="user">Пользователь' + arrow('user') + '</th>' +
    '<th class="sync-sortable" data-sort="count">Записей' + arrow('count') + '</th>' +
    '<th>Действия</th></tr></thead><tbody>';

  filtered.forEach(function (obj) {
    var safeName = (obj.name || '').replace(/</g, '&lt;').replace(/"/g, '&quot;');
    var safeId = String(obj.id).replace(/'/g, "\\'");
    var safeSrcName = String(obj.name || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
    var isOwner = currentUser && obj._user && obj._user.toLowerCase() === currentUser.toLowerCase();
    var showDelete = isSyncUserElevated() && !isSyncMobileLimited();
    var loadClick =
      'showLoadBaseModal(' + JSON.stringify(obj.id) + ',' + JSON.stringify(obj.name || '') + ',' + JSON.stringify(obj._dateRaw || '') + ')';
    html += '<tr data-base-id="' + String(obj.id).replace(/"/g, '&quot;') + '">' +
      '<td data-label="Название">' + safeName + '</td>' +
      '<td data-label="Дата">' + obj._dateStr + '</td>' +
      '<td data-label="Пользователь">' + (obj._user || '—').replace(/</g, '&lt;') + '</td>' +
      '<td data-label="Записей">' + obj._count + '</td>' +
      '<td class="sync-bases-actions" data-label="Действия">' +
      '<button type="button" class="small-btn sync-base-import-btn" onclick=\'' + loadClick.replace(/'/g, '&#39;') + '\'>Загрузить</button>' +
      ' <button type="button" class="small-btn sync-hide-local-base-btn sync-base-import-btn" onclick="hideServerBaseLocalOnly(\'' + safeId + '\', \'' + safeSrcName + '\')">Скрыть у себя</button>' +
      (isOwner && !isSyncMobileLimited() ? ' <button type="button" class="small-btn sync-current-base-btn sync-base-import-btn" onclick="overwriteCurrentServerBaseWithLocal()">Выгрузить на сервер</button>' : '') +
      (showDelete ? ' <button type="button" class="small-btn sync-delete-base-btn sync-base-import-btn" onclick="showDeleteBaseModal(\'' + safeId + '\', \'' + safeSrcName + '\')">Удалить</button>' : '') +
      '</td></tr>';
  });

  var currentOnServer = _syncBasesData.some(function (o) { return o.id === currentId; });
  if (!isSyncMobileLimited() && !currentOnServer && currentId) {
    html += '<tr><td colspan="4">Текущая база не на сервере</td><td class="sync-bases-actions">' +
      '<button type="button" class="small-btn sync-current-base-btn sync-base-import-btn" onclick="uploadCurrentBaseToServer()">Выгрузить на сервер</button>' +
      '</td></tr>';
  }

  html += '</tbody></table>';
  if (filtered.length === 0 && _syncBasesData.length === 0 && !currentId) {
    container.innerHTML = '<p class="sync-empty">На сервере пока нет баз.</p>';
    return;
  }
  container.innerHTML = html;

  container.querySelectorAll('.sync-sortable').forEach(function (th) {
    th.style.cursor = 'pointer';
    th.addEventListener('click', function () {
      var key = th.getAttribute('data-sort');
      if (_syncBasesSort.key === key) {
        _syncBasesSort.dir = _syncBasesSort.dir === 'asc' ? 'desc' : 'asc';
      } else {
        _syncBasesSort.key = key;
        _syncBasesSort.dir = 'asc';
      }
      renderSyncBasesTable();
    });
  });
}

function renderSyncServerBasesList() {
  var container = document.getElementById('syncServerBasesList');
  if (!container || !window.CATTLE_TRACKER_USE_API || !window.CattleTrackerApi) return;
  container.innerHTML = '<p class="sync-loading">Загрузка списка…</p>';
  window.CattleTrackerApi.getObjectsList().then(function (list) {
    list = list || [];
    _syncBasesData = list.map(function (obj) {
      var dateRaw = obj.last_updated_at || obj.lastUpdatedAt || obj.created_at || '';
      var userRaw = obj.last_modified_by != null ? obj.last_modified_by : (obj.lastModifiedBy != null ? obj.lastModifiedBy : null);
      var creatorRaw = obj.created_by_username != null ? obj.created_by_username : (obj.createdByUsername != null ? obj.createdByUsername : null);
      var rawCount = obj.entries_count != null ? obj.entries_count : obj.entriesCount;
      obj._dateRaw = dateRaw;
      obj._dateStr = formatServerDate(dateRaw);
      obj._user = (userRaw !== null && userRaw !== '') ? String(userRaw) : '';
      obj._creator = (creatorRaw !== null && creatorRaw !== '') ? String(creatorRaw) : '';
      obj._count = (rawCount !== undefined && rawCount !== null && rawCount !== '') ? Number(rawCount) : 0;
      return obj;
    });
    renderSyncBasesFilters();
    renderSyncBasesTable();
  }).catch(function (err) {
    container.innerHTML = '<p class="sync-server-status-error">Ошибка загрузки списка: ' + (err && err.message ? err.message : '') + '</p>';
  });
}

/**
 * Показывает модалку выбора локальной базы для загрузки серверной базы.
 */
function showLoadBaseModal(sourceId, sourceName, sourceDateRaw) {
  if (!window.CATTLE_TRACKER_USE_API || !window.CattleTrackerApi) return;
  sourceDateRaw = sourceDateRaw != null ? String(sourceDateRaw) : '';
  var localObjects = typeof window.getObjectsList === 'function' ? (window.getObjectsList() || []) : [];

  var overlay = document.createElement('div');
  overlay.className = 'sync-replace-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-label', 'Загрузка базы');
  var optionsHtml = localObjects.map(function (o) {
    return '<option value="' + String(o.id).replace(/"/g, '&quot;') + '">' + (o.name || o.id).replace(/</g, '&lt;') + '</option>';
  }).join('');

  var mobileOnly = isSyncMobileLimited();
  overlay.innerHTML = '<div class="sync-replace-modal">' +
    '<h4>Загрузить базу «' + String(sourceName || '').replace(/</g, '&lt;') + '»</h4>' +
    (mobileOnly
      ? '<p>Открыть эту базу на устройстве? Записи загрузятся с сервера. Другие базы на устройстве останутся в памяти до синхронизации.</p>'
      : '<p>Выберите локальную базу для загрузки данных или создайте новую:</p>' +
        '<select id="syncLoadTargetSelect" class="sync-replace-select">' +
        '<option value="__new__">+ Создать новую базу</option>' +
        optionsHtml +
        '</select>') +
    (mobileOnly ? '' : '<div id="syncLoadNewNameWrap" style="margin-bottom:12px;">' +
    '<input type="text" id="syncLoadNewName" class="sync-replace-select" placeholder="Название новой базы" value="' + String(sourceName || '').replace(/"/g, '&quot;') + '" />' +
    '</div>') +
    '<div class="sync-replace-actions">' +
    '<button type="button" class="small-btn" data-action="cancel">Отмена</button> ' +
    '<button type="button" class="action-btn" data-action="load">Загрузить</button>' +
    '</div></div>';

  var select = overlay.querySelector('#syncLoadTargetSelect');
  var newNameWrap = overlay.querySelector('#syncLoadNewNameWrap');
  function toggleNewName() {
    if (newNameWrap) newNameWrap.style.display = !select || select.value === '__new__' ? '' : 'none';
  }
  if (select) {
    select.addEventListener('change', toggleNewName);
    toggleNewName();
  } else if (newNameWrap) {
    newNameWrap.style.display = '';
  }

  function close() { overlay.remove(); document.body.style.overflow = ''; }
  overlay.querySelector('[data-action="cancel"]').onclick = close;
  overlay.querySelector('[data-action="load"]').onclick = function () {
    if (mobileOnly) {
      close();
      openServerBaseOnMobile(sourceId, sourceName);
      return;
    }
    var targetVal = select.value;
    if (targetVal === '__new__') {
      var newName = (document.getElementById('syncLoadNewName') || {}).value;
      if (!newName || !String(newName).trim()) {
        if (typeof showToast === 'function') showToast('Введите название базы', 'error');
        return;
      }
      close();
      loadServerBaseIntoNewObject(sourceId, String(newName).trim());
    } else {
      confirmDownloadIfStale(sourceName, sourceDateRaw, targetVal).then(function (ok) {
        if (!ok) return;
        close();
        replaceServerBaseInObject(sourceId, targetVal, sourceName);
      });
    }
  };
  overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
  document.body.style.overflow = 'hidden';
  document.body.appendChild(overlay);
}

/**
 * Модалка удаления базы на сервере: запрос пароля пользователя-создателя.
 */
function showDeleteBaseModal(baseId, baseName) {
  if (!window.CATTLE_TRACKER_USE_API || !window.CattleTrackerApi) return;
  var overlay = document.createElement('div');
  overlay.className = 'sync-replace-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-label', 'Удаление базы');
  var safeName = String(baseName || '').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  overlay.innerHTML = '<div class="sync-replace-modal">' +
    '<h4>Удалить базу «' + safeName + '»?</h4>' +
    '<p>Удаление необратимо. Все записи в этой базе на сервере будут удалены.</p>' +
    '<p>Введите пароль вашей учётной записи для подтверждения:</p>' +
    '<input type="password" id="syncDeleteBasePassword" class="sync-replace-select" placeholder="Пароль" autocomplete="current-password" style="margin-bottom:12px;" />' +
    '<div class="sync-replace-actions">' +
    '<button type="button" class="small-btn" data-action="cancel">Отмена</button> ' +
    '<button type="button" class="action-btn" data-action="delete" style="background:var(--color-error, #c00);">Удалить</button>' +
    '</div></div>';

  function close() { overlay.remove(); document.body.style.overflow = ''; }
  overlay.querySelector('[data-action="cancel"]').onclick = close;
  overlay.querySelector('[data-action="delete"]').onclick = function () {
    var pwdEl = document.getElementById('syncDeleteBasePassword');
    var password = (pwdEl && pwdEl.value) ? String(pwdEl.value) : '';
    if (!password) {
      if (typeof showToast === 'function') showToast('Введите пароль', 'error');
      return;
    }
    overlay.querySelector('[data-action="delete"]').disabled = true;
    window.CattleTrackerApi.deleteObjectWithPassword(baseId, password).then(function () {
      close();
      if (typeof showToast === 'function') showToast('База удалена', 'success');
      renderSyncServerBasesList();
      if (typeof window.loadObjectsFromApi === 'function') window.loadObjectsFromApi();
    }).catch(function (err) {
      if (typeof showToast === 'function') showToast((err && err.message) ? err.message : 'Ошибка удаления', 'error');
      overlay.querySelector('[data-action="delete"]').disabled = false;
    });
  };
  overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
  document.body.style.overflow = 'hidden';
  document.body.appendChild(overlay);
  setTimeout(function () {
    var el = document.getElementById('syncDeleteBasePassword');
    if (el) el.focus();
  }, 100);
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
        renderSyncServerBasesList();
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
      renderSyncServerBasesList();
      return afterServerImportRefresh();
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
        renderSyncServerBasesList();
        return afterServerImportRefresh();
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
  backupCurrentLocalBaseBeforeSwitch('import-new-object');
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
      renderSyncServerBasesList();
      return afterServerImportRefresh();
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
      var targetMeta = (_syncBasesData || []).filter(function (o) { return o && o.id === targetId; })[0];
      var targetName = (targetMeta && (targetMeta.name || targetMeta.id)) ? String(targetMeta.name || targetMeta.id) : String(targetId);
      saveSnapshotBeforeServerOverwrite(targetId, targetName, targetEntries, 'replace-target-server');
      var deleteNext = function (idx) {
        if (idx >= targetEntries.length) {
          var addNext = function (i) {
            if (i >= sourceEntries.length) {
              function afterRename() {
                if (statusEl) statusEl.textContent = 'Готово: заменено записей ' + sourceEntries.length + '.';
                renderSyncServerBasesList();
                window.CattleTrackerApi.setCurrentObjectId(targetId);
                return afterServerImportRefresh({ forceFromServer: true });
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

window.renderSyncServerBasesList = renderSyncServerBasesList;
window.showLoadBaseModal = showLoadBaseModal;
window.showDeleteBaseModal = showDeleteBaseModal;
window.loadServerBaseIntoNewObject = loadServerBaseIntoNewObject;
window.showReplaceBaseModal = showReplaceBaseModal;
window.replaceServerBaseInObject = replaceServerBaseInObject;
window.uploadCurrentBaseToServer = uploadCurrentBaseToServer;
window.showImportNewObjectModal = showImportNewObjectModal;
window.hideServerBaseLocalOnly = hideServerBaseLocalOnly;
window.overwriteCurrentServerBaseWithLocal = overwriteCurrentServerBaseWithLocal;

export {};
