/** __menu part 3 */
(function () {
  'use strict';
  var root = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this);
  var NS = root['__menu'] = root['__menu'] || {};
  var global = typeof window !== 'undefined' ? window : this;

function updateObjectSwitcher() {
  var select = document.getElementById('currentObjectSelect');
  var addBtn = document.getElementById('addObjectBtn');
  var editBtn = document.getElementById('editObjectBtn');
  var deleteBtn = document.getElementById('deleteObjectBtn');
  if (!select) return;
  var list = typeof getObjectsList === 'function' ? getObjectsList() : null;
  if (!list || list.length === 0) {
    if (typeof ensureObjectsAndMigration === 'function') ensureObjectsAndMigration();
    list = typeof getObjectsList === 'function' ? getObjectsList() : [{ id: 'default', name: 'Основная база' }];
  }
  var currentId = typeof getCurrentObjectId === 'function' ? getCurrentObjectId() : 'default';
  var pendingId = typeof window !== 'undefined' && window.CattleTrackerApi && window.CattleTrackerApi.PENDING_OBJECT_ID;
  if ((!list || list.length === 0) && pendingId && typeof setCurrentObjectId === 'function' && currentId !== pendingId) {
    setCurrentObjectId(pendingId);
    currentId = pendingId;
  }
  var htmlOpts = '';
  if (pendingId && currentId === pendingId) {
    htmlOpts += '<option value="' + String(pendingId).replace(/"/g, '&quot;') + '" selected>— Выберите базу (Синхронизация) —</option>';
  }
  htmlOpts += list.map(function (obj) {
    var name = (obj.name || obj.id || '').replace(/</g, '&lt;').replace(/"/g, '&quot;');
    var sel = obj.id === currentId && currentId !== pendingId ? ' selected' : '';
    return '<option value="' + (obj.id || '').replace(/"/g, '&quot;') + '"' + sel + '>' + name + '</option>';
  }).join('');
  select.innerHTML = htmlOpts;
  var user = (typeof getCurrentUser === 'function') ? getCurrentUser() : null;
  var viewer = user && user.role === 'viewer';
  var useApi = window.CATTLE_TRACKER_USE_API;
  var isApiAdmin = useApi && user && (user.role === 'admin' || user.role === 'manager');
  var isApiOperator = useApi && user && user.role === 'operator';
  var showObjCrud = !viewer && (!useApi || (typeof canAdd === 'function' && canAdd()));
  var mobileApi = useApi && typeof window.isMobile === 'function' && window.isMobile();
  if (addBtn) addBtn.style.display = !viewer && (!useApi || isApiAdmin) && !mobileApi ? '' : 'none';
  if (editBtn) editBtn.style.display = !viewer && (!useApi || isApiAdmin || isApiOperator) ? '' : 'none';
  if (deleteBtn) {
    var showDeleteBtn = useApi ? (isApiAdmin && !viewer) : showObjCrud;
    deleteBtn.style.display = showDeleteBtn ? '' : 'none';
    deleteBtn.disabled = (select.value === 'default' || (pendingId && select.value === pendingId));
  }
  select.onchange = function () {
    var id = select.value;
    if (pendingId && id === pendingId) return;
    if (deleteBtn) deleteBtn.disabled = (id === 'default');
    if (id && typeof switchToObject === 'function') switchToObject(id);
  };
  if (addBtn && !addBtn.getAttribute('onclick')) {
    addBtn.onclick = function () { globalThis['__menu'].handleAddObjectClick(); };
  }
}

var _menuCalvingMonthOffset = 0;
var _menuCalvingListsOpen = false;

function formatCalvingMonthLabel(year, month) {
  try {
    var d = new Date(year, month, 1);
    return d.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
  } catch (e) {
    return year + '-' + (month + 1);
  }
}

function updateMenuCalvingForecast() {
  var block = document.getElementById('menuCalvingForecast');
  if (!block) return;
  var now = new Date();
  var viewDate = new Date(now.getFullYear(), now.getMonth() + _menuCalvingMonthOffset, 1);
  var year = viewDate.getFullYear();
  var month = viewDate.getMonth();
  var labelEl = document.getElementById('menuCalvingMonthLabel');
  var planEl = document.getElementById('menuCalvingPlanCount');
  var factEl = document.getElementById('menuCalvingFactCount');
  var warnEl = document.getElementById('menuCalvingWarning');
  var planList = document.getElementById('menuCalvingPlanList');
  var factList = document.getElementById('menuCalvingFactList');
  var listsWrap = document.getElementById('menuCalvingLists');
  var toggleBtn = document.getElementById('menuCalvingToggle');

  if (labelEl) labelEl.textContent = formatCalvingMonthLabel(year, month);

  var list = (typeof getVisibleEntries === 'function') ? getVisibleEntries(window.entries || []) : (window.entries || []);
  var stats = typeof getCalvingStatsForMonth === 'function'
    ? getCalvingStatsForMonth(list, year, month, now)
    : { plan: { count: 0, items: [] }, fact: { count: 0, items: [], hasDataErrors: false } };

  if (planEl) planEl.textContent = String(stats.plan.count);
  if (factEl) factEl.textContent = String(stats.fact.count);

  if (warnEl) {
    if (stats.fact.hasDataErrors) {
      warnEl.hidden = false;
      warnEl.textContent = 'Факт содержит даты отёла в будущем — проверьте карточки (см. уведомления «Ошибки»).';
    } else {
      warnEl.hidden = true;
      warnEl.textContent = '';
    }
  }

  function esc(s) {
    return String(s || '').replace(/</g, '&lt;');
  }

  if (planList) {
    if (!stats.plan.items.length) {
      planList.innerHTML = '<li class="menu-calving-list-empty">Нет записей</li>';
    } else {
      planList.innerHTML = stats.plan.items.map(function (it) {
        var nick = it.nickname ? ' (' + globalThis['__menu'].esc(it.nickname) + ')' : '';
        var overdue = it.overdue ? ', просрочено' : '';
        return '<li>№' + globalThis['__menu'].esc(it.cattleId) + ' — ' + globalThis['__menu'].esc(it.expectedDate) + nick + overdue + '</li>';
      }).join('');
    }
  }

  if (factList) {
    if (!stats.fact.items.length) {
      factList.innerHTML = '<li class="menu-calving-list-empty">Нет записей</li>';
    } else {
      factList.innerHTML = stats.fact.items.map(function (it) {
        var nick = it.nickname ? ' (' + globalThis['__menu'].esc(it.nickname) + ')' : '';
        var err = it.dataError ? ', ошибка даты' : '';
        return '<li class="' + (it.dataError ? 'menu-calving-list-error' : '') + '">№' + globalThis['__menu'].esc(it.cattleId) + ' — ' + globalThis['__menu'].esc(it.calvingDate) + nick + err + '</li>';
      }).join('');
    }
  }

  if (listsWrap) listsWrap.hidden = !_menuCalvingListsOpen;
  if (toggleBtn) {
    toggleBtn.setAttribute('aria-expanded', _menuCalvingListsOpen ? 'true' : 'false');
    toggleBtn.textContent = _menuCalvingListsOpen ? 'Скрыть списки' : 'Показать списки';
  }
}

function initMenuCalvingForecast() {
  if (document.getElementById('menuCalvingForecast') && document.getElementById('menuCalvingForecast').dataset.inited === '1') {
    updateMenuCalvingForecast();
    return;
  }
  var prev = document.getElementById('menuCalvingPrev');
  var next = document.getElementById('menuCalvingNext');
  var toggle = document.getElementById('menuCalvingToggle');
  var block = document.getElementById('menuCalvingForecast');
  if (block) block.dataset.inited = '1';
  if (prev) {
    prev.addEventListener('click', function () {
      _menuCalvingMonthOffset -= 1;
      updateMenuCalvingForecast();
    });
  }
  if (next) {
    next.addEventListener('click', function () {
      _menuCalvingMonthOffset += 1;
      updateMenuCalvingForecast();
    });
  }
  if (toggle) {
    toggle.addEventListener('click', function () {
      _menuCalvingListsOpen = !_menuCalvingListsOpen;
      updateMenuCalvingForecast();
    });
  }
  if (typeof window.CattleTrackerEvents !== 'undefined' && typeof window.CattleTrackerEvents.on === 'function') {
    window.CattleTrackerEvents.on('entries:updated', function () {
      updateMenuCalvingForecast();
    });
  }
  updateMenuCalvingForecast();
}

/**
 * Обновляет статистику стада на главном экране
 */
function updateHerdStats() {
  var list = (typeof getVisibleEntries === 'function') ? getVisibleEntries(window.entries || []) : (window.entries || []);
  var pct = function (n, total) {
    if (!total) return 0;
    return Math.round((n / total) * 100);
  };
  function setText(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
  }
  if (!list || list.length === 0) {
    setText('totalCows', '0');
    setText('pregnantCows', '0');
    setText('dryCows', '0');
    setText('inseminatedCows', '0');
    setText('cullCows', '0');
    setText('notInseminatedCows', '0');
    setText('pregnantCowsPct', '0%');
    setText('dryCowsPct', '0%');
    setText('inseminatedCowsPct', '0%');
    setText('cullCowsPct', '0%');
    setText('notInseminatedCowsPct', '0%');
    updateMenuCalvingForecast();
    return;
  }

  const totalCows = list.length;
  const pregnantCows = list.filter(e => e.status && e.status.includes('Стельная')).length;
  const dryCows = list.filter(e => e.status && e.status.includes('Сухостой')).length;
  const inseminatedCows = list.filter(e => e.status && (e.status.includes('Осеменен') || (e.status.toLowerCase && e.status.toLowerCase().includes('осеменен')))).length;
  const cullCows = list.filter(e => e.status && (e.status.toLowerCase ? e.status.toLowerCase().includes('брак') : e.status.includes('Брак'))).length;
  const notInseminatedCows = list.filter(e => !e.status || (e.status && (e.status.toLowerCase ? e.status.toLowerCase().includes('холостая') : e.status.includes('Холостая')))).length;

  setText('totalCows', String(totalCows));
  setText('pregnantCows', String(pregnantCows));
  setText('dryCows', String(dryCows));
  setText('inseminatedCows', String(inseminatedCows));
  setText('cullCows', String(cullCows));
  setText('notInseminatedCows', String(notInseminatedCows));

  setText('pregnantCowsPct', pct(pregnantCows, totalCows) + '%');
  setText('dryCowsPct', pct(dryCows, totalCows) + '%');
  setText('inseminatedCowsPct', pct(inseminatedCows, totalCows) + '%');
  setText('cullCowsPct', pct(cullCows, totalCows) + '%');
  setText('notInseminatedCowsPct', pct(notInseminatedCows, totalCows) + '%');
  updateMenuCalvingForecast();
}

function initAddObjectModal() {
  var modal = document.getElementById('addObjectModal');
  var input = document.getElementById('addObjectNameInput');
  var closeBtn = document.getElementById('addObjectModalCloseBtn');
  var cancelBtn = document.getElementById('addObjectModalCancelBtn');
  var okBtn = document.getElementById('addObjectModalOkBtn');
  if (!modal || !input || modal.dataset.inited === '1') return;
  modal.dataset.inited = '1';
  function close() { globalThis['__menu'].hideAddObjectModal(); }
  if (closeBtn) closeBtn.addEventListener('click', close);
  if (cancelBtn) cancelBtn.addEventListener('click', close);
  if (okBtn) okBtn.addEventListener('click', function () { globalThis['__menu'].confirmAddObject(); });
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); globalThis['__menu'].confirmAddObject(); }
    if (e.key === 'Escape') { e.preventDefault(); globalThis['__menu'].close(); }
  });
  modal.addEventListener('click', function (e) {
    if (e.target === modal) globalThis['__menu'].close();
  });
}

