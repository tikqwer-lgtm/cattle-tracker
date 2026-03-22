/**
 * Настройки хозяйства: списки техников ИО и быков; подсказки для полей осеменения.
 */
(function () {
  'use strict';

  var TECH_KEY = 'cattleTracker_farmTechnicians';
  var BULLS_KEY = 'cattleTracker_farmBulls';
  var DRUGS_KEY = 'cattleTracker_farmDrugs';

  function parseLines(text) {
    if (!text || typeof text !== 'string') return [];
    return text.split(/\r?\n/).map(function (s) { return s.trim(); }).filter(Boolean);
  }

  function linesToText(arr) {
    if (!Array.isArray(arr)) return '';
    return arr.filter(Boolean).join('\n');
  }

  function getFarmTechnicians() {
    try {
      var raw = localStorage.getItem(TECH_KEY);
      if (!raw) return [];
      var p = JSON.parse(raw);
      return Array.isArray(p) ? p.map(function (s) { return String(s).trim(); }).filter(Boolean) : [];
    } catch (e) {
      return [];
    }
  }

  function setFarmTechnicians(arr) {
    var list = Array.isArray(arr) ? arr.map(function (s) { return String(s).trim(); }).filter(Boolean) : [];
    try {
      localStorage.setItem(TECH_KEY, JSON.stringify(list));
    } catch (err) {
      console.error(err);
    }
  }

  function getFarmBullsManual() {
    try {
      var raw = localStorage.getItem(BULLS_KEY);
      if (!raw) return [];
      var p = JSON.parse(raw);
      return Array.isArray(p) ? p.map(function (s) { return String(s).trim(); }).filter(Boolean) : [];
    } catch (e) {
      return [];
    }
  }

  function setFarmBullsManual(arr) {
    var list = Array.isArray(arr) ? arr.map(function (s) { return String(s).trim(); }).filter(Boolean) : [];
    try {
      localStorage.setItem(BULLS_KEY, JSON.stringify(list));
    } catch (err) {
      console.error(err);
    }
  }

  function getFarmDrugs() {
    try {
      var raw = localStorage.getItem(DRUGS_KEY);
      if (!raw) return [];
      var p = JSON.parse(raw);
      return Array.isArray(p) ? p.map(function (s) { return String(s).trim(); }).filter(Boolean) : [];
    } catch (e) {
      return [];
    }
  }

  function setFarmDrugs(arr) {
    var list = Array.isArray(arr) ? arr.map(function (s) { return String(s).trim(); }).filter(Boolean) : [];
    try {
      localStorage.setItem(DRUGS_KEY, JSON.stringify(list));
    } catch (err) {
      console.error(err);
    }
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
    fillDatalistById('datalist-farm-technicians', getFarmTechnicians());
    fillDatalistById('datalist-farm-drugs', getFarmDrugs());
  }

  function initFarmSettingsScreen() {
    var taTech = document.getElementById('farmSettingsTechnicians');
    var taBulls = document.getElementById('farmSettingsBulls');
    var taDrugs = document.getElementById('farmSettingsDrugs');
    var btn = document.getElementById('farmSettingsSaveBtn');
    if (taTech) taTech.value = linesToText(getFarmTechnicians());
    if (taBulls) taBulls.value = linesToText(getFarmBullsManual());
    if (taDrugs) taDrugs.value = linesToText(getFarmDrugs());
    if (btn) {
      btn.onclick = function () {
        setFarmTechnicians(parseLines(taTech ? taTech.value : ''));
        setFarmBullsManual(parseLines(taBulls ? taBulls.value : ''));
        setFarmDrugs(parseLines(taDrugs ? taDrugs.value : ''));
        refreshFarmDatalists();
        if (typeof window.fillAllInseminationCodeSelects === 'function') window.fillAllInseminationCodeSelects();
        if (typeof showToast === 'function') showToast('Сохранено', 'success');
        else alert('Сохранено');
      };
    }
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
    window.collectBullsFromEntries = collectBullsFromEntries;
    window.getMergedBullSuggestions = getMergedBullSuggestions;
    window.getFarmDrugs = getFarmDrugs;
    window.setFarmDrugs = setFarmDrugs;
    window.refreshFarmDatalists = refreshFarmDatalists;
    window.initFarmSettingsScreen = initFarmSettingsScreen;
  }
})();

export {};
