/** Public window exports */
import './part-3.js';

if (typeof window !== 'undefined') {
  var SM = globalThis['__cowOps'];
  window.editEntry = SM.editEntry;
  window.deleteSelectedEntries = SM.deleteSelectedEntries;
  window.saveUziEntry = SM.saveUziEntry;
  window.saveCalvingEntry = SM.saveCalvingEntry;
  window.saveDryRunEntry = SM.saveDryRunEntry;
  window.saveProtocolAssignEntry = SM.saveProtocolAssignEntry;
  window.applyUziToEntry = SM.applyUziToEntry;
  window.applyDryRunToEntry = SM.applyDryRunToEntry;
  window.applyCalvingToEntry = SM.applyCalvingToEntry;
  window.applyProtocolAssignToEntry = SM.applyProtocolAssignToEntry;
  window.applyProtocolClearToEntry = SM.applyProtocolClearToEntry;
  window.applyAbortToEntry = SM.applyAbortToEntry;
  window.getLastInseminationRecordBefore = SM.getLastInseminationRecordBefore;
  window.getLastInseminationDateBefore = SM.getLastInseminationDateBefore;
  window.setupCattleAutocompleteFor = SM.setupCattleAutocompleteFor;
  window.buildCalfEntryFromCalving = SM.buildCalfEntryFromCalving;
  window.initUziScreen = SM.initUziScreen;
  window.initDryScreen = SM.initDryScreen;
  window.initCalvingScreen = SM.initCalvingScreen;
  window.initProtocolAssignScreen = SM.initProtocolAssignScreen;
  window.initAbortScreen = SM.initAbortScreen;
  window.cancelEdit = SM.cancelEdit;
}

// Экспорт функций
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    editEntry: SM.editEntry,
    deleteEntry: SM.deleteEntry,
    deleteSelectedEntries: SM.deleteSelectedEntries,
    fillFormFromCowEntry: SM.fillFormFromCowEntry,
    fillCowEntryFromForm: SM.fillCowEntryFromForm,
    cancelEdit: SM.cancelEdit
  };
}
export {};
