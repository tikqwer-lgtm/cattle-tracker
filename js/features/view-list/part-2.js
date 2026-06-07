/** __viewList part 2 */
(function () {
  'use strict';
  var root = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this);
  var NS = root['__viewList'] = root['__viewList'] || {};
  var global = typeof window !== 'undefined' ? window : this;

function refreshViewListVisible() {
  var container = document.getElementById('viewEntriesList');
  if (container && container._virtualData && container._virtualData.renderVisible) {
    container._virtualData.globalThis['__viewList'].renderVisible();
  }
}

function initViewFieldsSettings() {
  var btn = document.getElementById('viewFieldsSettingsBtn');
  var modal = document.getElementById('viewFieldsSettingsModal');
  var closeBtn = document.getElementById('viewFieldsCloseBtn');
  var saveBtn = document.getElementById('viewFieldsSaveBtn');
  var resetBtn = document.getElementById('viewFieldsResetBtn');
  if (!modal || !btn || btn.dataset.bound === '1') return;
  btn.dataset.bound = '1';
  btn.addEventListener('click', openViewFieldsSettings);
  if (closeBtn) closeBtn.addEventListener('click', closeViewFieldsSettings);
  if (resetBtn) resetBtn.addEventListener('click', function () {
    try { localStorage.removeItem(window.VIEW_LIST_FIELDS_KEY || 'cattleTracker_viewList_visibleFields'); } catch (e) {}
    renderViewFieldsSettings();
  });
  if (saveBtn) saveBtn.addEventListener('click', function () {
    var checked = Array.prototype.slice.call(modal.querySelectorAll('.view-fields-checkbox:checked'))
      .map(function (el) { return el.value; });
    if (checked.length === 0) {
      if (typeof showToast === 'function') showToast('Выберите хотя бы одно поле.', 'error'); else alert('Выберите хотя бы одно поле.');
      return;
    }
    try {
      localStorage.setItem(window.VIEW_LIST_FIELDS_KEY || 'cattleTracker_viewList_visibleFields', JSON.stringify(checked));
    } catch (e) {}
    closeViewFieldsSettings();
    globalThis['__viewList'].updateViewList();
  });
  modal.addEventListener('click', function (ev) {
    if (ev.target === modal) closeViewFieldsSettings();
    var applyBtn = ev.target.closest('.view-fields-template-apply');
    if (applyBtn && applyBtn.dataset.templateIndex !== undefined) {
      var idx = parseInt(applyBtn.dataset.templateIndex, 10);
      var templates = (typeof window.getFieldTemplates === 'function' ? window.getFieldTemplates() : []);
      if (templates[idx] && templates[idx].fieldKeys && templates[idx].fieldKeys.length > 0) {
        try {
          localStorage.setItem(window.VIEW_LIST_FIELDS_KEY || 'cattleTracker_viewList_visibleFields', JSON.stringify(templates[idx].fieldKeys));
        } catch (e) {}
        renderViewFieldsSettings();
        globalThis['__viewList'].updateViewList();
      }
      ev.preventDefault();
      return;
    }
    var deleteBtn = ev.target.closest('.view-fields-template-delete');
    if (deleteBtn && deleteBtn.dataset.templateIndex !== undefined) {
      var idxDel = parseInt(deleteBtn.dataset.templateIndex, 10);
      var list = (typeof window.getFieldTemplates === 'function' ? window.getFieldTemplates() : []);
      list.splice(idxDel, 1);
      if (typeof window.saveFieldTemplates === 'function') window.saveFieldTemplates(list);
      renderViewFieldsSettings();
      ev.preventDefault();
      return;
    }
  });

  var saveTemplateBtn = document.getElementById('viewFieldsSaveTemplateBtn');
  var templateNameInput = document.getElementById('viewFieldsTemplateNameInput');
  if (saveTemplateBtn && templateNameInput) {
    saveTemplateBtn.addEventListener('click', function () {
      var name = (templateNameInput.value || '').trim();
      if (!name) {
        if (typeof showToast === 'function') showToast('Введите название шаблона.', 'error'); else alert('Введите название шаблона.');
        return;
      }
      var checked = Array.prototype.slice.call(modal.querySelectorAll('.view-fields-checkbox:checked'))
        .map(function (el) { return el.value; });
      if (checked.length === 0) {
        if (typeof showToast === 'function') showToast('Выберите хотя бы одно поле.', 'error'); else alert('Выберите хотя бы одно поле.');
        return;
      }
      var list = (typeof window.getFieldTemplates === 'function' ? window.getFieldTemplates() : []);
      list.push({ name: name, fieldKeys: checked });
      if (typeof window.saveFieldTemplates === 'function') window.saveFieldTemplates(list);
      templateNameInput.value = '';
      renderViewFieldsSettings();
    });
  }
}

function renderViewFieldsSettings() {
  var modal = document.getElementById('viewFieldsSettingsModal');
  var listEl = document.getElementById('viewFieldsList');
  if (!modal || !listEl) return;
  var visible = (typeof window.getVisibleFieldKeys === 'function' ? window.getVisibleFieldKeys() : []);
  var fieldsList = window.VIEW_LIST_FIELDS || [];
  var html = fieldsList.map(function (field) {
    var checked = visible.indexOf(field.key) !== -1;
    return '<label class="view-fields-item">' +
      '<input type="checkbox" class="view-fields-checkbox" value="' + field.key + '"' + (checked ? ' checked' : '') + ' />' +
      '<span>' + field.label + '</span>' +
      '</label>';
  }).join('');
  listEl.innerHTML = html;

  var templatesListEl = document.getElementById('viewFieldsTemplatesList');
  if (templatesListEl) {
    var templates = (typeof window.getFieldTemplates === 'function' ? window.getFieldTemplates() : []);
    templatesListEl.innerHTML = templates.length === 0
      ? '<p class="view-fields-templates-empty">Нет сохранённых шаблонов</p>'
      : templates.map(function (t, idx) {
          var name = (t.name || '').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
          return '<div class="view-fields-template-item">' +
            '<span class="view-fields-template-name">' + name + '</span>' +
            ' <button type="button" class="small-btn view-fields-template-apply" data-template-index="' + idx + '" aria-label="Применить">Применить</button>' +
            ' <button type="button" class="small-btn view-fields-template-delete" data-template-index="' + idx + '" aria-label="Удалить">Удалить</button>' +
            '</div>';
        }).join('');
  }
}

function openViewFieldsSettings() {
  var modal = document.getElementById('viewFieldsSettingsModal');
  if (!modal) return;
  renderViewFieldsSettings();
  modal.classList.add('active');
  modal.setAttribute('aria-hidden', 'false');
  setTimeout(function () {
    var templateNameInput = document.getElementById('viewFieldsTemplateNameInput');
    if (templateNameInput) templateNameInput.focus(); else {
      var first = modal.querySelector('.view-fields-checkbox, .view-fields-template-apply, #viewFieldsCloseBtn');
      if (first) first.focus();
    }
  }, 0);
}

function closeViewFieldsSettings() {
  var modal = document.getElementById('viewFieldsSettingsModal');
  if (!modal) return;
  modal.classList.remove('active');
  modal.setAttribute('aria-hidden', 'true');
}

function initViewEditorModeButton() {
  var btn = document.getElementById('viewEditorModeBtn');
  if (!btn || btn.dataset.editorBound === '1') return;
  if (typeof window.isMobile === 'function' && window.isMobile()) {
    btn.style.display = 'none';
    btn.dataset.editorBound = '1';
    viewListEditorMode = false;
    if (typeof updateViewList === 'function') globalThis['__viewList'].updateViewList();
    return;
  }
  btn.dataset.editorBound = '1';
  btn.addEventListener('click', function () {
    viewListEditorMode = !viewListEditorMode;
    btn.textContent = viewListEditorMode ? '✎ Выкл. редактор' : '✎ Режим редактора';
    btn.classList.toggle('active', viewListEditorMode);
    globalThis['__viewList'].updateViewList();
  });
  btn.textContent = viewListEditorMode ? '✎ Выкл. редактор' : '✎ Режим редактора';
  btn.classList.toggle('active', viewListEditorMode);
}

function _getEntryRawValue(entry, fieldKey) {
  if (fieldKey === 'protocolName') return (entry.protocol && entry.protocol.name) || entry.protocolName || '';
  if (fieldKey === 'protocolStartDate') return (entry.protocol && entry.protocol.startDate) || entry.protocolStartDate || '';
  var v = entry[fieldKey];
  if (v === undefined || v === null) return '';
  return String(v).trim();
}

function _setEntryValue(entry, fieldKey, value) {
  if (fieldKey === 'protocolName') {
    entry.protocol = entry.protocol || {};
    entry.protocol.name = value;
    return;
  }
  if (fieldKey === 'protocolStartDate') {
    entry.protocol = entry.protocol || {};
    entry.protocol.startDate = value;
    return;
  }
  entry[fieldKey] = value;
}

function _setCellDisplay(td, entry, fieldKey) {
  var fields = getVisibleViewFields();
  var field = fields.filter(function (f) { return f.key === fieldKey; })[0];
  if (!field) return;
  var v = field.render(entry);
  var show = (fieldKey === 'lactation' && (v === 0 || v === '0')) ? '0' : v;
  td.textContent = show || '—';
  td.classList.add('editable-cell');
}

function startInlineEdit(td, cattleId, fieldKey) {
  var editableKeys = window.VIEW_LIST_EDITABLE_KEYS || {};
  if (!td || !cattleId || !fieldKey || !editableKeys[fieldKey]) return;
  var entriesList = window.entries && Array.isArray(window.entries) ? window.entries : [];
  var entry = entriesList.find(function (e) { return e.cattleId === cattleId; });
  if (!entry) return;
  var fieldType = editableKeys[fieldKey];
  var currentVal = _getEntryRawValue(entry, fieldKey);
  var input;
  if (fieldType === 'select' && fieldKey === 'status') {
    input = document.createElement('select');
    input.className = 'view-list-inline-select';
    (window.STATUS_OPTIONS || []).forEach(function (opt) {
      var o = document.createElement('option');
      o.value = opt;
      o.textContent = opt;
      if (opt === currentVal) o.selected = true;
      input.appendChild(o);
    });
  } else {
    input = document.createElement('input');
    input.className = 'view-list-inline-input';
    input.type = fieldType === 'date' ? 'date' : fieldType === 'number' ? 'number' : 'text';
    if (fieldKey === 'lactation') input.min = 0;
    if (fieldKey === 'attemptNumber') input.min = 1;
    input.value = currentVal;
  }
  td.innerHTML = '';
  td.appendChild(input);
  input.focus();
  var editCommitted = false;
  function finishEdit(save) {
    if (save) {
      var newVal = input.value.trim();
      if (fieldType === 'number') {
        var num = parseInt(newVal, 10);
        newVal = (newVal === '' || isNaN(num)) ? '' : num;
      }
      _setEntryValue(entry, fieldKey, newVal);
      if (typeof saveLocally === 'function') saveLocally();
    }
    _setCellDisplay(td, entry, fieldKey);
  }
  input.addEventListener('blur', function () {
    if (editCommitted) return;
    editCommitted = true;
    globalThis['__viewList'].finishEdit(true);
  });
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); editCommitted = true; globalThis['__viewList'].finishEdit(true); }
    if (e.key === 'Escape') { e.preventDefault(); editCommitted = true; globalThis['__viewList'].finishEdit(false); }
  });
  input.addEventListener('click', function (e) { e.stopPropagation(); });
}

