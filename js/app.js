// app.js — Учёт коров с расширенным функционалом
// Совместим с voice.js

// Объявление entries, если не определено в storage.js
if (typeof entries === 'undefined') {
  let entries = [];
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
 * Добавляет новую запись
 */
function addEntry() {
  const cattleId = document.getElementById("cattleId").value.trim();
  const inseminationDate = document.getElementById("inseminationDate").value;

  if (!cattleId || !inseminationDate) {
    alert("Заполните номер коровы и дату осеменения!");
    return;
  }

  const entry = getDefaultCowEntry();

  // Основные поля
  entry.cattleId = cattleId;
  entry.nickname = document.getElementById("nickname").value || '';
  entry.birthDate = document.getElementById("birthDate").value || '';
  entry.lactation = parseInt(document.getElementById("lactation").value) || 1;
  entry.calvingDate = document.getElementById("calvingDate").value || '';
  entry.inseminationDate = inseminationDate;
  entry.attemptNumber = parseInt(document.getElementById("attemptNumber").value) || 1;
  entry.bull = document.getElementById("bull").value || '';
  entry.inseminator = document.getElementById("inseminator").value || '';
  entry.code = document.getElementById("code").value || '';
  entry.status = document.getElementById("status").value || 'Охота';
  entry.exitDate = document.getElementById("exitDate").value || '';
  entry.dryStartDate = document.getElementById("dryStartDate").value || '';
  entry.vwp = parseInt(document.getElementById("vwp").value) || 60;

  // Протокол синхронизации
  entry.protocol.name = document.getElementById("protocolName").value || '';
  entry.protocol.startDate = document.getElementById("protocolStartDate").value || '';

  // Вычисляемые поля (пока 0, позже можно реализовать логику)
  // lactationDay, dryDays, ageAtFirstCalving, servicePeriod, calvingInterval, pr, cr, hdr

  entries.unshift(entry);
  saveLocally();
  updateList();
  if (typeof updateViewList === 'function') {
    updateViewList();
  }
  clearForm();
  // После добавления или редактирования переключаемся на просмотр
  navigate('view');}

/**
 * Очищает форму после добавления
 */
function clearForm() {
  document.getElementById("cattleId").value = '';
  document.getElementById("nickname").value = '';
  document.getElementById("birthDate").value = '';
  document.getElementById("lactation").value = '1';
  document.getElementById("calvingDate").value = '';
  document.getElementById("inseminationDate").value = '';
  document.getElementById("attemptNumber").value = '1';
  document.getElementById("bull").value = '';
  document.getElementById("inseminator").value = '';
  document.getElementById("code").value = '';
  document.getElementById("status").value = 'Охота';
  document.getElementById("protocolName").value = '';
  document.getElementById("protocolStartDate").value = '';
  document.getElementById("exitDate").value = '';
  document.getElementById("dryStartDate").value = '';
  document.getElementById("vwp").value = '60';
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
      // Форматируем дату записи
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
        <strong>Кличка:</strong> ${entry.nickname || '—'}<br>
        <strong>Дата осеменения:</strong> ${formatDate(entry.inseminationDate)} | 
        <strong>Лактация:</strong> ${entry.lactation}<br>
        <strong>Бык:</strong> ${entry.bull || '—'} | 
        <strong>Попытка:</strong> ${entry.attemptNumber || '—'} | 
        <strong>Статус:</strong> ${entry.status}<br>
        <em style="color: #666;">
          ${entry.code ? 'Код: ' + entry.code + ' • ' : ''}
          ${entry.calvingDate ? 'Отёл: ' + formatDate(entry.calvingDate) + ' • ' : ''}
          ${entry.dryStartDate ? 'Сухостой: ' + formatDate(entry.dryStartDate) + ' • ' : ''}
          ${entry.note ? entry.note : ''}
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
 * Пример: "корова 105, кличка Машка, дата 10 марта 2025, бык Бык-3, попытка 1, статус Осеменена"
 * @param {string} command
 */
function parseVoiceCommand(command) {
  // Поиск номера коровы
  const cattleMatch = command.match(/(?:корова|номер)\s+(\d+)/i);
  // Поиск клички
  const nicknameMatch = command.match(/кличка\s+([^\s,]+)/i);
  // Поиск быка
  const bullMatch = command.match(/бык\s+([^\s,]+)/i);
  // Поиск попытки
  const attemptMatch = command.match(/попытка\s+(\d+)/i);
  // Поиск статуса
  const statusMatch = command.match(/статус\s+([^\s,]+)/i);
  // Поиск кода осеменения
  const codeMatch = command.match(/код\s+([^\s,]+)/i);
  // Поиск осеменатора
  const inseminatorMatch = command.match(/осеменатор\s+([^\s,]+)/i);
  // Поиск даты осеменения
  let inseminationDate = '';
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
    inseminationDate = `${year}-${month}-${day}`;
  }

  // Заполняем поля
  if (cattleMatch) document.getElementById('cattleId').value = cattleMatch[1];
  if (nicknameMatch) document.getElementById('nickname').value = nicknameMatch[1];
  if (inseminationDate) document.getElementById('inseminationDate').value = inseminationDate;
  if (bullMatch) document.getElementById('bull').value = bullMatch[1];
  if (attemptMatch) document.getElementById('attemptNumber').value = attemptMatch[1];
  if (statusMatch) document.getElementById('status').value = statusMatch[1];
  if (codeMatch) document.getElementById('code').value = codeMatch[1];
  if (inseminatorMatch) document.getElementById('inseminator').value = inseminatorMatch[1];

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
  document.getElementById('nickname').value = data.nickname || '';
  document.getElementById('inseminationDate').value = data.inseminationDate || '';
  document.getElementById('bull').value = data.bull || '';
  document.getElementById('attemptNumber').value = data.attemptNumber || '';
  document.getElementById('status').value = data.status || '';
  document.getElementById('code').value = data.code || '';
  document.getElementById('inseminator').value = data.inseminator || '';

  // Добавляем как обычную запись
  addEntry();
}

/**
 * Редактирует существующую запись
 * @param {string} cattleId - Номер коровы
 */
function editEntry(cattleId) {
  const entry = entries.find(e => e.cattleId === cattleId);
  if (!entry) {
    alert('Запись не найдена!');
    return;
  }

  // Заполняем форму данными из записи
  document.getElementById('cattleId').value = entry.cattleId;
  document.getElementById('nickname').value = entry.nickname || '';
  document.getElementById('birthDate').value = entry.birthDate || '';
  document.getElementById('lactation').value = entry.lactation || 1;
  document.getElementById('calvingDate').value = entry.calvingDate || '';
  document.getElementById('inseminationDate').value = entry.inseminationDate || '';
  document.getElementById('attemptNumber').value = entry.attemptNumber || 1;
  document.getElementById('bull').value = entry.bull || '';
  document.getElementById('inseminator').value = entry.inseminator || '';
  document.getElementById('code').value = entry.code || '';
  document.getElementById('status').value = entry.status || 'Охота';
  document.getElementById('exitDate').value = entry.exitDate || '';
  document.getElementById('dryStartDate').value = entry.dryStartDate || '';
  document.getElementById('vwp').value = entry.vwp || 60;
  document.getElementById('protocolName').value = entry.protocol.name || '';
  document.getElementById('protocolStartDate').value = entry.protocol.startDate || '';
  document.getElementById('note').value = entry.note || '';

  // Переключаемся на экран добавления/редактирования
  navigate('add');
}

/**
 * Удаляет запись
 * @param {string} cattleId - Номер коровы
 */
function deleteEntry(cattleId) {
  if (!confirm(`Удалить запись о корове ${cattleId}?`)) {
    return;
  }

  const index = entries.findIndex(e => e.cattleId === cattleId);
  if (index !== -1) {
    entries.splice(index, 1);
    saveLocally();
    updateList();
    updateViewList();
    alert('Запись удалена');
  } else {
    alert('Запись не найдена!');
  }
}