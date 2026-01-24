// export.js — экспорт и импорт

function exportToExcel() {
  if (entries.length === 0) {
    alert("Нет данных для экспорта");
    return;
  }

  let csv = [
    ["Номер коровы", "Дата осеменения", "Дата записи", "Бык", "Попытка", "Схема СИНХ", "Примечание"]
  ];

  entries.forEach(e => {
    csv.push([
      e.cattleId,
      e.date,
      e.dateAdded,
      e.bull,
      e.attempt,
      e.synchronization,
      e.note
    ]);
  });

  let csvContent = "data:text/csv;charset=utf-8," + 
    csv.map(row => row.map(cell => `"${cell}"`).join(";")).join("\n");

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", "Учёт_осеменения_коров.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function importFromCSV(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    const text = e.target.result;
    const lines = text.split('\n').slice(1);
    const imported = [];

    for (const line of lines) {
      const row = line.split(';').map(cell => cell.replace(/^"(.*)"$/, '$1').trim());
      if (row.length >= 7) {
        imported.push({
          cattleId: row[0],
          date: row[1],
          dateAdded: row[2],
          bull: row[3],
          attempt: row[4],
          synchronization: row[5],
          note: row[6],
          synced: false
        });
      } else if (row.length >= 6) {
        const now = nowFormatted();
        imported.push({
          cattleId: row[0],
          date: row[1],
          dateAdded: now,
          bull: row[2],
          attempt: row[3],
          synchronization: row[4],
          note: row[5],
          synced: false
        });
      }
    }

    if (imported.length > 0) {
      entries = [...imported, ...entries];
      saveLocally();
      updateList();
      alert(`✅ Импортировано ${imported.length} записей`);
    }
  };
  reader.readAsText(file);
}
