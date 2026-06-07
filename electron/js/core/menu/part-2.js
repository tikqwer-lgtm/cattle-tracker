/** __menu part 2 */
(function () {
  'use strict';
  var root = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this);
  var NS = root['__menu'] = root['__menu'] || {};
  var global = typeof window !== 'undefined' ? window : this;

function navigateBackOrFallback() {
  if (_navStack.length > 0) {
    return globalThis['__menu'].navigateBack();
  }
  if (typeof navigate === 'function') globalThis['__menu'].navigate('submenu');
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
  if (currentUser && currentUser.role === 'viewer' && globalThis['__menu'].viewerForbiddenScreen(screenId)) {
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
        if (typeof updateObjectSwitcher === 'function') globalThis['__menu'].updateObjectSwitcher();
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
  NS.initMenuNotificationsToggle = initMenuNotificationsToggle;
  NS.setMenuNotificationsOpen = setMenuNotificationsOpen;
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
