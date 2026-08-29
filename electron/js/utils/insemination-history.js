/**
 * Удаление записи осеменения из карточки (история или поле даты).
 */
function insemDateKey(v) {
  return String(v == null ? '' : v).slice(0, 10);
}

function isInseminationAction(item) {
  if (!item) return false;
  var t = String(item.eventType || item.action || '').trim();
  return t === 'Осеменение' || t.indexOf('Осеменение') === 0;
}

function syncInseminationTopLevel(entry) {
  if (!entry) return;
  var hist = Array.isArray(entry.inseminationHistory) ? entry.inseminationHistory : [];
  if (hist.length) {
    var last = hist[hist.length - 1] || {};
    entry.inseminationDate = last.date || '';
    entry.attemptNumber = last.attemptNumber != null && last.attemptNumber !== '' ? last.attemptNumber : hist.length;
    entry.bull = last.bull || '';
    entry.inseminator = last.inseminator || '';
    entry.code = last.code || '';
    return;
  }
  entry.inseminationDate = '';
  entry.attemptNumber = '';
  entry.bull = '';
  entry.inseminator = '';
  entry.code = '';
}

function removeMatchingInseminationActions(entry, dateStr) {
  if (!entry || !Array.isArray(entry.actionHistory)) return;
  var key = insemDateKey(dateStr);
  if (!key) return;
  entry.actionHistory = entry.actionHistory.filter(function (item) {
    if (!isInseminationAction(item)) return true;
    var raw = String(item.dateTime || item.date || '').trim();
    var d = raw.length >= 10 ? raw.slice(0, 10) : raw;
    return d !== key;
  });
}

function removeInseminationFromEntry(entry, src, srcIndex) {
  if (!entry) return false;
  var idx = parseInt(srcIndex, 10);
  if (src === 'history') {
    if (!Array.isArray(entry.inseminationHistory) || idx < 0 || idx >= entry.inseminationHistory.length) {
      return false;
    }
    var removed = entry.inseminationHistory.splice(idx, 1)[0];
    removeMatchingInseminationActions(entry, removed && removed.date);
    syncInseminationTopLevel(entry);
    return true;
  }
  if (src === 'action') {
    if (!Array.isArray(entry.actionHistory) || idx < 0 || idx >= entry.actionHistory.length) {
      return false;
    }
    var act = entry.actionHistory[idx];
    if (!isInseminationAction(act)) return false;
    entry.actionHistory.splice(idx, 1);
    var raw = String((act && (act.dateTime || act.date)) || '').trim();
    var dateStr = raw.length >= 10 ? raw.slice(0, 10) : raw;
    if (dateStr && Array.isArray(entry.inseminationHistory)) {
      entry.inseminationHistory = entry.inseminationHistory.filter(function (h) {
        return insemDateKey(h && h.date) !== dateStr;
      });
    }
    if (dateStr && insemDateKey(entry.inseminationDate) === dateStr) {
      entry.inseminationDate = '';
    }
    syncInseminationTopLevel(entry);
    return true;
  }
  if (src === 'field') {
    var fieldDate = entry.inseminationDate;
    entry.inseminationDate = '';
    entry.attemptNumber = '';
    entry.bull = '';
    entry.inseminator = '';
    entry.code = '';
    if (Array.isArray(entry.inseminationHistory)) entry.inseminationHistory = [];
    removeMatchingInseminationActions(entry, fieldDate);
    return true;
  }
  return false;
}

if (typeof window !== 'undefined') {
  window.removeInseminationFromEntry = removeInseminationFromEntry;
}

export { removeInseminationFromEntry, syncInseminationTopLevel };
