// voice-handler.js — Обработка голосовых команд

/**
 * Обрабатывает распознанную голосовую команду
 * @param {string} command
 */
function parseVoiceCommand(command) {
  console.log("Обработка голосовой команды:", command);
  
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
  let inseminationDate = parseDateFromVoice(command);

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
  showStatus(`✅ Обработано: ${command.substring(0, 50)}...`, 3000);
}

/**
 * Извлекает дату из голосовой команды
 * @param {string} command
 * @returns {string}
 */
function parseDateFromVoice(command) {
  const dateMatch = command.match(/(\d{1,2})[^\w]*(январ[яь]|феврал[яь]|март[а]?|апрел[яь]|май[я]?|июн[яь]?|июл[яь]?|август[а]?|сентябр[яь]|октябр[яь]|ноябр[яь]|декабр[яь])/i);
  if (!dateMatch) return '';
  
  const day = dateMatch[1].padStart(2, '0');
  const monthNames = {
    'январь': '01', 'февраль': '02', 'март': '03', 'апрель': '04',
    'май': '05', 'июнь': '06', 'июль': '07', 'август': '08',
    'сентябрь': '09', 'октябрь': '10', 'ноябрь': '11', 'декабрь': '12'
  };
  const month = monthNames[dateMatch[2].toLowerCase()];
  const yearMatch = command.match(/(20\d{2})/);
  const year = yearMatch ? yearMatch[1] : new Date().getFullYear();
  
  return `${year}-${month}-${day}`;
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
 * Показывает статусное сообщение
 * @param {string} text
 * @param {number} duration
 */
function showStatus(text, duration = 3000) {
  const statusElement = document.getElementById('status');
  if (statusElement) {
    statusElement.textContent = text;
    setTimeout(() => {
      if (statusElement.textContent === text) {
        statusElement.textContent = '';
      }
    }, duration);
  }
}

// Экспорт функций
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    parseVoiceCommand,
    parseDateFromVoice,
    addEntryFromVoice,
    showStatus
  };
}