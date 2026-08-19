/** Public window exports */
import './part-2.js';

if (typeof window !== 'undefined') {
  var SM = globalThis['__app'];
  if (SM) {
    window.saveCurrentEntry = SM.saveCurrentEntry;
    window.addEntry = SM.addEntry;
    window.initApp = SM.initApp;
  }
}

export {};
