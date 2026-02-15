// protocols.js — справочник протоколов синхронизации (схемы гормональной терапии)

var PROTOCOLS_STORAGE_KEY = 'cattleTracker_protocols';
var _protocolsCache = [];

function useApi() {
  return typeof window !== 'undefined' && window.CATTLE_TRACKER_USE_API && window.CattleTrackerApi && typeof window.getCurrentObjectId === 'function';
}

/**
 * Возвращает массив протоколов (из API-кэша или localStorage)
 * @returns {Array<{id: string, name: string, steps: Array<{day: number, drug: string}>}>}
 */
function getProtocols() {
  if (useApi()) return _protocolsCache;
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
    window.CattleTrackerApi.getProtocols(window.getCurrentObjectId()).then(function (list) {
      _protocolsCache = (list || []).slice();
      renderProtocolsScreenInner(containerId);
    }).catch(function () {
      _protocolsCache = [];
      renderProtocolsScreenInner(containerId);
    });
    return;
  }
  renderProtocolsScreenInner(containerId);
}

function renderProtocolsScreenInner(containerId) {
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
    var steps = getCurrentStepsFromForm();
    steps.push({ day: 0, drug: '' });
    renderProtocolStepsList(steps);
  };

  document.getElementById('protocol-cancel-btn').onclick = function () {
    window._protocolsEditingId = null;
    if (typeof window.navigate === 'function') window.navigate('protocols');
    if (typeof window.renderProtocolsScreen === 'function') window.renderProtocolsScreen(containerId);
  };

  document.getElementById('protocol-form').onsubmit = function (e) {
    e.preventDefault();
    var name = document.getElementById('protocol-name-input').value.trim();
    var steps = getCurrentStepsFromForm();
    if (!name) {
      if (typeof showToast === 'function') showToast('Введите название протокола', 'error');
      return;
    }
    var done = function () {
      window._protocolsEditingId = null;
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
if (typeof window !== 'undefined') {
  window.renderProtocolsScreen = renderProtocolsScreen;
}
export {};
