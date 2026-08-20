/** Public window exports */
import './part-2.js';

if (typeof window !== 'undefined') {
  var SM = globalThis['__protocols'];
  window.renderProtocolsScreen = SM.renderProtocolsScreen;
  window.ensureProtocolsLoaded = SM.ensureProtocolsLoaded;
  window.invalidateProtocolsForObjectSwitch = SM.invalidateProtocolsForObjectSwitch;
  window.getProtocols = SM.getProtocols;
  window.fillAllInseminationCodeSelects = SM.fillAllInseminationCodeSelects;
  window.openQuickProtocolModal = SM.openQuickProtocolModal;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      if (SM.bindQuickProtocolUi) SM.bindQuickProtocolUi();
    });
  } else if (SM.bindQuickProtocolUi) {
    SM.bindQuickProtocolUi();
  }
}
export {};
