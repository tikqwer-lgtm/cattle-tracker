const { runSql, getSql, saveDb, parseJsonColumn, normalizeVwpDays } = require('./core');
const { getObjectById } = require('./objects');
const { getProtocols, createProtocol } = require('./protocols');
const { getStallLayout, putStallLayout } = require('./stall-layout');
const { applyFarmCardEventsOnly } = require('../lib/service-work-acl');

const EMPTY_FARM_SETTINGS = { technicians: [], bulls: [], drugs: [], vwpDays: 60 };

function getObjectProfile(objectId) {
  const row = getSql('SELECT profile_json FROM objects WHERE id = ?', [objectId]);
  if (!row) return null;
  return parseJsonColumn(row.profile_json, null);
}

function putObjectProfile(objectId, profile) {
  const obj = getObjectById(objectId);
  if (!obj) return false;
  const json = JSON.stringify(profile != null && typeof profile === 'object' ? profile : {});
  runSql('UPDATE objects SET profile_json = ? WHERE id = ?', [json, objectId]);
  saveDb();
  return true;
}

function getFarmSettings(objectId) {
  const row = getSql('SELECT farm_settings_json FROM objects WHERE id = ?', [objectId]);
  if (!row) return { ...EMPTY_FARM_SETTINGS };
  const parsed = parseJsonColumn(row.farm_settings_json, EMPTY_FARM_SETTINGS);
  if (!parsed || typeof parsed !== 'object') return { ...EMPTY_FARM_SETTINGS };
  return {
    technicians: Array.isArray(parsed.technicians) ? parsed.technicians : [],
    bulls: Array.isArray(parsed.bulls) ? parsed.bulls : [],
    drugs: Array.isArray(parsed.drugs) ? parsed.drugs : [],
    vwpDays: normalizeVwpDays(parsed.vwpDays)
  };
}

function putFarmSettings(objectId, settings) {
  const obj = getObjectById(objectId);
  if (!obj) return false;
  const s = settings && typeof settings === 'object' ? settings : {};
  const normalized = {
    technicians: Array.isArray(s.technicians) ? s.technicians : [],
    bulls: Array.isArray(s.bulls) ? s.bulls : [],
    drugs: Array.isArray(s.drugs) ? s.drugs : [],
    vwpDays: normalizeVwpDays(s.vwpDays)
  };
  runSql('UPDATE objects SET farm_settings_json = ? WHERE id = ?', [JSON.stringify(normalized), objectId]);
  saveDb();
  return true;
}

/** Карточка хозяйства (расширенный bundle для UI farm-card). */
function getFarmCardBundle(objectId) {
  const p = getObjectProfile(objectId);
  if (!p || typeof p !== 'object') {
    return {
      contacts: [],
      addresses: [],
      addressInfo: { region: '', locality: '', address: '' },
      metricDefinitions: [],
      metricValues: [],
      bullFertility: [],
      events: [],
      workTasks: [],
      specialists: [],
      items: [],
      goals: [],
      bitrixCompanyId: '',
      bitrixSyncedAt: ''
    };
  }
  return {
    contacts: Array.isArray(p.contacts) ? p.contacts : [],
    addresses: Array.isArray(p.addresses) ? p.addresses : [],
    addressInfo:
      p.addressInfo && typeof p.addressInfo === 'object'
        ? {
            region: p.addressInfo.region != null ? String(p.addressInfo.region) : '',
            locality: p.addressInfo.locality != null ? String(p.addressInfo.locality) : '',
            address: p.addressInfo.address != null ? String(p.addressInfo.address) : ''
          }
        : { region: '', locality: '', address: '' },
    metricDefinitions: Array.isArray(p.metricDefinitions) ? p.metricDefinitions : [],
    metricValues: Array.isArray(p.metricValues) ? p.metricValues : [],
    bullFertility: Array.isArray(p.bullFertility) ? p.bullFertility : [],
    events: Array.isArray(p.events) ? p.events : [],
    workTasks: Array.isArray(p.workTasks) ? p.workTasks : [],
    specialists: Array.isArray(p.specialists) ? p.specialists : [],
    items: Array.isArray(p.items) ? p.items : [],
    goals: Array.isArray(p.goals) ? p.goals : [],
    name: p.name != null ? String(p.name) : '',
    legalName: p.legalName != null ? String(p.legalName) : '',
    notes: p.notes != null ? String(p.notes) : '',
    bitrixCompanyId: p.bitrixCompanyId != null ? String(p.bitrixCompanyId) : '',
    bitrixSyncedAt: p.bitrixSyncedAt != null ? String(p.bitrixSyncedAt) : ''
  };
}

