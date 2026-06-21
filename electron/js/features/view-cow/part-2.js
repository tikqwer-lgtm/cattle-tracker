/** __viewCow part 2 */
(function () {
  'use strict';
  var root = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this);
  var NS = root['__viewCow'] = root['__viewCow'] || {};
  var global = typeof window !== 'undefined' ? window : this;

function viewCowSaveStallFromCard(cattleId) {
  var entry = entries.find(function (e) { return e.cattleId === cattleId; });
  if (!entry) return;
  var yIn = document.getElementById('viewCowStallYard');
  var rIn = document.getElementById('viewCowStallRow');
  var pIn = document.getElementById('viewCowStallPlace');
  var yard = yIn && yIn.value != null ? String(yIn.value).trim() : '';
  var rs = rIn && rIn.value != null ? String(rIn.value).trim() : '';
  var ps = pIn && pIn.value != null ? String(pIn.value).trim() : '';
  var row = rs === '' ? NaN : parseInt(rs, 10);
  var place = ps === '' ? NaN : parseInt(ps, 10);
  var prevOther = null;
  if (yard === '' && rs === '' && ps === '') {
    entry.stallYard = '';
    entry.stallRow = '';
    entry.stallPlace = '';
  } else {
    if (!yard || !Number.isFinite(row) || row < 1 || !Number.isFinite(place) || place < 1) {
      if (typeof showToast === 'function') showToast('Укажите двор, ряд и место (числа ≥ 1) или очистите все поля', 'error');
      return;
    }
    var list = typeof window.entries !== 'undefined' && Array.isArray(window.entries) ? window.entries : [];
    prevOther = list.filter(function (e) {
      if (!e || e.cattleId === cattleId) return false;
      var ey = e.stallYard != null && String(e.stallYard).trim() !== '' ? String(e.stallYard).trim() : '';
      var er = e.stallRow;
      var ep = e.stallPlace;
      if (ey !== yard) return false;
      if (parseInt(er, 10) !== row) return false;
      if (parseInt(ep, 10) !== place) return false;
      return true;
    })[0];
    if (prevOther) {
      prevOther.stallYard = '';
      prevOther.stallRow = '';
      prevOther.stallPlace = '';
      prevOther.synced = false;
    }
    entry.stallYard = yard;
    entry.stallRow = row;
    entry.stallPlace = place;
  }
  entry.synced = false;
  if (typeof saveLocally === 'function') saveLocally();
  var useApi =
    typeof window.CATTLE_TRACKER_USE_API !== 'undefined' &&
    window.CATTLE_TRACKER_USE_API &&
    typeof window.updateEntryViaApi === 'function';
  function doneOk() {
    if (typeof showToast === 'function') showToast('Стойломесто сохранено', 'success');
    globalThis['__viewCow'].viewCow(cattleId);
  }
  if (!useApi) {
    globalThis['__viewCow'].doneOk();
    return;
  }
  var apiPromises = [];
  if (prevOther) apiPromises.push(window.updateEntryViaApi(prevOther.cattleId, prevOther));
  apiPromises.push(window.updateEntryViaApi(cattleId, entry));
  Promise.all(apiPromises)
    .then(function () {
      globalThis['__viewCow'].doneOk();
    })
    .catch(function (err) {
      if (typeof showToast === 'function') showToast(err && err.message ? err.message : 'Ошибка сохранения', 'error');
    });
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
    var dt = globalThis['__viewCow'].escapeHtmlCard(item.dateTime);
    var user = globalThis['__viewCow'].escapeHtmlCard(item.userName);
    var action = globalThis['__viewCow'].escapeHtmlCard(item.action);
    var details = globalThis['__viewCow'].escapeHtmlCard(item.details);
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
    var rows = globalThis['__viewCow'].getInseminationListForEntry(entry);
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
    var ta = globalThis['__viewCow'].parseInseminationDateToTime(a.date);
    var tb = globalThis['__viewCow'].parseInseminationDateToTime(b.date);
    if (isNaN(ta) && isNaN(tb)) return 0;
    if (isNaN(ta)) return 1;
    if (isNaN(tb)) return -1;
    return ta < tb ? -1 : ta > tb ? 1 : 0;
  });
  return flat;
}

var allInseminationsSortKey = 'date';
var allInseminationsSortDir = 'asc';
NS.allInseminationsSortKey = allInseminationsSortKey;
NS.allInseminationsSortDir = allInseminationsSortDir;
var _allInsemRenderTarget = null;

function setAllInseminationsRenderTarget(listEl) {
  _allInsemRenderTarget = listEl || null;
}

function resetAllInseminationsRenderTarget() {
  _allInsemRenderTarget = null;
}

function getAllInseminationsListContainer() {
  if (_allInsemRenderTarget) return _allInsemRenderTarget;
  return document.getElementById('allInseminationsList');
}

function compareAllInseminationsRow(a, b, key, dir) {
  var mul = dir === 'asc' ? 1 : -1;
  var va = a[key];
  var vb = b[key];
  if (key === 'date') {
    var ta = globalThis['__viewCow'].parseInseminationDateToTime(va);
    var tb = globalThis['__viewCow'].parseInseminationDateToTime(vb);
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

/**
 * Заполняет экран «Все осеменения» таблицей по всем животным (хронологический журнал)
 */

  // register functions
  NS.viewCowSaveStallFromCard = viewCowSaveStallFromCard;
  NS.toggleViewCowInseminationHistory = toggleViewCowInseminationHistory;
  NS.openViewCowActionHistory = openViewCowActionHistory;
  NS.closeViewCowActionHistoryModal = closeViewCowActionHistoryModal;
  NS.renderViewCowActionHistoryModal = renderViewCowActionHistoryModal;
  NS.deleteActionHistoryItem = deleteActionHistoryItem;
  NS.getAllInseminationsFlat = getAllInseminationsFlat;
  NS.compareAllInseminationsRow = compareAllInseminationsRow;
  NS.setAllInseminationsRenderTarget = setAllInseminationsRenderTarget;
  NS.resetAllInseminationsRenderTarget = resetAllInseminationsRenderTarget;
  NS.getAllInseminationsListContainer = getAllInseminationsListContainer;
})();
export {};
