/**
 * ZIP backup bundle: manifest + farm-card + farm-settings + herd/*.
 * Legacy single .json with entries only is still supported.
 */
import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate';

const BUNDLE_FORMAT = 'cattle-tracker-backup';
const BUNDLE_VERSION = 1;

function safeName(s) {
  return String(s || 'base')
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 60) || 'base';
}

function flattenInseminations(entries) {
  const out = [];
  (entries || []).forEach(function (e) {
    if (!e || !e.cattleId) return;
    const hist = e.inseminationHistory || [];
    hist.forEach(function (h, idx) {
      if (!h) return;
      out.push({
        cattleId: e.cattleId,
        index: idx,
        date: h.date || '',
        attemptNumber: h.attemptNumber,
        bull: h.bull || '',
        inseminator: h.inseminator || '',
        code: h.code || ''
      });
    });
  });
  return out;
}

function flattenEvents(entries) {
  const out = [];
  (entries || []).forEach(function (e) {
    if (!e || !e.cattleId) return;
    (e.actionHistory || []).forEach(function (a) {
      if (!a) return;
      out.push({ cattleId: e.cattleId, type: 'action', date: a.date, action: a.action, note: a.note });
    });
    (e.uziHistory || []).forEach(function (u) {
      if (!u) return;
      out.push({ cattleId: e.cattleId, type: 'uzi', date: u.date, result: u.result, note: u.note });
    });
  });
  return out;
}

/**
 * @param {object} opts
 * @returns {Uint8Array}
 */
export function buildBackupZip(opts) {
  const o = opts || {};
  const objectId = o.objectId || 'default';
  const objectName = o.objectName || objectId;
  const appVersion = o.appVersion || '';
  const entries = Array.isArray(o.entries) ? o.entries : [];
  const stallLayout = o.stall_layout || o.stallLayout || { yards: {} };
  const farmCard = o.farm_card || o.farmCard || o.profile || {};
  const farmSettings = o.farm_settings || o.farmSettings || {
    technicians: [],
    bulls: [],
    drugs: [],
    vwpDays: 60,
    protocols: []
  };
  const protocols = Array.isArray(farmSettings.protocols)
    ? farmSettings.protocols
    : (Array.isArray(o.protocols) ? o.protocols : []);

  const settingsFile = {
    technicians: farmSettings.technicians || [],
    bulls: farmSettings.bulls || [],
    drugs: farmSettings.drugs || [],
    vwpDays: farmSettings.vwpDays != null ? farmSettings.vwpDays : 60,
    protocols: protocols
  };

  const manifest = {
    format: BUNDLE_FORMAT,
    version: BUNDLE_VERSION,
    objectId: objectId,
    objectName: objectName,
    createdAt: new Date().toISOString(),
    appVersion: appVersion
  };

  const files = {
    'manifest.json': strToU8(JSON.stringify(manifest, null, 2)),
    'farm-card.json': strToU8(JSON.stringify(farmCard, null, 2)),
    'farm-settings.json': strToU8(JSON.stringify(settingsFile, null, 2)),
    'herd/entries.json': strToU8(JSON.stringify(entries, null, 2)),
    'herd/inseminations.json': strToU8(JSON.stringify(flattenInseminations(entries), null, 2)),
    'herd/stall-layout.json': strToU8(JSON.stringify(stallLayout, null, 2)),
    'herd/events.json': strToU8(JSON.stringify(flattenEvents(entries), null, 2))
  };

  return zipSync(files, { level: 6 });
}

function readZipFile(unzipped, path) {
  const data = unzipped[path];
  if (!data) return null;
  try {
    return JSON.parse(strFromU8(data));
  } catch (e) {
    return null;
  }
}

/**
 * @param {Uint8Array|ArrayBuffer} zipData
 * @param {object} applyOpts — callbacks to apply layers
 * @returns {{ ok: boolean, applied: string[], skipped: string[], errors: string[], manifest?: object }}
 */
/** Какие файлы есть в ZIP (для диалога восстановления). */
export function inspectBackupZip(zipData) {
  let bytes;
  if (zipData instanceof ArrayBuffer) bytes = new Uint8Array(zipData);
  else if (zipData instanceof Uint8Array) bytes = zipData;
  else return { ok: false, error: 'Неверный формат ZIP', present: [], manifest: null };

  let unzipped;
  try {
    unzipped = unzipSync(bytes);
  } catch (e) {
    return { ok: false, error: e && e.message ? e.message : 'Ошибка распаковки', present: [], manifest: null };
  }

  const paths = [
    'farm-card.json',
    'farm-settings.json',
    'herd/entries.json',
    'herd/stall-layout.json',
    'herd/inseminations.json',
    'herd/events.json'
  ];
  const present = paths.filter(function (p) {
    return unzipped[p] != null;
  });
  const manifest = readZipFile(unzipped, 'manifest.json');
  return { ok: true, present: present, manifest: manifest };
}

