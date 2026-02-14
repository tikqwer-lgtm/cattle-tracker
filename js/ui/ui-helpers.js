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
  const container = document.getElementById('toast-container');
  const parent = container || document.body;
  var maxToasts = 5;
  if (container && container.children.length >= maxToasts) {
    container.removeChild(container.firstChild);
  }
  const toast = document.createElement('div');
  toast.className = 'toast toast-' + type;
  toast.textContent = text;
  parent.appendChild(toast);
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
 * Показывает/обновляет панель прогресса скачивания обновления (Electron).
 * @param {number} percent - 0..100
 * @param {string} downloadPath - путь к папке загрузки (опционально)
 * @param {number} bytesPerSecond - скорость (опционально)
 */
function showUpdateProgress(percent, downloadPath, bytesPerSecond) {
  var id = 'update-progress-panel';
  var panel = document.getElementById(id);
  if (!panel) {
    panel = document.createElement('div');
    panel.id = id;
    panel.className = 'update-progress-panel';
    panel.innerHTML = '<div class="update-progress-title">Скачивание обновления</div>' +
      '<div class="update-progress-bar-wrap"><div class="update-progress-bar" style="width:0%"></div></div>' +
      '<div class="update-progress-text">0%</div>';
    document.body.appendChild(panel);
  }
  var bar = panel.querySelector('.update-progress-bar');
  var text = panel.querySelector('.update-progress-text');
  if (bar) bar.style.width = (percent || 0) + '%';
  if (text) {
    var speed = bytesPerSecond ? ' · ' + (bytesPerSecond < 1024 ? bytesPerSecond + ' Б/с' : (bytesPerSecond / 1024).toFixed(1) + ' КБ/с') : '';
    text.textContent = (percent || 0) + '%' + speed;
  }
  if (percent >= 100) {
    if (text) text.textContent = 'Готово';
    setTimeout(function () {
      if (panel.parentNode) panel.parentNode.removeChild(panel);
    }, 2500);
  }
}

/**
 * Модальное подтверждение (замена confirm): возвращает Promise<boolean>.
 * ОК → true, Отмена / Escape → false. Focus trap и закрытие по Escape.
 * @param {string} message - Текст вопроса
 * @param {{ confirmText?: string, cancelText?: string }} [options]
 * @returns {Promise<boolean>}
 */
function showConfirmModal(message, options) {
  var confirmText = (options && options.confirmText) || 'ОК';
  var cancelText = (options && options.cancelText) || 'Отмена';
  var resolved = false;
  var focusBefore = document.activeElement;

  var overlay = document.createElement('div');
  overlay.className = 'confirm-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'confirm-modal-title');

  var text = (message || 'Продолжить?').replace(/</g, '&lt;');
  overlay.innerHTML =
    '<div class="confirm-modal">' +
    '<p id="confirm-modal-title">' + text + '</p>' +
    '<div class="confirm-modal-actions">' +
    '<button type="button" class="small-btn confirm-cancel">' + cancelText.replace(/</g, '&lt;') + '</button>' +
    '<button type="button" class="btn primary confirm-ok">' + confirmText.replace(/</g, '&lt;') + '</button>' +
    '</div></div>';

  var dialog = overlay.querySelector('.confirm-modal');
  var btnOk = overlay.querySelector('.confirm-ok');
  var btnCancel = overlay.querySelector('.confirm-cancel');

  function finish(result) {
    if (resolved) return;
    resolved = true;
    overlay.remove();
    if (focusBefore && typeof focusBefore.focus === 'function') focusBefore.focus();
    resolvePromise(result);
  }

  var resolvePromise;
  var promise = new Promise(function (resolve) { resolvePromise = resolve; });

  btnOk.addEventListener('click', function () { finish(true); });
  btnCancel.addEventListener('click', function () { finish(false); });
  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) finish(false);
  });
  overlay.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { e.preventDefault(); finish(false); }
    if (e.key === 'Tab') {
      var focusable = [btnCancel, btnOk];
      var i = focusable.indexOf(document.activeElement);
      if (i === -1) return;
      if (e.shiftKey) {
        e.preventDefault();
        focusable[i === 0 ? focusable.length - 1 : i - 1].focus();
      } else {
        e.preventDefault();
        focusable[i === focusable.length - 1 ? 0 : i + 1].focus();
      }
    }
  });

  document.body.appendChild(overlay);
  btnOk.focus();
  return promise;
}

/**
 * Подтверждение действия (синхронная обёртка для совместимости — использует нативный confirm).
 * Для нового кода предпочтительно showConfirmModal (возвращает Promise).
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
        <strong>Лактация:</strong> ${(entry.lactation !== undefined && entry.lactation !== null && entry.lactation !== '') || entry.lactation === 0 ? String(entry.lactation) : '—'}<br>
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
export {};
