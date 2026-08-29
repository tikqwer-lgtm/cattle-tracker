/**
 * Legacy init that used to run at the end of navigate().
 * Called from LegacyHost after the screen DOM exists.
 */
export function activateLegacyScreen(screenId: string): void {
  const w = window as Window & Record<string, unknown>;
  const menu = (globalThis as { __menu?: Record<string, (...args: unknown[]) => void> }).__menu;

  if (screenId === 'submenu' && menu && typeof menu.renderSubmenu === 'function') {
    menu.renderSubmenu();
  }
  if (screenId === 'farm-card' && typeof w.initFarmCardPanel === 'function') {
    (w.initFarmCardPanel as () => void)();
  }
  if (screenId === 'dry' && typeof w.initDryScreen === 'function') {
    (w.initDryScreen as () => void)();
  }
  if (screenId === 'calving' && typeof w.initCalvingScreen === 'function') {
    (w.initCalvingScreen as () => void)();
  }
  if (screenId === 'abort' && typeof w.initAbortScreen === 'function') {
    (w.initAbortScreen as () => void)();
  }
  if (screenId === 'protocol-assign' && typeof w.initProtocolAssignScreen === 'function') {
    (w.initProtocolAssignScreen as () => void)();
  }
  if (screenId === 'uzi' && typeof w.initUziScreen === 'function') {
    (w.initUziScreen as () => void)();
  }
  if (screenId === 'insemination' && typeof w.initInseminationScreen === 'function') {
    (w.initInseminationScreen as () => void)();
    setTimeout(() => {
      if (typeof w.fillAllInseminationCodeSelects === 'function') {
        try {
          (w.fillAllInseminationCodeSelects as () => void)();
        } catch {
          /* ignore */
        }
      }
    }, 0);
  }
  if (screenId === 'view') {
    if (typeof w.updateViewList === 'function') (w.updateViewList as () => void)();
    setTimeout(() => {
      if (typeof w.refreshViewListVisible === 'function') (w.refreshViewListVisible as () => void)();
    }, 0);
  }
  if (screenId === 'all-inseminations' && typeof w.renderAllInseminationsScreen === 'function') {
    const vc = (globalThis as { __viewCow?: { resetAllInseminationsRenderTarget?: () => void } }).__viewCow;
    if (vc && typeof vc.resetAllInseminationsRenderTarget === 'function') {
      vc.resetAllInseminationsRenderTarget();
    }
    (w.renderAllInseminationsScreen as () => void)();
  }
  if (screenId === 'notifications' && typeof w.renderNotificationCenter === 'function') {
    (w.renderNotificationCenter as (id: string) => void)('notification-center-container');
  }
  if (screenId === 'sync') {
    if (typeof w.initSyncServerBlock === 'function') (w.initSyncServerBlock as () => void)();
    if (w.CATTLE_TRACKER_USE_API && typeof w.updateSyncServerStatusFromHealth === 'function') {
      (w.updateSyncServerStatusFromHealth as () => void)();
    }
    if (typeof w.renderBackupUI === 'function') {
      (w.renderBackupUI as (id: string) => void)('sync-backup-container');
    }
  }
  if (screenId === 'auth') {
    if (typeof w.bindAuthControls === 'function') (w.bindAuthControls as () => void)();
    if (typeof w.fillAuthUsernameList === 'function') (w.fillAuthUsernameList as () => void)();
    setTimeout(() => {
      const authScreen = document.getElementById('auth-screen');
      const active = document.activeElement;
      if (
        typeof w.focusAuthForm === 'function' &&
        (!authScreen || !active || !authScreen.contains(active))
      ) {
        (w.focusAuthForm as () => void)();
      }
    }, 0);
  }
  if (screenId === 'tasks' && typeof w.renderTasksScreen === 'function') {
    (w.renderTasksScreen as () => void)();
  }
  if (screenId === 'analytics' && typeof w.renderAnalyticsScreen === 'function') {
    (w.renderAnalyticsScreen as () => void)();
  }
  if (screenId === 'interval-analysis' && typeof w.renderIntervalAnalysisScreen === 'function') {
    (w.renderIntervalAnalysisScreen as () => void)();
  }
  if (screenId === 'reproduction' && typeof w.renderReproductionScreen === 'function') {
    (w.renderReproductionScreen as () => void)();
  }
  if (screenId === 'admin' && typeof w.renderAdminScreen === 'function') {
    (w.renderAdminScreen as () => void)();
  }
  if (screenId === 'lists' && typeof w.renderListsScreen === 'function') {
    (w.renderListsScreen as () => void)();
  }
  if (screenId === 'list-uzi' && typeof w.renderUziListSubScreen === 'function') {
    const uziContainer = document.getElementById('list-uzi-container');
    if (uziContainer) (w.renderUziListSubScreen as (el: HTMLElement) => void)(uziContainer);
  }
  if (screenId === 'list-insemination' && typeof w.renderInseminationListSubScreen === 'function') {
    const insemContainer = document.getElementById('list-insemination-container');
    if (insemContainer) (w.renderInseminationListSubScreen as (el: HTMLElement) => void)(insemContainer);
  }
  if (screenId === 'list-calving' && typeof w.renderCalvingListSubScreen === 'function') {
    const calvingContainer = document.getElementById('list-calving-container');
    if (calvingContainer) {
      let calvingPreset = null as unknown;
      if (w._listsCalvingPreset) {
        calvingPreset = w._listsCalvingPreset;
        w._listsCalvingPreset = null;
        w._listsCalvingView = calvingPreset;
      } else if (w._listsCalvingView) {
        calvingPreset = w._listsCalvingView;
      } else if (menu && typeof menu.getMenuCalvingViewYearMonth === 'function') {
        calvingPreset = menu.getMenuCalvingViewYearMonth();
      }
      (w.renderCalvingListSubScreen as (el: HTMLElement, preset: unknown) => void)(
        calvingContainer,
        calvingPreset
      );
    }
  }
  if (screenId === 'events' && typeof w.renderEventsScreen === 'function') {
    (w.renderEventsScreen as () => void)();
  }
  if (screenId === 'stall-map' && typeof w.initStallMapScreen === 'function') {
    (w.initStallMapScreen as () => void)();
  }
  if (screenId === 'stall-inventory' && typeof w.initStallInventoryScreen === 'function') {
    (w.initStallInventoryScreen as () => void)();
  }
  if (screenId === 'add') {
    const clearBtn = document.getElementById('clearFormButton');
    if (clearBtn) clearBtn.style.display = w.currentEditingId ? 'none' : 'inline-block';
    if (!w.currentEditingId) {
      const titleEl = document.getElementById('addScreenTitle');
      if (titleEl) titleEl.textContent = 'Добавить животное';
      if (typeof w.clearForm === 'function') (w.clearForm as () => void)();
    }
    if (typeof w.fillAllInseminationCodeSelects === 'function') {
      try {
        (w.fillAllInseminationCodeSelects as () => void)();
      } catch {
        /* ignore */
      }
    }
    setTimeout(() => {
      const firstField = document.getElementById('cattleId');
      if (firstField) firstField.focus();
    }, 0);
  }
  if (screenId === 'menu') {
    if (menu && typeof menu.updateMenuGroupVisibility === 'function') menu.updateMenuGroupVisibility();
    if (menu && typeof menu.updateVersionSwitcher === 'function') menu.updateVersionSwitcher();
    if (menu && typeof menu.updateObjectSwitcher === 'function') menu.updateObjectSwitcher();
    if (typeof w.updateAuthBar === 'function') (w.updateAuthBar as () => void)();
    if (menu && typeof menu.initFirstRunHints === 'function') menu.initFirstRunHints();
    if (menu && typeof menu.maybeShowFirstRunHints === 'function') menu.maybeShowFirstRunHints();
    if (typeof w.checkMobileApkUpdate === 'function') (w.checkMobileApkUpdate as (q: boolean) => void)(true);
    const versionEl = document.getElementById('app-version');
    const versionHeaderEl = document.getElementById('app-version-header');
    if (typeof w.initAppVersionUpdateUi === 'function') {
      (w.initAppVersionUpdateUi as () => void)();
    } else if (versionEl || versionHeaderEl) {
      const fallback = (versionEl && versionEl.getAttribute('data-default-version')) || '1.0.0';
      if (versionEl) versionEl.textContent = 'Версия ' + fallback;
      if (versionHeaderEl && !versionHeaderEl.textContent) versionHeaderEl.textContent = 'Версия ' + fallback;
    }
  }
  if (screenId === 'herd-hub') {
    if (menu && typeof menu.updateMenuGroupVisibility === 'function') menu.updateMenuGroupVisibility();
    if (menu && typeof menu.initMenuCalvingForecast === 'function') menu.initMenuCalvingForecast();
    if (menu && typeof menu.updateHerdStats === 'function') menu.updateHerdStats();
    if (menu && typeof menu.initMenuNotificationsLink === 'function') menu.initMenuNotificationsLink();
  }
}
