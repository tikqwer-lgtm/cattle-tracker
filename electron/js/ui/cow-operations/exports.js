/** Public window exports */
import './part-3.js';

if (typeof window !== 'undefined') {
  var SM = globalThis['__cowOps'];
  window.editEntry = editEntry;
  window.deleteSelectedEntries = deleteSelectedEntries;
  window.saveUziEntry = saveUziEntry;
  window.saveCalvingEntry = saveCalvingEntry;
  window.saveDryRunEntry = saveDryRunEntry;
  window.saveProtocolAssignEntry = saveProtocolAssignEntry;
  window.applyUziToEntry = applyUziToEntry;
  window.applyDryRunToEntry = applyDryRunToEntry;
  window.applyCalvingToEntry = applyCalvingToEntry;
  window.applyProtocolAssignToEntry = applyProtocolAssignToEntry;
  window.applyProtocolClearToEntry = applyProtocolClearToEntry;
  window.applyAbortToEntry = applyAbortToEntry;
  window.getLastInseminationRecordBefore = getLastInseminationRecordBefore;
  window.getLastInseminationDateBefore = getLastInseminationDateBefore;
  window.setupCattleAutocompleteFor = setupCattleAutocompleteFor;
  window.buildCalfEntryFromCalving = buildCalfEntryFromCalving;
  window.initUziScreen = initUziScreen;
  window.initDryScreen = initDryScreen;
  window.initCalvingScreen = initCalvingScreen;
  window.initProtocolAssignScreen = initProtocolAssignScreen;
  window.initAbortScreen = initAbortScreen;
}

// Экспорт функций
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    editEntry,
    deleteEntry,
    deleteSelectedEntries,
    fillFormFromCowEntry,
    fillCowEntryFromForm,
    cancelEdit
  };
}
export {};
