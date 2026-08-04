/** __farmCard part 1 */
(function () {
  'use strict';
  var root = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this);
  var NS = root['__farmCard'] = root['__farmCard'] || {};
  var global = typeof window !== 'undefined' ? window : this;

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function newId(prefix) {
    return prefix + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  function emptyBundle() {
    return {
      contacts: [],
      addresses: [],
      addressInfo: { region: '', locality: '', address: '' },
      specialists: [],
      metricDefinitions: [],
      metricValues: [],
      bullFertility: [],
      events: [],
      items: [],
      goals: [],
      notes: '',
      bitrixCompanyId: '',
      bitrixSyncedAt: ''
    };
  }

  function defaultMetricDefinitions() {
    return [
      { id: 'm_herd_cows', label: 'Количество коров', valueType: 'int', source: 'computed', computedKey: 'herd_cows', sortOrder: 0 },
      { id: 'm_herd_calves', label: 'Количество телят', valueType: 'int', source: 'computed', computedKey: 'herd_calves', sortOrder: 1 },
      { id: 'm_cr_cows_m', label: 'CR % коровы — месяц', valueType: 'percent', source: 'manual', computedKey: '', sortOrder: 10 },
      { id: 'm_hdr_cows_m', label: 'HDR % коровы — месяц', valueType: 'percent', source: 'manual', computedKey: '', sortOrder: 11 },
      { id: 'm_pr_cows_m', label: 'PR % коровы — месяц', valueType: 'percent', source: 'manual', computedKey: '', sortOrder: 12 },
      { id: 'm_cr_cows_y', label: 'CR % коровы — год', valueType: 'percent', source: 'manual', computedKey: '', sortOrder: 13 },
      { id: 'm_hdr_cows_y', label: 'HDR % коровы — год', valueType: 'percent', source: 'manual', computedKey: '', sortOrder: 14 },
      { id: 'm_pr_cows_y', label: 'PR % коровы — год', valueType: 'percent', source: 'manual', computedKey: '', sortOrder: 15 },
      { id: 'm_cr_heif_m', label: 'CR % тёлки — месяц', valueType: 'percent', source: 'manual', computedKey: '', sortOrder: 20 },
      { id: 'm_hdr_heif_m', label: 'HDR % тёлки — месяц', valueType: 'percent', source: 'manual', computedKey: '', sortOrder: 21 },
      { id: 'm_pr_heif_m', label: 'PR % тёлки — месяц', valueType: 'percent', source: 'manual', computedKey: '', sortOrder: 22 },
      { id: 'm_cr_heif_y', label: 'CR % тёлки — год', valueType: 'percent', source: 'manual', computedKey: '', sortOrder: 23 },
      { id: 'm_hdr_heif_y', label: 'HDR % тёлки — год', valueType: 'percent', source: 'manual', computedKey: '', sortOrder: 24 },
      { id: 'm_pr_heif_y', label: 'PR % тёлки — год', valueType: 'percent', source: 'manual', computedKey: '', sortOrder: 25 }
    ];
  }

  function mergeDefaultMetrics(bundle) {
    var b = bundle || emptyBundle();
    if (!Array.isArray(b.metricDefinitions)) b.metricDefinitions = [];
    var defaults = defaultMetricDefinitions();
    if (b.metricDefinitions.length === 0) {
      b.metricDefinitions = defaults;
      return b;
    }
    var have = {};
    b.metricDefinitions.forEach(function (d) {
      if (d && d.id) have[d.id] = true;
    });
    defaults.forEach(function (d) {
      if (!have[d.id]) b.metricDefinitions.push(d);
    });
    return b;
  }

  function normalizeBullFertilityRow(raw, idx) {
    if (!raw || typeof raw !== 'object') return null;
    var bullName = raw.bullName != null ? String(raw.bullName).trim() : '';
    var periodMonth = raw.periodMonth != null ? String(raw.periodMonth).trim() : '';
    if (periodMonth.length > 7) periodMonth = periodMonth.slice(0, 7);
    var crPct = raw.crPct != null && raw.crPct !== '' ? String(raw.crPct).trim() : '';
    var services =
      raw.services != null && raw.services !== ''
        ? String(raw.services).trim()
        : '';
    var pregnant =
      raw.pregnant != null && raw.pregnant !== ''
        ? String(raw.pregnant).trim()
        : '';
    if (!bullName && !periodMonth && !crPct) return null;
    return {
      id: raw.id != null ? String(raw.id) : 'bf_' + idx,
      bullName: bullName,
      periodMonth: periodMonth,
      crPct: crPct,
      services: services,
      pregnant: pregnant
    };
  }

  function readFarmCardCache(objectId) {
    if (!objectId) return null;
    if (window.CattleTrackerObjectData && window.CattleTrackerObjectData.loadFarmProfileLocal) {
      return window.CattleTrackerObjectData.loadFarmProfileLocal(objectId);
    }
    try {
      var raw = localStorage.getItem(globalThis['__farmCard'].state.CACHE_PREFIX + objectId);
      if (!raw) {
        raw = localStorage.getItem('cattleTracker_farmCard_' + objectId);
      }
      if (!raw) return null;
      var p = JSON.parse(raw);
      if (!p || typeof p !== 'object') return null;
      return p;
    } catch (e) {
      return null;
    }
  }

  function writeFarmCardCache(objectId, bundle) {
    if (!objectId) return;
    if (window.CattleTrackerObjectData && window.CattleTrackerObjectData.saveFarmProfileLocal) {
      window.CattleTrackerObjectData.saveFarmProfileLocal(objectId, bundle || emptyBundle());
      return;
    }
    try {
      localStorage.setItem(globalThis['__farmCard'].state.CACHE_PREFIX + objectId, JSON.stringify(bundle || emptyBundle()));
    } catch (e) {
      console.warn('writeFarmCardCache', e.message);
    }
  }

  function getObjectIdForFarm() {
    if (typeof window.getCurrentObjectId !== 'function') return 'default';
    var id = window.getCurrentObjectId();
    var pend = window.CattleTrackerApi && window.CattleTrackerApi.PENDING_OBJECT_ID;
    if (pend && id === pend) return '';
    return id || 'default';
  }

  function farmCardCanEdit() {
    var u = typeof window.getCurrentUser === 'function' ? window.getCurrentUser() : null;
    if (!u) return false;
    if (typeof window.hasCapability === 'function') return window.hasCapability('farmCardSettings', u);
    return u.role === 'admin';
  }

  function normalizeItem(raw, idx) {
    if (!raw || typeof raw !== 'object') return null;
    var type = String(raw.type || 'text');
    if (['text', 'number', 'date', 'image', 'geo'].indexOf(type) === -1) type = 'text';
    var value = raw.value;
    if (type === 'geo' && value && typeof value === 'object') {
      value = {
        lat: value.lat != null ? Number(value.lat) : null,
        lng: value.lng != null ? Number(value.lng) : null,
        label: value.label != null ? String(value.label) : '',
        navUrl: value.navUrl != null ? String(value.navUrl) : ''
      };
    } else if (type === 'number' && value != null && value !== '') {
      var n = Number(value);
      value = isNaN(n) ? value : n;
    } else if (value == null) {
      value = type === 'geo' ? { lat: null, lng: null, label: '', navUrl: '' } : '';
    }
    return {
      id: raw.id != null ? String(raw.id) : 'it_' + idx,
      label: raw.label != null ? String(raw.label) : '',
      type: type,
      value: value,
      updatedAt: raw.updatedAt != null ? String(raw.updatedAt) : '',
      sortOrder: raw.sortOrder != null ? Number(raw.sortOrder) || idx : idx,
      objectId: raw.objectId != null ? String(raw.objectId) : ''
    };
  }

  function normalizeGoal(raw, idx) {
    if (!raw || typeof raw !== 'object') return null;
    var status = String(raw.status || 'open');
    if (['open', 'done', 'overdue'].indexOf(status) === -1) status = 'open';
    return {
      id: raw.id != null ? String(raw.id) : 'g_' + idx,
      title: raw.title != null ? String(raw.title) : '',
      deadline: raw.deadline != null ? String(raw.deadline) : '',
      status: status,
      linkedItemIds: Array.isArray(raw.linkedItemIds) ? raw.linkedItemIds.map(String) : [],
      notes: raw.notes != null ? String(raw.notes) : ''
    };
  }

  function normalizeEvent(raw, idx) {
    if (!raw || typeof raw !== 'object') return null;
    var title =
      raw.title != null
        ? String(raw.title)
        : raw.name != null
          ? String(raw.name)
          : '';
    var attachments = Array.isArray(raw.attachments)
      ? raw.attachments
          .map(function (a, i) {
            if (!a || typeof a !== 'object') return null;
            var dataUrl = a.dataUrl != null ? String(a.dataUrl) : a.data != null ? String(a.data) : '';
            var name = a.name != null ? String(a.name) : 'файл';
            if (!dataUrl) return null;
            return {
              id: a.id != null ? String(a.id) : 'att_' + idx + '_' + i,
              name: name,
              mime: a.mime != null ? String(a.mime) : '',
              size: a.size != null ? Number(a.size) || 0 : 0,
              dataUrl: dataUrl
            };
          })
          .filter(Boolean)
      : [];
    var type = raw.eventType != null ? String(raw.eventType) : 'shtab';
    if (['shtab', 'audit', 'otbor_go'].indexOf(type) === -1) {
      // старые типы оставляем для отображения
    }
    return {
      id: raw.id != null ? String(raw.id) : 'ev_' + idx,
      eventType: type,
      eventDate: raw.eventDate != null ? String(raw.eventDate) : '',
      title: title,
      participants: raw.participants != null ? String(raw.participants) : '',
      description: raw.description != null ? String(raw.description) : '',
      task: raw.task != null ? String(raw.task) : '',
      goal: raw.goal != null ? String(raw.goal) : '',
      reminderAt: raw.reminderAt != null ? String(raw.reminderAt) : '',
      completed: !!raw.completed,
      notifyLocal: raw.notifyLocal !== false,
      attachments: attachments
    };
  }

  function refreshGoalStatuses(goals) {
    var today = new Date().toISOString().slice(0, 10);
    return (goals || []).map(function (g) {
      if (!g || g.status === 'done') return g;
      if (g.deadline && String(g.deadline) < today) {
        return Object.assign({}, g, { status: 'overdue' });
      }
      if (g.status === 'overdue' && (!g.deadline || String(g.deadline) >= today)) {
        return Object.assign({}, g, { status: 'open' });
      }
      return g;
    });
  }

  function normalizeAddressInfo(raw) {
    var info = raw && raw.addressInfo && typeof raw.addressInfo === 'object' ? raw.addressInfo : null;
    var region = info && info.region != null ? String(info.region).trim() : '';
    var locality = info && info.locality != null ? String(info.locality).trim() : '';
    var address = info && info.address != null ? String(info.address).trim() : '';
    if (!region && !locality && !address && Array.isArray(raw && raw.addresses)) {
      for (var i = 0; i < raw.addresses.length; i++) {
        var a = raw.addresses[i];
        if (!a) continue;
        var legacyLine =
          (a.address && String(a.address).trim()) ||
          [a.street, a.house].filter(Boolean).join(', ');
        if (a.region || a.locality || legacyLine) {
          region = region || (a.region ? String(a.region).trim() : '');
          locality = locality || (a.locality ? String(a.locality).trim() : '');
          address = address || legacyLine;
          break;
        }
      }
    }
    return { region: region, locality: locality, address: address };
  }

  function normalizeGeopositions(raw) {
    var list = Array.isArray(raw && raw.addresses) ? raw.addresses : [];
    return list
      .map(function (a, idx) {
        if (!a || typeof a !== 'object') return null;
        var name = a.name != null ? String(a.name).trim() : '';
        var navUrl = a.navUrl != null ? String(a.navUrl).trim() : '';
        if (!navUrl && a.lat != null && a.lng != null && !isNaN(Number(a.lat)) && !isNaN(Number(a.lng))) {
          navUrl = 'https://yandex.ru/maps/?rtext=~' + a.lat + ',' + a.lng;
        }
        if (!name && !navUrl) return null;
        return {
          id: a.id || newId('geo_'),
          name: name,
          navUrl: navUrl,
          sortOrder: a.sortOrder != null ? a.sortOrder : idx
        };
      })
      .filter(Boolean);
  }

  function normalizeBundle(raw) {
    var b = emptyBundle();
    if (!raw || typeof raw !== 'object') return mergeDefaultMetrics(b);
    b.contacts = Array.isArray(raw.contacts) ? raw.contacts : [];
    b.addressInfo = normalizeAddressInfo(raw);
    b.addresses = normalizeGeopositions(raw);
    b.specialists = Array.isArray(raw.specialists)
      ? raw.specialists.map(function (s) {
          if (!s || typeof s !== 'object') return s;
          var phones = specialistPhones(s);
          return Object.assign({}, s, {
            phones: phones,
            phone: phones[0] || (s.phone != null ? String(s.phone) : '')
          });
        })
      : [];
    if (!b.specialists.length) b.specialists = [];
    b.notes = raw.notes != null ? String(raw.notes) : '';
    b.name = raw.name != null ? String(raw.name) : '';
    b.legalName = raw.legalName != null ? String(raw.legalName) : '';
    b.metricDefinitions = Array.isArray(raw.metricDefinitions) ? raw.metricDefinitions : [];
    b.metricValues = Array.isArray(raw.metricValues) ? raw.metricValues : [];
    b.bullFertility = (Array.isArray(raw.bullFertility) ? raw.bullFertility : [])
      .map(normalizeBullFertilityRow)
      .filter(Boolean);
    b.events = (Array.isArray(raw.events) ? raw.events : [])
      .map(normalizeEvent)
      .filter(Boolean);
    b.items = (Array.isArray(raw.items) ? raw.items : [])
      .map(normalizeItem)
      .filter(Boolean);
    b.goals = refreshGoalStatuses(
      (Array.isArray(raw.goals) ? raw.goals : []).map(normalizeGoal).filter(Boolean)
    );
    b.bitrixCompanyId = raw.bitrixCompanyId != null ? String(raw.bitrixCompanyId) : '';
    b.bitrixSyncedAt = raw.bitrixSyncedAt != null ? String(raw.bitrixSyncedAt) : '';
    return mergeDefaultMetrics(b);
  }

  /** Активные коровы: нет даты выбытия. */
  function countHerdCows(entries) {
    var n = 0;
    (entries || []).forEach(function (e) {
      if (!e) return;
      var ex = e.exitDate != null ? String(e.exitDate).trim() : '';
      if (!ex) n++;
    });
    return n;
  }

  /** Телята: лактация 0. */
  function countCalves(entries) {
    var n = 0;
    (entries || []).forEach(function (e) {
      if (!e) return;
      var l = e.lactation;
      if (l === 0 || l === '0') n++;
    });
    return n;
  }

  function computeFromEntries(entries) {
    var out = {
      herd_cows: String(countHerdCows(entries)),
      herd_calves: String(countCalves(entries)),
      cr_pct: '',
      hdr_pct: '',
      pr_pct: ''
    };
    if (typeof window.generateReport === 'function') {
      try {
        var rep = window.generateReport('year', '', '', 60, entries || []);
        if (rep) {
          out.cr_pct = rep.cr != null ? String(rep.cr) : '';
          out.hdr_pct = rep.hdr != null ? String(rep.hdr) : '';
          out.pr_pct = rep.pr != null ? String(rep.pr) : '';
        }
      } catch (e) {}
    }
    return out;
  }

  function getFarmCardBundleForExport() {
    var b = typeof window !== 'undefined' && window.__farmCardBundle ? window.__farmCardBundle : null;
    if (b) return JSON.parse(JSON.stringify(b));
    var oid = getObjectIdForFarm();
    if (!oid) return emptyBundle();
    if (window.CATTLE_TRACKER_USE_API && window.CattleTrackerApi) {
      var c = readFarmCardCache(oid);
      return c ? normalizeBundle(c) : emptyBundle();
    }
    return normalizeBundle(readFarmCardCache(oid));
  }

  function isFarmCardLoadCurrent(myGen, oid) {
    if (myGen !== globalThis['__farmCard'].state._farmGen) return false;
    var cur = typeof getCurrentObjectId === 'function' ? getCurrentObjectId() : oid;
    return !oid || cur === oid;
  }

  function ensureFarmCardLoaded() {
    var myGen = ++globalThis['__farmCard'].state._farmGen;
    var oid = getObjectIdForFarm();
    if (!oid) {
      window.__farmCardBundle = emptyBundle();
      clearFarmCardDirty();
      return Promise.resolve(window.__farmCardBundle);
    }
    if (window.CATTLE_TRACKER_USE_API && window.CattleTrackerApi && typeof window.CattleTrackerApi.getFarmCard === 'function') {
      return window.CattleTrackerApi.getFarmCard(oid).then(function (data) {
        if (!isFarmCardLoadCurrent(myGen, oid)) return window.__farmCardBundle || emptyBundle();
        var localBefore = readFarmCardCache(oid);
        var b = normalizeBundle(data);
        // Пока сервер без bullFertility — не затираем локально сохранённые CR по быкам
        if (
          localBefore &&
          Array.isArray(localBefore.bullFertility) &&
          localBefore.bullFertility.length &&
          (!b.bullFertility || !b.bullFertility.length)
        ) {
          b.bullFertility = localBefore.bullFertility.slice();
        }
        window.__farmCardBundle = b;
        writeFarmCardCache(oid, b);
        clearFarmCardDirty();
        if (typeof window.CattleTrackerEvents !== 'undefined') {
          window.CattleTrackerEvents.emit('farm-card:updated', b);
        }
        return b;
      }).catch(function () {
        if (!isFarmCardLoadCurrent(myGen, oid)) return window.__farmCardBundle || emptyBundle();
        var fallback = readFarmCardCache(oid);
        window.__farmCardBundle = normalizeBundle(fallback || emptyBundle());
        clearFarmCardDirty();
        return window.__farmCardBundle;
      });
    }
    var local = readFarmCardCache(oid);
    window.__farmCardBundle = normalizeBundle(local || emptyBundle());
    clearFarmCardDirty();
    if (typeof window.CattleTrackerEvents !== 'undefined') {
      window.CattleTrackerEvents.emit('farm-card:updated', window.__farmCardBundle);
    }
    return Promise.resolve(window.__farmCardBundle);
  }

  function saveFarmCardBundle(bundle) {
    var oid = getObjectIdForFarm();
    if (!oid) return Promise.reject(new Error('База не выбрана'));
    var b = normalizeBundle(bundle);
    window.__farmCardBundle = b;
    writeFarmCardCache(oid, b);
    var hasServerToken =
      window.CattleTrackerApi &&
      typeof window.CattleTrackerApi.getToken === 'function' &&
      !!window.CattleTrackerApi.getToken();
    var canSyncApi =
      window.CATTLE_TRACKER_USE_API &&
      hasServerToken &&
      window.CattleTrackerApi &&
      typeof window.CattleTrackerApi.putFarmCard === 'function';
    if (canSyncApi) {
      var sentBullFertility = (b.bullFertility || []).slice();
      var sentMetricValues = (b.metricValues || []).slice();
      return window.CattleTrackerApi.putFarmCard(oid, b).then(function (data) {
        var merged = normalizeBundle(data);
        // Клиент — источник правды для bullFertility (добавление и удаление),
        // пока ответ сервера может быть без поля или устаревшим.
        merged.bullFertility = Array.isArray(sentBullFertility) ? sentBullFertility.slice() : [];
        if (
          sentMetricValues.length &&
          (!Array.isArray(merged.metricValues) || merged.metricValues.length === 0) &&
          sentMetricValues.length >
            (Array.isArray(data && data.metricValues) ? data.metricValues.length : 0)
        ) {
          merged.metricValues = sentMetricValues;
        }
        if (data && data._bitrixPendingCreated) {
          merged._bitrixPendingCreated = data._bitrixPendingCreated;
        }
        window.__farmCardBundle = merged;
        writeFarmCardCache(oid, window.__farmCardBundle);
        clearFarmCardDirty();
        if (typeof window.CattleTrackerEvents !== 'undefined') {
          window.CattleTrackerEvents.emit('farm-card:updated', window.__farmCardBundle);
          window.CattleTrackerEvents.emit('farm-goal:changed', window.__farmCardBundle.goals || []);
        }
        return window.__farmCardBundle;
      });
    }
    clearFarmCardDirty();
    if (typeof window.CattleTrackerEvents !== 'undefined') {
      window.CattleTrackerEvents.emit('farm-card:updated', b);
      window.CattleTrackerEvents.emit('farm-goal:changed', b.goals || []);
    }
    return Promise.resolve(b);
  }

  function currentMetricSnapshot(values, metricId) {
    var list = (values || [])
      .filter(function (v) {
        return v && v.metricId === metricId;
      })
      .sort(function (a, b) {
        return String(a.valueDate).localeCompare(String(b.valueDate));
      });
    var today = new Date().toISOString().slice(0, 10);
    var best = null;
    for (var i = 0; i < list.length; i++) {
      if (String(list[i].valueDate) <= today) best = list[i];
    }
    if (best) return best;
    return list.length ? list[list.length - 1] : null;
  }

  var REPRO_MONTH_METRIC_IDS = {
    cows_cr: 'm_cr_cows_m',
    cows_hdr: 'm_hdr_cows_m',
    cows_pr: 'm_pr_cows_m',
    heif_cr: 'm_cr_heif_m',
    heif_hdr: 'm_hdr_heif_m',
    heif_pr: 'm_pr_heif_m'
  };
  var REPRO_YEAR_METRIC_IDS = {
    cows_cr: 'm_cr_cows_y',
    cows_hdr: 'm_hdr_cows_y',
    cows_pr: 'm_pr_cows_y',
    heif_cr: 'm_cr_heif_y',
    heif_hdr: 'm_hdr_heif_y',
    heif_pr: 'm_pr_heif_y'
  };

  function toYearMonth(dateOrMonth) {
    var s = String(dateOrMonth || '').trim();
    if (/^\d{4}-\d{2}$/.test(s)) return s;
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 7);
    return '';
  }

  function formatYearMonthRu(ym) {
    if (!ym || ym.length < 7) return ym || '—';
    return ym.slice(5, 7) + '.' + ym.slice(0, 4);
  }

  function getMetricTextForMonth(values, metricId, ym) {
    if (!ym || !metricId) return '';
    var list = values || [];
    var exact = ym + '-01';
    var found = '';
    for (var i = 0; i < list.length; i++) {
      var v = list[i];
      if (!v || v.metricId !== metricId) continue;
      var vYm = toYearMonth(v.valueDate);
      if (vYm === ym || String(v.valueDate) === exact) found = v.valueText != null ? String(v.valueText) : '';
    }
    return found;
  }

  function upsertMetricForMonth(values, metricId, ym, text) {
    if (!Array.isArray(values) || !metricId || !ym) return;
    var d = ym + '-01';
    var t = text != null ? String(text).trim() : '';
    for (var i = 0; i < values.length; i++) {
      if (values[i].metricId === metricId && toYearMonth(values[i].valueDate) === ym) {
        if (t === '') {
          values.splice(i, 1);
        } else {
          values[i].valueText = t;
          values[i].valueDate = d;
          values[i].source = 'manual';
        }
        return;
      }
    }
    if (t !== '') {
      values.push({ id: null, metricId: metricId, valueDate: d, valueText: t, source: 'manual' });
    }
  }

  function collectReproMonths(values) {
    var set = {};
    var ids = REPRO_MONTH_METRIC_IDS;
    var idList = [ids.cows_cr, ids.cows_hdr, ids.cows_pr, ids.heif_cr, ids.heif_hdr, ids.heif_pr];
    (values || []).forEach(function (v) {
      if (!v || idList.indexOf(v.metricId) === -1) return;
      var ym = toYearMonth(v.valueDate);
      if (ym) set[ym] = true;
    });
    return Object.keys(set).sort().reverse();
  }

  function collectBullNames(bullFertility) {
    var names = [];
    var seen = {};
    (bullFertility || []).forEach(function (r) {
      var n = r && r.bullName != null ? String(r.bullName).trim() : '';
      if (!n || seen[n]) return;
      seen[n] = true;
      names.push(n);
    });
    names.sort(function (a, c) {
      return a.localeCompare(c, 'ru');
    });
    return names;
  }

  function collectBullMonths(bullFertility) {
    var set = {};
    (bullFertility || []).forEach(function (r) {
      var ym = toYearMonth(r && r.periodMonth);
      if (ym) set[ym] = true;
    });
    return Object.keys(set).sort().reverse();
  }

  function getBullCr(bullFertility, ym, bullName) {
    var list = bullFertility || [];
    for (var i = 0; i < list.length; i++) {
      var r = list[i];
      if (!r) continue;
      if (toYearMonth(r.periodMonth) === ym && String(r.bullName || '').trim() === bullName) {
        return r.crPct != null && r.crPct !== '' ? String(r.crPct) : '';
      }
    }
    return '';
  }

  function upsertBullCr(bullFertility, ym, bullName, crPct) {
    if (!Array.isArray(bullFertility) || !ym || !bullName) return;
    var name = String(bullName).trim();
    var cr = crPct != null ? String(crPct).trim() : '';
    for (var i = 0; i < bullFertility.length; i++) {
      var r = bullFertility[i];
      if (r && toYearMonth(r.periodMonth) === ym && String(r.bullName || '').trim() === name) {
        if (cr === '') {
          bullFertility.splice(i, 1);
        } else {
          r.crPct = cr;
          r.periodMonth = ym;
        }
        return;
      }
    }
    if (cr !== '') {
      bullFertility.push({
        id: newId('bf_'),
        bullName: name,
        periodMonth: ym,
        crPct: cr,
        services: '',
        pregnant: ''
      });
    }
  }

  function removeBullAll(bullFertility, bullName) {
    if (!Array.isArray(bullFertility) || !bullName) return;
    var name = String(bullName).trim();
    for (var i = bullFertility.length - 1; i >= 0; i--) {
      var r = bullFertility[i];
      if (r && String(r.bullName || '').trim() === name) bullFertility.splice(i, 1);
    }
  }

  function removeBullMonth(bullFertility, ym) {
    if (!Array.isArray(bullFertility) || !ym) return;
    for (var i = bullFertility.length - 1; i >= 0; i--) {
      var r = bullFertility[i];
      if (r && toYearMonth(r.periodMonth) === ym) bullFertility.splice(i, 1);
    }
  }

  function cellDisplay(text) {
    return text !== '' && text != null ? escapeHtml(String(text)) : '—';
  }

  function persistBullFertilityChange(okMessage) {
    markFarmCardDirty();
    var oid = getObjectIdForFarm();
    if (oid) writeFarmCardCache(oid, window.__farmCardBundle);
    var status = document.getElementById('farmCardSaveStatus');
    if (status) status.textContent = 'Сохранение…';
    return saveFarmCardBundle(window.__farmCardBundle)
      .then(function () {
        if (status) status.textContent = 'Сохранено';
        if (okMessage && typeof showToast === 'function') showToast(okMessage, 'success');
        renderFarmCardPanel();
      })
      .catch(function (e) {
        if (status) status.textContent = 'Ошибка';
        if (typeof showToast === 'function') {
          showToast((e && e.message) || 'Ошибка сохранения', 'error');
        }
        renderFarmCardPanel();
      });
  }

  var FARM_CARD_TABS = ['addresses', 'specialists', 'goals', 'timeline', 'metrics', 'dynamics'];
  var _activeTab = 'addresses';
  /** Индекс геопозиции в форме (−1 — новая). */
  var _addrEditIdx = -1;
  /** Индекс специалиста в форме (−1 — новый). */
  var _specEditIdx = -1;
  /** Форма добавления события под таблицей открыта. */
  var _timelineFormOpen = false;
  /** Черновик вложений для новой записи ленты. */
  var _timelineDraftAttachments = [];
  /** Черновик полей формы ленты (чтобы не сбрасывать при перерисовке). */
  var _timelineDraftFields = {
    date: '',
    type: 'shtab',
    title: '',
    description: '',
    partExtra: '',
    partLabels: []
  };
  /** Раскрытые clamp-ячейки ленты: { [evId]: { desc: bool, part: bool } }. */
  var _timelineExpanded = {};
  /** Есть несохранённые правки карточки хозяйства. */
  var _farmCardDirty = false;

  function markFarmCardDirty() {
    _farmCardDirty = true;
  }

  function clearFarmCardDirty() {
    _farmCardDirty = false;
  }

  function farmCardHasUnsavedChanges() {
    if (!farmCardCanEdit()) return false;
    if (_farmCardDirty) return true;
    if (_timelineFormOpen) {
      captureTimelineDraftFields();
      var f = _timelineDraftFields || {};
      if (
        (f.title && String(f.title).trim()) ||
        (f.description && String(f.description).trim()) ||
        (f.partExtra && String(f.partExtra).trim()) ||
        (f.partLabels && f.partLabels.length) ||
        (_timelineDraftAttachments && _timelineDraftAttachments.length)
      ) {
        return true;
      }
    }
    var geo = readGeoFormFields();
    if (_addrEditIdx >= 0) {
      var addrs = (window.__farmCardBundle && window.__farmCardBundle.addresses) || [];
      var a = addrs[_addrEditIdx];
      if (a) {
        if (
          geo.name !== String(a.name || '').trim() ||
          geo.navUrl !== String(a.navUrl || '').trim()
        ) {
          return true;
        }
      } else if (geo.name || geo.navUrl) {
        return true;
      }
    } else if (geo.name || geo.navUrl) {
      return true;
    }
    var role = ((document.getElementById('farmCardNewSpecRole') || {}).value || '').trim();
    var specName = ((document.getElementById('farmCardNewSpecName') || {}).value || '').trim();
    var phone = ((document.getElementById('farmCardNewSpecPhone') || {}).value || '').trim();
    var email = ((document.getElementById('farmCardNewSpecEmail') || {}).value || '').trim();
    var geoId = ((document.getElementById('farmCardNewSpecGeo') || {}).value || '').trim();
    if (_specEditIdx >= 0) {
      var specs = (window.__farmCardBundle && window.__farmCardBundle.specialists) || [];
      var s = specs[_specEditIdx];
      if (s) {
        var phonesJoined = specialistPhones(s).join(', ');
        if (
          role !== String(s.role || '').trim() ||
          specName !== String(s.name || '').trim() ||
          phone !== phonesJoined ||
          email !== String(s.email || '').trim() ||
          geoId !== String(s.geoId || '').trim()
        ) {
          return true;
        }
      } else if (role || specName || phone || email) {
        return true;
      }
    } else if (role || specName || phone || email) {
      return true;
    }
    var regionEl = document.getElementById('farmCardAddrRegion');
    if (regionEl) {
      var info = (window.__farmCardBundle && window.__farmCardBundle.addressInfo) || {};
      if (
        (regionEl.value || '').trim() !== String(info.region || '').trim() ||
        ((document.getElementById('farmCardAddrLocality') || {}).value || '').trim() !==
          String(info.locality || '').trim() ||
        ((document.getElementById('farmCardAddrLine') || {}).value || '').trim() !==
          String(info.address || '').trim()
      ) {
        return true;
      }
    }
    return false;
  }

  function confirmLeaveFarmCardIfNeeded() {
    if (!farmCardHasUnsavedChanges()) return Promise.resolve(true);
    var msg =
      'В карточке хозяйства есть несохранённые изменения. Уйти без сохранения? Данные будут потеряны.';
    function discardUnsavedFarmCard() {
      _timelineFormOpen = false;
      if (typeof clearTimelineDraft === 'function') clearTimelineDraft();
      _timelineDraftAttachments = [];
      _addrEditIdx = -1;
      _specEditIdx = -1;
      var oid = getObjectIdForFarm();
      if (oid) {
        window.__farmCardBundle = normalizeBundle(readFarmCardCache(oid) || emptyBundle());
      }
      clearFarmCardDirty();
    }
    if (typeof showConfirmModal === 'function') {
      return showConfirmModal(msg, {
        confirmText: 'Уйти',
        cancelText: 'Остаться'
      }).then(function (ok) {
        if (ok) discardUnsavedFarmCard();
        return !!ok;
      });
    }
    var ok = !!window.confirm(msg);
    if (ok) discardUnsavedFarmCard();
    return Promise.resolve(ok);
  }

  function bindFarmCardDirtyTracking(root) {
    if (!root || root._farmCardDirtyBound) return;
    root._farmCardDirtyBound = true;
    function onDirtyEvent(e) {
      var t = e && e.target;
      if (!t) return;
      if (t.closest && t.closest('#farmCardEvAddForm')) return;
      var id = t.id || '';
      if (
        id === 'farmCardObjectSelect' ||
        id === 'farmCardGeoName' ||
        id === 'farmCardGeoNav' ||
        id.indexOf('farmCardNewSpec') === 0
      ) {
        return;
      }
      markFarmCardDirty();
    }
    root.addEventListener('input', onDirtyEvent, true);
    root.addEventListener('change', onDirtyEvent, true);
  }

  var EV_TYPE_LABELS = {
    shtab: 'Штаб',
    audit: 'Аудит',
    otbor_go: 'Отбор ГО',
    visit: 'Посещение',
    work: 'Работа',
    plan: 'План развития',
    info: 'Информация'
  };

  var EV_FILE_MAX_BYTES = 1.5 * 1024 * 1024;
  var EV_FILE_MAX_COUNT = 8;
  var EV_FILE_ACCEPT =
    'image/*,.doc,.docx,.xls,.xlsx,.csv,.pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/pdf';

  function specialistParticipantLabel(s) {
    if (!s || typeof s !== 'object') return '';
    var role = s.role != null ? String(s.role).trim() : '';
    var name = s.name != null ? String(s.name).trim() : '';
    if (role && name) return role + ' — ' + name;
    return name || role || '';
  }

  function formatFileSize(bytes) {
    var n = Number(bytes) || 0;
    if (n < 1024) return n + ' Б';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' КБ';
    return (n / (1024 * 1024)).toFixed(1) + ' МБ';
  }

  function isAllowedEventFile(file) {
    if (!file) return false;
    var name = String(file.name || '').toLowerCase();
    var mime = String(file.type || '').toLowerCase();
    if (mime.indexOf('image/') === 0) return true;
    if (/\.(doc|docx|xls|xlsx|csv|pdf)$/.test(name)) return true;
    if (
      mime === 'application/pdf' ||
      mime === 'application/msword' ||
      mime.indexOf('officedocument') !== -1 ||
      mime.indexOf('excel') !== -1 ||
      mime === 'text/csv'
    ) {
      return true;
    }
    return false;
  }

  function readFileAsDataUrl(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onerror = function () {
        reject(new Error('Не удалось прочитать файл'));
      };
      reader.onload = function () {
        resolve(String(reader.result || ''));
      };
      reader.readAsDataURL(file);
    });
  }

  function loadEventAttachmentFile(file) {
    if (!isAllowedEventFile(file)) {
      return Promise.reject(new Error('Допустимы: картинки, Word, Excel/CSV, PDF'));
    }
    if (file.type && file.type.indexOf('image/') === 0) {
      var compress =
        globalThis['__farmCard'] && typeof globalThis['__farmCard'].compressImageFile === 'function'
          ? globalThis['__farmCard'].compressImageFile
          : null;
      if (compress) {
        return compress(file).then(function (dataUrl) {
          return {
            id: newId('att_'),
            name: file.name || 'изображение.jpg',
            mime: 'image/jpeg',
            size: Math.round((dataUrl.length * 3) / 4),
            dataUrl: dataUrl
          };
        });
      }
    }
    if (file.size > EV_FILE_MAX_BYTES) {
      return Promise.reject(
        new Error('Файл «' + (file.name || '') + '» больше ' + formatFileSize(EV_FILE_MAX_BYTES))
      );
    }
    return readFileAsDataUrl(file).then(function (dataUrl) {
      return {
        id: newId('att_'),
        name: file.name || 'файл',
        mime: file.type || '',
        size: file.size || 0,
        dataUrl: dataUrl
      };
    });
  }

  function openEventAttachment(att) {
    if (!att || !att.dataUrl) return;
    var mime = String(att.mime || '');
    var name = att.name || 'файл';
    try {
      if (mime.indexOf('image/') === 0) {
        var w = window.open('', '_blank');
        if (w) {
          w.document.write(
            '<!doctype html><title>' +
              escapeHtml(name) +
              '</title><body style="margin:0;background:#111;display:flex;justify-content:center;align-items:center;min-height:100vh"><img src="' +
              att.dataUrl.replace(/"/g, '&quot;') +
              '" alt="' +
              escapeHtml(name) +
              '" style="max-width:100%;max-height:100vh;object-fit:contain"/></body>'
          );
          w.document.close();
          return;
        }
      }
      var a = document.createElement('a');
      a.href = att.dataUrl;
      a.download = name;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e) {
      if (typeof showToast === 'function') showToast('Не удалось открыть файл', 'error');
    }
  }

  function eventAttachmentsCellHtml(attachments) {
    var list = Array.isArray(attachments) ? attachments : [];
    if (!list.length) return '—';
    return list
      .map(function (att, i) {
        return (
          '<button type="button" class="link-btn farm-card-ev-att-open" data-att-idx="' +
          i +
          '" title="' +
          escapeHtml(att.name || 'файл') +
          '">' +
          escapeHtml(att.name || 'файл') +
          '</button>'
        );
      })
      .join('<br/>');
  }

  function draftAttachmentsListHtml() {
    if (!_timelineDraftAttachments.length) {
      return '<p class="farm-settings-hint farm-card-ev-att-empty">Файлы не выбраны</p>';
    }
    return (
      '<ul class="farm-card-ev-att-list">' +
      _timelineDraftAttachments
        .map(function (att, idx) {
          return (
            '<li><button type="button" class="link-btn farm-card-ev-draft-att-open" data-draft-idx="' +
            idx +
            '">' +
            escapeHtml(att.name || 'файл') +
            '</button>' +
            ' <span class="farm-settings-hint">(' +
            escapeHtml(formatFileSize(att.size)) +
            ')</span> ' +
            '<button type="button" class="small-btn farm-card-ev-draft-att-del" data-draft-idx="' +
            idx +
            '">Убрать</button></li>'
          );
        })
        .join('') +
      '</ul>'
    );
  }

  function timelineTextNeedsClamp(text) {
    var t = String(text || '').trim();
    if (!t || t === '—') return false;
    if (t.indexOf('\n') !== -1) return true;
    return t.length > 120;
  }

  function timelineClampCellHtml(evId, kind, text) {
    var raw = text && String(text).trim() ? String(text).trim() : '—';
    var exp = _timelineExpanded[evId] || {};
    var isOpen = !!exp[kind];
    var needs = timelineTextNeedsClamp(raw);
    var clampClass = 'farm-card-ev-clamp' + (isOpen ? ' farm-card-ev-clamp--open' : '');
    var html =
      '<div class="' +
      clampClass +
      '" data-ev-clamp="' +
      escapeHtml(kind) +
      '">' +
      escapeHtml(raw) +
      '</div>';
    if (needs) {
      html +=
        '<button type="button" class="farm-card-ev-more" data-ev-id="' +
        escapeHtml(evId) +
        '" data-clamp="' +
        escapeHtml(kind) +
        '">' +
        (isOpen ? 'Свернуть' : 'Ещё') +
        '</button>';
    }
    return html;
  }

  function collectEventParticipantsFromForm() {
    var parts = [];
    document.querySelectorAll('.farm-card-ev-part-cb:checked').forEach(function (cb) {
      var v = String(cb.value || '').trim();
      if (v) parts.push(v);
    });
    var extra = ((document.getElementById('farmCardNewEvPartExtra') || {}).value || '').trim();
    if (extra) {
      extra.split(/[,;]/).forEach(function (s) {
        s = String(s || '').trim();
        if (s) parts.push(s);
      });
    }
    return parts.join(', ');
  }

  function captureTimelineDraftFields() {
    if (!_timelineFormOpen) return;
    var form = document.getElementById('farmCardEvAddForm');
    if (!form || form.style.display === 'none') return;
    var dateEl = document.getElementById('farmCardNewEvDate');
    var typeEl = document.getElementById('farmCardNewEvType');
    var titleEl = document.getElementById('farmCardNewEvTitle');
    var descEl = document.getElementById('farmCardNewEvDesc');
    var extraEl = document.getElementById('farmCardNewEvPartExtra');
    if (dateEl) _timelineDraftFields.date = dateEl.value || '';
    if (typeEl) _timelineDraftFields.type = typeEl.value || 'shtab';
    if (titleEl) _timelineDraftFields.title = titleEl.value || '';
    if (descEl) _timelineDraftFields.description = descEl.value || '';
    if (extraEl) _timelineDraftFields.partExtra = extraEl.value || '';
    var labels = [];
    document.querySelectorAll('.farm-card-ev-part-cb:checked').forEach(function (cb) {
      var v = String(cb.value || '').trim();
      if (v) labels.push(v);
    });
    _timelineDraftFields.partLabels = labels;
  }

  function applyTimelineDraftFields() {
    if (!_timelineFormOpen) return;
    var dateEl = document.getElementById('farmCardNewEvDate');
    var typeEl = document.getElementById('farmCardNewEvType');
    var titleEl = document.getElementById('farmCardNewEvTitle');
    var descEl = document.getElementById('farmCardNewEvDesc');
    var extraEl = document.getElementById('farmCardNewEvPartExtra');
    var today = new Date().toISOString().slice(0, 10);
    if (dateEl) dateEl.value = _timelineDraftFields.date || today;
    if (typeEl) typeEl.value = _timelineDraftFields.type || 'shtab';
    if (titleEl) titleEl.value = _timelineDraftFields.title || '';
    if (descEl) descEl.value = _timelineDraftFields.description || '';
    if (extraEl) extraEl.value = _timelineDraftFields.partExtra || '';
    var set = {};
    (_timelineDraftFields.partLabels || []).forEach(function (l) {
      set[l] = true;
    });
    document.querySelectorAll('.farm-card-ev-part-cb').forEach(function (cb) {
      cb.checked = !!set[String(cb.value || '').trim()];
    });
  }

  function clearTimelineDraft() {
    _timelineDraftAttachments = [];
    _timelineDraftFields = {
      date: '',
      type: 'shtab',
      title: '',
      description: '',
      partExtra: '',
      partLabels: []
    };
  }

  function bindEvDescAutosize() {
    var ta = document.getElementById('farmCardNewEvDesc');
    if (!ta || ta.dataset.autosizeBound === '1') return;
    ta.dataset.autosizeBound = '1';
    function fit() {
      ta.style.height = 'auto';
      ta.style.height = Math.max(56, ta.scrollHeight) + 'px';
    }
    ta.addEventListener('input', fit);
    fit();
  }

  function geoLabelById(addresses, geoId) {
    var id = String(geoId || '').trim();
    if (!id) return '';
    var list = addresses || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i] && String(list[i].id) === id) {
        return (list[i].name && String(list[i].name).trim()) || 'Без названия';
      }
    }
    return '';
  }

  function buildGeoSelectOptions(addresses, selectedId) {
    var sel = String(selectedId || '');
    var html = '<option value="">— Не выбрано —</option>';
    (addresses || []).forEach(function (a) {
      if (!a || !a.id) return;
      var label = (a.name && String(a.name).trim()) || 'Без названия';
      html +=
        '<option value="' +
        escapeHtml(a.id) +
        '"' +
        (String(a.id) === sel ? ' selected' : '') +
        '>' +
        escapeHtml(label) +
        '</option>';
    });
    return html;
  }

  function openExternalUrl(url) {
    var u = String(url || '').trim();
    if (!u) return Promise.resolve(false);
    try {
      if (window.electronAPI && typeof window.electronAPI.openExternal === 'function') {
        return Promise.resolve(window.electronAPI.openExternal(u)).then(function () {
          return true;
        }).catch(function () {
          return false;
        });
      }
    } catch (e) {}

    var C = window.Capacitor;
    var isAndroidCap =
      C &&
      typeof C.isNativePlatform === 'function' &&
      C.isNativePlatform() &&
      typeof C.getPlatform === 'function' &&
      C.getPlatform() === 'android';

    if (isAndroidCap) {
      return import('@capacitor/core')
        .then(function (core) {
          var OpenExternalUrl = core.registerPlugin('OpenExternalUrl', {
            web: {
              openUrl: function () {
                return Promise.resolve();
              }
            }
          });
          return OpenExternalUrl.openUrl({ url: u });
        })
        .then(function () {
          return true;
        })
        .catch(function () {
          return import('@capacitor/browser')
            .then(function (mod) {
              return mod.Browser.open({ url: u });
            })
            .then(function () {
              return true;
            })
            .catch(function () {
              try {
                window.open(u, '_blank', 'noopener,noreferrer');
                return true;
              } catch (e2) {
                return false;
              }
            });
        });
    }

    try {
      window.open(u, '_blank', 'noopener');
      return Promise.resolve(true);
    } catch (e3) {
      try {
        window.location.href = u;
        return Promise.resolve(true);
      } catch (e4) {
        return Promise.resolve(false);
      }
    }
  }

  function buildMaxShareHttpsUrl(text) {
    return 'https://max.ru/:share?text=' + encodeURIComponent(String(text || ''));
  }

  /** Открыть шаринг в MAX; на Android — через системный Intent (плагин OpenExternalUrl). */
  function openMaxShare(text) {
    var body = String(text || '').trim();
    if (!body) {
      if (typeof showToast === 'function') showToast('Нет текста для отправки', 'error');
      return;
    }
    var httpsUrl = buildMaxShareHttpsUrl(body);
    openExternalUrl(httpsUrl).then(function (ok) {
      if (!ok && typeof showToast === 'function') {
        showToast('Не удалось открыть MAX. Установите приложение или откройте вручную.', 'error', 6000);
      }
    }).catch(function () {
      if (typeof showToast === 'function') {
        showToast('Не удалось открыть MAX', 'error');
      }
    });
  }

  function shareGeopositionToMax(geo, addressInfo) {
    if (!geo) {
      if (typeof showToast === 'function') showToast('Нет геопозиции', 'error');
      return;
    }
    var name = (geo.name && String(geo.name).trim()) || '';
    var nav = (geo.navUrl && String(geo.navUrl).trim()) || '';
    var info = addressInfo || (window.__farmCardBundle && window.__farmCardBundle.addressInfo) || {};
    var placeBits = [info.locality, info.region, info.address].filter(Boolean).join(', ');
    if (!name && !nav && !placeBits) {
      if (typeof showToast === 'function') showToast('Укажите название или ссылку на карты', 'error');
      return;
    }
    var lines = [];
    if (name) lines.push(name);
    if (placeBits) lines.push(placeBits);
    if (nav) lines.push(nav);
    openMaxShare(lines.join('\n'));
  }

  function shareSpecialistToMax(spec) {
    if (!spec) {
      if (typeof showToast === 'function') showToast('Нет специалиста', 'error');
      return;
    }
    var fio = (spec.name && String(spec.name).trim()) || '';
    var phones = specialistPhones(spec);
    if (!fio && !phones.length) {
      if (typeof showToast === 'function') showToast('Укажите ФИО или телефон', 'error');
      return;
    }
    var lines = [];
    if (fio) lines.push(fio);
    if (phones.length) lines.push(phones.join(', '));
    openMaxShare(lines.join('\n'));
  }

  function buildMaxShareUrl(text) {
    return buildMaxShareHttpsUrl(text);
  }

  function parsePhonesInput(raw) {
    return String(raw || '')
      .split(/[,;]/)
      .map(function (p) {
        return String(p || '').trim();
      })
      .filter(Boolean);
  }

  function specialistPhones(s) {
    if (!s) return [];
    if (Array.isArray(s.phones) && s.phones.length) {
      return s.phones
        .map(function (p) {
          return String(p || '').trim();
        })
        .filter(Boolean);
    }
    var single = s.phone != null ? String(s.phone).trim() : '';
    return single ? [single] : [];
  }

  function phoneCallButtonHtml(phone) {
    var p = String(phone || '').trim();
    if (!p) return '—';
    return (
      '<button type="button" class="link-btn farm-card-phone-call" data-phone="' +
      escapeHtml(p) +
      '" title="Позвонить">' +
      escapeHtml(p) +
      '</button>'
    );
  }

  function phonesCallCellHtml(phones) {
    var list = Array.isArray(phones) ? phones : [];
    if (!list.length) return '—';
    return list
      .map(function (p, i) {
        return phoneCallButtonHtml(p) + (i < list.length - 1 ? '<span class="farm-card-phone-sep">, </span>' : '');
      })
      .join('');
  }

  function initiatePhoneCall(phone) {
    var display = String(phone || '').trim();
    if (!display) return;
    var tel = display.replace(/[^\d+]/g, '');
    if (!tel) return;
    var ask =
      typeof showConfirmModal === 'function'
        ? showConfirmModal('Позвонить на ' + display + '?', {
            confirmText: 'Позвонить',
            cancelText: 'Отмена'
          })
        : Promise.resolve(window.confirm('Позвонить на ' + display + '?'));
    ask.then(function (ok) {
      if (!ok) return;
      try {
        window.location.href = 'tel:' + tel;
      } catch (e) {
        if (typeof showToast === 'function') showToast('Не удалось открыть набор номера', 'error');
      }
    });
  }

  function readSpecFormFields() {
    var phones = parsePhonesInput((document.getElementById('farmCardNewSpecPhone') || {}).value || '');
    return {
      role: ((document.getElementById('farmCardNewSpecRole') || {}).value || '').trim(),
      name: ((document.getElementById('farmCardNewSpecName') || {}).value || '').trim(),
      phones: phones,
      phone: phones[0] || '',
      email: ((document.getElementById('farmCardNewSpecEmail') || {}).value || '').trim(),
      geoId: ((document.getElementById('farmCardNewSpecGeo') || {}).value || '').trim()
    };
  }

  function syncAddressPaneToBundle() {
    if (!window.__farmCardBundle) window.__farmCardBundle = emptyBundle();
    var b = window.__farmCardBundle;
    b.addressInfo = {
      region: ((document.getElementById('farmCardAddrRegion') || {}).value || '').trim(),
      locality: ((document.getElementById('farmCardAddrLocality') || {}).value || '').trim(),
      address: ((document.getElementById('farmCardAddrLine') || {}).value || '').trim()
    };
    var draftName = ((document.getElementById('farmCardGeoName') || {}).value || '').trim();
    var draftNav = ((document.getElementById('farmCardGeoNav') || {}).value || '').trim();
    if (!b.addresses) b.addresses = [];
    if (draftName || draftNav) {
      var geoPayload = { name: draftName, navUrl: draftNav };
      if (_addrEditIdx >= 0 && b.addresses[_addrEditIdx]) {
        b.addresses[_addrEditIdx] = Object.assign({}, b.addresses[_addrEditIdx], geoPayload);
      } else {
        b.addresses.push(
          Object.assign({ id: newId('geo_'), sortOrder: b.addresses.length }, geoPayload)
        );
      }
      _addrEditIdx = -1;
    }
  }

  function readGeoFormFields() {
    return {
      name: ((document.getElementById('farmCardGeoName') || {}).value || '').trim(),
      navUrl: ((document.getElementById('farmCardGeoNav') || {}).value || '').trim()
    };
  }

  function buildFarmCardObjectSwitcherHtml() {
    var list = typeof getObjectsList === 'function' ? getObjectsList() : [];
    if (!list) list = [];
    var currentId = typeof getCurrentObjectId === 'function' ? getCurrentObjectId() : '';
    var pendingId =
      typeof window !== 'undefined' && window.CattleTrackerApi && window.CattleTrackerApi.PENDING_OBJECT_ID;
    var realList = list.filter(function (o) {
      return o && o.id && !(pendingId && o.id === pendingId);
    });
    if (realList.length === 0) return '';
    var opts = realList
      .map(function (obj) {
        var name = String(obj.name || obj.id || '')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/"/g, '&quot;');
        var val = String(obj.id || '')
          .replace(/&/g, '&amp;')
          .replace(/"/g, '&quot;');
        var sel = obj.id === currentId ? ' selected' : '';
        return '<option value="' + val + '"' + sel + '>' + name + '</option>';
      })
      .join('');
    var disabled = realList.length < 2 ? ' disabled' : '';
    return (
      '<div class="object-switcher object-switcher--view farm-card-object-switcher">' +
      '<label for="farmCardObjectSelect">Объект:</label>' +
      '<select id="farmCardObjectSelect" class="object-select" title="Выберите хозяйство"' +
      disabled +
      '>' +
      opts +
      '</select></div>'
    );
  }

  function resetFarmCardUiForObjectSwitch() {
    _timelineFormOpen = false;
    if (typeof clearTimelineDraft === 'function') clearTimelineDraft();
    _timelineDraftAttachments = [];
    _addrEditIdx = -1;
    _specEditIdx = -1;
    clearFarmCardDirty();
  }

  function switchFarmCardObject(nextId) {
    var cur = typeof getCurrentObjectId === 'function' ? getCurrentObjectId() : '';
    if (!nextId || nextId === cur) return Promise.resolve(false);
    return confirmLeaveFarmCardIfNeeded().then(function (ok) {
      if (!ok) return false;
      resetFarmCardUiForObjectSwitch();
      var root = document.getElementById('farmCardRoot');
      var hideLoading =
        typeof showLoading === 'function' && root ? showLoading(root) : function () {};
      var sel = document.getElementById('farmCardObjectSelect');
      if (sel) sel.disabled = true;
      var p =
        typeof switchToObject === 'function' ? switchToObject(nextId) : Promise.resolve();
      return Promise.resolve(p)
        .then(function () {
          if (typeof updateObjectSwitcher === 'function') updateObjectSwitcher();
          return ensureFarmCardLoaded();
        })
        .then(function () {
          var stillCurrent =
            typeof getCurrentObjectId === 'function' ? getCurrentObjectId() === nextId : true;
          if (!stillCurrent) return false;
          renderFarmCardPanel();
          return true;
        })
        .finally(function () {
          hideLoading();
          var s = document.getElementById('farmCardObjectSelect');
          if (s && typeof getCurrentObjectId === 'function' && getCurrentObjectId() !== nextId) {
            var list = typeof getObjectsList === 'function' ? getObjectsList() : [];
            var pendingId =
              typeof window !== 'undefined' &&
              window.CattleTrackerApi &&
              window.CattleTrackerApi.PENDING_OBJECT_ID;
            var realList = (list || []).filter(function (o) {
              return o && o.id && !(pendingId && o.id === pendingId);
            });
            s.disabled = realList.length < 2;
          }
        });
    });
  }

  function renderFarmCardPanel() {
    captureTimelineDraftFields();
    if (typeof window._farmSuggestDocClose === 'function') {
      document.removeEventListener('click', window._farmSuggestDocClose, true);
      window._farmSuggestDocClose = null;
    }
    if (NS.state.addrSuggestTimer) {
      clearTimeout(NS.state.addrSuggestTimer);
      NS.state.addrSuggestTimer = null;
    }
    var root = document.getElementById('farmCardRoot');
    if (!root) return;
    bindFarmCardDirtyTracking(root);
    var b = window.__farmCardBundle || emptyBundle();
    var canEdit = farmCardCanEdit();

    if (FARM_CARD_TABS.indexOf(_activeTab) === -1) _activeTab = 'addresses';

    var objectSwitcher = buildFarmCardObjectSwitcherHtml();
    var bitrixHint = '';
    if (b.bitrixCompanyId) {
      bitrixHint =
        '<p class="farm-settings-hint farm-card-bx-hint">Битрикс компания #' +
        escapeHtml(b.bitrixCompanyId) +
        (b.bitrixSyncedAt
          ? ' · обновлено ' + escapeHtml(String(b.bitrixSyncedAt).replace('T', ' ').slice(0, 19))
          : '') +
        '. Контакты доступны офлайн из кэша. Правки — в очередь на экране «Синхронизация».</p>';
    }

    var tabs =
      '<div class="farm-card-tabs" role="tablist">' +
      '<button type="button" class="farm-card-tab' +
      (_activeTab === 'addresses' ? ' farm-card-tab--active' : '') +
      '" data-farm-tab="addresses">Адреса</button>' +
      '<button type="button" class="farm-card-tab' +
      (_activeTab === 'specialists' ? ' farm-card-tab--active' : '') +
      '" data-farm-tab="specialists">Специалисты</button>' +
      '<button type="button" class="farm-card-tab' +
      (_activeTab === 'goals' ? ' farm-card-tab--active' : '') +
      '" data-farm-tab="goals">Цели</button>' +
      '<button type="button" class="farm-card-tab' +
      (_activeTab === 'timeline' ? ' farm-card-tab--active' : '') +
      '" data-farm-tab="timeline">Лента событий</button>' +
      '<button type="button" class="farm-card-tab' +
      (_activeTab === 'metrics' ? ' farm-card-tab--active' : '') +
      '" data-farm-tab="metrics">Показатели</button>' +
      '<button type="button" class="farm-card-tab' +
      (_activeTab === 'dynamics' ? ' farm-card-tab--active' : '') +
      '" data-farm-tab="dynamics">Динамика</button>' +
      '</div>';

    var genetikaBlock = '';
    (b.contacts || []).forEach(function (c) {
      if (c.genetika) {
        genetikaBlock +=
          '<tr><td>' +
          escapeHtml(c.title) +
          '</td><td>' +
          escapeHtml(c.fullName) +
          '</td><td>' +
          escapeHtml((c.phones || []).join(', ')) +
          '</td><td>' +
          escapeHtml(c.note) +
          '</td></tr>';
      }
    });
    var genetikaSection =
      '<section class="farm-card-subsection"><h3 class="farm-card-h3">Закреплённые специалисты МК «Генетика»</h3>' +
      (genetikaBlock
        ? '<div class="farm-card-table-scroll"><table class="farm-card-table"><thead><tr><th>Должность</th><th>ФИО</th><th>Телефоны</th><th>Описание</th></tr></thead><tbody>' +
          genetikaBlock +
          '</tbody></table></div>'
        : '<p class="farm-settings-hint">Отметьте контакт как «МК Генетика» при редактировании.</p>') +
      '</section>';

    var contactsRows = (b.contacts || [])
      .map(function (c, idx) {
        return (
          '<tr data-contact-idx="' +
          idx +
          '"><td>' +
          escapeHtml(c.title) +
          '</td><td>' +
          escapeHtml(c.fullName) +
          '</td><td>' +
          escapeHtml((c.phones || []).join(', ')) +
          '</td><td>' +
          (c.genetika ? 'Да' : '—') +
          '</td><td>' +
          escapeHtml(c.note) +
          '</td>' +
          (canEdit
            ? '<td><button type="button" class="small-btn farm-card-row-edit" data-contact-idx="' +
              idx +
              '">Изм.</button> <button type="button" class="small-btn farm-card-row-del" data-contact-idx="' +
              idx +
              '">Удал.</button></td>'
            : '') +
          '</tr>'
        );
      })
      .join('');

    var contactsHtml =
      '<div class="farm-card-pane" id="farmCardPaneContacts" style="' +
      (_activeTab === 'contacts' ? '' : 'display:none') +
      '">' +
      genetikaSection +
      '<h3 class="farm-card-h3">Все контакты</h3>' +
      '<div class="farm-card-table-scroll"><table class="farm-card-table"><thead><tr><th>Должность</th><th>ФИО</th><th>Телефоны</th><th>МК Генетика</th><th>Описание</th>' +
      (canEdit ? '<th></th>' : '') +
      '</tr></thead><tbody>' +
      (contactsRows || '<tr><td colspan="99" class="farm-card-empty">Нет записей</td></tr>') +
      '</tbody></table></div>' +
      (canEdit
        ? '<div class="farm-card-form">' +
          '<h4 class="farm-card-h4">Новый контакт</h4>' +
          '<label>Должность <input type="text" id="farmCardNewContactTitle" class="farm-settings-inline-input" /></label>' +
          '<label>ФИО <input type="text" id="farmCardNewContactName" class="farm-settings-inline-input" /></label>' +
          '<label>Телефоны (через запятую) <input type="text" id="farmCardNewContactPhones" class="farm-settings-inline-input" /></label>' +
          '<label><input type="checkbox" id="farmCardNewContactGen" /> МК «Генетика»</label>' +
          '<label>Описание <textarea id="farmCardNewContactNote" class="farm-settings-textarea" rows="2"></textarea></label>' +
          '<button type="button" class="small-btn" id="farmCardAddContactBtn">Добавить контакт</button></div>'
        : '') +
      '</div>';

    var info = b.addressInfo || { region: '', locality: '', address: '' };
    var editingGeo =
      _addrEditIdx >= 0 && b.addresses && b.addresses[_addrEditIdx] ? b.addresses[_addrEditIdx] : null;

    var geoRows = (b.addresses || [])
      .map(function (a, idx) {
        var name = (a.name && String(a.name).trim()) || 'Без названия';
        var nav = a.navUrl || '';
        var navCell = nav
          ? '<a class="farm-card-nav-link" href="' +
            escapeHtml(nav) +
            '" target="_blank" rel="noopener">Открыть</a>'
          : '—';
        var shareBtn =
          '<button type="button" class="small-btn farm-card-geo-share-max" data-addr-idx="' +
          idx +
          '" title="Поделиться в MAX">В MAX</button>';
        var rowClass = idx === _addrEditIdx ? ' class="farm-card-addr-row--editing"' : '';
        return (
          '<tr data-addr-idx="' +
          idx +
          '"' +
          rowClass +
          '><td>' +
          escapeHtml(name) +
          '</td><td>' +
          navCell +
          '</td><td class="farm-card-geo-actions">' +
          shareBtn +
          (canEdit
            ? ' <button type="button" class="small-btn farm-card-addr-edit" data-addr-idx="' +
              idx +
              '">Изм.</button> <button type="button" class="small-btn farm-card-addr-del" data-addr-idx="' +
              idx +
              '">Удал.</button>'
            : '') +
          '</td></tr>'
        );
      })
      .join('');

    var geoPickOptions =
      '<option value="">— Выберите по названию —</option>' +
      (b.addresses || [])
        .map(function (a, idx) {
          var label = (a.name && String(a.name).trim()) || ('Точка ' + (idx + 1));
          return (
            '<option value="' +
            idx +
            '"' +
            (idx === _addrEditIdx ? ' selected' : '') +
            '>' +
            escapeHtml(label) +
            '</option>'
          );
        })
        .join('');

    var addressesHtml =
      '<div class="farm-card-pane" id="farmCardPaneAddresses" style="' +
      (_activeTab === 'addresses' ? '' : 'display:none') +
      '">' +
      '<div class="farm-card-form farm-card-addr-general">' +
      '<div class="farm-card-addr-suggest-wrap">' +
      '<div class="farm-card-grid2">' +
      '<label>Область <input type="text" id="farmCardAddrRegion" class="farm-settings-inline-input" value="' +
      escapeHtml(info.region || '') +
      '" autocomplete="address-level1"' +
      (canEdit ? '' : ' disabled') +
      ' /></label>' +
      '<label>Населённый пункт <input type="text" id="farmCardAddrLocality" class="farm-settings-inline-input" value="' +
      escapeHtml(info.locality || '') +
      '" autocomplete="address-level2"' +
      (canEdit ? '' : ' disabled') +
      ' /></label></div>' +
      '<label>Адрес (полный) <input type="text" id="farmCardAddrLine" class="farm-settings-inline-input" value="' +
      escapeHtml(info.address || '') +
      '" autocomplete="street-address"' +
      (canEdit ? '' : ' disabled') +
      ' /></label>' +
      '<ul id="farmCardAddrSuggestList" class="farm-card-addr-suggest-list" role="listbox" aria-label="Подсказки адреса" style="display:none;"></ul></div></div>' +
      '<div class="farm-card-form farm-card-geo-block">' +
      '<h4 class="farm-card-h4">Геопозиции</h4>' +
      '<div class="farm-card-table-scroll"><table class="farm-card-table"><thead><tr><th>Название</th><th>Ссылка</th><th></th>' +
      '</tr></thead><tbody>' +
      (geoRows || '<tr><td colspan="3" class="farm-card-empty">Нет геопозиций</td></tr>') +
      '</tbody></table></div>' +
      (canEdit
        ? ((b.addresses || []).length
            ? '<label>Выбрать по названию <select id="farmCardAddrPick" class="farm-settings-inline-input">' +
              geoPickOptions +
              '</select></label>'
            : '') +
          '<h4 class="farm-card-h4">' +
          (editingGeo ? 'Редактирование геопозиции' : 'Новая геопозиция') +
          '</h4>' +
          '<label>Название <input type="text" id="farmCardGeoName" class="farm-settings-inline-input" value="' +
          escapeHtml(editingGeo && editingGeo.name ? editingGeo.name : '') +
          '" autocomplete="off" /></label>' +
          '<label>Ссылка на Яндекс.Карты <input type="url" id="farmCardGeoNav" class="farm-settings-inline-input" placeholder="https://yandex.ru/maps/..." value="' +
          escapeHtml(editingGeo && editingGeo.navUrl ? editingGeo.navUrl : '') +
          '" /></label>' +
          '<div class="farm-card-actions-row">' +
          '<button type="button" class="small-btn" id="farmCardAddAddrBtn">' +
          (editingGeo ? 'Сохранить в список' : 'Добавить в список') +
          '</button>' +
          (editingGeo
            ? '<button type="button" class="small-btn" id="farmCardAddrCancelBtn">Отмена</button>'
            : '') +
          '</div>'
        : '') +
      '</div></div>';

    var editingSpec =
      _specEditIdx >= 0 && b.specialists && b.specialists[_specEditIdx] ? b.specialists[_specEditIdx] : null;
    var geoOptionsEmpty = !(b.addresses || []).length;

    var specRows = (b.specialists || [])
      .map(function (s, idx) {
        var geoLabel = geoLabelById(b.addresses, s.geoId);
        var fio = (s.name && String(s.name).trim()) || '';
        var phones = specialistPhones(s);
        var fromBx = !!(s.bitrixContactId || s.source === 'bitrix');
        var rowClass = idx === _specEditIdx ? ' class="farm-card-addr-row--editing"' : '';
        return (
          '<tr data-spec-idx="' +
          idx +
          '"' +
          rowClass +
          '><td>' +
          escapeHtml(s.role) +
          '</td><td>' +
          escapeHtml(s.name) +
          (fromBx ? ' <span class="farm-card-bx-badge" title="Из Битрикс">B24</span>' : '') +
          '</td><td>' +
          phonesCallCellHtml(phones) +
          '</td><td>' +
          escapeHtml(s.email) +
          '</td><td>' +
          escapeHtml(geoLabel || '—') +
          (fio || phones.length
            ? ' <button type="button" class="small-btn farm-card-spec-share-max" data-spec-idx="' +
              idx +
              '" title="Поделиться ФИО и телефоном в MAX">MAX</button>'
            : '') +
          '</td>' +
          (canEdit
            ? '<td><button type="button" class="small-btn farm-card-spec-edit" data-spec-idx="' +
              idx +
              '">Изм.</button> <button type="button" class="small-btn farm-card-spec-del" data-spec-id="' +
              escapeHtml(s.id) +
              '">Удал.</button></td>'
            : '') +
          '</tr>'
        );
      })
      .join('');

    var specialistsHtml =
      '<div class="farm-card-pane" id="farmCardPaneSpecialists" style="' +
      (_activeTab === 'specialists' ? '' : 'display:none') +
      '">' +
      '<div class="farm-card-table-scroll"><table class="farm-card-table"><thead><tr><th>Роль</th><th>ФИО</th><th>Телефоны</th><th>Email</th><th>Закрепление</th>' +
      (canEdit ? '<th></th>' : '') +
      '</tr></thead><tbody>' +
      (specRows || '<tr><td colspan="6" class="farm-card-empty">Нет записей</td></tr>') +
      '</tbody></table></div>' +
      (canEdit
        ? '<div class="farm-card-form"><h4 class="farm-card-h4">' +
          (editingSpec ? 'Редактирование специалиста' : 'Новый специалист') +
          '</h4>' +
          '<label>Роль <input type="text" id="farmCardNewSpecRole" class="farm-settings-inline-input" placeholder="Ветврач, зоотехник…" value="' +
          escapeHtml(editingSpec && editingSpec.role ? editingSpec.role : '') +
          '" /></label>' +
          '<label>ФИО <input type="text" id="farmCardNewSpecName" class="farm-settings-inline-input" value="' +
          escapeHtml(editingSpec && editingSpec.name ? editingSpec.name : '') +
          '" /></label>' +
          '<label>Телефоны (через запятую) <input type="tel" id="farmCardNewSpecPhone" class="farm-settings-inline-input" placeholder="+7…, +7…" value="' +
          escapeHtml(editingSpec ? specialistPhones(editingSpec).join(', ') : '') +
          '" /></label>' +
          '<label>Email <input type="email" id="farmCardNewSpecEmail" class="farm-settings-inline-input" value="' +
          escapeHtml(editingSpec && editingSpec.email ? editingSpec.email : '') +
          '" /></label>' +
          '<label>Закрепление <select id="farmCardNewSpecGeo" class="farm-settings-inline-input">' +
          buildGeoSelectOptions(b.addresses, editingSpec && editingSpec.geoId) +
          '</select></label>' +
          (geoOptionsEmpty
            ? '<p class="farm-settings-hint">Сначала добавьте геопозиции во вкладке «Адреса».</p>'
            : '<p class="farm-settings-hint">Геопозиция на объекте, к которой привязан специалист.</p>') +
          '<div class="farm-card-actions-row">' +
          '<button type="button" class="small-btn" id="farmCardAddSpecBtn">' +
          (editingSpec ? 'Сохранить' : 'Добавить') +
          '</button>' +
          (editingSpec
            ? '<button type="button" class="small-btn" id="farmCardSpecCancelBtn">Отмена</button>'
            : '') +
          '</div></div>'
        : '') +
      '</div>';

    var computed = computeFromEntries(typeof window.entries !== 'undefined' ? window.entries : []);
    var herdSnapCows = currentMetricSnapshot(b.metricValues, 'm_herd_cows');
    var herdSnapCalves = currentMetricSnapshot(b.metricValues, 'm_herd_calves');
    var herdLine =
      '<p class="farm-card-herd-line">Поголовье: коровы <strong>' +
      escapeHtml((herdSnapCows && herdSnapCows.valueText) || computed.herd_cows || '—') +
      '</strong>, телята <strong>' +
      escapeHtml((herdSnapCalves && herdSnapCalves.valueText) || computed.herd_calves || '—') +
      '</strong>' +
      (canEdit
        ? ' <button type="button" class="small-btn" id="farmCardFillComputedBtn">Обновить из описи</button>'
        : '') +
      '</p>';

    var importKpiHtml = canEdit
      ? '<div class="farm-card-kpi-import">' +
        '<div class="farm-card-actions-row">' +
        '<button type="button" class="small-btn" id="farmCardKpiTemplateBtn">Скачать шаблон KPI</button>' +
        '<button type="button" class="small-btn" id="farmCardKpiImportBtn">Импорт KPI</button>' +
        '<input type="file" id="farmCardKpiImportFile" accept=".csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv" multiple style="display:none" aria-label="Файлы KPI" />' +
        '</div>' +
        '<p class="farm-settings-hint">DC305: выберите сразу <code>E.CSV</code> (BREDSUM\\E; для тёлок — в имени файла «телк»/heif) и <code>BREDSUM BY SID.CSV</code>. CR коров/тёлок в \\E нет — только HDR/%PR; CR по быкам из BY SID. Либо заполните шаблон.</p>' +
        '</div>'
      : '';

    var ids = REPRO_MONTH_METRIC_IDS;
    var yIds = REPRO_YEAR_METRIC_IDS;
    var reproMonths = collectReproMonths(b.metricValues);
    var reproBodyRows = reproMonths
      .map(function (ym) {
        var cells =
          '<td class="farm-card-matrix-month">' +
          escapeHtml(formatYearMonthRu(ym)) +
          '</td>' +
          '<td>' +
          cellDisplay(getMetricTextForMonth(b.metricValues, ids.cows_cr, ym)) +
          '</td>' +
          '<td>' +
          cellDisplay(getMetricTextForMonth(b.metricValues, ids.cows_hdr, ym)) +
          '</td>' +
          '<td>' +
          cellDisplay(getMetricTextForMonth(b.metricValues, ids.cows_pr, ym)) +
          '</td>' +
          '<td>' +
          cellDisplay(getMetricTextForMonth(b.metricValues, ids.heif_cr, ym)) +
          '</td>' +
          '<td>' +
          cellDisplay(getMetricTextForMonth(b.metricValues, ids.heif_hdr, ym)) +
          '</td>' +
          '<td>' +
          cellDisplay(getMetricTextForMonth(b.metricValues, ids.heif_pr, ym)) +
          '</td>';
        if (canEdit) {
          cells +=
            '<td><button type="button" class="small-btn farm-card-repro-edit" data-ym="' +
            escapeHtml(ym) +
            '">Изм.</button></td>';
        }
        return '<tr data-repro-ym="' + escapeHtml(ym) + '">' + cells + '</tr>';
      })
      .join('');

    var yearCowsCr = (currentMetricSnapshot(b.metricValues, yIds.cows_cr) || {}).valueText || '';
    var yearCowsHdr = (currentMetricSnapshot(b.metricValues, yIds.cows_hdr) || {}).valueText || '';
    var yearCowsPr = (currentMetricSnapshot(b.metricValues, yIds.cows_pr) || {}).valueText || '';
    var yearHeifCr = (currentMetricSnapshot(b.metricValues, yIds.heif_cr) || {}).valueText || '';
    var yearHeifHdr = (currentMetricSnapshot(b.metricValues, yIds.heif_hdr) || {}).valueText || '';
    var yearHeifPr = (currentMetricSnapshot(b.metricValues, yIds.heif_pr) || {}).valueText || '';
    var yearRow =
      '<tr class="farm-card-matrix-year-row"><td class="farm-card-matrix-month">Год</td>' +
      '<td>' +
      cellDisplay(yearCowsCr) +
      '</td><td>' +
      cellDisplay(yearCowsHdr) +
      '</td><td>' +
      cellDisplay(yearCowsPr) +
      '</td><td>' +
      cellDisplay(yearHeifCr) +
      '</td><td>' +
      cellDisplay(yearHeifHdr) +
      '</td><td>' +
      cellDisplay(yearHeifPr) +
      '</td>' +
      (canEdit
        ? '<td><button type="button" class="small-btn farm-card-repro-year-scroll">Изм.</button></td>'
        : '') +
      '</tr>';

    var reproTableHtml =
      '<div class="farm-card-table-scroll"><table class="farm-card-table farm-card-matrix-table">' +
      '<thead>' +
      '<tr>' +
      '<th rowspan="2">Месяц</th>' +
      '<th colspan="3" class="farm-card-matrix-group">Коровы</th>' +
      '<th colspan="3" class="farm-card-matrix-group">Тёлки</th>' +
      (canEdit ? '<th rowspan="2"></th>' : '') +
      '</tr>' +
      '<tr>' +
      '<th>CR</th><th>HDR</th><th>PR</th>' +
      '<th>CR</th><th>HDR</th><th>PR</th>' +
      '</tr>' +
      '</thead><tbody>' +
      (reproBodyRows || '') +
      yearRow +
      (!reproBodyRows
        ? '<tr><td colspan="' +
          (canEdit ? '8' : '7') +
          '" class="farm-card-empty">Нет месячных значений — добавьте ниже</td></tr>'
        : '') +
      '</tbody></table></div>';

    var reproFormHtml = canEdit
      ? '<div class="farm-card-form farm-card-form--mobile farm-card-repro-form">' +
        '<h4 class="farm-card-h4">Месяц CR / HDR / PR</h4>' +
        '<label>Месяц <input type="month" id="farmCardReproMonth" class="farm-card-input-lg" /></label>' +
        '<div class="farm-card-repro-grid">' +
        '<fieldset class="farm-card-repro-fs"><legend>Коровы</legend>' +
        '<label>CR <input type="text" id="farmCardReproCowsCr" inputmode="decimal" class="farm-settings-inline-input" /></label>' +
        '<label>HDR <input type="text" id="farmCardReproCowsHdr" inputmode="decimal" class="farm-settings-inline-input" /></label>' +
        '<label>PR <input type="text" id="farmCardReproCowsPr" inputmode="decimal" class="farm-settings-inline-input" /></label>' +
        '</fieldset>' +
        '<fieldset class="farm-card-repro-fs"><legend>Тёлки</legend>' +
        '<label>CR <input type="text" id="farmCardReproHeifCr" inputmode="decimal" class="farm-settings-inline-input" /></label>' +
        '<label>HDR <input type="text" id="farmCardReproHeifHdr" inputmode="decimal" class="farm-settings-inline-input" /></label>' +
        '<label>PR <input type="text" id="farmCardReproHeifPr" inputmode="decimal" class="farm-settings-inline-input" /></label>' +
        '</fieldset></div>' +
        '<button type="button" class="action-btn" id="farmCardReproSaveBtn">Сохранить месяц</button>' +
        '<h4 class="farm-card-h4">Год (накопительно)</h4>' +
        '<div class="farm-card-repro-grid">' +
        '<fieldset class="farm-card-repro-fs"><legend>Коровы</legend>' +
        '<label>CR <input type="text" id="farmCardYearCowsCr" inputmode="decimal" class="farm-settings-inline-input" value="' +
        escapeHtml(yearCowsCr) +
        '" /></label>' +
        '<label>HDR <input type="text" id="farmCardYearCowsHdr" inputmode="decimal" class="farm-settings-inline-input" value="' +
        escapeHtml(yearCowsHdr) +
        '" /></label>' +
        '<label>PR <input type="text" id="farmCardYearCowsPr" inputmode="decimal" class="farm-settings-inline-input" value="' +
        escapeHtml(yearCowsPr) +
        '" /></label>' +
        '</fieldset>' +
        '<fieldset class="farm-card-repro-fs"><legend>Тёлки</legend>' +
        '<label>CR <input type="text" id="farmCardYearHeifCr" inputmode="decimal" class="farm-settings-inline-input" value="' +
        escapeHtml(yearHeifCr) +
        '" /></label>' +
        '<label>HDR <input type="text" id="farmCardYearHeifHdr" inputmode="decimal" class="farm-settings-inline-input" value="' +
        escapeHtml(yearHeifHdr) +
        '" /></label>' +
        '<label>PR <input type="text" id="farmCardYearHeifPr" inputmode="decimal" class="farm-settings-inline-input" value="' +
        escapeHtml(yearHeifPr) +
        '" /></label>' +
        '</fieldset></div>' +
        '<button type="button" class="action-btn" id="farmCardReproYearSaveBtn">Сохранить год</button></div>'
      : '';

    var bullNames = collectBullNames(b.bullFertility);
    var bullMonths = collectBullMonths(b.bullFertility);
    var bullHead =
      '<tr><th>Месяц</th>' +
      bullNames
        .map(function (n) {
          return (
            '<th class="farm-card-bf-col-head">' +
            '<span class="farm-card-bf-col-name">' +
            escapeHtml(n) +
            '</span>' +
            (canEdit
              ? '<button type="button" class="small-btn farm-card-bf-del-bull" data-bull="' +
                escapeHtml(n) +
                '" title="Удалить быка со всеми месяцами">×</button>'
              : '') +
            '</th>'
          );
        })
        .join('') +
      (canEdit ? '<th></th>' : '') +
      '</tr>';
    var bullBody =
      bullMonths.length && bullNames.length
        ? bullMonths
            .map(function (ym) {
              var cells =
                '<td class="farm-card-matrix-month">' +
                escapeHtml(formatYearMonthRu(ym)) +
                '</td>' +
                bullNames
                  .map(function (n) {
                    var cr = getBullCr(b.bullFertility, ym, n);
                    if (!canEdit) {
                      return '<td>' + cellDisplay(cr) + '</td>';
                    }
                    if (cr === '') {
                      return (
                        '<td class="farm-card-bf-cell farm-card-bf-cell--empty">' +
                        '<button type="button" class="farm-card-bf-cell-fill" data-ym="' +
                        escapeHtml(ym) +
                        '" data-bull="' +
                        escapeHtml(n) +
                        '" title="Заполнить">—</button></td>'
                      );
                    }
                    return (
                      '<td class="farm-card-bf-cell">' +
                      '<span class="farm-card-bf-cell-val">' +
                      escapeHtml(cr) +
                      '</span>' +
                      '<button type="button" class="small-btn farm-card-bf-del-cell" data-ym="' +
                      escapeHtml(ym) +
                      '" data-bull="' +
                      escapeHtml(n) +
                      '" title="Удалить показатель">×</button></td>'
                    );
                  })
                  .join('');
              if (canEdit) {
                cells +=
                  '<td class="farm-card-bf-row-actions">' +
                  '<button type="button" class="small-btn farm-card-bf-month-edit" data-ym="' +
                  escapeHtml(ym) +
                  '">Изм.</button> ' +
                  '<button type="button" class="small-btn farm-card-bf-del-month" data-ym="' +
                  escapeHtml(ym) +
                  '" title="Удалить весь месяц">Удал.</button></td>';
              }
              return '<tr>' + cells + '</tr>';
            })
            .join('')
        : '<tr><td colspan="' +
          Math.max(1, bullNames.length + (canEdit ? 2 : 1)) +
          '" class="farm-card-empty">Нет данных по быкам</td></tr>';

    var bullSectionHtml =
      '<section class="farm-card-subsection farm-card-bull-fertility">' +
      '<h3 class="farm-card-h3">CR по быкам</h3>' +
      '<p class="farm-settings-hint">× у клички — удалить быка; × в ячейке — удалить показатель за месяц; «Удал.» в строке — весь месяц.</p>' +
      '<div class="farm-card-table-scroll"><table class="farm-card-table farm-card-matrix-table farm-card-bull-matrix">' +
      '<thead>' +
      bullHead +
      '</thead><tbody>' +
      bullBody +
      '</tbody></table></div>' +
      (canEdit
        ? '<div class="farm-card-form farm-card-form--mobile farm-card-bf-form">' +
          '<h4 class="farm-card-h4">CR быка за месяц</h4>' +
          '<label>Месяц <input type="month" id="farmCardBfMonth" class="farm-card-input-lg" /></label>' +
          '<label>Кличка быка <input type="text" id="farmCardBfBull" class="farm-settings-inline-input farm-card-input-lg" list="farmCardBfBullList" placeholder="Кличка" /></label>' +
          (bullNames.length
            ? '<datalist id="farmCardBfBullList">' +
              bullNames
                .map(function (n) {
                  return '<option value="' + escapeHtml(n) + '"></option>';
                })
                .join('') +
              '</datalist>'
            : '') +
          '<label>CR % <input type="text" id="farmCardBfCr" class="farm-settings-inline-input farm-card-input-lg" inputmode="decimal" /></label>' +
          '<div class="farm-card-actions-row">' +
          '<button type="button" class="action-btn" id="farmCardBfAddBtn">Сохранить</button>' +
          '</div></div>'
        : '') +
      '</section>';

    var metricsHtml =
      '<div class="farm-card-pane" id="farmCardPaneMetrics" style="' +
      (_activeTab === 'metrics' ? '' : 'display:none') +
      '">' +
      herdLine +
      importKpiHtml +
      '<p class="farm-settings-hint">Строки — месяцы; колонки CR / HDR / PR для коров и тёлок. Строка «Год» — накопленные показатели за год.</p>' +
      reproTableHtml +
      reproFormHtml +
      bullSectionHtml +
      '</div>';

    var dynamicsHtml =
      typeof globalThis['__farmCard'].buildDynamicsPaneHtml === 'function'
        ? globalThis['__farmCard'].buildDynamicsPaneHtml(b, canEdit, _activeTab)
        : '';

    var evTypeLabels = EV_TYPE_LABELS;
    var evList = (b.events || []).slice();
    evList.sort(function (x, y) {
      var c = String(x.eventDate || '').localeCompare(String(y.eventDate || ''));
      if (c !== 0) return -c;
      return String(y.id || '').localeCompare(String(x.id || ''));
    });
    var evRows = evList
      .map(function (e) {
        var title =
          (e.title && String(e.title).trim()) ||
          (e.description && String(e.description).trim()) ||
          (e.task && String(e.task).trim()) ||
          '—';
        var descText = e.description && String(e.description).trim() ? String(e.description).trim() : '—';
        var partText = e.participants && String(e.participants).trim() ? String(e.participants).trim() : '—';
        var filesHtml = eventAttachmentsCellHtml(e.attachments);
        var evId = e.id || '';
        return (
          '<tr data-ev-id="' +
          escapeHtml(evId) +
          '"><td>' +
          escapeHtml(e.eventDate || '—') +
          '</td><td>' +
          escapeHtml(evTypeLabels[e.eventType] || e.eventType || '—') +
          '</td><td>' +
          escapeHtml(title) +
          '</td><td class="farm-card-ev-desc-cell">' +
          timelineClampCellHtml(evId, 'desc', descText) +
          (e.attachments && e.attachments.length
            ? '<div class="farm-card-ev-att-cell">' + filesHtml + '</div>'
            : '') +
          '</td><td class="farm-card-ev-part-cell">' +
          timelineClampCellHtml(evId, 'part', partText) +
          '</td>' +
          (canEdit
            ? '<td><button type="button" class="small-btn farm-card-ev-del" data-ev-id="' +
              escapeHtml(evId) +
              '">Удал.</button></td>'
            : '') +
          '</tr>'
        );
      })
      .join('');

    var partChecks = (b.specialists || [])
      .map(function (s, idx) {
        var label = specialistParticipantLabel(s);
        if (!label) return '';
        return (
          '<label class="farm-card-ev-part-check">' +
          '<input type="checkbox" class="farm-card-ev-part-cb" value="' +
          escapeHtml(label) +
          '" data-spec-idx="' +
          idx +
          '" /> ' +
          escapeHtml(label) +
          '</label>'
        );
      })
      .filter(Boolean)
      .join('');

    var timelineTableHtml =
      '<div class="farm-card-table-scroll"><table class="farm-card-table farm-card-table--wide"><thead><tr>' +
      '<th>Дата</th><th>Тип</th><th>Название</th><th>Описание / файлы</th><th>Участники</th>' +
      (canEdit ? '<th></th>' : '') +
      '</tr></thead><tbody>' +
      (evRows ||
        '<tr><td colspan="' +
          (canEdit ? '6' : '5') +
          '" class="farm-card-empty">Нет событий</td></tr>') +
      '</tbody></table></div>';

    var timelineFormHtml = canEdit
      ? '<div class="farm-card-actions-row">' +
        '<button type="button" class="action-btn" id="farmCardOpenEvFormBtn">' +
        (_timelineFormOpen ? 'Скрыть форму' : 'Добавить запись') +
        '</button></div>' +
        timelineTableHtml +
        '<div class="farm-card-form farm-card-ev-add-form" id="farmCardEvAddForm" style="' +
        (_timelineFormOpen ? '' : 'display:none') +
        '">' +
        '<h4 class="farm-card-h4">Новая запись</h4>' +
        '<label>Дата <input type="date" id="farmCardNewEvDate" /></label>' +
        '<label>Тип <select id="farmCardNewEvType">' +
        '<option value="shtab">Штаб</option>' +
        '<option value="audit">Аудит</option>' +
        '<option value="otbor_go">Отбор ГО</option>' +
        '</select></label>' +
        '<label>Название <input type="text" id="farmCardNewEvTitle" class="farm-settings-inline-input farm-card-input-lg" placeholder="Краткое название" /></label>' +
        '<label>Описание <textarea id="farmCardNewEvDesc" class="farm-settings-textarea farm-card-ev-desc" rows="2" placeholder="Описание события"></textarea></label>' +
        '<div class="farm-card-ev-files">' +
        '<div class="farm-card-ev-files-title">Файлы к событию</div>' +
        '<p class="farm-settings-hint farm-card-ev-files-hint">Таблица, картинка, Word, PDF — до 8 файлов</p>' +
        '<label class="farm-card-ev-files-btn" for="farmCardNewEvFiles">' +
        '<span class="farm-card-ev-files-btn-text">Выбрать файл</span>' +
        '<input type="file" id="farmCardNewEvFiles" class="farm-card-ev-files-input" accept="' +
        EV_FILE_ACCEPT +
        '" multiple /></label>' +
        '<div id="farmCardNewEvFilesList" class="farm-card-ev-files-list">' +
        draftAttachmentsListHtml() +
        '</div></div>' +
        '<fieldset class="farm-card-ev-participants">' +
        '<legend>Участники</legend>' +
        (partChecks
          ? '<div class="farm-card-ev-part-checks">' + partChecks + '</div>'
          : '<p class="farm-settings-hint">Специалисты ещё не добавлены — укажите участников вручную.</p>') +
        '<label>Дописать от руки <input type="text" id="farmCardNewEvPartExtra" class="farm-settings-inline-input farm-card-input-lg" placeholder="ФИО или роль через запятую" /></label>' +
        '</fieldset>' +
        '<div class="farm-card-actions-row">' +
        '<button type="button" class="action-btn" id="farmCardAddEvBtn">Сохранить</button>' +
        '<button type="button" class="small-btn" id="farmCardCancelEvFormBtn">Отмена</button>' +
        '</div></div>'
      : timelineTableHtml;

    var timelineHtml =
      '<div class="farm-card-pane" id="farmCardPaneTimeline" style="' +
      (_activeTab === 'timeline' ? '' : 'display:none') +
      '">' +
      timelineFormHtml +
      '</div>';

    var goalsHtml =
      typeof globalThis['__farmCard'].buildGoalsPaneHtml === 'function'
        ? globalThis['__farmCard'].buildGoalsPaneHtml(b, canEdit, _activeTab)
        : '';

    root.innerHTML =
      '<div class="farm-card-inner">' +
      objectSwitcher +
      bitrixHint +
      tabs +
      '<div class="farm-card-body">' +
      addressesHtml +
      specialistsHtml +
      goalsHtml +
      timelineHtml +
      metricsHtml +
      dynamicsHtml +
      '</div>' +
      '<div class="farm-card-footer">' +
      '<button type="button" class="small-btn" id="farmCardPrintBtn">Печать A4</button> ' +
      (window.CATTLE_TRACKER_USE_API
        ? '<button type="button" class="small-btn" id="farmCardReloadBtn">Обновить с сервера</button> '
        : '') +
      (canEdit
        ? '<button type="button" class="action-btn" id="farmCardSaveAllBtn">Сохранить карточку</button>'
        : '<p class="farm-settings-hint">Только просмотр</p>') +
      '<span id="farmCardSaveStatus" class="farm-card-save-status" aria-live="polite"></span></div></div>';

    var farmObjSel = document.getElementById('farmCardObjectSelect');
    if (farmObjSel && !farmObjSel.disabled) {
      farmObjSel.addEventListener('change', function () {
        var id = farmObjSel.value;
        var cur = typeof getCurrentObjectId === 'function' ? getCurrentObjectId() : '';
        if (!id || id === cur) return;
        switchFarmCardObject(id).then(function (switched) {
          if (!switched) farmObjSel.value = cur;
        });
      });
    }

    root.querySelectorAll('.farm-card-tab').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (window.__farmCardBundle && document.getElementById('farmCardAddrRegion')) {
          window.__farmCardBundle.addressInfo = {
            region: ((document.getElementById('farmCardAddrRegion') || {}).value || '').trim(),
            locality: ((document.getElementById('farmCardAddrLocality') || {}).value || '').trim(),
            address: ((document.getElementById('farmCardAddrLine') || {}).value || '').trim()
          };
        }
        var nextTab = btn.getAttribute('data-farm-tab') || 'addresses';
        _activeTab = FARM_CARD_TABS.indexOf(nextTab) !== -1 ? nextTab : 'addresses';
        renderFarmCardPanel();
      });
    });

    var today = new Date().toISOString().slice(0, 10);
    applyTimelineDraftFields();
    var dateEl = document.getElementById('farmCardNewEvDate');
    if (dateEl && !dateEl.value) dateEl.value = today;
    bindEvDescAutosize();

    root.querySelectorAll('.farm-card-ev-att-open').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var tr = btn.closest('tr');
        var evId = tr && tr.getAttribute('data-ev-id');
        var attIdx = parseInt(btn.getAttribute('data-att-idx'), 10);
        var ev = (window.__farmCardBundle.events || []).find(function (e) {
          return e && e.id === evId;
        });
        if (ev && ev.attachments && ev.attachments[attIdx]) {
          openEventAttachment(ev.attachments[attIdx]);
        }
      });
    });

    root.querySelectorAll('.farm-card-ev-more').forEach(function (btn) {
      btn.addEventListener('click', function (ev) {
        if (ev && ev.preventDefault) ev.preventDefault();
        if (ev && ev.stopPropagation) ev.stopPropagation();
        var id = btn.getAttribute('data-ev-id') || '';
        var kind = btn.getAttribute('data-clamp') || 'desc';
        if (!id) return;
        if (!_timelineExpanded[id]) _timelineExpanded[id] = {};
        _timelineExpanded[id][kind] = !_timelineExpanded[id][kind];
        renderFarmCardPanel();
      });
    });

    if (canEdit) {
      var openEvForm = document.getElementById('farmCardOpenEvFormBtn');
      if (openEvForm) {
        openEvForm.onclick = function () {
          if (_timelineFormOpen) {
            captureTimelineDraftFields();
            _timelineFormOpen = false;
            clearTimelineDraft();
          } else {
            _timelineFormOpen = true;
            _timelineDraftFields.date = new Date().toISOString().slice(0, 10);
            _timelineDraftFields.type = 'shtab';
          }
          renderFarmCardPanel();
          if (_timelineFormOpen) {
            setTimeout(function () {
              var form = document.getElementById('farmCardEvAddForm');
              if (form && form.scrollIntoView) {
                form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
              }
              var titleEl = document.getElementById('farmCardNewEvTitle');
              if (titleEl) titleEl.focus();
            }, 40);
          }
        };
      }
      var cancelEvForm = document.getElementById('farmCardCancelEvFormBtn');
      if (cancelEvForm) {
        cancelEvForm.onclick = function () {
          _timelineFormOpen = false;
          clearTimelineDraft();
          renderFarmCardPanel();
        };
      }
      var filesInput = document.getElementById('farmCardNewEvFiles');
      if (filesInput) {
        filesInput.onchange = function () {
          captureTimelineDraftFields();
          var files = filesInput.files ? Array.prototype.slice.call(filesInput.files) : [];
          filesInput.value = '';
          if (!files.length) return;
          var room = EV_FILE_MAX_COUNT - _timelineDraftAttachments.length;
          if (room <= 0) {
            if (typeof showToast === 'function') {
              showToast('Не больше ' + EV_FILE_MAX_COUNT + ' файлов на событие', 'error');
            }
            return;
          }
          var toLoad = files.slice(0, room);
          Promise.all(
            toLoad.map(function (f) {
              return loadEventAttachmentFile(f).catch(function (err) {
                if (typeof showToast === 'function') {
                  showToast((err && err.message) || 'Ошибка файла', 'error');
                }
                return null;
              });
            })
          ).then(function (atts) {
            atts.forEach(function (a) {
              if (a) _timelineDraftAttachments.push(a);
            });
            renderFarmCardPanel();
            if (_timelineFormOpen) {
              setTimeout(function () {
                var form = document.getElementById('farmCardEvAddForm');
                if (form && form.scrollIntoView) form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
              }, 40);
            }
          });
        };
      }
      root.querySelectorAll('.farm-card-ev-draft-att-del').forEach(function (btn) {
        btn.onclick = function () {
          captureTimelineDraftFields();
          var idx = parseInt(btn.getAttribute('data-draft-idx'), 10);
          if (!isNaN(idx)) _timelineDraftAttachments.splice(idx, 1);
          renderFarmCardPanel();
        };
      });
      root.querySelectorAll('.farm-card-ev-draft-att-open').forEach(function (btn) {
        btn.onclick = function () {
          var idx = parseInt(btn.getAttribute('data-draft-idx'), 10);
          if (!isNaN(idx) && _timelineDraftAttachments[idx]) {
            openEventAttachment(_timelineDraftAttachments[idx]);
          }
        };
      });
    }

    if (canEdit) {
      var addC = document.getElementById('farmCardAddContactBtn');
      if (addC) {
        addC.onclick = function () {
          var title = (document.getElementById('farmCardNewContactTitle') || {}).value || '';
          var fullName = (document.getElementById('farmCardNewContactName') || {}).value || '';
          var phonesRaw = (document.getElementById('farmCardNewContactPhones') || {}).value || '';
          var phones = phonesRaw
            .split(/[,;]/)
            .map(function (s) {
              return s.trim();
            })
            .filter(Boolean);
          var gen = document.getElementById('farmCardNewContactGen') && document.getElementById('farmCardNewContactGen').checked;
          var note = (document.getElementById('farmCardNewContactNote') || {}).value || '';
          if (!title && !fullName) {
            if (typeof showToast === 'function') showToast('Укажите должность или ФИО', 'error');
            return;
          }
          window.__farmCardBundle.contacts.push({
            id: newId('c_'),
            title: title,
            fullName: fullName,
            phones: phones,
            note: note,
            genetika: !!gen,
            sortOrder: window.__farmCardBundle.contacts.length
          });
          markFarmCardDirty();
          renderFarmCardPanel();
        };
      }
      root.querySelectorAll('.farm-card-row-del').forEach(function (btn) {
        btn.onclick = function () {
          var i = parseInt(btn.getAttribute('data-contact-idx'), 10);
          if (!isNaN(i)) window.__farmCardBundle.contacts.splice(i, 1);
          markFarmCardDirty();
          renderFarmCardPanel();
        };
      });
      root.querySelectorAll('.farm-card-row-edit').forEach(function (btn) {
        btn.onclick = function () {
          var i = parseInt(btn.getAttribute('data-contact-idx'), 10);
          var c = window.__farmCardBundle.contacts[i];
          if (!c) return;
          var title = prompt('Должность', c.title || '');
          if (title === null) return;
          var fullName = prompt('ФИО', c.fullName || '');
          if (fullName === null) return;
          var phones = prompt('Телефоны через запятую', (c.phones || []).join(', '));
          if (phones === null) return;
          var note = prompt('Описание', c.note || '');
          if (note === null) return;
          var gen = confirm('МК «Генетика»?');
          c.title = title;
          c.fullName = fullName;
          c.phones = phones
            .split(/[,;]/)
            .map(function (s) {
              return s.trim();
            })
            .filter(Boolean);
          c.note = note;
          c.genetika = gen;
          markFarmCardDirty();
          renderFarmCardPanel();
        };
      });

      function loadGeoIntoForm(idx) {
        if (!window.__farmCardBundle.addresses || !window.__farmCardBundle.addresses[idx]) {
          _addrEditIdx = -1;
          renderFarmCardPanel();
          return;
        }
        if (window.__farmCardBundle) {
          window.__farmCardBundle.addressInfo = {
            region: ((document.getElementById('farmCardAddrRegion') || {}).value || '').trim(),
            locality: ((document.getElementById('farmCardAddrLocality') || {}).value || '').trim(),
            address: ((document.getElementById('farmCardAddrLine') || {}).value || '').trim()
          };
        }
        _addrEditIdx = idx;
        renderFarmCardPanel();
      }

      var addrPick = document.getElementById('farmCardAddrPick');
      if (addrPick) {
        addrPick.onchange = function () {
          var v = addrPick.value;
          if (v === '') {
            _addrEditIdx = -1;
            renderFarmCardPanel();
            return;
          }
          loadGeoIntoForm(parseInt(v, 10));
        };
      }

      var addA = document.getElementById('farmCardAddAddrBtn');
      if (addA) {
        addA.onclick = function () {
          // сохранить общую инфу из полей, не трогая черновик гео (ещё в форме)
          if (!window.__farmCardBundle) window.__farmCardBundle = emptyBundle();
          window.__farmCardBundle.addressInfo = {
            region: ((document.getElementById('farmCardAddrRegion') || {}).value || '').trim(),
            locality: ((document.getElementById('farmCardAddrLocality') || {}).value || '').trim(),
            address: ((document.getElementById('farmCardAddrLine') || {}).value || '').trim()
          };
          var fields = readGeoFormFields();
          if (!fields.name && !fields.navUrl) {
            if (typeof showToast === 'function') showToast('Укажите название или ссылку', 'error');
            return;
          }
          if (!window.__farmCardBundle.addresses) window.__farmCardBundle.addresses = [];
          if (_addrEditIdx >= 0 && window.__farmCardBundle.addresses[_addrEditIdx]) {
            var prev = window.__farmCardBundle.addresses[_addrEditIdx];
            window.__farmCardBundle.addresses[_addrEditIdx] = Object.assign({}, prev, {
              name: fields.name,
              navUrl: fields.navUrl
            });
          } else {
            window.__farmCardBundle.addresses.push({
              id: newId('geo_'),
              name: fields.name,
              navUrl: fields.navUrl,
              sortOrder: window.__farmCardBundle.addresses.length
            });
          }
          _addrEditIdx = -1;
          markFarmCardDirty();
          renderFarmCardPanel();
        };
      }
      var cancelAddr = document.getElementById('farmCardAddrCancelBtn');
      if (cancelAddr) {
        cancelAddr.onclick = function () {
          _addrEditIdx = -1;
          renderFarmCardPanel();
        };
      }
      root.querySelectorAll('.farm-card-addr-del').forEach(function (btn) {
        btn.onclick = function () {
          var i = parseInt(btn.getAttribute('data-addr-idx'), 10);
          if (!isNaN(i)) {
            window.__farmCardBundle.addresses.splice(i, 1);
            if (_addrEditIdx === i) _addrEditIdx = -1;
            else if (_addrEditIdx > i) _addrEditIdx -= 1;
          }
          markFarmCardDirty();
          renderFarmCardPanel();
        };
      });
      var addSpec = document.getElementById('farmCardAddSpecBtn');
      if (addSpec) {
        addSpec.onclick = function () {
          if (!window.__farmCardBundle.specialists) window.__farmCardBundle.specialists = [];
          var fields = readSpecFormFields();
          if (!fields.role && !fields.name && !fields.phones.length && !fields.email && !fields.geoId) {
            if (typeof showToast === 'function') showToast('Заполните хотя бы одно поле', 'error');
            return;
          }
          if (_specEditIdx >= 0 && window.__farmCardBundle.specialists[_specEditIdx]) {
            var prev = window.__farmCardBundle.specialists[_specEditIdx];
            window.__farmCardBundle.specialists[_specEditIdx] = Object.assign({}, prev, {
              role: fields.role,
              name: fields.name,
              phones: fields.phones,
              phone: fields.phone,
              email: fields.email,
              geoId: fields.geoId
            });
          } else {
            window.__farmCardBundle.specialists.push({
              id: newId('sp_'),
              role: fields.role,
              name: fields.name,
              phones: fields.phones,
              phone: fields.phone,
              email: fields.email,
              geoId: fields.geoId
            });
          }
          _specEditIdx = -1;
          markFarmCardDirty();
          renderFarmCardPanel();
        };
      }
      var cancelSpec = document.getElementById('farmCardSpecCancelBtn');
      if (cancelSpec) {
        cancelSpec.onclick = function () {
          _specEditIdx = -1;
          renderFarmCardPanel();
        };
      }
      root.querySelectorAll('.farm-card-spec-edit').forEach(function (btn) {
        btn.onclick = function () {
          var i = parseInt(btn.getAttribute('data-spec-idx'), 10);
          if (isNaN(i)) return;
          _specEditIdx = i;
          renderFarmCardPanel();
        };
      });
      root.querySelectorAll('.farm-card-spec-del').forEach(function (btn) {
        btn.onclick = function () {
          var sid = btn.getAttribute('data-spec-id');
          var list = window.__farmCardBundle.specialists || [];
          var delIdx = -1;
          for (var i = 0; i < list.length; i++) {
            if (list[i] && list[i].id === sid) {
              delIdx = i;
              break;
            }
          }
          window.__farmCardBundle.specialists = list.filter(function (s) {
            return s && s.id !== sid;
          });
          if (_specEditIdx === delIdx) _specEditIdx = -1;
          else if (_specEditIdx > delIdx && delIdx >= 0) _specEditIdx -= 1;
          markFarmCardDirty();
          renderFarmCardPanel();
        };
      });
      root.querySelectorAll('.farm-card-addr-edit').forEach(function (btn) {
        btn.onclick = function () {
          var i = parseInt(btn.getAttribute('data-addr-idx'), 10);
          if (isNaN(i)) return;
          // сохранить общую инфу перед перерисовкой
          if (window.__farmCardBundle) {
            window.__farmCardBundle.addressInfo = {
              region: ((document.getElementById('farmCardAddrRegion') || {}).value || '').trim(),
              locality: ((document.getElementById('farmCardAddrLocality') || {}).value || '').trim(),
              address: ((document.getElementById('farmCardAddrLine') || {}).value || '').trim()
            };
          }
          _addrEditIdx = i;
          renderFarmCardPanel();
        };
      });

      var fillBtn = document.getElementById('farmCardFillComputedBtn');
      if (fillBtn) {
        fillBtn.onclick = function () {
          var entries = typeof window.entries !== 'undefined' ? window.entries : [];
          var comp = computeFromEntries(entries);
          var d = new Date().toISOString().slice(0, 10);
          if (!window.__farmCardBundle.metricValues) window.__farmCardBundle.metricValues = [];
          (window.__farmCardBundle.metricDefinitions || []).forEach(function (def) {
            if (def.source !== 'computed' || !def.computedKey) return;
            var v = comp[def.computedKey];
            if (v === undefined || v === '') return;
            var vals = window.__farmCardBundle.metricValues;
            var replaced = false;
            for (var i = 0; i < vals.length; i++) {
              if (vals[i].metricId === def.id && vals[i].valueDate === d) {
                vals[i].valueText = v;
                vals[i].source = 'computed';
                replaced = true;
                break;
              }
            }
            if (!replaced) {
              vals.push({ id: null, metricId: def.id, valueDate: d, valueText: v, source: 'computed' });
            }
          });
          markFarmCardDirty();
          if (typeof showToast === 'function') showToast('Поголовье из описи обновлено на ' + d, 'success');
          renderFarmCardPanel();
        };
      }

      var kpiTplBtn = document.getElementById('farmCardKpiTemplateBtn');
      if (kpiTplBtn) {
        kpiTplBtn.onclick = function () {
          if (window.CattleTrackerHerdImport && typeof window.CattleTrackerHerdImport.downloadTemplate === 'function') {
            window.CattleTrackerHerdImport.downloadTemplate();
            if (typeof showToast === 'function') showToast('Шаблон скачан', 'success');
          } else if (typeof showToast === 'function') {
            showToast('Модуль импорта не загружен', 'error');
          }
        };
      }
      var kpiImpBtn = document.getElementById('farmCardKpiImportBtn');
      var kpiImpFile = document.getElementById('farmCardKpiImportFile');
      if (kpiImpBtn && kpiImpFile) {
        kpiImpBtn.onclick = function () {
          kpiImpFile.click();
        };
        kpiImpFile.onchange = function () {
          var files = kpiImpFile.files ? Array.prototype.slice.call(kpiImpFile.files) : [];
          kpiImpFile.value = '';
          if (!files.length) return;
          var imp = window.CattleTrackerHerdImport;
          if (!imp || (typeof imp.parseFiles !== 'function' && typeof imp.parseFile !== 'function')) {
            if (typeof showToast === 'function') showToast('Модуль импорта не загружен', 'error');
            return;
          }
          var status = document.getElementById('farmCardSaveStatus');
          if (status) status.textContent = 'Импорт…';
          var parsePromise =
            typeof imp.parseFiles === 'function'
              ? imp.parseFiles(files)
              : imp.parseFile(files[0]);
          parsePromise.then(function (result) {
            if (!result || !result.ok) {
              var errMsg = (result && result.errors && result.errors.length ? result.errors.join('; ') : 'Нет данных');
              if (status) status.textContent = 'Ошибка';
              if (typeof showToast === 'function') showToast(errMsg, 'error');
              return;
            }
            var applied = imp.applyParseResult(window.__farmCardBundle, result);
            window.__farmCardBundle = applied.bundle;
            markFarmCardDirty();
            var nM = (result.metricValues || []).length;
            var nB = (result.bullFertility || []).length;
            var warn = (result.errors || []).length ? ' (' + result.errors.join('; ') + ')' : '';
            saveFarmCardBundle(window.__farmCardBundle)
              .then(function () {
                if (status) status.textContent = 'Сохранено';
                if (typeof showToast === 'function') {
                  showToast('Импорт KPI: метрик ' + nM + ', быков ' + nB + warn, 'success');
                }
                renderFarmCardPanel();
              })
              .catch(function (e) {
                if (status) status.textContent = 'Ошибка';
                if (typeof showToast === 'function') {
                  showToast((e && e.message) || 'Ошибка сохранения после импорта', 'error');
                }
                renderFarmCardPanel();
              });
          });
        };
      }

      function fillReproFormFromYm(ym) {
        var monthEl = document.getElementById('farmCardReproMonth');
        if (monthEl) monthEl.value = ym || '';
        var vals = window.__farmCardBundle.metricValues || [];
        var ids = REPRO_MONTH_METRIC_IDS;
        var map = {
          farmCardReproCowsCr: ids.cows_cr,
          farmCardReproCowsHdr: ids.cows_hdr,
          farmCardReproCowsPr: ids.cows_pr,
          farmCardReproHeifCr: ids.heif_cr,
          farmCardReproHeifHdr: ids.heif_hdr,
          farmCardReproHeifPr: ids.heif_pr
        };
        Object.keys(map).forEach(function (elId) {
          var el = document.getElementById(elId);
          if (el) el.value = getMetricTextForMonth(vals, map[elId], ym);
        });
      }

      root.querySelectorAll('.farm-card-repro-edit').forEach(function (btn) {
        btn.onclick = function () {
          fillReproFormFromYm(btn.getAttribute('data-ym') || '');
          var form = root.querySelector('.farm-card-repro-form');
          if (form && form.scrollIntoView) form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        };
      });

      var reproSave = document.getElementById('farmCardReproSaveBtn');
      if (reproSave) {
        reproSave.onclick = function () {
          var ym = toYearMonth((document.getElementById('farmCardReproMonth') || {}).value || '');
          if (!ym) {
            if (typeof showToast === 'function') showToast('Укажите месяц', 'error');
            return;
          }
          if (!window.__farmCardBundle.metricValues) window.__farmCardBundle.metricValues = [];
          var vals = window.__farmCardBundle.metricValues;
          var ids = REPRO_MONTH_METRIC_IDS;
          upsertMetricForMonth(vals, ids.cows_cr, ym, (document.getElementById('farmCardReproCowsCr') || {}).value);
          upsertMetricForMonth(vals, ids.cows_hdr, ym, (document.getElementById('farmCardReproCowsHdr') || {}).value);
          upsertMetricForMonth(vals, ids.cows_pr, ym, (document.getElementById('farmCardReproCowsPr') || {}).value);
          upsertMetricForMonth(vals, ids.heif_cr, ym, (document.getElementById('farmCardReproHeifCr') || {}).value);
          upsertMetricForMonth(vals, ids.heif_hdr, ym, (document.getElementById('farmCardReproHeifHdr') || {}).value);
          upsertMetricForMonth(vals, ids.heif_pr, ym, (document.getElementById('farmCardReproHeifPr') || {}).value);
          markFarmCardDirty();
          renderFarmCardPanel();
        };
      }

      var yearEdit = document.querySelector('.farm-card-repro-year-scroll');
      if (yearEdit) {
        yearEdit.onclick = function () {
          var form = root.querySelector('.farm-card-repro-form');
          if (form && form.scrollIntoView) form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          var y = document.getElementById('farmCardYearCowsCr');
          if (y) y.focus();
        };
      }
      var yearSave = document.getElementById('farmCardReproYearSaveBtn');
      if (yearSave) {
        yearSave.onclick = function () {
          var yIds = REPRO_YEAR_METRIC_IDS;
          var d = new Date().toISOString().slice(0, 10);
          if (!window.__farmCardBundle.metricValues) window.__farmCardBundle.metricValues = [];
          var vals = window.__farmCardBundle.metricValues;
          function putYear(metricId, elId) {
            var t = ((document.getElementById(elId) || {}).value || '').trim();
            var replaced = false;
            for (var j = 0; j < vals.length; j++) {
              if (vals[j].metricId === metricId && vals[j].valueDate === d) {
                if (t === '') {
                  vals.splice(j, 1);
                } else {
                  vals[j].valueText = t;
                  vals[j].source = 'manual';
                }
                replaced = true;
                break;
              }
            }
            if (!replaced && t !== '') {
              vals.push({ id: null, metricId: metricId, valueDate: d, valueText: t, source: 'manual' });
            }
          }
          putYear(yIds.cows_cr, 'farmCardYearCowsCr');
          putYear(yIds.cows_hdr, 'farmCardYearCowsHdr');
          putYear(yIds.cows_pr, 'farmCardYearCowsPr');
          putYear(yIds.heif_cr, 'farmCardYearHeifCr');
          putYear(yIds.heif_hdr, 'farmCardYearHeifHdr');
          putYear(yIds.heif_pr, 'farmCardYearHeifPr');
          markFarmCardDirty();
          renderFarmCardPanel();
        };
      }

      var bfAdd = document.getElementById('farmCardBfAddBtn');
      if (bfAdd) {
        bfAdd.onclick = function () {
          var bullName = ((document.getElementById('farmCardBfBull') || {}).value || '').trim();
          var periodMonth = toYearMonth((document.getElementById('farmCardBfMonth') || {}).value || '');
          var crPct = ((document.getElementById('farmCardBfCr') || {}).value || '').trim();
          if (!bullName) {
            if (typeof showToast === 'function') showToast('Укажите кличку быка', 'error');
            return;
          }
          if (!periodMonth) {
            if (typeof showToast === 'function') showToast('Укажите месяц', 'error');
            return;
          }
          if (!crPct) {
            if (typeof showToast === 'function') showToast('Укажите CR %', 'error');
            return;
          }
          if (!window.__farmCardBundle.bullFertility) window.__farmCardBundle.bullFertility = [];
          upsertBullCr(window.__farmCardBundle.bullFertility, periodMonth, bullName, crPct);
          persistBullFertilityChange('CR по быку сохранён');
        };
      }
      root.querySelectorAll('.farm-card-bf-del-cell').forEach(function (btn) {
        btn.onclick = function () {
          var ym = btn.getAttribute('data-ym') || '';
          var bull = btn.getAttribute('data-bull') || '';
          if (!ym || !bull) return;
          if (!window.__farmCardBundle.bullFertility) window.__farmCardBundle.bullFertility = [];
          upsertBullCr(window.__farmCardBundle.bullFertility, ym, bull, '');
          persistBullFertilityChange('Показатель удалён');
        };
      });
      root.querySelectorAll('.farm-card-bf-del-bull').forEach(function (btn) {
        btn.onclick = function () {
          var bull = btn.getAttribute('data-bull') || '';
          if (!bull) return;
          var ok =
            typeof showConfirmModal === 'function'
              ? null
              : window.confirm('Удалить быка «' + bull + '» со всеми месяцами?');
          function doDel() {
            if (!window.__farmCardBundle.bullFertility) window.__farmCardBundle.bullFertility = [];
            removeBullAll(window.__farmCardBundle.bullFertility, bull);
            persistBullFertilityChange('Бык удалён');
          }
          if (typeof showConfirmModal === 'function') {
            showConfirmModal('Удалить быка «' + bull + '» со всеми месяцами?', {
              confirmText: 'Удалить',
              cancelText: 'Отмена'
            }).then(function (confirmed) {
              if (confirmed) doDel();
            });
          } else if (ok) {
            doDel();
          }
        };
      });
      root.querySelectorAll('.farm-card-bf-del-month').forEach(function (btn) {
        btn.onclick = function () {
          var ym = btn.getAttribute('data-ym') || '';
          if (!ym) return;
          var label = formatYearMonthRu(ym);
          function doDelMonth() {
            if (!window.__farmCardBundle.bullFertility) window.__farmCardBundle.bullFertility = [];
            removeBullMonth(window.__farmCardBundle.bullFertility, ym);
            persistBullFertilityChange('Месяц удалён');
          }
          if (typeof showConfirmModal === 'function') {
            showConfirmModal('Удалить все показатели быков за ' + label + '?', {
              confirmText: 'Удалить',
              cancelText: 'Отмена'
            }).then(function (confirmed) {
              if (confirmed) doDelMonth();
            });
          } else if (window.confirm('Удалить все показатели быков за ' + label + '?')) {
            doDelMonth();
          }
        };
      });
      root.querySelectorAll('.farm-card-bf-cell-fill').forEach(function (btn) {
        btn.onclick = function () {
          var ym = btn.getAttribute('data-ym') || '';
          var bull = btn.getAttribute('data-bull') || '';
          var monthEl = document.getElementById('farmCardBfMonth');
          var bullEl = document.getElementById('farmCardBfBull');
          var crEl = document.getElementById('farmCardBfCr');
          if (monthEl) monthEl.value = ym;
          if (bullEl) bullEl.value = bull;
          if (crEl) crEl.focus();
          var form = root.querySelector('.farm-card-bf-form');
          if (form && form.scrollIntoView) form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        };
      });
      root.querySelectorAll('.farm-card-bf-month-edit').forEach(function (btn) {
        btn.onclick = function () {
          var ym = btn.getAttribute('data-ym') || '';
          var monthEl = document.getElementById('farmCardBfMonth');
          if (monthEl) monthEl.value = ym;
          var form = root.querySelector('.farm-card-bf-form');
          if (form && form.scrollIntoView) form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        };
      });

      var addEv = document.getElementById('farmCardAddEvBtn');
      if (addEv) {
        addEv.onclick = function () {
          var type = (document.getElementById('farmCardNewEvType') || {}).value || 'shtab';
          var eventDate = (document.getElementById('farmCardNewEvDate') || {}).value || today;
          var title = ((document.getElementById('farmCardNewEvTitle') || {}).value || '').trim();
          var description = ((document.getElementById('farmCardNewEvDesc') || {}).value || '').trim();
          var participants = collectEventParticipantsFromForm();
          if (!title && !description && !_timelineDraftAttachments.length) {
            if (typeof showToast === 'function') showToast('Укажите название, описание или файл', 'error');
            return;
          }
          if (!window.__farmCardBundle.events) window.__farmCardBundle.events = [];
          window.__farmCardBundle.events.push({
            id: newId('ev_'),
            eventType: type,
            eventDate: eventDate,
            title: title,
            participants: participants,
            description: description,
            task: '',
            goal: '',
            reminderAt: '',
            completed: false,
            notifyLocal: true,
            attachments: _timelineDraftAttachments.slice()
          });
          _timelineDraftAttachments = [];
          _timelineFormOpen = false;
          clearTimelineDraft();
          markFarmCardDirty();
          if (typeof showToast === 'function') showToast('Запись добавлена. Не забудьте «Сохранить карточку».', 'success');
          renderFarmCardPanel();
        };
      }
      root.querySelectorAll('.farm-card-ev-del').forEach(function (btn) {
        btn.onclick = function () {
          var id = btn.getAttribute('data-ev-id');
          window.__farmCardBundle.events = (window.__farmCardBundle.events || []).filter(function (e) {
            return e.id !== id;
          });
          markFarmCardDirty();
          renderFarmCardPanel();
        };
      });
      root.querySelectorAll('.farm-card-ev-toggle').forEach(function (btn) {
        btn.onclick = function () {
          var id = btn.getAttribute('data-ev-id');
          (window.__farmCardBundle.events || []).forEach(function (e) {
            if (e && e.id === id) e.completed = !e.completed;
          });
          markFarmCardDirty();
          renderFarmCardPanel();
        };
      });

      var fApply = document.getElementById('farmCardEvFilterApply');
      if (fApply) {
        fApply.onclick = function () {
          window.__farmTimelineFilterType = (document.getElementById('farmCardEvFilterType') || {}).value || '';
          window.__farmTimelineFilterText = (document.getElementById('farmCardEvFilterText') || {}).value || '';
          window.__farmTimelineSort = window.__farmTimelineSort || { key: 'eventDate', dir: 'desc' };
          window.__farmTimelineSort.dir = (document.getElementById('farmCardEvSortDir') || {}).value || 'desc';
          renderFarmCardPanel();
        };
      }

      var saveAll = document.getElementById('farmCardSaveAllBtn');
      if (saveAll) {
        saveAll.onclick = function () {
          var status = document.getElementById('farmCardSaveStatus');
          if (status) status.textContent = 'Сохранение…';
          syncAddressPaneToBundle();
          _addrEditIdx = -1;
          _specEditIdx = -1;
          saveFarmCardBundle(window.__farmCardBundle)
            .then(function (saved) {
              if (status) status.textContent = 'Сохранено';
              var pendingN = saved && saved._bitrixPendingCreated;
              if (typeof showToast === 'function') {
                showToast(
                  pendingN
                    ? 'Сохранено. В очередь Битрикс: ' + pendingN
                    : 'Карточка хозяйства сохранена',
                  'success'
                );
              }
              renderFarmCardPanel();
            })
            .catch(function (e) {
              if (status) status.textContent = 'Ошибка';
              if (typeof showToast === 'function') showToast((e && e.message) || 'Ошибка', 'error');
            });
        };
      }
    }

    root.querySelectorAll('.farm-card-phone-call').forEach(function (btn) {
      btn.onclick = function (ev) {
        if (ev && ev.preventDefault) ev.preventDefault();
        initiatePhoneCall(btn.getAttribute('data-phone'));
      };
    });
    root.querySelectorAll('.farm-card-geo-share-max').forEach(function (btn) {
      btn.onclick = function (ev) {
        if (ev && ev.preventDefault) ev.preventDefault();
        if (ev && ev.stopPropagation) ev.stopPropagation();
        try {
          var i = parseInt(btn.getAttribute('data-addr-idx'), 10);
          var geo = window.__farmCardBundle && window.__farmCardBundle.addresses
            ? window.__farmCardBundle.addresses[i]
            : null;
          shareGeopositionToMax(geo, window.__farmCardBundle && window.__farmCardBundle.addressInfo);
        } catch (err) {
          if (typeof showToast === 'function') showToast((err && err.message) || 'Ошибка отправки в MAX', 'error');
        }
      };
    });
    root.querySelectorAll('.farm-card-spec-share-max').forEach(function (btn) {
      btn.onclick = function (ev) {
        if (ev && ev.preventDefault) ev.preventDefault();
        if (ev && ev.stopPropagation) ev.stopPropagation();
        try {
          var i = parseInt(btn.getAttribute('data-spec-idx'), 10);
          var spec =
            window.__farmCardBundle && window.__farmCardBundle.specialists
              ? window.__farmCardBundle.specialists[i]
              : null;
          shareSpecialistToMax(spec);
        } catch (err) {
          if (typeof showToast === 'function') showToast((err && err.message) || 'Ошибка отправки в MAX', 'error');
        }
      };
    });

    var reloadB = document.getElementById('farmCardReloadBtn');
    if (reloadB) {
      reloadB.onclick = function () {
        ensureFarmCardLoaded().then(function () {
          renderFarmCardPanel();
          if (typeof showToast === 'function') showToast('Обновлено', 'success');
        });
      };
    }

    if (canEdit) {
      globalThis['__farmCard'].bindFarmCardGeosuggest();
    }
    if (typeof globalThis['__farmCard'].bindCrmHandlers === 'function') {
      globalThis['__farmCard'].bindCrmHandlers(root, canEdit, renderFarmCardPanel);
    }
  }

  // register functions
  NS.escapeHtml = escapeHtml;
  NS.newId = newId;
  NS.emptyBundle = emptyBundle;
  NS.defaultMetricDefinitions = defaultMetricDefinitions;
  NS.mergeDefaultMetrics = mergeDefaultMetrics;
  NS.readFarmCardCache = readFarmCardCache;
  NS.writeFarmCardCache = writeFarmCardCache;
  NS.getObjectIdForFarm = getObjectIdForFarm;
  NS.farmCardCanEdit = farmCardCanEdit;
  NS.normalizeBundle = normalizeBundle;
  NS.normalizeItem = normalizeItem;
  NS.normalizeGoal = normalizeGoal;
  NS.normalizeEvent = normalizeEvent;
  NS.refreshGoalStatuses = refreshGoalStatuses;
  NS.countHerdCows = countHerdCows;
  NS.countCalves = countCalves;
  NS.computeFromEntries = computeFromEntries;
  NS.getFarmCardBundleForExport = getFarmCardBundleForExport;
  NS.ensureFarmCardLoaded = ensureFarmCardLoaded;
  NS.saveFarmCardBundle = saveFarmCardBundle;
  NS.markFarmCardDirty = markFarmCardDirty;
  NS.clearFarmCardDirty = clearFarmCardDirty;
  NS.farmCardHasUnsavedChanges = farmCardHasUnsavedChanges;
  NS.confirmLeaveFarmCardIfNeeded = confirmLeaveFarmCardIfNeeded;
  NS.currentMetricSnapshot = currentMetricSnapshot;
  NS.renderFarmCardPanel = renderFarmCardPanel;
})();
export {};
