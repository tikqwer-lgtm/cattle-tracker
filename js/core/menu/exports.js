/** Public window exports */
import './part-3.js';

if (typeof window !== 'undefined') {
  var SM = globalThis['__menu'];
  window.updateHerdStats = updateHerdStats;
  window.updateMenuCalvingForecast = updateMenuCalvingForecast;
  window.initMenuCalvingForecast = initMenuCalvingForecast;
  window.navigate = navigate;
  window.navigateBack = navigateBack;
  window.navigateBackOrFallback = navigateBackOrFallback;
  window.navigateToSubmenu = navigateToSubmenu;
  window.handleAddObjectClick = handleAddObjectClick;
  window.handleEditObjectClick = handleEditObjectClick;
  window.handleDeleteObjectClick = handleDeleteObjectClick;
  window.updateObjectSwitcher = updateObjectSwitcher;
  window.addEventListener('hashchange', syncRouteToScreen);

  var _backExitPending = false;
  window._handleBackButton = function () {
    if (navigateBack()) return;
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
    updateHerdStats();
  }
});
export {};
