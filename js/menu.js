// menu.js — Навигация между экранами

/**
 * Навигация между экранами
 */
function navigate(screenId) {
  // Скрыть все экраны
  document.querySelectorAll('.screen').forEach(el => {
    el.classList.remove('active');
  });

  // Показать нужный
  const screen = document.getElementById(screenId + '-screen');
  if (screen) {
    screen.classList.add('active');
  }

  // Обновить список при открытии "Просмотр"
  if (screenId === 'view') {
    updateViewList();
  }
  
  // Обновить статистику при открытии меню
  if (screenId === 'menu') {
    updateHerdStats();
  }
}

/**
 * Обновляет список на экране просмотра
 */
function updateViewList() {
  const container = document.getElementById('viewEntriesList');
  if (!container) return;

  // Проверяем что entries существует
  if (!entries || entries.length === 0) {
    container.innerHTML = '<p>Нет записей</p>';
    return;
  }

  container.innerHTML = `
    <table class="entries-table">
      <thead>
        <tr>
          <th>Корова</th>
          <th>Кличка</th>
          <th>Лактация</th>
          <th>Дата осеменения</th>
          <th>Бык</th>
          <th>Попытка</th>
          <th>Статус</th>
          <th>Отёл</th>
          <th>Сухостой</th>
          <th>Примечание</th>
          <th>Синхронизация</th>
          <th>Действия</th>
        </tr>
      </thead>
      <tbody>
        ${entries.map(entry => `
          <tr class="${entry.synced ? '' : 'unsynced'}">
            <td>${entry.cattleId}</td>
            <td>${entry.nickname || '—'}</td>
            <td>${entry.lactation}</td>
            <td>${formatDate(entry.inseminationDate)}</td>
            <td>${entry.bull || '—'}</td>
            <td>${entry.attemptNumber || '—'}</td>
            <td>${entry.status || '—'}</td>
            <td>${formatDate(entry.calvingDate) || '—'}</td>
            <td>${formatDate(entry.dryStartDate) || '—'}</td>
            <td>${entry.note || '—'}</td>
            <td>${entry.synced ? '✅' : '🟡'}</td>
            <td class="actions-cell">
              <button onclick="editEntry('${entry.cattleId}')" class="small-btn edit">✏️</button>
              <button onclick="deleteEntry('${entry.cattleId}')" class="small-btn delete">🗑️</button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

/**
 * Обновляет статистику стада на главном экране
 */
function updateHerdStats() {
  if (!entries || entries.length === 0) {
    document.getElementById('totalCows').textContent = '0';
    document.getElementById('pregnantCows').textContent = '0';
    document.getElementById('dryCows').textContent = '0';
    document.getElementById('inseminatedCows').textContent = '0';
    document.getElementById('cullCows').textContent = '0';
    return;
  }

  const totalCows = entries.length;
  const pregnantCows = entries.filter(e => e.status && e.status.includes('Отёл')).length;
  const dryCows = entries.filter(e => e.status && e.status.includes('Сухостой')).length;
  const inseminatedCows = entries.filter(e => e.inseminationDate).length;
  const cullCows = entries.filter(e => e.status && e.status.includes('брак')).length;

  document.getElementById('totalCows').textContent = totalCows;
  document.getElementById('pregnantCows').textContent = pregnantCows;
  document.getElementById('dryCows').textContent = dryCows;
  document.getElementById('inseminatedCows').textContent = inseminatedCows;
  document.getElementById('cullCows').textContent = cullCows;
}

// При загрузке сразу открываем меню
document.addEventListener('DOMContentLoaded', () => {
  navigate('menu');
});

// Обновить статистику при загрузке
window.addEventListener('load', () => {
  if (document.getElementById('menu-screen').classList.contains('active')) {
    updateHerdStats();
  }
});