// utils.js — вспомогательные функции

// Формат даты: 2025-04-05 → 05.04.2025
function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString("ru-RU");
}

// Возвращает объект Date (а не строку)
function nowFormatted() {
  const now = new Date();
  return now.toLocaleDateString("ru-RU") + " " +
         now.toLocaleTimeString("ru-RU", { hour: '2-digit', minute: '2-digit' });
}

/**
 * Проверяет, что дата не в будущем. Для форм осеменения, отёла, УЗИ.
 * @param {string} dateStr — значение поля даты (YYYY-MM-DD или иной разборный формат)
 * @param {string} [fieldLabel] — подпись поля для сообщения об ошибке
 * @returns {string|null} — текст ошибки или null, если валидно
 */
function validateDateNotFuture(dateStr, fieldLabel) {
  if (!dateStr || !String(dateStr).trim()) return null;
  var d = new Date(dateStr);
  if (isNaN(d.getTime())) return (fieldLabel || 'Дата') + ': некорректный формат';
  var today = new Date();
  today.setHours(23, 59, 59, 999);
  if (d > today) return (fieldLabel || 'Дата') + ' не может быть в будущем';
  return null;
}
if (typeof window !== 'undefined') {
  window.formatDate = formatDate;
  window.nowFormatted = nowFormatted;
  window.validateDateNotFuture = validateDateNotFuture;
}
export {};
