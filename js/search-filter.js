/**
 * search-filter.js — Поиск и фильтрация записей
 */
(function (global) {
  'use strict';

  var searchQuery = '';
  var filters = {
    status: [],
    lactation: null,
    dateFrom: '',
    dateTo: '',
    synced: null,
    group: '',
    bull: ''
  };
  var STORAGE_KEY = 'cattleTracker_search_filter';

  function loadSavedFilters() {
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        var parsed = JSON.parse(saved);
        if (parsed.status) filters.status = parsed.status;
        if (parsed.lactation != null) filters.lactation = parsed.lactation;
        if (parsed.dateFrom) filters.dateFrom = parsed.dateFrom;
        if (parsed.dateTo) filters.dateTo = parsed.dateTo;
        if (parsed.synced != null) filters.synced = parsed.synced;
        if (parsed.group) filters.group = parsed.group;
        if (parsed.bull) filters.bull = parsed.bull;
      }
    } catch (e) {
      console.warn('search-filter: не удалось загрузить сохранённые фильтры', e);
    }
  }

  function saveFilters() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
    } catch (e) {
      console.warn('search-filter: не удалось сохранить фильтры', e);
    }
  }

  /**
   * Поиск по всем полям записи
   * @param {string} query
   * @param {Array} list
   * @returns {Array}
   */
  function searchEntries(query, list) {
    if (!list) list = (typeof entries !== 'undefined' ? entries : []);
    var q = (query || '').toLowerCase().trim();
    if (!q) return list;
    return list.filter(function (entry) {
      var cattleId = (entry.cattleId || '').toLowerCase();
      var nickname = (entry.nickname || '').toLowerCase();
      var status = (entry.status || '').toLowerCase();
      var bull = (entry.bull || '').toLowerCase();
      var code = (entry.code || '').toLowerCase();
      var note = (entry.note || '').toLowerCase();
      var inseminator = (entry.inseminator || '').toLowerCase();
      var protocolName = (entry.protocol && entry.protocol.name) ? entry.protocol.name.toLowerCase() : '';
      var group = (entry.group || '').toLowerCase();
      return cattleId.indexOf(q) !== -1 ||
             nickname.indexOf(q) !== -1 ||
             group.indexOf(q) !== -1 ||
             status.indexOf(q) !== -1 ||
             bull.indexOf(q) !== -1 ||
             code.indexOf(q) !== -1 ||
             note.indexOf(q) !== -1 ||
             inseminator.indexOf(q) !== -1 ||
             protocolName.indexOf(q) !== -1;
    });
  }

  /**
   * Фильтрация по критериям
   * @param {Object} f
   * @param {Array} list
   * @returns {Array}
   */
  function filterEntries(f, list) {
    if (!list) list = (typeof entries !== 'undefined' ? entries : []);
    var result = list;

    if (f.status && f.status.length > 0) {
      var statusSet = {};
      f.status.forEach(function (s) { statusSet[s] = true; });
      result = result.filter(function (e) { return statusSet[e.status]; });
    }
    if (f.lactation != null && f.lactation !== '') {
      var lact = parseInt(f.lactation, 10);
      if (!isNaN(lact)) {
        result = result.filter(function (e) { return (e.lactation || 0) === lact; });
      }
    }
    if (f.dateFrom) {
      result = result.filter(function (e) {
        var d = e.inseminationDate || e.calvingDate || e.dateAdded || '';
        return d >= f.dateFrom;
      });
    }
    if (f.dateTo) {
      result = result.filter(function (e) {
        var d = e.inseminationDate || e.calvingDate || e.dateAdded || '';
        return d <= f.dateTo;
      });
    }
    if (f.synced === true) {
      result = result.filter(function (e) { return e.synced === true; });
    } else if (f.synced === false) {
      result = result.filter(function (e) { return e.synced !== true; });
    }
    if (f.group && String(f.group).trim() !== '') {
      var g = String(f.group).trim().toLowerCase();
      result = result.filter(function (e) { return (e.group || '').toLowerCase().indexOf(g) !== -1; });
    }
    if (f.bull && String(f.bull).trim() !== '') {
      var b = String(f.bull).trim().toLowerCase();
      result = result.filter(function (e) { return (e.bull || '').toLowerCase().indexOf(b) !== -1; });
    }
    return result;
  }

  /**
   * Комбинированный поиск и фильтрация
   * @param {Array} [list]
   * @returns {Array}
   */
  function applySearchAndFilter(list) {
    if (!list) list = (typeof entries !== 'undefined' ? entries : []);
    var step = searchEntries(searchQuery, list);
    return filterEntries(filters, step);
  }

  /**
   * Возвращает массив записей для отображения (с учётом поиска и фильтров)
   */
  function getFilteredEntries() {
    var list = (typeof entries !== 'undefined' ? entries : []);
    return applySearchAndFilter(list);
  }

  function setSearchQuery(q) {
    searchQuery = (q || '').trim();
  }

  function setFilters(f) {
    if (f && typeof f === 'object') {
      if (f.status !== undefined) filters.status = Array.isArray(f.status) ? f.status : [];
      if (f.lactation !== undefined) filters.lactation = f.lactation;
      if (f.dateFrom !== undefined) filters.dateFrom = f.dateFrom;
      if (f.dateTo !== undefined) filters.dateTo = f.dateTo;
      if (f.synced !== undefined) filters.synced = f.synced;
      if (f.group !== undefined) filters.group = f.group;
      if (f.bull !== undefined) filters.bull = f.bull;
      saveFilters();
    }
  }

  function getFilters() {
    return {
      status: filters.status.slice(),
      lactation: filters.lactation,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      synced: filters.synced,
      group: filters.group,
      bull: filters.bull
    };
  }

  /**
   * Рендер UI поиска и фильтров в контейнер
   */
  function renderSearchFilterUI(containerId) {
    var container = document.getElementById(containerId);
    if (!container) return;

    var statusOptions = ['Осемененная', 'Холостая', 'Стельная', 'Сухостой', 'Отёл', 'Брак'];
    var statusChecks = statusOptions.map(function (s) {
      var checked = filters.status.indexOf(s) !== -1 ? ' checked' : '';
      return '<label class="filter-check"><input type="checkbox" data-filter-status="' + s.replace(/"/g, '&quot;') + '"' + checked + '> ' + s + '</label>';
    }).join('');

    var groupVal = (filters.group || '').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    var bullVal = (filters.bull || '').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    container.innerHTML =
      '<div class="search-filter-bar">' +
        '<div class="search-row">' +
          '<input type="text" id="searchEntriesInput" class="search-input" placeholder="Поиск по номеру, кличке, группе, статусу, быку..." value="' + (searchQuery.replace(/"/g, '&quot;').replace(/</g, '&lt;')) + '">' +
          '<button type="button" id="searchFilterClearBtn" class="small-btn">Сбросить фильтры</button>' +
        '</div>' +
        '<div class="filter-row">' +
          '<span class="filter-label">Статус:</span>' + statusChecks +
          '<span class="filter-label">Группа:</span>' +
          '<input type="text" id="filterGroup" placeholder="часть названия" value="' + groupVal + '">' +
          '<span class="filter-label">Бык:</span>' +
          '<input type="text" id="filterBull" placeholder="часть имени" value="' + bullVal + '">' +
          '<span class="filter-label">Лактация:</span>' +
          '<input type="number" id="filterLactation" min="0" max="20" placeholder="—" value="' + ((filters.lactation !== null && filters.lactation !== '') || filters.lactation === 0 ? filters.lactation : '') + '">' +
          '<span class="filter-label">Период (осеменение):</span>' +
          '<input type="date" id="filterDateFrom" value="' + (filters.dateFrom || '') + '"> — ' +
          '<input type="date" id="filterDateTo" value="' + (filters.dateTo || '') + '">' +
          '<label class="filter-check"><input type="radio" name="filterSynced" value="" ' + (filters.synced === null || filters.synced === '' ? ' checked' : '') + '> Все</label>' +
          '<label class="filter-check"><input type="radio" name="filterSynced" value="1" ' + (filters.synced === true ? ' checked' : '') + '> Синхр.</label>' +
          '<label class="filter-check"><input type="radio" name="filterSynced" value="0" ' + (filters.synced === false ? ' checked' : '') + '> Не синхр.</label>' +
        '</div>' +
      '</div>';

    var searchInput = document.getElementById('searchEntriesInput');
    var clearBtn = document.getElementById('searchFilterClearBtn');
    var filterLactation = document.getElementById('filterLactation');
    var filterDateFrom = document.getElementById('filterDateFrom');
    var filterDateTo = document.getElementById('filterDateTo');
    var filterGroup = document.getElementById('filterGroup');
    var filterBull = document.getElementById('filterBull');

    function applyAndUpdateView() {
      searchQuery = searchInput ? searchInput.value.trim() : '';
      filters.lactation = filterLactation && filterLactation.value !== '' ? parseInt(filterLactation.value, 10) : null;
      filters.dateFrom = filterDateFrom ? filterDateFrom.value : '';
      filters.dateTo = filterDateTo ? filterDateTo.value : '';
      filters.group = filterGroup ? filterGroup.value.trim() : '';
      filters.bull = filterBull ? filterBull.value.trim() : '';
      var syncedRadio = document.querySelector('input[name="filterSynced"]:checked');
      if (syncedRadio) {
        if (syncedRadio.value === '1') filters.synced = true;
        else if (syncedRadio.value === '0') filters.synced = false;
        else filters.synced = null;
      }
      var statusChecks = container.querySelectorAll('input[data-filter-status]');
      filters.status = [];
      if (statusChecks && statusChecks.length) {
        statusChecks.forEach(function (cb) {
          if (cb.checked) filters.status.push(cb.getAttribute('data-filter-status'));
        });
      }
      saveFilters();
      if (typeof updateViewList === 'function') updateViewList();
    }

    if (searchInput) {
      searchInput.addEventListener('input', function () {
        setSearchQuery(searchInput.value);
        if (typeof updateViewList === 'function') updateViewList();
      });
      searchInput.addEventListener('keyup', function (e) {
        if (e.key === 'Enter') applyAndUpdateView();
      });
    }
    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        searchQuery = '';
        filters = { status: [], lactation: null, dateFrom: '', dateTo: '', synced: null, group: '', bull: '' };
        saveFilters();
        if (searchInput) searchInput.value = '';
        if (filterLactation) filterLactation.value = '';
        if (filterDateFrom) filterDateFrom.value = '';
        if (filterDateTo) filterDateTo.value = '';
        if (filterGroup) filterGroup.value = '';
        if (filterBull) filterBull.value = '';
        var radios = container.querySelectorAll('input[name="filterSynced"]');
        if (radios.length) radios[0].checked = true;
        container.querySelectorAll('input[data-filter-status]').forEach(function (cb) { cb.checked = false; });
        if (typeof updateViewList === 'function') updateViewList();
      });
    }
    container.querySelectorAll('input[data-filter-status], #filterLactation, #filterDateFrom, #filterDateTo, #filterGroup, #filterBull, input[name="filterSynced"]').forEach(function (el) {
      el.addEventListener('change', applyAndUpdateView);
    });
  }

  function initSearchFilter() {
    loadSavedFilters();
    var container = document.getElementById('search-filter-container');
    if (container) renderSearchFilterUI('search-filter-container');
  }

  if (typeof window !== 'undefined') {
    window.searchEntries = searchEntries;
    window.filterEntries = filterEntries;
    window.applySearchAndFilter = applySearchAndFilter;
    window.getFilteredEntries = getFilteredEntries;
    window.setSearchQuery = setSearchQuery;
    window.setFilters = setFilters;
    window.getFilters = getFilters;
    window.renderSearchFilterUI = renderSearchFilterUI;
    window.initSearchFilter = initSearchFilter;
  }

  if (typeof window !== 'undefined' && window.document) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initSearchFilter);
    } else {
      initSearchFilter();
    }
  }
})(typeof window !== 'undefined' ? window : this);
