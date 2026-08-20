/**
 * Матрица функций ролей inseminator / service.
 * Админ всегда полный доступ. Переопределения хранятся в БД (app_kv).
 */
const ADMIN_ONLY_KEYS = ['adminUsersRoles', 'adminReleaseControls', 'createDeleteObjects'];

const EDITABLE_KEYS = [
  'cards',
  'eventsInput',
  'serviceWorksInput',
  'workLists',
  'stallMap',
  'inventory',
  'notifications',
  'analytics',
  'farmCardSettings',
  'farmCardEventsWrite',
  'farmCardView',
  'multiBase'
];

const DEFAULT_INSEMINATOR = {
  cards: true,
  eventsInput: true,
  serviceWorksInput: true,
  farmCardEventsWrite: false,
  workLists: true,
  stallMap: true,
  inventory: true,
  notifications: true,
  analytics: false,
  farmCardSettings: false,
  farmCardView: true,
  multiBase: true,
  adminUsersRoles: false,
  adminReleaseControls: false,
  createDeleteObjects: false
};

const DEFAULT_SERVICE = {
  cards: true,
  eventsInput: false,
  serviceWorksInput: true,
  farmCardEventsWrite: true,
  workLists: true,
  stallMap: true,
  inventory: false,
  notifications: true,
  analytics: false,
  farmCardSettings: false,
  farmCardView: true,
  multiBase: true,
  adminUsersRoles: false,
  adminReleaseControls: false,
  createDeleteObjects: false
};

function normalizeRole(role) {
  const r = String(role || '').trim().toLowerCase();
  if (r === 'admin' || r === 'manager') return 'admin';
  if (r === 'service' || r === 'viewer') return 'service';
  return 'inseminator';
}

function cloneCaps(src) {
  return Object.assign({}, src);
}

function getDefaultRoleCapabilities() {
  return {
    inseminator: cloneCaps(DEFAULT_INSEMINATOR),
    service: cloneCaps(DEFAULT_SERVICE)
  };
}

function pickEditable(src) {
  const out = {};
  if (!src || typeof src !== 'object') return out;
  for (let i = 0; i < EDITABLE_KEYS.length; i++) {
    const key = EDITABLE_KEYS[i];
    if (Object.prototype.hasOwnProperty.call(src, key) && typeof src[key] === 'boolean') {
      out[key] = src[key];
    }
  }
  return out;
}

function mergeOneRole(defaults, overlay) {
  const next = Object.assign({}, defaults, pickEditable(overlay));
  for (let i = 0; i < ADMIN_ONLY_KEYS.length; i++) {
    next[ADMIN_ONLY_KEYS[i]] = false;
  }
  return next;
}

function mergeRoleCapabilities(stored) {
  const defaults = getDefaultRoleCapabilities();
  const src = stored && typeof stored === 'object' ? stored : {};
  return {
    inseminator: mergeOneRole(defaults.inseminator, src.inseminator),
    service: mergeOneRole(defaults.service, src.service)
  };
}

function mergeUserCapabilities(roleCaps, userOverlay) {
  return Object.assign({}, roleCaps || {}, pickEditable(userOverlay));
}

function userHasCapability(user, capability, storedOrMerged, userOverlay) {
  const key = String(capability || '').trim();
  if (!key) return false;
  const role = normalizeRole(user && user.role);
  if (role === 'admin') return true;
  const merged = storedOrMerged && storedOrMerged.inseminator && storedOrMerged.service
    ? storedOrMerged
    : mergeRoleCapabilities(storedOrMerged);
  const roleCaps = merged[role] || merged.inseminator;
  const caps = mergeUserCapabilities(roleCaps, userOverlay);
  return !!caps[key];
}

module.exports = {
  ADMIN_ONLY_KEYS,
  EDITABLE_KEYS,
  DEFAULT_INSEMINATOR,
  DEFAULT_SERVICE,
  normalizeRole,
  getDefaultRoleCapabilities,
  mergeRoleCapabilities,
  mergeUserCapabilities,
  pickEditable,
  userHasCapability
};
