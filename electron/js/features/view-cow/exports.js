/** Public window exports */
import './part-3.js';

if (typeof window !== 'undefined') {
  var SM = globalThis['__viewCow'];
  window.getDaysPregnant = getDaysPregnant;
  window.getDaysInLactation = getDaysInLactation;
  window.getDaysSinceLastInsemination = getDaysSinceLastInsemination;
  window.getInseminationListForEntry = getInseminationListForEntry;
  window.renderAllInseminationsScreen = renderAllInseminationsScreen;
  window.viewCow = viewCow;
  window.viewCowBack = viewCowBack;
  window.toggleViewCowInseminationHistory = toggleViewCowInseminationHistory;
  window.openViewCowActionHistory = openViewCowActionHistory;
}
export {};
