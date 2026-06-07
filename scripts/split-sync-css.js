const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'css/sync.css'), 'utf8').split('\n');

const parts = [
  { file: 'css/screens/sync-controls.css', start: 0, end: 100 },
  { file: 'css/screens/sync-connect.css', start: 100, end: 184 },
  { file: 'css/screens/sync-bases.css', start: 184, end: 365 },
  { file: 'css/screens/sync-apk.css', start: 365, end: src.length },
];

parts.forEach((p) => {
  const content = src.slice(p.start, p.end).join('\n').trim() + '\n';
  fs.writeFileSync(path.join(root, p.file), content);
  console.log('wrote', p.file);
});

fs.writeFileSync(
  path.join(root, 'css/sync.css'),
  `/* sync.css — агрегатор стилей синхронизации */\n@import 'screens/sync-controls.css';\n@import 'screens/sync-connect.css';\n@import 'screens/sync-bases.css';\n@import 'screens/sync-apk.css';\n`
);
