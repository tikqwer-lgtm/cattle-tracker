/**
 * One-time extract index.html into html/screens/*.html
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const lines = fs.readFileSync(path.join(root, 'index.html'), 'utf8').split('\n');

const sections = [
  { file: 'html/shell-start.html', start: 1, end: 51 },
  { file: 'html/screens/auth.html', start: 52, end: 109 },
  { file: 'html/screens/menu.html', start: 110, end: 243 },
  { file: 'html/screens/actions-batch.html', start: 244, end: 496 },
  { file: 'html/screens/add-cow.html', start: 497, end: 672 },
  { file: 'html/screens/view-list.html', start: 673, end: 706 },
  { file: 'html/screens/notifications-analytics.html', start: 707, end: 778 },
  { file: 'html/screens/modals.html', start: 779, end: 934 },
  { file: 'html/screens/sync-admin.html', start: 936, end: 1033 },
  { file: 'html/shell-end.html', start: 1035, end: lines.length },
];

sections.forEach((s) => {
  const dir = path.dirname(path.join(root, s.file));
  fs.mkdirSync(dir, { recursive: true });
  const content = lines.slice(s.start - 1, s.end).join('\n').trimEnd() + '\n';
  fs.writeFileSync(path.join(root, s.file), content);
  console.log('wrote', s.file, content.split('\n').length, 'lines');
});
