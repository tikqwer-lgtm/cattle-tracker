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

function getCurrentUsername() {
  if (typeof window.getCurrentUser === 'function') {
    var u = window.getCurrentUser();
    return u && u.username ? String(u.username) : '';
  }
  return '';
}

function renderSyncBasesFilters() {
  var filterEl = document.getElementById('syncBasesFilter');
  if (!filterEl) return;
  filterEl.innerHTML =
    '<div class="sync-bases-filter-row">' +
    '<input type="text" id="syncFilterName" class="sync-filter-input" placeholder="Фильтр по названию" value="' + (_syncBasesFilterName || '').replace(/"/g, '&quot;') + '" />' +
    '<input type="text" id="syncFilterUser" class="sync-filter-input" placeholder="Фильтр по пользователю" value="' + (_syncBasesFilterUser || '').replace(/"/g, '&quot;') + '" />' +
    '</div>';
  var nameInp = document.getElementById('syncFilterName');
  var userInp = document.getElementById('syncFilterUser');
  function onFilter() {
    _syncBasesFilterName = (nameInp ? nameInp.value : '').trim().toLowerCase();
    _syncBasesFilterUser = (userInp ? userInp.value : '').trim().toLowerCase();
    renderSyncBasesTable();
  }
  if (nameInp) nameInp.addEventListener('input', onFilter);
  if (userInp) userInp.addEventListener('input', onFilter);
}

function renderSyncBasesTable() {
  var container = document.getElementById('syncServerBasesList');
  if (!container) return;
  var currentId = typeof getCurrentObjectId === 'function' ? getCurrentObjectId() : '';
  var currentUser = getCurrentUsername();
  var filtered = _syncBasesData.filter(function (obj) {
    var n = (obj.name || '').toLowerCase();
    var u = (obj._user || '').toLowerCase();
    if (_syncBasesFilterName && n.indexOf(_syncBasesFilterName) === -1) return false;
    if (_syncBasesFilterUser && u.indexOf(_syncBasesFilterUser) === -1) return false;
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
    var isCreator = currentUser && obj._creator && obj._creator.toLowerCase() === currentUser.toLowerCase();
    html += '<tr data-base-id="' + String(obj.id).replace(/"/g, '&quot;') + '">' +
      '<td data-label="Название">' + safeName + '</td>' +
      '<td data-label="Дата">' + obj._dateStr + '</td>' +
      '<td data-label="Пользователь">' + (obj._user || '—').replace(/</g, '&lt;') + '</td>' +
      '<td data-label="Записей">' + obj._count + '</td>' +
      '<td class="sync-bases-actions" data-label="Действия">' +
      '<button type="button" class="small-btn" onclick="showLoadBaseModal(\'' + safeId + '\', \'' + safeSrcName + '\')">Загрузить</button>' +
      (isOwner ? ' <button type="button" class="small-btn sync-current-base-btn" onclick="syncCurrentBaseToServer()">Синхронизировать</button>' : '') +
      (isCreator ? ' <button type="button" class="small-btn sync-delete-base-btn" onclick="showDeleteBaseModal(\'' + safeId + '\', \'' + safeSrcName + '\')">Удалить</button>' : '') +
      '</td></tr>';
  });

  var currentOnServer = _syncBasesData.some(function (o) { return o.id === currentId; });
  if (!currentOnServer && currentId) {
    html += '<tr><td colspan="4">Текущая база не на сервере</td><td class="sync-bases-actions">' +
      '<button type="button" class="small-btn sync-current-base-btn" onclick="uploadCurrentBaseToServer()">Синхронизировать</button>' +
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
function showLoadBaseModal(sourceId, sourceName) {
  if (!window.CATTLE_TRACKER_USE_API || !window.CattleTrackerApi) return;
  var localObjects = typeof window.getObjectsList === 'function' ? (window.getObjectsList() || []) : [];

  var overlay = document.createElement('div');
  overlay.className = 'sync-replace-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-label', 'Загрузка базы');
  var optionsHtml = localObjects.map(function (o) {
    return '<option value="' + String(o.id).replace(/"/g, '&quot;') + '">' + (o.name || o.id).replace(/</g, '&lt;') + '</option>';
  }).join('');

  overlay.innerHTML = '<div class="sync-replace-modal">' +
    '<h4>Загрузить базу «' + String(sourceName || '').replace(/</g, '&lt;') + '»</h4>' +
    '<p>Выберите локальную базу для загрузки данных или создайте новую:</p>' +
    '<select id="syncLoadTargetSelect" class="sync-replace-select">' +
    '<option value="__new__">+ Создать новую базу</option>' +
    optionsHtml +
    '</select>' +
    '<div id="syncLoadNewNameWrap" style="margin-bottom:12px;">' +
    '<input type="text" id="syncLoadNewName" class="sync-replace-select" placeholder="Название новой базы" value="' + String(sourceName || '').replace(/"/g, '&quot;') + '" />' +
    '</div>' +
    '<div class="sync-replace-actions">' +
    '<button type="button" class="small-btn" data-action="cancel">Отмена</button> ' +
    '<button type="button" class="action-btn" data-action="load">Загрузить</button>' +
    '</div></div>';

  var select = overlay.querySelector('#syncLoadTargetSelect');
  var newNameWrap = overlay.querySelector('#syncLoadNewNameWrap');
  function toggleNewName() {
    if (newNameWrap) newNameWrap.style.display = select.value === '__new__' ? '' : 'none';
  }
  select.addEventListener('change', toggleNewName);
  toggleNewName();

  function close() { overlay.remove(); document.body.style.overflow = ''; }
  overlay.querySelector('[data-action="cancel"]').onclick = close;
  overlay.querySelector('[data-action="load"]').onclick = function () {
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
      close();
      replaceServerBaseInObject(sourceId, targetVal);
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
    '<p>Введите ваш пароль (пользователь, создавший базу):</p>' +
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

window.renderSyncServerBasesList = renderSyncServerBasesList;
window.showLoadBaseModal = showLoadBaseModal;
window.showDeleteBaseModal = showDeleteBaseModal;
window.loadServerBaseIntoNewObject = loadServerBaseIntoNewObject;
window.showReplaceBaseModal = showReplaceBaseModal;
window.replaceServerBaseInObject = replaceServerBaseInObject;
window.uploadCurrentBaseToServer = uploadCurrentBaseToServer;
window.showImportNewObjectModal = showImportNewObjectModal;

export {};
