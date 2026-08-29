/** __exportImport part 1 */
(function () {
  'use strict';
  var root = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this);
  var NS = root['__exportImport'] = root['__exportImport'] || {};
  var global = typeof window !== 'undefined' ? window : this;

function importData(event) {
  var file = event && event.target && event.target.files && event.target.files[0];
  if (!file) return;
  if (typeof window.importBackupFromFile !== 'function') {
    if (typeof showToast === 'function') showToast('Импорт JSON недоступен. Убедитесь, что загружен модуль резервного копирования.', 'error'); else alert('Импорт JSON недоступен. Убедитесь, что загружен модуль резервного копирования.');
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

function handleImportFile(event) {
  try {
    var target = event && event.target;
    var file = target && target.files && target.files[0];
    if (!file) return;
    var name = (file.name || '').toLowerCase();
    if (!name.endsWith('.csv') && !name.endsWith('.xlsx')) {
      if (typeof showToast === 'function') showToast('Выберите файл CSV или XLSX.', 'error'); else alert('Выберите файл CSV или XLSX.');
      if (target) target.value = '';
      return;
    }
    var parseFn = (typeof parseFileToHeadersAndRows === 'function')
      ? parseFileToHeadersAndRows
      : (typeof window !== 'undefined' && typeof window.parseFileToHeadersAndRows === 'function'
        ? window.parseFileToHeadersAndRows
        : null);
    if (!parseFn) {
      if (typeof showToast === 'function') showToast('Ошибка: модуль разбора файла не загружен. Обновите приложение.', 'error');
      else alert('Ошибка: модуль разбора файла не загружен. Обновите приложение.');
      if (target) target.value = '';
      return;
    }
    parseFn(file).then(function (parsed) {
      if (!parsed.headers || parsed.headers.length === 0 || !parsed.rows) {
        if (typeof showToast === 'function') showToast('В файле нет заголовков или данных.', 'error'); else alert('В файле нет заголовков или данных.');
        if (target) target.value = '';
        return;
      }
      globalThis['__exportImport'].openImportMappingModal(parsed.headers, parsed.rows);
      if (target) target.value = '';
    }).catch(function (err) {
      if (typeof showToast === 'function') showToast('Ошибка: ' + (err && err.message ? err.message : String(err)), 'error'); else alert('Ошибка: ' + (err && err.message ? err.message : String(err)));
      if (target) target.value = '';
    });
  } catch (err) {
    if (typeof showToast === 'function') showToast('Ошибка импорта: ' + (err && err.message ? err.message : String(err)), 'error');
    else alert('Ошибка импорта: ' + (err && err.message ? err.message : String(err)));
    if (event.target) event.target.value = '';
  }
}

/**
 * Импорт с маппингом: группировка по cattleId, слияние профиля, истории осеменений и проверок на стельность.
 * @param {string[][]} rows — строки данных (без заголовка)
 * @param {Object} columnMapping — ключ: индекс столбца (число), значение: ключ поля (cattleId, nickname, inseminationDate, pregnancyCheckResult, ...)
 * @param {string[]} headers — заголовки (для количества столбцов)
 */
function runImportWithMapping(rows, columnMapping, headers, progress) {
  var cleanStr = function (str) {
    if (!str || typeof str !== 'string') return '';
    return str.replace(/[\x00-\x1F\x7F-\x9F]/g, '').trim();
  };
  var getCell = function (row, col) {
    if (col < 0 || col >= row.length) return '';
    var v = row[col];
    return (v === null || v === undefined) ? '' : String(v).trim();
  };

  var dateCols = [], bullCols = [];
  for (var col in columnMapping) {
    if (col === 'cattleIdColumnIndex') continue;
    var idx = parseInt(col, 10);
    if (isNaN(idx)) continue;
    if (columnMapping[col] === 'inseminationDate') dateCols.push(idx);
    if (columnMapping[col] === 'bull') bullCols.push(idx);
  }
  dateCols.sort(function (a, b) { return a - b; });
  bullCols.sort(function (a, b) { return a - b; });

  var rowObjects = [];
  for (var r = 0; r < rows.length; r++) {
    var row = rows[r];
    if (!row || !Array.isArray(row)) continue;
    var cattleIdCol = columnMapping.cattleIdColumnIndex;
    if (cattleIdCol === undefined || cattleIdCol === null) continue;
    var cattleId = cleanStr(getCell(row, cattleIdCol));
    if (!cattleId) continue;
    var obj = { cattleId: cattleId, _rowIndex: r, inseminationPairs: [] };
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
      } else if (fieldKey === 'lactation') {
        var lactNum = parseInt(raw, 10);
        obj[fieldKey] = (raw === '' || raw === null || raw === undefined) ? '' : (isNaN(lactNum) ? '' : lactNum);
      } else if (fieldKey === 'attemptNumber') {
        obj[fieldKey] = parseInt(raw, 10) || '';
      } else if (fieldKey === 'protocolName') {
        obj[fieldKey] = raw;
      } else {
        obj[fieldKey] = raw;
      }
    }
    for (var pi = 0; pi < dateCols.length || pi < bullCols.length; pi++) {
      var dCol = dateCols[pi], bCol = bullCols[pi];
      var pairDate = dCol !== undefined ? normalizeDateForStorage(getCell(row, dCol)) : '';
      var pairBull = bCol !== undefined ? cleanStr(getCell(row, bCol)) : '';
      if (pairDate || pairBull) {
        obj.inseminationPairs.push({
          date: pairDate,
          attemptNumber: pi + 1,
          bull: pairBull,
          inseminator: cleanStr(obj.inseminator) || '',
          code: cleanStr(obj.code) || ''
        });
      }
    }
    if (obj.inseminationPairs.length > 0) {
      var lastP = obj.inseminationPairs[obj.inseminationPairs.length - 1];
      obj.inseminationDate = lastP.date;
      obj.bull = lastP.bull;
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

  var cattleIds = Object.keys(byCattleId);
  if (progress && typeof progress.update === 'function') {
    if (typeof progress.setTitle === 'function') progress.setTitle('Импорт данных…');
    progress.update(0, Math.max(cattleIds.length, 1), 'Обработка записей…');
  }

  var newCount = 0, updateCount = 0, errors = [];
  var createdEntries = [];
  var updatedEntries = [];
  var profileKeys = ['nickname', 'collar', 'group', 'birthDate', 'lactation', 'calvingDate', 'status', 'exitDate', 'dryStartDate', 'note', 'protocolName', 'protocolStartDate', 'inseminator', 'code'];

  function processOneCattle(cattleId) {
    var group = byCattleId[cattleId];
    try {
      var entry = typeof getDefaultCowEntry === 'function' ? getDefaultCowEntry() : {
        cattleId: '', nickname: '', group: '', birthDate: '', lactation: '', calvingDate: '', inseminationDate: '', attemptNumber: '', bull: '', inseminator: '', code: '', status: '', exitDate: '', dryStartDate: '', vwp: 60, note: '', protocol: { name: '', startDate: '' }, dateAdded: typeof nowFormatted === 'function' ? nowFormatted() : '', synced: false, userId: '', lastModifiedBy: '', inseminationHistory: [], actionHistory: [], uziHistory: []
      };
      entry.cattleId = cattleId;
      if (entry.dateAdded === '') entry.dateAdded = typeof nowFormatted === 'function' ? nowFormatted() : '';

      for (var k = 0; k < profileKeys.length; k++) {
        var pk = profileKeys[k];
        for (var g = group.length - 1; g >= 0; g--) {
          var val = group[g][pk];
          var hasVal = val !== undefined && val !== null && (val !== '' || (pk === 'lactation' && val === 0));
          if (hasVal) {
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
        if (rowObj.inseminationPairs && rowObj.inseminationPairs.length > 0) {
          for (var ip = 0; ip < rowObj.inseminationPairs.length; ip++) {
            var rec = rowObj.inseminationPairs[ip];
            var nd = rec.date ? normalizeDateForStorage(rec.date) : '';
            if (nd || (rec.bull && cleanStr(rec.bull))) {
              insemList.push({
                date: nd,
                attemptNumber: rec.attemptNumber !== undefined && rec.attemptNumber !== '' ? parseInt(rec.attemptNumber, 10) || 1 : 1,
                bull: cleanStr(rec.bull) || '',
                inseminator: cleanStr(rec.inseminator) || '',
                code: cleanStr(rec.code) || ''
              });
            }
          }
        } else {
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
      entry.attemptNumber = lastInsemRec ? lastInsemRec.attemptNumber : '';
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
        existing.attemptNumber = lastM ? lastM.attemptNumber : (existing.attemptNumber || '');
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
        updatedEntries.push(existing);
        updateCount++;
      } else {
        entries.unshift(entry);
        createdEntries.push(entry);
        newCount++;
      }
    } catch (err) {
      errors.push('Животное ' + cattleId + ': ' + (err.message || String(err)));
    }
  }

  function refreshUiAfterImport() {
    if (typeof updateList === 'function') updateList();
    if (typeof updateViewList === 'function') updateViewList();
    if (typeof notifyDataErrorsFromImport === 'function') notifyDataErrorsFromImport(entries);
    if (typeof updateMenuCalvingForecast === 'function') updateMenuCalvingForecast();
    if (typeof updateHerdStats === 'function') updateHerdStats();
  }

  function showImportResultMsg(apiErrors) {
    apiErrors = apiErrors || [];
    var msg = 'Импортировано: ' + newCount + ' новых, обновлено: ' + updateCount;
    if (global.CATTLE_TRACKER_USE_API) msg += '. Данные сохранены на сервере';
    if (errors.length > 0) msg += '. Ошибок разбора: ' + errors.length;
    if (apiErrors.length > 0) msg += '. Ошибок сохранения на сервер: ' + apiErrors.length;
    var toastType = (errors.length > 0 || apiErrors.length > 0) ? 'error' : 'success';
    if (typeof showToast === 'function') showToast(msg, toastType, apiErrors.length ? 8000 : 5000);
    else alert(msg);
    if (errors.length > 0) console.warn('Ошибки импорта:', errors);
    if (apiErrors.length > 0) console.warn('Ошибки сохранения импорта на API:', apiErrors);
  }

  function finishAfterMerge() {
    if (newCount > 0 || updateCount > 0) {
      var useApi = typeof global.CATTLE_TRACKER_USE_API !== 'undefined' && global.CATTLE_TRACKER_USE_API &&
        global.CattleTrackerApi && typeof global.persistImportEntriesToApi === 'function';

      if (useApi) {
        if (progress && typeof progress.setTitle === 'function') progress.setTitle('Сохранение на сервер…');
        var onProg = progress && typeof progress.update === 'function'
          ? function (done, total, text) { progress.update(done, total, text); }
          : null;
        return global.persistImportEntriesToApi(createdEntries, updatedEntries, onProg).then(function (apiErrors) {
          refreshUiAfterImport();
          showImportResultMsg(apiErrors);
        }).catch(function (err) {
          refreshUiAfterImport();
          var failMsg = 'Импорт выполнен локально, но сохранение на сервер не удалось: ' +
            (err && err.message ? err.message : String(err)) +
            '. Выгрузите базу вручную или повторите импорт после выбора базы.';
          if (typeof showToast === 'function') showToast(failMsg, 'error', 10000);
          else alert(failMsg);
        });
      }

      if (progress) progress.update(1, 1, 'Сохранение…');
      saveLocally();
      refreshUiAfterImport();
      showImportResultMsg([]);
      return Promise.resolve();
    }

    var msgErr = 'Нет данных для импорта или все строки пропущены.';
    if (errors.length > 0) msgErr += ' Ошибки: ' + errors.slice(0, 3).join('; ');
    if (typeof showToast === 'function') showToast(msgErr, 'error');
    else alert(msgErr);
    return Promise.resolve();
  }

  var MERGE_CHUNK = 50;
  var ci = 0;
  function mergeChunk() {
    var end = Math.min(ci + MERGE_CHUNK, cattleIds.length);
    for (; ci < end; ci++) processOneCattle(cattleIds[ci]);
    if (progress && typeof progress.update === 'function') {
      progress.update(ci, Math.max(cattleIds.length, 1), 'Обработка: ' + ci + ' из ' + cattleIds.length);
    }
    if (ci < cattleIds.length) {
      return new Promise(function (resolve) {
        setTimeout(function () { resolve(mergeChunk()); }, 0);
      });
    }
    return finishAfterMerge();
  }

  return mergeChunk();
}

/**
 * Импорт файла событий Selex (Тип события = Осеменение | Отёл).
 * Не ломает текущую карточку: достраивает lactationHistory и actionHistory.
 * Порядок: сначала файл текущего стада, затем этот.
 */
function runImportHistoryEvents(rows, columnMapping, headers, progress) {
  var cleanStr = function (str) {
    if (!str || typeof str !== 'string') return '';
    return str.replace(/[\x00-\x1F\x7F-\x9F]/g, '').trim();
  };
  var getCell = function (row, col) {
    if (col < 0 || col >= row.length) return '';
    var v = row[col];
    return (v === null || v === undefined) ? '' : String(v).trim();
  };
  var findCol = function (key) {
    for (var col in columnMapping) {
      if (col === 'cattleIdColumnIndex') continue;
      if (columnMapping[col] === key) return parseInt(col, 10);
    }
    return -1;
  };

  var cattleIdCol = columnMapping.cattleIdColumnIndex;
  var typeCol = findCol('eventType');
  var dateCol = findCol('inseminationDate');
  if (dateCol < 0) dateCol = findCol('calvingDate');
  var bullCol = findCol('bull');
  var texnCol = findCol('inseminator');
  var noteCol = findCol('note');

  if (cattleIdCol === undefined || cattleIdCol === null || typeCol < 0 || dateCol < 0) {
    var msgMap = 'Для файла событий нужны столбцы: Номер, Тип события, Дата (осеменения или отёла).';
    if (typeof showToast === 'function') showToast(msgMap, 'error');
    else alert(msgMap);
    return Promise.resolve();
  }

  if (progress && typeof progress.setTitle === 'function') progress.setTitle('Импорт истории событий…');

  /** @type {Record<string, Array<{type:string,date:string,bull:string,texn:string,note:string}>>} */
  var byCow = {};
  for (var r = 0; r < rows.length; r++) {
    var row = rows[r];
    if (!row || !Array.isArray(row)) continue;
    var cattleId = cleanStr(getCell(row, cattleIdCol));
    if (!cattleId) continue;
    var typeRaw = cleanStr(getCell(row, typeCol)).toLowerCase();
    var type = '';
    if (typeRaw.indexOf('отёл') !== -1 || typeRaw.indexOf('отел') !== -1 || typeRaw === 'calving') type = 'Отёл';
    else if (typeRaw.indexOf('осемен') !== -1 || typeRaw === 'ai' || typeRaw === 'insemination') type = 'Осеменение';
    else continue;
    var dateVal = typeof normalizeDateForStorage === 'function'
      ? normalizeDateForStorage(getCell(row, dateCol))
      : cleanStr(getCell(row, dateCol));
    if (!dateVal) continue;
    if (!byCow[cattleId]) byCow[cattleId] = [];
    byCow[cattleId].push({
      type: type,
      date: dateVal,
      bull: bullCol >= 0 ? cleanStr(getCell(row, bullCol)) : '',
      texn: texnCol >= 0 ? cleanStr(getCell(row, texnCol)) : '',
      note: noteCol >= 0 ? cleanStr(getCell(row, noteCol)) : ''
    });
  }

  var cattleIds = Object.keys(byCow);
  var updated = 0;
  var skipped = 0;
  var histAdded = 0;
  var actionAdded = 0;
  var errors = [];

  function cmpD(a, b) {
    return a < b ? -1 : a > b ? 1 : 0;
  }

  function processOne(cattleId) {
    var events = byCow[cattleId];
    events.sort(function (a, b) {
      var d = cmpD(a.date, b.date);
      if (d) return d;
      if (a.type === b.type) return 0;
      return a.type === 'Осеменение' ? -1 : 1;
    });

    var entry = typeof entries !== 'undefined' && entries.find(function (e) { return e.cattleId === cattleId; });
    if (!entry) {
      skipped++;
      return;
    }

    var calvings = events.filter(function (e) { return e.type === 'Отёл'; }).map(function (e) { return e.date; });
    // unique calving dates
    calvings = calvings.filter(function (d, i, arr) { return arr.indexOf(d) === i; }).sort(cmpD);
    var osems = events.filter(function (e) { return e.type === 'Осеменение'; });

    if (!entry.lactationHistory) entry.lactationHistory = [];
    if (!entry.actionHistory) entry.actionHistory = [];

    var prevCalv = '';
    for (var ci = 0; ci < calvings.length; ci++) {
      var C = calvings[ci];
      var cycleOsems = osems.filter(function (o) {
        if (prevCalv && o.date <= prevCalv) return false;
        return o.date < C;
      });
      var already = entry.lactationHistory.some(function (s) {
        return s && String(s.calvingDate || '') === String(C);
      });
      if (!already) {
        var snapInsem = cycleOsems.map(function (o, idx) {
          return {
            date: o.date,
            attemptNumber: idx + 1,
            bull: o.bull || '',
            inseminator: o.texn || '',
            code: ''
          };
        });
        var lastO = snapInsem.length ? snapInsem[snapInsem.length - 1] : null;
        entry.lactationHistory.push({
          number: ci + 1,
          calvingDate: C,
          dryStartDate: '',
          dryDuration: null,
          inseminationDate: lastO ? lastO.date : '',
          attemptNumber: lastO ? lastO.attemptNumber : 1,
          bull: lastO ? lastO.bull : '',
          inseminator: lastO ? lastO.inseminator : '',
          code: '',
          inseminationHistory: snapInsem,
          uziHistory: [],
          status: 'Отёл',
          protocol: { name: '', startDate: '' },
          source: 'selex'
        });
        histAdded++;
      }
      prevCalv = C;
    }

    // Журнал действий (без дублей по типу+дата)
    events.forEach(function (ev) {
      var exists = entry.actionHistory.some(function (h) {
        var hd = String(h.dateTime || '').slice(0, 10);
        return hd === ev.date && (h.eventType === ev.type || h.action === ev.type);
      });
      if (exists) return;
      var details = ev.type === 'Отёл'
        ? ('Дата отёла: ' + ev.date + (ev.note ? '; ' + ev.note : ''))
        : ('Дата: ' + ev.date + (ev.bull ? '; бык: ' + ev.bull : '') + (ev.texn ? '; техник: ' + ev.texn : ''));
      entry.actionHistory.push({
        dateTime: ev.date + ' 12:00',
        userName: 'Selex',
        action: ev.type,
        details: details,
        eventType: ev.type,
        bull: ev.bull || '',
        inseminator: ev.texn || '',
        attemptNumber: ''
      });
      actionAdded++;
    });

    entry.lactationHistory.sort(function (a, b) {
      return cmpD(String(a.calvingDate || ''), String(b.calvingDate || ''));
    });
    entry.synced = false;
    updated++;
  }

  var i = 0;
  var CHUNK = 40;
  function chunk() {
    var end = Math.min(i + CHUNK, cattleIds.length);
    for (; i < end; i++) {
      try { processOne(cattleIds[i]); }
      catch (err) { errors.push(cattleIds[i] + ': ' + (err && err.message ? err.message : String(err))); }
    }
    if (progress) progress.update(i, Math.max(cattleIds.length, 1), 'История: ' + i + ' из ' + cattleIds.length);
    if (i < cattleIds.length) {
      return new Promise(function (resolve) { setTimeout(function () { resolve(chunk()); }, 0); });
    }
    var useApi = typeof global !== 'undefined' && global.CATTLE_TRACKER_USE_API && global.CattleTrackerApi;
    // window global
    useApi = typeof window !== 'undefined' && window.CATTLE_TRACKER_USE_API && window.CattleTrackerApi;

    function finishMsg() {
      if (typeof updateList === 'function') updateList();
      if (typeof updateViewList === 'function') updateViewList();
      if (typeof updateHerdStats === 'function') updateHerdStats();
      var msg = 'История Selex: обновлено животных ' + updated +
        ', лактаций добавлено ' + histAdded +
        ', записей в журнал ' + actionAdded;
      if (skipped) msg += ', нет в базе (пропущено): ' + skipped;
      if (errors.length) msg += ', ошибок: ' + errors.length;
      if (typeof showToast === 'function') showToast(msg, errors.length ? 'error' : 'success', 8000);
      else alert(msg);
    }

    if (updated > 0) {
      if (useApi && typeof window.persistImportEntriesToApi === 'function') {
        var toSave = cattleIds.map(function (id) {
          return entries.find(function (e) { return e.cattleId === id; });
        }).filter(Boolean);
        if (progress && progress.setTitle) progress.setTitle('Сохранение истории на сервер…');
        return window.persistImportEntriesToApi([], toSave, progress && progress.update ? function (d, t, tx) { progress.update(d, t, tx); } : null)
          .then(function () { finishMsg(); })
          .catch(function (err) {
            if (typeof saveLocally === 'function') saveLocally();
            finishMsg();
            if (typeof showToast === 'function') {
              showToast('История сохранена локально; на сервер не удалось: ' + (err && err.message ? err.message : String(err)), 'error', 8000);
            }
          });
      }
      if (typeof saveLocally === 'function') saveLocally();
    }
    finishMsg();
    return Promise.resolve();
  }

  if (progress) progress.update(0, Math.max(cattleIds.length, 1), 'Разбор событий…');
  return chunk();
}

/**
 * Открывает модальное окно маппинга столбцов импорта и по кнопке «Импортировать» запускает runImportWithMapping.
 */

  // register functions
  NS.importData = importData;
  NS.handleImportFile = handleImportFile;
  NS.runImportWithMapping = runImportWithMapping;
  NS.runImportHistoryEvents = runImportHistoryEvents;
})();
export {};
