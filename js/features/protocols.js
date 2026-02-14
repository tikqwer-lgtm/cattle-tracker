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
export {};
