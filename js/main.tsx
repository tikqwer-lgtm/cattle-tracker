/**
 * ESM entry: import all app modules in dependency order, then mount React root.
 * Each module attaches its API to window for HTML and legacy code.
 */
import '../css/style.css';
import './config.js';
import { initPinchZoom } from './utils/pinch-zoom.js';

declare global {
  interface Window {
    initPinchZoom?: typeof initPinchZoom;
  }
}
window.initPinchZoom = initPinchZoom;
import './utils/constants.js';
import './utils/utils.js';
import './utils/collar-lookup.js';
import './utils/insemination-history.js';
import './utils/xlsx-global.js';
import './core/events.js';
import './api/api-client.js';
import './storage/storage-objects.js';
import './storage/object-data.js';
import './storage/storage-entries.js';
import './storage/storage-integrity.js';
import './storage/storage.js';
import './core/core.js';
import './core/users.js';
import './core/auth-session.js';
import './ui/ui-helpers.js';
import './ui/animate-number.js';
import './features/action-input-guards.js';
import './ui/cow-operations.js';
import './utils/voice-handler.js';
import './core/app.js';
import './features/sync.js';
import './features/export-import-parse.js';
import './features/export-import.js';
import './features/export-excel.js';
import './features/insemination.js';
import './features/action-batch.js';
import './features/view-cow.js';
import './features/calving-calc.js';
import './features/data-integrity.js';
import './ui/field-config.js';
import './features/search-filter.js';
import './features/notifications.js';
import './features/analytics-calc.js';
import './features/analytics-endometritis-dmg.js';
import './features/analytics.js';
import './features/backup-bundle.js';
import './features/backup.js';
import './features/view-list-fields.js';
import './features/view-list.js';
import './features/protocols.js';
import './features/farm-settings.js';
import './features/farm-card.js';
import './features/stall-map.js';
import './features/stall-inventory.js';
import './features/admin.js';
import './features/inbox-sync.js';
import './features/mobile-telemetry.js';
import './features/lists.js';
import './features/service-dashboard.js';
import './features/service-work-tasks.js';
import './features/service-work-tasks-ui.js';
import './features/service-work-report.js';
import './features/chat-data-context.js';
import './features/chat-plan-assistant.js';
import './features/chat-consultant.js';
import './core/menu.js';

void import('./features/electron-devtools-diagnostics.js').catch(() => {});

// Capacitor backButton only in Capacitor runtime; dynamic import so Electron build doesn't require @capacitor/app
import('@capacitor/app')
  .then(({ App: CapApp }) => {
    CapApp.addListener('backButton', () => {
      if (typeof (window as any)._handleBackButton === 'function') {
        (window as any)._handleBackButton();
      }
    });
    CapApp.addListener('appStateChange', (state: { isActive: boolean }) => {
      if (!state.isActive) return;
      const w = window as any;
      if (typeof w.stallMapRedrawIfActive === 'function') w.stallMapRedrawIfActive();
      if (typeof w.softRepaintCattleTrackerView === 'function') w.softRepaintCattleTrackerView();
      if (typeof w.processServerInbox === 'function') w.processServerInbox();
    });
  })
  .catch(() => {});

import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import './screens/register-screens';
import App from './App';

const rootEl = document.getElementById('root');
if (rootEl) {
  const root = createRoot(rootEl);
  flushSync(() => {
    root.render(<App />);
  });
}
