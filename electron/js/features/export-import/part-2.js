/** __exportImport part 2 */
(function () {
  'use strict';
  var root = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this);
  var NS = root['__exportImport'] = root['__exportImport'] || {};
  var global = typeof window !== 'undefined' ? window : this;

function openImportMappingModal(headers, rows) {
  var modal = document.getElementById('importMappingModal');
  if (!modal) {
    var msg = 'Окно сопоставления столбцов не найдено. Обновите страницу.';
    if (typeof showToast === 'function') showToast(msg, 'error'); else alert(msg);
    return;
  }
  var cattleSelect = document.getElementById('importMappingCattleColumn');
  var mappingList = document.getElementById('importMappingFieldsList');
  var importBtn = document.getElementById('importMappingImportBtn');
  var autoBtn = document.getElementById('importMappingAutoBtn');
  var closeBtn = document.getElementById('importMappingCloseBtn');
  var closeBtn2 = document.getElementById('importMappingCloseBtn2');
  if (!cattleSelect || !mappingList || !importBtn) {
    var msg2 = 'Не найдены элементы окна импорта. Обновите страницу.';
    if (typeof showToast === 'function') showToast(msg2, 'error'); else alert(msg2);
    return;
  }

  modal._importHeaders = headers;
  modal._importRows = rows;

  function closeImportMappingModal() {
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
  }

  function normalizeHeaderForMatch(raw) {
    return String(raw || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/ё/g, 'е');
  }

  /** Алиасы заголовков файла → ключ поля импорта (cattleId — отдельно). */
  var HEADER_ALIASES = {
    'номер': 'cattleId',
    'номер коровы': 'cattleId',
    'номер животного': 'cattleId',
    'корова': 'cattleId',
    'id': 'cattleId',
    'cattleid': 'cattleId',
    'ninv': 'cattleId',
    'кличка': 'nickname',
    'имя': 'nickname',
    'nickname': 'nickname',
    'группа': 'group',
    'group': 'group',
    'ферма': 'group',
    'дата рождения': 'birthDate',
    'рождение': 'birthDate',
    'birthdate': 'birthDate',
    'лактация': 'lactation',
    'lactation': 'lactation',
    'дата отела': 'calvingDate',
    'отел': 'calvingDate',
    'calvingdate': 'calvingDate',
    'дата осеменения': 'inseminationDate',
    'осеменение': 'inseminationDate',
    'inseminationdate': 'inseminationDate',
    'номер попытки': 'attemptNumber',
    'попытка': 'attemptNumber',
    'attemptnumber': 'attemptNumber',
    'бык': 'bull',
    'bull': 'bull',
    'техник ио': 'inseminator',
    'техник': 'inseminator',
    'осеменатор': 'inseminator',
    'inseminator': 'inseminator',
    'код': 'code',
    'code': 'code',
    'статус': 'status',
    'status': 'status',
    'протокол': 'protocolName',
    'protocolname': 'protocolName',
    'начало протокола': 'protocolStartDate',
    'protocolstartdate': 'protocolStartDate',
    'дата выбытия': 'exitDate',
    'выбытие': 'exitDate',
    'exitdate': 'exitDate',
    'начало сухостоя': 'dryStartDate',
    'сухостой': 'dryStartDate',
    'drystartdate': 'dryStartDate',
    'примечание': 'note',
    'note': 'note',
    'комментарий': 'note',
    'результат проверки на стельность': 'pregnancyCheckResult',
    'результат узи': 'pregnancyCheckResult',
    'узи': 'pregnancyCheckResult',
    'дата проверки на стельность': 'pregnancyCheckDate',
    'дата узи': 'pregnancyCheckDate',
    'дата события': 'inseminationDate',
    'дата ио': 'inseminationDate',
    'тип события': 'eventType',
    'событие': 'eventType',
    'eventtype': 'eventType',
    'тип': 'eventType'
  };

  function resolveFieldKeyFromHeader(headerText, mappingFields) {
    var norm = normalizeHeaderForMatch(headerText);
    if (!norm) return null;
    if (HEADER_ALIASES[norm]) return HEADER_ALIASES[norm];
    // точное совпадение с подписью поля
    for (var i = 0; i < mappingFields.length; i++) {
      var lab = normalizeHeaderForMatch(mappingFields[i].label);
      var key = normalizeHeaderForMatch(mappingFields[i].key);
      if (norm === lab || norm === key) return mappingFields[i].key;
    }
    // частичное: заголовок содержит подпись или наоборот
    for (var j = 0; j < mappingFields.length; j++) {
      var lab2 = normalizeHeaderForMatch(mappingFields[j].label);
      if (lab2.length >= 3 && (norm.indexOf(lab2) !== -1 || lab2.indexOf(norm) !== -1)) {
        return mappingFields[j].key;
      }
    }
    return null;
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
  var mappingFields = (typeof getImportMappingFields === 'function')
    ? getImportMappingFields()
    : (typeof window.getImportMappingFields === 'function' ? window.getImportMappingFields() : []);
  for (var i = 0; i < headers.length; i++) {
    var row = document.createElement('div');
    row.className = 'import-mapping-row';
    row.dataset.columnIndex = String(i);
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

  function updateCattleColumnVisibility() {
    var cattleCol = cattleSelect.value;
    var mapRows = mappingList.querySelectorAll('.import-mapping-row');
    for (var r = 0; r < mapRows.length; r++) {
      var rw = mapRows[r];
      rw.style.display = (rw.dataset.columnIndex === cattleCol) ? 'none' : '';
    }
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

  /** Распределить поля по названиям столбцов файла; номер животного — отдельно. */
  function autoMapColumnsByHeaders() {
    var usedKeys = {};
    var cattleIdx = -1;
    var hdrs = modal._importHeaders || headers;

    for (var hi = 0; hi < hdrs.length; hi++) {
      var key = resolveFieldKeyFromHeader(hdrs[hi], mappingFields);
      if (key === 'cattleId' && cattleIdx < 0) cattleIdx = hi;
    }
    if (cattleIdx < 0) {
      for (var hj = 0; hj < hdrs.length; hj++) {
        var hn = normalizeHeaderForMatch(hdrs[hj]);
        if (hn === 'номер' || hn.indexOf('номер') === 0) {
          cattleIdx = hj;
          break;
        }
      }
    }
    if (cattleIdx >= 0) {
      cattleSelect.value = String(cattleIdx);
    }

    var selects = mappingList.querySelectorAll('.import-mapping-field-select');
    for (var s = 0; s < selects.length; s++) {
      selects[s].value = '_skip';
    }
    for (var ci = 0; ci < selects.length; ci++) {
      var sel = selects[ci];
      var colIdx = parseInt(sel.dataset.columnIndex, 10);
      if (colIdx === cattleIdx) continue;
      var fieldKey = resolveFieldKeyFromHeader(hdrs[colIdx], mappingFields);
      if (!fieldKey || fieldKey === 'cattleId') continue;
      if (usedKeys[fieldKey]) continue;
      // есть ли такой option
      var hasOpt = false;
      for (var oi = 0; oi < sel.options.length; oi++) {
        if (sel.options[oi].value === fieldKey) {
          hasOpt = true;
          break;
        }
      }
      if (!hasOpt) continue;
      sel.value = fieldKey;
      usedKeys[fieldKey] = true;
    }
    updateCattleColumnVisibility();
    var mappedCount = Object.keys(usedKeys).length + (cattleIdx >= 0 ? 1 : 0);
    if (typeof showToast === 'function') {
      showToast(
        cattleIdx >= 0
          ? 'Автораспределение: номер + ' + Object.keys(usedKeys).length + ' полей. Проверьте и при необходимости поправьте.'
          : 'Автораспределение: ' + mappedCount + ' полей. Укажите столбец с номером животного.',
        'info',
        5000
      );
    }
  }

  cattleSelect.onchange = updateCattleColumnVisibility;

  // автораспределение при каждом открытии
  autoMapColumnsByHeaders();
  updateCattleColumnVisibility();

  importBtn.onclick = function () {
    var currentRows = modal._importRows;
    var currentHeaders = modal._importHeaders;
    if (!currentRows || !currentHeaders) {
      if (typeof showToast === 'function') showToast('Нет данных для импорта. Выберите файл заново.', 'error');
      else alert('Нет данных для импорта. Выберите файл заново.');
      return;
    }
    var cattleCol = cattleSelect.value;
    if (cattleCol === '' || cattleCol === null) {
      if (typeof showToast === 'function') showToast('Сначала выберите столбец с номером животного.', 'error');
      else alert('Сначала выберите столбец с номером животного.');
      return;
    }
    var mapping = buildColumnMapping();
    if (!mapping) return;
    var runFn = NS.runImportWithMapping || (typeof runImportWithMapping === 'function' ? runImportWithMapping : null);
    var hasEventType = false;
    for (var mk in mapping) {
      if (mk === 'cattleIdColumnIndex') continue;
      if (mapping[mk] === 'eventType') { hasEventType = true; break; }
    }
    if (hasEventType) {
      runFn = NS.runImportHistoryEvents || (typeof runImportHistoryEvents === 'function' ? runImportHistoryEvents : runFn);
    }
    if (!runFn) {
      if (typeof showToast === 'function') showToast('Модуль импорта не загружен. Обновите приложение.', 'error');
      else alert('Модуль импорта не загружен. Обновите приложение.');
      return;
    }
    importBtn.disabled = true;
    var progress = typeof showProgressOverlay === 'function'
      ? showProgressOverlay({ title: 'Импорт данных…', detail: 'Подготовка…' })
      : null;
    Promise.resolve()
      .then(function () {
        return new Promise(function (resolve) { setTimeout(resolve, 40); });
      })
      .then(function () {
        return runFn(currentRows, mapping, currentHeaders, progress);
      })
      .then(function () {
        closeImportMappingModal();
      })
      .catch(function (err) {
        if (typeof showToast === 'function') {
          showToast((err && err.message) ? err.message : 'Ошибка импорта', 'error');
        } else {
          alert((err && err.message) ? err.message : 'Ошибка импорта');
        }
      })
      .then(function () {
        if (progress) progress.close();
        importBtn.disabled = false;
      });
  };

  if (autoBtn) {
    autoBtn.onclick = function () {
      autoMapColumnsByHeaders();
    };
  }
  if (closeBtn) closeBtn.onclick = closeImportMappingModal;
  if (closeBtn2) closeBtn2.onclick = closeImportMappingModal;

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

function importFromCSV(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (typeof Papa === 'undefined') {
    if (typeof showToast === 'function') showToast('Библиотека PapaParse не загружена.', 'error'); else alert('❌ Библиотека PapaParse не загружена.');
    event.target.value = '';
    return;
  }
  var reader = new FileReader();
  reader.onload = function () {
    var buffer = reader.result;
    if (!buffer || !(buffer instanceof ArrayBuffer)) {
      if (typeof showToast === 'function') showToast('Не удалось прочитать файл', 'error'); else alert('❌ Не удалось прочитать файл');
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
            error: function (error) { if (typeof showToast === 'function') showToast('Ошибка при разборе файла: ' + (error && error.message ? error.message : ''), 'error'); else alert('❌ Ошибка при разборе файла: ' + (error && error.message ? error.message : '')); event.target.value = ''; }
          });
          return;
        }
        processImportData(data, delimiter, event);
      },
      error: function (error) { if (typeof showToast === 'function') showToast('Ошибка при разборе файла: ' + (error && error.message ? error.message : ''), 'error'); else alert('❌ Ошибка при разборе файла: ' + (error && error.message ? error.message : '')); event.target.value = ''; }
    });
  };
  reader.onerror = function () { if (typeof showToast === 'function') showToast('Ошибка при чтении файла', 'error'); else alert('❌ Ошибка при чтении файла'); event.target.value = ''; };
  reader.readAsArrayBuffer(file);
}
function importFromExcelWide(event) {
  var file = event.target.files[0];
  if (!file) return;
  if (typeof XLSX === 'undefined') {
    if (typeof showToast === 'function') showToast('Библиотека SheetJS (XLSX) не загружена.', 'error'); else alert('❌ Библиотека SheetJS (XLSX) не загружена.');
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
        if (typeof showToast === 'function') showToast('В файле нет данных.', 'error'); else alert('❌ В файле нет данных.');
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

  // register functions
  NS.openImportMappingModal = openImportMappingModal;
  NS.importFromCSV = importFromCSV;
  NS.importFromExcelWide = importFromExcelWide;
  NS.processImportData = processImportData;
})();
export {};
