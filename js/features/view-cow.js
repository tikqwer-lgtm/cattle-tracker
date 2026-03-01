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
 * Дни стельности: от последнего осеменения до сегодня (только при статусе «Стельная»).
 * @param {Object} entry — запись животного
 * @returns {number|null} — количество дней или null
 */
function getDaysPregnant(entry) {
  if (!entry) return null;
  var status = (entry.status || '').toString();
  if (status.indexOf('Стельная') === -1) return null;
  var lastInsemDate = null;
  if (entry.inseminationHistory && entry.inseminationHistory.length > 0) {
    var dates = entry.inseminationHistory.map(function (h) { return h.date; }).filter(Boolean);
    if (dates.length > 0) {
      lastInsemDate = dates.reduce(function (a, b) { return a > b ? a : b; });
    }
  }
  if (!lastInsemDate && entry.inseminationDate) lastInsemDate = entry.inseminationDate;
  if (!lastInsemDate) return null;
  var d = new Date(lastInsemDate);
  var today = new Date();
  if (isNaN(d.getTime())) return null;
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  var diff = Math.round((today - d) / (24 * 60 * 60 * 1000));
  return diff >= 0 ? diff : null;
}

/**
 * Дни лактации: от даты отёла до сегодня.
 * @param {Object} entry — запись животного
 * @returns {number|null} — количество дней или null
 */
function getDaysInLactation(entry) {
  if (!entry || !entry.calvingDate) return null;
  var d = new Date(entry.calvingDate);
  var today = new Date();
  if (isNaN(d.getTime())) return null;
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  var diff = Math.round((today - d) / (24 * 60 * 60 * 1000));
  return diff >= 0 ? diff : null;
}

/**
 * Парсит строку даты в timestamp (мс) для расчёта интервалов. Поддерживает YYYY-MM-DD, DD.MM.YYYY, DD.MM.YY.
 * @param {string} dateStr
 * @returns {number} timestamp или NaN
 */
function parseInseminationDateToTime(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return NaN;
  var s = dateStr.trim();
  if (!s) return NaN;
  var d = new Date(s);
  if (!isNaN(d.getTime())) return d.getTime();
  var dmY = s.match(/^(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})$/);
  if (dmY) {
    d = new Date(parseInt(dmY[3], 10), parseInt(dmY[2], 10) - 1, parseInt(dmY[1], 10));
    return isNaN(d.getTime()) ? NaN : d.getTime();
  }
  var dmYy = s.match(/^(\d{1,2})[.\/](\d{1,2})[.\/](\d{2})$/);
  if (dmYy) {
    var yy = parseInt(dmYy[3], 10);
    var year = yy <= 30 ? 2000 + yy : 1900 + yy;
    d = new Date(year, parseInt(dmYy[2], 10) - 1, parseInt(dmYy[1], 10));
    return isNaN(d.getTime()) ? NaN : d.getTime();
  }
  return NaN;
}

/**
 * Определяет номер лактации для осеменения.
 * Если у животного задана лактация (0, 1, 2, …) — возвращаем её. Иначе: по дате отёла до/после = 1 или 2.
 */
function getInseminationLactation(insemDate, calvingDate, entryLactation) {
  var lact = entryLactation !== undefined && entryLactation !== null && entryLactation !== '' ? parseInt(entryLactation, 10) : null;
  if (lact !== null && !isNaN(lact) && lact >= 0) return lact;
  if (!calvingDate || !insemDate) return 1;
  var tInsem = parseInseminationDateToTime(insemDate);
  var tCalv = parseInseminationDateToTime(calvingDate);
  if (isNaN(tInsem) || isNaN(tCalv)) return 1;
  return tInsem < tCalv ? 1 : 2;
}

