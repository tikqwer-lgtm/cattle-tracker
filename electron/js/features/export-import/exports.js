/** Public window exports */
import './part-2.js';

if (typeof window !== 'undefined') {
  var SM = globalThis['__exportImport'];
  window.handleImportFile = handleImportFile;
  function bindImportFileInput() {
    var input = document.getElementById('importFile');
    if (input && !input.dataset.importBound) {
      input.dataset.importBound = '1';
      input.addEventListener('change', handleImportFile);
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindImportFileInput);
  } else {
    bindImportFileInput();
  }
}
export {};
