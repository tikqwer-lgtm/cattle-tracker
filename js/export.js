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
  // Используем \r\n для лучшей совместимости с Excel
  let csvContent = "\uFEFF" + csv.map(row => 
    row.map(cell => {
      // Экранируем кавычки в ячейках
      const escaped = String(cell).replace(/"/g, '""');
      return `"${escaped}"`;
    }).join(";")
  ).join("\r\n");

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
 * - Если корова есть — обновляет поля из импорта (приоритет у новых данных)
 */
function importFromCSV(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    let text = e.target.result;
    
    // Обработка BOM (Byte Order Mark) для UTF-8
    if (text.charCodeAt(0) === 0xFEFF) {
      text = text.slice(1);
    }
    
    // Проверка на бинарные данные
    if (text.includes('\0') || /[\x00-\x08\x0E-\x1F]/.test(text)) {
      alert('❌ Файл содержит бинарные данные. Убедитесь, что файл сохранен в формате CSV (текстовый формат).');
      event.target.value = '';
      return;
    }
    // Определяем разделитель (проверяем первую строку)
    const firstLine = text.split('\n')[0];
    const delimiter = firstLine.includes(';') ? ';' : (firstLine.includes(',') ? ',' : ';');
    
    const lines = text.split('\n').filter(line => line.trim() !== '');
    if (lines.length <= 1) {
      alert('❌ Файл пуст или содержит только заголовки');
      event.target.value = '';
      return;
    }
    
    // Пропускаем заголовок
    const dataLines = lines.slice(1);
    let duplicates = 0;
    let newEntries = 0;
    let skipped = 0;
    let errors = [];

    for (let i = 0; i < dataLines.length; i++) {
      const line = dataLines[i].trim();
      if (!line) {
        skipped++;
        continue;
      }

      // Парсим строку с учетом кавычек
      const row = line.split(delimiter).map(cell => {
        let cleaned = cell.trim();
        // Убираем кавычки если есть
        if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || 
            (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
          cleaned = cleaned.slice(1, -1);
        }
        return cleaned;
      });

      // Минимум нужен номер коровы (первая колонка)
      if (row.length < 1 || !row[0] || row[0].trim() === '') {
        skipped++;
        continue;
      }

      try {
        // Валидация и очистка данных
        const cleanString = (str) => {
          if (!str || typeof str !== 'string') return '';
          // Удаляем невидимые и бинарные символы, оставляем только печатные
          return str.replace(/[\x00-\x1F\x7F-\x9F]/g, '').trim();
        };

        const newEntry = {
          cattleId: cleanString(row[0]) || '',
          nickname: cleanString(row[1]) || '',
          birthDate: cleanString(row[2]) || '',
          lactation: parseInt(row[3]) || 1,
          calvingDate: cleanString(row[4]) || '',
          inseminationDate: cleanString(row[5]) || '',
          attemptNumber: parseInt(row[6]) || 1,
          bull: cleanString(row[7]) || '',
          inseminator: cleanString(row[8]) || '',
          code: cleanString(row[9]) || '',
          status: cleanString(row[10]) || 'Охота',
          protocol: {
            name: cleanString(row[11]) || '',
            startDate: cleanString(row[12]) || ''
          },
          exitDate: cleanString(row[13]) || '',
          dryStartDate: cleanString(row[14]) || '',
          vwp: parseInt(row[15]) || 60,
          note: cleanString(row[16]) || '',
          synced: row[17] === 'Да' || row[17] === 'да' || row[17] === '1',
          dateAdded: nowFormatted()
        };

        // Проверка на валидность записи
        if (!newEntry.cattleId || newEntry.cattleId.length === 0) {
          skipped++;
          continue;
        }

        // Поиск существующей записи по номеру коровы
        const existingEntry = entries.find(e => e.cattleId === newEntry.cattleId);

        if (existingEntry) {
          // Обновляем существующую запись - приоритет у данных из импорта
          let updated = false;
          for (const key in newEntry) {
            if (key === 'dateAdded' || key === 'synced') continue; // Не обновляем эти поля
            if (typeof newEntry[key] === 'object' && newEntry[key] !== null) {
              // Для объектов (protocol) обновляем вложенные поля
              if (!existingEntry[key]) existingEntry[key] = {};
              for (const subKey in newEntry[key]) {
                if (newEntry[key][subKey]) {
                  existingEntry[key][subKey] = newEntry[key][subKey];
                  updated = true;
                }
              }
            } else if (newEntry[key] && newEntry[key] !== '') {
              // Обновляем если в импорте есть значение
              existingEntry[key] = newEntry[key];
              updated = true;
            }
          }
          if (updated) {
            duplicates++;
          } else {
            skipped++;
          }
        } else {
          // Новая запись
          entries.unshift(newEntry);
          newEntries++;
        }
      } catch (error) {
        errors.push(`Строка ${i + 2}: ${error.message}`);
        skipped++;
      }
    }

    // Формируем сообщение
    let message = '';
    if (newEntries > 0 || duplicates > 0) {
      saveLocally();
      updateList();
      if (typeof updateViewList === 'function') {
        updateViewList();
      }
      message = `✅ Импортировано: ${newEntries} новых, обновлено: ${duplicates} существующих`;
      if (skipped > 0) {
        message += `, пропущено: ${skipped}`;
      }
      if (errors.length > 0) {
        message += `\n⚠️ Ошибок: ${errors.length}`;
        console.warn('Ошибки импорта:', errors);
      }
    } else {
      message = `⚠️ Файл содержит ${dataLines.length} строк данных, но:\n`;
      message += `- Новых записей: 0\n`;
      message += `- Обновлено записей: 0\n`;
      message += `- Пропущено строк: ${skipped}\n\n`;
      message += `Возможные причины:\n`;
      message += `- Все номера коров уже есть в базе и данные не изменились\n`;
      message += `- Строки пустые или не содержат номер коровы\n`;
      message += `- Неверный формат файла (ожидается разделитель ${delimiter})`;
      if (errors.length > 0) {
        message += `\n\nОшибки:\n${errors.slice(0, 5).join('\n')}`;
        if (errors.length > 5) {
          message += `\n... и еще ${errors.length - 5} ошибок`;
        }
      }
    }
    
    alert(message);
    
    // Сброс input для возможности повторного импорта того же файла
    event.target.value = '';
  };
  reader.readAsText(file, 'UTF-8');
}

