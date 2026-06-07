/** Public window exports */
import './part-4.js';

if (typeof window !== 'undefined') {
  var SM = window.__stallMap;
  window.initStallMapScreen = SM.initStallMapScreen;
  window.stallMapDeleteYard = SM.stallMapDeleteYard;
  window.stallMapSaveGridFromUI = SM.stallMapSaveGridFromUI;
  window.stallMapCloseAssignModal = SM.stallMapCloseAssignModal;
  window.stallMapRedrawIfActive = SM.stallMapRedrawIfActive;
  window.stallMapEntryHasStallCoords = SM.stallMapEntryHasStallCoords;
  window.stallMapFindAt = SM.stallMapFindAt;
  window.stallMapCattleIdEqual = SM.stallMapCattleIdEqual;
  window.stallMapReadLayoutLocal = SM.stallMapReadLayoutLocal;
  window.stallMapNormalizeLayout = SM.stallMapNormalizeLayout;
  window.stallMapPersistEntries = SM.stallMapPersistEntries;
}


export {};
