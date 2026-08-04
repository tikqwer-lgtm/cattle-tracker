/** __farmCard part 2 */
(function () {
  'use strict';
  var root = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this);
  var NS = root['__farmCard'] = root['__farmCard'] || {};
  var global = typeof window !== 'undefined' ? window : this;

  function bindFarmCardGeosuggest() {
    var regionEl = document.getElementById('farmCardAddrRegion');
    var localityEl = document.getElementById('farmCardAddrLocality');
    var addressEl = document.getElementById('farmCardAddrLine');
    var listEl = document.getElementById('farmCardAddrSuggestList');
    if (!listEl) return;

    function hideList() {
      listEl.style.display = 'none';
      listEl.innerHTML = '';
      NS.state.addrSuggestResults = [];
    }
    NS.hideList = hideList;

    function runSuggest() {
      if (!window.CATTLE_TRACKER_USE_API || !window.CattleTrackerApi || typeof window.CattleTrackerApi.geosuggest !== 'function') {
        hideList();
        return;
      }
      var parts = [regionEl && regionEl.value, localityEl && localityEl.value, addressEl && addressEl.value]
        .map(function (s) {
          return (s || '').trim();
        })
        .filter(Boolean);
      var q = parts.join(', ');
      if (q.length < 3) {
        hideList();
        return;
      }
      window.CattleTrackerApi.geosuggest(q).then(function (data) {
        NS.state.addrSuggestResults = (data && data.suggestions) || [];
        if (!NS.state.addrSuggestResults.length) {
          hideList();
          return;
        }
        listEl.innerHTML = NS.state.addrSuggestResults
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
        hideList();
      });
    }

    function schedule() {
      if (NS.state.addrSuggestTimer) clearTimeout(NS.state.addrSuggestTimer);
      NS.state.addrSuggestTimer = setTimeout(runSuggest, 420);
    }

    [regionEl, localityEl, addressEl].forEach(function (el) {
      if (!el) return;
      el.removeEventListener('input', el._farmGeoInput);
      el._farmGeoInput = schedule;
      el.addEventListener('input', schedule);
    });

    listEl.onclick = function (e) {
      var li = e.target.closest ? e.target.closest('li[data-suggest-idx]') : null;
      if (!li) return;
      var idx = parseInt(li.getAttribute('data-suggest-idx'), 10);
      var s = (NS.state.addrSuggestResults || [])[idx];
      if (!s) return;
      if (regionEl) regionEl.value = s.region || '';
      if (localityEl) localityEl.value = s.locality || s.title || '';
      if (addressEl) {
        var streetPart = [s.street, s.house].filter(Boolean).join(', ');
        addressEl.value = (s.formatted || streetPart || '').trim();
      }
      hideList();
    };

    window._farmSuggestDocClose = function (e) {
      if (!listEl || listEl.style.display === 'none') return;
      var wrap = document.querySelector('.farm-card-addr-suggest-wrap');
      if (wrap && e.target && wrap.contains(e.target)) return;
      hideList();
    };
    document.addEventListener('click', window._farmSuggestDocClose, true);
  }

  function initFarmCardPanel() {
    var root = document.getElementById('farmCardRoot');
    var hideLoading =
      typeof showLoading === 'function' && root ? showLoading(root) : function () {};
    var oid =
      typeof getCurrentObjectId === 'function' ? getCurrentObjectId() : '';
    var beforeGen = globalThis['__farmCard'].state._farmGen;
    globalThis['__farmCard']
      .ensureFarmCardLoaded()
      .then(function () {
        if (globalThis['__farmCard'].state._farmGen !== beforeGen + 1) return;
        if (typeof getCurrentObjectId === 'function' && getCurrentObjectId() !== oid) return;
        globalThis['__farmCard'].renderFarmCardPanel();
      })
      .finally(function () {
        hideLoading();
      });
  }


  // register functions
  NS.bindFarmCardGeosuggest = bindFarmCardGeosuggest;
  NS.initFarmCardPanel = initFarmCardPanel;
})();
export {};
