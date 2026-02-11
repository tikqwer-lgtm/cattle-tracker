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

  // Перейти на экран просмотра карточки (с cattleId для роутинга)
  navigate('view-cow', { cattleId: cattleId });

  // Заполнить карточку
  const card = document.getElementById('viewCowCard');
  if (!card) return;

  var pdoVal = getPDO(entry);
  var pdoStr = (pdoVal === '—' || pdoVal === '') ? '—' : String(pdoVal);
  var daysPreg = getDaysPregnant(entry);
  var daysPregStr = (daysPreg === null || daysPreg === undefined) ? '—' : String(daysPreg);

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
    '<button type="button" onclick="window._prefillCattleId=\'' + safeCattleId + '\'; navigate(\'dry\');" class="small-btn" aria-label="Запуск в сухостой">🐄 Запуск</button> ' +
    '<button type="button" onclick="window._prefillCattleId=\'' + safeCattleId + '\'; navigate(\'calving\');" class="small-btn" aria-label="Отел">🐄 Отел</button> ' +
    '<button type="button" onclick="window._prefillCattleId=\'' + safeCattleId + '\'; navigate(\'protocol-assign\');" class="small-btn" aria-label="Поставить на протокол">📋 Поставить на протокол</button> ' +
    '<button type="button" onclick="window._prefillCattleId=\'' + safeCattleId + '\'; navigate(\'uzi\');" class="small-btn" aria-label="УЗИ">🩺 УЗИ</button> ' +
    '<button type="button" onclick="openViewCowActionHistory(\'' + safeCattleId + '\');" class="small-btn" aria-label="История действий">📜 История</button> ' +
    '<button type="button" onclick="navigate(\'view\')" class="small-btn cow-card-back" aria-label="Назад к списку">← Назад к списку</button>' +
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
 * Заполняет экран «Все осеменения» таблицей по всем животным
 */
function renderAllInseminationsScreen() {
  var container = document.getElementById('allInseminationsList');
  if (!container) return;
  var flat = getAllInseminationsFlat();
  if (flat.length === 0) {
    container.innerHTML = '<p class="cow-insemination-empty">Нет данных об осеменениях.</p>';
    return;
  }
  var rows = flat.map(function (row) {
    var attrId = (row.cattleId || '').replace(/"/g, '&quot;');
    return '<tr class="all-insem-row" data-cattle-id="' + attrId + '" role="button" tabindex="0">' +
      '<td>' + escapeHtmlCard(row.cattleId) + '</td>' +
      '<td>' + escapeHtmlCard(row.nickname) + '</td>' +
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
    '<thead><tr><th>Номер коровы</th><th>Кличка</th><th>Дата осеменения</th><th>Попытка</th><th>Бык</th><th>Осеменитель</th><th>Дней от предыдущего</th><th>Код</th></tr></thead>' +
    '<tbody>' + rows + '</tbody></table>';
  container.querySelectorAll('.all-insem-row').forEach(function (tr) {
    var id = tr.getAttribute('data-cattle-id');
    if (id) {
      tr.addEventListener('click', function () { viewCow(id); });
    }
  });
}

// Список записей с групповым выделением рисуется в menu.js (updateViewList).
// Открытие карточки животного — по кнопке «Карточка» в строке или по вызову viewCow(cattleId).
