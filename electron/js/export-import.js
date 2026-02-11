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

/**
 * Нормализует результат проверки на стельность для uziHistory (Стельная / Не стельная)
 */
function normalizePregnancyCheckResult(raw) {
  if (!raw || typeof raw !== 'string') return '';
  var s = raw.trim().toLowerCase();
  if (!s) return '';
  if (s === 'ст' || s === 'стел' || s === 'стельная' || s === 'стел.' || s === 'да') return 'Стельная';
  if (s === 'не стел' || s === 'нестельная' || s === 'яловая' || s === 'ял' || s === 'нет' || s === 'холостая') return 'Не стельная';
  return raw.trim();
}

/**
 * Возвращает список полей для маппинга при импорте (ключ + подпись). Включает данные из COW_FIELDS и спец. поля УЗИ.
 */
function getImportMappingFields() {
  var skipKeys = { cattleId: 1, pdo: 1, synced: 1, dateAdded: 1, lastModifiedBy: 1, daysPregnant: 1 };
  var list = [];
  if (typeof window.COW_FIELDS !== 'undefined' && window.COW_FIELDS.length > 0) {
    window.COW_FIELDS.forEach(function (f) {
      if (!skipKeys[f.key]) list.push({ key: f.key, label: f.label || f.key });
    });
  } else {
    var defaults = [
      { key: 'nickname', label: 'Кличка' }, { key: 'group', label: 'Группа' }, { key: 'birthDate', label: 'Дата рождения' },
      { key: 'lactation', label: 'Лактация' }, { key: 'calvingDate', label: 'Дата отёла' }, { key: 'inseminationDate', label: 'Дата осеменения' },
      { key: 'attemptNumber', label: 'Номер попытки' }, { key: 'bull', label: 'Бык' }, { key: 'inseminator', label: 'Осеменитель' },
      { key: 'code', label: 'Код' }, { key: 'status', label: 'Статус' }, { key: 'exitDate', label: 'Дата выбытия' },
      { key: 'dryStartDate', label: 'Начало сухостоя' }, { key: 'protocolName', label: 'Протокол' }, { key: 'protocolStartDate', label: 'Начало протокола' },
      { key: 'note', label: 'Примечание' }
    ];
    list = defaults.slice();
  }
  list.push({ key: 'pregnancyCheckResult', label: 'Результат проверки на стельность' });
  list.push({ key: 'pregnancyCheckDate', label: 'Дата проверки на стельность' });
  return list;
}

/**
 * Парсит файл (CSV или XLSX) в заголовки (первая строка) и строки данных.
 * @param {File} file
 * @returns {Promise<{ headers: string[], rows: string[][] }>}
 */
