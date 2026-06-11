/** Public window exports */
import './part-3.js';

if (typeof window !== 'undefined') {
  var SM = globalThis['__syncBases'];
  window.renderSyncServerBasesList = SM.renderSyncServerBasesList;
  window.showLoadBaseModal = SM.showLoadBaseModal;
  window.showDeleteBaseModal = SM.showDeleteBaseModal;
  window.loadServerBaseIntoNewObject = SM.loadServerBaseIntoNewObject;
  window.showReplaceBaseModal = SM.showReplaceBaseModal;
  window.replaceServerBaseInObject = SM.replaceServerBaseInObject;
  window.uploadCurrentBaseToServer = SM.uploadCurrentBaseToServer;
  window.showImportNewObjectModal = SM.showImportNewObjectModal;
  window.hideServerBaseLocalOnly = SM.hideServerBaseLocalOnly;
  window.overwriteCurrentServerBaseWithLocal = SM.overwriteCurrentServerBaseWithLocal;
}

export {};
