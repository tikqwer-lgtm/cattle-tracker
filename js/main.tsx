/**
 * ESM entry: import all app modules in dependency order, then mount React root.
 * Each module attaches its API to window for HTML and legacy code.
 */
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
// XLSX подключается в index.html скриптом (cdn), доступен как window.XLSX
import './core/events.js';
import './api/api-client.js';
import './storage/storage-objects.js';
import './storage/storage-entries.js';
import './storage/storage-integrity.js';
import './storage/storage.js';
import './core/core.js';
import './core/users.js';
import './ui/ui-helpers.js';
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
import './ui/field-config.js';
import './features/search-filter.js';
import './features/notifications.js';
import './features/analytics-calc.js';
import './features/analytics-endometritis-dmg.js';
import './features/analytics.js';
import './features/backup.js';
import './features/view-list-fields.js';
import './features/view-list.js';
import './features/protocols.js';
import './features/farm-settings.js';
import './features/admin.js';
import './features/report-error.js';
import './features/lists.js';
import './core/menu.js';

// Capacitor backButton only in Capacitor runtime; dynamic import so Electron build doesn't require @capacitor/app
import('@capacitor/app')
  .then(({ App: CapApp }) => {
    CapApp.addListener('backButton', () => {
      if (typeof (window as any)._handleBackButton === 'function') {
        (window as any)._handleBackButton();
      }
    });
  })
  .catch(() => {});

import { createRoot } from 'react-dom/client';
import App from './App';

const rootEl = document.getElementById('root');
if (rootEl) {
  createRoot(rootEl).render(<App />);
}
