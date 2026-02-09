// view-cow.js — Логика просмотра карточки животного

/**
 * Экранирование HTML для безопасного вывода в карточке
 */
function escapeHtmlCard(text) {
  if (text === undefined || text === null) return '—';
  var s = String(text);
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * ПДО — дней от отёла до первой даты осеменения
 * @param {Object} entry — запись животного
 * @returns {number|string} — количество дней или '—'
 */
function getPDO(entry) {
  if (!entry) return '—';
  var calvingDate = entry.calvingDate;
  if (!calvingDate) return '—';
  var firstInsemDate = null;
  if (entry.inseminationHistory && entry.inseminationHistory.length > 0) {
    var dates = entry.inseminationHistory.map(function (h) { return h.date; }).filter(Boolean);
    if (dates.length > 0) {
      firstInsemDate = dates.reduce(function (a, b) { return a < b ? a : b; });
    }
  }
  if (!firstInsemDate && entry.inseminationDate) firstInsemDate = entry.inseminationDate;
  if (!firstInsemDate) return '—';
  var d1 = new Date(calvingDate);
  var d2 = new Date(firstInsemDate);
  if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return '—';
  var diff = Math.round((d2 - d1) / (24 * 60 * 60 * 1000));
  return diff >= 0 ? diff : '—';
}

/**
 * Строит список осеменений для одной записи (отсортированный по дате), с полем daysFromPrevious
 */
function getInseminationListForEntry(entry) {
  var list = [];
  if (entry.inseminationHistory && entry.inseminationHistory.length > 0) {
    list = entry.inseminationHistory.slice();
  } else if (entry.inseminationDate) {
    list = [{
      date: entry.inseminationDate,
      attemptNumber: entry.attemptNumber ?? 1,
      bull: entry.bull || '',
      inseminator: entry.inseminator || '',
      code: entry.code || ''
    }];
  }
  list.sort(function (a, b) {
    var da = (a.date || '').toString();
    var db = (b.date || '').toString();
    return da < db ? -1 : da > db ? 1 : 0;
  });
  for (var i = 0; i < list.length; i++) {
    if (i === 0) {
      list[i].daysFromPrevious = '—';
    } else {
      var prev = new Date(list[i - 1].date);
      var curr = new Date(list[i].date);
      if (!isNaN(prev.getTime()) && !isNaN(curr.getTime())) {
        list[i].daysFromPrevious = Math.round((curr - prev) / (24 * 60 * 60 * 1000));
      } else {
        list[i].daysFromPrevious = '—';
      }
    }
  }
  return list;
}

/**
 * Просмотр полной карточки животного
 */
function viewCow(cattleId) {
  const entry = entries.find(e => e.cattleId === cattleId);
  if (!entry) {
    console.warn('Животное не найдено:', cattleId);
    return;
  }

  // Перейти на экран просмотра карточки
  navigate('view-cow');

  // Заполнить карточку
  const card = document.getElementById('viewCowCard');
  if (!card) return;

  var pdoVal = getPDO(entry);
  var pdoStr = (pdoVal === '—' || pdoVal === '') ? '—' : String(pdoVal);

  var insemList = getInseminationListForEntry(entry);
  var historyRows = insemList.map(function (row) {
    return (
      '<tr><td>' + (formatDate(row.date) || '—') + '</td><td>' + escapeHtmlCard(row.attemptNumber) + '</td><td>' + escapeHtmlCard(row.bull) + '</td><td>' + escapeHtmlCard(row.inseminator) + '</td><td>' + (row.daysFromPrevious !== undefined ? escapeHtmlCard(row.daysFromPrevious) : '—') + '</td><td>' + escapeHtmlCard(row.code) + '</td></tr>'
    );
  }).join('');
  var historyTableHtml = insemList.length > 0
    ? '<table class="cow-insemination-table"><thead><tr><th>Дата осеменения</th><th>Попытка</th><th>Бык</th><th>Осеменитель</th><th>Дней от предыдущего</th><th>Код</th></tr></thead><tbody>' + historyRows + '</tbody></table>'
    : '<p class="cow-insemination-empty">Нет данных об осеменениях.</p>';

  var rawId = (entry.cattleId || '');
  var safeCattleId = rawId.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;');

  card.innerHTML =
    '<div class="cow-card">' +
    '<h2>Карточка животного №' + escapeHtmlCard(entry.cattleId) + '</h2>' +
    '<div class="cow-details-grid">' +
    '<div><strong>Кличка:</strong> ' + escapeHtmlCard(entry.nickname) + '</div>' +
    '<div><strong>Группа:</strong> ' + escapeHtmlCard(entry.group || '') + '</div>' +
    '<div><strong>Дата рождения:</strong> ' + (formatDate(entry.birthDate) || '—') + '</div>' +
    '<div><strong>Лактация:</strong> ' + escapeHtmlCard(entry.lactation) + '</div>' +
    '<div><strong>Дата отёла:</strong> ' + (formatDate(entry.calvingDate) || '—') + '</div>' +
    '<div><strong>Дата осеменения:</strong> ' + (formatDate(entry.inseminationDate) || '—') + '</div>' +
    '<div class="cow-details-cell-with-button"><strong>Номер попытки:</strong> ' + escapeHtmlCard(entry.attemptNumber) + ' <button type="button" class="small-btn cow-insemination-toggle" onclick="toggleViewCowInseminationHistory()">Все осеменения</button></div>' +
    '<div><strong>Бык:</strong> ' + escapeHtmlCard(entry.bull) + '</div>' +
    '<div><strong>Осеменитель:</strong> ' + escapeHtmlCard(entry.inseminator) + '</div>' +
    '<div><strong>Код:</strong> ' + escapeHtmlCard(entry.code) + '</div>' +
    '<div><strong>Статус:</strong> ' + escapeHtmlCard(entry.status) + '</div>' +
    '<div><strong>Дата выбытия:</strong> ' + (formatDate(entry.exitDate) || '—') + '</div>' +
    '<div><strong>Начало сухостоя:</strong> ' + (formatDate(entry.dryStartDate) || '—') + '</div>' +
    '<div><strong>ПДО (дней от отёла до 1-го осеменения):</strong> ' + pdoStr + '</div>' +
    '<div><strong>Протокол:</strong> ' + escapeHtmlCard((entry.protocol && entry.protocol.name) || entry.protocolName) + '</div>' +
    '<div><strong>Начало протокола:</strong> ' + (formatDate((entry.protocol && entry.protocol.startDate) || entry.protocolStartDate) || '—') + '</div>' +
    '<div><strong>Примечание:</strong> ' + escapeHtmlCard(entry.note) + '</div>' +
    '<div><strong>Синхронизация:</strong> ' + (entry.synced ? '✅' : '🟡') + '</div>' +
    '<div><strong>Дата добавления:</strong> ' + escapeHtmlCard(entry.dateAdded) + '</div>' +
    '<div><strong>Изменено пользователем:</strong> ' + escapeHtmlCard(entry.lastModifiedBy) + '</div>' +
    '</div>' +
    '<div id="viewCowInseminationHistory" class="cow-insemination-history" style="display:none;">' + historyTableHtml + '</div>' +
    '<div class="cow-card-actions">' +
    '<button onclick="editEntry(\'' + safeCattleId + '\');" class="small-btn edit">✏️ Редактировать</button> ' +
    '<button onclick="window._prefillCattleId=\'' + safeCattleId + '\'; navigate(\'dry\');" class="small-btn">🐄 Запуск</button> ' +
    '<button onclick="window._prefillCattleId=\'' + safeCattleId + '\'; navigate(\'calving\');" class="small-btn">🐄 Отел</button> ' +
    '<button onclick="window._prefillCattleId=\'' + safeCattleId + '\'; navigate(\'protocol-assign\');" class="small-btn">📋 Поставить на протокол</button> ' +
    '<button onclick="window._prefillCattleId=\'' + safeCattleId + '\'; navigate(\'uzi\');" class="small-btn">🩺 УЗИ</button> ' +
    '<button onclick="openViewCowActionHistory(\'' + safeCattleId + '\');" class="small-btn">📜 История</button> ' +
    '<button onclick="navigate(\'view\')" class="back-button">Назад к списку</button>' +
    '</div>' +
    '</div>';
}

/**
 * Переключает видимость таблицы «Все осеменения» в карточке животного
 */
function toggleViewCowInseminationHistory() {
  var el = document.getElementById('viewCowInseminationHistory');
  if (!el) return;
  el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

/**
 * Открывает модальное окно истории действий по карточке животного
 */
function openViewCowActionHistory(cattleId) {
  var modal = document.getElementById('viewCowActionHistoryModal');
  var listEl = document.getElementById('viewCowActionHistoryList');
  var closeBtn = document.getElementById('viewCowActionHistoryCloseBtn');
  if (!modal || !listEl) return;
  modal.setAttribute('data-current-cattle-id', cattleId || '');
  renderViewCowActionHistoryModal(cattleId);
  modal.classList.add('active');
  modal.setAttribute('aria-hidden', 'false');
  if (closeBtn && !closeBtn.dataset.bound) {
    closeBtn.dataset.bound = '1';
    closeBtn.addEventListener('click', closeViewCowActionHistoryModal);
  }
  if (!modal.dataset.overlayBound) {
    modal.dataset.overlayBound = '1';
    modal.addEventListener('click', function (e) {
      if (e.target === modal) closeViewCowActionHistoryModal();
    });
  }
}

function closeViewCowActionHistoryModal() {
  var modal = document.getElementById('viewCowActionHistoryModal');
  if (!modal) return;
  modal.classList.remove('active');
  modal.setAttribute('aria-hidden', 'true');
}

/**
 * Заполняет список записей в модальном окне истории (с кнопкой удаления у каждой записи)
 */
function renderViewCowActionHistoryModal(cattleId) {
  var listEl = document.getElementById('viewCowActionHistoryList');
  if (!listEl) return;
  var entry = entries.find(function (e) { return e.cattleId === cattleId; });
  var rawHistory = (entry && entry.actionHistory) ? entry.actionHistory : [];
  var withIndex = rawHistory.map(function (item, idx) { return { item: item, index: idx }; });
  withIndex.sort(function (a, b) {
    var ta = (a.item.dateTime || '').toString();
    var tb = (b.item.dateTime || '').toString();
    return ta > tb ? -1 : ta < tb ? 1 : 0;
  });
  if (withIndex.length === 0) {
    listEl.innerHTML = '<p class="cow-insemination-empty">Нет записей в истории.</p>';
    return;
  }
  var html = withIndex.map(function (row) {
    var item = row.item;
    var origIndex = row.index;
    var safeId = (cattleId || '').replace(/"/g, '&quot;');
    var dt = escapeHtmlCard(item.dateTime);
    var user = escapeHtmlCard(item.userName);
    var action = escapeHtmlCard(item.action);
    var details = escapeHtmlCard(item.details);
    return '<div class="action-history-item" data-cattle-id="' + safeId + '" data-action-index="' + origIndex + '">' +
      '<span class="action-history-date">' + dt + '</span> ' +
      '<span class="action-history-user">' + user + '</span> — ' +
      '<span class="action-history-action">' + action + '</span>' +
      (details ? ' <span class="action-history-details">(' + details + ')</span>' : '') +
      ' <button type="button" class="small-btn action-history-delete" onclick="deleteActionHistoryItem(\'' + safeId + '\', ' + origIndex + ')" title="Удалить запись">🗑️</button>' +
      '</div>';
  }).join('');
  listEl.innerHTML = html;
}

/**
 * Удаляет запись из истории действий; сохраняет данные и обновляет список в модалке
 */
function deleteActionHistoryItem(cattleId, index) {
  var entry = entries.find(function (e) { return e.cattleId === cattleId; });
  if (!entry || !entry.actionHistory || index < 0 || index >= entry.actionHistory.length) return;
  entry.actionHistory.splice(index, 1);
  if (typeof saveLocally === 'function') saveLocally();
  if (typeof window.CATTLE_TRACKER_USE_API !== 'undefined' && window.CATTLE_TRACKER_USE_API && typeof window.updateEntryViaApi === 'function') {
    window.updateEntryViaApi(cattleId, entry).then(function () {
      renderViewCowActionHistoryModal(cattleId);
    }).catch(function () { renderViewCowActionHistoryModal(cattleId); });
  } else {
    renderViewCowActionHistoryModal(cattleId);
  }
}

// Состояние фильтра и сортировки для экрана «Все осеменения»
var allInseminationsSortKey = 'date';
var allInseminationsSortDir = 'asc';
var allInseminationsSearchQuery = '';
var allInseminationsDateFrom = '';
var allInseminationsDateTo = '';
var ALL_INSEM_FIELDS_STORAGE_KEY = 'cattleTracker_allInseminations_visibleFields';

var ALL_INSEM_FIELDS = [
  { key: 'cattleId', label: 'Номер коровы', sortable: true, render: function (row) { return escapeHtmlCard(row.cattleId); } },
  { key: 'nickname', label: 'Кличка', sortable: true, render: function (row) { return escapeHtmlCard(row.nickname); } },
  { key: 'date', label: 'Дата осеменения', sortable: true, render: function (row) { return formatDate(row.date) || '—'; } },
  { key: 'attemptNumber', label: 'Попытка', sortable: true, render: function (row) { return escapeHtmlCard(row.attemptNumber); } },
  { key: 'bull', label: 'Бык', sortable: true, render: function (row) { return escapeHtmlCard(row.bull); } },
  { key: 'inseminator', label: 'Осеменитель', sortable: true, render: function (row) { return escapeHtmlCard(row.inseminator); } },
  { key: 'daysFromPrevious', label: 'Дней от предыдущего', sortable: true, render: function (row) { return row.daysFromPrevious !== undefined && row.daysFromPrevious !== '' ? escapeHtmlCard(row.daysFromPrevious) : '—'; } },
  { key: 'code', label: 'Код', sortable: true, render: function (row) { return escapeHtmlCard(row.code); } }
];

function getVisibleAllInseminationsFieldKeys() {
  try {
    var raw = localStorage.getItem(ALL_INSEM_FIELDS_STORAGE_KEY);
    if (raw) {
      var list = JSON.parse(raw);
      if (Array.isArray(list) && list.length > 0) return list;
    }
  } catch (e) {}
  return ALL_INSEM_FIELDS.map(function (f) { return f.key; });
}

function getVisibleAllInseminationsFields() {
  var keys = getVisibleAllInseminationsFieldKeys();
  var map = {};
  ALL_INSEM_FIELDS.forEach(function (f) { map[f.key] = f; });
  return keys.map(function (k) { return map[k]; }).filter(Boolean);
}

function filterAllInseminationsFlat(flat) {
  var q = (allInseminationsSearchQuery || '').toLowerCase().trim();
  var from = allInseminationsDateFrom || '';
  var to = allInseminationsDateTo || '';
  var list = flat;
  if (q) {
    list = list.filter(function (row) {
      var id = (row.cattleId || '').toLowerCase();
      var nick = (row.nickname || '').toLowerCase();
      var bull = (row.bull || '').toLowerCase();
      var insem = (row.inseminator || '').toLowerCase();
      var code = (row.code || '').toLowerCase();
      return id.indexOf(q) !== -1 || nick.indexOf(q) !== -1 || bull.indexOf(q) !== -1 || insem.indexOf(q) !== -1 || code.indexOf(q) !== -1;
    });
  }
  if (from) list = list.filter(function (row) { return (row.date || '') >= from; });
  if (to) list = list.filter(function (row) { return (row.date || '') <= to; });
  return list;
}

function _compareAllInseminations(a, b, key, dir) {
  var mul = dir === 'asc' ? 1 : -1;
  var va = a[key];
  var vb = b[key];
  if (key === 'date') {
    var da = va ? new Date(va).getTime() : 0;
    var db = vb ? new Date(vb).getTime() : 0;
    return mul * (da - db);
  }
  if (key === 'attemptNumber' || key === 'daysFromPrevious') {
    var na = parseInt(va, 10);
    var nb = parseInt(vb, 10);
    if (isNaN(na)) na = 0;
    if (isNaN(nb)) nb = 0;
    return mul * (na - nb);
  }
  var sa = (va != null ? String(va) : '').toLowerCase();
  var sb = (vb != null ? String(vb) : '').toLowerCase();
  return mul * (sa.localeCompare(sb, 'ru'));
}

function renderAllInseminationsFilterUI() {
  var container = document.getElementById('allInseminationsFilterContainer');
  if (!container) return;
  var q = (allInseminationsSearchQuery || '').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  container.innerHTML =
    '<div class="search-filter-bar">' +
    '<div class="search-row">' +
    '<input type="text" id="allInseminationsSearchInput" class="search-input" placeholder="Поиск по номеру, кличке, быку, осеменителю..." value="' + q + '">' +
    '<label class="filter-label">Период:</label><input type="date" id="allInseminationsDateFrom" value="' + (allInseminationsDateFrom || '') + '"> — <input type="date" id="allInseminationsDateTo" value="' + (allInseminationsDateTo || '') + '">' +
    '<button type="button" id="allInseminationsFilterClearBtn" class="small-btn">Сбросить</button>' +
    '</div></div>';
  var searchInput = document.getElementById('allInseminationsSearchInput');
  var dateFrom = document.getElementById('allInseminationsDateFrom');
  var dateTo = document.getElementById('allInseminationsDateTo');
  var clearBtn = document.getElementById('allInseminationsFilterClearBtn');
  function applyAndRefresh() {
    allInseminationsSearchQuery = searchInput ? searchInput.value.trim() : '';
    allInseminationsDateFrom = dateFrom ? dateFrom.value : '';
    allInseminationsDateTo = dateTo ? dateTo.value : '';
    renderAllInseminationsScreen();
  }
  if (searchInput) {
    searchInput.addEventListener('input', applyAndRefresh);
    searchInput.addEventListener('keyup', function (e) { if (e.key === 'Enter') applyAndRefresh(); });
  }
  if (dateFrom) dateFrom.addEventListener('change', applyAndRefresh);
  if (dateTo) dateTo.addEventListener('change', applyAndRefresh);
  if (clearBtn) {
    clearBtn.addEventListener('click', function () {
      allInseminationsSearchQuery = '';
      allInseminationsDateFrom = '';
      allInseminationsDateTo = '';
      if (searchInput) searchInput.value = '';
      if (dateFrom) dateFrom.value = '';
      if (dateTo) dateTo.value = '';
      renderAllInseminationsScreen();
    });
  }
}

function initAllInseminationsFieldsSettings() {
  var btn = document.getElementById('allInseminationsFieldsSettingsBtn');
  var modal = document.getElementById('allInseminationsFieldsModal');
  var closeBtn = document.getElementById('allInseminationsFieldsCloseBtn');
  var saveBtn = document.getElementById('allInseminationsFieldsSaveBtn');
  var resetBtn = document.getElementById('allInseminationsFieldsResetBtn');
  if (!modal || !btn || btn.dataset.bound === '1') return;
  btn.dataset.bound = '1';
  btn.addEventListener('click', function () {
    var listEl = document.getElementById('allInseminationsFieldsList');
    if (!listEl) return;
    var visible = getVisibleAllInseminationsFieldKeys();
    var html = ALL_INSEM_FIELDS.map(function (field) {
      var checked = visible.indexOf(field.key) !== -1;
      return '<label class="view-fields-item">' +
        '<input type="checkbox" class="view-fields-checkbox all-insem-fields-cb" value="' + field.key + '"' + (checked ? ' checked' : '') + ' />' +
        '<span>' + field.label + '</span></label>';
    }).join('');
    listEl.innerHTML = html;
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
  });
  if (closeBtn) closeBtn.addEventListener('click', function () { modal.classList.remove('active'); modal.setAttribute('aria-hidden', 'true'); });
  if (resetBtn) resetBtn.addEventListener('click', function () {
    try { localStorage.removeItem(ALL_INSEM_FIELDS_STORAGE_KEY); } catch (e) {}
    modal.classList.remove('active');
    renderAllInseminationsScreen();
  });
  if (saveBtn) saveBtn.addEventListener('click', function () {
    var checked = Array.prototype.slice.call(modal.querySelectorAll('.all-insem-fields-cb:checked')).map(function (el) { return el.value; });
    if (checked.length === 0) { alert('Выберите хотя бы одно поле.'); return; }
    try { localStorage.setItem(ALL_INSEM_FIELDS_STORAGE_KEY, JSON.stringify(checked)); } catch (e) {}
    modal.classList.remove('active');
    renderAllInseminationsScreen();
  });
  modal.addEventListener('click', function (e) { if (e.target === modal) { modal.classList.remove('active'); modal.setAttribute('aria-hidden', 'true'); } });
}

/**
 * Собирает плоский список всех осеменений по всем животным (для экрана и экспорта)
 * Каждый элемент: { cattleId, nickname, date, attemptNumber, bull, inseminator, code, daysFromPrevious }
 * Сортировка по date по возрастанию. daysFromPrevious считается в контексте каждого животного.
 */
function getAllInseminationsFlat() {
  var flat = [];
  var list = typeof entries !== 'undefined' ? entries : [];
  for (var i = 0; i < list.length; i++) {
    var entry = list[i];
    var rows = getInseminationListForEntry(entry);
    for (var j = 0; j < rows.length; j++) {
      flat.push({
        cattleId: entry.cattleId || '',
        nickname: entry.nickname || '',
        date: rows[j].date,
        attemptNumber: rows[j].attemptNumber,
        bull: rows[j].bull || '',
        inseminator: rows[j].inseminator || '',
        code: rows[j].code || '',
        daysFromPrevious: rows[j].daysFromPrevious
      });
    }
  }
  flat.sort(function (a, b) {
    var da = (a.date || '').toString();
    var db = (b.date || '').toString();
    return da < db ? -1 : da > db ? 1 : 0;
  });
  return flat;
}

/**
 * Заполняет экран «Все осеменения»: фильтр, таблица с сортировкой и настройкой полей
 */
function renderAllInseminationsScreen() {
  var container = document.getElementById('allInseminationsList');
  var filterContainer = document.getElementById('allInseminationsFilterContainer');
  if (!container) return;

  if (filterContainer && !filterContainer.innerHTML.trim()) renderAllInseminationsFilterUI();
  initAllInseminationsFieldsSettings();

  var flat = getAllInseminationsFlat();
  var listToShow = filterAllInseminationsFlat(flat);
  if (allInseminationsSortKey) {
    listToShow = listToShow.slice();
    listToShow.sort(function (a, b) { return _compareAllInseminations(a, b, allInseminationsSortKey, allInseminationsSortDir); });
  }

  var fields = getVisibleAllInseminationsFields();
  var fieldKeys = fields.map(function (f) { return f.key; });
  if (allInseminationsSortKey && fieldKeys.indexOf(allInseminationsSortKey) === -1) allInseminationsSortKey = '';

  if (listToShow.length === 0) {
    container.innerHTML = flat.length === 0
      ? '<p class="cow-insemination-empty">Нет данных об осеменениях.</p>'
      : '<p class="cow-insemination-empty">Нет записей по фильтру.</p>';
    return;
  }

  var sortAsc = allInseminationsSortDir === 'asc';
  var sortMark = function (key) {
    if (allInseminationsSortKey !== key) return '';
    return sortAsc ? ' <span class="sort-indicator" aria-hidden="true">▲</span>' : ' <span class="sort-indicator" aria-hidden="true">▼</span>';
  };
  var sortClass = function (key) {
    if (allInseminationsSortKey !== key) return '';
    return sortAsc ? ' sort-asc' : ' sort-desc';
  };

  var thead = '<thead><tr>' + fields.map(function (f) {
    if (!f.sortable) return '<th>' + f.label + '</th>';
    return '<th class="sortable-th' + sortClass(f.key) + '" data-sort-key="' + f.key + '" role="button" tabindex="0">' + f.label + sortMark(f.key) + '</th>';
  }).join('') + '</tr></thead>';
  var tbody = '<tbody>' + listToShow.map(function (row) {
    var attrId = (row.cattleId || '').replace(/"/g, '&quot;');
    var cells = fields.map(function (f) { return '<td>' + f.render(row) + '</td>'; }).join('');
    return '<tr class="all-insem-row view-entry-row" data-cattle-id="' + attrId + '" role="button" tabindex="0">' + cells + '</tr>';
  }).join('') + '</tbody>';
  container.innerHTML = '<table class="entries-table cow-insemination-table all-inseminations-table">' + thead + tbody + '</table>';

  container.querySelectorAll('.all-insem-row').forEach(function (tr) {
    var id = tr.getAttribute('data-cattle-id');
    if (id) tr.addEventListener('click', function () { viewCow(id); });
  });

  container.querySelectorAll('th[data-sort-key]').forEach(function (th) {
    th.addEventListener('click', function () {
      var key = th.getAttribute('data-sort-key');
      if (!key) return;
      if (allInseminationsSortKey === key) allInseminationsSortDir = allInseminationsSortDir === 'asc' ? 'desc' : 'asc';
      else { allInseminationsSortKey = key; allInseminationsSortDir = 'asc'; }
      renderAllInseminationsScreen();
    });
  });
}

// Список записей с групповым выделением рисуется в menu.js (updateViewList).
// Открытие карточки животного — по кнопке «Карточка» в строке или по вызову viewCow(cattleId).