function parseFileToHeadersAndRows(file) {
  var name = (file.name || '').toLowerCase();
  if (name.endsWith('.xlsx')) {
    return new Promise(function (resolve, reject) {
      if (typeof XLSX === 'undefined') {
        reject(new Error('Библиотека SheetJS (XLSX) не загружена.'));
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
            reject(new Error('В файле нет данных (нужна минимум первая строка заголовков и одна строка данных).'));
            return;
          }
          var cleanStr = function (val) {
            if (val === null || val === undefined) return '';
            if (typeof val === 'number' && isNaN(val)) return '';
            return String(val).trim().replace(/[\x00-\x1F\x7F-\x9F]/g, '');
          };
          var headerRow = rows[0];
          var headers = [];
          var maxCol = Array.isArray(headerRow) ? headerRow.length : 0;
          for (var c = 0; c < maxCol; c++) {
            var h = headerRow[c];
            headers.push(cleanStr(h !== undefined && h !== null ? h : ''));
          }
          var dataRows = [];
          for (var r = 1; r < rows.length; r++) {
            var row = rows[r];
            if (!row || !Array.isArray(row)) continue;
            var cells = [];
            for (var c = 0; c < maxCol; c++) {
              var cell = row[c];
              if (cell === null || cell === undefined) cells.push('');
              else if (typeof cell === 'number' && !isNaN(cell) && typeof XLSX !== 'undefined' && XLSX.SSF) {
                var parsed = null;
                try {
                  if (XLSX.SSF.parse_date_code) {
                    var d = XLSX.SSF.parse_date_code(cell);
                    if (d && d.y >= 1900) {
                      parsed = d.y + '-' + String(d.m || 1).padStart(2, '0') + '-' + String(d.d || 1).padStart(2, '0');
                    }
                  }
                } catch (e) {}
                cells.push(parsed !== null ? parsed : cleanStr(cell));
              } else {
                cells.push(cleanStr(cell));
              }
            }
            while (cells.length < maxCol) cells.push('');
            dataRows.push(cells);
          }
          resolve({ headers: headers, rows: dataRows });
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = function () { reject(new Error('Не удалось прочитать файл.')); };
      reader.readAsArrayBuffer(file);
    });
  }
  return new Promise(function (resolve, reject) {
    if (typeof Papa === 'undefined') {
      reject(new Error('Библиотека PapaParse не загружена.'));
      return;
    }
    var reader = new FileReader();
    reader.onload = function () {
      var buffer = reader.result;
      if (!buffer || !(buffer instanceof ArrayBuffer)) {
        reject(new Error('Не удалось прочитать файл'));
        return;
      }
      var csvString = decodeCsvFileContent(buffer);
      Papa.parse(csvString, {
        encoding: 'UTF-8',
        header: false,
        skipEmptyLines: true,
        delimiter: '',
        newline: '',
        quoteChar: '"',
        escapeChar: '"',
        complete: function (results) {
          if (results.errors && results.errors.length > 0) console.warn('Предупреждения при парсинге CSV:', results.errors);
          var data = results.data;
          if (!data || data.length <= 1) {
            reject(new Error('Файл пуст или содержит только заголовки'));
            return;
          }
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
              complete: function (results2) {
                var d = results2.data;
                if (!d || d.length < 2) {
                  reject(new Error('Файл пуст или содержит только заголовки'));
                  return;
                }
                var headers = (d[0] || []).map(function (c) {
                  var s = c === null || c === undefined ? '' : String(c).trim();
                  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) s = s.slice(1, -1);
                  return s.replace(/[\x00-\x1F\x7F-\x9F]/g, '').trim();
                });
                var rows = [];
                for (var i = 1; i < d.length; i++) {
                  var row = (d[i] || []).map(function (c) {
                    if (c === null || c === undefined) return '';
                    var s = String(c).trim();
                    if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) s = s.slice(1, -1);
                    return s.replace(/[\x00-\x1F\x7F-\x9F]/g, '').trim();
                  });
                  rows.push(row);
                }
                resolve({ headers: headers, rows: rows });
              },
              error: function (err) { reject(err || new Error('Ошибка разбора CSV')); }
            });
            return;
          }
          var headers = (data[0] || []).map(function (c) {
            var s = c === null || c === undefined ? '' : String(c).trim();
            if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) s = s.slice(1, -1);
            return s.replace(/[\x00-\x1F\x7F-\x9F]/g, '').trim();
          });
          var rows = [];
          for (var i = 1; i < data.length; i++) {
            var row = (data[i] || []).map(function (c) {
              if (c === null || c === undefined) return '';
              var s = String(c).trim();
              if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) s = s.slice(1, -1);
              return s.replace(/[\x00-\x1F\x7F-\x9F]/g, '').trim();
            });
            rows.push(row);
          }
          resolve({ headers: headers, rows: rows });
        },
        error: function (err) { reject(err || new Error('Ошибка разбора CSV')); }
      });
    };
    reader.onerror = function () { reject(new Error('Ошибка при чтении файла')); };
    reader.readAsArrayBuffer(file);
  });
}

function handleImportFile(event) {
  var file = event.target.files[0];
  if (!file) return;
  var name = (file.name || '').toLowerCase();
  if (!name.endsWith('.csv') && !name.endsWith('.xlsx')) {
    alert('Выберите файл CSV или XLSX.');
    event.target.value = '';
    return;
  }
  parseFileToHeadersAndRows(file).then(function (parsed) {
    if (!parsed.headers || parsed.headers.length === 0 || !parsed.rows) {
      alert('В файле нет заголовков или данных.');
      event.target.value = '';
      return;
    }
    openImportMappingModal(parsed.headers, parsed.rows);
    event.target.value = '';
  }).catch(function (err) {
    alert('Ошибка: ' + (err && err.message ? err.message : String(err)));
    event.target.value = '';
  });
}

