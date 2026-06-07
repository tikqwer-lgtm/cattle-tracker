/** __protocols part 1 */
(function () {
  'use strict';
  var root = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this);
  var NS = root['__protocols'] = root['__protocols'] || {};
  var global = typeof window !== 'undefined' ? window : this;

var _protocolsCache = [];
/** В режиме API: для какого object_id актуален _protocolsCache (иначе список протоколов «прилипал» к прошлой базе). */
var _protocolsFetchedForObjectId = null;

function useApi() {
  return typeof window !== 'undefined' && window.CATTLE_TRACKER_USE_API && window.CattleTrackerApi && typeof window.getCurrentObjectId === 'function';
}

function getProtocolsStorageKey() {
  var oid = typeof window.getCurrentObjectId === 'function' ? (window.getCurrentObjectId() || 'default') : 'default';
  if (typeof window !== 'undefined' && window.CattleTrackerObjectData) {
    return window.CattleTrackerObjectData.keyFor(window.CattleTrackerObjectData.PROTOCOLS_PREFIX, oid);
  }
  return 'cattleTracker_protocols_' + oid;
}

/**
 * Возвращает массив протоколов (из API-кэша или localStorage)
 * @returns {Array<{id: string, name: string, steps: Array<{day: number, drug: string}>}>}
 */
function getProtocolsFromLocalStorage() {
  if (typeof window !== 'undefined' && window.CattleTrackerObjectData) {
    window.CattleTrackerObjectData.migrateGlobalToDefaultOnce();
    return window.CattleTrackerObjectData.loadProtocolsLocal(
      typeof window.getCurrentObjectId === 'function' ? window.getCurrentObjectId() : 'default'
    );
  }
  try {
    var raw = localStorage.getItem(getProtocolsStorageKey());
    if (!raw) return [];
    var arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    return [];
  }
}

function getProtocols() {
  if (useApi()) {
    var cur = window.getCurrentObjectId();
    if (_protocolsFetchedForObjectId !== cur) {
      return [];
    }
    if (_protocolsCache && _protocolsCache.length) return _protocolsCache.slice();
    return [];
  }
  return getProtocolsFromLocalStorage();
}

function invalidateProtocolsForObjectSwitch() {
  _protocolsFetchedForObjectId = null;
  _protocolsCache = [];
}

/**
 * В режиме API загружает протоколы с сервера в кэш, затем вызывает callback.
 * В локальном режиме сразу вызывает callback. Используется при открытии экрана «Поставить на протокол».
 * @param {function()} callback
 */
/**
 * Дублирует кэш протоколов в localStorage (режим API), чтобы «Код осеменения»
 * и офлайн-запас имели данные без ручного «Сохранить» в списке протоколов.
 */
function persistProtocolsCacheToLocalStorage() {
  if (!useApi()) return;
  try {
    var oid = window.getCurrentObjectId();
    if (window.CattleTrackerObjectData) {
      window.CattleTrackerObjectData.saveProtocolsLocal(oid, Array.isArray(_protocolsCache) ? _protocolsCache : []);
    } else {
      localStorage.setItem(getProtocolsStorageKey(), JSON.stringify(Array.isArray(_protocolsCache) ? _protocolsCache : []));
    }
  } catch (e) {}
}

function ensureProtocolsLoaded(callback) {
  if (!callback || typeof callback !== 'function') return;
  if (!useApi()) {
    notifyInseminationCodeSelects();
    callback();
    return;
  }
  var objectId = window.getCurrentObjectId();
  if (_protocolsFetchedForObjectId !== objectId) {
    _protocolsCache = [];
    _protocolsFetchedForObjectId = null;
  }
  window.CattleTrackerApi.getProtocols(objectId).then(function (list) {
    if (window.getCurrentObjectId() !== objectId) {
      notifyInseminationCodeSelects();
      callback();
      return;
    }
    _protocolsCache = (list || []).slice();
    _protocolsFetchedForObjectId = objectId;
    persistProtocolsCacheToLocalStorage();
    notifyInseminationCodeSelects();
    callback();
  }).catch(function () {
    if (window.getCurrentObjectId() === objectId) {
      _protocolsCache = [];
      _protocolsFetchedForObjectId = objectId;
    }
    notifyInseminationCodeSelects();
    callback();
  });
}

/**
 * Сохраняет массив протоколов в localStorage
 * @param {Array} arr
 */
function saveProtocols(arr) {
  var list = Array.isArray(arr) ? arr : [];
  var oid = typeof window.getCurrentObjectId === 'function' ? window.getCurrentObjectId() : 'default';
  if (window.CattleTrackerObjectData) {
    window.CattleTrackerObjectData.saveProtocolsLocal(oid, list);
  } else {
    localStorage.setItem(getProtocolsStorageKey(), JSON.stringify(list));
  }
  notifyInseminationCodeSelects();
}

var _notifyInsemCodeRaf = null;
/** Обновить списки «Код осеменения» после изменения протоколов (локально и через API). */
function notifyInseminationCodeSelects() {
  if (typeof window === 'undefined' || typeof window.fillAllInseminationCodeSelects !== 'function') return;
  /* Один проход на кадр вместо debounce 200ms — иначе при частых loadLocally/ensureProtocolsLoaded обновление «плывёт» и в WebView страдает фокус. */
  if (_notifyInsemCodeRaf != null) return;
  _notifyInsemCodeRaf = requestAnimationFrame(function () {
    _notifyInsemCodeRaf = null;
    try {
      window.globalThis['__protocols'].fillAllInseminationCodeSelects();
    } catch (e) {}
  });
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
 * @returns {Object|Promise<Object>} добавленный протокол с id
 */
function addProtocol(protocol) {
  var steps = Array.isArray(protocol && protocol.steps) ? protocol.steps.map(function (s) {
    return { day: parseInt(s.day, 10) || 0, drug: String(s.drug || '').trim() };
  }) : [];
  var name = (protocol && protocol.name) ? String(protocol.name).trim() : '';
  if (useApi()) {
    var objectId = window.getCurrentObjectId();
    var item = { id: nextProtocolId(), name: name, steps: steps };
    return window.CattleTrackerApi.createProtocol(objectId, item).then(function (created) {
      _protocolsCache.push(created);
      persistProtocolsCacheToLocalStorage();
      notifyInseminationCodeSelects();
      return created;
    });
  }
  var list = getProtocols();
  var item = {
    id: nextProtocolId(),
    name: name,
    steps: steps
  };
  list.push(item);
  saveProtocols(list);
  return item;
}

/**
 * Обновляет протокол по id
 * @param {string} id
 * @param {Object} protocol - { name, steps }
 * @returns {Object|Promise<Object>|undefined}
 */
function updateProtocol(id, protocol) {
  var name = (protocol && protocol.name) ? String(protocol.name).trim() : null;
  var steps = Array.isArray(protocol && protocol.steps) ? protocol.steps.map(function (s) {
    return { day: parseInt(s.day, 10) || 0, drug: String(s.drug || '').trim() };
  }) : null;
  if (useApi()) {
    var objectId = window.getCurrentObjectId();
    return window.CattleTrackerApi.updateProtocol(objectId, id, { name: name, steps: steps }).then(function (updated) {
      for (var i = 0; i < _protocolsCache.length; i++) {
        if (_protocolsCache[i].id === id) {
          _protocolsCache[i] = updated;
          break;
        }
      }
      persistProtocolsCacheToLocalStorage();
      notifyInseminationCodeSelects();
      return updated;
    });
  }
  var list = getProtocols();
  for (var i = 0; i < list.length; i++) {
    if (list[i].id === id) {
      if (name != null) list[i].name = name;
      if (steps != null) list[i].steps = steps;
      saveProtocols(list);
      return list[i];
    }
  }
}

/**
 * Удаляет протокол по id
 * @param {string} id
 * @returns {void|Promise<void>}
 */
function deleteProtocol(id) {
  if (useApi()) {
    var objectId = window.getCurrentObjectId();
    return window.CattleTrackerApi.deleteProtocol(objectId, id).then(function () {
      _protocolsCache = _protocolsCache.filter(function (p) { return p.id !== id; });
      persistProtocolsCacheToLocalStorage();
      notifyInseminationCodeSelects();
    });
  }
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

  if (useApi()) {
    var oid = window.getCurrentObjectId();
    window.CattleTrackerApi.getProtocols(oid).then(function (list) {
      if (window.getCurrentObjectId() !== oid) return;
      _protocolsCache = (list || []).slice();
      _protocolsFetchedForObjectId = oid;
      persistProtocolsCacheToLocalStorage();
      notifyInseminationCodeSelects();
      renderProtocolsScreenInner(containerId);
    }).catch(function () {
      if (window.getCurrentObjectId() === oid) {
        _protocolsCache = [];
        _protocolsFetchedForObjectId = oid;
      }
      notifyInseminationCodeSelects();
      renderProtocolsScreenInner(containerId);
    });
    return;
  }
  renderProtocolsScreenInner(containerId);
}

function renderProtocolsScreenInner(containerId) {
  var container = document.getElementById(containerId);
  if (!container) return;
  var pend = window.CattleTrackerApi && window.CattleTrackerApi.PENDING_OBJECT_ID;
  if (window.CATTLE_TRACKER_USE_API && pend && typeof getCurrentObjectId === 'function' && getCurrentObjectId() === pend) {
    container.innerHTML = '<p class="admin-message">Сначала выберите базу на экране «Синхронизация» (список баз → «Загрузить»).</p>';
    return;
  }
  if (typeof window !== 'undefined' && typeof window.refreshFarmDatalists === 'function') {
    try { window.refreshFarmDatalists(); } catch (e) {}
  }

  var userViewer = typeof getCurrentUser === 'function' && getCurrentUser() && getCurrentUser().role === 'viewer';

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

  if (userViewer) {
    container.querySelectorAll('.edit-protocol-btn, .delete-protocol-btn').forEach(function (el) {
      el.style.display = 'none';
    });
    var pb = document.getElementById('protocols-add-btn');
    if (pb) pb.style.display = 'none';
    var fs = container.querySelector('.protocols-form-section');
    if (fs) fs.style.display = 'none';
    return;
  }

  globalThis['__protocols'].renderProtocolStepsList(editing ? editing.steps : []);

  document.getElementById('protocols-add-btn').onclick = function () {
    window._protocolsEditingId = null;
    if (typeof window.navigate === 'function') window.navigate('protocols');
    if (typeof window.renderProtocolsScreen === 'function') window.renderProtocolsScreen(containerId);
  };

  container.querySelectorAll('.edit-protocol-btn').forEach(function (btn) {
    btn.onclick = function () {
      window._protocolsEditingId = btn.getAttribute('data-id');
      if (typeof window.navigate === 'function') window.navigate('protocols');
      if (typeof window.renderProtocolsScreen === 'function') window.renderProtocolsScreen(containerId);
    };
  });

  container.querySelectorAll('.delete-protocol-btn').forEach(function (btn) {
    btn.onclick = function () {
      var id = btn.getAttribute('data-id');
      if (!id) return;
      var doDelete = function () {
        var p = deleteProtocol(id);
        window._protocolsEditingId = null;
        if (p && typeof p.then === 'function') {
          p.then(function () {
            if (typeof window.renderProtocolsScreen === 'function') window.renderProtocolsScreen(containerId);
          });
        } else {
          if (typeof window.renderProtocolsScreen === 'function') window.renderProtocolsScreen(containerId);
        }
      };
      if (typeof showConfirmModal === 'function') {
        showConfirmModal('Удалить этот протокол?').then(function (ok) {
          if (!ok) return;
          doDelete();
        });
        return;
      }
      if (!confirm('Удалить этот протокол?')) return;
      doDelete();
    };
  });

  document.getElementById('protocol-add-step-btn').onclick = function () {
    var steps = globalThis['__protocols'].getCurrentStepsFromForm();
    steps.push({ day: 0, drug: '' });
    globalThis['__protocols'].renderProtocolStepsList(steps);
  };

  document.getElementById('protocol-cancel-btn').onclick = function () {
    window._protocolsEditingId = null;
    if (typeof window.navigate === 'function') window.navigate('protocols');
    if (typeof window.renderProtocolsScreen === 'function') window.renderProtocolsScreen(containerId);
  };

  document.getElementById('protocol-form').onsubmit = function (e) {
    e.preventDefault();
    var name = document.getElementById('protocol-name-input').value.trim();
    var steps = globalThis['__protocols'].getCurrentStepsFromForm();
    if (!name) {
      if (typeof showToast === 'function') showToast('Введите название протокола', 'error');
      return;
    }
    var done = function () {
      window._protocolsEditingId = null;
      notifyInseminationCodeSelects();
      if (typeof window.renderProtocolsScreen === 'function') window.renderProtocolsScreen(containerId);
    };
    if (editingId) {
      var up = updateProtocol(editingId, { name: name, steps: steps });
      if (up && typeof up.then === 'function') {
        up.then(function () {
          if (typeof showToast === 'function') showToast('Протокол сохранён', 'success');
          done();
        });
      } else {
        if (typeof showToast === 'function') showToast('Протокол сохранён', 'success');
        done();
      }
    } else {
      var add = addProtocol({ name: name, steps: steps });
      if (add && typeof add.then === 'function') {
        add.then(function () {
          if (typeof showToast === 'function') showToast('Протокол добавлен', 'success');
          done();
        });
      } else {
        if (typeof showToast === 'function') showToast('Протокол добавлен', 'success');
        done();
      }
    }
  };
}


  // register functions
  NS.useApi = useApi;
  NS.getProtocolsStorageKey = getProtocolsStorageKey;
  NS.getProtocolsFromLocalStorage = getProtocolsFromLocalStorage;
  NS.getProtocols = getProtocols;
  NS.invalidateProtocolsForObjectSwitch = invalidateProtocolsForObjectSwitch;
  NS.persistProtocolsCacheToLocalStorage = persistProtocolsCacheToLocalStorage;
  NS.ensureProtocolsLoaded = ensureProtocolsLoaded;
  NS.saveProtocols = saveProtocols;
  NS.notifyInseminationCodeSelects = notifyInseminationCodeSelects;
  NS.nextProtocolId = nextProtocolId;
  NS.getProtocolById = getProtocolById;
  NS.addProtocol = addProtocol;
  NS.updateProtocol = updateProtocol;
  NS.deleteProtocol = deleteProtocol;
  NS.renderProtocolsScreen = renderProtocolsScreen;
  NS.renderProtocolsScreenInner = renderProtocolsScreenInner;
})();
export {};
