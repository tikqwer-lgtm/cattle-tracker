// field-config.js — единый конфиг полей карточки/списка/экспорта

(function () {
  'use strict';

  function safeStr(val) {
    if (val === undefined || val === null) return '';
    return String(val);
  }

  var COW_FIELDS = [
    { key: 'cattleId', label: 'Корова', sortable: true, render: function (e) { return e ? safeStr(e.cattleId) : ''; } },
    { key: 'nickname', label: 'Кличка', sortable: true, render: function (e) { return e ? safeStr(e.nickname) : ''; } },
    { key: 'group', label: 'Группа', sortable: true, render: function (e) { return e ? safeStr(e.group) : ''; } },
    { key: 'birthDate', label: 'Дата рождения', sortable: true, render: function (e) { return e && typeof formatDate === 'function' ? formatDate(e.birthDate) : ''; } },
    { key: 'lactation', label: 'Лактация', sortable: true, render: function (e) { return e && ((e.lactation !== undefined && e.lactation !== null && e.lactation !== '') || e.lactation === 0) ? String(e.lactation) : ''; } },
    { key: 'calvingDate', label: 'Дата отёла', sortable: true, render: function (e) { return e && typeof formatDate === 'function' ? formatDate(e.calvingDate) : ''; } },
    { key: 'inseminationDate', label: 'Дата осеменения', sortable: true, render: function (e) { return e && typeof formatDate === 'function' ? formatDate(e.inseminationDate) : ''; } },
    { key: 'attemptNumber', label: 'Номер попытки', sortable: true, render: function (e) { return e && (e.attemptNumber !== undefined && e.attemptNumber !== '') ? String(e.attemptNumber) : ''; } },
    { key: 'bull', label: 'Бык', sortable: true, render: function (e) { return e ? safeStr(e.bull) : ''; } },
    { key: 'inseminator', label: 'Техник ИО', sortable: true, render: function (e) { return e ? safeStr(e.inseminator) : ''; } },
    { key: 'code', label: 'Код', sortable: true, render: function (e) { return e ? safeStr(e.code) : ''; } },
    { key: 'status', label: 'Статус', sortable: true, render: function (e) { return e ? safeStr(e.status) : ''; } },
    { key: 'exitDate', label: 'Дата выбытия', sortable: true, render: function (e) { return e && typeof formatDate === 'function' ? formatDate(e.exitDate) : ''; } },
    { key: 'dryStartDate', label: 'Начало сухостоя', sortable: true, render: function (e) { return e && typeof formatDate === 'function' ? formatDate(e.dryStartDate) : ''; } },
    { key: 'pdo', label: 'ПДО (дней от отёла до 1-го осеменения)', sortable: true, render: function (e) { if (!e || typeof getPDO !== 'function') return ''; var v = getPDO(e); return (v === '—' || v === '' || v === undefined) ? '' : String(v); } },
    { key: 'protocolName', label: 'Протокол', sortable: true, render: function (e) { return e ? safeStr((e.protocol && e.protocol.name) || e.protocolName) : ''; } },
    { key: 'protocolStartDate', label: 'Начало протокола', sortable: true, render: function (e) { if (!e) return ''; var d = (e.protocol && e.protocol.startDate) || e.protocolStartDate; return typeof formatDate === 'function' ? formatDate(d) : ''; } },
    { key: 'note', label: 'Примечание', sortable: true, render: function (e) { return e ? safeStr(e.note) : ''; } },
    { key: 'synced', label: 'Синхронизация', sortable: true, render: function (e) { return e && e.synced ? '✅' : (e ? '🟡' : ''); } },
    { key: 'dateAdded', label: 'Дата добавления', sortable: true, render: function (e) { return e ? safeStr(e.dateAdded) : ''; } },
    { key: 'lastModifiedBy', label: 'Изменено пользователем', sortable: true, render: function (e) { return e ? safeStr(e.lastModifiedBy) : ''; } },
    { key: 'daysPregnant', label: 'Дни стельности', sortable: true, render: function (e) { if (!e || typeof getDaysPregnant !== 'function') return ''; var v = getDaysPregnant(e); return v === null || v === undefined ? '' : String(v); } }
  ];

  function rawDate(e, key) {
    if (!e) return '';
    if (key === 'protocolStartDate') return (e.protocol && e.protocol.startDate) || e.protocolStartDate || '';
    return e[key] || '';
  }

  COW_FIELDS.forEach(function (f) {
    if (!f.exportRender && (f.key.indexOf('Date') !== -1 || f.key === 'birthDate' || f.key === 'exitDate' || f.key === 'calvingDate' || f.key === 'inseminationDate' || f.key === 'dryStartDate' || f.key === 'protocolStartDate')) {
      f.exportRender = function (e) { return rawDate(e, f.key); };
    } else if (f.key === 'synced') {
      f.exportRender = function (e) { return e && e.synced ? 'Да' : 'Нет'; };
    } else if (!f.exportRender) {
      f.exportRender = f.render;
    }
  });

  if (typeof window !== 'undefined') {
    window.COW_FIELDS = COW_FIELDS;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { COW_FIELDS: COW_FIELDS };
  }
})();
