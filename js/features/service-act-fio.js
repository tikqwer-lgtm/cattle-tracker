/**
 * Сохранённые ФИО для актов и подписей описи Мокша (по объекту).
 */
import { DEFAULT_MOKSHA_SIGNERS } from './service-work-report-build.js';

export var ACT_FIO_LS_PREFIX = 'cattleTracker_actFio_';

export function actFioStorageKey(objectId) {
  return ACT_FIO_LS_PREFIX + (String(objectId || '').trim() || 'default');
}

export function emptyActFio() {
  return {
    executorFio: '',
    customerOrg: '',
    customerFio: '',
    mokshaLeft: DEFAULT_MOKSHA_SIGNERS.left,
    mokshaRight1: DEFAULT_MOKSHA_SIGNERS.right1,
    mokshaRight2: DEFAULT_MOKSHA_SIGNERS.right2
  };
}

export function parseActFio(raw) {
  var base = emptyActFio();
  var src = raw;
  if (typeof raw === 'string') {
    try {
      src = JSON.parse(raw);
    } catch (e) {
      return base;
    }
  }
  if (!src || typeof src !== 'object') return base;
  if (src.executorFio != null) base.executorFio = String(src.executorFio);
  if (src.customerOrg != null) base.customerOrg = String(src.customerOrg);
  if (src.customerFio != null) base.customerFio = String(src.customerFio);
  if (src.mokshaLeft != null) base.mokshaLeft = String(src.mokshaLeft);
  if (src.mokshaRight1 != null) base.mokshaRight1 = String(src.mokshaRight1);
  if (src.mokshaRight2 != null) base.mokshaRight2 = String(src.mokshaRight2);
  return base;
}

export function loadActFio(storage, objectId) {
  var key = actFioStorageKey(objectId);
  if (!storage || typeof storage.getItem !== 'function') return emptyActFio();
  try {
    return parseActFio(storage.getItem(key));
  } catch (e) {
    return emptyActFio();
  }
}

export function saveActFio(storage, objectId, data) {
  var key = actFioStorageKey(objectId);
  var next = parseActFio(data);
  if (!storage || typeof storage.setItem !== 'function') return next;
  try {
    storage.setItem(key, JSON.stringify(next));
  } catch (e) {}
  return next;
}
