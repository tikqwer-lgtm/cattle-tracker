/**
 * Ограничения записи для роли service: осеменение / УЗИ / протокол и лента карточки.
 */
const ALLOWED_HISTORY_TYPES = [
  'Осеменение',
  'УЗИ',
  'УЗИ1',
  'УЗИ2',
  'Постановка на протокол'
];

const SERVICE_PATCH_KEYS = [
  'inseminationDate',
  'attemptNumber',
  'bull',
  'inseminator',
  'code',
  'inseminationHistory',
  'uziHistory',
  'protocol',
  'protocolName',
  'protocolStartDate',
  'status',
  'note',
  'lastModifiedBy',
  'synced',
  'userId'
];

function historyItemType(item) {
  if (!item || typeof item !== 'object') return '';
  return String(item.eventType || item.type || '').trim();
}

function isAllowedServiceHistoryItem(item) {
  const t = historyItemType(item);
  if (!t) return false;
  for (let i = 0; i < ALLOWED_HISTORY_TYPES.length; i++) {
    if (t === ALLOWED_HISTORY_TYPES[i] || t.indexOf(ALLOWED_HISTORY_TYPES[i]) !== -1) return true;
  }
  return false;
}

function historyKey(item) {
  if (item && item.id) return 'id:' + String(item.id);
  return JSON.stringify({
    t: historyItemType(item),
    d: item && (item.date || item.dateTime || item.eventDate) || '',
    det: item && (item.details || item.result || '') || ''
  });
}

function mergeActionHistory(prev, incoming) {
  const prevList = Array.isArray(prev) ? prev : [];
  const nextList = Array.isArray(incoming) ? incoming : [];
  const prevKeys = new Set(prevList.map(historyKey));
  for (let i = 0; i < nextList.length; i++) {
    const item = nextList[i];
    if (isAllowedServiceHistoryItem(item) || prevKeys.has(historyKey(item))) continue;
    return {
      ok: false,
      error: 'Сервис может записывать только осеменение, УЗИ и постановку на протокол'
    };
  }
  const protectedPrev = prevList.filter((item) => !isAllowedServiceHistoryItem(item));
  const incomingAllowed = nextList.filter(
    (item) => isAllowedServiceHistoryItem(item) || prevKeys.has(historyKey(item))
  );
  const incomingKeys = new Set(incomingAllowed.map(historyKey));
  const missingProtected = protectedPrev.filter((item) => !incomingKeys.has(historyKey(item)));
  return { ok: true, history: incomingAllowed.concat(missingProtected) };
}

function applyServiceEntryUpdate(existing, incoming) {
  if (!existing || typeof existing !== 'object') {
    return { ok: false, error: 'Запись не найдена' };
  }
  const src = incoming && typeof incoming === 'object' ? incoming : {};
  const next = Object.assign({}, existing);
  for (let i = 0; i < SERVICE_PATCH_KEYS.length; i++) {
    const key = SERVICE_PATCH_KEYS[i];
    if (Object.prototype.hasOwnProperty.call(src, key) && src[key] !== undefined) {
      next[key] = src[key];
    }
  }
  if (Object.prototype.hasOwnProperty.call(src, 'actionHistory')) {
    const merged = mergeActionHistory(existing.actionHistory, src.actionHistory);
    if (!merged.ok) return merged;
    next.actionHistory = merged.history;
  }
  next.cattleId = existing.cattleId;
  if (existing.dateAdded != null) next.dateAdded = existing.dateAdded;
  return { ok: true, entry: next };
}

function applyFarmCardEventsOnly(prevProfile, body) {
  const prev = prevProfile && typeof prevProfile === 'object' ? prevProfile : {};
  const b = body && typeof body === 'object' ? body : {};
  return Object.assign({}, prev, {
    events: Array.isArray(b.events) ? b.events : Array.isArray(prev.events) ? prev.events : []
  });
}

module.exports = {
  ALLOWED_HISTORY_TYPES,
  SERVICE_PATCH_KEYS,
  isAllowedServiceHistoryItem,
  applyServiceEntryUpdate,
  applyFarmCardEventsOnly
};
