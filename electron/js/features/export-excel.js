// export-excel.js — экспорт в Excel/CSV, шаблон для импорта, диалог настройки экспорта

/** Порядок колонок CSV (для шаблона и экспорта). Разделитель — точка с запятой. */
var CSV_HEADERS = [
  'Номер', 'Кличка', 'Группа', 'Дата рождения', 'Лактация', 'Дата отёла', 'Дата осеменения',
  'Номер попытки', 'Бык', 'Техник ИО', 'Код', 'Статус', 'Протокол', 'Начало протокола',
  'Дата выбытия', 'Начало сухостоя', 'ПДО', 'Примечание', 'Синхронизировано'
];
var CSV_DELIMITER = ';';

var EXPORT_FIELD_TEMPLATES_KEY = 'cattleTracker_export_fieldTemplates';

function getExportFieldTemplates() {
  try {
    var raw = localStorage.getItem(EXPORT_FIELD_TEMPLATES_KEY);
    if (raw) {
      var list = JSON.parse(raw);
      if (Array.isArray(list)) return list;
    }
  } catch (e) {}
  return [];
}

function saveExportFieldTemplates(list) {
  try {
    localStorage.setItem(EXPORT_FIELD_TEMPLATES_KEY, JSON.stringify(list || []));
  } catch (e) {}
}

function getDefaultExportFieldKeys() {
  if (typeof window.COW_FIELDS !== 'undefined' && window.COW_FIELDS.length > 0) {
    return window.COW_FIELDS.map(function (f) { return f.key; });
  }
  return ['cattleId', 'nickname', 'group', 'birthDate', 'lactation', 'calvingDate', 'inseminationDate', 'attemptNumber', 'bull', 'inseminator', 'code', 'status', 'protocolName', 'protocolStartDate', 'exitDate', 'dryStartDate', 'pdo', 'note', 'synced'];
}

function formatDateForExport(dateStr) {
  if (!dateStr) return '';
  return String(dateStr).trim();
}

function escapeCsvCell(val) {
  var s = val === null || val === undefined ? '' : String(val);
  if (s.indexOf(CSV_DELIMITER) !== -1 || s.indexOf('"') !== -1 || s.indexOf('\n') !== -1 || s.indexOf('\r') !== -1) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function getPDOForExport(entry) {
  if (typeof getPDO === 'function') return getPDO(entry);
  return entry.vwp !== undefined ? String(entry.vwp) : '';
}

/**
 * Строит книгу Excel и скачивает файл.
 */
function buildAndDownloadExcel(fieldKeys, includeInseminations, includeTasks, tasksFrom, tasksTo) {
  if (typeof entries === 'undefined' || !Array.isArray(entries) || entries.length === 0) {
    if (typeof showToast === 'function') showToast('Нет данных для экспорта', 'error'); else alert('Нет данных для экспорта.');
    return;
  }
  var dateStr = new Date().toISOString().slice(0, 10);
  var fields = [];
  var byKey = {};
  if (typeof window.COW_FIELDS !== 'undefined' && window.COW_FIELDS.length > 0) {
    window.COW_FIELDS.forEach(function (f) { byKey[f.key] = f; });
    fieldKeys.forEach(function (k) {
      if (byKey[k]) fields.push(byKey[k]);
    });
  }
  if (fields.length === 0) {
    fields = [{ key: 'cattleId', label: 'Корова', exportRender: function (e) { return e ? String(e.cattleId) : ''; } }];
    fieldKeys.forEach(function (k) {
      if (k !== 'cattleId' && byKey[k]) fields.push(byKey[k]);
    });
  }

  if (typeof XLSX === 'undefined') {
    var BOM = '\uFEFF';
    var headers = fields.map(function (f) { return f.label || f.key; });
    var lines = [headers.join(CSV_DELIMITER)];
    for (var i = 0; i < entries.length; i++) {
      var e = entries[i];
      var row = fields.map(function (f) {
        var fn = f.exportRender || f.render;
        var v = fn ? fn(e) : (e[f.key] != null ? String(e[f.key]) : '');
        return escapeCsvCell(v);
      });
      lines.push(row.join(CSV_DELIMITER));
    }
    var csv = BOM + lines.join('\r\n');
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'коровы_' + dateStr + '.csv';
    a.click();
    URL.revokeObjectURL(url);
    return;
  }

  var cowHeaders = [fields.map(function (f) { return f.label || f.key; })];
  var cowRows = [];
  for (var i = 0; i < entries.length; i++) {
    var e = entries[i];
    cowRows.push(fields.map(function (f) {
      var fn = f.exportRender || f.render;
      return fn ? fn(e) : (e[f.key] != null ? String(e[f.key]) : '');
    }));
  }
  var wsCows = XLSX.utils.aoa_to_sheet(cowHeaders.concat(cowRows));
  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsCows, 'Коровы');

  if (includeInseminations && typeof getAllInseminationsFlat === 'function') {
    var insemHeaders = [['Номер коровы', 'Кличка', 'Лактация', 'Дата осеменения', 'Попытка', 'Бык', 'Техник ИО', 'Дней от предыдущего', 'Код']];
    var flat = getAllInseminationsFlat();
    var insemRows = flat.map(function (r) {
      return [
        r.cattleId || '', r.nickname || '',
        (r.lactation !== undefined && r.lactation !== null && r.lactation !== '') || r.lactation === 0 ? String(r.lactation) : '',
        formatDateForExport(r.date),
        r.attemptNumber !== undefined ? String(r.attemptNumber) : '',
        r.bull || '', r.inseminator || '',
        r.daysFromPrevious !== undefined && r.daysFromPrevious !== '—' ? String(r.daysFromPrevious) : '',
        r.code || ''
      ];
    });
    var wsInsem = XLSX.utils.aoa_to_sheet(insemHeaders.concat(insemRows));
    XLSX.utils.book_append_sheet(wb, wsInsem, 'Осеменения');
  }

  if (includeTasks && typeof window.getProtocolTasks === 'function') {
    var tasks = window.getProtocolTasks(tasksFrom, tasksTo);
    var taskHeaders = [['Дата', 'Номер коровы', 'Группа', 'Препарат/задача', 'Протокол']];
    var taskRows = tasks.map(function (t) {
      return [t.date || '', t.cattleId || '', t.group || '', t.drug || '', t.protocolName || ''];
    });
    var wsTasks = XLSX.utils.aoa_to_sheet(taskHeaders.concat(taskRows));
    XLSX.utils.book_append_sheet(wb, wsTasks, 'Список задач');
  }

  XLSX.writeFile(wb, 'коровы_' + dateStr + '.xlsx');
}

