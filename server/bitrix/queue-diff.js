/**
 * Diff farm-card PUT → очередь ручного переноса в Битрикс.
 */
const bitrixDb = require('../db/bitrix');

function normStr(v) {
  return v != null ? String(v).trim() : '';
}

function phonesOf(s) {
  if (!s) return '';
  if (Array.isArray(s.phones) && s.phones.length) {
    return s.phones
      .map(function (p) {
        return normStr(p);
      })
      .filter(Boolean)
      .join(', ');
  }
  return normStr(s.phone);
}

function specialistFingerprint(s) {
  return [
    normStr(s && s.name),
    normStr(s && s.role),
    phonesOf(s),
    normStr(s && s.email)
  ].join('|');
}

function addressFingerprint(info) {
  const a = info && typeof info === 'object' ? info : {};
  return [normStr(a.region), normStr(a.locality), normStr(a.address)].join('|');
}

function enqueueFarmCardDiff(objectId, prevProfile, nextBody, userId) {
  const prev = prevProfile && typeof prevProfile === 'object' ? prevProfile : {};
  const next = nextBody && typeof nextBody === 'object' ? nextBody : {};
  const snapshot = prev.bitrixSnapshot && typeof prev.bitrixSnapshot === 'object' ? prev.bitrixSnapshot : null;
  const created = [];

  const prevSpecs = Array.isArray(prev.specialists) ? prev.specialists : [];
  const nextSpecs = Array.isArray(next.specialists) ? next.specialists : [];
  const prevById = {};
  prevSpecs.forEach(function (s) {
    if (s && s.id) prevById[String(s.id)] = s;
  });

  nextSpecs.forEach(function (s) {
    if (!s || typeof s !== 'object') return;
    const id = s.id != null ? String(s.id) : '';
    const prevS = id && prevById[id] ? prevById[id] : null;
    const fp = specialistFingerprint(s);
    const prevFp = prevS ? specialistFingerprint(prevS) : '';
    if (prevS && fp === prevFp) return;

    // Новый локальный контакт
    if (!prevS && !s.bitrixContactId) {
      const item = bitrixDb.createPendingExport({
        objectId: objectId,
        kind: 'specialist',
        createdBy: userId,
        payload: {
          action: 'create',
          id: id,
          name: s.name,
          role: s.role,
          phones: s.phones || (s.phone ? [s.phone] : []),
          email: s.email,
          summary: 'Новый специалист: ' + (s.name || s.email || id || 'без имени')
        }
      });
      created.push(item);
      return;
    }

    // Изменение существующего (в т.ч. из Битрикс)
    if (prevS && fp !== prevFp) {
      const already = bitrixDb.hasOpenPendingFor(objectId, function (p) {
        if (p.kind !== 'specialist') return false;
        const pl = p.payload || {};
        if (s.bitrixContactId && pl.bitrixContactId === String(s.bitrixContactId)) return true;
        if (id && pl.id === id) return true;
        return false;
      });
      if (already) return;
      const item = bitrixDb.createPendingExport({
        objectId: objectId,
        kind: 'specialist',
        createdBy: userId,
        payload: {
          action: 'update',
          id: id,
          bitrixContactId: s.bitrixContactId != null ? String(s.bitrixContactId) : '',
          name: s.name,
          role: s.role,
          phones: s.phones || (s.phone ? [s.phone] : []),
          email: s.email,
          before: prevS
            ? {
                name: prevS.name,
                role: prevS.role,
                phones: prevS.phones || (prevS.phone ? [prevS.phone] : []),
                email: prevS.email
              }
            : null,
          summary:
            'Изменение специалиста: ' +
            (s.name || s.email || id || 'без имени') +
            (s.bitrixContactId ? ' (Битрикс #' + s.bitrixContactId + ')' : '')
        }
      });
      created.push(item);
    }
  });

  const nextAddr = next.addressInfo || {};
  const prevAddr = prev.addressInfo || {};
  const snapAddr = snapshot && snapshot.addressInfo ? snapshot.addressInfo : null;
  const addrChanged =
    addressFingerprint(nextAddr) !== addressFingerprint(prevAddr) ||
    (snapAddr && addressFingerprint(nextAddr) !== addressFingerprint(snapAddr));

  if (addrChanged && addressFingerprint(nextAddr) !== addressFingerprint(prevAddr)) {
    const alreadyAddr = bitrixDb.hasOpenPendingFor(objectId, function (p) {
      return p.kind === 'address';
    });
    if (!alreadyAddr) {
      const item = bitrixDb.createPendingExport({
        objectId: objectId,
        kind: 'address',
        createdBy: userId,
        payload: {
          action: 'update',
          addressInfo: nextAddr,
          before: prevAddr,
          summary:
            'Адрес: ' +
            [nextAddr.region, nextAddr.locality, nextAddr.address].filter(Boolean).join(', ')
        }
      });
      created.push(item);
    }
  }

  return created;
}

module.exports = {
  enqueueFarmCardDiff,
  specialistFingerprint,
  addressFingerprint
};