function routeInitialScreenAfterSession(session) {
  var useApi = typeof window !== 'undefined' && window.CATTLE_TRACKER_USE_API;
  var loggedIn = session && session.status === 'loggedIn';
  if (useApi) {
    if (loggedIn) {
      globalThis['__menu'].syncRouteToScreen();
    } else {
      globalThis['__menu'].navigate('auth');
    }
    return;
  }
  var currentUser = (typeof getCurrentUser === 'function') ? getCurrentUser() : null;
  if (currentUser) {
    globalThis['__menu'].syncRouteToScreen();
  } else {
    globalThis['__menu'].navigate('auth');
  }
}

document.addEventListener('DOMContentLoaded', function () {
  initAddObjectModal();
  if (typeof window.restoreApiSession === 'function') {
    window.restoreApiSession().then(function (session) {
      routeInitialScreenAfterSession(session);
    }).catch(function () {
      globalThis['__menu'].navigate('auth');
    });
  } else {
    routeInitialScreenAfterSession(null);
  }
});

  // register functions
  NS.updateObjectSwitcher = updateObjectSwitcher;
  NS.formatCalvingMonthLabel = formatCalvingMonthLabel;
  NS.updateMenuCalvingForecast = updateMenuCalvingForecast;
  NS.initMenuCalvingForecast = initMenuCalvingForecast;
  NS.updateHerdStats = updateHerdStats;
  NS.initAddObjectModal = initAddObjectModal;
  NS.routeInitialScreenAfterSession = routeInitialScreenAfterSession;
})();
export {};
