// ... existing code ...

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
    const firstLine = text.split(/\r?\n/)[0];
    const delimiter = firstLine.includes(';') ? ';' : (firstLine.includes(',') ? ',' : ';');
    
    // Правильный парсер CSV с учетом кавычек
    function parseCSVLine(line, delimiter) {
      const result = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const nextChar = line[i + 1];
        
        if (char === '"') {
          if (inQuotes && nextChar === '"') {
            // Двойная кавычка - экранированная кавычка
            current += '"';
            i++; // Пропускаем следующую кавычку
          } else {
            // Переключаем режим кавычек
            inQuotes = !inQuotes;
          }
        } else if (char === delimiter && !inQuotes) {
          // Разделитель вне кавычек - новая ячейка
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      
      // Добавляем последнюю ячейку
      result.push(current.trim());
      return result;
    }
    
    /**
     * Разделяет номер животного и дату, если они слиты
     * Например: "6634021.08.2025" -> {cattleId: "66340", date: "21.08.2025"}
     */
    function separateCattleIdAndDate(value) {
      if (!value || typeof value !== 'string') return { cattleId: value || '', date: '' };
      
      // Паттерны для дат: DD.MM.YYYY или DD/MM/YYYY
      const datePatterns = [
        /(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})/,  // DD.MM.YYYY или DD/MM/YYYY
        /(\d{4})[.\/-](\d{1,2})[.\/-](\d{1,2})/  // YYYY-MM-DD или YYYY.MM.DD
      ];
      
      for (const pattern of datePatterns) {
        const match = value.match(pattern);
        if (match) {
          const dateStart = match.index;
          const dateEnd = match.index + match[0].length;
          
          // Извлекаем номер животного (часть до даты)
          const cattleId = value.substring(0, dateStart).trim();
          
          // Извлекаем дату
          let dateStr = match[0];
          
          // Нормализуем формат даты к DD.MM.YYYY
          if (match[0].includes('-')) {
            // Формат YYYY-MM-DD -> DD.MM.YYYY
            const parts = match[0].split(/[.\/-]/);
            if (parts.length === 3) {
              if (parts[0].length === 4) {
                // YYYY-MM-DD
                dateStr = `${parts[2]}.${parts[1]}.${parts[0]}`;
              } else {
                // DD-MM-YYYY
                dateStr = `${parts[0]}.${parts[1]}.${parts[2]}`;
              }
            }
          } else if (match[0].includes('/')) {
            // Заменяем / на .
            dateStr = match[0].replace(/\//g, '.');
          }
          
          // Проверяем, что номер животного не пустой
          if (cattleId && cattleId.length > 0) {
            return { cattleId, date: dateStr };
          }
        }
      }
      
      // Если дата не найдена, возвращаем исходное значение как номер
      return { cattleId: value, date: '' };
    }
    
    // Разделяем на строки с учетом \r\n и \n
    const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
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
    let fixedCount = 0; // Счетчик исправленных записей

    for (let i = 0; i < dataLines.length; i++) {
      const line = dataLines[i].trim();
      if (!line) {
        skipped++;
        continue;
      }

      // Парсим строку с правильным учетом кавычек
      let row;
      try {
        row = parseCSVLine(line, delimiter);
        // Убираем внешние кавычки из каждой ячейки
        row = row.map(cell => {
          // Убираем кавычки если они есть с обеих сторон
          if ((cell.startsWith('"') && cell.endsWith('"')) || 
              (cell.startsWith("'") && cell.endsWith("'"))) {
            return cell.slice(1, -1);
          }
          return cell;
        });
      } catch (error) {
        console.error(`Ошибка парсинга строки ${i + 2}:`, error);
        errors.push(`Строка ${i + 2}: ошибка парсинга`);
        skipped++;
        continue;
      }

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

        // Проверяем и разделяем номер коровы и дату, если они слиты
        let cattleIdRaw = cleanString(row[0]);
        let separated = separateCattleIdAndDate(cattleIdRaw);
        
        // Если дата была найдена и отделена, используем разделенные значения
        if (separated.date && separated.cattleId !== cattleIdRaw) {
          fixedCount++;
          console.log(`Строка ${i + 2}: Разделено "${cattleIdRaw}" -> номер: "${separated.cattleId}", дата: "${separated.date}"`);
          
          // Если в row[5] (дата осеменения) пусто, используем извлеченную дату
          if (!row[5] || row[5].trim() === '') {
            row[5] = separated.date;
          }
        }
        
        const newEntry = {
          cattleId: separated.cattleId || '',
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
      if (fixedCount > 0) {
        message += `\n🔧 Автоматически исправлено записей с объединенными данными: ${fixedCount}`;
      }
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

// ... existing code ...