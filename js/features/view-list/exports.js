/** Public window exports */
import './part-3.js';

if (typeof window !== 'undefined') {
  var SM = globalThis['__viewList'];
  window.selectAllEntries = SM.selectAllEntries;
  window.deselectAllEntries = SM.deselectAllEntries;
  window.toggleSelectAll = SM.toggleSelectAll;
  window.toggleRowSelection = SM.toggleRowSelection;
  window.updateSelectedCount = SM.updateSelectedCount;
  window.getSelectedCattleIds = SM.getSelectedCattleIds;
  window.refreshViewListVisible = SM.refreshViewListVisible;
  window.updateViewList = SM.updateViewList;
}
export {};