/**
 * Строит список осеменений для одной записи (отсортированный по дате), с полем daysFromPrevious и lactation.
 * Интервал «дней от предыдущего» считается только внутри одной лактации.
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
    var ta = parseInseminationDateToTime(a.date);
    var tb = parseInseminationDateToTime(b.date);
    if (isNaN(ta) && isNaN(tb)) return 0;
    if (isNaN(ta)) return 1;
    if (isNaN(tb)) return -1;
    return ta < tb ? -1 : ta > tb ? 1 : 0;
  });
  var calvingDate = entry.calvingDate || '';
  for (var i = 0; i < list.length; i++) {
    list[i].lactation = getInseminationLactation(list[i].date, calvingDate, entry.lactation);
    if (i === 0) {
      list[i].daysFromPrevious = '—';
    } else {
      if (list[i].lactation !== list[i - 1].lactation) {
        list[i].daysFromPrevious = '—';
      } else {
        var prevTime = parseInseminationDateToTime(list[i - 1].date);
        var currTime = parseInseminationDateToTime(list[i].date);
        if (!isNaN(prevTime) && !isNaN(currTime)) {
          list[i].daysFromPrevious = Math.round((currTime - prevTime) / (24 * 60 * 60 * 1000));
        } else {
          list[i].daysFromPrevious = '—';
        }
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

  // Перейти на экран просмотра карточки (с cattleId для роутинга)
  navigate('view-cow', { cattleId: cattleId });

  // Заполнить карточку
  const card = document.getElementById('viewCowCard');
  if (!card) return;

  var pdoVal = getPDO(entry);
  var pdoStr = (pdoVal === '—' || pdoVal === '') ? '—' : String(pdoVal);
  var daysPreg = getDaysPregnant(entry);
  var daysPregStr = (daysPreg === null || daysPreg === undefined) ? '—' : String(daysPreg);
  var daysInLact = getDaysInLactation(entry);
  var daysInLactStr = (daysInLact === null || daysInLact === undefined) ? '—' : String(daysInLact);

  var insemList = getInseminationListForEntry(entry);
  var historyRows = insemList.map(function (row) {
    return (
      '<tr><td>' + (formatDate(row.date) || '—') + '</td><td>' + escapeHtmlCard(row.attemptNumber) + '</td><td>' + escapeHtmlCard(row.bull) + '</td><td>' + escapeHtmlCard(row.inseminator) + '</td><td>' + (row.daysFromPrevious !== undefined ? escapeHtmlCard(row.daysFromPrevious) : '—') + '</td><td>' + escapeHtmlCard(row.code) + '</td></tr>'
    );
  }).join('');
  var historyTableHtml = insemList.length > 0
    ? '<table class="cow-insemination-table"><thead><tr><th>Дата осеменения</th><th>Попытка</th><th>Бык</th><th>Техник ИО</th><th>Дней от предыдущего</th><th>Код</th></tr></thead><tbody>' + historyRows + '</tbody></table>'
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
    '<div><strong>Техник ИО:</strong> ' + escapeHtmlCard(entry.inseminator) + '</div>' +
    '<div><strong>Код:</strong> ' + escapeHtmlCard(entry.code) + '</div>' +
    '<div><strong>Статус:</strong> ' + escapeHtmlCard(entry.status) + '</div>' +
    '<div><strong>Дата выбытия:</strong> ' + (formatDate(entry.exitDate) || '—') + '</div>' +
    '<div><strong>Начало сухостоя:</strong> ' + (formatDate(entry.dryStartDate) || '—') + '</div>' +
    '<div><strong>Дни лактации:</strong> ' + daysInLactStr + '</div>' +
    '<div><strong>ПДО (дней от отёла до 1-го осеменения):</strong> ' + pdoStr + '</div>' +
    '<div><strong>Дни стельности:</strong> ' + daysPregStr + '</div>' +
    '<div><strong>Протокол:</strong> ' + escapeHtmlCard((entry.protocol && entry.protocol.name) || entry.protocolName) + '</div>' +
    '<div><strong>Начало протокола:</strong> ' + (formatDate((entry.protocol && entry.protocol.startDate) || entry.protocolStartDate) || '—') + '</div>' +
    '<div><strong>Примечание:</strong> ' + escapeHtmlCard(entry.note) + '</div>' +
    '<div><strong>Синхронизация:</strong> ' + (entry.synced ? '✅' : '🟡') + '</div>' +
    '<div><strong>Дата добавления:</strong> ' + escapeHtmlCard(entry.dateAdded) + '</div>' +
    '<div><strong>Изменено пользователем:</strong> ' + escapeHtmlCard(entry.lastModifiedBy) + '</div>' +
    '</div>' +
    '<div id="viewCowInseminationHistory" class="cow-insemination-history" style="display:none;">' + historyTableHtml + '</div>' +
    '<div class="cow-card-actions">' +
    '<button type="button" onclick="editEntry(\'' + safeCattleId + '\');" class="small-btn" aria-label="Редактировать">✏️ Редактировать</button> ' +
    '<button type="button" onclick="window._prefillCattleId=\'' + safeCattleId + '\'; window._returnToViewCow=\'' + safeCattleId + '\'; navigate(\'dry\');" class="small-btn" aria-label="Запуск в сухостой">🐄 Запуск</button> ' +
    '<button type="button" onclick="window._prefillCattleId=\'' + safeCattleId + '\'; window._returnToViewCow=\'' + safeCattleId + '\'; navigate(\'calving\');" class="small-btn" aria-label="Отел">🐄 Отел</button> ' +
    '<button type="button" onclick="window._prefillCattleId=\'' + safeCattleId + '\'; window._returnToViewCow=\'' + safeCattleId + '\'; navigate(\'protocol-assign\');" class="small-btn" aria-label="Поставить на протокол">📋 Поставить на протокол</button> ' +
    '<button type="button" onclick="window._prefillCattleId=\'' + safeCattleId + '\'; window._returnToViewCow=\'' + safeCattleId + '\'; navigate(\'insemination\');" class="small-btn" aria-label="Осеменение">💉 Осеменение</button> ' +
    '<button type="button" onclick="window._prefillCattleId=\'' + safeCattleId + '\'; window._returnToViewCow=\'' + safeCattleId + '\'; navigate(\'uzi\');" class="small-btn" aria-label="УЗИ">🩺 УЗИ</button> ' +
    '<button type="button" onclick="openViewCowActionHistory(\'' + safeCattleId + '\');" class="small-btn" aria-label="История действий">📜 История</button> ' +
    '<button type="button" onclick="if(window.viewCowBack)window.viewCowBack()" class="small-btn cow-card-back" aria-label="Назад">← Назад</button>' +
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
  setTimeout(function () {
    var first = modal.querySelector('button, [href], input, [tabindex]:not([tabindex="-1"])');
    if (first) first.focus();
  }, 0);
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

/**
 * Собирает плоский список всех осеменений по всем животным (для экрана и экспорта)
 * Каждый элемент: { cattleId, nickname, lactation, date, attemptNumber, bull, inseminator, code, daysFromPrevious }
 */
