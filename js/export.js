// export.js — экспорт и импорт

/**
 * Экспортирует данные в Excel (CSV с разделителем ; и поддержкой кириллицы)
 */
function exportToExcel() {
  if (entries.length === 0) {
    alert("Нет данных для экспорта");
    return;
  }

  // Создаем массив для CSV с заголовками
  let csv = [
    [
      "Номер коровы", "Кличка", "Дата рождения", "Лактация", "Дата отёла", "Дата осеменения",
      "Номер попытки", "Бык", "Осеменатор", "Код осеменения", "Статус", "Название протокола",
      "Дата начала протокола", "Дата выбытия", "Дата запуска", "ПДО (дни)", "Примечание",
      "Синхронизировано"
    ]
  ];

  // Добавляем данные из записей
  entries.forEach(e => {
    csv.push([
      e.cattleId,
      e.nickname || '',
      e.birthDate || '',
      e.lactation || '',
      e.calvingDate || '',
      e.inseminationDate || '',
      e.attemptNumber || '',
      e.bull || '',
      e.inseminator || '',
      e.code || '',
      e.status || '',
      e.protocol?.name || '',
      e.protocol?.startDate || '',
      e.exitDate || '',
      e.dryStartDate || '',
      e.vwp || '',
      e.note || '',
      e.synced ? 'Да' : 'Нет'
    ]);
  });

  // Формируем CSV-контент с разделителем ; и BOM для корректного отображения кириллицы в Excel
  let csvContent = "\uFEFF" + csv.map(row => row.map(cell => `"${cell}"`).join(";")).join("\n");

  // Создаем ссылку для скачивания
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.setAttribute("download", `Учёт_коров_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Импортирует данные из CSV-файла
 * @param {Event} event Событие выбора файла
 * Алгоритм:
 * - Если коровы нет в базе — добавляет новую запись
 * - Если корова есть — обновляет только пустые или отсутствующие поля
 */
function importFromCSV(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    const text = e.target.result;
    const lines = text.split('\n').slice(1);
    const imported = [];
    let duplicates = 0;
    let newEntries = 0;

    for (const line of lines) {
      const row = line.split(';').map(cell => cell.replace(/^"(.*)"$/, '$1').trim());
      if (row.length >= 17 && row[0].trim() !== '') {
        const newEntry = {
          cattleId: row[0],
          nickname: row[1],
          birthDate: row[2],
          lactation: parseInt(row[3]) || 1,
          calvingDate: row[4],
          inseminationDate: row[5],
          attemptNumber: parseInt(row[6]) || 1,
          bull: row[7],
          inseminator: row[8],
          code: row[9],
          status: row[10],
          protocol: {
            name: row[11],
            startDate: row[12]
          },
          exitDate: row[13],
          dryStartDate: row[14],
          vwp: parseInt(row[15]) || 60,
          note: row[16],
          synced: row[17] === 'Да',
          dateAdded: nowFormatted()
        };

        // Поиск существующей записи по номеру коровы
        const existingEntry = entries.find(e => e.cattleId === newEntry.cattleId);

        if (existingEntry) {
          // Обновляем только пустые или старые значения
          for (const key in newEntry) {
            if (newEntry[key]) {
              if (typeof newEntry[key] === 'object') {
                for (const subKey in newEntry[key]) {
                  if (newEntry[key][subKey] && !existingEntry[key][subKey]) {
                    existingEntry[key][subKey] = newEntry[key][subKey];
                  }
                }
              } else if (!existingEntry[key]) {
                existingEntry[key] = newEntry[key];
              }
            }
          }
          duplicates++;
        } else {
          // Новая запись
          entries.unshift(newEntry);
          newEntries++;
        }
      }
    }

    if (newEntries > 0 || duplicates > 0) {
      saveLocally();
      updateList();
      updateViewList();
      alert(`✅ Импортировано: ${newEntries} новых, обновлено: ${duplicates} существующих`);
    } else if (lines.length > 1) {
      alert(`⚠️ Файл содержит ${lines.length} строк, но не найдено новых или обновляемых записей. Возможно, все данные уже есть в базе, номера коров дублируются или строки пустые.`);
    } else {
      alert('❌ Нет данных для импорта');
    }
  };
  reader.readAsText(file);
}

/**
 * Скачивает шаблон для импорта
 */
function downloadTemplate() {
  // Создаем CSV с заголовками
  let csv = [
    [
      "Номер коровы", "Кличка", "Дата рождения", "Лактация", "Дата отёла", "Дата осеменения",
      "Номер попытки", "Бык", "Осеменатор", "Код осеменения", "Статус", "Название протокола",
      "Дата начала протокола", "Дата выбытия", "Дата запуска", "ПДО (дни)", "Примечание",
      "Синхронизировано"
    ]
  ];
  
  // Пустая строка для заполнения
  csv.push(Array(18).fill(''));
  
  let csvContent = "\uFEFF" + csv.map(row => row.map(cell => `"${cell}"`).join(";")).join("\n");
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.setAttribute("download", "Шаблон_импорта_коров.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
