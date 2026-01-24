// utils.js — вспомогательные функции

// Формат даты: 2025-04-05 → 05.04.2025
function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString("ru-RU");
}

// Формат для отображения
function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString("ru-RU");
}

// Возвращает объект Date (а не строку)
function nowFormatted() {
  return new Date(); // ✅ Возвращает объект
}
