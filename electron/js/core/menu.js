// menu.js — Навигация между экранами, переключатель объектов, статистика стада

/** Конфиг групп главного меню: id группы → { title, buttons: [{ icon, text, onclick }] } */
var MENU_GROUPS = {
  data: {
    title: 'Работа с данными',
    buttons: [
      { icon: '➕', text: 'Добавить животное', onclick: "navigate('add')", viewerHide: true },
      { icon: '📋', text: 'Список всех животных', onclick: "navigate('view')" },
      { icon: '📑', text: 'Все осеменения', onclick: "navigate('all-inseminations')" },
      { icon: '📋', text: 'Списки', onclick: "navigate('lists')" },
      { icon: '📜', text: 'Список событий', onclick: "navigate('events')" }
    ]
  },
  actions: {
    title: 'Действия',
    buttons: [
      { icon: '🐄', text: 'Ввести осеменение', onclick: "navigate('insemination')" },
      { icon: '🐄', text: 'Запуск', onclick: "navigate('dry')" },
      { icon: '🐄', text: 'Отел', onclick: "navigate('calving')" },
      { icon: '⚠️', text: 'Аборт', onclick: "navigate('abort')" },
      { icon: '🩺', text: 'УЗИ', onclick: "navigate('uzi')" },
      { icon: '📋', text: 'На протокол', onclick: "navigate('protocol-assign')" }
    ]
  },
  analytics: {
    title: 'Аналитика',
    buttons: [
      { icon: '📊', text: 'Аналитика', onclick: "navigate('analytics')" },
      { icon: '📈', text: 'Интервальный анализ', onclick: "navigate('interval-analysis')" },
      { icon: '🐄', text: 'Воспроизводство', onclick: "navigate('reproduction')" }
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
      { icon: '🏡', text: 'Настройки хозяйства', onclick: "navigate('farm-settings')" },
      { icon: '🔄', text: 'Синхронизация', onclick: "navigate('sync')" },
      { icon: '❓', text: 'Справка', onclick: "navigate('help')" }
    ]
  }
};

function viewerForbiddenScreen(screenId) {
  return (
    screenId === 'add' ||
    screenId === 'insemination' ||
    screenId === 'dry' ||
    screenId === 'calving' ||
    screenId === 'abort' ||
    screenId === 'uzi' ||
    screenId === 'protocol-assign' ||
    screenId === 'admin'
  );
}

/**
 * Переход на экран подменю с заданной группой
 */
function navigateToSubmenu(groupId) {
  window._submenuGroup = groupId;
  navigate('submenu');
}

var _navStack = [];
var _isNavigatingBack = false;
var _currentScreenId = null;

/**
 * Навигация между экранами
 * @param {string} screenId - id экрана (без суффикса -screen)
 * @param {Object} [options] - опции (например { group: 'data' } для подменю)
 */