/**
 * Добавляет days дней к дате YYYY-MM-DD, возвращает YYYY-MM-DD
 */
function addDaysToDate(dateStr, days) {
  if (!dateStr || typeof dateStr !== 'string') return '';
  var d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  d.setDate(d.getDate() + days);
  var y = d.getFullYear(), m = d.getMonth() + 1, day = d.getDate();
  return y + '-' + String(m).padStart(2, '0') + '-' + String(day).padStart(2, '0');
}

/**
 * Импорт с маппингом: группировка по cattleId, слияние профиля, истории осеменений и проверок на стельность.
 * @param {string[][]} rows — строки данных (без заголовка)
 * @param {Object} columnMapping — ключ: индекс столбца (число), значение: ключ поля (cattleId, nickname, inseminationDate, pregnancyCheckResult, ...)
 * @param {string[]} headers — заголовки (для количества столбцов)
 */
function runImportWithMapping(rows, columnMapping, headers) {
  var cleanStr = function (str) {
    if (!str || typeof str !== 'string') return '';
    return str.replace(/[\x00-\x1F\x7F-\x9F]/g, '').trim();
  };
  var getCell = function (row, col) {
    if (col < 0 || col >= row.length) return '';
    var v = row[col];
    return (v === null || v === undefined) ? '' : String(v).trim();
  };

  var rowObjects = [];
  for (var r = 0; r < rows.length; r++) {
    var row = rows[r];
    if (!row || !Array.isArray(row)) continue;
    var cattleIdCol = columnMapping.cattleIdColumnIndex;
    if (cattleIdCol === undefined || cattleIdCol === null) continue;
    var cattleId = cleanStr(getCell(row, cattleIdCol));
    if (!cattleId) continue;
    var obj = { cattleId: cattleId, _rowIndex: r };
    for (var col in columnMapping) {
      if (col === 'cattleIdColumnIndex') continue;
          var fieldKey = columnMapping[col];
      if (!fieldKey || fieldKey === '_skip') continue;
      var colIdx = parseInt(col, 10);
      if (isNaN(colIdx)) continue;
      var raw = getCell(row, colIdx);
      if (fieldKey === 'birthDate' || fieldKey === 'calvingDate' || fieldKey === 'inseminationDate' || fieldKey === 'exitDate' || fieldKey === 'dryStartDate' || fieldKey === 'protocolStartDate' || fieldKey === 'pregnancyCheckDate') {
        obj[fieldKey] = normalizeDateForStorage(row[colIdx]);
      } else if (fieldKey === 'pregnancyCheckResult') {
        obj[fieldKey] = normalizePregnancyCheckResult(raw);
      } else if (fieldKey === 'status') {
        obj[fieldKey] = normalizeStatusFromImport(raw);
      } else if (fieldKey === 'lactation' || fieldKey === 'attemptNumber') {
        obj[fieldKey] = parseInt(raw, 10) || '';
      } else if (fieldKey === 'protocolName') {
        obj[fieldKey] = raw;
      } else {
        obj[fieldKey] = raw;
      }
    }
    rowObjects.push(obj);
  }

  var byCattleId = {};
  for (var i = 0; i < rowObjects.length; i++) {
    var o = rowObjects[i];
    var id = o.cattleId;
    if (!byCattleId[id]) byCattleId[id] = [];
    byCattleId[id].push(o);
  }

  var newCount = 0, updateCount = 0, errors = [];
  var profileKeys = ['nickname', 'group', 'birthDate', 'lactation', 'calvingDate', 'status', 'exitDate', 'dryStartDate', 'note', 'protocolName', 'protocolStartDate', 'inseminator', 'code'];

  for (var cattleId in byCattleId) {
    var group = byCattleId[cattleId];
    try {
      var entry = typeof getDefaultCowEntry === 'function' ? getDefaultCowEntry() : {
        cattleId: '', nickname: '', group: '', birthDate: '', lactation: '', calvingDate: '', inseminationDate: '', attemptNumber: 1, bull: '', inseminator: '', code: '', status: '', exitDate: '', dryStartDate: '', vwp: 60, note: '', protocol: { name: '', startDate: '' }, dateAdded: typeof nowFormatted === 'function' ? nowFormatted() : '', synced: false, userId: '', lastModifiedBy: '', inseminationHistory: [], actionHistory: [], uziHistory: []
      };
      entry.cattleId = cattleId;
      if (entry.dateAdded === '') entry.dateAdded = typeof nowFormatted === 'function' ? nowFormatted() : '';

      for (var k = 0; k < profileKeys.length; k++) {
        var pk = profileKeys[k];
        for (var g = group.length - 1; g >= 0; g--) {
          var val = group[g][pk];
          if (val !== undefined && val !== null && val !== '') {
            if (pk === 'protocolName') { entry.protocol = entry.protocol || {}; entry.protocol.name = val; }
            else if (pk === 'protocolStartDate') { entry.protocol = entry.protocol || {}; entry.protocol.startDate = val; }
            else entry[pk] = val;
            break;
          }
        }
      }

      var insemList = [];
      for (var g = 0; g < group.length; g++) {
        var rowObj = group[g];
        var idate = rowObj.inseminationDate;
        if (idate && normalizeDateForStorage(idate)) {
          insemList.push({
            date: normalizeDateForStorage(idate),
            attemptNumber: rowObj.attemptNumber !== undefined && rowObj.attemptNumber !== '' ? parseInt(rowObj.attemptNumber, 10) || 1 : 1,
            bull: cleanStr(rowObj.bull) || '',
            inseminator: cleanStr(rowObj.inseminator) || '',
            code: cleanStr(rowObj.code) || ''
          });
        }
      }
      insemList.sort(function (a, b) { var da = (a.date || '').toString(), db = (b.date || '').toString(); return da < db ? -1 : da > db ? 1 : 0; });
      var allInsemDates = insemList.map(function (x) { return x.date; });

      for (var g = 0; g < group.length; g++) {
        var rowObj = group[g];
        var pcr = rowObj.pregnancyCheckResult;
        if (!pcr || (pcr !== 'Стельная' && pcr !== 'Не стельная')) continue;
        var checkDate = '';
        if (rowObj.pregnancyCheckDate && normalizeDateForStorage(rowObj.pregnancyCheckDate)) {
          checkDate = normalizeDateForStorage(rowObj.pregnancyCheckDate);
        } else {
          var rowInsemDate = rowObj.inseminationDate ? normalizeDateForStorage(rowObj.inseminationDate) : '';
          var nextInsemAfter = null;
          for (var ii = 0; ii < allInsemDates.length; ii++) {
            if (rowInsemDate && allInsemDates[ii] > rowInsemDate) { nextInsemAfter = allInsemDates[ii]; break; }
          }
          if (nextInsemAfter) checkDate = nextInsemAfter;
          else {
            var lastInsem = allInsemDates.length > 0 ? allInsemDates[allInsemDates.length - 1] : '';
            checkDate = lastInsem ? addDaysToDate(lastInsem, 32) : '';
          }
        }
        if (!checkDate) continue;
        var daysNum = null;
        var lastInsemBefore = null;
        for (var j = allInsemDates.length - 1; j >= 0; j--) {
          if (allInsemDates[j] && String(allInsemDates[j]) < String(checkDate)) { lastInsemBefore = allInsemDates[j]; break; }
        }
        if (lastInsemBefore) {
          var d1 = new Date(lastInsemBefore), d2 = new Date(checkDate);
          if (!isNaN(d1.getTime()) && !isNaN(d2.getTime())) daysNum = Math.round((d2 - d1) / (24 * 60 * 60 * 1000));
        }
        if (!entry.uziHistory) entry.uziHistory = [];
        var duplicate = entry.uziHistory.some(function (u) { return u.date === checkDate && u.result === pcr; });
        if (!duplicate) {
          entry.uziHistory.push({ date: checkDate, result: pcr, specialist: '', daysFromInsemination: daysNum });
        }
      }
      if (entry.uziHistory && entry.uziHistory.length > 0) {
        entry.uziHistory.sort(function (a, b) { var da = (a.date || '').toString(), db = (b.date || '').toString(); return da < db ? -1 : da > db ? 1 : 0; });
        var lastUzi = entry.uziHistory[entry.uziHistory.length - 1];
        if (lastUzi.result === 'Стельная') entry.status = 'Стельная';
        if (lastUzi.result === 'Не стельная') entry.status = 'Холостая';
      }

      entry.inseminationHistory = insemList;
      var lastInsemRec = insemList.length > 0 ? insemList[insemList.length - 1] : null;
      entry.inseminationDate = lastInsemRec ? lastInsemRec.date : '';
      entry.attemptNumber = lastInsemRec ? lastInsemRec.attemptNumber : 1;
      entry.bull = lastInsemRec ? lastInsemRec.bull : '';
      entry.inseminator = lastInsemRec ? lastInsemRec.inseminator : '';
      entry.code = lastInsemRec ? lastInsemRec.code : '';
      if (!entry.status && lastInsemRec) entry.status = 'Осеменена';

      var existing = typeof entries !== 'undefined' && entries.find(function (e) { return e.cattleId === cattleId; });
      if (existing) {
        for (var pk2 = 0; pk2 < profileKeys.length; pk2++) {
          var key = profileKeys[pk2];
          if (key === 'protocolName' && entry.protocol && entry.protocol.name) { existing.protocol = existing.protocol || {}; existing.protocol.name = entry.protocol.name; }
          else if (key === 'protocolStartDate' && entry.protocol && entry.protocol.startDate) { existing.protocol = existing.protocol || {}; existing.protocol.startDate = entry.protocol.startDate; }
          else if (entry[key]) existing[key] = entry[key];
        }
        var existingInsem = existing.inseminationHistory || [];
        var mergedInsem = existingInsem.slice();
        var seen = {};
        existingInsem.forEach(function (h) { seen[(h.date || '') + '-' + (h.bull || '')] = true; });
        insemList.forEach(function (h) {
          var k = (h.date || '') + '-' + (h.bull || '');
          if (!seen[k]) { mergedInsem.push(h); seen[k] = true; }
        });
        mergedInsem.sort(function (a, b) { var da = (a.date || '').toString(), db = (b.date || '').toString(); return da < db ? -1 : da > db ? 1 : 0; });
        existing.inseminationHistory = mergedInsem;
        var lastM = mergedInsem.length > 0 ? mergedInsem[mergedInsem.length - 1] : null;
        existing.inseminationDate = lastM ? lastM.date : (existing.inseminationDate || '');
        existing.attemptNumber = lastM ? lastM.attemptNumber : (existing.attemptNumber || 1);
        existing.bull = lastM ? lastM.bull : (existing.bull || '');
        existing.inseminator = lastM ? lastM.inseminator : (existing.inseminator || '');
        existing.code = lastM ? lastM.code : (existing.code || '');
        var existingUzi = existing.uziHistory || [];
        entry.uziHistory.forEach(function (u) {
          var dup = existingUzi.some(function (eu) { return eu.date === u.date && eu.result === u.result; });
          if (!dup) existingUzi.push(u);
        });
        existing.uziHistory = existingUzi.sort(function (a, b) { var da = (a.date || '').toString(), db = (b.date || '').toString(); return da < db ? -1 : da > db ? 1 : 0; });
        if (entry.status) existing.status = entry.status;
        updateCount++;
      } else {
        entries.unshift(entry);
        newCount++;
      }
    } catch (err) {
      errors.push('Животное ' + cattleId + ': ' + (err.message || String(err)));
    }
  }

  if (newCount > 0 || updateCount > 0) {
    saveLocally();
    if (typeof updateList === 'function') updateList();
    if (typeof updateViewList === 'function') updateViewList();
    var msg = 'Импортировано: ' + newCount + ' новых, обновлено: ' + updateCount;
    if (errors.length > 0) msg += '. Ошибок: ' + errors.length;
    if (typeof showToast === 'function') showToast(msg, 'success');
    else alert(msg);
    if (errors.length > 0) console.warn('Ошибки импорта:', errors);
  } else {
    var msgErr = 'Нет данных для импорта или все строки пропущены.';
    if (errors.length > 0) msgErr += ' Ошибки: ' + errors.slice(0, 3).join('; ');
    if (typeof showToast === 'function') showToast(msgErr, 'error');
    else alert(msgErr);
  }
}

