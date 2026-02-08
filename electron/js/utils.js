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
