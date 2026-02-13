// menu.js — Навигация между экранами, переключатель объектов, статистика стада

/** Конфиг групп главного меню: id группы → { title, buttons: [{ icon, text, onclick }] } */
var MENU_GROUPS = {
  data: {
    title: 'Работа с данными',
    buttons: [
      { icon: '➕', text: 'Добавить животное', onclick: "navigate('add')" },
      { icon: '📤', text: 'Экспорт в Excel', onclick: 'exportToExcel()' },
      { icon: '📋', text: 'Шаблон импорта', onclick: 'downloadTemplate()' },
      { icon: '📥', text: 'Импорт из Excel', onclick: "document.getElementById('importFile').click()" },
      { icon: '📋', text: 'Список всех животных', onclick: "navigate('view')" },
      { icon: '📑', text: 'Все осеменения', onclick: "navigate('all-inseminations')" }
    ]
  },
  actions: {
    title: 'Действия',
    buttons: [
      { icon: '🐄', text: 'Ввести осеменение', onclick: "navigate('insemination')" },
      { icon: '🐄', text: 'Запуск', onclick: "navigate('dry')" },
      { icon: '🐄', text: 'Отел', onclick: "navigate('calving')" },
      { icon: '🩺', text: 'УЗИ', onclick: "navigate('uzi')" },
      { icon: '📋', text: 'Поставить на протокол', onclick: "navigate('protocol-assign')" }
    ]
  },
  analytics: {
    title: 'Аналитика',
    buttons: [
      { icon: '📊', text: 'Аналитика', onclick: "navigate('analytics')" },
      { icon: '📈', text: 'Интервальный анализ', onclick: "navigate('interval-analysis')" }
    ]
  },
  notifications: {
    title: 'Уведомления и планы',
    buttons: [
      { icon: '🔔', text: 'Уведомления', onclick: "navigate('notifications')" },
      { icon: '📋', text: 'Планы', onclick: "navigate('tasks')" }
    ]
  },
  settings: {
    title: 'Настройки',
    buttons: [
      { icon: '👤', text: 'Войти / Пользователи', onclick: "navigate('auth')" },
      { icon: '🔄', text: 'Синхронизация', onclick: "navigate('sync')" },
      { icon: '💾', text: 'Резервные копии', onclick: "navigate('backup')" },
      { icon: '📋', text: 'Протоколы синхронизации', onclick: "navigate('protocols')" }
    ]
  }
};

/**
 * Переход на экран подменю с заданной группой
 */
function navigateToSubmenu(groupId) {
  window._submenuGroup = groupId;
  navigate('submenu');
}

/**
 * Навигация между экранами
 * @param {string} screenId - id экрана (без суффикса -screen)
 * @param {Object} [options] - опции (например { group: 'data' } для подменю)
 */
