/**
 * Assemble index.html from html/shell-start.html, html/screens/*, html/shell-end.html
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');

const parts = [
  'html/shell-start.html',
  'html/screens/auth.html',
  'html/screens/menu.html',
  'html/screens/actions-batch.html',
  'html/screens/add-cow.html',
  'html/screens/view-list.html',
  'html/screens/notifications-analytics.html',
  'html/screens/modals.html',
  'html/screens/sync-admin.html',
  'html/shell-end.html',
];

let out = '';
parts.forEach((rel) => {
  const p = path.join(root, rel);
  if (!fs.existsSync(p)) {
    console.error('Missing partial:', rel);
    process.exit(1);
  }
  out += fs.readFileSync(p, 'utf8').trimEnd() + '\n\n';
});

fs.writeFileSync(path.join(root, 'index.html'), out.trimEnd() + '\n');
console.log('Assembled index.html from', parts.length, 'partials');
