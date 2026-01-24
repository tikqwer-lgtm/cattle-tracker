/**
 * URL веб-приложения Google Apps Script для отправки данных.
 * Должен указывать на опубликованное веб-приложение.
 * @type {string}
 */
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxttaNc8sgtxgs8ndljPkssoJPyCjZPShh3-_6VecJ0O5EYSePn43Kl1EzAvwO0ds61/exec';

/**
 * URL CSV-экспорта Google Таблицы для загрузки данных.
 * @type {string}
 */
const GOOGLE_SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRKfT0qrSp0kFLg2VWfHHln2cN1S7syVtotWLQRSp_XJDHq7UDUPd91Ra3XHoXOjgMy6774jC_5VAEO/pub?output=csv';

/**
 * Отправляет запись в Google Таблицу.
 * @async
 * @param {Object} entry - Данные об осеменении.
 * @param {string} entry.cattleId - Номер коровы.
 * @param {string} entry.date - Дата осеменения.
 * @param {string} [entry.bull] - Бык.
 * @param {string|number} [entry.attempt] - Попытка.
 * @param {string} [entry.synchronization] - Схема СИНХ.
 * @param {string} [entry.note] - Примечание.
 * @param {string} entry.dateAdded - Дата добавления записи.
 * @param {boolean} entry.synced - Флаг синхронизации.
 */
async function saveToGoogle(entry) {
  try {
    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify(entry)
    });

    const text = await response.text();
    if (response.ok && text.includes('OK')) {
      const index = entries.findIndex(e => 
        e.cattleId === entry.cattleId && 
        e.date === entry.date && 
        e.dateAdded === entry.dateAdded
      );
      if (index !== -1) {
        entries[index].synced = true;
        saveLocally();
        updateList();
        document.getElementById('status').textContent = '✅ Отправлено в облако';
        setTimeout(() => document.getElementById('status').textContent = '', 3000);
      }
    } else {
      throw new Error('Ошибка ответа: ' + text);
    }
  } catch (error) {
    console.error('❌ Ошибка отправки:', error);
    document.getElementById('status').textContent = '⚠️ Не удалось отправить';
    setTimeout(() => document.getElementById('status').textContent = '', 5000);
  }
}

/**
 * Загружает данные из Google Таблицы по CSV-ссылке.
 * @async
 */
async function loadFromGoogle() {
  const status = document.getElementById('status');
  status.textContent = 'Загрузка...';

  try {
    const response = await fetch(GOOGLE_SHEET_CSV_URL + '&t=' + Date.now());
    const text = await response.text();
    const lines = text.trim().split('\n');

    if (lines.length < 2) {
      status.textContent = '⚠️ Таблица пуста';
      setTimeout(() => status.textContent = '', 3000);
      return;
    }

    const delimiter = lines[0].includes(';') ? ';' : ',';
    const remoteEntries = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const row = line.split(delimiter).map(cell => cell.replace(/^"(.*)"$/, '$1').trim());
      if (row.length >= 6) {
        remoteEntries.push({
          cattleId: row[0] || '',
          date: row[1] || '',
          bull: row[2] || '',
          attempt: row[3] || '',
          synchronization: row[4] || '',
          note: row[5] || '',
          synced: true,
          dateAdded: nowFormatted()
        });
      }
    }

    const merged = mergeEntries(remoteEntries, entries);
    entries = merged;
    saveLocally();
    updateList();
    status.textContent = '✅ Данные из облака загружены';
    setTimeout(() => status.textContent = '', 3000);
  } catch (error) {
    console.error('❌ Ошибка загрузки:', error);
    status.textContent = '❌ Не удалось загрузить из облака';
    setTimeout(() => status.textContent = '', 5000);
  }
}

/**
 * Сливает локальные и удалённые записи.
 * @param {Array<Object>} remote - Записи из облака.
 * @param {Array<Object>} local - Локальные записи.
 * @returns {Array<Object>} — Объединённый массив.
 */
function mergeEntries(remote, local) {
  const map = new Map();
  [...local, ...remote].forEach(e => {
    const key = e.cattleId + '|' + e.date + '|' + e.dateAdded;
    if (!map.has(key) || !map.get(key).synced) {
      map.set(key, e);
    }
  });
  return Array.from(map.values()).sort((a, b) => new Date(b.date) - new Date(a.date));
}

/**
 * Отправляет все неотправленные записи.
 * @async
 */
async function sendUnsynced() {
  const status = document.getElementById('status');
  const unsynced = entries.filter(e => !e.synced);

  if (unsynced.length === 0) {
    status.textContent = '✅ Нет неотправленных';
    setTimeout(() => status.textContent = '', 3000);
    return;
  }

  status.textContent = `Отправка ${unsynced.length}...`;
  let successCount = 0;

  for (const entry of unsynced) {
    try {
      const response = await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify(entry)
      });

      const text = await response.text();
      if (response.ok && text.includes('OK')) {
        const index = entries.findIndex(e => 
          e.cattleId === entry.cattleId && 
          e.date === entry.date && 
          e.dateAdded === entry.dateAdded
        );
        if (index !== -1) {
          entries[index].synced = true;
          successCount++;
        }
      }
    } catch (err) {
      console.error('Сеть:', err);
    }
  }

  saveLocally();
  updateList();
  status.textContent = `✅ Отправлено: ${successCount} из ${unsynced.length}`;
  setTimeout(() => status.textContent = '', 5000);
}

/**
 * Обновляет отображение списка записей.
 */
function updateList() {
  const list = document.getElementById("entriesList");
  if (!list) return;

  list.innerHTML = `<div><strong>Всего: ${entries.length}</strong></div>`;
  if (entries.length === 0) {
    list.innerHTML += `<div style="color: #999; margin-top: 10px;">Нет данных</div>`;
  } else {
    entries.forEach(entry => {
      const div = document.createElement("div");
      div.className = "entry" + (!entry.synced ? " unsynced" : "");
      div.innerHTML = `
        <strong>Корова:</strong> ${entry.cattleId} | 
        <strong>Дата осеменения:</strong> ${formatDate(entry.date)}<br>
        <strong>Дата записи:</strong> ${entry.dateAdded}<br>
        <strong>Бык:</strong> ${entry.bull || '—'} | 
        <strong>Попытка:</strong> ${entry.attempt || '—'}<br>
        <em style="color: #666;">
          ${entry.synchronization ? 'СИНХ: ' + entry.synchronization : ''} 
          ${entry.note ? '• ' + entry.note : ''}
        </em>
        ${!entry.synced ? '<span style="color: #ff9900; font-size: 12px;"> ● Не отправлено</span>' : ''}
      `;
      list.appendChild(div);
    });
  }
}
