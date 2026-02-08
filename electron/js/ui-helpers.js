// ui-helpers.js — Вспомогательные функции для UI

/**
 * Показывает индикатор загрузки поверх контейнера
 * @param {HTMLElement|string} container - Элемент или id
 * @returns {function} - Функция для скрытия индикатора
 */
function showLoading(container) {
  const el = typeof container === 'string' ? document.getElementById(container) : container;
  if (!el) return function () {};
  const overlay = document.createElement('div');
  overlay.className = 'loading-overlay';
  overlay.innerHTML = '<div class="loading-spinner"></div><span class="loading-text">Загрузка...</span>';
  el.style.position = el.style.position || 'relative';
  el.appendChild(overlay);
  return function () {
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
  };
}

/**
 * Показывает всплывающее сообщение (тост)
 * @param {string} text - Текст сообщения
 * @param {string} type - 'success' | 'error' | 'info'
 * @param {number} duration - Длительность в мс
 */
function showToast(text, type, duration) {
  if (typeof type !== 'string') type = 'info';
  if (typeof duration !== 'number') duration = 3000;
  const toast = document.createElement('div');
  toast.className = 'toast toast-' + type;
  toast.textContent = text;
  document.body.appendChild(toast);
  requestAnimationFrame(function () {
    toast.classList.add('toast-visible');
  });
  setTimeout(function () {
    toast.classList.remove('toast-visible');
    setTimeout(function () {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 300);
  }, duration);
}

/**
 * Подтверждение действия с кастомным текстом
 * @param {string} message
 * @returns {boolean}
 */
function confirmAction(message) {
  return confirm(message || 'Продолжить?');
}

/**
 * Очищает форму ввода
 */
function clearForm() {
  const fields = [
    'cattleId', 'nickname', 'group', 'birthDate', 'lactation', 'calvingDate',
    'inseminationDate', 'attemptNumber', 'bull', 'inseminator', 'code',
    'status', 'protocolName', 'protocolStartDate', 'exitDate', 
    'dryStartDate', 'vwp', 'note'
  ];
  
  fields.forEach(fieldId => {
    const element = document.getElementById(fieldId);
    if (element) {
      if (element.type === 'select-one') {
        element.selectedIndex = 0;
      } else if (element.type === 'number') {
        element.value = fieldId === 'lactation' ? '' : 
                       fieldId === 'attemptNumber' ? '1' :
                       fieldId === 'vwp' ? '' : '';
      } else {
        element.value = '';
      }
    }
  });
  
  // Статус без значения по умолчанию (поле может быть пустым)
  const statusElement = document.getElementById('status');
  if (statusElement) {
    statusElement.value = '';
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
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("ru-RU");
}

/**
 * Обновляет отображение списка записей на экране добавления
 */
function updateList() {
  const list = document.getElementById("entriesList");
  if (!list) return;

  list.innerHTML = `<div><strong>Всего: ${entries.length}</strong></div>`;
  
  if (entries.length === 0) {
    list.innerHTML += `<div style="color: #999; margin-top: 10px;">Нет данных</div>`;
  } else {
    // Функция для очистки и экранирования данных
    const cleanAndEscape = (text) => {
      if (!text) return '—';
      if (typeof text !== 'string') {
        try {
          text = String(text);
        } catch (e) {
          return '—';
        }
      }
      // Удаляем бинарные и невидимые символы
      text = text.replace(/[\x00-\x1F\x7F-\x9F]/g, '').trim();
      if (!text) return '—';
      // Экранируем HTML
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    };

    entries.forEach(entry => {
      const div = document.createElement("div");
      div.className = "entry" + (!entry.synced ? " unsynced" : "");
      div.innerHTML = `
        <strong>Корова:</strong> ${cleanAndEscape(entry.cattleId)} | 
        <strong>Кличка:</strong> ${cleanAndEscape(entry.nickname)}<br>
        <strong>Дата осеменения:</strong> ${formatDate(entry.inseminationDate)} | 
        <strong>Лактация:</strong> ${entry.lactation || '—'}<br>
        <strong>Бык:</strong> ${cleanAndEscape(entry.bull)} | 
        <strong>Попытка:</strong> ${entry.attemptNumber || '—'} | 
        <strong>Статус:</strong> ${cleanAndEscape(entry.status)}<br>
        <em style="color: #666;">
          ${entry.code ? 'Код: ' + cleanAndEscape(entry.code) + ' • ' : ''}
          ${entry.calvingDate ? 'Отёл: ' + formatDate(entry.calvingDate) + ' • ' : ''}
          ${entry.dryStartDate ? 'Сухостой: ' + formatDate(entry.dryStartDate) + ' • ' : ''}
          ${entry.note ? cleanAndEscape(entry.note) : ''}
        </em>
        ${!entry.synced ? '<span style="color: #ff9900; font-size: 12px;"> ● Не отправлено</span>' : ''}
      `;
      list.appendChild(div);
    });
  }
}

// Экспорт функций
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    clearForm,
    formatDate,
    updateList
  };
}
