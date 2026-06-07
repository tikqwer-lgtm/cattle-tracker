/** __menu part 1 */
(function () {
  'use strict';
  var root = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this);
  var NS = root['__menu'] = root['__menu'] || {};
  var global = typeof window !== 'undefined' ? window : this;

var MENU_GROUPS = {
  data: {
    title: 'Работа с данными',
    buttons: [
      { icon: '➕', text: 'Добавить животное', onclick: "navigate('add')", viewerHide: true },
      { icon: '📋', text: 'Список всех животных', onclick: "navigate('view')" },
      { icon: '📑', text: 'Все осеменения', onclick: "navigate('all-inseminations')" },
      { icon: '📋', text: 'Списки', onclick: "navigate('lists')" },
      { icon: '📜', text: 'Список событий', onclick: "navigate('events')" },
      { icon: '▦', text: 'Схема стойломест', onclick: "navigate('stall-map')" },
      { icon: '☑', text: 'Инвентаризация', onclick: "navigate('stall-inventory')" }
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
      { icon: '📇', text: 'Карточка хозяйства', onclick: "navigate('farm-card')" },
      { icon: '🏡', text: 'Настройки хозяйства', onclick: "navigate('farm-settings')" },
      { icon: '🔄', text: 'Синхронизация', onclick: "navigate('sync')" },
      { icon: '❓', text: 'Справка', onclick: "navigate('help')" },
      { icon: '💬', text: 'Чат-консультант', onclick: "typeof openChatConsultant === 'function' && openChatConsultant()" }
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

  try {
    window.dispatchEvent(new CustomEvent('cattle-tracker:navigate', { detail: { screenId: screenId } }));
  } catch (eNav) {}

  document.querySelectorAll('.screen').forEach(el => {
    el.classList.remove('active');
  });

  const screen = document.getElementById(screenId + '-screen');
  if (screen) {
    screen.classList.add('active');
  }

  if (typeof updateWindowModeForScreen === 'function') {
    globalThis['__menu'].updateWindowModeForScreen(screenId);
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
  /* Схема стойломест: WebView/Capacitor после сворачивания иногда «теряет» отрисовку ячеек — тот же мягкий repaint. */
  if (screenId === 'stall-map') {
    setTimeout(function () {
      if (typeof window.softRepaintCattleTrackerView === 'function') window.softRepaintCattleTrackerView();
      if (typeof window.stallMapRedrawIfActive === 'function') window.stallMapRedrawIfActive();
    }, 0);
    setTimeout(function () {
      if (typeof window.softRepaintCattleTrackerView === 'function') window.softRepaintCattleTrackerView();
      if (typeof window.stallMapRedrawIfActive === 'function') window.stallMapRedrawIfActive();
    }, 220);
  }

  if (screenId === 'submenu') {
    globalThis['__menu'].renderSubmenu();
  }
  if (screenId === 'protocols' && typeof renderProtocolsScreen === 'function') {
    renderProtocolsScreen('protocols-container');
  }
  /* farm-settings: React pilot (js/screens/FarmSettings.tsx) */
  if (screenId === 'farm-card' && typeof window.initFarmCardPanel === 'function') {
    window.initFarmCardPanel();
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
  if (screenId === 'stall-map' && typeof window.initStallMapScreen === 'function') {
    window.initStallMapScreen();
  }
  if (screenId === 'stall-inventory' && typeof window.initStallInventoryScreen === 'function') {
    window.initStallInventoryScreen();
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
    globalThis['__menu'].updateObjectSwitcher();
    if (typeof initMenuCalvingForecast === 'function') globalThis['__menu'].initMenuCalvingForecast();
    globalThis['__menu'].updateHerdStats();
    if (typeof updateAuthBar === 'function') updateAuthBar();
    if (typeof renderNotificationSummary === 'function') renderNotificationSummary('menuNotificationsBody');
    if (typeof initMenuNotificationsToggle === 'function') globalThis['__menu'].initMenuNotificationsToggle();
    if (typeof initFirstRunHints === 'function') globalThis['__menu'].initFirstRunHints();
    if (typeof maybeShowFirstRunHints === 'function') globalThis['__menu'].maybeShowFirstRunHints();
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

  // register functions
  NS.viewerForbiddenScreen = viewerForbiddenScreen;
  NS.navigateToSubmenu = navigateToSubmenu;
  NS.navigate = navigate;
  NS.navigateBack = navigateBack;
})();
export {};