/**
 * Открывает модальное окно маппинга столбцов импорта и по кнопке «Импортировать» запускает runImportWithMapping.
 */
function openImportMappingModal(headers, rows) {
  var modal = document.getElementById('importMappingModal');
  if (!modal) return;
  var cattleSelect = document.getElementById('importMappingCattleColumn');
  var mappingList = document.getElementById('importMappingFieldsList');
  var importBtn = document.getElementById('importMappingImportBtn');
  var closeBtn = document.getElementById('importMappingCloseBtn');
  var closeBtn2 = document.getElementById('importMappingCloseBtn2');
  if (!cattleSelect || !mappingList || !importBtn) return;

  function closeImportMappingModal() {
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
  }

  cattleSelect.innerHTML = '';
  var opt0 = document.createElement('option');
  opt0.value = '';
  opt0.textContent = '— Выберите столбец с номером животного —';
  cattleSelect.appendChild(opt0);
  for (var i = 0; i < headers.length; i++) {
    var opt = document.createElement('option');
    opt.value = i;
    opt.textContent = (headers[i] || 'Столбец ' + (i + 1));
    cattleSelect.appendChild(opt);
  }

  mappingList.innerHTML = '';
  var mappingFields = getImportMappingFields();
  for (var i = 0; i < headers.length; i++) {
    var row = document.createElement('div');
    row.className = 'import-mapping-row';
    var label = document.createElement('label');
    label.className = 'import-mapping-col-label';
    label.textContent = (headers[i] || 'Столбец ' + (i + 1));
    var select = document.createElement('select');
    select.className = 'import-mapping-field-select';
    select.dataset.columnIndex = String(i);
    var optSkip = document.createElement('option');
    optSkip.value = '_skip';
    optSkip.textContent = 'Не импортировать';
    select.appendChild(optSkip);
    for (var f = 0; f < mappingFields.length; f++) {
      var o = document.createElement('option');
      o.value = mappingFields[f].key;
      o.textContent = mappingFields[f].label;
      select.appendChild(o);
    }
    row.appendChild(label);
    row.appendChild(select);
    mappingList.appendChild(row);
  }

  function buildColumnMapping() {
    var cattleCol = cattleSelect.value;
    if (cattleCol === '' || cattleCol === null) return null;
    var mapping = { cattleIdColumnIndex: parseInt(cattleCol, 10) };
    var selects = mappingList.querySelectorAll('.import-mapping-field-select');
    for (var s = 0; s < selects.length; s++) {
      var sel = selects[s];
      var colIdx = parseInt(sel.dataset.columnIndex, 10);
      if (colIdx === mapping.cattleIdColumnIndex) continue;
      var val = sel.value;
      if (val && val !== '_skip') mapping[colIdx] = val;
    }
    return mapping;
  }

  if (importBtn && !importBtn.dataset.bound) {
    importBtn.dataset.bound = '1';
    importBtn.addEventListener('click', function () {
      var cattleCol = cattleSelect.value;
      if (cattleCol === '' || cattleCol === null) {
        alert('Сначала выберите столбец с номером животного.');
        return;
      }
      var mapping = buildColumnMapping();
      if (!mapping) return;
      runImportWithMapping(rows, mapping, headers);
      closeImportMappingModal();
    });
  }

  if (closeBtn && !closeBtn.dataset.bound) {
    closeBtn.dataset.bound = '1';
    closeBtn.addEventListener('click', closeImportMappingModal);
  }
  if (closeBtn2 && !closeBtn2.dataset.bound) {
    closeBtn2.dataset.bound = '1';
    closeBtn2.addEventListener('click', closeImportMappingModal);
  }

  if (!modal.dataset.overlayBound) {
    modal.dataset.overlayBound = '1';
    modal.addEventListener('click', function (e) {
      if (e.target === modal) closeImportMappingModal();
    });
  }

  modal.classList.add('active');
  modal.setAttribute('aria-hidden', 'false');
  if (cattleSelect) cattleSelect.focus();
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
