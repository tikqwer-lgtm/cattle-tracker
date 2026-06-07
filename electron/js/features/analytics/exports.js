/** Public window exports */
import './part-3.js';

  if (typeof window !== 'undefined') {
  var SM = globalThis['__analytics'];
    window.renderCharts = renderCharts;
    window.renderAnalyticsScreen = renderAnalyticsScreen;
    window.renderIntervalAnalysisScreen = renderIntervalAnalysisScreen;
    window.renderReproductionScreen = renderReproductionScreen;
    window.getAnalyticsFilteredEntries = window.getFilteredEntries;
    window.getPeriodBounds = window.getPeriodBounds;
  }

  if (typeof window !== 'undefined' && window.document) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initAnalytics);
    } else {
      initAnalytics();
    }
  }


export {};