function navigate(screenId, options) {
  if (options && options.group !== undefined) {
    window._submenuGroup = options.group;
  }

  document.querySelectorAll('.screen').forEach(el => {
    el.classList.remove('active');
  });

  const screen = document.getElementById(screenId + '-screen');
  if (screen) {
    screen.classList.add('active');
  }

  if (typeof updateWindowModeForScreen === 'function') {
    updateWindowModeForScreen(screenId);
  }

  if (screenId === 'submenu') {
    renderSubmenu();
  }
  if (screenId === 'protocols' && typeof renderProtocolsScreen === 'function') {
    renderProtocolsScreen('protocols-container');
  }
  if (screenId === 'dry' && typeof initDryScreen === 'function') initDryScreen();
  if (screenId === 'calving' && typeof initCalvingScreen === 'function') initCalvingScreen();
  if (screenId === 'protocol-assign' && typeof initProtocolAssignScreen === 'function') initProtocolAssignScreen();
  if (screenId === 'uzi' && typeof initUziScreen === 'function') initUziScreen();
  if (screenId === 'view') {
    updateViewList();
    setTimeout(function () {
      if (typeof refreshViewListVisible === 'function') refreshViewListVisible();
    }, 0);
  }
  if (screenId === 'all-inseminations' && typeof renderAllInseminationsScreen === 'function') {
    renderAllInseminationsScreen();
  }
  if (screenId === 'notifications' && typeof renderNotificationCenter === 'function') {
    renderNotificationCenter('notification-center-container');
  }
  if (screenId === 'sync' && typeof window.initSyncServerBlock === 'function') {
    window.initSyncServerBlock();
    if (window.CATTLE_TRACKER_USE_API && typeof window.updateSyncServerStatusFromHealth === 'function') {
      window.updateSyncServerStatusFromHealth();
    }
  }
  if (screenId === 'tasks' && typeof renderTasksScreen === 'function') {
    renderTasksScreen();
  }
  if (screenId === 'analytics' && typeof renderAnalyticsScreen === 'function') {
    renderAnalyticsScreen();
  }
  if (screenId === 'interval-analysis' && typeof renderIntervalAnalysisScreen === 'function') {
    renderIntervalAnalysisScreen();
  }
  if (screenId === 'backup' && typeof renderBackupUI === 'function') {
    renderBackupUI('backup-container');
  }
  if (screenId === 'add') {
    var clearBtn = document.getElementById('clearFormButton');
    if (clearBtn) clearBtn.style.display = window.currentEditingId ? 'none' : 'inline-block';
    if (!window.currentEditingId) {
      var titleEl = document.getElementById('addScreenTitle');
      if (titleEl) titleEl.textContent = '➕ Добавить корову';
      if (typeof clearForm === 'function') clearForm();
    }
    setTimeout(function () {
      var firstField = document.getElementById('cattleId');
      if (firstField) firstField.focus();
    }, 0);
  }

  if (screenId === 'menu') {
    updateObjectSwitcher();
    updateHerdStats();
    if (typeof updateAuthBar === 'function') updateAuthBar();
    if (typeof renderNotificationSummary === 'function') renderNotificationSummary('menuNotificationsBody');
    if (typeof initMenuNotificationsToggle === 'function') initMenuNotificationsToggle();
    if (typeof initFirstRunHints === 'function') initFirstRunHints();
    if (typeof maybeShowFirstRunHints === 'function') maybeShowFirstRunHints();
  }
  if (typeof updateNotificationIndicators === 'function') updateNotificationIndicators();

  var newHash = '#' + (screenId || 'menu');
  if (screenId === 'view-cow' && options && options.cattleId) newHash += '/' + String(options.cattleId).replace(/[#/]/g, '');
  if (typeof location !== 'undefined' && location.hash !== newHash) location.hash = newHash;
}

function syncRouteToScreen() {
  var hash = (typeof location !== 'undefined' && location.hash ? location.hash.slice(1) : '') || 'menu';
  var parts = hash.split('/');
  var screenId = parts[0] || 'menu';
  if (screenId === 'view-cow' && parts[1]) {
    if (typeof viewCow === 'function') viewCow(parts[1]);
  } else {
    navigate(screenId);
  }
}

function updateWindowModeForScreen(screenId) {
  if (typeof window === 'undefined' || !window.electronAPI || !window.electronAPI.setWindowMode) return;
  if (screenId === 'menu') window.electronAPI.setWindowMode('menu');
  else window.electronAPI.setWindowMode('default');
}

function initMenuNotificationsToggle() {
  var toggle = document.getElementById('menuNotificationsToggle');
  var body = document.getElementById('menuNotificationsBody');
  if (!toggle || !body || toggle.dataset.bound === '1') return;
  toggle.dataset.bound = '1';
  var savedOpen = false;
  try {
    savedOpen = localStorage.getItem('cattleTracker_notifications_open') === '1';
  } catch (e) {}
  setMenuNotificationsOpen(savedOpen);
  toggle.addEventListener('click', function () {
    var isOpen = toggle.getAttribute('aria-expanded') === 'true';
    setMenuNotificationsOpen(!isOpen);
  });
}

function setMenuNotificationsOpen(isOpen) {
  var toggle = document.getElementById('menuNotificationsToggle');
  var body = document.getElementById('menuNotificationsBody');
  if (!toggle || !body) return;
  toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  body.hidden = !isOpen;
  if (isOpen && typeof renderNotificationSummary === 'function') {
    renderNotificationSummary('menuNotificationsBody');
  }
  try {
    localStorage.setItem('cattleTracker_notifications_open', isOpen ? '1' : '0');
  } catch (e) {}
}

function initFirstRunHints() {
  var modal = document.getElementById('firstRunHints');
  if (!modal || modal.dataset.bound === '1') return;
  modal.dataset.bound = '1';
  var closeBtn = document.getElementById('firstRunHintsClose');
  var skipBtn = document.getElementById('firstRunHintsSkip');
  if (closeBtn) closeBtn.addEventListener('click', function () { closeFirstRunHints(true); });
  if (skipBtn) skipBtn.addEventListener('click', function () { closeFirstRunHints(true); });
  modal.addEventListener('click', function (ev) {
    if (ev.target === modal) closeFirstRunHints(true);
  });
}

function maybeShowFirstRunHints() {
  var modal = document.getElementById('firstRunHints');
  if (!modal) return;
  var seen = false;
  try {
    seen = localStorage.getItem('cattleTracker_hasSeenHints') === '1';
  } catch (e) {}
  if (seen) return;
  modal.classList.add('active');
  modal.setAttribute('aria-hidden', 'false');
}

function closeFirstRunHints(setFlag) {
  var modal = document.getElementById('firstRunHints');
  if (!modal) return;
  modal.classList.remove('active');
  modal.setAttribute('aria-hidden', 'true');
  if (setFlag !== false) {
    try {
      localStorage.setItem('cattleTracker_hasSeenHints', '1');
    } catch (e) {}
  }
}

/**
 * Рендерит экран подменю: заголовок и кнопки выбранной группы
 */
function renderSubmenu() {
  var groupId = window._submenuGroup || 'data';
  var group = MENU_GROUPS[groupId];
  var titleEl = document.getElementById('submenu-title');
  var containerEl = document.getElementById('submenu-buttons');
  if (!titleEl || !containerEl || !group) return;
  titleEl.textContent = group.title;
  var html = '';
  for (var i = 0; i < group.buttons.length; i++) {
    var btn = group.buttons[i];
    var styleAttr = btn.style ? ' style="' + String(btn.style).replace(/"/g, '&quot;') + '"' : '';
    html += '<button class="action-btn"' + styleAttr + ' onclick="' + String(btn.onclick).replace(/"/g, '&quot;').replace(/</g, '&lt;') + '">';
    html += '<span>' + (btn.icon || '') + '</span><span>' + (btn.text || '').replace(/</g, '&lt;') + '</span></button>';
  }
  containerEl.innerHTML = html;
}

/**
 * Показать модальное окно «Добавить объект»
 */
function showAddObjectModal() {
  var modal = document.getElementById('addObjectModal');
  var input = document.getElementById('addObjectNameInput');
  if (!modal || !input) return;
  input.value = 'Новая база';
  modal.classList.add('active');
  modal.setAttribute('aria-hidden', 'false');
  modal.removeAttribute('hidden');
  input.focus();
}

/**
 * Скрыть модальное окно «Добавить объект»
 */
function hideAddObjectModal() {
  var modal = document.getElementById('addObjectModal');
  if (!modal) return;
  modal.classList.remove('active');
  modal.setAttribute('aria-hidden', 'true');
  modal.setAttribute('hidden', '');
}

/**
 * Обработчик кнопки «Добавить объект» — открывает модальное окно (без prompt)
 */
function handleAddObjectClick() {
  showAddObjectModal();
}

/**
 * Создать объект с указанным именем (вызывается из модального окна)
 */
function confirmAddObject() {
  var input = document.getElementById('addObjectNameInput');
  var name = input && (input.value || '').trim();
  hideAddObjectModal();
  if (!name) return;
  if (typeof addObject !== 'function') {
    if (typeof updateObjectSwitcher === 'function') updateObjectSwitcher();
    return;
  }
  var result = addObject(name);
  if (result && typeof result.then === 'function') {
    result.then(function () {
      if (typeof updateObjectSwitcher === 'function') updateObjectSwitcher();
    }).catch(function (err) {
      var msg = err && err.message ? err.message : 'Ошибка создания объекта';
      if (typeof showToast === 'function') showToast(msg, 'error', 5000);
      else if (typeof console !== 'undefined') console.error(msg);
    });
  } else {
    if (typeof updateObjectSwitcher === 'function') updateObjectSwitcher();
  }
}

/**
 * Обновляет переключатель объектов (баз) на экране меню
 */
function updateObjectSwitcher() {
  var select = document.getElementById('currentObjectSelect');
  var addBtn = document.getElementById('addObjectBtn');
  if (!select) return;
  var list = typeof getObjectsList === 'function' ? getObjectsList() : null;
  if (!list || list.length === 0) {
    if (typeof ensureObjectsAndMigration === 'function') ensureObjectsAndMigration();
    list = typeof getObjectsList === 'function' ? getObjectsList() : [{ id: 'default', name: 'Основная база' }];
  }
  var currentId = typeof getCurrentObjectId === 'function' ? getCurrentObjectId() : 'default';
  select.innerHTML = list.map(function (obj) {
    var name = (obj.name || obj.id || '').replace(/</g, '&lt;').replace(/"/g, '&quot;');
    return '<option value="' + (obj.id || '').replace(/"/g, '&quot;') + '"' + (obj.id === currentId ? ' selected' : '') + '>' + name + '</option>';
  }).join('');
  select.onchange = function () {
    var id = select.value;
    if (id && typeof switchToObject === 'function') switchToObject(id);
  };
  if (addBtn && !addBtn.getAttribute('onclick')) {
    addBtn.onclick = function () { handleAddObjectClick(); };
  }
}

/**
 * Обновляет статистику стада на главном экране
 */
function updateHerdStats() {
  var list = (typeof getVisibleEntries === 'function') ? getVisibleEntries(entries || []) : (entries || []);
  if (!list || list.length === 0) {
    var totalEl = document.getElementById('totalCows');
    if (totalEl) totalEl.textContent = '0';
    var pEl = document.getElementById('pregnantCows');
    if (pEl) pEl.textContent = '0';
    var dEl = document.getElementById('dryCows');
    if (dEl) dEl.textContent = '0';
    var iEl = document.getElementById('inseminatedCows');
    if (iEl) iEl.textContent = '0';
    var cEl = document.getElementById('cullCows');
    if (cEl) cEl.textContent = '0';
    var percentsRow0 = document.getElementById('herdStatsPercentsRow');
    if (percentsRow0) { percentsRow0.setAttribute('aria-hidden', 'true'); percentsRow0.style.display = 'none'; }
    return;
  }

  const totalCows = list.length;
  const pregnantCows = list.filter(e => e.status && (e.status.includes('Стельная') || e.status.includes('Отёл'))).length;
  const dryCows = list.filter(e => e.status && e.status.includes('Сухостой')).length;
  const inseminatedCows = list.filter(e => e.status && (e.status.includes('Осеменен') || (e.status.toLowerCase && e.status.toLowerCase().includes('осеменен')))).length;
  const cullCows = list.filter(e => e.status && (e.status.toLowerCase ? e.status.toLowerCase().includes('брак') : e.status.includes('Брак'))).length;
  const notInseminatedCows = list.filter(e => !e.status || (e.status && (e.status.toLowerCase ? e.status.toLowerCase().includes('холостая') : e.status.includes('Холостая')))).length;

  document.getElementById('totalCows').textContent = totalCows;
  document.getElementById('pregnantCows').textContent = pregnantCows;
  document.getElementById('dryCows').textContent = dryCows;
  document.getElementById('inseminatedCows').textContent = inseminatedCows;
  document.getElementById('cullCows').textContent = cullCows;

  var percentsRow = document.getElementById('herdStatsPercentsRow');
  if (percentsRow) {
    if (totalCows === 0) {
      percentsRow.setAttribute('aria-hidden', 'true');
      percentsRow.style.display = 'none';
    } else {
      percentsRow.setAttribute('aria-hidden', 'false');
      percentsRow.style.display = '';
      var pct = function (n) { return Math.round((n / totalCows) * 100); };
      var pElPct = document.getElementById('pregnantCowsPct');
      var dElPct = document.getElementById('dryCowsPct');
      var iElPct = document.getElementById('inseminatedCowsPct');
      var cElPct = document.getElementById('cullCowsPct');
      var notInsElPct = document.getElementById('notInseminatedCowsPct');
      if (pElPct) pElPct.textContent = pct(pregnantCows) + '%';
      if (dElPct) dElPct.textContent = pct(dryCows) + '%';
      if (iElPct) iElPct.textContent = pct(inseminatedCows) + '%';
      if (cElPct) cElPct.textContent = pct(cullCows) + '%';
      if (notInsElPct) notInsElPct.textContent = pct(notInseminatedCows) + '%';
    }
  }
}

function initAddObjectModal() {
  var modal = document.getElementById('addObjectModal');
  var input = document.getElementById('addObjectNameInput');
  var closeBtn = document.getElementById('addObjectModalCloseBtn');
  var cancelBtn = document.getElementById('addObjectModalCancelBtn');
  var okBtn = document.getElementById('addObjectModalOkBtn');
  if (!modal || !input || modal.dataset.inited === '1') return;
  modal.dataset.inited = '1';
  function close() { hideAddObjectModal(); }
  if (closeBtn) closeBtn.addEventListener('click', close);
  if (cancelBtn) cancelBtn.addEventListener('click', close);
  if (okBtn) okBtn.addEventListener('click', confirmAddObject);
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); confirmAddObject(); }
    if (e.key === 'Escape') { e.preventDefault(); close(); }
  });
  modal.addEventListener('click', function (e) {
    if (e.target === modal) close();
  });
}

document.addEventListener('DOMContentLoaded', function () {
  initAddObjectModal();
  syncRouteToScreen();
});
if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', syncRouteToScreen);
}

window.addEventListener('load', () => {
  if (document.getElementById('menu-screen').classList.contains('active')) {
    updateHerdStats();
  }
});
