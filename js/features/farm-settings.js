/**
 * Настройки хозяйства: списки техников ИО и быков; подсказки для полей осеменения.
 */
(function () {
  'use strict';

  function currentObjectId() {
    return typeof window.getCurrentObjectId === 'function' ? (window.getCurrentObjectId() || 'default') : 'default';
  }

  function techKey() {
    if (window.CattleTrackerObjectData) {
      return window.CattleTrackerObjectData.keyFor(window.CattleTrackerObjectData.TECH_PREFIX, currentObjectId());
    }
    return 'cattleTracker_farmTechnicians_' + currentObjectId();
  }

  function bullsKey() {
    if (window.CattleTrackerObjectData) {
      return window.CattleTrackerObjectData.keyFor(window.CattleTrackerObjectData.BULLS_PREFIX, currentObjectId());
    }
    return 'cattleTracker_farmBulls_' + currentObjectId();
  }

  function drugsKey() {
    if (window.CattleTrackerObjectData) {
      return window.CattleTrackerObjectData.keyFor(window.CattleTrackerObjectData.DRUGS_PREFIX, currentObjectId());
    }
    return 'cattleTracker_farmDrugs_' + currentObjectId();
  }

  function useFarmSettingsApi() {
    return typeof window !== 'undefined' && window.CATTLE_TRACKER_USE_API && window.CattleTrackerApi &&
      typeof window.CattleTrackerApi.putFarmSettings === 'function';
  }

  function parseLines(text) {
    if (!text || typeof text !== 'string') return [];
    return text.split(/\r?\n/).map(function (s) { return s.trim(); }).filter(Boolean);
  }

  function linesToText(arr) {
    if (!Array.isArray(arr)) return '';
    return arr.filter(Boolean).join('\n');
  }

  function getFarmTechnicians() {
    if (window.CattleTrackerObjectData) {
      window.CattleTrackerObjectData.migrateGlobalToDefaultOnce();
      var s = window.CattleTrackerObjectData.loadFarmSettingsLocal(currentObjectId());
      return Array.isArray(s.technicians) ? s.technicians.map(function (x) { return String(x).trim(); }).filter(Boolean) : [];
    }
    try {
      var raw = localStorage.getItem(techKey());
      if (!raw) return [];
      var p = JSON.parse(raw);
      return Array.isArray(p) ? p.map(function (s) { return String(s).trim(); }).filter(Boolean) : [];
    } catch (e) {
      return [];
    }
  }

  function setFarmTechnicians(arr) {
    var list = Array.isArray(arr) ? arr.map(function (s) { return String(s).trim(); }).filter(Boolean) : [];
    if (window.CattleTrackerObjectData) {
      var s = window.CattleTrackerObjectData.loadFarmSettingsLocal(currentObjectId());
      s.technicians = list;
      window.CattleTrackerObjectData.saveFarmSettingsLocal(currentObjectId(), s);
      return;
    }
    try {
      localStorage.setItem(techKey(), JSON.stringify(list));
    } catch (err) {
      console.error(err);
    }
  }

  function getFarmBullsManual() {
    if (window.CattleTrackerObjectData) {
      var s2 = window.CattleTrackerObjectData.loadFarmSettingsLocal(currentObjectId());
      return Array.isArray(s2.bulls) ? s2.bulls.map(function (x) { return String(x).trim(); }).filter(Boolean) : [];
    }
    try {
      var raw = localStorage.getItem(bullsKey());
      if (!raw) return [];
      var p = JSON.parse(raw);
      return Array.isArray(p) ? p.map(function (s) { return String(s).trim(); }).filter(Boolean) : [];
    } catch (e) {
      return [];
    }
  }

  function setFarmBullsManual(arr) {
    var list = Array.isArray(arr) ? arr.map(function (s) { return String(s).trim(); }).filter(Boolean) : [];
    if (window.CattleTrackerObjectData) {
      var s = window.CattleTrackerObjectData.loadFarmSettingsLocal(currentObjectId());
      s.bulls = list;
      window.CattleTrackerObjectData.saveFarmSettingsLocal(currentObjectId(), s);
      return;
    }
    try {
      localStorage.setItem(bullsKey(), JSON.stringify(list));
    } catch (err) {
      console.error(err);
    }
  }

  function getFarmDrugs() {
    if (window.CattleTrackerObjectData) {
      var s3 = window.CattleTrackerObjectData.loadFarmSettingsLocal(currentObjectId());
      return Array.isArray(s3.drugs) ? s3.drugs.map(function (x) { return String(x).trim(); }).filter(Boolean) : [];
    }
    try {
      var raw = localStorage.getItem(drugsKey());
      if (!raw) return [];
      var p = JSON.parse(raw);
      return Array.isArray(p) ? p.map(function (s) { return String(s).trim(); }).filter(Boolean) : [];
    } catch (e) {
      return [];
    }
  }

  function setFarmDrugs(arr) {
    var list = Array.isArray(arr) ? arr.map(function (s) { return String(s).trim(); }).filter(Boolean) : [];
    if (window.CattleTrackerObjectData) {
      var s = window.CattleTrackerObjectData.loadFarmSettingsLocal(currentObjectId());
      s.drugs = list;
      window.CattleTrackerObjectData.saveFarmSettingsLocal(currentObjectId(), s);
      return;
    }
    try {
      localStorage.setItem(drugsKey(), JSON.stringify(list));
    } catch (err) {
      console.error(err);
    }
  }

  function normalizeVwpDays(raw) {
    var n = parseInt(raw, 10);
    if (!Number.isFinite(n)) return 60;
    if (n < 30) return 30;
    if (n > 120) return 120;
    return n;
  }

  function getFarmVwpDays() {
    if (window.CattleTrackerObjectData) {
      var s = window.CattleTrackerObjectData.loadFarmSettingsLocal(currentObjectId());
      return normalizeVwpDays(s && s.vwpDays);
    }
    return 60;
  }

  function setFarmVwpDays(days) {
    var v = normalizeVwpDays(days);
    if (window.CattleTrackerObjectData) {
      var s2 = window.CattleTrackerObjectData.loadFarmSettingsLocal(currentObjectId());
      s2.vwpDays = v;
      window.CattleTrackerObjectData.saveFarmSettingsLocal(currentObjectId(), s2);
    }
    return v;
  }

  function persistFarmSettingsToServer() {
    if (!useFarmSettingsApi()) return Promise.resolve();
    return window.CattleTrackerApi.putFarmSettings(currentObjectId(), {
      technicians: getFarmTechnicians(),
      bulls: getFarmBullsManual(),
      drugs: getFarmDrugs(),
      vwpDays: getFarmVwpDays()
    });
  }

  /**
   * Уникальные значения «бык» из описи (поле bull и история осеменений).
   */
  function collectBullsFromEntries() {
    var out = [];
    var seen = Object.create(null);
    var entries = typeof window !== 'undefined' && window.entries && Array.isArray(window.entries) ? window.entries : [];
    function add(b) {
      if (!b) return;
      var s = String(b).trim();
      if (!s || seen[s]) return;
      seen[s] = true;
      out.push(s);
    }
    entries.forEach(function (e) {
      if (!e) return;
      add(e.bull);
      if (e.inseminationHistory && e.inseminationHistory.length) {
        e.inseminationHistory.forEach(function (h) {
          if (h && h.bull) add(h.bull);
        });
      }
    });
    out.sort(function (a, b) { return a.localeCompare(b, 'ru'); });
    return out;
  }

  /** Объединённые подсказки для быков: справочник + опись */
  function getMergedBullSuggestions() {
    var manual = getFarmBullsManual();
    var fromHerd = collectBullsFromEntries();
    var seen = Object.create(null);
    var merged = [];
    manual.forEach(function (s) {
      if (seen[s]) return;
      seen[s] = true;
      merged.push(s);
    });
    fromHerd.forEach(function (s) {
      if (seen[s]) return;
      seen[s] = true;
      merged.push(s);
    });
    merged.sort(function (a, b) { return a.localeCompare(b, 'ru'); });
    return merged;
  }

  function fillDatalistById(datalistId, values) {
    var dl = document.getElementById(datalistId);
    if (!dl || dl.tagName !== 'DATALIST') return;
    dl.innerHTML = '';
    (values || []).forEach(function (v) {
      var s = String(v).trim();
      if (!s) return;
      var opt = document.createElement('option');
      opt.value = s;
      dl.appendChild(opt);
    });
  }

  /**
   * Заполняет глобальные datalist для быков и техников (вызывать после загрузки entries / сохранения настроек).
   */
  function refreshFarmDatalists() {
    fillDatalistById('datalist-farm-bulls', getMergedBullSuggestions());
    var techs = getFarmTechnicians() || [];
    var login = '';
    if (typeof getCurrentUser === 'function' && getCurrentUser()) {
      login = String(getCurrentUser().username || '').trim();
    }
    var techVals = [];
    var seenTech = {};
    if (login) {
      techVals.push(login);
      seenTech[login.toLowerCase()] = true;
    }
    techs.forEach(function (t) {
      var s = String(t || '').trim();
      if (!s || seenTech[s.toLowerCase()]) return;
      seenTech[s.toLowerCase()] = true;
      techVals.push(s);
    });
    fillDatalistById('datalist-farm-technicians', techVals);
    fillDatalistById('datalist-farm-drugs', getFarmDrugs());
  }

  function farmSettingsIsAdmin() {
    var u = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
    if (!u) return false;
    if (typeof window.hasCapability === 'function') return window.hasCapability('farmCardSettings', u);
    return u.role === 'admin';
  }

  function renderFarmChipList(ulId, items, editable, onRemoveAt) {
    var ul = document.getElementById(ulId);
    if (!ul) return;
    ul.innerHTML = '';
    (items || []).forEach(function (text, idx) {
      var li = document.createElement('li');
      li.className = 'farm-settings-chip';
      var span = document.createElement('span');
      span.className = 'farm-settings-chip-text';
      span.textContent = text;
      li.appendChild(span);
      if (editable) {
        var rm = document.createElement('button');
        rm.type = 'button';
        rm.className = 'small-btn farm-settings-chip-remove';
        rm.setAttribute('aria-label', 'Удалить из списка');
        rm.textContent = '×';
        rm.onclick = function () {
          onRemoveAt(idx);
        };
        li.appendChild(rm);
      }
      ul.appendChild(li);
    });
  }

  function initFarmSettingsScreen() {
    /* UI перенесён в js/screens/FarmSettings.tsx; оставляем refresh datalist для других экранов. */
    refreshFarmDatalists();
  }

  if (typeof window !== 'undefined' && window.CattleTrackerEvents && typeof window.CattleTrackerEvents.on === 'function') {
    window.CattleTrackerEvents.on('entries:updated', function () {
      refreshFarmDatalists();
    });
  }

  if (typeof window !== 'undefined') {
    window.getFarmTechnicians = getFarmTechnicians;
    window.setFarmTechnicians = setFarmTechnicians;
    window.getFarmBullsManual = getFarmBullsManual;
    window.setFarmBullsManual = setFarmBullsManual;
    window.persistFarmSettingsToServer = persistFarmSettingsToServer;
    window.collectBullsFromEntries = collectBullsFromEntries;
    window.getMergedBullSuggestions = getMergedBullSuggestions;
    window.getFarmDrugs = getFarmDrugs;
    window.setFarmDrugs = setFarmDrugs;
    window.refreshFarmDatalists = refreshFarmDatalists;
    window.initFarmSettingsScreen = initFarmSettingsScreen;
    window.getFarmVwpDays = getFarmVwpDays;
    window.setFarmVwpDays = setFarmVwpDays;
  }
})();

export {};
