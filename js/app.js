// app.js — основная логика приложения

// app.js
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
    synced: false,              // ❌ Ещё не отправлено
    dateAdded: nowFormatted()   // Дата и время добавления
  };

  entries.unshift(entry);
  saveLocally();
  updateList();
  clearForm();

  // ✅ УБРАНО: saveToGoogle(entry) — больше не отправляем автоматически
}


function clearForm() {
  document.getElementById("cattleId").value = "";
  document.getElementById("date").value = "";
  document.getElementById("bull").value = "";
  document.getElementById("attempt").value = "";
  document.getElementById("sync").value = "";
  document.getElementById("note").value = "";
  document.getElementById("cattleId").focus();
}