/**
 * data-integrity.js — проверка дат в карточках (не в будущем).
 */
(function (global) {
  'use strict';

  var DATE_FIELDS = [
    { path: 'birthDate', label: 'Дата рождения' },
    { path: 'calvingDate', label: 'Дата отёла' },
    { path: 'inseminationDate', label: 'Дата осеменения' },
    { path: 'dryStartDate', label: 'Начало сухостоя' },
    { path: 'exitDate', label: 'Дата выбытия' }
  ];

  function parseDate(str) {
    if (!str) return null;
    var d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
  }

  function dateOnly(d) {
    if (!d) return null;
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  function isFutureDateStr(dateStr, refDate) {
    if (!dateStr || !String(dateStr).trim()) return false;
    var d = parseDate(dateStr);
    if (!d) return false;
    var today = dateOnly(refDate || new Date());
    return dateOnly(d) > today;
  }

  function pushError(out, entry, field, label, date) {
    out.push({
      cattleId: entry.cattleId || '',
      field: field,
      label: label,
      date: String(date)
    });
  }

  function scanEntryDataErrors(entry, refDate) {
    var out = [];
    if (!entry) return out;
    refDate = refDate || new Date();

    DATE_FIELDS.forEach(function (f) {
      var val = entry[f.path];
      if (val && isFutureDateStr(val, refDate)) {
        pushError(out, entry, f.path, f.label, val);
      }
    });

    if (entry.protocol && entry.protocol.startDate && isFutureDateStr(entry.protocol.startDate, refDate)) {
      pushError(out, entry, 'protocol.startDate', 'Дата постановки на протокол', entry.protocol.startDate);
    }

    if (Array.isArray(entry.inseminationHistory)) {
      entry.inseminationHistory.forEach(function (h, idx) {
        if (h && h.date && isFutureDateStr(h.date, refDate)) {
          pushError(out, entry, 'inseminationHistory.' + idx, 'Дата осеменения (история)', h.date);
        }
      });
    }

    if (Array.isArray(entry.uziHistory)) {
      entry.uziHistory.forEach(function (h, idx) {
        if (h && h.date && isFutureDateStr(h.date, refDate)) {
          pushError(out, entry, 'uziHistory.' + idx, 'Дата УЗИ', h.date);
        }
      });
    }

    if (Array.isArray(entry.lactationHistory)) {
      entry.lactationHistory.forEach(function (snap, idx) {
        if (!snap) return;
        if (snap.calvingDate && isFutureDateStr(snap.calvingDate, refDate)) {
          pushError(out, entry, 'lactationHistory.' + idx + '.calvingDate', 'Дата отёла (архив)', snap.calvingDate);
        }
        if (Array.isArray(snap.inseminationHistory)) {
          snap.inseminationHistory.forEach(function (h, hi) {
            if (h && h.date && isFutureDateStr(h.date, refDate)) {
              pushError(out, entry, 'lactationHistory.' + idx + '.insem.' + hi, 'Дата осеменения (архив)', h.date);
            }
          });
        }
      });
    }

    return out;
  }

  function scanAllDataErrors(entries, refDate) {
    var all = [];
    (entries || []).forEach(function (e) {
      scanEntryDataErrors(e, refDate).forEach(function (err) {
        all.push(err);
      });
    });
    return all;
  }

  function formatDataErrorMessage(err) {
    if (!err) return '';
    var id = err.cattleId ? 'Корова № ' + err.cattleId + ': ' : '';
    return id + (err.label || 'Дата') + ' ' + (err.date || '') + ' в будущем';
  }

  function validateEntryDatesBeforeSave(entry, refDate) {
    var errs = scanEntryDataErrors(entry, refDate);
    if (!errs.length) return null;
    return formatDataErrorMessage(errs[0]);
  }

  function dataErrorNotifKey(err) {
    return 'data_error_' + (err.cattleId || '') + '_' + (err.field || '') + '_' + (err.date || '');
  }

  function syncDataErrorNotifications(entries, options) {
    options = options || {};
    var list = entries || (typeof global.entries !== 'undefined' ? global.entries : []);
    var errors = scanAllDataErrors(list);
    var createFn = options.createNotification || global.createNotification;
    if (typeof createFn !== 'function') return errors;

    var notified = options.notified || {};
    errors.forEach(function (err) {
      var key = dataErrorNotifKey(err);
      if (notified[key]) return;
      notified[key] = true;
      createFn(
        'error',
        formatDataErrorMessage(err),
        err.cattleId,
        { kind: 'data_error', category: 'errors', field: err.field, date: err.date, dedupeKey: key },
        { showToast: false, showSystem: false }
      );
    });
    return errors;
  }

  function notifyDataErrorsFromImport(entries) {
    return syncDataErrorNotifications(entries, { notified: {} });
  }

  if (typeof global !== 'undefined') {
    global.scanEntryDataErrors = scanEntryDataErrors;
    global.scanAllDataErrors = scanAllDataErrors;
    global.formatDataErrorMessage = formatDataErrorMessage;
    global.validateEntryDatesBeforeSave = validateEntryDatesBeforeSave;
    global.syncDataErrorNotifications = syncDataErrorNotifications;
    global.notifyDataErrorsFromImport = notifyDataErrorsFromImport;
    global.isFutureDateStr = isFutureDateStr;
  }
})(typeof window !== 'undefined' ? window : globalThis);

export {};
