/**
 * Опись работ сервис-специалиста за дату (из карточек животных).
 */

function namesMatch(a, b) {
  return String(a || '')
    .trim()
    .toLowerCase() === String(b || '')
    .trim()
    .toLowerCase();
}

function dateKey(raw) {
  var s = String(raw || '').trim();
  if (!s) return '';
  var iso = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return iso[1] + '-' + iso[2] + '-' + iso[3];
  var ru = s.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (ru) {
    return ru[3] + '-' + String(ru[2]).padStart(2, '0') + '-' + String(ru[1]).padStart(2, '0');
  }
  return s.slice(0, 10);
}

function histType(item) {
  if (!item || typeof item !== 'object') return '';
  return String(item.eventType || item.action || '').trim();
}

function isInsemAction(item) {
  var t = histType(item);
  return t === 'Осеменение' || t.indexOf('Осеменение') === 0;
}

function isUziAction(item) {
  var t = histType(item);
  return t === 'УЗИ' || t === 'УЗИ1' || t === 'УЗИ2' || t.indexOf('УЗИ') === 0;
}

function isProtocolAction(item) {
  var t = histType(item);
  return t === 'Постановка на протокол' || t.indexOf('протокол') !== -1 || t.indexOf('Протокол') !== -1;
}

function uziActionLabel(item) {
  var t = histType(item);
  if (t === 'УЗИ1' || t.indexOf('УЗИ1') !== -1) return 'УЗИ1';
  if (t === 'УЗИ2' || t.indexOf('УЗИ2') !== -1) return 'УЗИ2';
  return 'УЗИ';
}

function itemDate(item) {
  if (!item) return '';
  var fromDetails = dateKey(item.details);
  if (fromDetails) return fromDetails;
  return dateKey(item.dateTime || item.date || item.startDate);
}

function actor(item, fallback) {
  return (item && (item.userName || item.inseminator || item.specialist)) || fallback || '';
}

function insemDetails(item, rec) {
  var bull = (item && item.bull) || (rec && rec.bull) || '';
  var tech = (item && item.inseminator) || (rec && rec.inseminator) || '';
  var parts = [];
  if (bull) parts.push('бык ' + bull);
  if (tech) parts.push('техник ' + tech);
  if (!parts.length && item && item.details) return String(item.details);
  return parts.join(', ');
}

function uziDetails(item, rec) {
  var result = (item && item.result) || (rec && rec.result) || '';
  var days = item && item.details && String(item.details).match(/дней от осеменения:\s*(\d+)/i);
  var daysVal = (rec && rec.daysFromInsemination != null && rec.daysFromInsemination !== '')
    ? rec.daysFromInsemination
    : (days ? days[1] : '');
  var parts = [];
  if (result) parts.push(result);
  if (daysVal !== '' && daysVal != null) parts.push('дней от осеменения: ' + daysVal);
  if (!parts.length && item && item.details) return String(item.details);
  return parts.join(', ');
}

function protocolDetails(item, entry) {
  var name = (item && item.protocolName) || (entry && entry.protocol && entry.protocol.name) || '';
  if (name) return String(name);
  if (item && item.details) return String(item.details);
  return '';
}

function pushItem(out, seen, row) {
  var key = row.cattleId + '|' + row.action + '|' + row.workDate;
  if (seen[key]) return;
  seen[key] = true;
  out.push(row);
}

function collectServiceWorkItems(entries, opts) {
  opts = opts || {};
  var date = dateKey(opts.date);
  var username = opts.username || '';
  var types = opts.types || { insemination: true, uzi: true, protocol: true };
  var out = [];
  var seen = {};
  (entries || []).forEach(function (entry) {
    if (!entry) return;
    var cattleId = String(entry.cattleId || '');
    ((entry.actionHistory) || []).forEach(function (h) {
      var d = itemDate(h);
      if (date && d !== date) return;
      if (username && !namesMatch(actor(h), username)) return;
      if (types.insemination && isInsemAction(h)) {
        pushItem(out, seen, {
          cattleId: cattleId,
          action: 'Осеменение',
          details: insemDetails(h),
          workDate: d
        });
      } else if (types.uzi && isUziAction(h)) {
        pushItem(out, seen, {
          cattleId: cattleId,
          action: uziActionLabel(h),
          details: uziDetails(h),
          workDate: d
        });
      } else if (types.protocol && isProtocolAction(h) && !isInsemAction(h) && !isUziAction(h)) {
        pushItem(out, seen, {
          cattleId: cattleId,
          action: 'Протокол',
          details: protocolDetails(h, entry),
          workDate: d
        });
      }
    });
    if (types.insemination) {
      ((entry.inseminationHistory) || []).forEach(function (rec) {
        var d = dateKey(rec && rec.date);
        if (date && d !== date) return;
        var who = actor(rec, rec && rec.inseminator);
        if (username && !namesMatch(who, username) && !namesMatch(rec && rec.inseminator, username)) return;
        pushItem(out, seen, {
          cattleId: cattleId,
          action: 'Осеменение',
          details: insemDetails(null, rec),
          workDate: d
        });
      });
    }
    if (types.uzi) {
      ((entry.uziHistory) || []).forEach(function (rec, idx) {
        var d = dateKey(rec && rec.date);
        if (date && d !== date) return;
        var who = actor(rec, rec && rec.specialist);
        if (username && !namesMatch(who, username) && !namesMatch(rec && rec.specialist, username)) return;
        var label = idx === 0 ? 'УЗИ1' : (idx === 1 ? 'УЗИ2' : 'УЗИ');
        pushItem(out, seen, {
          cattleId: cattleId,
          action: label,
          details: uziDetails(null, rec),
          workDate: d
        });
      });
    }
    if (types.protocol && entry.protocol && entry.protocol.startDate) {
      var d = dateKey(entry.protocol.startDate);
      if (date && d === date) {
        /* without actionHistory user we cannot prove "mine"; skip unless already collected */
      }
    }
  });
  out.sort(function (a, b) {
    var c = String(a.cattleId).localeCompare(String(b.cattleId), 'ru', { numeric: true });
    if (c !== 0) return c;
    return String(a.action).localeCompare(String(b.action), 'ru');
  });
  return out;
}

function serializeReportText(items) {
  return (items || [])
    .map(function (it) {
      return [it.cattleId || '', it.action || '', it.details || '', it.workDate || ''].join('\t');
    })
    .join('\n');
}

function parseReportItemsFromDescription(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map(function (line) {
      var p = line.split('\t');
      if (p.length < 2) return null;
      return {
        cattleId: p[0] || '',
        action: p[1] || '',
        details: p[2] || '',
        workDate: p[3] || ''
      };
    })
    .filter(Boolean);
}

export { collectServiceWorkItems, serializeReportText, parseReportItemsFromDescription, dateKey };
