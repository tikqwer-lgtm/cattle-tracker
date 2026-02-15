// export-import-parse.js — нормализация полей и парсинг CSV/Excel для импорта

/**
 * Приводит дату из CSV к формату YYYY-MM-DD для хранения и input type="date"
 */
function normalizeDateForStorage(str) {
  if (str === null || str === undefined) return '';
  var numVal = null;
  if (typeof str === 'number' && !isNaN(str)) numVal = str;
  else if (typeof str === 'string' && /^\d+$/.test(str.trim())) numVal = parseInt(str.trim(), 10);
  if (numVal !== null && typeof XLSX !== 'undefined' && XLSX.SSF && XLSX.SSF.parse_date_code) {
    try {
      var d = XLSX.SSF.parse_date_code(numVal);
      if (d && d.y >= 1900 && d.y <= 2100) {
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
  if (raw === null || raw === undefined) return '';
  var s = String(raw).trim().toLowerCase().replace(/\.$/, '');
  if (!s) return '';
  if (s === 'осем' || s === 'осемененная') return 'Осемененная';
  if (s === 'не стел' || s === 'нестельная') return 'Холостая';
  if (s === 'яловая' || s === 'ял') return 'Холостая';
  if (s === 'ст' || s === 'стел' || s === 'стельная') return 'Стельная';
  return String(raw).trim();
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
      { key: 'attemptNumber', label: 'Номер попытки' }, { key: 'bull', label: 'Бык' }, { key: 'inseminator', label: 'Техник ИО' },
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
              else cells.push(cleanStr(cell));
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
export {};
