/** __farmCard part 2 */
(function () {
  'use strict';
  var root = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this);
  var NS = root['__farmCard'] = root['__farmCard'] || {};
  var global = typeof window !== 'undefined' ? window : this;

  function bindFarmCardGeosuggest() {
    var regionEl = document.getElementById('farmCardAddrRegion');
    var localityEl = document.getElementById('farmCardAddrLocality');
    var streetEl = document.getElementById('farmCardAddrStreet');
    var listEl = document.getElementById('farmCardAddrSuggestList');
    var hintEl = document.getElementById('farmCardAddrSuggestHint');
    if (!localityEl || !listEl) return;
    if (hintEl) {
      hintEl.style.display = window.CATTLE_TRACKER_USE_API && window.CattleTrackerApi ? '' : 'none';
    }

    function hideList() {
      listEl.style.display = 'none';
      listEl.innerHTML = '';
      _addrSuggestResults = [];
    }

    function runSuggest() {
      if (!window.CATTLE_TRACKER_USE_API || !window.CattleTrackerApi || typeof window.CattleTrackerApi.geosuggest !== 'function') {
        globalThis['__farmCard'].hideList();
        return;
      }
      var parts = [regionEl && regionEl.value, localityEl && localityEl.value, streetEl && streetEl.value]
        .map(function (s) {
          return (s || '').trim();
        })
        .filter(Boolean);
      var q = parts.join(', ');
      if (q.length < 3) {
        globalThis['__farmCard'].hideList();
        return;
      }
      window.CattleTrackerApi.geosuggest(q).then(function (data) {
        _addrSuggestResults = (data && data.suggestions) || [];
        if (!_addrSuggestResults.length) {
          globalThis['__farmCard'].hideList();
          return;
        }
        listEl.innerHTML = _addrSuggestResults
          .map(function (s, i) {
            var main = globalThis['__farmCard'].escapeHtml(s.formatted || s.title || '');
            var sub = globalThis['__farmCard'].escapeHtml(s.subtitle || '');
            return (
              '<li tabindex="0" role="option" data-suggest-idx="' +
              i +
              '">' +
              main +
              (sub ? '<span class="farm-card-suggest-sub">' + sub + '</span>' : '') +
              '</li>'
            );
          })
          .join('');
        listEl.style.display = 'block';
      }).catch(function () {
        globalThis['__farmCard'].hideList();
      });
    }

    function schedule() {
      if (_addrSuggestTimer) clearTimeout(_addrSuggestTimer);
      _addrSuggestTimer = setTimeout(runSuggest, 420);
    }

    [regionEl, localityEl, streetEl].forEach(function (el) {
      if (!el) return;
      el.removeEventListener('input', el._farmGeoInput);
      el._farmGeoInput = schedule;
      el.addEventListener('input', schedule);
    });

    listEl.onclick = function (e) {
      var li = e.target.closest ? e.target.closest('li[data-suggest-idx]') : null;
      if (!li) return;
      var idx = parseInt(li.getAttribute('data-suggest-idx'), 10);
      var s = _addrSuggestResults[idx];
      if (!s) return;
      if (regionEl) regionEl.value = s.region || '';
      if (localityEl) localityEl.value = s.locality || s.title || '';
      if (streetEl) streetEl.value = s.street || '';
      var houseEl = document.getElementById('farmCardAddrHouse');
      if (houseEl) houseEl.value = s.house || '';
      var navEl = document.getElementById('farmCardAddrNav');
      if (navEl) {
        var label = (s.formatted || s.title || '').trim();
        navEl.value = label ? 'https://yandex.ru/maps/?text=' + encodeURIComponent(label) : '';
      }
      globalThis['__farmCard'].hideList();
    };

    window._farmSuggestDocClose = function (e) {
      if (!listEl || listEl.style.display === 'none') return;
      var wrap = document.querySelector('.farm-card-addr-suggest-wrap');
      if (wrap && e.target && wrap.contains(e.target)) return;
      globalThis['__farmCard'].hideList();
    };
    document.addEventListener('click', window._farmSuggestDocClose, true);
  }

  function initFarmCardPanel() {
    globalThis['__farmCard'].ensureFarmCardLoaded().then(function () {
      globalThis['__farmCard'].renderFarmCardPanel();
    });
  }


  // register functions
  NS.bindFarmCardGeosuggest = bindFarmCardGeosuggest;
  NS.initFarmCardPanel = initFarmCardPanel;
})();
export {};
