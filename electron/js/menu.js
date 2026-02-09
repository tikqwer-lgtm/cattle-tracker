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
      { icon: '📋', text: 'Поставить на протокол', onclick: "navigate('protocol-assign')" }
    ]
  },
  analytics: {
    title: 'Аналитика',
    buttons: [
      { icon: '📊', text: 'Аналитика', onclick: "navigate('analytics')" }
    ]
  },
  notifications: {
    title: 'Уведомления',
    buttons: [
      { icon: '🔔', text: 'Уведомления', onclick: "navigate('notifications')" }
    ]
  },
  settings: {
    title: 'Настройки',
    buttons: [
      { icon: '👤', text: 'Войти / Пользователи', onclick: "navigate('auth')" },
      { icon: '💾', text: 'Резервные копии', onclick: "navigate('backup')" },
      { icon: '📋', text: 'Протоколы синхронизации', onclick: "navigate('protocols')" },
      { icon: '🧹', text: 'Очистить поврежденные данные', onclick: 'cleanAllEntries()', style: 'background-color: #ffc107;' },
      { icon: '🗑️', text: 'Удалить все', onclick: "if(confirm('ВНИМАНИЕ! Это удалит ВСЕ данные программы (записи, пользователи, копии) без возможности восстановления. Продолжить?')) deleteAllData()", style: 'background-color: #dc3545;' }
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

  if (screenId === 'submenu') {
    renderSubmenu();
  }
  if (screenId === 'protocols' && typeof renderProtocolsScreen === 'function') {
    renderProtocolsScreen('protocols-container');
  }
  if (screenId === 'dry' && typeof initDryScreen === 'function') initDryScreen();
  if (screenId === 'calving' && typeof initCalvingScreen === 'function') initCalvingScreen();
  if (screenId === 'protocol-assign' && typeof initProtocolAssignScreen === 'function') initProtocolAssignScreen();
  if (screenId === 'view') {
    updateViewList();
  }
  if (screenId === 'all-inseminations' && typeof renderAllInseminationsScreen === 'function') {
    renderAllInseminationsScreen();
  }
  if (screenId === 'notifications' && typeof renderNotificationCenter === 'function') {
    renderNotificationCenter('notification-center-container');
  }
  if (screenId === 'analytics' && typeof renderAnalyticsScreen === 'function') {
    renderAnalyticsScreen();
  }
  if (screenId === 'backup' && typeof renderBackupUI === 'function') {
    renderBackupUI('backup-container');
  }

  if (screenId === 'menu') {
    updateObjectSwitcher();
    updateHerdStats();
    if (typeof updateAuthBar === 'function') updateAuthBar();
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
  if (addBtn) {
    addBtn.onclick = function () {
      var name = prompt('Название новой базы (объекта):', 'Новая база');
      if (name === null) return;
      if (typeof addObject === 'function') {
        var result = addObject(name);
        if (result && typeof result.then === 'function') {
          result.then(function () { updateObjectSwitcher(); }).catch(function (err) {
            alert(err && err.message ? err.message : 'Ошибка создания объекта');
          });
        } else {
          updateObjectSwitcher();
        }
      } else {
        updateObjectSwitcher();
      }
    };
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
    return;
  }

  const totalCows = list.length;
  const pregnantCows = list.filter(e => e.status && (e.status.includes('Стельная') || e.status.includes('Отёл'))).length;
  const dryCows = list.filter(e => e.status && e.status.includes('Сухостой')).length;
  const inseminatedCows = list.filter(e => e.inseminationDate).length;
  const cullCows = list.filter(e => e.status && (e.status.toLowerCase ? e.status.toLowerCase().includes('брак') : e.status.includes('Брак'))).length;

  document.getElementById('totalCows').textContent = totalCows;
  document.getElementById('pregnantCows').textContent = pregnantCows;
  document.getElementById('dryCows').textContent = dryCows;
  document.getElementById('inseminatedCows').textContent = inseminatedCows;
  document.getElementById('cullCows').textContent = cullCows;
}

document.addEventListener('DOMContentLoaded', () => {
  navigate('menu');
});

window.addEventListener('load', () => {
  if (document.getElementById('menu-screen').classList.contains('active')) {
    updateHerdStats();
  }
});