function replaceFarmCardBundle(objectId, body, opts) {
  if (!getObjectById(objectId)) return { ok: false, error: 'Объект не найден' };
  opts = opts || {};
  const prev = getObjectProfile(objectId) || {};
  const b = body && typeof body === 'object' ? body : {};
  const eventsOnlyProfile = opts.eventsOnly ? applyFarmCardEventsOnly(prev, b) : null;
  const profile = eventsOnlyProfile || {
    name: b.name != null ? String(b.name) : prev.name != null ? String(prev.name) : '',
    legalName: b.legalName != null ? String(b.legalName) : prev.legalName != null ? String(prev.legalName) : '',
    notes: b.notes != null ? String(b.notes) : '',
    contacts: Array.isArray(b.contacts) ? b.contacts : [],
    addresses: Array.isArray(b.addresses) ? b.addresses : [],
    addressInfo:
      b.addressInfo && typeof b.addressInfo === 'object'
        ? {
            region: b.addressInfo.region != null ? String(b.addressInfo.region) : '',
            locality: b.addressInfo.locality != null ? String(b.addressInfo.locality) : '',
            address: b.addressInfo.address != null ? String(b.addressInfo.address) : ''
          }
        : { region: '', locality: '', address: '' },
    specialists: Array.isArray(b.specialists) ? b.specialists : [],
    metricDefinitions: Array.isArray(b.metricDefinitions) ? b.metricDefinitions : [],
    metricValues: Array.isArray(b.metricValues) ? b.metricValues : [],
    bullFertility: Array.isArray(b.bullFertility) ? b.bullFertility : [],
    events: Array.isArray(b.events) ? b.events : [],
    workTasks: Array.isArray(b.workTasks)
      ? b.workTasks
      : Array.isArray(prev.workTasks)
        ? prev.workTasks
        : [],
    items: Array.isArray(b.items) ? b.items : [],
    goals: Array.isArray(b.goals) ? b.goals : [],
    // Метаданные Битрикс сохраняем (не затираем с клиента без нужды)
    bitrixCompanyId:
      b.bitrixCompanyId != null && String(b.bitrixCompanyId).trim()
        ? String(b.bitrixCompanyId).trim()
        : prev.bitrixCompanyId != null
          ? String(prev.bitrixCompanyId)
          : '',
    bitrixSyncedAt: prev.bitrixSyncedAt != null ? String(prev.bitrixSyncedAt) : '',
    bitrixSnapshot: prev.bitrixSnapshot && typeof prev.bitrixSnapshot === 'object' ? prev.bitrixSnapshot : null
  };

  let pendingCreated = [];
  if (opts.enqueueBitrix !== false) {
    try {
      const queueDiff = require('../bitrix/queue-diff');
      pendingCreated = queueDiff.enqueueFarmCardDiff(
        objectId,
        prev,
        profile,
        opts.userId || null
      );
    } catch (e) {
      console.warn('bitrix queue diff:', e.message);
    }
  }

  putObjectProfile(objectId, profile);
  return { ok: true, pendingCreated: pendingCreated };
}

function cloneObjectLayers(sourceObjectId, targetObjectId) {
  const profile = getObjectProfile(sourceObjectId);
  if (profile != null) putObjectProfile(targetObjectId, profile);
  const settings = getFarmSettings(sourceObjectId);
  putFarmSettings(targetObjectId, settings);
  const protocols = getProtocols(sourceObjectId);
  for (let i = 0; i < protocols.length; i++) {
    try {
      createProtocol(targetObjectId, protocols[i]);
    } catch (e) {
      console.warn('clone protocol skip:', e.message);
    }
  }
  try {
    const layout = getStallLayout(sourceObjectId);
    if (layout && layout.yards && Object.keys(layout.yards).length > 0) {
      putStallLayout(targetObjectId, layout);
    }
  } catch (e) {
    console.warn('clone stall_layout skip:', e.message);
  }
}

module.exports = {
  getObjectProfile,
  putObjectProfile,
  getFarmSettings,
  putFarmSettings,
  getFarmCardBundle,
  replaceFarmCardBundle,
  cloneObjectLayers,
};
