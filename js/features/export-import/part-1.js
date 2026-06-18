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
    parseFileToHeadersAndRows(file).then(function (parsed) {
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

  var newCount = 0, updateCount = 0, errors = [];
  var createdEntries = [];
  var updatedEntries = [];
  var profileKeys = ['nickname', 'group', 'birthDate', 'lactation', 'calvingDate', 'status', 'exitDate', 'dryStartDate', 'note', 'protocolName', 'protocolStartDate', 'inseminator', 'code'];

  for (var cattleId in byCattleId) {
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

  if (newCount > 0 || updateCount > 0) {
    var useApi = typeof global.CATTLE_TRACKER_USE_API !== 'undefined' && global.CATTLE_TRACKER_USE_API &&
      global.CattleTrackerApi && typeof global.persistImportEntriesToApi === 'function';

    if (useApi) {
      if (typeof showToast === 'function') {
        showToast('Импорт: сохранение ' + (newCount + updateCount) + ' записей на сервер…', 'info', 4000);
      }
      return global.persistImportEntriesToApi(createdEntries, updatedEntries).then(function (apiErrors) {
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

/**
 * Открывает модальное окно маппинга столбцов импорта и по кнопке «Импортировать» запускает runImportWithMapping.
 */

  // register functions
  NS.importData = importData;
  NS.handleImportFile = handleImportFile;
  NS.runImportWithMapping = runImportWithMapping;
})();
export {};
