/** Public window exports */
import './part-3.js';
import './part-2.js';

if (typeof window !== 'undefined') {
  var SM = globalThis['__farmCard'];
  window.ensureFarmCardLoaded = SM.ensureFarmCardLoaded;
  window.saveFarmCardBundle = SM.saveFarmCardBundle;
  window.getFarmCardBundleForExport = SM.getFarmCardBundleForExport;
  window.initFarmCardPanel = SM.initFarmCardPanel;
  window.printFarmCard = SM.printFarmCard;
  if (window.CattleTrackerEvents && typeof window.CattleTrackerEvents.on === 'function') {
    window.CattleTrackerEvents.on('entries:updated', function () {
      var metricsTab = document.querySelector('.farm-card-tab[data-farm-tab="metrics"]');
      var dynamicsTab = document.querySelector('.farm-card-tab[data-farm-tab="dynamics"]');
      if (
        document.getElementById('farmCardRoot') &&
        ((metricsTab && metricsTab.classList.contains('farm-card-tab--active')) ||
          (dynamicsTab && dynamicsTab.classList.contains('farm-card-tab--active')))
      ) {
        SM.renderFarmCardPanel();
      }
    });
    window.CattleTrackerEvents.on('farm-card:updated', function () {
      if (typeof window.checkUpcomingEvents === 'function') {
        try {
          window.checkUpcomingEvents();
        } catch (e) {}
      }
    });
  }
}

export {};
