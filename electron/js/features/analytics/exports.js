/** Public window exports */
import './part-3.js';

if (typeof window !== 'undefined') {
  var SM = globalThis['__analytics'];
  window.renderCharts = SM.renderCharts;
  window.renderAnalyticsScreen = SM.renderAnalyticsScreen;
  window.renderIntervalAnalysisScreen = SM.renderIntervalAnalysisScreen;
  window.renderReproductionScreen = SM.renderReproductionScreen;
  window.getAnalyticsFilteredEntries = window.getAnalyticsFilteredEntries || SM.getAnalyticsFilteredEntries;
  window.getPeriodBounds = window.getPeriodBounds;
}

if (typeof window !== 'undefined' && window.document) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { SM.initAnalytics(); });
  } else {
    SM.initAnalytics();
  }
}

export {};
