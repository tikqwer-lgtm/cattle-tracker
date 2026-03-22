/**
 * Настройки хозяйства: списки техников ИО и быков; подсказки для полей осеменения.
 */
(function () {
  'use strict';

  var TECH_KEY = 'cattleTracker_farmTechnicians';
  var BULLS_KEY = 'cattleTracker_farmBulls';

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
  }

  function fillOneCodeSelect(sel, preserveValue) {
    if (!sel || sel.tagName !== 'SELECT') return;
    var current = preserveValue !== undefined ? preserveValue : sel.value;
    sel.innerHTML = '';
    var optEmpty = document.createElement('option');
    optEmpty.value = '';
    optEmpty.textContent = '—';
    sel.appendChild(optEmpty);
    function addOpt(val, label) {
      var o = document.createElement('option');
      o.value = val;
      o.textContent = label || val;
      sel.appendChild(o);
    }
    addOpt('Охота', 'Охота');
    addOpt('Датчик', 'Датчик');
    var getProtocolsFn = typeof window.getProtocols === 'function' ? window.getProtocols : (typeof getProtocols === 'function' ? getProtocols : null);
    var list = getProtocolsFn ? getProtocolsFn() : [];
    if (!Array.isArray(list)) list = [];
    list.forEach(function (p) {
      var name = (p && (p.name || p.id)) ? String(p.name || p.id).trim() : '';
      if (!name || name === 'Охота' || name === 'Датчик') return;
      addOpt(name, name);
    });
    if (current && Array.prototype.some.call(sel.options, function (o) { return o.value === current; })) {
      sel.value = current;
    }
  }

  /** Код осеменения: экран пакетного осеменения и карточка коровы */
  function fillAllInseminationCodeSelects() {
    fillOneCodeSelect(document.getElementById('codeInsem'));
    fillOneCodeSelect(document.getElementById('code'));
  }

  function initFarmSettingsScreen() {
    var taTech = document.getElementById('farmSettingsTechnicians');
    var taBulls = document.getElementById('farmSettingsBulls');
    var btn = document.getElementById('farmSettingsSaveBtn');
    if (taTech) taTech.value = linesToText(getFarmTechnicians());
    if (taBulls) taBulls.value = linesToText(getFarmBullsManual());
    if (btn) {
      btn.onclick = function () {
        setFarmTechnicians(parseLines(taTech ? taTech.value : ''));
        setFarmBullsManual(parseLines(taBulls ? taBulls.value : ''));
        refreshFarmDatalists();
        fillAllInseminationCodeSelects();
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
    window.refreshFarmDatalists = refreshFarmDatalists;
    window.fillAllInseminationCodeSelects = fillAllInseminationCodeSelects;
    window.initFarmSettingsScreen = initFarmSettingsScreen;
  }
})();

export {};
