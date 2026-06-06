/**
 * Per-object data layers: farm profile (card), farm settings, herd (entries + stall).
 * Migration global keys → default object; load on switchToObject.
 */
(function (global) {
  'use strict';

  var PROFILE_PREFIX = 'cattleTracker_farmProfile_';
  var LEGACY_FARM_CARD_PREFIX = 'cattleTracker_farmCard_';
  var TECH_PREFIX = 'cattleTracker_farmTechnicians_';
  var BULLS_PREFIX = 'cattleTracker_farmBulls_';
  var DRUGS_PREFIX = 'cattleTracker_farmDrugs_';
  var VWP_PREFIX = 'cattleTracker_farmVwpDays_';
  var PROTOCOLS_PREFIX = 'cattleTracker_protocols_';
  var STALL_PREFIX = 'cattleTracker_stallLayout_';
  var ENTRIES_PREFIX = 'cattleEntries_';

  var GLOBAL_TECH = 'cattleTracker_farmTechnicians';
  var GLOBAL_BULLS = 'cattleTracker_farmBulls';
  var GLOBAL_DRUGS = 'cattleTracker_farmDrugs';
  var GLOBAL_PROTOCOLS = 'cattleTracker_protocols';

  var _migrationDone = false;

  function getObjectId() {
    if (typeof global.getCurrentObjectId === 'function') return global.getCurrentObjectId() || 'default';
    return 'default';
  }

  function keyFor(prefix, objectId) {
    return prefix + (objectId || 'default');
  }

  function readJson(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  }

  function writeJson(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
      return true;
    } catch (e) {
      console.warn('object-data write', key, e.message);
      return false;
    }
  }

  function removeKeysForObject(objectId) {
    if (!objectId) return;
    var keys = [
      keyFor(PROFILE_PREFIX, objectId),
      keyFor(LEGACY_FARM_CARD_PREFIX, objectId),
      keyFor(TECH_PREFIX, objectId),
      keyFor(BULLS_PREFIX, objectId),
      keyFor(DRUGS_PREFIX, objectId),
      keyFor(PROTOCOLS_PREFIX, objectId),
      keyFor(STALL_PREFIX, objectId),
      keyFor(ENTRIES_PREFIX, objectId)
    ];
    keys.forEach(function (k) {
      try { localStorage.removeItem(k); } catch (e) {}
    });
  }

  function migrateGlobalToDefaultOnce() {
    if (_migrationDone) return;
    _migrationDone = true;
    var defaultId = 'default';
    var targets = [defaultId];
    try {
      var cur = getObjectId();
      if (cur && targets.indexOf(cur) === -1) targets.push(cur);
      var list = typeof global.getObjectsList === 'function' ? global.getObjectsList() : null;
      if (list && list.length === 1 && list[0].id) {
        if (targets.indexOf(list[0].id) === -1) targets.push(list[0].id);
      }
    } catch (e) {}

    function copyIfMissing(globalKey, prefix, normalize) {
      var raw = localStorage.getItem(globalKey);
      if (!raw) return;
      targets.forEach(function (oid) {
        var perKey = keyFor(prefix, oid);
        if (localStorage.getItem(perKey)) return;
        try {
          var val = normalize ? normalize(JSON.parse(raw)) : raw;
          if (normalize) writeJson(perKey, val);
          else localStorage.setItem(perKey, typeof val === 'string' ? val : JSON.stringify(val));
        } catch (e2) {}
      });
    }

    copyIfMissing(GLOBAL_TECH, TECH_PREFIX, function (p) {
      return Array.isArray(p) ? p : [];
    });
    copyIfMissing(GLOBAL_BULLS, BULLS_PREFIX, function (p) {
      return Array.isArray(p) ? p : [];
    });
    copyIfMissing(GLOBAL_DRUGS, DRUGS_PREFIX, function (p) {
      return Array.isArray(p) ? p : [];
    });
    copyIfMissing(GLOBAL_PROTOCOLS, PROTOCOLS_PREFIX, function (p) {
      return Array.isArray(p) ? p : [];
    });

    targets.forEach(function (oid) {
      var profKey = keyFor(PROFILE_PREFIX, oid);
      if (localStorage.getItem(profKey)) return;
      var legacy = localStorage.getItem(keyFor(LEGACY_FARM_CARD_PREFIX, oid));
      if (legacy) {
        try { localStorage.setItem(profKey, legacy); } catch (e3) {}
      }
    });
  }

  function loadFarmProfileLocal(objectId) {
    migrateGlobalToDefaultOnce();
    var p = readJson(keyFor(PROFILE_PREFIX, objectId), null);
    if (p) return p;
    var legacy = readJson(keyFor(LEGACY_FARM_CARD_PREFIX, objectId), null);
    return legacy;
  }

  function saveFarmProfileLocal(objectId, profile) {
    writeJson(keyFor(PROFILE_PREFIX, objectId), profile || {});
    try { localStorage.removeItem(keyFor(LEGACY_FARM_CARD_PREFIX, objectId)); } catch (e) {}
  }

  function normalizeVwpDays(raw) {
    var n = parseInt(raw, 10);
    if (!Number.isFinite(n)) return 60;
    if (n < 30) return 30;
    if (n > 120) return 120;
    return n;
  }

  function loadFarmSettingsLocal(objectId) {
    migrateGlobalToDefaultOnce();
    return {
      technicians: readJson(keyFor(TECH_PREFIX, objectId), []),
      bulls: readJson(keyFor(BULLS_PREFIX, objectId), []),
      drugs: readJson(keyFor(DRUGS_PREFIX, objectId), []),
      vwpDays: normalizeVwpDays(readJson(keyFor(VWP_PREFIX, objectId), 60))
    };
  }

  function saveFarmSettingsLocal(objectId, settings) {
    var s = settings || {};
    writeJson(keyFor(TECH_PREFIX, objectId), Array.isArray(s.technicians) ? s.technicians : []);
    writeJson(keyFor(BULLS_PREFIX, objectId), Array.isArray(s.bulls) ? s.bulls : []);
    writeJson(keyFor(DRUGS_PREFIX, objectId), Array.isArray(s.drugs) ? s.drugs : []);
    writeJson(keyFor(VWP_PREFIX, objectId), normalizeVwpDays(s.vwpDays));
  }

  function loadProtocolsLocal(objectId) {
    migrateGlobalToDefaultOnce();
    var arr = readJson(keyFor(PROTOCOLS_PREFIX, objectId), null);
    return Array.isArray(arr) ? arr : [];
  }

  function saveProtocolsLocal(objectId, protocols) {
    writeJson(keyFor(PROTOCOLS_PREFIX, objectId), Array.isArray(protocols) ? protocols : []);
  }

  function loadStallLayoutLocal(objectId) {
    var lay = readJson(keyFor(STALL_PREFIX, objectId), null);
    if (lay && typeof lay === 'object') return lay;
    return { yards: {} };
  }

  function saveStallLayoutLocal(objectId, layout) {
    writeJson(keyFor(STALL_PREFIX, objectId), layout && typeof layout === 'object' ? layout : { yards: {} });
  }

  function pullFarmProfileFromApi(objectId) {
    if (!global.CATTLE_TRACKER_USE_API || !global.CattleTrackerApi) return Promise.resolve(null);
    var api = global.CattleTrackerApi;
    var p = Promise.resolve(null);
    if (typeof api.getFarmCard === 'function') {
      p = api.getFarmCard(objectId);
    } else if (typeof api.getObjectProfile === 'function') {
      p = api.getObjectProfile(objectId);
    }
    return p.then(function (data) {
      if (data) saveFarmProfileLocal(objectId, data);
      return data;
    }).catch(function () {
      return loadFarmProfileLocal(objectId);
    });
  }

  function pullFarmSettingsFromApi(objectId) {
    if (!global.CATTLE_TRACKER_USE_API || !global.CattleTrackerApi || typeof global.CattleTrackerApi.getFarmSettings !== 'function') {
      return Promise.resolve(loadFarmSettingsLocal(objectId));
    }
    return global.CattleTrackerApi.getFarmSettings(objectId).then(function (data) {
      var s = data && typeof data === 'object' ? data : { technicians: [], bulls: [], drugs: [] };
      saveFarmSettingsLocal(objectId, s);
      return s;
    }).catch(function () {
      return loadFarmSettingsLocal(objectId);
    });
  }

  function pullProtocolsFromApi(objectId) {
    if (!global.CATTLE_TRACKER_USE_API || !global.CattleTrackerApi || typeof global.CattleTrackerApi.getProtocols !== 'function') {
      return Promise.resolve(loadProtocolsLocal(objectId));
    }
    return global.CattleTrackerApi.getProtocols(objectId).then(function (list) {
      var arr = Array.isArray(list) ? list : [];
      saveProtocolsLocal(objectId, arr);
      return arr;
    }).catch(function () {
      return loadProtocolsLocal(objectId);
    });
  }

  function pullStallFromApi(objectId) {
    if (!global.CATTLE_TRACKER_USE_API || !global.CattleTrackerApi || typeof global.CattleTrackerApi.getStallLayout !== 'function') {
      return Promise.resolve(loadStallLayoutLocal(objectId));
    }
    return global.CattleTrackerApi.getStallLayout(objectId).then(function (layout) {
      if (layout) saveStallLayoutLocal(objectId, layout);
      return layout;
    }).catch(function () {
      return loadStallLayoutLocal(objectId);
    });
  }

  /**
   * Load all three layers for objectId (after entries via loadLocally).
   */
  function loadAllObjectLayers(objectId, opts) {
    opts = opts || {};
    var silent = opts.silent === true;
    migrateGlobalToDefaultOnce();
    var oid = objectId || getObjectId();
    var useApi = global.CATTLE_TRACKER_USE_API && global.CattleTrackerApi;
    var pend = useApi && global.CattleTrackerApi.PENDING_OBJECT_ID;
    if (pend && oid === pend) return Promise.resolve({ objectId: oid, skipped: true });

    var chain = Promise.resolve();
    if (useApi) {
      chain = chain
        .then(function () { return pullFarmProfileFromApi(oid); })
        .then(function () { return pullFarmSettingsFromApi(oid); })
        .then(function () { return pullProtocolsFromApi(oid); })
        .then(function () { return pullStallFromApi(oid); });
    } else {
      loadFarmProfileLocal(oid);
      loadFarmSettingsLocal(oid);
      loadProtocolsLocal(oid);
      loadStallLayoutLocal(oid);
    }

    return chain.then(function () {
      var profile = loadFarmProfileLocal(oid);
      var settings = loadFarmSettingsLocal(oid);
      var protocols = loadProtocolsLocal(oid);
      var entries = typeof global.entries !== 'undefined' && Array.isArray(global.entries) ? global.entries : [];
      if (profile && typeof profile === 'object') {
        global.__farmCardBundle = profile;
      }
      if (typeof global.ensureProtocolsLoaded === 'function') {
        try {
          global.ensureProtocolsLoaded(function () {});
        } catch (eProt) {}
      }
      var list = typeof global.getObjectsList === 'function' ? global.getObjectsList() : [];
      var meta = (list || []).filter(function (o) { return o && o.id === oid; })[0];
      var name = (meta && meta.name) ? meta.name : oid;
      if (!silent) {
        var msg = 'Загружено: ' + name + ', ' + entries.length + ' коров, ' + protocols.length + ' протоколов';
        if (typeof global.showToast === 'function') global.showToast(msg, 'info', 3500);
      }
      if (typeof global.CattleTrackerEvents !== 'undefined') {
        global.CattleTrackerEvents.emit('object:switched', { objectId: oid, profile: profile, settings: settings });
        global.CattleTrackerEvents.emit('farm-card:updated', profile);
      }
      return { objectId: oid, profile: profile, settings: settings, protocols: protocols };
    });
  }

  function cloneLocalObjectLayers(sourceId, targetId) {
    var profile = loadFarmProfileLocal(sourceId);
    if (profile) saveFarmProfileLocal(targetId, JSON.parse(JSON.stringify(profile)));
    var settings = loadFarmSettingsLocal(sourceId);
    saveFarmSettingsLocal(targetId, JSON.parse(JSON.stringify(settings)));
    var protocols = loadProtocolsLocal(sourceId);
    saveProtocolsLocal(targetId, JSON.parse(JSON.stringify(protocols)));
    var stall = loadStallLayoutLocal(sourceId);
    saveStallLayoutLocal(targetId, JSON.parse(JSON.stringify(stall)));
    var entriesRaw = localStorage.getItem(keyFor(ENTRIES_PREFIX, sourceId));
    if (entriesRaw) {
      try { localStorage.setItem(keyFor(ENTRIES_PREFIX, targetId), entriesRaw); } catch (e) {}
    }
  }

  var api = {
    PROFILE_PREFIX: PROFILE_PREFIX,
    TECH_PREFIX: TECH_PREFIX,
    BULLS_PREFIX: BULLS_PREFIX,
    DRUGS_PREFIX: DRUGS_PREFIX,
    PROTOCOLS_PREFIX: PROTOCOLS_PREFIX,
    STALL_PREFIX: STALL_PREFIX,
    migrateGlobalToDefaultOnce: migrateGlobalToDefaultOnce,
    loadFarmProfileLocal: loadFarmProfileLocal,
    saveFarmProfileLocal: saveFarmProfileLocal,
    loadFarmSettingsLocal: loadFarmSettingsLocal,
    saveFarmSettingsLocal: saveFarmSettingsLocal,
    loadProtocolsLocal: loadProtocolsLocal,
    saveProtocolsLocal: saveProtocolsLocal,
    loadStallLayoutLocal: loadStallLayoutLocal,
    saveStallLayoutLocal: saveStallLayoutLocal,
    loadAllObjectLayers: loadAllObjectLayers,
    removeKeysForObject: removeKeysForObject,
    cloneLocalObjectLayers: cloneLocalObjectLayers,
    keyFor: keyFor
  };

  global.CattleTrackerObjectData = api;
})(typeof window !== 'undefined' ? window : this);

export {};
