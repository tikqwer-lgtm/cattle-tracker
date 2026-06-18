/** __syncBases part 2 */
(function () {
  'use strict';
  var root = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this);
  var NS = root['__syncBases'] = root['__syncBases'] || {};
  var global = typeof window !== 'undefined' ? window : this;

function sbState() {
  var st = root['__syncBases']._syncState;
  if (!st) {
    st = root['__syncBases']._syncState = { data: [], sort: { key: 'name', dir: 'asc' }, filterName: '', filterUser: '' };
  }
  return st;
}

function getBasesListContainer() {
  return document.getElementById('adminServerBasesList') || document.getElementById('syncServerBasesList');
}

function getBasesFilterEl() {
  return document.getElementById('adminBasesFilter') || document.getElementById('syncBasesFilter');
}

function renderSyncBasesFilters() {
  var filterEl = getBasesFilterEl();
  if (!filterEl) return;
  filterEl.innerHTML =
    '<div class="sync-bases-filter-row">' +
    '<input type="text" id="syncFilterName" class="sync-filter-input" placeholder="Фильтр по названию" value="' + (sbState().filterName || '').replace(/"/g, '&quot;') + '" />' +
    '</div>';
  var nameInp = document.getElementById('syncFilterName');
  function onFilter() {
    sbState().filterName = (nameInp ? nameInp.value : '').trim().toLowerCase();
    renderSyncBasesTable();
  }
  if (nameInp) nameInp.addEventListener('input', onFilter);
}

function buildBaseRowHtml(obj, currentUser, currentId) {
  var safeName = (obj.name || '').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  var safeId = String(obj.id).replace(/'/g, "\\'");
  var safeSrcName = String(obj.name || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
  var isOwner = currentUser && obj._creator && obj._creator.toLowerCase() === currentUser.toLowerCase();
  var showDelete = globalThis['__syncBases'].isSyncUserElevated();
  var loadClick =
    'showLoadBaseModal(' + JSON.stringify(obj.id) + ',' + JSON.stringify(obj.name || '') + ',' + JSON.stringify(obj._dateRaw || '') + ')';
  return '<tr data-base-id="' + String(obj.id).replace(/"/g, '&quot;') + '">' +
    '<td data-label="Название">' + safeName + '</td>' +
    '<td data-label="Дата">' + obj._dateStr + '</td>' +
    '<td data-label="Записей">' + obj._count + '</td>' +
    '<td class="sync-bases-actions" data-label="Действия">' +
    '<button type="button" class="small-btn sync-base-import-btn" onclick=\'' + loadClick.replace(/'/g, '&#39;') + '\'>Загрузить</button>' +
    ' <button type="button" class="small-btn sync-hide-local-base-btn sync-base-import-btn" onclick="hideServerBaseLocalOnly(\'' + safeId + '\', \'' + safeSrcName + '\')">Скрыть у себя</button>' +
    (isOwner && !globalThis['__syncBases'].isSyncMobileLimited() ? ' <button type="button" class="small-btn sync-current-base-btn sync-base-import-btn" onclick="overwriteCurrentServerBaseWithLocal()">Выгрузить на сервер</button>' : '') +
    (showDelete ? ' <button type="button" class="small-btn sync-delete-base-btn sync-base-import-btn" onclick="showDeleteBaseModal(\'' + safeId + '\', \'' + safeSrcName + '\')">Удалить</button>' : '') +
    '</td></tr>';
}

function renderSyncBasesTable() {
  var container = getBasesListContainer();
  if (!container) return;
  var currentId = typeof getCurrentObjectId === 'function' ? getCurrentObjectId() : '';
  var currentUser = globalThis['__syncBases'].getCurrentUsername();
  var filtered = sbState().data.filter(function (obj) {
    var n = (obj.name || '').toLowerCase();
    if (sbState().filterName && n.indexOf(sbState().filterName) === -1) return false;
    return true;
  });
  var sk = sbState().sort.key;
  var sd = sbState().sort.dir === 'asc' ? 1 : -1;
  filtered.sort(function (a, b) {
    var va = '', vb = '';
    if (sk === 'name') { va = (a.name || '').toLowerCase(); vb = (b.name || '').toLowerCase(); }
    else if (sk === 'date') { va = a._dateRaw || ''; vb = b._dateRaw || ''; }
    else if (sk === 'user') { va = (a._creator || '').toLowerCase(); vb = (b._creator || '').toLowerCase(); }
    else if (sk === 'count') { return (a._count - b._count) * sd; }
    return va < vb ? -sd : (va > vb ? sd : 0);
  });

  var groups = {};
  filtered.forEach(function (obj) {
    var key = (obj._creator || '').trim() || '—';
    if (!groups[key]) groups[key] = [];
    groups[key].push(obj);
  });
  var groupKeys = Object.keys(groups).sort(function (a, b) { return a.localeCompare(b, 'ru'); });

  var arrow = function (key) { return sbState().sort.key === key ? (sbState().sort.dir === 'asc' ? ' ▲' : ' ▼') : ''; };
  var tableHead = '<table class="sync-bases-table"><thead><tr>' +
    '<th class="sync-sortable" data-sort="name">Название' + arrow('name') + '</th>' +
    '<th class="sync-sortable" data-sort="date">Дата изменения' + arrow('date') + '</th>' +
    '<th class="sync-sortable" data-sort="count">Записей' + arrow('count') + '</th>' +
    '<th>Действия</th></tr></thead><tbody>';

  var html = '';
  groupKeys.forEach(function (key) {
    var items = groups[key];
    var safeKey = key.replace(/</g, '&lt;').replace(/"/g, '&quot;');
    var label = key === '—' ? 'Без владельца' : safeKey;
    html += '<details class="admin-bases-user-group" open>' +
      '<summary class="admin-bases-user-summary">' + label + ' (' + items.length + ')</summary>' +
      tableHead;
    items.forEach(function (obj) {
      html += buildBaseRowHtml(obj, currentUser, currentId);
    });
    html += '</tbody></table></details>';
  });

  var currentOnServer = sbState().data.some(function (o) { return o.id === currentId; });
  if (!globalThis['__syncBases'].isSyncMobileLimited() && !currentOnServer && currentId && groupKeys.length) {
    html += '<p class="sync-admin-current-base-hint">Текущая локальная база не найдена на сервере. ' +
      '<button type="button" class="small-btn sync-current-base-btn sync-base-import-btn" onclick="uploadCurrentBaseToServer()">Выгрузить на сервер</button></p>';
  }

  if (filtered.length === 0 && sbState().data.length === 0) {
    container.innerHTML = '<p class="sync-empty">На сервере пока нет баз.</p>';
    return;
  }
  if (filtered.length === 0) {
    container.innerHTML = '<p class="sync-empty">Нет баз по фильтру.</p>';
    return;
  }
  container.innerHTML = html;

  container.querySelectorAll('.sync-sortable').forEach(function (th) {
    th.style.cursor = 'pointer';
    th.addEventListener('click', function () {
      var key = th.getAttribute('data-sort');
      if (sbState().sort.key === key) {
        sbState().sort.dir = sbState().sort.dir === 'asc' ? 'desc' : 'asc';
      } else {
        sbState().sort.key = key;
        sbState().sort.dir = 'asc';
      }
      renderSyncBasesTable();
    });
  });
}

function renderSyncServerBasesList() {
  var container = getBasesListContainer();
  if (!container || !window.CATTLE_TRACKER_USE_API || !window.CattleTrackerApi) return;
  container.innerHTML = '<p class="sync-loading">Загрузка списка…</p>';
  window.CattleTrackerApi.getObjectsList().then(function (list) {
    list = list || [];
    sbState().data = list.map(function (obj) {
      var dateRaw = obj.last_updated_at || obj.lastUpdatedAt || obj.created_at || '';
      var creatorRaw = obj.created_by_username != null ? obj.created_by_username : (obj.createdByUsername != null ? obj.createdByUsername : null);
      var rawCount = obj.entries_count != null ? obj.entries_count : obj.entriesCount;
      obj._dateRaw = dateRaw;
      obj._dateStr = globalThis['__syncBases'].formatServerDate(dateRaw);
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

  var mobileOnly = globalThis['__syncBases'].isSyncMobileLimited();
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
    globalThis['__syncBases'].toggleNewName();
  } else if (newNameWrap) {
    newNameWrap.style.display = '';
  }

  function close() { overlay.remove(); document.body.style.overflow = ''; }
  overlay.querySelector('[data-action="cancel"]').onclick = close;
  overlay.querySelector('[data-action="load"]').onclick = function () {
    if (mobileOnly) {
      globalThis['__syncBases'].globalThis['__syncBases'].globalThis['__syncBases'].close();
      globalThis['__syncBases'].openServerBaseOnMobile(sourceId, sourceName);
      return;
    }
    var targetVal = select.value;
    if (targetVal === '__new__') {
      var newName = (document.getElementById('syncLoadNewName') || {}).value;
      if (!newName || !String(newName).trim()) {
        if (typeof showToast === 'function') showToast('Введите название базы', 'error');
        return;
      }
      globalThis['__syncBases'].globalThis['__syncBases'].globalThis['__syncBases'].close();
      globalThis['__syncBases'].loadServerBaseIntoNewObject(sourceId, String(newName).trim());
    } else {
      globalThis['__syncBases'].confirmDownloadIfStale(sourceName, sourceDateRaw, targetVal).then(function (ok) {
        if (!ok) return;
        globalThis['__syncBases'].globalThis['__syncBases'].globalThis['__syncBases'].close();
        globalThis['__syncBases'].replaceServerBaseInObject(sourceId, targetVal, sourceName);
      });
    }
  };
  overlay.addEventListener('click', function (e) { if (e.target === overlay) globalThis['__syncBases'].globalThis['__syncBases'].globalThis['__syncBases'].close(); });
  document.body.style.overflow = 'hidden';
  document.body.appendChild(overlay);
}

/**
 * Модалка удаления базы на сервере: пароль учётной записи администратора.
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
      globalThis['__syncBases'].globalThis['__syncBases'].globalThis['__syncBases'].close();
      if (typeof showToast === 'function') showToast('База удалена', 'success');
      renderSyncServerBasesList();
      if (typeof window.loadObjectsFromApi === 'function') window.loadObjectsFromApi();
    }).catch(function (err) {
      if (typeof showToast === 'function') showToast((err && err.message) ? err.message : 'Ошибка удаления', 'error');
      overlay.querySelector('[data-action="delete"]').disabled = false;
    });
  };
  overlay.addEventListener('click', function (e) { if (e.target === overlay) globalThis['__syncBases'].globalThis['__syncBases'].globalThis['__syncBases'].close(); });
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

  // register functions
  NS.renderSyncBasesFilters = renderSyncBasesFilters;
  NS.renderSyncBasesTable = renderSyncBasesTable;
  NS.renderSyncServerBasesList = renderSyncServerBasesList;
  NS.showLoadBaseModal = showLoadBaseModal;
  NS.showDeleteBaseModal = showDeleteBaseModal;
})();
export {};
