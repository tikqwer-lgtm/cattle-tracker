/**
 * Проверки перед действиями с коровами; модалки: showConfirmModal, showTripleModal, showProtocolAssignModal.
 */
(function () {
  'use strict';

  var DRY_PREG_MIN = 210;
  var DRY_PREG_MAX = 270;
  var CALVING_PREG_WARN_AFTER = 240;

  function statusStr(entry) {
    return ((entry && entry.status) || '').toString();
  }

  function isSterlyana(entry) {
    return statusStr(entry).indexOf('Стельная') !== -1;
  }

  function isOsemenen(entry) {
    return statusStr(entry).indexOf('Осеменен') !== -1;
  }

  function getLastInseminationOnOrBefore(entry, asOfDate) {
    if (!entry || !asOfDate) return null;
    var best = null;
    if (entry.inseminationHistory && entry.inseminationHistory.length) {
      entry.inseminationHistory.forEach(function (h) {
        if (!h || !h.date || String(h.date) > String(asOfDate)) return;
        if (!best || String(h.date) > String(best)) best = h.date;
      });
    }
    if (entry.inseminationDate && String(entry.inseminationDate) <= String(asOfDate)) {
      if (!best || String(entry.inseminationDate) > String(best)) best = entry.inseminationDate;
    }
    return best;
  }

  function getPregnancyDaysOnDate(entry, eventDate) {
    var last = getLastInseminationOnOrBefore(entry, eventDate);
    if (!last) return null;
    var d1 = new Date(last);
    var d2 = new Date(eventDate);
    if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return null;
    var days = Math.round((d2 - d1) / (24 * 60 * 60 * 1000));
    return days >= 0 ? days : null;
  }

  function formatDaysLabel(days) {
    if (days === null || days === undefined) return 'дни не определены';
    return String(days);
  }

  function hasInseminationOnOrBefore(entry, eventDate) {
    return !!getLastInseminationOnOrBefore(entry, eventDate);
  }

  function hasInseminationDuplicate(entry, insemDate) {
    if (!insemDate) return false;
    if (entry.inseminationHistory && entry.inseminationHistory.length) {
      for (var i = 0; i < entry.inseminationHistory.length; i++) {
        if (entry.inseminationHistory[i].date && String(entry.inseminationHistory[i].date) === String(insemDate)) return true;
      }
    }
    return false;
  }

  function hasUziDuplicate(entry, uziDate) {
    if (!uziDate || !entry.uziHistory || !entry.uziHistory.length) return false;
    return entry.uziHistory.some(function (h) { return h && h.date && String(h.date) === String(uziDate); });
  }

  function hasDryDuplicate(entry, dryDate) {
    if (!dryDate) return false;
    return (entry.dryStartDate || '').trim() && String(entry.dryStartDate) === String(dryDate);
  }

  function hasCalvingDuplicate(entry, calvingDate) {
    if (!calvingDate) return false;
    return (entry.calvingDate || '').trim() && String(entry.calvingDate) === String(calvingDate);
  }

  function isOnProtocol(entry) {
    return !!((entry.protocol && String(entry.protocol.name || '').trim()));
  }

  /** Первая строка предупреждений: номер животного (для всех пакетных и одиночных действий). */
  function guardCattlePrefix(cattleId) {
    var s = cattleId != null && String(cattleId).trim() ? String(cattleId).trim() : '—';
    return 'Корова № ' + s + '.\n\n';
  }

  function guardMsg(entry, text) {
    var id = entry && entry.cattleId != null ? entry.cattleId : '';
    return guardCattlePrefix(id) + (text || '');
  }

  function checkInsemination(entry, insemDate, flags) {
    flags = flags || {};
    if (!flags.allowPregnantInsem && isSterlyana(entry)) {
      return {
        ok: false,
        code: 'insemination_pregnant',
        message: 'Корова стельная. Осеменение для стельных животных не рекомендуется.\n\nПродолжить ввод?'
      };
    }
    if (!flags.allowDuplicateInsem && insemDate && hasInseminationDuplicate(entry, insemDate)) {
      return {
        ok: false,
        code: 'duplicate',
        message: 'Уже есть осеменение с этой датой.\n\nПродолжить — будет добавлена ещё одна запись.'
      };
    }
    return { ok: true };
  }

  function checkDry(entry, dryDate, flags) {
    flags = flags || {};
    if (!dryDate) return { ok: true };
    if (!flags.allowDuplicateDry && hasDryDuplicate(entry, dryDate)) {
      return {
        ok: false,
        code: 'duplicate',
        message: 'Запуск с этой датой уже записан.\n\nПродолжить?'
      };
    }
    if (flags.allowDryNorm) return { ok: true };
    var pregnantOk = isSterlyana(entry);
    var days = getPregnancyDaysOnDate(entry, dryDate);
    var inRange = days !== null && days >= DRY_PREG_MIN && days <= DRY_PREG_MAX;
    if (!pregnantOk || !inRange) {
      var msg =
        'Не является стельной или не соответствует норме по дням стельности.\n' +
        'Фактически: дней — ' +
        formatDaysLabel(days) +
        ' (норма для запуска ' +
        DRY_PREG_MIN +
        '–' +
        DRY_PREG_MAX +
        ' дней).\n\nПродолжить?';
      return { ok: false, code: 'dry_norm', message: msg };
    }
    return { ok: true };
  }

  function checkUzi(entry, uziDate, flags) {
    flags = flags || {};
    if (!uziDate) return { ok: true };
    if (!flags.allowDuplicateUzi && hasUziDuplicate(entry, uziDate)) {
      return {
        ok: false,
        code: 'duplicate',
        message: 'Уже есть УЗИ с этой датой.\n\nПродолжить?'
      };
    }
    if (flags.allowUziEligible) return { ok: true };
    var eligible = (isOsemenen(entry) || isSterlyana(entry)) && hasInseminationOnOrBefore(entry, uziDate);
    if (!eligible) {
      var st = statusStr(entry) || '—';
      var days = getPregnancyDaysOnDate(entry, uziDate);
      var ctxLine;
      if (isSterlyana(entry) || isOsemenen(entry)) {
        ctxLine = '(Статус — ' + st + '; дни стельности — ' + formatDaysLabel(days) + ')';
      } else if (days !== null && days !== undefined) {
        ctxLine =
          '(Статус — ' +
          st +
          '; это не «дни стельности» — при таком статусе считаем дней от последнего осеменения к дате УЗИ: ' +
          days +
          ')';
      } else {
        ctxLine =
          '(Статус — ' +
          st +
          '; дней от последнего осеменения к дате УЗИ не определено)';
      }
      var msg = 'Не является осемененной или стельной для подтверждения стельности.\n' + ctxLine + '\n\nПродолжить?';
      return { ok: false, code: 'uzi_eligible', message: msg };
    }
    return { ok: true };
  }

  function checkCalving(entry, calvingDate, flags) {
    flags = flags || {};
    if (!calvingDate) return { ok: true };
    if (!flags.allowDuplicateCalving && hasCalvingDuplicate(entry, calvingDate)) {
      return {
        ok: false,
        calving: 'duplicate',
        message: 'Отёл с этой датой уже указан.\n\nПродолжить?'
      };
    }
    if (!flags.allowNotPregnantCalving && !isSterlyana(entry)) {
      return {
        ok: false,
        calving: 'not_pregnant',
        message: 'Животное не стельное.\n\nПродолжить отёл?'
      };
    }
    if (!flags.skipCalvingLate) {
      var days = getPregnancyDaysOnDate(entry, calvingDate);
      if (days !== null && days > CALVING_PREG_WARN_AFTER) {
        return {
          ok: false,
          calving: 'late',
          message:
            'Срок стельности не соответствует норме, занести как аборт?\n' +
            '(Дней стельности: ' +
            days +
            ')\n\n«Продолжить» — записать отёл; «Аборт» — сценарий аборта без полного отёла.'
        };
      }
    }
    return { ok: true };
  }

  function checkProtocolAssign(entry, protocolName, startDate, flags) {
    flags = flags || {};
    if (!protocolName) return { ok: true };
    if (!flags.allowProtocolPregnant && isSterlyana(entry)) {
      return {
        ok: false,
        code: 'protocol_pregnant',
        message: 'Стельных на протокол не ставят.\n\nПродолжить?'
      };
    }
    if (isOnProtocol(entry)) {
      var cur = (entry.protocol.name || '').trim();
      var sameAssign =
        cur === String(protocolName).trim() && String(entry.protocol.startDate || '') === String(startDate || '');
      if (sameAssign) {
        if (!flags.allowDuplicateProtocol) {
          return {
            ok: false,
            code: 'duplicate',
            message: 'Такая постановка на протокол уже записана.\n\nПродолжить?'
          };
        }
        return { ok: true };
      }
      return {
        ok: false,
        code: 'protocol_replace',
        message:
          'Корова уже на протоколе: «' +
          cur +
          '».\n\n«Отменить предыдущий протокол» — снять текущий и назначить новый.\n«Продолжить» — заменить данные протокола без отдельной записи о снятии.\n«Отмена» — не сохранять.',
        currentProtocolName: cur
      };
    }
    return { ok: true };
  }

  function checkAbort(entry, abortDate, flags) {
    flags = flags || {};
    if (!abortDate) return { ok: true };
    if (!flags.allowDuplicateAbort && hasCalvingDuplicate(entry, abortDate)) {
      return {
        ok: false,
        code: 'duplicate',
        message: 'Событие с этой датой уже совпадает с датой отёла в карточке.\n\nПродолжить?'
      };
    }
    return { ok: true };
  }

  function showConfirm(message) {
    var fn = typeof showConfirmModal === 'function' ? showConfirmModal : null;
    if (fn) return fn(message, { confirmText: 'Продолжить', cancelText: 'Отмена' });
    return Promise.resolve(confirm(message) === true);
  }

  function showTriple(message, opts) {
    var o = opts || {};
    var fn = typeof showTripleModal === 'function' ? showTripleModal : null;
    if (fn) {
      return fn(message, {
        cancelText: o.cancelText || 'Отмена',
        primaryText: o.primaryText || 'Продолжить',
        secondaryText: o.secondaryText || 'Аборт',
        wide: o.wide !== false
      });
    }
    if (!confirm(message)) return Promise.resolve('cancel');
    return Promise.resolve(confirm('Аборт вместо отёла?') ? 'secondary' : 'primary');
  }

  function showProtocolModal(message) {
    var fn = typeof showProtocolAssignModal === 'function' ? showProtocolAssignModal : null;
    if (fn) return fn(message);
    return showConfirm(message).then(function (ok) {
      return ok ? 'continue' : 'cancel';
    });
  }

  function confirmCalvingFlow(entry, calvingDate) {
    var flags = {};
    function step() {
      var r = checkCalving(entry, calvingDate, flags);
      if (r.ok) return Promise.resolve('calve');
      if (r.calving === 'late') {
        return showTriple(guardMsg(entry, r.message)).then(function (choice) {
          if (choice === 'primary') return 'calve';
          if (choice === 'secondary') return 'abort';
          return 'cancel';
        });
      }
      return showConfirm(guardMsg(entry, r.message)).then(function (ok) {
        if (!ok) return 'cancel';
        if (r.calving === 'duplicate') flags.allowDuplicateCalving = true;
        if (r.calving === 'not_pregnant') flags.allowNotPregnantCalving = true;
        return step();
      });
    }
    return step();
  }

  function confirmInseminationFlow(entry, date) {
    var flags = {};
    function step() {
      var r = checkInsemination(entry, date, flags);
      if (r.ok) return Promise.resolve(true);
      return showConfirm(guardMsg(entry, r.message)).then(function (ok) {
        if (!ok) return false;
        if (r.code === 'insemination_pregnant') flags.allowPregnantInsem = true;
        if (r.code === 'duplicate') flags.allowDuplicateInsem = true;
        return step();
      });
    }
    return step();
  }

  function confirmDryFlow(entry, dryDate) {
    var flags = {};
    function step() {
      var r = checkDry(entry, dryDate, flags);
      if (r.ok) return Promise.resolve(true);
      return showConfirm(guardMsg(entry, r.message)).then(function (ok) {
        if (!ok) return false;
        if (r.code === 'duplicate') flags.allowDuplicateDry = true;
        if (r.code === 'dry_norm') flags.allowDryNorm = true;
        return step();
      });
    }
    return step();
  }

  function confirmUziFlow(entry, uziDate) {
    var flags = {};
    function step() {
      var r = checkUzi(entry, uziDate, flags);
      if (r.ok) return Promise.resolve(true);
      return showConfirm(guardMsg(entry, r.message)).then(function (ok) {
        if (!ok) return false;
        if (r.code === 'duplicate') flags.allowDuplicateUzi = true;
        if (r.code === 'uzi_eligible') flags.allowUziEligible = true;
        return step();
      });
    }
    return step();
  }

  function confirmProtocolAssignFlow(entry, protocolName, startDate) {
    var flags = {};
    function step() {
      var r = checkProtocolAssign(entry, protocolName, startDate, flags);
      if (r.ok) return Promise.resolve({ mode: 'apply' });
      if (r.code === 'protocol_replace') {
        return showProtocolModal(guardMsg(entry, r.message)).then(function (choice) {
          if (choice === 'cancel') return { mode: 'cancel' };
          if (choice === 'replace_previous') return { mode: 'replace_previous' };
          return { mode: 'apply' };
        });
      }
      return showConfirm(guardMsg(entry, r.message)).then(function (ok) {
        if (!ok) return { mode: 'cancel' };
        if (r.code === 'protocol_pregnant') flags.allowProtocolPregnant = true;
        if (r.code === 'duplicate') flags.allowDuplicateProtocol = true;
        return step();
      });
    }
    return step();
  }

  function confirmAbortFlow(entry, abortDate) {
    var flags = {};
    function step() {
      var r = checkAbort(entry, abortDate, flags);
      if (r.ok) return Promise.resolve(true);
      return showConfirm(guardMsg(entry, r.message)).then(function (ok) {
        if (!ok) return false;
        flags.allowDuplicateAbort = true;
        return step();
      });
    }
    return step();
  }

  if (typeof window !== 'undefined') {
    window.ActionInputGuards = {
      DRY_PREG_MIN: DRY_PREG_MIN,
      DRY_PREG_MAX: DRY_PREG_MAX,
      CALVING_PREG_WARN_AFTER: CALVING_PREG_WARN_AFTER,
      getLastInseminationOnOrBefore: getLastInseminationOnOrBefore,
      getPregnancyDaysOnDate: getPregnancyDaysOnDate,
      checkInsemination: checkInsemination,
      checkDry: checkDry,
      checkUzi: checkUzi,
      checkCalving: checkCalving,
      checkProtocolAssign: checkProtocolAssign,
      checkAbort: checkAbort,
      guardCattlePrefix: guardCattlePrefix,
      guardMsg: guardMsg,
      confirmInseminationFlow: confirmInseminationFlow,
      confirmDryFlow: confirmDryFlow,
      confirmUziFlow: confirmUziFlow,
      confirmCalvingFlow: confirmCalvingFlow,
      confirmProtocolAssignFlow: confirmProtocolAssignFlow,
      confirmAbortFlow: confirmAbortFlow
    };
  }
})();

export {};
