// app.js — Учёт осеменения коров
// Совместим с voice.js

/**
 * Загружает записи из localStorage при запуске
 */
function loadLocally() {
  const saved = localStorage.getItem('cattleEntries');
  if (saved) {
    entries = JSON.parse(saved);
    updateList();
  } else {
    entries = [];
  }
}

/**
 * Сохраняет записи в localStorage
 */
function saveLocally() {
  localStorage.setItem('cattleEntries', JSON.stringify(entries));
}

/**
 * Добавляет новую запись
 */
function addEntry() {
  const cattleId = document.getElementById("cattleId").value.trim();
  const date = document.getElementById("date").value;

  if (!cattleId || !date) {
    alert("Заполните номер коровы и дату осеменения!");
    return;
  }

  const entry = {
    cattleId,
    date,
    bull: document.getElementById("bull").value || '',
    attempt: document.getElementById("attempt").value || '',
    synchronization: document.getElementById("sync").value || '',
    note: document.getElementById("note").value || '',
    synced: false,
    dateAdded: nowFormatted()
  };

  entries.unshift(entry);
  saveLocally();
  updateList();
  clearForm();
}

/**
 * Очищает форму после добавления
 */
function clearForm() {
  document.getElementById("cattleId").value = '';
  document.getElementById("date").value = '';
  document.getElementById("bull").value = '';
  document.getElementById("attempt").value = '';
  document.getElementById("sync").value = '';
  document.getElementById("note").value = '';
}

/**
 * Возвращает текущую дату и время в формате строки "дд.мм.гггг чч:мм"
 * @returns {string}
 */
function nowFormatted() {
  const now = new Date();
  return now.toLocaleDateString("ru-RU") + " " +
         now.toLocaleTimeString("ru-RU", { hour: '2-digit', minute: '2-digit' });
}

/**
 * Обновляет отображение списка записей
 */
function updateList() {
  const list = document.getElementById("entriesList");
  if (!list) return;

  list.innerHTML = `<div><strong>Всего: ${entries.length}</strong></div>`;
  if (entries.length === 0) {
    list.innerHTML += `<div style="color: #999; margin-top: 10px;">Нет данных</div>`;
  } else {
    entries.forEach(entry => {
      // Форматируем дату записи только при отображении
      const dateAddedFormatted = entry.dateAdded instanceof Date
        ? entry.dateAdded.toLocaleString("ru-RU", {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })
        : entry.dateAdded;

      const div = document.createElement("div");
      div.className = "entry" + (!entry.synced ? " unsynced" : "");
      div.innerHTML = `
        <strong>Корова:</strong> ${entry.cattleId} | 
        <strong>Дата осеменения:</strong> ${formatDate(entry.date)}<br>
        <strong>Дата записи:</strong> ${dateAddedFormatted}<br>
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

/**
 * Форматирует дату в виде "дд.мм.гггг"
 * @param {string} dateStr
 * @returns {string}
 */
function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString("ru-RU");
}

/**
 * Обрабатывает распознанную голосовую команду
 * Вызывается из voice.js
 * Пример: "корова 105, дата 10 марта 2025, бык Бык-3, попытка 1, СИНХ Пи-Джи-шесть-же, примечание первая"
 * @param {string} command
 */
function parseVoiceCommand(command) {
  // Поиск номера коровы
  const cattleMatch = command.match(/(?:корова|номер)\s+(\d+)/i);
  // Поиск быка
  const bullMatch = command.match(/бык\s+([^\s,]+)/i);
  // Поиск попытки
  const attemptMatch = command.match(/попытка\s+(\d+)/i);
  // Поиск схемы СИНХ
  const syncMatch = command.match(/синх\s+(.+)/i);
  // Поиск примечания
  const noteMatch = command.match(/примечание\s+(.+)/i);

  // Разбор даты
  let dateValue = '';
  const dateMatch = command.match(/(\d{1,2})[^\w]*(январ[яь]|феврал[яь]|март[а]?|апрел[яь]|май[я]?|июн[яь]?|июл[яь]?|август[а]?|сентябр[яь]|октябр[яь]|ноябр[яь]|декабр[яь])/i);
  if (dateMatch) {
    const day = dateMatch[1].padStart(2, '0');
    const monthNames = {
      'январь': '01', 'февраль': '02', 'март': '03', 'апрель': '04',
      'май': '05', 'июнь': '06', 'июль': '07', 'август': '08',
      'сентябрь': '09', 'октябрь': '10', 'ноябрь': '11', 'декабрь': '12'
    };
    const month = monthNames[dateMatch[2].toLowerCase()];
    const yearMatch = command.match(/(20\d{2})/);
    const year = yearMatch ? yearMatch[1] : new Date().getFullYear();
    dateValue = `${year}-${month}-${day}`;
  }

  // Обработка СИНХ
  let syncValue = '';
  if (syncMatch) {
    const raw = syncMatch[1].toLowerCase();
    if (/пи-джи-шесть-же|пджи-шесть-же|пг6-г|pg6-g/.test(raw)) syncValue = 'PG6-G';
    else if (/овсинх|ов-синх/.test(raw)) syncValue = 'Ovsynch';
    else if (/косинх|ко-синх/.test(raw)) syncValue = 'Cosynch';
    else if (/другое/.test(raw)) syncValue = 'Другое';
  }

  // Заполняем поля
  if (cattleMatch) document.getElementById('cattleId').value = cattleMatch[1];
  if (dateValue) document.getElementById('date').value = dateValue;
  if (bullMatch) document.getElementById('bull').value = bullMatch[1];
  if (attemptMatch) document.getElementById('attempt').value = attemptMatch[1];
  if (syncValue) document.getElementById('sync').value = syncValue;
  if (noteMatch) document.getElementById('note').value = noteMatch[1];

  // Обратная связь
  const status = document.getElementById('status');
  if (status) {
    status.textContent = `✅ Обработано: ${command}`;
    setTimeout(() => { status.textContent = ''; }, 5000);
  }
}
/**
 * Добавляет запись из голосового помощника
 * @param {Object} data
 */
function addEntryFromVoice(data) {
  // Заполняем форму
  document.getElementById('cattleId').value = data.cattleId || '';
  document.getElementById('date').value = data.date || '';
  document.getElementById('bull').value = data.bull || '';
  document.getElementById('attempt').value = data.attempt || '';
  document.getElementById('sync').value = data.synchronization || '';
  document.getElementById('note').value = data.note || '';

  // Добавляем как обычную запись
  addEntry();
}