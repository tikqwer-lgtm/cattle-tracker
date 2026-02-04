// view-cow.js — Логика просмотра карточки животного

/**
 * Просмотр полной карточки животного
 */
function viewCow(cattleId) {
  const entry = entries.find(e => e.cattleId === cattleId);
  if (!entry) {
    console.warn('Животное не найдено:', cattleId);
    return;
  }

  // Перейти на экран просмотра карточки
  navigate('view-cow');

  // Заполнить карточку
  const card = document.getElementById('viewCowCard');
  if (!card) return;

  card.innerHTML = `
    <div class="cow-card">
      <h2>Карточка животного №${entry.cattleId}</h2>

      <div class="cow-details-grid">
        <div><strong>Кличка:</strong> ${entry.nickname || '—'}</div>
        <div><strong>Дата рождения:</strong> ${formatDate(entry.birthDate) || '—'}</div>
        <div><strong>Лактация:</strong> ${entry.lactation || '—'}</div>
        <div><strong>Дата отёла:</strong> ${formatDate(entry.calvingDate) || '—'}</div>
        
        <div><strong>Дата осеменения:</strong> ${formatDate(entry.inseminationDate) || '—'}</div>
        <div><strong>Номер попытки:</strong> ${entry.attemptNumber || '—'}</div>
        <div><strong>Бык:</strong> ${entry.bull || '—'}</div>
        <div><strong>Осеменитель:</strong> ${entry.inseminator || '—'}</div>
        
        <div><strong>Код:</strong> ${entry.code || '—'}</div>
        <div><strong>Статус:</strong> ${entry.status || '—'}</div>
        <div><strong>Дата выбытия:</strong> ${formatDate(entry.exitDate) || '—'}</div>
        <div><strong>Начало сухостоя:</strong> ${formatDate(entry.dryStartDate) || '—'}</div>
        
        <div><strong>ВСП (дни):</strong> ${entry.vwp || '—'}</div>
        <div><strong>Протокол:</strong> ${entry.protocolName || '—'}</div>
        <div><strong>Начало протокола:</strong> ${formatDate(entry.protocolStartDate) || '—'}</div>
        <div><strong>Примечание:</strong> ${entry.note || '—'}</div>

        <div><strong>Синхронизация:</strong> ${entry.synced ? '✅' : '🟡'}</div>
      </div>

      <div class="cow-card-actions">
        <button onclick="navigate('view')" class="back-button">Назад к списку</button>
      </div>
    </div>
  `;
}

// Обновление списка записей: добавление возможности клика по строке
function updateViewListWithClick() {
  const container = document.getElementById('viewEntriesList');
  if (!container) return;

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
          <tr class="${entry.synced ? '' : 'unsynced'}" onclick="viewCow('${entry.cattleId}')" style="cursor: pointer;">
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
              <button onclick="editEntry('${entry.cattleId}'); event.stopPropagation();" class="small-btn edit">✏️</button>
              <button onclick="deleteEntry('${entry.cattleId}'); event.stopPropagation();" class="small-btn delete">🗑️</button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

// Замена оригинальной функции
window.updateViewList = updateViewListWithClick;