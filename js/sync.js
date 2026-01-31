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
 * Флаг, предотвращающий параллельный запуск отправки неотправленных записей.
 * @type {boolean}
 */
let isSendingUnsynced = false;

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
 * Загружает данные из Google Таблицы и синхронизирует с локальными записями.
 * Сохраняет: все записи из облака + локальные неотправленные (если их нет в облаке).
 * Удаляет локальные записи, удалённые в облаке.
 * @async
 */
async function loadFromGoogle() {
  const status = document.getElementById('status');
  status.textContent = 'Синхронизация...';

  try {
    const response = await fetch(GOOGLE_SHEET_CSV_URL + '&t=' + Date.now());
    const text = await response.text();
    const lines = text.trim().split('\n');

    if (lines.length < 2) {
      status.textContent = '⚠️ Таблица пуста';
      setTimeout(() => status.textContent = '', 3000);

      // Очищаем локальные синхронизированные, оставляем только неотправленные
      entries = entries.filter(e => !e.synced);
      saveLocally();
      updateList();
      return;
    }

    const delimiter = lines[0].includes(';') ? ';' : ',';
    const cloudEntries = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const row = line.split(delimiter).map(cell => cell.replace(/^"(.*)"$/, '$1').trim());
      if (row.length >= 6) {
        cloudEntries.push({
          cattleId: row[0] || '',
          date: row[1] || '',
          bull: row[2] || '',
          attempt: row[3] || '',
          synchronization: row[4] || '',
          note: row[5] || '',
          synced: true,
          dateAdded: nowFormatted() // дата загрузки
        });
      }
    }

    // Создаём множество ключей из облака: "cattleId|date"
    const cloudKeys = new Set(cloudEntries.map(e => e.cattleId + '|' + e.date));

    // Оставляем только неотправленные записи, которых нет в облаке
    const unsyncedNew = entries
      .filter(e => !e.synced)
      .filter(e => !cloudKeys.has(e.cattleId + '|' + e.date));

    // Объединяем: все записи из облака + новые локальные
    entries = [...cloudEntries, ...unsyncedNew];

    saveLocally();
    updateList();
    status.textContent = '✅ Синхронизация завершена';
    setTimeout(() => status.textContent = '', 3000);
  } catch (error) {
    console.error('❌ Ошибка синхронизации:', error);
    status.textContent = '❌ Не удалось синхронизировать';
    setTimeout(() => status.textContent = '', 5000);
  }
}

/**
 * Отправляет все неотправленные записи в Google Таблицу.
 * Защищает от повторного нажатия и дублирования.
 * Блокирует кнопку на время отправки.
 * @async
 */
async function sendUnsynced() {
  // Защита от повторного запуска
  if (isSendingUnsynced) {
    document.getElementById('status').textContent = '⏳ Уже идёт отправка...';
    setTimeout(() => document.getElementById('status').textContent = '', 2000);
    return;
  }

  const status = document.getElementById('status');
  const button = document.querySelector('button[onclick="sendUnsynced()"]');
  const unsynced = entries.filter(e => !e.synced);

  if (unsynced.length === 0) {
    status.textContent = '✅ Нет неотправленных';
    setTimeout(() => status.textContent = '', 3000);
    return;
  }

  // Блокируем кнопку
  isSendingUnsynced = true;
  button.disabled = true;
  button.style.opacity = '0.6';
  status.textContent = `Отправка ${unsynced.length}...`;

  let successCount = 0;

  try {
    for (const entry of unsynced) {
      try {
        const response = await fetch(GOOGLE_SCRIPT_URL, {
          method: 'POST',
          body: JSON.stringify(entry)
        });

        const text = await response.text();
        if (response.ok && text.includes('OK')) {
          // Обновляем synced в основном массиве
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
        console.error('Ошибка отправки:', err);
      }
    }

    saveLocally();
    updateList();
    status.textContent = `✅ Отправлено: ${successCount} из ${unsynced.length}`;
  } finally {
    // Всегда разблокируем
    isSendingUnsynced = false;
    button.disabled = false;
    button.style.opacity = '1';
    setTimeout(() => status.textContent = '', 5000);
  }
}

/**
 * Обновляет отображение списка записей.
 * Определена в app.js для доступности при инициализации.
 */
