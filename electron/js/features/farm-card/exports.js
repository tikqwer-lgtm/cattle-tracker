/** Public window exports */
import './part-2.js';

if (typeof window !== 'undefined') {
  var SM = globalThis['__farmCard'];
  window.ensureFarmCardLoaded = SM.ensureFarmCardLoaded;
  window.saveFarmCardBundle = SM.saveFarmCardBundle;
  window.getFarmCardBundleForExport = SM.getFarmCardBundleForExport;
  window.initFarmCardPanel = SM.initFarmCardPanel;
  if (window.CattleTrackerEvents && typeof window.CattleTrackerEvents.on === 'function') {
    window.CattleTrackerEvents.on('entries:updated', function () {
      var metricsTab = document.querySelector('.farm-card-tab[data-farm-tab="metrics"]');
      if (document.getElementById('farmCardRoot') && metricsTab && metricsTab.classList.contains('farm-card-tab--active')) {
        SM.renderFarmCardPanel();
      }
    });
  }
}

export {};