function renderExportDialog() {
  var listEl = document.getElementById('exportFieldsList');
  var templatesEl = document.getElementById('exportTemplatesList');
  if (!listEl) return;
  var fields = typeof window.COW_FIELDS !== 'undefined' && window.COW_FIELDS.length > 0
    ? window.COW_FIELDS
    : getDefaultExportFieldKeys().map(function (k) { return { key: k, label: k }; });
  var savedKeys = [];
  try {
    var raw = localStorage.getItem('cattleTracker_export_selectedFields');
    if (raw) {
      var arr = JSON.parse(raw);
      if (Array.isArray(arr) && arr.length > 0) savedKeys = arr;
    }
  } catch (e) {}
  if (savedKeys.length === 0) savedKeys = getDefaultExportFieldKeys();
  var keySet = {};
  savedKeys.forEach(function (k) { keySet[k] = true; });
  var html = fields.map(function (field) {
    var key = field.key;
    var label = field.label || key;
    var checked = keySet[key] !== false;
    return '<label class="view-fields-item">' +
      '<input type="checkbox" class="export-field-checkbox" value="' + String(key).replace(/"/g, '&quot;') + '"' + (checked ? ' checked' : '') + ' />' +
      '<span>' + String(label).replace(/</g, '&lt;') + '</span></label>';
  }).join('');
  listEl.innerHTML = html;

  if (templatesEl) {
    var templates = getExportFieldTemplates();
    templatesEl.innerHTML = templates.length === 0
      ? '<p class="view-fields-templates-empty">Нет сохранённых шаблонов</p>'
      : templates.map(function (t, idx) {
          var name = (t.name || '').replace(/</g, '&lt;').replace(/"/g, '&quot;');
          return '<div class="view-fields-template-item">' +
            '<span class="view-fields-template-name">' + name + '</span>' +
            ' <button type="button" class="small-btn export-template-apply" data-export-template-index="' + idx + '">Применить</button>' +
            '</div>';
        }).join('');
  }

  var includeTasksCb = document.getElementById('exportIncludeTasks');
  var periodRow = document.getElementById('exportTasksPeriodRow');
  if (includeTasksCb && periodRow) {
    periodRow.style.display = includeTasksCb.checked ? '' : 'none';
    includeTasksCb.addEventListener('change', function () {
      periodRow.style.display = includeTasksCb.checked ? '' : 'none';
    });
  }
  var today = new Date();
  var weekEnd = new Date(today);
  weekEnd.setDate(weekEnd.getDate() + 7);
  function pad(n) { return n < 10 ? '0' + n : String(n); }
  var fromInput = document.getElementById('exportTasksDateFrom');
  var toInput = document.getElementById('exportTasksDateTo');
  if (fromInput) fromInput.value = today.getFullYear() + '-' + pad(today.getMonth() + 1) + '-' + pad(today.getDate());
  if (toInput) toInput.value = weekEnd.getFullYear() + '-' + pad(weekEnd.getMonth() + 1) + '-' + pad(weekEnd.getDate());
}

function openExportDialog() {
  var modal = document.getElementById('exportSettingsModal');
  if (!modal) return;
  renderExportDialog();
  modal.classList.add('active');
  modal.setAttribute('aria-hidden', 'false');
  var firstFocus = document.querySelector('#exportSettingsModal .export-field-checkbox, #exportSettingsModal .small-btn');
  if (firstFocus) firstFocus.focus();

  var closeBtn = document.getElementById('exportSettingsCloseBtn');
  var cancelBtn = document.getElementById('exportSettingsCancelBtn');
  var exportBtn = document.getElementById('exportSettingsExportBtn');
  function closeExportDialog() {
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
  }
  if (closeBtn && !closeBtn.dataset.bound) {
    closeBtn.dataset.bound = '1';
    closeBtn.addEventListener('click', closeExportDialog);
  }
  if (cancelBtn && !cancelBtn.dataset.bound) {
    cancelBtn.dataset.bound = '1';
    cancelBtn.addEventListener('click', closeExportDialog);
  }
  modal.addEventListener('click', function (ev) {
    if (ev.target === modal) closeExportDialog();
    var applyBtn = ev.target.closest('.export-template-apply');
    if (applyBtn && applyBtn.dataset.exportTemplateIndex !== undefined) {
      var idx = parseInt(applyBtn.dataset.exportTemplateIndex, 10);
      var templates = getExportFieldTemplates();
      if (templates[idx] && templates[idx].fieldKeys && templates[idx].fieldKeys.length > 0) {
        var keys = templates[idx].fieldKeys;
        modal.querySelectorAll('.export-field-checkbox').forEach(function (cb) {
          cb.checked = keys.indexOf(cb.value) !== -1;
        });
        renderExportDialog();
      }
      ev.preventDefault();
    }
  });

  var selectAllBtn = document.getElementById('exportSelectAllBtn');
  var resetBtn = document.getElementById('exportResetBtn');
  if (selectAllBtn) {
    selectAllBtn.addEventListener('click', function () {
      modal.querySelectorAll('.export-field-checkbox').forEach(function (cb) { cb.checked = true; });
    });
  }
  if (resetBtn) {
    resetBtn.addEventListener('click', function () {
      getDefaultExportFieldKeys().forEach(function (k) {
        var cb = modal.querySelector('.export-field-checkbox[value="' + k.replace(/"/g, '&quot;') + '"]');
        if (cb) cb.checked = true;
      });
      modal.querySelectorAll('.export-field-checkbox').forEach(function (cb) {
        if (getDefaultExportFieldKeys().indexOf(cb.value) === -1) cb.checked = false;
      });
    });
  }

  var saveTemplateBtn = document.getElementById('exportSaveTemplateBtn');
  var templateNameInput = document.getElementById('exportTemplateNameInput');
  if (saveTemplateBtn && templateNameInput) {
    saveTemplateBtn.addEventListener('click', function () {
      var name = (templateNameInput.value || '').trim();
      if (!name) {
        if (typeof showToast === 'function') showToast('Введите название шаблона.', 'error'); else alert('Введите название шаблона.');
        return;
      }
      var checked = Array.prototype.slice.call(modal.querySelectorAll('.export-field-checkbox:checked')).map(function (el) { return el.value; });
      if (checked.length === 0) {
        if (typeof showToast === 'function') showToast('Выберите хотя бы одно поле.', 'error'); else alert('Выберите хотя бы одно поле.');
        return;
      }
      var list = getExportFieldTemplates();
      list.push({ name: name, fieldKeys: checked });
      saveExportFieldTemplates(list);
      templateNameInput.value = '';
      renderExportDialog();
    });
  }

  if (exportBtn && !exportBtn.dataset.bound) {
    exportBtn.dataset.bound = '1';
    exportBtn.addEventListener('click', function () {
      var checked = Array.prototype.slice.call(modal.querySelectorAll('.export-field-checkbox:checked')).map(function (el) { return el.value; });
      if (checked.length === 0) {
        if (typeof showToast === 'function') showToast('Выберите хотя бы одно поле для листа «Коровы».', 'error'); else alert('Выберите хотя бы одно поле для листа «Коровы».');
        return;
      }
      try {
        localStorage.setItem('cattleTracker_export_selectedFields', JSON.stringify(checked));
      } catch (e) {}
      var includeInsem = document.getElementById('exportIncludeInseminations');
      var includeTasks = document.getElementById('exportIncludeTasks');
      var tasksFrom = document.getElementById('exportTasksDateFrom');
      var tasksTo = document.getElementById('exportTasksDateTo');
      buildAndDownloadExcel(
        checked,
        includeInsem ? includeInsem.checked : true,
        includeTasks ? includeTasks.checked : false,
        tasksFrom ? tasksFrom.value : undefined,
        tasksTo ? tasksTo.value : undefined
      );
      closeExportDialog();
      if (typeof showToast === 'function') showToast('Экспорт выполнен', 'success');
    });
  }
}

function exportToExcel() {
  openExportDialog();
}

function downloadTemplate() {
  var BOM = '\uFEFF';
  var line = CSV_HEADERS.join(CSV_DELIMITER);
  var csv = BOM + line + '\r\n';
  var blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'шаблон_импорта_коров.csv';
  a.click();
  URL.revokeObjectURL(url);
}
if (typeof window !== 'undefined') {
  window.exportToExcel = exportToExcel;
  window.downloadTemplate = downloadTemplate;
}
export {};
