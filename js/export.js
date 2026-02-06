// ... existing code ...

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

/**
 * Импортирует данные из CSV-файла с использованием PapaParse
 * @param {Event} event Событие выбора файла
 * Алгоритм:
 * - Если коровы нет в базе — добавляет новую запись
 * - Если корова есть — обновляет поля из импорта (приоритет у новых данных)
 */
function importFromCSV(event) {
  const file = event.target.files[0];
  if (!file) return;

  // Проверяем наличие PapaParse
  if (typeof Papa === 'undefined') {
    alert('❌ Библиотека PapaParse не загружена. Пожалуйста, проверьте подключение к интернету или обновите страницу.');
    event.target.value = '';
    return;
  }

  Papa.parse(file, {
    encoding: 'UTF-8',
    header: false,
    skipEmptyLines: true,
    delimiter: '', // Автоопределение
    newline: '', // Автоопределение
    quoteChar: '"',
    escapeChar: '"',
    complete: function(results) {
      if (results.errors && results.errors.length > 0) {
        console.warn('Предупреждения при парсинге CSV:', results.errors);
      }

      const data = results.data;
      
      if (!data || data.length <= 1) {
        alert('❌ Файл пуст или содержит только заголовки');
        event.target.value = '';
        return;
      }

      // Определяем разделитель из первой строки
      const firstLine = data[0];
      let delimiter = ';';
      if (firstLine && firstLine.length > 0) {
        const firstLineStr = Array.isArray(firstLine) ? firstLine.join('') : String(firstLine[0] || '');
        if (firstLineStr.includes(';')) {
          delimiter = ';';
        } else if (firstLineStr.includes(',')) {
          delimiter = ',';
        }
      }

      // Если данные не были правильно разделены, парсим заново с правильным разделителем
      let parsedData = data;
      if (data[0].length === 1 && typeof data[0][0] === 'string' && data[0][0].includes(delimiter)) {
        // Данные не были разделены, парсим вручную
        Papa.parse(file, {
          encoding: 'UTF-8',
          header: false,
          skipEmptyLines: true,
          delimiter: delimiter,
          newline: '',
          quoteChar: '"',
          escapeChar: '"',
          complete: function(results2) {
            processImportData(results2.data, delimiter, event);
          },
          error: function(error) {
            alert('❌ Ошибка при чтении файла: ' + error.message);
            event.target.value = '';
          }
        });
        return;
      }

      processImportData(parsedData, delimiter, event);
    },
    error: function(error) {
      alert('❌ Ошибка при чтении файла: ' + error.message);
      event.target.value = '';
    }
  });
}

/**
 * Обрабатывает распарсенные данные CSV
 */
function processImportData(data, delimiter, event) {
  if (!data || data.length <= 1) {
    alert('❌ Файл пуст или содержит только заголовки');
    event.target.value = '';
    return;
  }

  // Пропускаем заголовок
  const dataLines = data.slice(1);
  let duplicates = 0;
  let newEntries = 0;
  let skipped = 0;
  let errors = [];
  let fixedCount = 0;

  for (let i = 0; i < dataLines.length; i++) {
    const row = dataLines[i];
    
    if (!row || row.length === 0) {
      skipped++;
      continue;
    }

    // Очищаем ячейки от лишних пробелов и кавычек
    const cleanRow = row.map(cell => {
      if (cell === null || cell === undefined) return '';
      let cleaned = String(cell).trim();
      // Убираем внешние кавычки
      if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || 
          (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
        cleaned = cleaned.slice(1, -1);
      }
      return cleaned;
    });

    // Минимум нужен номер коровы (первая колонка)
    if (cleanRow.length < 1 || !cleanRow[0] || cleanRow[0].trim() === '') {
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
      let cattleIdRaw = cleanString(cleanRow[0]);
      let separated = separateCattleIdAndDate(cattleIdRaw);
      
      // Если дата была найдена и отделена, используем разделенные значения
      if (separated.date && separated.cattleId !== cattleIdRaw) {
        fixedCount++;
        console.log(`Строка ${i + 2}: Разделено "${cattleIdRaw}" -> номер: "${separated.cattleId}", дата: "${separated.date}"`);
        
        // Если в cleanRow[5] (дата осеменения) пусто, используем извлеченную дату
        if (!cleanRow[5] || cleanRow[5].trim() === '') {
          cleanRow[5] = separated.date;
        }
      }
      
      const newEntry = {
        cattleId: separated.cattleId || '',
        nickname: cleanString(cleanRow[1]) || '',
        birthDate: cleanString(cleanRow[2]) || '',
        lactation: parseInt(cleanRow[3]) || 1,
        calvingDate: cleanString(cleanRow[4]) || '',
        inseminationDate: cleanString(cleanRow[5]) || '',
        attemptNumber: parseInt(cleanRow[6]) || 1,
        bull: cleanString(cleanRow[7]) || '',
        inseminator: cleanString(cleanRow[8]) || '',
        code: cleanString(cleanRow[9]) || '',
        status: cleanString(cleanRow[10]) || 'Охота',
        protocol: {
          name: cleanString(cleanRow[11]) || '',
          startDate: cleanString(cleanRow[12]) || ''
        },
        exitDate: cleanString(cleanRow[13]) || '',
        dryStartDate: cleanString(cleanRow[14]) || '',
        vwp: parseInt(cleanRow[15]) || 60,
        note: cleanString(cleanRow[16]) || '',
        synced: cleanRow[17] === 'Да' || cleanRow[17] === 'да' || cleanRow[17] === '1',
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
      console.error(`Ошибка обработки строки ${i + 2}:`, error);
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
}

// ... existing code ...