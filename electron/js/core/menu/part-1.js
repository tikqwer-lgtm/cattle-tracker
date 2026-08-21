import { resolveScreenParent } from '../screen-parent.js';
/** __menu part 1 */
(function () {
  'use strict';
  var root = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this);
  var NS = root['__menu'] = root['__menu'] || {};
  var global = typeof window !== 'undefined' ? window : this;

var MENU_GROUPS = {
  data: {
    title: 'Животные и списки',
    buttons: [
      { icon: '➕', text: 'Добавить животное', onclick: "navigate('add')", anyCaps: ['eventsInput'] },
      { icon: '📋', text: 'Список всех животных', onclick: "navigate('view')" },
      { icon: '📑', text: 'Все осеменения', onclick: "navigate('all-inseminations')" },
      { icon: '📋', text: 'Списки', onclick: "navigate('lists')" },
      { icon: '📜', text: 'Список событий', onclick: "navigate('events')" },
      { icon: '▦', text: 'Схема стойломест', onclick: "navigate('stall-map')" },
      { icon: '☑', text: 'Инвентаризация', onclick: "navigate('stall-inventory')", anyCaps: ['inventory'] }
    ]
  },
  actions: {
    title: 'Действия',
    buttons: [
      { icon: '🐄', text: 'Ввести осеменение', onclick: "navigate('insemination')", anyCaps: ['eventsInput', 'serviceWorksInput'] },
      { icon: '🐄', text: 'Запуск', onclick: "navigate('dry')", anyCaps: ['eventsInput'] },
      { icon: '🐄', text: 'Отел', onclick: "navigate('calving')", anyCaps: ['eventsInput'] },
      { icon: '⚠️', text: 'Аборт', onclick: "navigate('abort')", anyCaps: ['eventsInput'] },
      { icon: '🩺', text: 'УЗИ', onclick: "navigate('uzi')", anyCaps: ['eventsInput', 'serviceWorksInput'] },
      { icon: '📋', text: 'На протокол', onclick: "navigate('protocol-assign')", anyCaps: ['eventsInput', 'serviceWorksInput'] },
      { icon: '📄', text: 'Сформировать отчёт', onclick: "typeof openServiceWorkReportForm === 'function' && openServiceWorkReportForm()", anyCaps: ['farmCardEventsWrite'] }
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
  settings: {
    title: 'Настройки',
    buttons: [
      { icon: '🏡', text: 'Настройки хозяйства', onclick: "navigate('farm-settings')" },
      { icon: '🔄', text: 'Синхронизация', onclick: "navigate('sync')" },
      { icon: '💬', text: 'Чат-консультант', onclick: "typeof openChatConsultant === 'function' && openChatConsultant()" }
    ]
  }
};

function viewerForbiddenScreen(screenId) {
  var groupByScreen = {
    add: 'data',
    view: 'data',
    'all-inseminations': 'data',
    lists: 'data',
    'list-uzi': 'data',
    'list-insemination': 'data',
    'list-calving': 'data',
    tasks: 'data',
    events: 'data',
    'stall-map': 'data',
    'stall-inventory': 'data',
    insemination: 'actions',
    dry: 'actions',
    calving: 'actions',
    abort: 'actions',
    uzi: 'actions',
    'protocol-assign': 'actions',
    notifications: 'notifications',
    analytics: 'analytics',
    'interval-analysis': 'analytics',
    reproduction: 'analytics',
    'farm-card': 'settings',
    'farm-settings': 'settings',
    protocols: 'settings',
    admin: 'admin'
  };
  var groupId = groupByScreen[screenId];
  if (!groupId) return false;
  if (typeof window === 'undefined' || typeof window.hasCapability !== 'function') {
    return false;
  }
  if (groupId === 'admin') return !window.hasCapability('adminUsersRoles');
  if (groupId === 'analytics') return !window.hasCapability('analytics');
  if (groupId === 'notifications') return !window.hasCapability('notifications');
  if (groupId === 'settings') {
    if (screenId === 'farm-settings') return !window.hasCapability('farmCardSettings');
    if (screenId === 'farm-card') return !window.hasCapability('farmCardView');
    return false;
  }
  if (screenId === 'list-calving') {
    return typeof window.getUiRole === 'function' && window.getUiRole() === 'service';
  }
  if (screenId === 'add') return !window.hasCapability('eventsInput');
  if (screenId === 'stall-inventory') return !window.hasCapability('inventory');
  if (groupId === 'actions') {
    var serviceOk = screenId === 'insemination' || screenId === 'uzi' || screenId === 'protocol-assign';
    if (serviceOk) {
      if (typeof window.canInputServiceWorks === 'function') return !window.canInputServiceWorks();
      return !window.hasCapability('eventsInput') && !window.hasCapability('serviceWorksInput');
    }
    return !window.hasCapability('eventsInput');
  }
  return !window.hasCapability('cards');
}

/**
 * Переход на экран подменю с заданной группой
 */
function navigateToSubmenu(groupId) {
  if (typeof window !== 'undefined' && typeof window.hasCapability === 'function') {
    if (groupId === 'actions') {
      var canActions = typeof window.canInputServiceWorks === 'function'
        ? window.canInputServiceWorks()
        : window.hasCapability('eventsInput');
      if (!canActions) return;
    }
    if (groupId === 'analytics' && !window.hasCapability('analytics')) return;
  }
  window._submenuGroup = groupId;
  navigate('submenu');
}

var _currentScreenId = null;

function applyScreenHash(screenId, options) {
  var newHash = '#' + (screenId || 'menu');
  if (screenId === 'view-cow' && options && options.cattleId) newHash += '/' + String(options.cattleId).replace(/[#/]/g, '');
  if (typeof location === 'undefined') return;
  if (typeof history !== 'undefined' && typeof history.replaceState === 'function') {
    try {
      history.replaceState(null, '', location.pathname + location.search + newHash);
      return;
    } catch (eHash) {}
  }
  if (location.hash !== newHash) location.hash = newHash;
}

function navigateToParent() {
  if (typeof window !== 'undefined' && window._navReturnTo) {
    var ret = window._navReturnTo;
    window._navReturnTo = null;
    if (typeof ret === 'string') {
      navigate(ret);
      return true;
    }
    if (ret && ret.screen) {
      if (ret.group) window._submenuGroup = ret.group;
      navigate(ret.screen);
      return true;
    }
  }
  var parent = resolveScreenParent(_currentScreenId);
  if (!parent) return false;
  if (parent.type === 'viewCowBack') {
    if (typeof window.viewCowBack === 'function') {
      window.viewCowBack();
      return true;
    }
    navigate('view');
    return true;
  }
  if (parent.group) window._submenuGroup = parent.group;
  navigate(parent.screen);
  return true;
}

/**
 * Навигация между экранами
 * @param {string} screenId - id экрана (без суффикса -screen)
 * @param {Object} [options] - опции (например { group: 'data' } для подменю)
 */
function navigate(screenId, options) {
  options = options || {};
  if (
    !options.force &&
    _currentScreenId === 'farm-card' &&
    screenId !== 'farm-card' &&
    typeof window.confirmLeaveFarmCardIfNeeded === 'function'
  ) {
    window.confirmLeaveFarmCardIfNeeded().then(function (ok) {
      if (ok) navigate(screenId, Object.assign({}, options, { force: true }));
    });
    return;
  }

  if (options.group !== undefined) {
    window._submenuGroup = options.group;
  }

  var currentUser = (typeof getCurrentUser === 'function') ? getCurrentUser() : null;
  if (screenId !== 'auth' && screenId !== 'sync' && !currentUser) {
    screenId = 'auth';
  }

  if (currentUser && viewerForbiddenScreen(screenId)) {
    if (typeof showToast === 'function') showToast('Недостаточно прав (только просмотр)', 'error');
    screenId = 'menu';
  }

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
    var vcAllInsem = globalThis['__viewCow'];
    if (vcAllInsem && typeof vcAllInsem.resetAllInseminationsRenderTarget === 'function') {
      vcAllInsem.resetAllInseminationsRenderTarget();
    }
    var allInsemCanAdd = typeof window.canInputServiceWorks === 'function'
      ? window.canInputServiceWorks()
      : (typeof window.hasCapability === 'function' && window.hasCapability('eventsInput'));
    var allInsemAddWrap = document.getElementById('allInsemAddWrap');
    var allInsemAddBtn = document.getElementById('allInsemAddBtn');
    if (allInsemAddWrap) allInsemAddWrap.hidden = !allInsemCanAdd;
    if (allInsemAddBtn && !allInsemAddBtn.dataset.bound) {
      allInsemAddBtn.dataset.bound = '1';
      allInsemAddBtn.addEventListener('click', function () {
        window._navReturnTo = 'all-inseminations';
        navigate('insemination');
      });
    }
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
  if (screenId === 'list-uzi' && typeof window.renderUziListSubScreen === 'function') {
    var uziContainer = document.getElementById('list-uzi-container');
    if (uziContainer) window.renderUziListSubScreen(uziContainer);
  }
  if (screenId === 'list-insemination' && typeof window.renderInseminationListSubScreen === 'function') {
    var insemContainer = document.getElementById('list-insemination-container');
    if (insemContainer) window.renderInseminationListSubScreen(insemContainer);
  }
  if (screenId === 'list-calving' && typeof window.renderCalvingListSubScreen === 'function') {
    var calvingContainer = document.getElementById('list-calving-container');
    if (calvingContainer) {
      var calvingPreset = null;
      if (window._listsCalvingPreset) {
        calvingPreset = window._listsCalvingPreset;
        window._listsCalvingPreset = null;
        window._listsCalvingView = calvingPreset;
      } else if (window._listsCalvingView) {
        calvingPreset = window._listsCalvingView;
      } else if (typeof globalThis['__menu'].getMenuCalvingViewYearMonth === 'function') {
        calvingPreset = globalThis['__menu'].getMenuCalvingViewYearMonth();
      }
      window.renderCalvingListSubScreen(calvingContainer, calvingPreset);
    }
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
      if (titleEl) titleEl.textContent = 'Добавить животное';
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
    if (typeof globalThis['__menu'].updateMenuGroupVisibility === 'function') globalThis['__menu'].updateMenuGroupVisibility();
    if (typeof globalThis['__menu'].updateVersionSwitcher === 'function') globalThis['__menu'].updateVersionSwitcher();
    globalThis['__menu'].updateObjectSwitcher();
    if (typeof updateAuthBar === 'function') updateAuthBar();
    if (typeof initFirstRunHints === 'function') globalThis['__menu'].initFirstRunHints();
    if (typeof maybeShowFirstRunHints === 'function') globalThis['__menu'].maybeShowFirstRunHints();
    if (typeof window.checkMobileApkUpdate === 'function') window.checkMobileApkUpdate(true);
  }
  if (screenId === 'herd-hub') {
    if (typeof globalThis['__menu'].updateMenuGroupVisibility === 'function') globalThis['__menu'].updateMenuGroupVisibility();
    if (typeof initMenuCalvingForecast === 'function') globalThis['__menu'].initMenuCalvingForecast();
    globalThis['__menu'].updateHerdStats();
    if (typeof initMenuNotificationsLink === 'function') globalThis['__menu'].initMenuNotificationsLink();
  }
  if (typeof updateNotificationIndicators === 'function') updateNotificationIndicators();

  applyScreenHash(screenId, options);
}

/**
 * Возврат на родителя в иерархии экранов.
 */
function navigateBack() {
  return navigateToParent();
}

function getCurrentScreenId() {
  return _currentScreenId;
}

  // register functions
  NS.MENU_GROUPS = MENU_GROUPS;
  NS.viewerForbiddenScreen = viewerForbiddenScreen;
  NS.navigateToSubmenu = navigateToSubmenu;
  NS.navigate = navigate;
  NS.navigateBack = navigateBack;
  NS.navigateToParent = navigateToParent;
  NS.getCurrentScreenId = getCurrentScreenId;
})();
export {};
