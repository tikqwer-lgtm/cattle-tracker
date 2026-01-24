// storage.js — работа с localStorage

let entries = JSON.parse(localStorage.getItem('cattleEntries')) || [];

function saveLocally() {
  localStorage.setItem('cattleEntries', JSON.stringify(entries));
}

function loadLocally() {
  entries = JSON.parse(localStorage.getItem('cattleEntries')) || [];
  console.log("Загружено из localStorage:", entries); // 🔍 дебаг
  updateList();
}
