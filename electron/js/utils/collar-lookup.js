/**
 * Поиск животного по номеру или ошейнику и запись ошейника в карточку.
 */
function collarNorm(v) {
  return String(v == null ? '' : v).trim();
}

function collarGetList(list) {
  if (Array.isArray(list)) return list;
  if (typeof window !== 'undefined' && Array.isArray(window.entries)) return window.entries;
  return [];
}

function findEntryByCattleId(cattleId, list) {
  var id = collarNorm(cattleId);
  if (!id) return null;
  var src = collarGetList(list);
  for (var i = 0; i < src.length; i++) {
    if (String(src[i].cattleId || '').trim() === id) return src[i];
  }
  return null;
}

function findEntryByCollar(collar, list) {
  var c = collarNorm(collar);
  if (!c) return null;
  var src = collarGetList(list);
  var low = c.toLowerCase();
  for (var i = 0; i < src.length; i++) {
    if (String(src[i].collar || '').trim().toLowerCase() === low) return src[i];
  }
  return null;
}

function resolveCattleIdFromNumberOrCollar(numberVal, collarVal, list) {
  var id = collarNorm(numberVal);
  if (id) return id;
  var byCollar = findEntryByCollar(collarVal, list);
  return byCollar ? String(byCollar.cattleId || '').trim() : '';
}

function applyCollarToHerd(entry, collar, list) {
  var next = collarNorm(collar);
  var src = collarGetList(list);
  if (next) {
    var low = next.toLowerCase();
    for (var i = 0; i < src.length; i++) {
      if (src[i] !== entry && String(src[i].collar || '').trim().toLowerCase() === low) {
        src[i].collar = '';
      }
    }
  }
  if (entry) entry.collar = next;
  return entry;
}

function entryMatchesNumberOrCollar(entry, query) {
  var f = String(query || '').toLowerCase().trim();
  if (!f || !entry) return !f;
  return (
    (entry.cattleId && String(entry.cattleId).toLowerCase().indexOf(f) !== -1) ||
    (entry.nickname && String(entry.nickname).toLowerCase().indexOf(f) !== -1) ||
    (entry.collar && String(entry.collar).toLowerCase().indexOf(f) !== -1)
  );
}

var CollarLookup = {
  findEntryByCattleId: findEntryByCattleId,
  findEntryByCollar: findEntryByCollar,
  resolveCattleIdFromNumberOrCollar: resolveCattleIdFromNumberOrCollar,
  applyCollarToHerd: applyCollarToHerd,
  entryMatchesNumberOrCollar: entryMatchesNumberOrCollar
};

if (typeof window !== 'undefined') {
  window.CollarLookup = CollarLookup;
}

export {
  findEntryByCattleId,
  findEntryByCollar,
  resolveCattleIdFromNumberOrCollar,
  applyCollarToHerd,
  entryMatchesNumberOrCollar
};
