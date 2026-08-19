/**
 * KPI дашборда сервис-специалиста: осеменения, стельные, сомнительные УЗИ1, погрешность УЗИ1→УЗИ2.
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
    var d = String(ru[1]).padStart(2, '0');
    var m = String(ru[2]).padStart(2, '0');
    return ru[3] + '-' + m + '-' + d;
  }
  return s.slice(0, 10);
}

function pct(n, total) {
  if (!total) return 0;
  return Math.round((n / total) * 100);
}

function isExited(entry) {
  return !!(entry && entry.exitDate && String(entry.exitDate).trim());
}

function isPregnantStatus(entry) {
  return String((entry && entry.status) || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .indexOf('стельн') !== -1;
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

function uziTypeFromAction(item) {
  var t = histType(item);
  if (t === 'УЗИ1' || t.indexOf('УЗИ1') !== -1) return 'УЗИ1';
  if (t === 'УЗИ2' || t.indexOf('УЗИ2') !== -1) return 'УЗИ2';
  return 'УЗИ';
}

function sortByDate(a, b) {
  return dateKey(a.date || a.dateTime).localeCompare(dateKey(b.date || b.dateTime));
}

function findActionForDate(entry, kind, date) {
  var key = dateKey(date);
  if (!key) return null;
  var list = (entry && entry.actionHistory) || [];
  for (var i = 0; i < list.length; i++) {
    var h = list[i];
    if (kind === 'insem' && !isInsemAction(h)) continue;
    if (kind === 'uzi' && !isUziAction(h)) continue;
    var fromDetails = dateKey(h.details);
    var fromDt = dateKey(h.dateTime);
    if (fromDetails === key || fromDt === key) return h;
  }
  return null;
}

function actorForInsem(entry, rec) {
  var h = findActionForDate(entry, 'insem', rec.date || rec.dateTime);
  if (h && h.userName) return h.userName;
  return rec.inseminator || rec.userName || '';
}

function actorForUzi(entry, rec) {
  var h = findActionForDate(entry, 'uzi', rec.date || rec.dateTime);
  if (h && h.userName) return h.userName;
  return rec.specialist || rec.userName || '';
}

function passesMine(who, username, mineOnly) {
  if (!mineOnly) return true;
  return namesMatch(who, username);
}

function collectInsemEvents(entry) {
  var seen = {};
  var out = [];
  function add(dateRaw, who) {
    var k = dateKey(dateRaw);
    if (!k || seen[k]) return;
    seen[k] = true;
    out.push({ date: k, who: who || '' });
  }
  ((entry && entry.actionHistory) || []).forEach(function (h) {
    if (!isInsemAction(h)) return;
    add(h.details || h.dateTime, h.userName);
  });
  ((entry && entry.inseminationHistory) || []).forEach(function (h) {
    add(h.date, actorForInsem(entry, h));
  });
  ((entry && entry.lactationHistory) || []).forEach(function (snap) {
    ((snap && snap.inseminationHistory) || []).forEach(function (h) {
      add(h.date, actorForInsem(entry, h));
    });
  });
  return out;
}

function classifyUziInCycle(uzis, index) {
  if (index === 0) return 'УЗИ1';
  if (index >= 1) return 'УЗИ2';
  return 'УЗИ';
}

function enrichUzi(entry, rec, fallbackType) {
  var h = findActionForDate(entry, 'uzi', rec.date);
  var type = fallbackType || 'УЗИ';
  if (h) type = uziTypeFromAction(h);
  return {
    date: dateKey(rec.date),
    result: String((h && h.result) || rec.result || '').trim(),
    specialist: rec.specialist || '',
    daysFromInsemination: rec.daysFromInsemination,
    who: actorForUzi(entry, rec),
    type: type
  };
}

function collectUzi1Events(entry) {
  var seen = {};
  var out = [];
  function add(rec) {
    if (!rec || rec.type !== 'УЗИ1') return;
    var k = rec.date;
    if (!k || seen[k]) return;
    seen[k] = true;
    out.push(rec);
  }
  ((entry && entry.actionHistory) || []).forEach(function (h) {
    if (uziTypeFromAction(h) !== 'УЗИ1') return;
    add({
      date: dateKey(h.details || h.dateTime),
      result: String(h.result || '').trim(),
      who: h.userName || '',
      type: 'УЗИ1',
      daysFromInsemination: null
    });
  });
  function walkUzis(list) {
    var sorted = (list || []).slice().sort(sortByDate);
    sorted.forEach(function (u, idx) {
      add(enrichUzi(entry, u, classifyUziInCycle(sorted, idx)));
    });
  }
  walkUzis(entry && entry.uziHistory);
  ((entry && entry.lactationHistory) || []).forEach(function (snap) {
    walkUzis(snap && snap.uziHistory);
  });
  return out;
}

function eachCycleUzis(entry, fn) {
  fn(entry.inseminationHistory || [], entry.uziHistory || []);
  ((entry && entry.lactationHistory) || []).forEach(function (snap) {
    fn((snap && snap.inseminationHistory) || [], (snap && snap.uziHistory) || []);
  });
}

function dualCheckPairs(entry, username, mineOnly) {
  var pairs = [];
  eachCycleUzis(entry, function (insems, uzis) {
    var insList = (insems || []).slice().sort(sortByDate);
    var uziList = (uzis || []).slice().sort(sortByDate);
    if (!uziList.length) return;
    if (!insList.length) insList = [{ date: '0000-01-01' }];
    for (var i = 0; i < insList.length; i++) {
      var start = dateKey(insList[i].date) || '0000-01-01';
      var end = i + 1 < insList.length ? dateKey(insList[i + 1].date) || '9999-12-31' : '9999-12-31';
      var inCycle = [];
      uziList.forEach(function (u, idx) {
        var d = dateKey(u.date);
        if (d >= start && d < end) {
          inCycle.push(enrichUzi(entry, u, classifyUziInCycle(uziList, idx)));
        }
      });
      if (inCycle.length < 2) continue;
      var u1 = null;
      var u2 = null;
      inCycle.forEach(function (u) {
        if (u.type === 'УЗИ1' && !u1) u1 = u;
        else if (u.type === 'УЗИ2' && !u2) u2 = u;
      });
      if (!u1) u1 = inCycle[0];
      if (!u2) u2 = inCycle[1];
      if (!u1 || !u2) continue;
      if (u1.result !== 'Стельная') continue;
      if (mineOnly && !passesMine(u1.who, username, true)) continue;
      pairs.push({ u1: u1, u2: u2 });
    }
  });
  return pairs;
}

function currentDoubtful(entry, username, mineOnly) {
  if (isExited(entry)) return null;
  var list = ((entry && entry.uziHistory) || []).slice().sort(sortByDate);
  if (!list.length) return null;
  var lastU1 = null;
  var lastU1Idx = -1;
  list.forEach(function (u, idx) {
    var rec = enrichUzi(entry, u, classifyUziInCycle(list, idx));
    if (rec.type === 'УЗИ1') {
      lastU1 = rec;
      lastU1Idx = idx;
    }
  });
  if (!lastU1 || lastU1.result !== 'Сомнительная') return null;
  if (!passesMine(lastU1.who, username, mineOnly)) return null;
  for (var i = lastU1Idx + 1; i < list.length; i++) {
    var later = String(list[i].result || '').trim();
    if (later === 'Стельная' || later === 'Не стельная') return null;
  }
  return {
    cattleId: entry.cattleId || '',
    group: entry.group || '',
    daysFromInsemination: lastU1.daysFromInsemination,
    uziDate: lastU1.date,
    objectId: entry._objectId || ''
  };
}

function iInseminatedCurrent(entry, username, mineOnly) {
  if (!mineOnly) return true;
  var current = entry.inseminationHistory || [];
  for (var i = 0; i < current.length; i++) {
    if (passesMine(actorForInsem(entry, current[i]), username, true)) return true;
  }
  return false;
}

/**
 * @param {Array} entries
 * @param {{ username?: string, mineOnly?: boolean }} [opts]
 */
