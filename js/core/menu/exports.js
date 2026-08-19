/** Public window exports */
import './part-3.js';

if (typeof window !== 'undefined') {
  var SM = globalThis['__menu'];
  window.updateHerdStats = SM.updateHerdStats;
  window.updateMenuCalvingForecast = SM.updateMenuCalvingForecast;
  window.initMenuCalvingForecast = SM.initMenuCalvingForecast;
  window.navigate = SM.navigate;
  window.navigateBack = SM.navigateBack;
  window.navigateToParent = SM.navigateToParent;
  window.navigateBackOrFallback = SM.navigateBackOrFallback;
  window.getCurrentScreenId = SM.getCurrentScreenId;
  window.navigateToSubmenu = SM.navigateToSubmenu;
  window.handleAddObjectClick = SM.handleAddObjectClick;
  window.handleEditObjectClick = SM.handleEditObjectClick;
  window.handleDeleteObjectClick = SM.handleDeleteObjectClick;
  window.updateObjectSwitcher = SM.updateObjectSwitcher;
  window.addEventListener('hashchange', function () { SM.syncRouteToScreen(); });

  var _backExitPending = false;
  window._handleBackButton = function () {
    if (SM.getCurrentScreenId && SM.getCurrentScreenId() === 'view-cow' && typeof window.viewCowBack === 'function') {
      window.viewCowBack();
      return;
    }
    if (SM.navigateToParent && SM.navigateToParent()) return;
    if (_backExitPending) {
      try {
        if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App) {
          window.Capacitor.Plugins.App.exitApp();
        } else if (navigator.app && navigator.app.exitApp) {
          navigator.app.exitApp();
        }
      } catch (_) {}
      return;
    }
    _backExitPending = true;
    if (typeof showToast === 'function') showToast('Нажмите «Назад» ещё раз для выхода', 'info');
    setTimeout(function () { _backExitPending = false; }, 2000);
  };
  document.addEventListener('backbutton', function (e) {
    e.preventDefault();
    window._handleBackButton();
  });
}

window.addEventListener('load', () => {
  if (document.getElementById('menu-screen').classList.contains('active')) {
    SM.updateObjectSwitcher();
  }
  if (document.getElementById('herd-hub-screen') && document.getElementById('herd-hub-screen').classList.contains('active')) {
    SM.updateHerdStats();
  }
});
export {};