export function restoreBackupZip(zipData, applyOpts) {
  const applied = [];
  const skipped = [];
  const errors = [];
  const apply = applyOpts || {};
  const layers = apply.layers || {
    farmCard: true,
    farmSettings: true,
    herd: true
  };

  let bytes;
  if (zipData instanceof ArrayBuffer) bytes = new Uint8Array(zipData);
  else if (zipData instanceof Uint8Array) bytes = zipData;
  else return { ok: false, applied, skipped, errors: ['Неверный формат ZIP'] };

  let unzipped;
  try {
    unzipped = unzipSync(bytes);
  } catch (e) {
    return { ok: false, applied, skipped, errors: [e && e.message ? e.message : 'Ошибка распаковки ZIP'] };
  }

  const manifest = readZipFile(unzipped, 'manifest.json');
  if (!manifest || manifest.format !== BUNDLE_FORMAT) {
    errors.push('manifest.json отсутствует или неверный format');
  }

  function tryApply(path, fn, enabled) {
    if (enabled === false) {
      skipped.push(path + ' (отключено)');
      return;
    }
    const data = readZipFile(unzipped, path);
    if (data == null) {
      skipped.push(path);
      return;
    }
    if (typeof fn !== 'function') {
      skipped.push(path);
      return;
    }
    try {
      fn(data);
      applied.push(path);
    } catch (e) {
      errors.push(path + ': ' + (e && e.message ? e.message : String(e)));
    }
  }

  tryApply('farm-card.json', apply.applyFarmCard, layers.farmCard);
  tryApply('farm-settings.json', apply.applyFarmSettings, layers.farmSettings);
  tryApply('herd/entries.json', apply.applyEntries, layers.herd);
  tryApply('herd/stall-layout.json', apply.applyStallLayout, layers.herd);

  return { ok: errors.length === 0, applied, skipped, errors, manifest: manifest || null };
}

/**
 * Legacy .json: { entries, stall_layout?, protocols? }
 */
export function parseLegacyBackupJson(text) {
  const data = JSON.parse(text);
  if (Array.isArray(data)) return { entries: data, stall_layout: null, protocols: null, farm_card: null, farm_settings: null };
  return {
    entries: data.entries || (Array.isArray(data) ? data : []),
    stall_layout: data.stall_layout || data.stallLayout || null,
    protocols: data.protocols || null,
    farm_card: data.farm_card || data.profile || null,
    farm_settings: data.farm_settings || null
  };
}

export function backupZipFilename(objectName) {
  const date = new Date().toISOString().slice(0, 10);
  return 'cattle-tracker-' + safeName(objectName) + '-' + date + '.zip';
}

export function collectBackupPayloadFromWindow(win) {
  const w = win || (typeof window !== 'undefined' ? window : {});
  const oid = typeof w.getCurrentObjectId === 'function' ? w.getCurrentObjectId() : 'default';
  const list = typeof w.getObjectsList === 'function' ? w.getObjectsList() : [];
  const meta = (list || []).filter(function (o) { return o && o.id === oid; })[0];
  const objectName = (meta && meta.name) ? meta.name : oid;
  const entries = w.entries && Array.isArray(w.entries) ? w.entries : [];
  let stall_layout = { yards: {} };
  if (w.CattleTrackerObjectData) {
    stall_layout = w.CattleTrackerObjectData.loadStallLayoutLocal(oid);
  } else {
    try {
      const raw = localStorage.getItem('cattleTracker_stallLayout_' + oid);
      if (raw) stall_layout = JSON.parse(raw);
    } catch (e) {}
  }
  const farm_card = typeof w.getFarmCardBundleForExport === 'function'
    ? w.getFarmCardBundleForExport()
    : (w.CattleTrackerObjectData ? w.CattleTrackerObjectData.loadFarmProfileLocal(oid) : {});
  const settings = w.CattleTrackerObjectData
    ? w.CattleTrackerObjectData.loadFarmSettingsLocal(oid)
    : { technicians: [], bulls: [], drugs: [] };
  const protocols = w.CattleTrackerObjectData
    ? w.CattleTrackerObjectData.loadProtocolsLocal(oid)
    : (typeof w.getProtocols === 'function' ? w.getProtocols() : []);
  return {
    objectId: oid,
    objectName: objectName,
    appVersion: (w.CATTLE_TRACKER_APP_VERSION || '').toString(),
    entries: entries,
    stall_layout: stall_layout,
    farm_card: farm_card,
    farm_settings: {
      technicians: settings.technicians || [],
      bulls: settings.bulls || [],
      drugs: settings.drugs || [],
      protocols: protocols
    }
  };
}

if (typeof window !== 'undefined') {
  window.CattleTrackerBackupBundle = {
    buildBackupZip: buildBackupZip,
    inspectBackupZip: inspectBackupZip,
    restoreBackupZip: restoreBackupZip,
    parseLegacyBackupJson: parseLegacyBackupJson,
    backupZipFilename: backupZipFilename,
    collectBackupPayloadFromWindow: collectBackupPayloadFromWindow,
    BUNDLE_FORMAT: BUNDLE_FORMAT,
    BUNDLE_VERSION: BUNDLE_VERSION
  };
}
