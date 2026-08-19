/** __menu part 2 */
(function () {
  'use strict';
  var root = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this);
  var NS = root['__menu'] = root['__menu'] || {};
  var global = typeof window !== 'undefined' ? window : this;

function navigateBackOrFallback(fallbackScreenId) {
  if (globalThis['__menu'].navigateBack()) return;
  globalThis['__menu'].navigate(fallbackScreenId || 'submenu');
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
  if (currentUser && globalThis['__menu'].viewerForbiddenScreen(screenId)) {
    screenId = 'menu';
    if (typeof location !== 'undefined') location.hash = 'menu';
  }
  if (screenId === 'view-cow' && parts[1]) {
    if (typeof viewCow === 'function') viewCow(parts[1]);
  } else {
    globalThis['__menu'].navigate(screenId);
  }
}

function updateWindowModeForScreen(screenId) {
  if (typeof window === 'undefined' || !window.electronAPI || !window.electronAPI.setWindowMode) return;
  if (screenId === 'menu' || screenId === 'herd-hub') window.electronAPI.setWindowMode('menu');
  else window.electronAPI.setWindowMode('default');
}

function initMenuNotificationsLink() {
  var toggle = document.getElementById('menuNotificationsToggle');
  if (!toggle || toggle.dataset.bound === '1') return;
  toggle.dataset.bound = '1';
  toggle.addEventListener('click', function () {
    if (typeof navigate === 'function') navigate('notifications');
  });
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
  var groups = globalThis['__menu'].MENU_GROUPS;
  var group = groups && groups[groupId];
  var titleEl = document.getElementById('submenu-title');
  var containerEl = document.getElementById('submenu-buttons');
  if (!titleEl || !containerEl || !group) return;
  titleEl.textContent = group.title;
  var user = (typeof getCurrentUser === 'function') ? getCurrentUser() : null;
  var canEvents = typeof window !== 'undefined' && typeof window.hasCapability === 'function' ? window.hasCapability('eventsInput', user) : true;
  var canServiceWorks = typeof window !== 'undefined' && typeof window.canInputServiceWorks === 'function'
    ? window.canInputServiceWorks(user)
    : canEvents;
  var canAnalytics = typeof window !== 'undefined' && typeof window.hasCapability === 'function' ? window.hasCapability('analytics', user) : true;
  var canSettings = typeof window !== 'undefined' && typeof window.hasCapability === 'function' ? window.hasCapability('farmCardSettings', user) : true;
  var canFarmView = typeof window !== 'undefined' && typeof window.hasCapability === 'function' ? window.hasCapability('farmCardView', user) : true;
  var canInventory = typeof window !== 'undefined' && typeof window.hasCapability === 'function' ? window.hasCapability('inventory', user) : true;
  if ((groupId === 'actions' && !canServiceWorks) || (groupId === 'analytics' && !canAnalytics)) {
    containerEl.innerHTML = '<p class="farm-settings-hint">Раздел недоступен для вашей роли.</p>';
    return;
  }
  var html = '';
  for (var i = 0; i < group.buttons.length; i++) {
    var btn = group.buttons[i];
    var onclick = String(btn.onclick || '');
    var anyCaps = btn.anyCaps;
    if (anyCaps && anyCaps.length && typeof window.hasCapability === 'function') {
      var allowed = false;
      for (var c = 0; c < anyCaps.length; c++) {
        if (window.hasCapability(anyCaps[c], user)) { allowed = true; break; }
      }
      if (!allowed) continue;
    }
    if (!canEvents && onclick.indexOf("navigate('add')") !== -1) continue;
    if (!canInventory && onclick.indexOf("navigate('stall-inventory')") !== -1) continue;
    if (!canSettings && onclick.indexOf("navigate('farm-settings')") !== -1) continue;
    if (!canFarmView && onclick.indexOf("navigate('farm-card')") !== -1) continue;
    if (!canSettings && !canFarmView && (onclick.indexOf("navigate('protocols')") !== -1)) continue;
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
 * Обработчик кнопки «Удалить» — удаляет текущий объект с подтверждением.
 * В режиме API: модалка с паролем (как на экране «Базы на сервере»), а не локальное скрытие.
 */
function handleDeleteObjectClick() {
  var select = document.getElementById('currentObjectSelect');
  var list = typeof getObjectsList === 'function' ? getObjectsList() : null;
  if (!select || !list || !list.length) {
    if (typeof showToast === 'function') showToast('Нет базы для удаления', 'info', 3000);
    return;
  }
  var id = select.value;
  var pendingId = window.CattleTrackerApi && window.CattleTrackerApi.PENDING_OBJECT_ID;
  if (pendingId && id === pendingId) {
    if (typeof showToast === 'function') showToast('Сначала выберите базу', 'info', 3000);
    return;
  }
  var obj = list.filter(function (o) { return o.id === id; })[0];
  var name = (obj && obj.name) ? obj.name : id;

  if (window.CATTLE_TRACKER_USE_API && window.CattleTrackerApi) {
    var showDel = typeof window.showDeleteBaseModal === 'function'
      ? window.showDeleteBaseModal
      : (globalThis['__syncBases'] && typeof globalThis['__syncBases'].showDeleteBaseModal === 'function'
        ? globalThis['__syncBases'].showDeleteBaseModal
        : null);
    if (showDel) {
      showDel(id, name);
      return;
    }
    if (typeof showToast === 'function') showToast('Удаление базы недоступно', 'error', 4000);
    return;
  }

  var msg = 'Удалить базу «' + String(name).replace(/</g, '&lt;') + '»? Все записи в ней будут удалены.';
  var doDelete = function () {
    if (typeof deleteObject !== 'function') {
      if (typeof showToast === 'function') showToast('Удаление недоступно', 'error', 4000);
      return;
    }
    var p = deleteObject(id);
    if (p && typeof p.then === 'function') {
      p.then(function () {
        if (typeof updateObjectSwitcher === 'function') globalThis['__menu'].updateObjectSwitcher();
        if (typeof showToast === 'function') showToast('Объект удалён', 'info');
      }).catch(function (err) {
        var m = err && err.message ? err.message : 'Ошибка удаления';
        if (typeof showToast === 'function') showToast(m, 'error', 5000);
      });
    } else {
      if (typeof updateObjectSwitcher === 'function') globalThis['__menu'].updateObjectSwitcher();
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
      if (typeof updateObjectSwitcher === 'function') globalThis['__menu'].updateObjectSwitcher();
      return;
    }
    var result = updateObject(editingId, { name: name });
    if (result && typeof result.then === 'function') {
      result.then(function () {
        if (typeof updateObjectSwitcher === 'function') globalThis['__menu'].updateObjectSwitcher();
        if (typeof showToast === 'function') showToast('Название сохранено', 'success');
      }).catch(function (err) {
        var msg = err && err.message ? err.message : 'Ошибка сохранения';
        if (typeof showToast === 'function') showToast(msg, 'error', 5000);
      });
    } else {
      if (typeof updateObjectSwitcher === 'function') globalThis['__menu'].updateObjectSwitcher();
    }
    return;
  }
  if (typeof addObject !== 'function') {
    if (typeof updateObjectSwitcher === 'function') globalThis['__menu'].updateObjectSwitcher();
    return;
  }
  var result = addObject(name);
  if (result && typeof result.then === 'function') {
    result.then(function () {
      if (typeof updateObjectSwitcher === 'function') globalThis['__menu'].updateObjectSwitcher();
      if (typeof showToast === 'function') showToast('Объект создан', 'success');
      var adminScreen = document.getElementById('admin-screen');
      if (adminScreen && adminScreen.classList.contains('active')) {
        if (typeof window.renderAdminScreen === 'function') window.renderAdminScreen();
        else if (typeof window.renderSyncServerBasesList === 'function') window.renderSyncServerBasesList();
      } else if (typeof window.renderSyncServerBasesList === 'function') {
        window.renderSyncServerBasesList();
      }
      if (typeof window.loadObjectsFromApi === 'function') window.loadObjectsFromApi();
    }).catch(function (err) {
      var msg = err && err.message ? err.message : 'Ошибка создания объекта';
      if (typeof showToast === 'function') showToast(msg, 'error', 5000);
      else if (typeof console !== 'undefined') console.error(msg);
    });
  } else {
    if (typeof updateObjectSwitcher === 'function') globalThis['__menu'].updateObjectSwitcher();
  }
}

/**
 * Обновляет переключатель объектов (баз) на экране меню
 */

  // register functions
  NS.navigateBackOrFallback = navigateBackOrFallback;
  NS.syncRouteToScreen = syncRouteToScreen;
  NS.updateWindowModeForScreen = updateWindowModeForScreen;
  NS.initMenuNotificationsLink = initMenuNotificationsLink;
  NS.initFirstRunHints = initFirstRunHints;
  NS.maybeShowFirstRunHints = maybeShowFirstRunHints;
  NS.closeFirstRunHints = closeFirstRunHints;
  NS.renderSubmenu = renderSubmenu;
  NS.showAddObjectModal = showAddObjectModal;
  NS.showEditObjectModal = showEditObjectModal;
  NS.handleEditObjectClick = handleEditObjectClick;
  NS.handleDeleteObjectClick = handleDeleteObjectClick;
  NS.hideAddObjectModal = hideAddObjectModal;
  NS.handleAddObjectClick = handleAddObjectClick;
  NS.confirmAddObject = confirmAddObject;
})();
export {};
