/** __viewCow part 3 */
(function () {
  'use strict';
  var root = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this);
  var NS = root['__viewCow'] = root['__viewCow'] || {};
  var global = typeof window !== 'undefined' ? window : this;

function renderAllInseminationsScreen() {
  var vc = globalThis['__viewCow'];
  var sortKey = vc.allInseminationsSortKey || 'date';
  var sortDir = vc.allInseminationsSortDir || 'asc';
  var container = vc.getAllInseminationsListContainer();
  if (!container) return;
  var flat = vc.getAllInseminationsFlat();
  var listToShow = flat;
  if (listToShow.length > 0 && sortKey) {
    listToShow = listToShow.slice();
    listToShow.sort(function (a, b) {
      return vc.compareAllInseminationsRow(a, b, sortKey, sortDir);
    });
  }
  if (listToShow.length === 0) {
    if (container._pinchZoomDestroy) { try { container._pinchZoomDestroy(); } catch (e) {} container._pinchZoomDestroy = null; }
    container.innerHTML = '<p class="cow-insemination-empty">Нет данных об осеменениях.</p>';
    return;
  }
  if (container._pinchZoomDestroy) { try { container._pinchZoomDestroy(); } catch (e) {} container._pinchZoomDestroy = null; }
  var sortAsc = sortDir === 'asc';
  var sortMark = function (key) {
    if (sortKey !== key) return '';
    return sortAsc ? ' <span class="sort-indicator" aria-hidden="true">▲</span>' : ' <span class="sort-indicator" aria-hidden="true">▼</span>';
  };
  var sortClass = function (key) {
    if (sortKey !== key) return '';
    return sortAsc ? ' sort-asc' : ' sort-desc';
  };
  var th = function (key, label) {
    return '<th class="sortable-th' + sortClass(key) + '" data-sort-key="' + String(key).replace(/"/g, '&quot;') + '" role="button" tabindex="0">' + (label || key) + sortMark(key) + '</th>';
  };
  var rows = listToShow.map(function (row) {
    var attrId = (row.cattleId || '').replace(/"/g, '&quot;');
    return '<tr class="all-insem-row" data-cattle-id="' + attrId + '" role="button" tabindex="0">' +
      '<td>' + globalThis['__viewCow'].escapeHtmlCard(row.cattleId) + '</td>' +
      '<td>' + globalThis['__viewCow'].escapeHtmlCard(row.nickname) + '</td>' +
      '<td>' + globalThis['__viewCow'].escapeHtmlCard((row.lactation !== undefined && row.lactation !== null && row.lactation !== '') || row.lactation === 0 ? row.lactation : '—') + '</td>' +
      '<td>' + (formatDate(row.date) || '—') + '</td>' +
      '<td>' + globalThis['__viewCow'].escapeHtmlCard(row.attemptNumber) + '</td>' +
      '<td>' + globalThis['__viewCow'].escapeHtmlCard(row.bull) + '</td>' +
      '<td>' + globalThis['__viewCow'].escapeHtmlCard(row.inseminator) + '</td>' +
      '<td>' + globalThis['__viewCow'].escapeHtmlCard(row.daysFromPrevious) + '</td>' +
      '<td>' + globalThis['__viewCow'].escapeHtmlCard(row.code) + '</td>' +
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
    if (id) tr.addEventListener('click', function () { globalThis['__viewCow'].viewCow(id); });
  });
  container.querySelectorAll('.all-inseminations-table th[data-sort-key]').forEach(function (thEl) {
    thEl.addEventListener('click', function () {
      var key = thEl.getAttribute('data-sort-key');
      if (!key) return;
      if (sortKey === key) {
        vc.allInseminationsSortDir = sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        vc.allInseminationsSortKey = key;
        vc.allInseminationsSortDir = 'asc';
      }
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

function isAllInseminationsJournalActive() {
  var listScreen = document.getElementById('list-insemination-screen');
  var allScreen = document.getElementById('all-inseminations-screen');
  return (listScreen && listScreen.classList.contains('active')) ||
    (allScreen && allScreen.classList.contains('active'));
}

function initAllInseminationsJournalRefresh() {
  if (initAllInseminationsJournalRefresh._done) return;
  initAllInseminationsJournalRefresh._done = true;
  if (typeof global.CattleTrackerEvents === 'undefined' || typeof global.CattleTrackerEvents.on !== 'function') return;
  global.CattleTrackerEvents.on('entries:updated', function () {
    if (!isAllInseminationsJournalActive()) return;
    renderAllInseminationsScreen();
  });
}

initAllInseminationsJournalRefresh();

/** Возврат с карточки: на экран-источник, по стеку или в список животных */
function viewCowBack() {
  var returnTo = (typeof window !== 'undefined' && window._viewCowReturnTo) ? window._viewCowReturnTo : null;
  if (typeof window !== 'undefined') window._viewCowReturnTo = null;
  if (returnTo && typeof navigate === 'function') {
    navigate(returnTo);
    return;
  }
  if (typeof navigateBack === 'function' && navigateBack()) return;
  if (typeof navigate === 'function') navigate('view');
}

// Список записей с групповым выделением рисуется в menu.js (updateViewList).
// Открытие карточки животного — по кнопке «Карточка» в строке или по вызову globalThis['__viewCow'].viewCow(cattleId).

  // register functions
  NS.renderAllInseminationsScreen = renderAllInseminationsScreen;
  NS.initAllInseminationsJournalRefresh = initAllInseminationsJournalRefresh;
  NS.viewCowBack = viewCowBack;
})();
export {};
