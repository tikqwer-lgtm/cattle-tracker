/**
 * Групповой набор номеров для экрана осеменения.
 */
(function (global) {
  'use strict';

  function normalizeCattleId(raw) {
    return String(raw == null ? '' : raw).trim();
  }

  function attemptForCow(cattleId, findEntryFn) {
    var id = normalizeCattleId(cattleId);
    if (!id) return null;
    var entry = typeof findEntryFn === 'function' ? findEntryFn(id) : null;
    if (!entry) return 1;
    if (typeof global.getInseminationAttempt === 'function') {
      var n = global.getInseminationAttempt(id);
      var parsed = parseInt(n, 10);
      return parsed >= 1 ? parsed : 1;
    }
    if (!Array.isArray(entry.inseminationHistory)) return 1;
    return entry.inseminationHistory.length + 1;
  }

  function buildGroupDraftRows(ids, existingDraftIds, findEntryFn, opts) {
    opts = opts || {};
    var taken = {};
    (existingDraftIds || []).forEach(function (x) {
      var k = normalizeCattleId(x);
      if (k) taken[k] = true;
    });
    var uid = typeof opts.uid === 'function' ? opts.uid : function () {
      return 'g_' + Date.now();
    };
    var bull = opts.bull != null ? String(opts.bull) : '';
    var out = [];
    (ids || []).forEach(function (raw) {
      var cattleId = normalizeCattleId(raw);
      if (!cattleId || taken[cattleId]) return;
      taken[cattleId] = true;
      out.push({
        id: uid(),
        cattleId: cattleId,
        attemptNumber: attemptForCow(cattleId, findEntryFn),
        bull: bull
      });
    });
    return out;
  }

  global.__inseminationGroup = {
    normalizeCattleId: normalizeCattleId,
    attemptForCow: attemptForCow,
    buildGroupDraftRows: buildGroupDraftRows
  };
})(typeof window !== 'undefined' ? window : globalThis);
export {};
