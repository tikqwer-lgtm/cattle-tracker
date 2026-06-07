/**
 * Batch-split all JS files >500 lines per restructuring plan.
 */
const { execSync } = require('child_process');
const path = require('path');

const splits = [
  { src: 'js/ui/cow-operations.js', folder: 'js/ui/cow-operations', ns: '__cowOps', chunk: 280 },
  { src: 'js/features/farm-card.js', folder: 'js/features/farm-card', ns: '__farmCard', chunk: 280 },
  { src: 'js/features/stall-inventory.js', folder: 'js/features/stall-inventory', ns: '__stallInv', chunk: 300 },
  { src: 'js/core/menu.js', folder: 'js/core/menu', ns: '__menu', chunk: 280 },
  { src: 'js/features/sync/sync-bases.js', folder: 'js/features/sync/sync-bases', ns: '__syncBases', chunk: 280 },
  { src: 'js/features/view-list.js', folder: 'js/features/view-list', ns: '__viewList', chunk: 280 },
  { src: 'js/features/notifications.js', folder: 'js/features/notifications', ns: '__notifications', ns2: true, chunk: 280 },
  { src: 'js/features/view-cow.js', folder: 'js/features/view-cow', ns: '__viewCow', chunk: 280 },
  { src: 'js/features/lists.js', folder: 'js/features/lists', ns: '__lists', chunk: 280 },
  { src: 'js/features/analytics.js', folder: 'js/features/analytics', ns: '__analytics', chunk: 280 },
  { src: 'js/core/users.js', folder: 'js/core/users', ns: '__users', chunk: 280 },
  { src: 'js/features/export-import.js', folder: 'js/features/export-import', ns: '__exportImport', chunk: 280 },
  { src: 'js/features/chat-data-context.js', folder: 'js/features/chat-data-context', ns: '__chatCtx', chunk: 280 },
  { src: 'js/features/protocols.js', folder: 'js/features/protocols', ns: '__protocols', chunk: 280 },
  { src: 'js/core/app.js', folder: 'js/core/app', ns: '__app', chunk: 280 },
];

const root = path.join(__dirname, '..');
const splitScript = path.join(__dirname, 'split-iife-module.js');

// Pre-process farm-card and stall-inventory-core merge
const fs = require('fs');

// Merge stall-inventory-core into stall-inventory before split (if not yet split)
const invPath = path.join(root, 'js/features/stall-inventory.js');
const invCorePath = path.join(root, 'js/features/stall-inventory-core.js');
if (fs.existsSync(invPath) && fs.existsSync(invCorePath) && !fs.existsSync(invPath + '.orig')) {
  const core = fs.readFileSync(invCorePath, 'utf8');
  const main = fs.readFileSync(invPath, 'utf8');
  if (!main.includes('stall-inventory-core')) {
    const merged = main.replace(/export \{\};\s*$/, '\n// --- stall-inventory-core ---\n' + core.replace(/^\/\*[\s\S]*?\*\/\s*/, '').replace(/export \{\};\s*$/, '') + '\nexport {};\n');
    fs.writeFileSync(invPath + '.premerge', main);
    fs.writeFileSync(invPath, merged);
    console.log('Merged stall-inventory-core into stall-inventory.js');
  }
}

// Unwrap farm-card IIFE for splitting
const farmPath = path.join(root, 'js/features/farm-card.js');
if (fs.existsSync(farmPath) && !fs.existsSync(farmPath + '.orig')) {
  let fc = fs.readFileSync(farmPath, 'utf8');
  if (fc.includes("(function () {")) {
    fc = fc.replace(/^\(function \(\) \{\s*'use strict';\s*/m, '');
    fc = fc.replace(/\}\)\(\);\s*$/m, '');
    fs.writeFileSync(farmPath + '.orig', fs.readFileSync(farmPath));
    fs.writeFileSync(farmPath, fc);
    console.log('Unwrapped farm-card IIFE for split');
  }
}

for (const s of splits) {
  const full = path.join(root, s.src);
  if (!fs.existsSync(full)) {
    console.warn('SKIP (missing):', s.src);
    continue;
  }
  if (fs.existsSync(full + '.orig') && fs.readFileSync(full, 'utf8').startsWith('/** Facade')) {
    console.warn('SKIP (already split):', s.src);
    continue;
  }
  console.log('\n=== Splitting', s.src, '===');
  try {
    execSync(`node "${splitScript}" "${s.src}" "${s.folder}" "${s.ns}" ${s.chunk}`, {
      cwd: root,
      stdio: 'inherit',
    });
  } catch (e) {
    console.error('FAILED:', s.src, e.message);
  }
}

console.log('\nAll splits done.');
