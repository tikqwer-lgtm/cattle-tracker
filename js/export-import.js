// export-import.js — импорт CSV/Excel/JSON, нормализация полей для импорта

/**
 * Импорт JSON с экрана «Синхронизация» (переиспользует логику резервной копии)
 */
function importData(event) {
  var file = event && event.target && event.target.files && event.target.files[0];
  if (!file) return;
  if (typeof window.importBackupFromFile !== 'function') {
    alert('Импорт JSON недоступен. Убедитесь, что загружен модуль резервного копирования.');
    if (event.target) event.target.value = '';
    return;
  }
  window.importBackupFromFile(file).then(function (r) {
    if (r.ok) {
      if (typeof showToast === 'function') showToast('Импортировано записей: ' + r.count, 'success');
      else alert('Импортировано записей: ' + r.count);
    } else {
      if (typeof showToast === 'function') showToast(r.message || 'Ошибка', 'error');
      else alert(r.message || 'Ошибка');
    }
    if (event.target) event.target.value = '';
  });
}

/**
 * Приводит дату из CSV к формату YYYY-MM-DD для хранения и input type="date"
 */
function normalizeDateForStorage(str) {
  if (str === null || str === undefined) return '';
  if (typeof str === 'number' && !isNaN(str) && typeof XLSX !== 'undefined' && XLSX.SSF && XLSX.SSF.parse_date_code) {
    try {
      var d = XLSX.SSF.parse_date_code(str);
      if (d && d.y >= 1900) {
        var y = d.y, m = (d.m || 1), day = (d.d || 1);
        return y + '-' + String(m).padStart(2, '0') + '-' + String(day).padStart(2, '0');
      }
    } catch (e) { /* игнор */ }
  }
  var s = String(str).trim();
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  var m = s.match(/^(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})$/);
  if (m) return m[3] + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0');
  var mShort = s.match(/^(\d{1,2})[.\/](\d{1,2})[.\/](\d{2})$/);
  if (mShort) {
    var yy = parseInt(mShort[3], 10);
    var fullYear = yy <= 30 ? 2000 + yy : 1900 + yy;
    return fullYear + '-' + mShort[2].padStart(2, '0') + '-' + mShort[1].padStart(2, '0');
  }
  var m2 = s.match(/^(\d{4})[.\/-](\d{1,2})[.\/-](\d{1,2})$/);
  if (m2) return m2[1] + '-' + m2[2].padStart(2, '0') + '-' + m2[3].padStart(2, '0');
  return s;
}
function normalizeStatusFromImport(raw) {
  if (!raw || typeof raw !== 'string') return '';
  var s = raw.trim().toLowerCase();
  if (!s) return '';
  if (s === 'осем' || s === 'осемененная') return 'Осемененная';
  if (s === 'не стел') return 'Холостая';
  if (s === 'яловая' || s === 'ял') return 'Холостая';
  if (s === 'ст' || s === 'стел' || s === 'стельная') return 'Стельная';
  return raw.trim();
}
function separateCattleIdAndDate(value) {
  if (!value || typeof value !== 'string') return { cattleId: value || '', date: '' };
  const datePatterns = [
    /(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})/,
    /(\d{4})[.\/-](\d{1,2})[.\/-](\d{1,2})/
  ];
  for (const pattern of datePatterns) {
    const match = value.match(pattern);
    if (match) {
      const dateStart = match.index;
      const cattleId = value.substring(0, dateStart).trim();
      let dateStr = match[0];
      if (match[0].includes('-')) {
        const parts = match[0].split(/[.\/-]/);
        if (parts.length === 3) {
          if (parts[0].length === 4) dateStr = parts[2] + '.' + parts[1] + '.' + parts[0];
          else dateStr = parts[0] + '.' + parts[1] + '.' + parts[2];
        }
      } else if (match[0].includes('/')) dateStr = match[0].replace(/\//g, '.');
      if (cattleId && cattleId.length > 0) return { cattleId: cattleId, date: dateStr };
    }
  }
  return { cattleId: value, date: '' };
}
function handleImportFile(event) {
  var file = event.target.files[0];
  if (!file) return;
  var name = (file.name || '').toLowerCase();
  if (name.endsWith('.xlsx')) importFromExcelWide(event);
  else importFromCSV(event);
}
function countCyrillic(str) {
  if (!str || typeof str !== 'string') return 0;
  var n = 0;
  for (var i = 0; i < str.length; i++) {
    if (str.charCodeAt(i) >= 0x0400 && str.charCodeAt(i) <= 0x04FF) n++;
  }
  return n;
}
function decodeCsvFileContent(buffer) {
  var bytes = new Uint8Array(buffer);
  if (bytes.length >= 3 && bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
    try { return new TextDecoder('utf-8').decode(buffer); } catch (e) {}
  }
  var utf8 = '';
  try { utf8 = new TextDecoder('utf-8').decode(buffer); } catch (e) { utf8 = ''; }
  if (utf8.indexOf('\uFFFD') !== -1) {
    try { return new TextDecoder('windows-1251').decode(buffer); } catch (e2) { return utf8; }
  }
  try {
    var win1251 = new TextDecoder('windows-1251').decode(buffer);
    if (countCyrillic(win1251) > countCyrillic(utf8)) return win1251;
  } catch (e2) {}
  return utf8;
}
function importFromCSV(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (typeof Papa === 'undefined') {
    alert('❌ Библиотека PapaParse не загружена.');
    event.target.value = '';
    return;
  }
  var reader = new FileReader();
  reader.onload = function () {
    var buffer = reader.result;
    if (!buffer || !(buffer instanceof ArrayBuffer)) {
      alert('❌ Не удалось прочитать файл');
      event.target.value = '';
      return;
    }
    var csvString = decodeCsvFileContent(buffer);
    Papa.parse(csvString, {
      encoding: 'UTF-8', header: false, skipEmptyLines: true, delimiter: '', newline: '', quoteChar: '"', escapeChar: '"',
      complete: function (results) {
        if (results.errors && results.errors.length > 0) console.warn('Предупреждения при парсинге CSV:', results.errors);
        var data = results.data;
        if (!data || data.length <= 1) { alert('❌ Файл пуст или содержит только заголовки'); event.target.value = ''; return; }
        var firstLine = data[0];
        var delimiter = ';';
        if (firstLine && firstLine.length > 0) {
          var firstLineStr = Array.isArray(firstLine) ? firstLine.join('') : String(firstLine[0] || '');
          if (firstLineStr.indexOf(';') !== -1) delimiter = ';';
          else if (firstLineStr.indexOf(',') !== -1) delimiter = ',';
        }
        if (data[0].length === 1 && typeof data[0][0] === 'string' && data[0][0].indexOf(delimiter) !== -1) {
          Papa.parse(csvString, {
            encoding: 'UTF-8', header: false, skipEmptyLines: true, delimiter: delimiter, newline: '', quoteChar: '"', escapeChar: '"',
            complete: function (results2) { processImportData(results2.data, delimiter, event); },
            error: function (error) { alert('❌ Ошибка при разборе файла: ' + (error && error.message ? error.message : '')); event.target.value = ''; }
          });
          return;
        }
        processImportData(data, delimiter, event);
      },
      error: function (error) { alert('❌ Ошибка при разборе файла: ' + (error && error.message ? error.message : '')); event.target.value = ''; }
    });
  };
  reader.onerror = function () { alert('❌ Ошибка при чтении файла'); event.target.value = ''; };
  reader.readAsArrayBuffer(file);
}
function importFromExcelWide(event) {
  var file = event.target.files[0];
  if (!file) return;
  if (typeof XLSX === 'undefined') {
    alert('❌ Библиотека SheetJS (XLSX) не загружена.');
    event.target.value = '';
    return;
  }
  var reader = new FileReader();
  reader.onload = function (e) {
    try {
      var ab = e.target.result;
      var wb = XLSX.read(ab, { type: 'array', cellDates: false, raw: true });
      var ws = wb.Sheets[wb.SheetNames[0]];
      var rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' });
      if (!rows || rows.length < 2) {
        alert('❌ В файле нет данных.');
        event.target.value = '';
        return;
      }
      var newCount = 0, updateCount = 0, skipped = 0;
      var cleanStr = function (val) {
        if (val === null || val === undefined) return '';
        if (typeof val === 'number' && isNaN(val)) return '';
        return String(val).trim().replace(/[\x00-\x1F\x7F-\x9F]/g, '').trim();
      };
      var getCell = function (row, col) { var v = row[col]; return (v === null || v === undefined) ? '' : v; };
      for (var i = 1; i < rows.length; i++) {
        var row = rows[i];
        if (!row || !Array.isArray(row)) continue;
        var cattleId = cleanStr(getCell(row, 0));
        if (!cattleId) { skipped++; continue; }
        var lactation = cleanStr(getCell(row, 1)), nickname = cleanStr(getCell(row, 2));
        var birthDate = normalizeDateForStorage(getCell(row, 3)), calvingDate = normalizeDateForStorage(getCell(row, 4));
        var status = normalizeStatusFromImport(cleanStr(getCell(row, 19)));
        var history = [];
        for (var attempt = 1; attempt <= 7; attempt++) {
          var dateCol = 4 + (attempt - 1) * 2 + 1, bullCol = dateCol + 1;
          var dateStr = normalizeDateForStorage(getCell(row, dateCol)), bullVal = cleanStr(getCell(row, bullCol));
          if (dateStr || bullVal) history.push({ date: dateStr || '', attemptNumber: attempt, bull: bullVal || '', inseminator: '', code: '' });
        }
        history.sort(function (a, b) { var da = (a.date || '').toString(), db = (b.date || '').toString(); return da < db ? -1 : da > db ? 1 : 0; });
        var lastInsem = history.length > 0 ? history[history.length - 1] : null;
        var existing = entries.find(function (e) { return e.cattleId === cattleId; });
        if (existing) {
          existing.lactation = lactation || existing.lactation;
          existing.nickname = nickname || existing.nickname;
          existing.birthDate = birthDate || existing.birthDate;
          existing.calvingDate = calvingDate || existing.calvingDate;
          existing.status = status || existing.status;
          existing.inseminationHistory = history;
          existing.inseminationDate = lastInsem ? lastInsem.date : (existing.inseminationDate || '');
          existing.attemptNumber = lastInsem ? lastInsem.attemptNumber : (existing.attemptNumber || 1);
          existing.bull = lastInsem ? lastInsem.bull : (existing.bull || '');
          updateCount++;
        } else {
          var entry = typeof getDefaultCowEntry === 'function' ? getDefaultCowEntry() : { cattleId: '', nickname: '', birthDate: '', lactation: '', calvingDate: '', inseminationDate: '', attemptNumber: 1, bull: '', inseminator: '', code: '', status: '', exitDate: '', dryStartDate: '', vwp: 60, note: '', protocol: { name: '', startDate: '' }, dateAdded: typeof nowFormatted === 'function' ? nowFormatted() : '', synced: false, userId: '', lastModifiedBy: '', inseminationHistory: [] };
          entry.cattleId = cattleId; entry.lactation = lactation; entry.nickname = nickname; entry.birthDate = birthDate; entry.calvingDate = calvingDate; entry.status = status; entry.inseminationHistory = history; entry.inseminationDate = lastInsem ? lastInsem.date : ''; entry.attemptNumber = lastInsem ? lastInsem.attemptNumber : 1; entry.bull = lastInsem ? lastInsem.bull : '';
          if (entry.dateAdded === '') entry.dateAdded = typeof nowFormatted === 'function' ? nowFormatted() : '';
          entries.unshift(entry);
          newCount++;
        }
      }
      if (newCount > 0 || updateCount > 0) {
        saveLocally();
        if (typeof updateList === 'function') updateList();
        if (typeof updateViewList === 'function') updateViewList();
        var msg = '✅ Импорт таблицы осеменений: добавлено ' + newCount + ', обновлено ' + updateCount;
        if (skipped > 0) msg += ', пропущено строк: ' + skipped;
        alert(msg);
      } else {
        alert('⚠️ Нет данных для импорта.');
      }
    } catch (err) {
      console.error(err);
      alert('❌ Ошибка при чтении Excel: ' + (err.message || String(err)));
    }
    event.target.value = '';
  };
  reader.onerror = function () { alert('❌ Не удалось прочитать файл.'); event.target.value = ''; };
  reader.readAsArrayBuffer(file);
}
function processImportData(data, delimiter, event) {
  if (!data || data.length <= 1) { alert('❌ Файл пуст или содержит только заголовки'); event.target.value = ''; return; }
  const dataLines = data.slice(1);
  let duplicates = 0, newEntries = 0, skipped = 0, errors = [], fixedCount = 0;
  for (let i = 0; i < dataLines.length; i++) {
    const row = dataLines[i];
    if (!row || row.length === 0) { skipped++; continue; }
    const cleanRow = row.map(cell => {
      if (cell === null || cell === undefined) return '';
      let cleaned = String(cell).trim();
      if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || (cleaned.startsWith("'") && cleaned.endsWith("'"))) cleaned = cleaned.slice(1, -1);
      return cleaned;
    });
    if (cleanRow.length < 1 || !cleanRow[0] || cleanRow[0].trim() === '') { skipped++; continue; }
    try {
      const cleanString = (str) => { if (!str || typeof str !== 'string') return ''; return str.replace(/[\x00-\x1F\x7F-\x9F]/g, '').trim(); };
      let cattleIdRaw = cleanString(cleanRow[0]), separated = separateCattleIdAndDate(cattleIdRaw);
      if (separated.date && separated.cattleId !== cattleIdRaw) {
        fixedCount++;
        var insemCol = cleanRow.length >= 19 ? 6 : 5;
        if ((!cleanRow[insemCol] || cleanRow[insemCol].trim() === '') && separated.date) cleanRow[insemCol] = separated.date;
      }
      var hasGroupColumn = cleanRow.length >= 19;
      var idx = function (oldIdx, newIdx) { return hasGroupColumn ? cleanRow[newIdx] : cleanRow[oldIdx]; };
      var birthDateRaw = cleanString(hasGroupColumn ? cleanRow[3] : cleanRow[2]), calvingDateRaw = cleanString(hasGroupColumn ? cleanRow[5] : cleanRow[4]), inseminationDateRaw = cleanString(hasGroupColumn ? cleanRow[6] : cleanRow[5]), protocolStartRaw = cleanString(hasGroupColumn ? cleanRow[13] : cleanRow[12]), exitDateRaw = cleanString(hasGroupColumn ? cleanRow[14] : cleanRow[13]), dryStartRaw = cleanString(hasGroupColumn ? cleanRow[15] : cleanRow[14]);
      const newEntry = {
        cattleId: separated.cattleId || '', nickname: cleanString(cleanRow[1]) || '', group: hasGroupColumn ? cleanString(cleanRow[2]) || '' : '',
        birthDate: normalizeDateForStorage(birthDateRaw), lactation: (idx(3, 4) && String(idx(3, 4)).trim() !== '') ? (parseInt(idx(3, 4), 10) || '') : '', calvingDate: normalizeDateForStorage(calvingDateRaw), inseminationDate: normalizeDateForStorage(inseminationDateRaw), attemptNumber: parseInt(idx(6, 7)) || 1, bull: cleanString(idx(7, 8)) || '', inseminator: cleanString(idx(8, 9)) || '', code: cleanString(idx(9, 10)) || '', status: normalizeStatusFromImport(cleanString(idx(10, 11))), protocol: { name: cleanString(idx(11, 12)) || '', startDate: normalizeDateForStorage(protocolStartRaw) }, exitDate: normalizeDateForStorage(exitDateRaw), dryStartDate: normalizeDateForStorage(dryStartRaw), vwp: parseInt(idx(15, 16)) || 60, note: cleanString(idx(16, 17)) || '', synced: (hasGroupColumn ? cleanRow[18] : cleanRow[17]) === 'Да' || (hasGroupColumn ? cleanRow[18] : cleanRow[17]) === 'да' || (hasGroupColumn ? cleanRow[18] : cleanRow[17]) === '1', dateAdded: nowFormatted(), userId: '', lastModifiedBy: '', inseminationHistory: []
      };
      if (!newEntry.cattleId || newEntry.cattleId.length === 0) { skipped++; continue; }
      const existingEntry = entries.find(e => e.cattleId === newEntry.cattleId);
      if (existingEntry) {
        let updated = false;
        for (const key in newEntry) {
          if (key === 'dateAdded' || key === 'synced') continue;
          if (typeof newEntry[key] === 'object' && newEntry[key] !== null) {
            if (!existingEntry[key]) existingEntry[key] = {};
            for (const subKey in newEntry[key]) { if (newEntry[key][subKey]) { existingEntry[key][subKey] = newEntry[key][subKey]; updated = true; } }
          } else if (newEntry[key] && newEntry[key] !== '') { existingEntry[key] = newEntry[key]; updated = true; }
        }
        if (updated) duplicates++; else skipped++;
      } else { entries.unshift(newEntry); newEntries++; }
    } catch (error) { errors.push('Строка ' + (i + 2) + ': ' + error.message); skipped++; }
  }
  let message = '';
  if (newEntries > 0 || duplicates > 0) {
    saveLocally(); updateList();
    if (typeof updateViewList === 'function') updateViewList();
    message = '✅ Импортировано: ' + newEntries + ' новых, обновлено: ' + duplicates + ' существующих';
    if (fixedCount > 0) message += '\n🔧 Автоматически исправлено записей с объединенными данными: ' + fixedCount;
    if (skipped > 0) message += ', пропущено: ' + skipped;
    if (errors.length > 0) { message += '\n⚠️ Ошибок: ' + errors.length; console.warn('Ошибки импорта:', errors); }
  } else {
    message = '⚠️ Файл содержит ' + dataLines.length + ' строк данных, но новых: 0, обновлено: 0, пропущено: ' + skipped;
    if (errors.length > 0) message += '\n\nОшибки:\n' + errors.slice(0, 5).join('\n');
  }
  alert(message);
  event.target.value = '';
}
