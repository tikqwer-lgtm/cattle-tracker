/** __menu part 3 */
(function () {
  'use strict';
  var root = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this);
  var NS = root['__menu'] = root['__menu'] || {};
  var global = typeof window !== 'undefined' ? window : this;

function updateMenuEmptyObjectState(list, currentId, pendingId) {
  var emptyEl = document.getElementById('menu-no-object-state');
  var mainEl = document.getElementById('menu-main-content');
  var msgEl = document.getElementById('menu-no-object-message');
  var createBtn = document.getElementById('menuCreateObjectEmptyBtn');
  var syncBtn = document.getElementById('menuSyncEmptyBtn');
  var logoutBtn = document.getElementById('menuLogoutEmptyBtn');
  var user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
  var isAdmin = typeof hasCapability === 'function' && hasCapability('createDeleteObjects', user);
  var realList = (list || []).filter(function (o) {
    return o && o.id && !(pendingId && o.id === pendingId);
  });
  var noObjects = realList.length === 0;
  if (emptyEl) emptyEl.hidden = !noObjects;
  if (mainEl) {
    if (noObjects) {
      mainEl.setAttribute('hidden', '');
      mainEl.style.display = 'none';
    } else {
      mainEl.removeAttribute('hidden');
      mainEl.style.display = '';
    }
  }
  if (msgEl) {
    if (isAdmin) {
      msgEl.hidden = true;
      msgEl.textContent = '';
    } else {
      msgEl.hidden = false;
      msgEl.textContent = 'Ожидается подключение объекта администратором. Можно выбрать базу в «Синхронизация» или выйти из аккаунта.';
    }
  }
  if (createBtn) createBtn.style.display = noObjects && isAdmin ? '' : 'none';
  if (syncBtn) syncBtn.style.display = noObjects ? '' : 'none';
  if (logoutBtn) logoutBtn.style.display = noObjects ? '' : 'none';
  var screen = document.getElementById('menu-screen');
  if (screen) {
    if (noObjects) screen.classList.add('menu-screen--no-object');
    else screen.classList.remove('menu-screen--no-object');
  }
}

function updateObjectSwitcher() {
  var select = document.getElementById('currentObjectSelect');
  var addBtn = document.getElementById('addObjectBtn');
  var editBtn = document.getElementById('editObjectBtn');
  var deleteBtn = document.getElementById('deleteObjectBtn');
  if (!select) return;
  var list = typeof getObjectsList === 'function' ? getObjectsList() : [];
  if (!list) list = [];
  var currentId = typeof getCurrentObjectId === 'function' ? getCurrentObjectId() : '';
  var pendingId = typeof window !== 'undefined' && window.CattleTrackerApi && window.CattleTrackerApi.PENDING_OBJECT_ID;
  var realList = list.filter(function (o) {
    return o && o.id && !(pendingId && o.id === pendingId);
  });

  if (realList.length === 0) {
    if (pendingId && typeof setCurrentObjectId === 'function' && currentId !== pendingId) {
      setCurrentObjectId(pendingId);
      currentId = pendingId;
    }
    select.innerHTML = '';
    if (typeof globalThis['__menu'].updateMenuEmptyObjectState === 'function') {
      globalThis['__menu'].updateMenuEmptyObjectState([], currentId, pendingId);
    }
    return;
  }

  if (pendingId && currentId === pendingId && typeof setCurrentObjectId === 'function') {
    setCurrentObjectId(realList[0].id);
    currentId = realList[0].id;
  }

  var htmlOpts = realList.map(function (obj) {
    var name = (obj.name || obj.id || '').replace(/</g, '&lt;').replace(/"/g, '&quot;');
    var sel = obj.id === currentId ? ' selected' : '';
    return '<option value="' + (obj.id || '').replace(/"/g, '&quot;') + '"' + sel + '>' + name + '</option>';
  }).join('');
  select.innerHTML = htmlOpts;
  var user = (typeof getCurrentUser === 'function') ? getCurrentUser() : null;
  var canCreateDelete = typeof hasCapability === 'function' ? hasCapability('createDeleteObjects', user) : false;
  var useApi = window.CATTLE_TRACKER_USE_API;
  var mobileApi = useApi && typeof window.isMobile === 'function' && window.isMobile();
  if (addBtn) addBtn.style.display = canCreateDelete && !mobileApi ? '' : 'none';
  if (editBtn) editBtn.style.display = canCreateDelete ? '' : 'none';
  if (deleteBtn) {
    deleteBtn.style.display = canCreateDelete ? '' : 'none';
    deleteBtn.disabled = false;
    if (!deleteBtn.dataset.deleteBound) {
      deleteBtn.dataset.deleteBound = '1';
      deleteBtn.addEventListener('click', function (ev) {
        ev.preventDefault();
        if (typeof globalThis['__menu'].handleDeleteObjectClick === 'function') {
          globalThis['__menu'].handleDeleteObjectClick();
        } else if (typeof window.handleDeleteObjectClick === 'function') {
          window.handleDeleteObjectClick();
        }
      });
    }
  }
  select.onchange = function () {
    var id = select.value;
    if (pendingId && id === pendingId) return;
    if (id && typeof switchToObject === 'function') switchToObject(id);
  };
  if (addBtn && !addBtn.getAttribute('onclick')) {
    addBtn.onclick = function () { globalThis['__menu'].handleAddObjectClick(); };
  }
  if (typeof globalThis['__menu'].updateMenuEmptyObjectState === 'function') {
    globalThis['__menu'].updateMenuEmptyObjectState(realList, currentId, pendingId);
  }
}

function updateMenuGroupVisibility() {
  var user = (typeof getCurrentUser === 'function') ? getCurrentUser() : null;
  var canEvents = typeof hasCapability === 'function' ? hasCapability('eventsInput', user) : true;
  var canNotifications = typeof hasCapability === 'function' ? hasCapability('notifications', user) : true;
  var canAnalytics = typeof hasCapability === 'function' ? hasCapability('analytics', user) : true;
  var canFarmSettings = typeof hasCapability === 'function' ? hasCapability('farmCardSettings', user) : true;
  var canFarmView = typeof hasCapability === 'function' ? hasCapability('farmCardView', user) : true;
  var canAdmin = typeof hasCapability === 'function' ? hasCapability('adminUsersRoles', user) : false;
  var canSettings = canFarmSettings || canFarmView || canAdmin;

  function setGroupVisible(fragment, visible) {
    var btn = document.querySelector("button.menu-group-btn[onclick*=\"" + fragment + "\"]");
    if (!btn) return;
    var section = btn.closest('.menu-section');
    if (section) section.style.display = visible ? '' : 'none';
  }

  setGroupVisible("navigateToSubmenu('actions')", canEvents);
  setGroupVisible("navigateToSubmenu('analytics')", canAnalytics);
  setGroupVisible("navigateToSubmenu('settings')", canSettings);
  setGroupVisible("navigate('admin')", canAdmin);

  var notifBlock = document.getElementById('menu-notifications');
  if (notifBlock) notifBlock.style.display = canNotifications ? '' : 'none';
}

var _menuCalvingMonthOffset = 0;
/** Последний факт месяца: для подсказки по звёздочкам */
var _menuCalvingLastFactItems = [];

function getMenuCalvingViewYearMonth() {
  var now = new Date();
  var viewDate = new Date(now.getFullYear(), now.getMonth() + _menuCalvingMonthOffset, 1);
  return { year: viewDate.getFullYear(), month: viewDate.getMonth() };
}

function openCalvingListFromMenu() {
  if (typeof window !== 'undefined') {
    window._listsCalvingView = getMenuCalvingViewYearMonth();
  }
  if (typeof navigate === 'function') navigate('list-calving');
}

function formatCalvingMonthLabel(year, month) {
  try {
    var d = new Date(year, month, 1);
    return d.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
  } catch (e) {
    return year + '-' + (month + 1);
  }
}

function escapeCalvingModalHtml(text) {
  return String(text == null ? '' : text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Всплывающее окно по нажатию на *N (мобильные без hover).
 * kind: 'addedAfter' | 'exited'
 */
function showMenuCalvingStarModal(kind) {
  var isAdded = kind === 'addedAfter';
  var title = isAdded ? 'После отёла' : 'Выбывшие';
  var hint = isAdded
    ? 'Животные, добавленные в базу после даты отёла (в факте за выбранный месяц):'
    : 'Выбывшие животные с датой отёла в выбранном месяце:';
  var items = (_menuCalvingLastFactItems || []).filter(function (row) {
    return isAdded ? row.addedAfterCalving : row.exited;
  });
  var seen = Object.create(null);
  var unique = [];
  items.forEach(function (row) {
    var id = String(row.cattleId || '');
    if (!id || seen[id]) return;
    seen[id] = true;
    unique.push(row);
  });
  unique.sort(function (a, b) {
    return String(a.cattleId).localeCompare(String(b.cattleId), 'ru', { numeric: true });
  });

  var existing = document.getElementById('menuCalvingStarModal');
  if (existing) existing.remove();

  var overlay = document.createElement('div');
  overlay.id = 'menuCalvingStarModal';
  overlay.className = 'confirm-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', title);

  var listHtml;
  if (!unique.length) {
    listHtml = '<p class="menu-calving-star-modal-empty">Нет животных в этой категории</p>';
  } else {
    listHtml = '<ul class="menu-calving-star-modal-list">' + unique.map(function (row) {
      var nick = row.nickname ? ' — ' + escapeCalvingModalHtml(row.nickname) : '';
      var date = row.actualCalvingDate || row.calvingDate || '';
      var datePart = date ? ' <span style="color:var(--color-text-muted);font-size:0.85em">(' + escapeCalvingModalHtml(date) + ')</span>' : '';
      return '<li><strong>№' + escapeCalvingModalHtml(row.cattleId) + '</strong>' + nick + datePart + '</li>';
    }).join('') + '</ul>';
  }

  overlay.innerHTML =
    '<div class="confirm-modal confirm-modal--wide">' +
    '<p class="confirm-modal-text" style="font-weight:600;margin-bottom:0.35rem;">' + escapeCalvingModalHtml(title) + '</p>' +
    '<p class="menu-calving-star-modal-hint">' + escapeCalvingModalHtml(hint) + '</p>' +
    listHtml +
    '<div class="confirm-modal-actions" style="margin-top:1rem;">' +
    '<button type="button" class="small-btn" data-action="close">Закрыть</button>' +
    '</div></div>';

  function close() {
    overlay.remove();
    document.body.style.overflow = '';
  }
  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) close();
  });
  var closeBtn = overlay.querySelector('[data-action="close"]');
  if (closeBtn) closeBtn.onclick = close;
  document.body.style.overflow = 'hidden';
  document.body.appendChild(overlay);
  if (closeBtn) closeBtn.focus();
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
  var factAddedStar = document.getElementById('menuCalvingFactAddedStar');
  var factExitedStar = document.getElementById('menuCalvingFactExitedStar');
  var warnEl = document.getElementById('menuCalvingWarning');

  if (labelEl) labelEl.textContent = formatCalvingMonthLabel(year, month);

  var list = (typeof getVisibleEntries === 'function') ? getVisibleEntries(window.entries || []) : (window.entries || []);
  var stats = typeof getCalvingStatsForMonth === 'function'
    ? getCalvingStatsForMonth(list, year, month, now)
    : { plan: { count: 0, items: [] }, fact: { count: 0, items: [], hasDataErrors: false, addedAfterCalvingCount: 0, exitedCount: 0 } };

  _menuCalvingLastFactItems = (stats.fact && stats.fact.items) ? stats.fact.items.slice() : [];

  function setAnim(el, value) {
    if (!el) return;
    if (typeof window.animateNumber === 'function') {
      window.animateNumber(el, value);
    } else {
      el.textContent = String(value);
    }
  }
  setAnim(planEl, stats.plan.count);
  setAnim(factEl, stats.fact.count);

  var addedN = (stats.fact && stats.fact.addedAfterCalvingCount) || 0;
  var exitedN = (stats.fact && stats.fact.exitedCount) || 0;
  if (factAddedStar) {
    if (addedN > 0) {
      factAddedStar.hidden = false;
      factAddedStar.textContent = '*' + addedN;
      factAddedStar.setAttribute('aria-label', 'После отёла: ' + addedN + '. Нажмите для списка');
    } else {
      factAddedStar.hidden = true;
      factAddedStar.textContent = '*0';
    }
  }
  if (factExitedStar) {
    if (exitedN > 0) {
      factExitedStar.hidden = false;
      factExitedStar.textContent = '*' + exitedN;
      factExitedStar.setAttribute('aria-label', 'Выбывшие: ' + exitedN + '. Нажмите для списка');
    } else {
      factExitedStar.hidden = true;
      factExitedStar.textContent = '*0';
    }
  }

  if (warnEl) {
    if (stats.fact.hasDataErrors) {
      warnEl.hidden = false;
      warnEl.textContent = 'Факт содержит даты отёла в будущем — проверьте карточки (см. уведомления «Ошибки»).';
    } else {
      warnEl.hidden = true;
      warnEl.textContent = '';
    }
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
  var factAddedStar = document.getElementById('menuCalvingFactAddedStar');
  var factExitedStar = document.getElementById('menuCalvingFactExitedStar');
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
      openCalvingListFromMenu();
    });
  }
  if (factAddedStar) {
    factAddedStar.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      showMenuCalvingStarModal('addedAfter');
    });
  }
  if (factExitedStar) {
    factExitedStar.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      showMenuCalvingStarModal('exited');
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
  function setNum(id, value, suffix) {
    var el = document.getElementById(id);
    if (!el) return;
    if (typeof window.animateNumber === 'function') {
      window.animateNumber(el, value, { suffix: suffix || '' });
    } else {
      el.textContent = String(value) + (suffix || '');
    }
  }
  if (!list || list.length === 0) {
    setNum('totalCows', 0);
    setNum('pregnantCows', 0);
    setNum('dryCows', 0);
    setNum('inseminatedCows', 0);
    setNum('cullCows', 0);
    setNum('notInseminatedCows', 0);
    setNum('pregnantCowsPct', 0, '%');
    setNum('dryCowsPct', 0, '%');
    setNum('inseminatedCowsPct', 0, '%');
    setNum('cullCowsPct', 0, '%');
    setNum('notInseminatedCowsPct', 0, '%');
    updateMenuCalvingForecast();
    return;
  }

  const totalCows = list.length;
  const pregnantCows = list.filter(e => e.status && e.status.includes('Стельная')).length;
  const dryCows = list.filter(e => e.status && e.status.includes('Сухостой')).length;
  const inseminatedCows = list.filter(e => e.status && (e.status.includes('Осеменен') || (e.status.toLowerCase && e.status.toLowerCase().includes('осеменен')))).length;
  const cullCows = list.filter(e => e.status && (e.status.toLowerCase ? e.status.toLowerCase().includes('брак') : e.status.includes('Брак'))).length;
  const notInseminatedCows = list.filter(e => !e.status || (e.status && (e.status.toLowerCase ? e.status.toLowerCase().includes('холостая') : e.status.includes('Холостая')))).length;

  setNum('totalCows', totalCows);
  setNum('pregnantCows', pregnantCows);
  setNum('dryCows', dryCows);
  setNum('inseminatedCows', inseminatedCows);
  setNum('cullCows', cullCows);
  setNum('notInseminatedCows', notInseminatedCows);

  setNum('pregnantCowsPct', pct(pregnantCows, totalCows), '%');
  setNum('dryCowsPct', pct(dryCows, totalCows), '%');
  setNum('inseminatedCowsPct', pct(inseminatedCows, totalCows), '%');
  setNum('cullCowsPct', pct(cullCows, totalCows), '%');
  setNum('notInseminatedCowsPct', pct(notInseminatedCows, totalCows), '%');
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
  NS.updateMenuEmptyObjectState = updateMenuEmptyObjectState;
  NS.updateMenuGroupVisibility = updateMenuGroupVisibility;
  NS.formatCalvingMonthLabel = formatCalvingMonthLabel;
  NS.getMenuCalvingViewYearMonth = getMenuCalvingViewYearMonth;
  NS.openCalvingListFromMenu = openCalvingListFromMenu;
  NS.updateMenuCalvingForecast = updateMenuCalvingForecast;
  NS.initMenuCalvingForecast = initMenuCalvingForecast;
  NS.updateHerdStats = updateHerdStats;
  NS.initAddObjectModal = initAddObjectModal;
  NS.routeInitialScreenAfterSession = routeInitialScreenAfterSession;
})();
export {};