function navigate(screenId, options) {
  if (options && options.group !== undefined) {
    window._submenuGroup = options.group;
  }

  var currentUser = (typeof getCurrentUser === 'function') ? getCurrentUser() : null;
  if (screenId !== 'auth' && screenId !== 'sync' && !currentUser) {
    screenId = 'auth';
  }

  if (currentUser && currentUser.role === 'viewer' && viewerForbiddenScreen(screenId)) {
    if (typeof showToast === 'function') showToast('Недостаточно прав (только просмотр)', 'error');
    screenId = 'menu';
  }

  if (!_isNavigatingBack && _currentScreenId && _currentScreenId !== screenId) {
    _navStack.push(_currentScreenId);
    if (_navStack.length > 50) _navStack.splice(0, _navStack.length - 50);
  }
  _isNavigatingBack = false;
  _currentScreenId = screenId;

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

  /* Экраны пакетных «Действий»: renderer repaint + нативное окно (иначе ввод оживает только после minimize/restore). */
  if (
    screenId === 'insemination' ||
    screenId === 'dry' ||
    screenId === 'uzi' ||
    screenId === 'calving' ||
    screenId === 'abort' ||
    screenId === 'protocol-assign'
  ) {
    setTimeout(function () {
      if (typeof window.softRepaintCattleTrackerView === 'function') window.softRepaintCattleTrackerView();
    }, 0);
    /* Один hide/show за вход на экран — два таймера давали двойное мигание. */
    setTimeout(function () {
      if (typeof window.softRepaintCattleTrackerView === 'function') window.softRepaintCattleTrackerView();
      var api = typeof window !== 'undefined' && window.electronAPI;
      if (api && typeof api.requestNativeWindowRefresh === 'function') {
        try {
          api.requestNativeWindowRefresh('action-screen-open');
        } catch (e) {}
      }
    }, 220);
  }

  if (screenId === 'submenu') {
    renderSubmenu();
  }
  if (screenId === 'protocols' && typeof renderProtocolsScreen === 'function') {
    renderProtocolsScreen('protocols-container');
  }
  if (screenId === 'farm-settings' && typeof window.initFarmSettingsScreen === 'function') {
    window.initFarmSettingsScreen();
  }
  if (screenId === 'dry' && typeof initDryScreen === 'function') initDryScreen();
  if (screenId === 'calving' && typeof initCalvingScreen === 'function') initCalvingScreen();
  if (screenId === 'abort' && typeof initAbortScreen === 'function') initAbortScreen();
  if (screenId === 'protocol-assign' && typeof initProtocolAssignScreen === 'function') initProtocolAssignScreen();
  if (screenId === 'uzi' && typeof initUziScreen === 'function') initUziScreen();
  if (screenId === 'insemination' && typeof window.initInseminationScreen === 'function') {
    window.initInseminationScreen();
    setTimeout(function () {
      if (typeof window.fillAllInseminationCodeSelects === 'function') {
        try { window.fillAllInseminationCodeSelects(); } catch (e) {}
      }
    }, 0);
  }
  if (screenId === 'view') {
    updateViewList();
    setTimeout(function () {
      if (typeof refreshViewListVisible === 'function') refreshViewListVisible();
    }, 0);
  }
  if (screenId === 'all-inseminations' && typeof window.renderAllInseminationsScreen === 'function') {
    window.renderAllInseminationsScreen();
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
  if (screenId === 'auth') {
    if (typeof window.bindAuthControls === 'function') window.bindAuthControls();
    if (typeof fillAuthUsernameList === 'function') fillAuthUsernameList();
    setTimeout(function () {
      var authScreen = document.getElementById('auth-screen');
      var active = document.activeElement;
      if (typeof window.focusAuthForm === 'function' && (!authScreen || !active || !authScreen.contains(active))) {
        window.focusAuthForm();
      }
    }, 0);
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
  if (screenId === 'reproduction' && typeof renderReproductionScreen === 'function') {
    renderReproductionScreen();
  }
  if (screenId === 'sync' && typeof renderBackupUI === 'function') {
    renderBackupUI('sync-backup-container');
  }
  if (screenId === 'help' && typeof window.refreshHelpDevtoolsDiagnostics === 'function') {
    window.refreshHelpDevtoolsDiagnostics();
  }
  if (screenId === 'admin' && typeof window.renderAdminScreen === 'function') {
    window.renderAdminScreen();
  }
  if (screenId === 'lists' && typeof window.renderListsScreen === 'function') {
    window.renderListsScreen();
  }
  if (screenId === 'events' && typeof window.renderEventsScreen === 'function') {
    window.renderEventsScreen();
  }
  if (screenId === 'add') {
    var clearBtn = document.getElementById('clearFormButton');
    if (clearBtn) clearBtn.style.display = window.currentEditingId ? 'none' : 'inline-block';
    if (!window.currentEditingId) {
      var titleEl = document.getElementById('addScreenTitle');
      if (titleEl) titleEl.textContent = '➕ Добавить корову';
      if (typeof clearForm === 'function') clearForm();
    }
    if (typeof window.fillAllInseminationCodeSelects === 'function') {
      try {
        window.fillAllInseminationCodeSelects();
      } catch (e) {}
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

/**
 * Возврат на предыдущий экран (из навигационного стека)
 */
function navigateBack() {
  if (_navStack.length > 0) {
    _isNavigatingBack = true;
    var prevScreen = _navStack.pop();
    navigate(prevScreen);
    return true;
  }
  return false;
}

/**
 * Назад: предыдущий экран из стека; если стек пуст — подменю (не главное меню).
 */
function navigateBackOrFallback() {
  if (_navStack.length > 0) {
    return navigateBack();
  }
  if (typeof navigate === 'function') navigate('submenu');
}

function syncRouteToScreen() {
  var hash = (typeof location !== 'undefined' && location.hash ? location.hash.slice(1) : '') || 'menu';
  var parts = hash.split('/');
  var screenId = parts[0] || 'menu';
  var isElectron = typeof window !== 'undefined' && window.electronAPI;
  var currentUser = (typeof getCurrentUser === 'function') ? getCurrentUser() : null;
  if (isElectron && !currentUser && (screenId === 'menu' || screenId === '')) {
    screenId = 'auth';
    if (typeof location !== 'undefined') location.hash = 'auth';
  }
  if (currentUser && currentUser.role === 'viewer' && viewerForbiddenScreen(screenId)) {
    screenId = 'menu';
    if (typeof location !== 'undefined') location.hash = 'menu';
  }
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
  var user = (typeof getCurrentUser === 'function') ? getCurrentUser() : null;
  var isViewer = user && user.role === 'viewer';
  if (isViewer && groupId === 'actions') {
    containerEl.innerHTML = '<p class="farm-settings-hint">Действия недоступны в режиме только просмотра.</p>';
    return;
  }
  var html = '';
  for (var i = 0; i < group.buttons.length; i++) {
    var btn = group.buttons[i];
    if (isViewer && btn.viewerHide) continue;
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
  var titleEl = document.getElementById('addObjectModalTitle');
  var okBtn = document.getElementById('addObjectModalOkBtn');
  if (!modal || !input) return;
  modal.setAttribute('data-editing-id', '');
  modal.removeAttribute('data-import-source-id');
  if (titleEl) titleEl.textContent = 'Новая база (объект)';
  if (okBtn) okBtn.textContent = 'Добавить';
  input.value = 'Новая база';
  modal.classList.add('active');
  modal.setAttribute('aria-hidden', 'false');
  modal.removeAttribute('hidden');
  setTimeout(function () { if (input) input.focus(); }, 0);
}

/**
 * Показать модальное окно «Редактировать объект» для выбранной базы
 */
function showEditObjectModal() {
  var select = document.getElementById('currentObjectSelect');
  var list = typeof getObjectsList === 'function' ? getObjectsList() : null;
  if (!select || !list || !list.length) return;
  var id = select.value;
  var obj = list.filter(function (o) { return o.id === id; })[0];
  if (!obj) return;
  var modal = document.getElementById('addObjectModal');
  var input = document.getElementById('addObjectNameInput');
  var titleEl = document.getElementById('addObjectModalTitle');
  var okBtn = document.getElementById('addObjectModalOkBtn');
  if (!modal || !input) return;
  modal.setAttribute('data-editing-id', id);
  modal.removeAttribute('data-import-source-id');
  if (titleEl) titleEl.textContent = 'Редактировать объект';
  if (okBtn) okBtn.textContent = 'Сохранить';
  input.value = (obj.name || '').trim() || 'Новая база';
  modal.classList.add('active');
  modal.setAttribute('aria-hidden', 'false');
  modal.removeAttribute('hidden');
  setTimeout(function () { if (input) input.focus(); }, 0);
}

/**
 * Обработчик кнопки «Изменить» — открывает модалку редактирования текущего объекта
 */
function handleEditObjectClick() {
  showEditObjectModal();
}

/**
 * Обработчик кнопки «Удалить» — удаляет текущий объект с подтверждением
 */
function handleDeleteObjectClick() {
  var select = document.getElementById('currentObjectSelect');
  var list = typeof getObjectsList === 'function' ? getObjectsList() : null;
  if (!select || !list || !list.length) return;
  var id = select.value;
  if (id === 'default') {
    if (typeof showToast === 'function') showToast('Нельзя удалить базовый объект default', 'error', 4000);
    return;
  }
  var obj = list.filter(function (o) { return o.id === id; })[0];
  var name = (obj && obj.name) ? obj.name : id;
  var apiLocalHide = window.CATTLE_TRACKER_USE_API && window.CattleTrackerApi && typeof window.CattleTrackerApi.hideObjectLocal === 'function';
  var msg = apiLocalHide
    ? ('Скрыть базу «' + String(name).replace(/</g, '&lt;') + '» на этом устройстве? На сервере данные не удаляются.')
    : ('Удалить базу «' + String(name).replace(/</g, '&lt;') + '»? Все записи в ней будут удалены.');
  var doDelete = function () {
    if (apiLocalHide) {
      window.CattleTrackerApi.hideObjectLocal(id).then(function () {
        if (typeof window.afterLocalHideObject === 'function') {
          return window.afterLocalHideObject(id);
        }
      }).then(function () {
        if (typeof updateObjectSwitcher === 'function') updateObjectSwitcher();
        if (typeof showToast === 'function') showToast('База скрыта на этом устройстве', 'info', 4000);
      }).catch(function (err) {
        var m = err && err.message ? err.message : 'Ошибка';
        if (typeof showToast === 'function') showToast(m, 'error', 5000);
      });
      return;
    }
    if (typeof deleteObject !== 'function') return;
    var p = deleteObject(id);
    if (p && typeof p.then === 'function') {
      p.then(function () {
        if (typeof updateObjectSwitcher === 'function') updateObjectSwitcher();
        if (typeof showToast === 'function') showToast('Объект удалён', 'info');
      }).catch(function (err) {
        var m = err && err.message ? err.message : 'Ошибка удаления';
        if (typeof showToast === 'function') showToast(m, 'error', 5000);
      });
    } else {
      if (typeof updateObjectSwitcher === 'function') updateObjectSwitcher();
    }
  };
  if (typeof showConfirmModal === 'function') {
    showConfirmModal(msg).then(function (ok) { if (ok) doDelete(); });
    return;
  }
  if (!confirm(msg)) return;
  doDelete();
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
 * Создать или обновить объект (вызывается из модального окна). Поддерживает режим «Импорт в новый объект».
 */
function confirmAddObject() {
  var modal = document.getElementById('addObjectModal');
  var input = document.getElementById('addObjectNameInput');
  var name = input && (input.value || '').trim();
  var editingId = modal && modal.getAttribute('data-editing-id');
  var importSourceId = modal && modal.getAttribute('data-import-source-id');
  if (importSourceId) {
    modal.removeAttribute('data-import-source-id');
    hideAddObjectModal();
    if (!name) return;
    if (typeof window.loadServerBaseIntoNewObject === 'function') {
      window.loadServerBaseIntoNewObject(importSourceId, name);
    }
    return;
  }
  hideAddObjectModal();
  if (!name) return;
  if (editingId) {
    if (typeof updateObject !== 'function') {
      if (typeof updateObjectSwitcher === 'function') updateObjectSwitcher();
      return;
    }
    var result = updateObject(editingId, { name: name });
    if (result && typeof result.then === 'function') {
      result.then(function () {
        if (typeof updateObjectSwitcher === 'function') updateObjectSwitcher();
        if (typeof showToast === 'function') showToast('Название сохранено', 'success');
      }).catch(function (err) {
        var msg = err && err.message ? err.message : 'Ошибка сохранения';
        if (typeof showToast === 'function') showToast(msg, 'error', 5000);
      });
    } else {
      if (typeof updateObjectSwitcher === 'function') updateObjectSwitcher();
    }
    return;
  }
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
    addBtn.onclick = function () { handleAddObjectClick(); };
  }
}

/**
 * Обновляет статистику стада на главном экране
 */
function updateHerdStats() {
  var list = (typeof getVisibleEntries === 'function') ? getVisibleEntries(window.entries || []) : (window.entries || []);
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
  const pregnantCows = list.filter(e => e.status && e.status.includes('Стельная')).length;
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
  var currentUser = (typeof getCurrentUser === 'function') ? getCurrentUser() : null;
  // В Electron при каждом запуске показываем экран входа (удобно для проверки авторизации)
  var isElectron = typeof window !== 'undefined' && window.electronAPI;
  if (isElectron) {
    navigate('auth');
  } else if (currentUser) {
    syncRouteToScreen();
  } else {
    navigate('auth');
  }
});
if (typeof window !== 'undefined') {
  window.navigate = navigate;
  window.navigateBack = navigateBack;
  window.navigateBackOrFallback = navigateBackOrFallback;
  window.navigateToSubmenu = navigateToSubmenu;
  window.handleAddObjectClick = handleAddObjectClick;
  window.handleEditObjectClick = handleEditObjectClick;
  window.handleDeleteObjectClick = handleDeleteObjectClick;
  window.updateObjectSwitcher = updateObjectSwitcher;
  window.addEventListener('hashchange', syncRouteToScreen);

  var _backExitPending = false;
  window._handleBackButton = function () {
    if (navigateBack()) return;
    if (_backExitPending) {
      try {
        if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App) {
          window.Capacitor.Plugins.App.exitApp();
        } else if (navigator.app && navigator.app.exitApp) {
          navigator.app.exitApp();
        }
      } catch (_) {}
      return;
    }
    _backExitPending = true;
    if (typeof showToast === 'function') showToast('Нажмите «Назад» ещё раз для выхода', 'info');
    setTimeout(function () { _backExitPending = false; }, 2000);
  };
  document.addEventListener('backbutton', function (e) {
    e.preventDefault();
    window._handleBackButton();
  });
}

window.addEventListener('load', () => {
  if (document.getElementById('menu-screen').classList.contains('active')) {
    updateHerdStats();
  }
});
export {};