/**
 * Скачивает шаблон для импорта
 */
function downloadTemplate() {
  // Создаем CSV с заголовками
  const headers = [
    "Номер коровы", "Кличка", "Дата рождения", "Лактация", "Дата отёла", "Дата осеменения",
    "Номер попытки", "Бык", "Осеменатор", "Код осеменения", "Статус", "Название протокола",
    "Дата начала протокола", "Дата выбытия", "Дата запуска", "ПДО (дни)", "Примечание",
    "Синхронизировано"
  ];
  
  // Создаем несколько пустых строк для удобства заполнения
  const rows = [headers];
  for (let i = 0; i < 5; i++) {
    rows.push(Array(18).fill(''));
  }
  
  // Формируем CSV-контент с разделителем ; и BOM для корректного отображения кириллицы в Excel
  // Каждая ячейка в кавычках, разделитель - точка с запятой
  let csvContent = "\uFEFF" + rows.map(row => 
    row.map(cell => {
      // Экранируем кавычки в ячейках
      const escaped = String(cell).replace(/"/g, '""');
      return `"${escaped}"`;
    }).join(";")
  ).join("\r\n"); // Используем \r\n для лучшей совместимости с Excel
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.setAttribute("download", "Шаблон_импорта_коров.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  alert('✅ Шаблон скачан!\n\nОткройте файл в Excel или другой программе для работы с таблицами.\nЗаполните данные в строках под заголовками и сохраните файл.');
}
