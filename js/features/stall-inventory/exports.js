/** Public window exports */
import './part-4.js';

if (typeof window !== 'undefined') {
  var SM = globalThis['__stallInv'];
  window.initStallInventoryScreen = initStallInventoryScreen;
}

export {};