function getAllInseminationsFlat() {
  var flat = [];
  var list = (typeof window !== 'undefined' && window.entries && Array.isArray(window.entries)) ? window.entries : [];
  for (var i = 0; i < list.length; i++) {
    var entry = list[i];
    var rows = getInseminationListForEntry(entry);
    for (var j = 0; j < rows.length; j++) {
      flat.push({
        cattleId: entry.cattleId || '',
        nickname: entry.nickname || '',
        lactation: (rows[j].lactation !== undefined && rows[j].lactation !== null) ? rows[j].lactation : (entry.lactation !== undefined && entry.lactation !== null) ? entry.lactation : '',
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
    var ta = parseInseminationDateToTime(a.date);
    var tb = parseInseminationDateToTime(b.date);
    if (isNaN(ta) && isNaN(tb)) return 0;
    if (isNaN(ta)) return 1;
    if (isNaN(tb)) return -1;
    return ta < tb ? -1 : ta > tb ? 1 : 0;
  });
  return flat;
}

var allInseminationsSortKey = 'date';
var allInseminationsSortDir = 'asc';
var allInseminationsFilter = { query: '', dateFrom: '', dateTo: '', lactation: null };

function getFilteredAllInseminations(flat) {
  if (!flat || !flat.length) return flat;
  var list = flat.slice();
  var q = (allInseminationsFilter.query || '').toLowerCase().trim();
  if (q) {
    list = list.filter(function (row) {
      var cattleId = (row.cattleId || '').toLowerCase();
      var nickname = (row.nickname || '').toLowerCase();
      var bull = (row.bull || '').toLowerCase();
      var code = (row.code || '').toLowerCase();
      var inseminator = (row.inseminator || '').toLowerCase();
      return cattleId.indexOf(q) !== -1 || nickname.indexOf(q) !== -1 ||
        bull.indexOf(q) !== -1 || code.indexOf(q) !== -1 || inseminator.indexOf(q) !== -1;
    });
  }
  if (allInseminationsFilter.dateFrom) {
    list = list.filter(function (row) { return (row.date || '') >= allInseminationsFilter.dateFrom; });
  }
  if (allInseminationsFilter.dateTo) {
    list = list.filter(function (row) { return (row.date || '') <= allInseminationsFilter.dateTo; });
  }
  if (allInseminationsFilter.lactation != null && allInseminationsFilter.lactation !== '') {
    var lact = parseInt(allInseminationsFilter.lactation, 10);
    if (!isNaN(lact)) {
      list = list.filter(function (row) { return (row.lactation !== undefined && parseInt(row.lactation, 10) === lact) || (row.lactation === lact); });
    }
  }
  return list;
}

function compareAllInseminationsRow(a, b, key, dir) {
  var mul = dir === 'asc' ? 1 : -1;
  var va = a[key];
  var vb = b[key];
  if (key === 'date') {
    var ta = parseInseminationDateToTime(va);
    var tb = parseInseminationDateToTime(vb);
    return mul * (ta - tb);
  }
  if (key === 'lactation' || key === 'attemptNumber') {
    var na = parseInt(va, 10);
    var nb = parseInt(vb, 10);
    if (isNaN(na)) na = 0;
    if (isNaN(nb)) nb = 0;
    return mul * (na - nb);
  }
  if (key === 'daysFromPrevious') {
    var na = (va !== '—' && va !== undefined && va !== null && va !== '') ? parseInt(va, 10) : -1;
    var nb = (vb !== '—' && vb !== undefined && vb !== null && vb !== '') ? parseInt(vb, 10) : -1;
    return mul * (na - nb);
  }
  var sa = (va != null ? String(va) : '').toLowerCase();
  var sb = (vb != null ? String(vb) : '').toLowerCase();
  return mul * sa.localeCompare(sb, 'ru');
}

function renderAllInseminationsFilterUI() {
  var container = document.getElementById('allInseminationsFilterContainer');
  if (!container) return;
  var q = (allInseminationsFilter.query || '').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  var lactVal = allInseminationsFilter.lactation !== null && allInseminationsFilter.lactation !== '' ? allInseminationsFilter.lactation : '';
  container.innerHTML =
    '<div class="search-filter-bar">' +
      '<div class="search-row">' +
        '<input type="text" id="allInsemSearchInput" class="search-input" placeholder="Поиск по номеру, кличке, быку, осеменителю..." value="' + q + '">' +
        '<button type="button" id="allInsemFilterClearBtn" class="small-btn">Сбросить фильтры</button>' +
      '</div>' +
      '<div class="filter-row">' +
        '<span class="filter-label">Период (дата осеменения):</span>' +
        '<input type="date" id="allInsemDateFrom" value="' + (allInseminationsFilter.dateFrom || '') + '"> — ' +
        '<input type="date" id="allInsemDateTo" value="' + (allInseminationsFilter.dateTo || '') + '">' +
        '<span class="filter-label">Лактация:</span>' +
        '<input type="number" id="allInsemFilterLactation" min="1" max="20" placeholder="—" value="' + lactVal + '">' +
      '</div>' +
    '</div>';
  var searchInput = document.getElementById('allInsemSearchInput');
  var clearBtn = document.getElementById('allInsemFilterClearBtn');
  var dateFrom = document.getElementById('allInsemDateFrom');
  var dateTo = document.getElementById('allInsemDateTo');
  var filterLact = document.getElementById('allInsemFilterLactation');
  function applyFilterAndRender() {
    allInseminationsFilter.query = searchInput ? searchInput.value.trim() : '';
    allInseminationsFilter.dateFrom = dateFrom ? dateFrom.value : '';
    allInseminationsFilter.dateTo = dateTo ? dateTo.value : '';
    allInseminationsFilter.lactation = filterLact && filterLact.value !== '' ? parseInt(filterLact.value, 10) : null;
    renderAllInseminationsScreen();
  }
  if (searchInput) {
    searchInput.addEventListener('input', function () { applyFilterAndRender(); });
    searchInput.addEventListener('keyup', function (e) { if (e.key === 'Enter') applyFilterAndRender(); });
  }
  if (clearBtn) {
    clearBtn.addEventListener('click', function () {
      allInseminationsFilter = { query: '', dateFrom: '', dateTo: '', lactation: null };
      if (searchInput) searchInput.value = '';
      if (dateFrom) dateFrom.value = '';
      if (dateTo) dateTo.value = '';
      if (filterLact) filterLact.value = '';
      renderAllInseminationsScreen();
      renderAllInseminationsFilterUI();
    });
  }
  [dateFrom, dateTo, filterLact].forEach(function (el) {
    if (el) el.addEventListener('change', applyFilterAndRender);
  });
}

/**
 * Заполняет экран «Все осеменения» таблицей по всем животным (с фильтром и сортировкой)
 */
function renderAllInseminationsScreen() {
  var container = document.getElementById('allInseminationsList');
  var filterContainer = document.getElementById('allInseminationsFilterContainer');
  if (!container) return;
  if (filterContainer && !filterContainer.dataset.rendered) {
    filterContainer.dataset.rendered = '1';
    renderAllInseminationsFilterUI();
  }
  var flat = getAllInseminationsFlat();
  var listToShow = getFilteredAllInseminations(flat);
  if (listToShow.length > 0 && allInseminationsSortKey) {
    listToShow = listToShow.slice();
    listToShow.sort(function (a, b) {
      return compareAllInseminationsRow(a, b, allInseminationsSortKey, allInseminationsSortDir);
    });
  }
  if (listToShow.length === 0) {
    if (container._pinchZoomDestroy) { try { container._pinchZoomDestroy(); } catch (e) {} container._pinchZoomDestroy = null; }
    container.innerHTML = '<p class="cow-insemination-empty">Нет данных об осеменениях.' + (flat.length > 0 ? ' Измените фильтры.' : '') + '</p>';
    return;
  }
  if (container._pinchZoomDestroy) { try { container._pinchZoomDestroy(); } catch (e) {} container._pinchZoomDestroy = null; }
  var sortAsc = allInseminationsSortDir === 'asc';
  var sortMark = function (key) {
    if (allInseminationsSortKey !== key) return '';
    return sortAsc ? ' <span class="sort-indicator" aria-hidden="true">▲</span>' : ' <span class="sort-indicator" aria-hidden="true">▼</span>';
  };
  var sortClass = function (key) {
    if (allInseminationsSortKey !== key) return '';
    return sortAsc ? ' sort-asc' : ' sort-desc';
  };
  var th = function (key, label) {
    return '<th class="sortable-th' + sortClass(key) + '" data-sort-key="' + String(key).replace(/"/g, '&quot;') + '" role="button" tabindex="0">' + (label || key) + sortMark(key) + '</th>';
  };
  var rows = listToShow.map(function (row) {
    var attrId = (row.cattleId || '').replace(/"/g, '&quot;');
    return '<tr class="all-insem-row" data-cattle-id="' + attrId + '" role="button" tabindex="0">' +
      '<td>' + escapeHtmlCard(row.cattleId) + '</td>' +
      '<td>' + escapeHtmlCard(row.nickname) + '</td>' +
      '<td>' + escapeHtmlCard((row.lactation !== undefined && row.lactation !== null && row.lactation !== '') || row.lactation === 0 ? row.lactation : '—') + '</td>' +
      '<td>' + (formatDate(row.date) || '—') + '</td>' +
      '<td>' + escapeHtmlCard(row.attemptNumber) + '</td>' +
      '<td>' + escapeHtmlCard(row.bull) + '</td>' +
      '<td>' + escapeHtmlCard(row.inseminator) + '</td>' +
      '<td>' + escapeHtmlCard(row.daysFromPrevious) + '</td>' +
      '<td>' + escapeHtmlCard(row.code) + '</td>' +
      '</tr>';
  }).join('');
  container.innerHTML =
    '<table class="cow-insemination-table all-inseminations-table">' +
    '<thead><tr>' +
    th('cattleId', 'Номер коровы') + th('nickname', 'Кличка') + th('lactation', 'Лактация') + th('date', 'Дата осеменения') +
    th('attemptNumber', 'Попытка') + th('bull', 'Бык') + th('inseminator', 'Техник ИО') +
    th('daysFromPrevious', 'Дней от предыдущего') + th('code', 'Код') +
    '</tr></thead><tbody>' + rows + '</tbody></table>';
  container.querySelectorAll('.all-insem-row').forEach(function (tr) {
    var id = tr.getAttribute('data-cattle-id');
    if (id) tr.addEventListener('click', function () { viewCow(id); });
  });
  container.querySelectorAll('.all-inseminations-table th[data-sort-key]').forEach(function (thEl) {
    thEl.addEventListener('click', function () {
      var key = thEl.getAttribute('data-sort-key');
      if (!key) return;
      if (allInseminationsSortKey === key) allInseminationsSortDir = allInseminationsSortDir === 'asc' ? 'desc' : 'asc';
      else { allInseminationsSortKey = key; allInseminationsSortDir = 'asc'; }
      renderAllInseminationsScreen();
    });
    thEl.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        thEl.click();
      }
    });
  });
  if (typeof window.initPinchZoom === 'function') container._pinchZoomDestroy = window.initPinchZoom(container, { innerSelector: 'table', minScale: 0.7, maxScale: 1.5 });
}

/** Возврат с карточки: в уведомления или в список животных */
function viewCowBack() {
  var returnTo = (typeof window !== 'undefined' && window._viewCowReturnTo) ? window._viewCowReturnTo : null;
  if (typeof window !== 'undefined') window._viewCowReturnTo = null;
  if (returnTo && typeof navigate === 'function') navigate(returnTo);
  else if (typeof navigate === 'function') navigate('view');
}

// Список записей с групповым выделением рисуется в menu.js (updateViewList).
// Открытие карточки животного — по кнопке «Карточка» в строке или по вызову viewCow(cattleId).
if (typeof window !== 'undefined') {
  window.renderAllInseminationsScreen = renderAllInseminationsScreen;
  window.viewCow = viewCow;
  window.viewCowBack = viewCowBack;
  window.toggleViewCowInseminationHistory = toggleViewCowInseminationHistory;
  window.openViewCowActionHistory = openViewCowActionHistory;
}
export {};
