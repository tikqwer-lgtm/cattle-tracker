// view-list-fields.js — конфиг полей списка просмотра, шаблоны колонок, утилиты рендера

var VIEW_LIST_FIELDS_KEY = 'cattleTracker_viewList_visibleFields';
var VIEW_LIST_FIELD_TEMPLATES_KEY = 'cattleTracker_viewList_fieldTemplates';

/** Поля, которые можно редактировать прямо в списке (остальные только просмотр) */
var VIEW_LIST_EDITABLE_KEYS = {
  cattleId: 'text', nickname: 'text', group: 'text', birthDate: 'date', lactation: 'number',
  calvingDate: 'date', inseminationDate: 'date', attemptNumber: 'number', bull: 'text',
  inseminator: 'text', code: 'text', status: 'select', exitDate: 'date', dryStartDate: 'date',
  protocolName: 'text', protocolStartDate: 'date', note: 'text'
};
var STATUS_OPTIONS = ['Осемененная', 'Холостая', 'Стельная', 'Сухостой', 'Отёл', 'Брак'];

function viewListEscapeHtml(text) {
  if (!text) return '—';
  if (typeof text !== 'string') {
    try { text = String(text); } catch (e) { return '—'; }
  }
  text = text.replace(/[\x00-\x1F\x7F-\x9F]/g, '').trim();
  if (!text) return '—';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

var VIEW_LIST_FIELDS_DEFAULT = [
  { key: 'cattleId', label: 'Корова', sortable: true, render: function (entry) { return viewListEscapeHtml(entry.cattleId); } },
  { key: 'nickname', label: 'Кличка', sortable: true, render: function (entry) { return viewListEscapeHtml(entry.nickname); } },
  { key: 'group', label: 'Группа', sortable: true, render: function (entry) { return viewListEscapeHtml(entry.group || ''); } },
  { key: 'lactation', label: 'Лактация', sortable: true, render: function (entry) { return (entry.lactation !== undefined && entry.lactation !== null && entry.lactation !== '') || entry.lactation === 0 ? String(entry.lactation) : '—'; } },
  { key: 'inseminationDate', label: 'Дата осеменения', sortable: true, render: function (entry) { return formatDate(entry.inseminationDate) || '—'; } },
  { key: 'bull', label: 'Бык', sortable: true, render: function (entry) { return viewListEscapeHtml(entry.bull); } },
  { key: 'attemptNumber', label: 'Попытка', sortable: true, render: function (entry) { return entry.attemptNumber || '—'; } },
  { key: 'status', label: 'Статус', sortable: true, render: function (entry) { return viewListEscapeHtml(entry.status); } },
  { key: 'calvingDate', label: 'Отёл', sortable: true, render: function (entry) { return formatDate(entry.calvingDate) || '—'; } },
  { key: 'dryStartDate', label: 'Сухостой', sortable: true, render: function (entry) { return formatDate(entry.dryStartDate) || '—'; } },
  { key: 'note', label: 'Примечание', sortable: true, render: function (entry) { return viewListEscapeHtml(entry.note); } },
  { key: 'synced', label: 'Синхронизация', sortable: true, render: function (entry) { return entry.synced ? '<span title="Синхронизировано с сервером">✅</span>' : '<span title="Не синхронизировано">🟡</span>'; } }
];
var VIEW_LIST_FIELDS = (typeof window.COW_FIELDS !== 'undefined' && window.COW_FIELDS.length > 0) ? window.COW_FIELDS : VIEW_LIST_FIELDS_DEFAULT;

function getVisibleFieldKeys() {
  try {
    var raw = localStorage.getItem(VIEW_LIST_FIELDS_KEY);
    if (raw) {
      var list = JSON.parse(raw);
      if (Array.isArray(list) && list.length > 0) return list;
    }
  } catch (e) {}
  return VIEW_LIST_FIELDS.map(function (f) { return f.key; });
}

function getFieldTemplates() {
  try {
    var raw = localStorage.getItem(VIEW_LIST_FIELD_TEMPLATES_KEY);
    if (raw) {
      var list = JSON.parse(raw);
      if (Array.isArray(list)) return list;
    }
  } catch (e) {}
  return [];
}

function saveFieldTemplates(list) {
  try {
    localStorage.setItem(VIEW_LIST_FIELD_TEMPLATES_KEY, JSON.stringify(list || []));
  } catch (e) {}
}

function getVisibleViewFields() {
  var keys = getVisibleFieldKeys();
  var map = {};
  VIEW_LIST_FIELDS.forEach(function (f) { map[f.key] = f; });
  return keys.map(function (k) { return map[k]; }).filter(Boolean);
}
if (typeof window !== 'undefined') {
  window.saveFieldTemplates = saveFieldTemplates;
  window.getVisibleViewFields = getVisibleViewFields;
  window.viewListEscapeHtml = viewListEscapeHtml;
  window.VIEW_LIST_EDITABLE_KEYS = VIEW_LIST_EDITABLE_KEYS;
  window.getVisibleFieldKeys = getVisibleFieldKeys;
  window.VIEW_LIST_FIELDS = VIEW_LIST_FIELDS;
  window.VIEW_LIST_FIELDS_KEY = VIEW_LIST_FIELDS_KEY;
  window.getFieldTemplates = getFieldTemplates;
  window.STATUS_OPTIONS = STATUS_OPTIONS;
}
export {};
