/**
 * Чистая логика инвентаризации стойломест (тестируемая без DOM).
 */

function invYardNorm(key) {
  return String(key == null ? '' : key).trim();
}

function invEntryIntField(v) {
  if (v === '' || v === undefined || v === null) return null;
  var n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

export function cattleIdEqual(a, b) {
  if (a == null || b == null) return false;
  var sa = String(a).trim();
  var sb = String(b).trim();
  if (sa === sb) return true;
  if (/^\d+$/.test(sa) && /^\d+$/.test(sb)) {
    return parseInt(sa, 10) === parseInt(sb, 10);
  }
  return false;
}

export function entryHasStallCoords(entry) {
  if (!entry) return false;
  if (!invYardNorm(entry.stallYard)) return false;
  if (invEntryIntField(entry.stallRow) == null) return false;
  if (invEntryIntField(entry.stallPlace) == null) return false;
  return true;
}

export function findEntryAt(entries, yardKey, row, place) {
  var yk = invYardNorm(yardKey);
  var r = parseInt(row, 10);
  var pl = parseInt(place, 10);
  if (!Number.isFinite(r) || !Number.isFinite(pl)) return null;
  var list = entries || [];
  for (var i = 0; i < list.length; i++) {
    var e = list[i];
    if (!e) continue;
    if (invYardNorm(e.stallYard) !== yk) continue;
    if (invEntryIntField(e.stallRow) !== r) continue;
    if (invEntryIntField(e.stallPlace) !== pl) continue;
    return e;
  }
  return null;
}

export function cellKey(yard, row, place) {
  return invYardNorm(yard) + '|' + String(row) + '|' + String(place);
}

export function formatStallLabel(yard, row, place) {
  var y = invYardNorm(yard);
  var rOk = invEntryIntField(row) != null;
  var pOk = invEntryIntField(place) != null;
  if (!y && !rOk && !pOk) return '—';
  var parts = [];
  if (y) parts.push('двор ' + y);
  if (rOk) parts.push('ряд ' + String(row));
  if (pOk) parts.push('место ' + String(place));
  return parts.join(', ');
}

export function entryStallCoords(entry) {
  if (!entry || !entryHasStallCoords(entry)) return null;
  return {
    yard: invYardNorm(entry.stallYard),
    row: invEntryIntField(entry.stallRow),
    place: invEntryIntField(entry.stallPlace)
  };
}

export function coordsMatch(a, b) {
  if (!a || !b) return false;
  return invYardNorm(a.yard) === invYardNorm(b.yard) &&
    invEntryIntField(a.row) === invEntryIntField(b.row) &&
    invEntryIntField(a.place) === invEntryIntField(b.place);
}

function entrySummary(entry) {
  if (!entry) return { cattleId: '', nickname: '', group: '' };
  return {
    cattleId: entry.cattleId != null ? String(entry.cattleId).trim() : '',
    nickname: entry.nickname != null ? String(entry.nickname).trim() : '',
    group: entry.group != null ? String(entry.group).trim() : ''
  };
}

function compareCells(a, b) {
  var ya = invYardNorm(a.yard);
  var yb = invYardNorm(b.yard);
  if (ya !== yb) return ya.localeCompare(yb, 'ru');
  var ra = invEntryIntField(a.row) || 0;
  var rb = invEntryIntField(b.row) || 0;
  if (ra !== rb) return ra - rb;
  var pa = invEntryIntField(a.place) || 0;
  var pb = invEntryIntField(b.place) || 0;
  return pa - pb;
}

/**
 * @param {object} layout — { yards: { [key]: { rows, cols } } }
 * @param {object[]} entries
 * @param {string} [yardFilter] — если задан, только этот двор
 */
export function buildStallChecklist(layout, entries, yardFilter) {
  var norm = layout && layout.yards ? layout : { yards: {} };
  var yards = norm.yards || {};
  var occupiedCells = [];
  var unassigned = [];
  var duplicateWarnings = [];
  var coordIndex = {};

  (entries || []).forEach(function (e) {
    if (!e || e.cattleId == null || String(e.cattleId).trim() === '') return;
    if (!entryHasStallCoords(e)) {
      unassigned.push(entrySummary(e));
      return;
    }
    var c = entryStallCoords(e);
    var key = cellKey(c.yard, c.row, c.place);
    if (!coordIndex[key]) coordIndex[key] = [];
    coordIndex[key].push(e);
    var yardOk = !yardFilter || invYardNorm(yardFilter) === invYardNorm(c.yard);
    if (yardOk) {
      occupiedCells.push({
        yard: c.yard,
        row: c.row,
        place: c.place,
        cattleId: entrySummary(e).cattleId,
        nickname: entrySummary(e).nickname,
        group: entrySummary(e).group
      });
    }
  });

  Object.keys(coordIndex).forEach(function (key) {
    if (coordIndex[key].length > 1) {
      duplicateWarnings.push({
        key: key,
        cattleIds: coordIndex[key].map(function (x) { return String(x.cattleId).trim(); })
      });
    }
  });

  occupiedCells.sort(compareCells);
  unassigned.sort(function (a, b) {
    return String(a.cattleId).localeCompare(String(b.cattleId), 'ru', { numeric: true });
  });

  return {
    occupiedCells: occupiedCells,
    unassigned: unassigned,
    duplicateWarnings: duplicateWarnings
  };
}

/**
 * Все ячейки сетки двора для пошаговой сверки.
 */
export function buildYardCells(layout, yardKey, entries) {
  var yk = invYardNorm(yardKey);
  var yards = layout && layout.yards ? layout.yards : {};
  var y = yards[yk];
  if (!y) return [];
  var rows = parseInt(y.rows, 10) || 1;
  var cols = parseInt(y.cols, 10) || 1;
  var cells = [];
  for (var r = 1; r <= rows; r++) {
    for (var p = 1; p <= cols; p++) {
      var occ = findEntryAt(entries, yk, r, p);
      cells.push({
        yard: yk,
        row: r,
        place: p,
        expected: occ ? entrySummary(occ) : null
      });
    }
  }
  return cells;
}

export function createInventorySession(objectId, yardKey, expectedEntries) {
  var snapshot = (expectedEntries || []).map(function (e) {
    if (!e) return null;
    var s = entrySummary(e);
    var c = entryStallCoords(e);
    return {
      cattleId: s.cattleId,
      nickname: s.nickname,
      group: s.group,
      stallYard: c ? c.yard : '',
      stallRow: c ? c.row : '',
      stallPlace: c ? c.place : ''
    };
  }).filter(function (x) { return x && x.cattleId; });

  var unassignedChecks = {};
  snapshot.forEach(function (e) {
    if (!entryHasStallCoords(e)) {
      unassignedChecks[e.cattleId] = { status: 'pending' };
    }
  });

  return {
    objectId: objectId || 'default',
    yardKey: invYardNorm(yardKey),
    startedAt: new Date().toISOString(),
    expectedSnapshot: snapshot,
    cellChecks: {},
    unassignedChecks: unassignedChecks,
    currentCellIndex: 0,
    phase: 'cells'
  };
}

/**
 * @param {'ok'|'empty'|'other'} status
 * @param {string|null} [actualCattleId] — для status 'other'
 * @param {boolean} [isNewToHerd] — для status 'other': животное не было в стаде на старте
 */
export function recordCellCheck(session, yard, row, place, status, actualCattleId, isNewToHerd) {
  if (!session) return session;
  var rec = {
    status: status,
    actualCattleId: actualCattleId != null && String(actualCattleId).trim() !== '' ? String(actualCattleId).trim() : null
  };
  if (status === 'other') {
    rec.isNewToHerd = !!isNewToHerd;
  }
  session.cellChecks[cellKey(yard, row, place)] = rec;
  return session;
}

/**
 * @param {'not_found'|'found'} status
 */
export function recordUnassignedCheck(session, cattleId, status, foundCoords) {
  if (!session || cattleId == null) return session;
  var id = String(cattleId).trim();
  if (!id) return session;
  session.unassignedChecks[id] = {
    status: status,
    found: foundCoords && status === 'found' ? {
      yard: invYardNorm(foundCoords.yard),
      row: invEntryIntField(foundCoords.row),
      place: invEntryIntField(foundCoords.place)
    } : null
  };
  return session;
}

/**
 * @param {object} session
 * @param {object[]|null} yardCells — результат buildYardCells; если null, считается только по cellChecks
 */
export function getInventoryProgress(session, yardCells) {
  var cellsTotal = yardCells ? yardCells.length : 0;
  var cellsChecked = 0;
  if (session && session.cellChecks) {
    cellsChecked = Object.keys(session.cellChecks).length;
  }
  if (cellsTotal === 0 && yardCells === null && session && session.cellChecks) {
    cellsTotal = cellsChecked;
  }

  var unassignedTotal = 0;
  var unassignedChecked = 0;
  if (session && session.unassignedChecks) {
    Object.keys(session.unassignedChecks).forEach(function (id) {
      unassignedTotal++;
      var st = session.unassignedChecks[id] && session.unassignedChecks[id].status;
      if (st === 'found' || st === 'not_found') unassignedChecked++;
    });
  }

  return {
    cellsChecked: cellsChecked,
    cellsTotal: cellsTotal,
    unassignedChecked: unassignedChecked,
    unassignedTotal: unassignedTotal
  };
}

/**
 * Досрочное или полное завершение сверки.
 * @param {object} session
 * @param {{ early?: boolean }} [options]
 */
export function finishInventorySession(session, options) {
  if (!session) return session;
  var early = options && options.early === true;
  session.phase = 'done';
  session.finishedEarly = early;
  session.completedAt = new Date().toISOString();
  return session;
}

function getUnassignedCheck(session, cattleId) {
  if (!session || !session.unassignedChecks) return null;
  if (session.unassignedChecks[cattleId]) return session.unassignedChecks[cattleId];
  for (var uk in session.unassignedChecks) {
    if (Object.prototype.hasOwnProperty.call(session.unassignedChecks, uk) && cattleIdEqual(uk, cattleId)) {
      return session.unassignedChecks[uk];
    }
  }
  return null;
}

function buildUncheckedCells(session, layout, yardCells) {
  var uncheckedCells = [];
  if (!session || !session.finishedEarly) return uncheckedCells;
  var cells = yardCells;
  if (!cells && layout && session.yardKey) {
    cells = buildYardCells(layout, session.yardKey, session.expectedSnapshot);
  }
  if (!cells) return uncheckedCells;
  cells.forEach(function (cell) {
    if (!cell) return;
    var key = cellKey(cell.yard, cell.row, cell.place);
    if (session.cellChecks && session.cellChecks[key]) return;
    uncheckedCells.push({
      yard: cell.yard,
      row: cell.row,
      place: cell.place,
      expected: cell.expected || null
    });
  });
  uncheckedCells.sort(compareCells);
  return uncheckedCells;
}

function findInSnapshot(snapshot, cattleId) {
  for (var i = 0; i < (snapshot || []).length; i++) {
    if (cattleIdEqual(snapshot[i].cattleId, cattleId)) return snapshot[i];
  }
  return null;
}

function actualAtCell(session, yard, row, place, expectedAtCell) {
  var ck = session.cellChecks[cellKey(yard, row, place)];
  if (!ck) return { checked: false, cattleId: null };
  if (ck.status === 'ok') {
    return { checked: true, cattleId: expectedAtCell ? expectedAtCell.cattleId : null };
  }
  if (ck.status === 'empty') {
    return { checked: true, cattleId: null };
  }
  return { checked: true, cattleId: ck.actualCattleId || null };
}

function pushMoved(moved, seen, item) {
  var id = item.cattleId;
  if (!id || seen[id]) return;
  seen[id] = true;
  moved.push(item);
}

function pushUnallocated(list, item) {
  if (!item || !item.cattleId) return;
  for (var i = 0; i < list.length; i++) {
    if (cattleIdEqual(list[i].cattleId, item.cattleId)) return;
  }
  list.push(item);
}

function buildNewAnimals(session, snapshot) {
  var newAnimals = [];
  var seen = {};
  Object.keys(session.cellChecks || {}).forEach(function (key) {
    var parts = key.split('|');
    if (parts.length < 3) return;
    var ck = session.cellChecks[key];
    if (!ck || ck.status !== 'other' || !ck.actualCattleId) return;
    var isNew = ck.isNewToHerd === true || !findInSnapshot(snapshot, ck.actualCattleId);
    if (!isNew) return;
    var id = String(ck.actualCattleId).trim();
    if (!id || seen[id]) return;
    seen[id] = true;
    newAnimals.push({
      cattleId: id,
      foundAt: {
        yard: parts[0],
        row: parseInt(parts[1], 10),
        place: parseInt(parts[2], 10)
      }
    });
  });
  return newAnimals;
}

function buildUnallocated(session, snapshot, withoutPlace) {
  var unallocated = [];

  (withoutPlace.stillWithout || []).forEach(function (base) {
    pushUnallocated(unallocated, {
      cattleId: base.cattleId,
      nickname: base.nickname,
      group: base.group,
      reason: 'без стойломеста',
      stallLabel: '—'
    });
  });

  (withoutPlace.notChecked || []).forEach(function (base) {
    pushUnallocated(unallocated, {
      cattleId: base.cattleId,
      nickname: base.nickname,
      group: base.group,
      reason: 'без стойломеста (не проверено)',
      stallLabel: '—'
    });
  });

  (snapshot || []).forEach(function (entry) {
    if (!entry || !entry.cattleId || !entryHasStallCoords(entry)) return;
    var coords = entryStallCoords(entry);
    var ck = session.cellChecks[cellKey(coords.yard, coords.row, coords.place)];
    if (!ck || ck.status !== 'empty') return;
    var base = entrySummary(entry);
    pushUnallocated(unallocated, {
      cattleId: base.cattleId,
      nickname: base.nickname,
      group: base.group,
      reason: 'не найдено на месте',
      stallLabel: formatStallLabel(coords.yard, coords.row, coords.place)
    });
  });

  return unallocated;
}

/**
 * @param {object} session
 * @param {object[]|undefined} expectedEntries
 * @param {{ layout?: object, yardCells?: object[] }} [opts]
 * @returns {{ moved: object[], withoutPlace: object, uncheckedCells: object[], progress: object }}
 */
export function computeInventoryResult(session, expectedEntries, opts) {
  var moved = [];
  var seenMoved = {};
  var snapshot = session && session.expectedSnapshot ? session.expectedSnapshot : expectedEntries;
  var withoutPlace = { stillWithout: [], foundDuringCheck: [], notChecked: [] };
  var layout = opts && opts.layout ? opts.layout : null;
  var yardCells = opts && opts.yardCells ? opts.yardCells : null;
  var finishedEarly = !!(session && session.finishedEarly);

  (snapshot || []).forEach(function (entry) {
    if (!entry || !entry.cattleId) return;
    if (!entryHasStallCoords(entry)) {
      var uc = getUnassignedCheck(session, entry.cattleId);
      var base = entrySummary(entry);
      if (uc && uc.status === 'found' && uc.found && invEntryIntField(uc.found.row) != null) {
        withoutPlace.foundDuringCheck.push({
          cattleId: base.cattleId,
          nickname: base.nickname,
          group: base.group,
          found: uc.found
        });
      } else if (uc && uc.status === 'not_found') {
        withoutPlace.stillWithout.push(base);
      } else if (uc && uc.status === 'pending' && finishedEarly) {
        withoutPlace.notChecked.push(base);
      } else if (!uc || uc.status === 'pending') {
        withoutPlace.stillWithout.push(base);
      }
      return;
    }

    var coords = entryStallCoords(entry);
    var expectedAtCell = entrySummary(entry);
    var actual = actualAtCell(session, coords.yard, coords.row, coords.place, expectedAtCell);
    if (!actual.checked) return;

    if (!cattleIdEqual(actual.cattleId, entry.cattleId)) {
      pushMoved(moved, seenMoved, {
        cattleId: expectedAtCell.cattleId,
        nickname: expectedAtCell.nickname,
        group: expectedAtCell.group,
        expected: coords,
        actualCattleId: actual.cattleId,
        actualLabel: actual.cattleId
          ? ('найдено: ' + actual.cattleId)
          : 'не найдено на записанном месте'
      });
    }
  });

  Object.keys(session.cellChecks || {}).forEach(function (key) {
    var parts = key.split('|');
    if (parts.length < 3) return;
    var yard = parts[0];
    var row = parseInt(parts[1], 10);
    var place = parseInt(parts[2], 10);
    var ck = session.cellChecks[key];
    if (!ck || ck.status === 'empty') return;

    var foundId = null;
    if (ck.status === 'other') {
      foundId = ck.actualCattleId;
    } else if (ck.status === 'ok') {
      var exp = findEntryAt(snapshot, yard, row, place);
      foundId = exp ? exp.cattleId : null;
    }
    if (!foundId) return;

    var entry = findInSnapshot(snapshot, foundId);
    if (!entry || !entryHasStallCoords(entry)) return;

    var recorded = entryStallCoords(entry);
    var cellCoords = { yard: yard, row: row, place: place };
    if (!coordsMatch(recorded, cellCoords)) {
      pushMoved(moved, seenMoved, {
        cattleId: entry.cattleId,
        nickname: entry.nickname,
        group: entry.group,
        expected: recorded,
        actualCattleId: foundId,
        actualLabel: formatStallLabel(yard, row, place)
      });
    }
  });

  var uncheckedCells = buildUncheckedCells(session, layout, yardCells);
  var progress = getInventoryProgress(session, yardCells);
  var newAnimals = buildNewAnimals(session, snapshot);
  var unallocated = buildUnallocated(session, snapshot, withoutPlace);

  return {
    moved: moved,
    withoutPlace: withoutPlace,
    uncheckedCells: uncheckedCells,
    progress: progress,
    newAnimals: newAnimals,
    unallocated: unallocated
  };
}

/**
 * Список записей для обновления stall-полей после «Применить».
 */
export function collectApplyUpdates(session, result) {
  var updates = [];
  var seen = {};

  (result.withoutPlace.foundDuringCheck || []).forEach(function (row) {
    if (!row.cattleId || seen[row.cattleId]) return;
    seen[row.cattleId] = true;
    updates.push({
      cattleId: row.cattleId,
      stallYard: row.found.yard,
      stallRow: row.found.row,
      stallPlace: row.found.place
    });
  });

  Object.keys(session.cellChecks || {}).forEach(function (key) {
    var parts = key.split('|');
    if (parts.length < 3) return;
    var ck = session.cellChecks[key];
    if (!ck || ck.status === 'empty') return;

    var foundId = null;
    if (ck.status === 'other') {
      foundId = ck.actualCattleId;
    } else if (ck.status === 'ok') {
      var exp = findEntryAt(session.expectedSnapshot, parts[0], parts[1], parts[2]);
      foundId = exp ? exp.cattleId : null;
    }
    if (!foundId || seen[foundId]) return;

    var entry = findInSnapshot(session.expectedSnapshot, foundId);
    if (!entry) return;
    if (!entryHasStallCoords(entry)) return;

    var recorded = entryStallCoords(entry);
    var cellCoords = {
      yard: parts[0],
      row: parseInt(parts[1], 10),
      place: parseInt(parts[2], 10)
    };
    if (coordsMatch(recorded, cellCoords)) return;

    var inMoved = (result.moved || []).some(function (m) {
      return cattleIdEqual(m.cattleId, foundId);
    });
    if (!inMoved) return;

    seen[foundId] = true;
    updates.push({
      cattleId: foundId,
      stallYard: cellCoords.yard,
      stallRow: cellCoords.row,
      stallPlace: cellCoords.place
    });
  });

  return updates;
}

export function normalizeLayout(raw) {
  var out = { yards: {} };
  if (!raw || typeof raw !== 'object') return out;
  var yards = raw.yards;
  if (!yards || typeof yards !== 'object') return out;
  Object.keys(yards).forEach(function (k) {
    var key = String(k).trim();
    if (!key) return;
    var y = yards[k];
    if (!y || typeof y !== 'object') return;
    var rows = parseInt(y.rows, 10);
    var cols = parseInt(y.cols, 10);
    if (!Number.isFinite(rows) || rows < 1) rows = 1;
    if (rows > 200) rows = 200;
    if (!Number.isFinite(cols) || cols < 1) cols = 1;
    if (cols > 200) cols = 200;
    out.yards[key] = { rows: rows, cols: cols };
  });
  return out;
}
