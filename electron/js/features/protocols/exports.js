/** Public window exports */
import './part-2.js';

if (typeof window !== 'undefined') {
  var SM = globalThis['__protocols'];
  window.renderProtocolsScreen = renderProtocolsScreen;
  window.ensureProtocolsLoaded = ensureProtocolsLoaded;
  window.invalidateProtocolsForObjectSwitch = invalidateProtocolsForObjectSwitch;
  window.getProtocols = getProtocols;
  window.fillAllInseminationCodeSelects = fillAllInseminationCodeSelects;
}
export {};
