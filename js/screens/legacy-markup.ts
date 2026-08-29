import authHtml from '../../html/screens/auth.html?raw';
import menuHtml from '../../html/screens/menu.html?raw';
import herdHubHtml from '../../html/screens/herd-hub.html?raw';
import actionsHtml from '../../html/screens/actions-batch.html?raw';
import addCowHtml from '../../html/screens/add-cow.html?raw';
import viewListHtml from '../../html/screens/view-list.html?raw';
import analyticsHtml from '../../html/screens/notifications-analytics.html?raw';
import syncHtml from '../../html/screens/sync-admin.html?raw';

const BUNDLES = [
  authHtml,
  menuHtml,
  herdHubHtml,
  actionsHtml,
  addCowHtml,
  viewListHtml,
  analyticsHtml,
  syncHtml,
];

export function getLegacyScreenMarkup(screenId: string): { inner: string; className: string } {
  const id = `${screenId}-screen`;
  if (typeof DOMParser === 'undefined') {
    return { inner: '', className: 'screen' };
  }
  for (const html of BUNDLES) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const el = doc.getElementById(id);
    if (el) {
      return {
        inner: el.innerHTML,
        className: el.getAttribute('class') || 'screen',
      };
    }
  }
  return { inner: '', className: 'screen' };
}
