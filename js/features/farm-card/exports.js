/** Public window exports */
import './part-2.js';

  if (typeof window !== 'undefined') {
  var SM = globalThis['__farmCard'];
    window.ensureFarmCardLoaded = ensureFarmCardLoaded;
    window.saveFarmCardBundle = saveFarmCardBundle;
    window.getFarmCardBundleForExport = getFarmCardBundleForExport;
    window.initFarmCardPanel = initFarmCardPanel;
    if (window.CattleTrackerEvents && typeof window.CattleTrackerEvents.on === 'function') {
      window.CattleTrackerEvents.on('entries:updated', function () {
        if (document.getElementById('farmCardRoot') && document.getElementById('farmCardPaneMetrics') && _activeTab === 'metrics') {
          renderFarmCardPanel();
        }
      });
    }
  }

export {};
