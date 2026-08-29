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
      { icon: '🐄', text: 'Ввести осеменение', onclick: "navigate('insemination')", anyCaps: ['eventsInput'] },
      { icon: '🐄', text: 'Запуск', onclick: "navigate('dry')", anyCaps: ['eventsInput'] },
      { icon: '🐄', text: 'Отел', onclick: "navigate('calving')", anyCaps: ['eventsInput'] },
      { icon: '⚠️', text: 'Аборт', onclick: "navigate('abort')", anyCaps: ['eventsInput'] },
      { icon: '🩺', text: 'УЗИ', onclick: "navigate('uzi')", anyCaps: ['eventsInput'] },
      { icon: '📋', text: 'На протокол', onclick: "navigate('protocol-assign')", anyCaps: ['eventsInput'] },
      { icon: '✅', text: 'Список задач', onclick: "navigate('tasks')", anyCaps: ['serviceWorksInput'] },
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
    if (screenId === 'insemination' || screenId === 'uzi' || screenId === 'protocol-assign') {
      return !window.hasCapability('eventsInput');
    }
    return !window.hasCapability('eventsInput') && !window.hasCapability('serviceWorksInput') && !window.hasCapability('farmCardEventsWrite');
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
  var parent = resolveScreenParent(_currentScreenId, typeof window !== 'undefined' ? window._submenuGroup : undefined);
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
    window._currentScreenId = screenId;
  } catch (eNavId) {}

  try {
    window.dispatchEvent(new CustomEvent('cattle-tracker:navigate', { detail: { screenId: screenId } }));
  } catch (eNav) {}

  document.querySelectorAll('.screen').forEach(function (el) {
    if (el.closest && el.closest('#root')) return;
    el.classList.remove('active');
  });

  var reactSet = window.__cattleTrackerReactScreens;
  var isReact = reactSet && typeof reactSet.has === 'function' && reactSet.has(screenId);
  if (isReact) {
    var rootEl = document.getElementById('root');
    if (rootEl) rootEl.classList.add('root--react-active');
  } else {
    var rootOff = document.getElementById('root');
    if (rootOff) rootOff.classList.remove('root--react-active');
    const screen = document.getElementById(screenId + '-screen');
    if (screen) {
      screen.classList.add('active');
    }
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

  /* init экранов — React LegacyHost / JSX (activateLegacyScreen), не здесь */
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
