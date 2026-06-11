/** Public window exports */
import './part-3.js';

if (typeof window !== 'undefined') {
  var SM = globalThis['__viewCow'];
  window.getDaysPregnant = SM.getDaysPregnant;
  window.getDaysInLactation = SM.getDaysInLactation;
  window.getDaysSinceLastInsemination = SM.getDaysSinceLastInsemination;
  window.getInseminationListForEntry = SM.getInseminationListForEntry;
  window.renderAllInseminationsScreen = SM.renderAllInseminationsScreen;
  window.viewCow = SM.viewCow;
  window.viewCowBack = SM.viewCowBack;
  window.toggleViewCowInseminationHistory = SM.toggleViewCowInseminationHistory;
  window.openViewCowActionHistory = SM.openViewCowActionHistory;
}
export {};
