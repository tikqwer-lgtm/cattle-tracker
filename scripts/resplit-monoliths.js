/**
 * Re-split files that ended up as single large parts.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.join(__dirname, '..');
const splitScript = path.join(__dirname, 'split-iife-module.js');

const targets = [
  { src: 'js/features/farm-card.js', folder: 'js/features/farm-card', ns: '__farmCard', chunk: 250 },
  { src: 'js/features/notifications.js', folder: 'js/features/notifications', ns: '__notif', chunk: 250 },
  { src: 'js/features/lists.js', folder: 'js/features/lists', ns: '__lists', chunk: 250 },
  { src: 'js/features/analytics.js', folder: 'js/features/analytics', ns: '__analytics', chunk: 250 },
  { src: 'js/core/users.js', folder: 'js/core/users', ns: '__users', chunk: 250 },
  { src: 'js/features/view-list.js', folder: 'js/features/view-list', ns: '__viewList', chunk: 250 },
];

for (const t of targets) {
  const full = path.join(root, t.src);
  const orig = full + '.orig';
  const folder = path.join(root, t.folder);
  if (fs.existsSync(orig)) {
    fs.copyFileSync(orig, full);
    console.log('Restored', t.src, 'from .orig');
  }
  // Unwrap IIFE if present
  let content = fs.readFileSync(full, 'utf8');
  if (content.match(/^\(function\s*\(\)/m)) {
    content = content.replace(/^\(function\s*\(\)\s*\{\s*'use strict';\s*/m, '');
    content = content.replace(/\}\)\(\);\s*$/m, '');
    fs.writeFileSync(full, content);
  }
  // Remove old split folder
  if (fs.existsSync(folder)) {
    fs.rmSync(folder, { recursive: true });
  }
  if (fs.existsSync(orig)) fs.unlinkSync(orig);
  console.log('Re-splitting', t.src);
  execSync(`node "${splitScript}" "${t.src}" "${t.folder}" "${t.ns}" ${t.chunk}`, { cwd: root, stdio: 'inherit' });
}
