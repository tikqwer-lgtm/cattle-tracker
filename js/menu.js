/**
 * Навигация между экранами
 * @param {string} screenId — id экрана: 'menu', 'add', 'view', 'analytics'
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
}

/**
 * Обновляет список на экране просмотра
 */
function updateViewList() {
  const container = document.getElementById('viewEntriesList');
  if (!container) return;

  if (entries.length === 0) {
    container.innerHTML = '<p>Нет записей</p>';
    return;
  }

  container.innerHTML = entries.map(entry => `
    <div class="entry ${entry.synced ? '' : 'unsynced'}">
      <strong>Корова: ${entry.cattleId}</strong> (${entry.nickname || '—'})
      <em>Лактация: ${entry.lactation}</em>
      <em>Дата осеменения: ${formatDate(entry.inseminationDate)}</em>
      ${entry.bull ? `<em>Бык: ${entry.bull}</em>` : ''}
      ${entry.attemptNumber ? `<em>Попытка: ${entry.attemptNumber}</em>` : ''}
      ${entry.status ? `<em>Статус: ${entry.status}</em>` : ''}
      ${entry.calvingDate ? `<em>Отёл: ${formatDate(entry.calvingDate)}</em>` : ''}
      ${entry.dryStartDate ? `<em>Сухостой: ${formatDate(entry.dryStartDate)}</em>` : ''}
      ${entry.note ? `<em>Примечание: ${entry.note}</em>` : ''}
      <small>${entry.synced ? '✅ Синхронизировано' : '🟡 Не отправлено'}</small>
    </div>
    <div class="entry-actions">
      <button onclick="editEntry('${entry.cattleId}')" class="small-btn edit">✏️</button>
      <button onclick="deleteEntry('${entry.cattleId}')" class="small-btn delete">🗑️</button>
    </div>
  `).join('');
}

// При загрузке сразу открываем меню
document.addEventListener('DOMContentLoaded', () => {
navigate('menu');
});