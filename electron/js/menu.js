// menu.js — Навигация между экранами, переключатель объектов, статистика стада

/**
 * Навигация между экранами
 */
function navigate(screenId) {
  document.querySelectorAll('.screen').forEach(el => {
    el.classList.remove('active');
  });

  const screen = document.getElementById(screenId + '-screen');
  if (screen) {
    screen.classList.add('active');
  }

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