function computeServiceDashboardStats(entries, opts) {
  opts = opts || {};
  var username = opts.username || '';
  var mineOnly = opts.mineOnly !== false;
  var list = Array.isArray(entries) ? entries : [];

  var inseminationCount = 0;
  var pregnantCount = 0;
  var uzi1Count = 0;
  var doubtfulList = [];
  var accNum = 0;
  var accDen = 0;

  list.forEach(function (entry) {
    collectInsemEvents(entry).forEach(function (ev) {
      if (passesMine(ev.who, username, mineOnly)) inseminationCount += 1;
    });
    collectUzi1Events(entry).forEach(function (ev) {
      if (passesMine(ev.who, username, mineOnly)) uzi1Count += 1;
    });
    if (!isExited(entry) && isPregnantStatus(entry) && iInseminatedCurrent(entry, username, mineOnly)) {
      pregnantCount += 1;
    }
    var doubt = currentDoubtful(entry, username, mineOnly);
    if (doubt) doubtfulList.push(doubt);
    dualCheckPairs(entry, username, mineOnly).forEach(function (p) {
      accDen += 1;
      if (p.u2.result === 'Стельная') accNum += 1;
    });
  });

  var byDaysMap = {};
  doubtfulList.forEach(function (row) {
    var d = row.daysFromInsemination;
    if (d == null || d === '' || isNaN(Number(d))) return;
    var key = String(Number(d));
    byDaysMap[key] = (byDaysMap[key] || 0) + 1;
  });
  var doubtfulByDays = Object.keys(byDaysMap)
    .map(function (k) {
      return { days: Number(k), heads: byDaysMap[k] };
    })
    .sort(function (a, b) {
      return a.days - b.days;
    });

  return {
    inseminationCount: inseminationCount,
    pregnantCount: pregnantCount,
    pregnantPct: pct(pregnantCount, inseminationCount),
    doubtfulCount: doubtfulList.length,
    uzi1Count: uzi1Count,
    doubtfulPct: pct(doubtfulList.length, uzi1Count),
    doubtfulByDays: doubtfulByDays,
    doubtfulList: doubtfulList,
    uziAccuracyNumerator: accNum,
    uziAccuracyDenominator: accDen,
    uziAccuracyPct: pct(accNum, accDen)
  };
}

if (typeof window !== 'undefined') {
  window.computeServiceDashboardStats = computeServiceDashboardStats;
}

export { computeServiceDashboardStats, namesMatch, dateKey };