function _assertBulkSelectionUI() {
  var bulk = document.getElementById('viewBulkActions');
  var selectAll = document.getElementById('selectAllCheckbox');
  var checkboxes = document.querySelectorAll('.entry-checkbox');
  var bar = document.querySelector('.bulk-actions-bar');
  if (!bulk || !bulk.innerHTML) {
    console.warn('[Просмотр описи] Панель выделения (viewBulkActions) пуста');
    return;
  }
  if (!bar) {
    console.warn('[Просмотр описи] Элемент .bulk-actions-bar не найден');
    return;
  }
  if (!selectAll && checkboxes.length > 0) {
    console.warn('[Просмотр описи] Чекбокс «Выделить все» не найден');
    return;
  }
  if (checkboxes.length === 0 && document.getElementById('viewEntriesList') && document.querySelector('.entries-table tbody')) {
    console.warn('[Просмотр описи] В таблице нет чекбоксов строк (.entry-checkbox)');
  }
}


  // register functions
  NS.refreshViewListVisible = refreshViewListVisible;
  NS.initViewFieldsSettings = initViewFieldsSettings;
  NS.renderViewFieldsSettings = renderViewFieldsSettings;
  NS.openViewFieldsSettings = openViewFieldsSettings;
  NS.closeViewFieldsSettings = closeViewFieldsSettings;
  NS.initViewEditorModeButton = initViewEditorModeButton;
  NS._getEntryRawValue = _getEntryRawValue;
  NS._setEntryValue = _setEntryValue;
  NS._setCellDisplay = _setCellDisplay;
  NS.startInlineEdit = startInlineEdit;
  NS._assertBulkSelectionUI = _assertBulkSelectionUI;
})();
export {};
