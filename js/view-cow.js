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
        <div><strong>Протокол:</strong> ${(entry.protocol && entry.protocol.name) || entry.protocolName || '—'}</div>
        <div><strong>Начало протокола:</strong> ${formatDate((entry.protocol && entry.protocol.startDate) || entry.protocolStartDate) || '—'}</div>
        <div><strong>Примечание:</strong> ${entry.note || '—'}</div>

        <div><strong>Синхронизация:</strong> ${entry.synced ? '✅' : '🟡'}</div>
      </div>

      <div class="cow-card-actions">
        <button onclick="editEntry('${entry.cattleId}');" class="small-btn edit">✏️ Редактировать</button>
        <button onclick="navigate('view')" class="back-button">Назад к списку</button>
      </div>
    </div>
  `;
}

// Список записей с групповым выделением рисуется в menu.js (updateViewList).
// Открытие карточки животного — по кнопке «Карточка» в строке или по вызову viewCow(cattleId).