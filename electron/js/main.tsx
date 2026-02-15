/**
 * ESM entry: import all app modules in dependency order, then mount React root.
 * Each module attaches its API to window for HTML and legacy code.
 */
import './config.js';
import './utils/constants.js';
import './utils/utils.js';
import './core/events.js';
import './api/api-client.js';
import './storage/storage-objects.js';
import './storage/storage-entries.js';
import './storage/storage-integrity.js';
import './storage/storage.js';
import './core/core.js';
import './core/users.js';
import './ui/ui-helpers.js';
import './ui/cow-operations.js';
import './utils/voice-handler.js';
import './core/app.js';
import './features/sync.js';
import './features/export-import-parse.js';
import './features/export-import.js';
import './features/export-excel.js';
import './features/insemination.js';
import './features/view-cow.js';
import './ui/field-config.js';
import './features/search-filter.js';
import './features/notifications.js';
import './features/analytics-calc.js';
import './features/analytics.js';
import './features/backup.js';
import './features/view-list-fields.js';
import './features/view-list.js';
import './features/protocols.js';
import './core/menu.js';

import { createRoot } from 'react-dom/client';
import App from './App';

const rootEl = document.getElementById('root');
if (rootEl) {
  createRoot(rootEl).render(<App />);
}
