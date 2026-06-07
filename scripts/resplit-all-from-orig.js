const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.join(__dirname, '..');
const splitScript = path.join(__dirname, 'split-iife-module.js');

const configs = {
  'js/ui/cow-operations.js.orig': { folder: 'js/ui/cow-operations', ns: '__cowOps', chunk: 280 },
  'js/features/farm-card.js.orig': { folder: 'js/features/farm-card', ns: '__farmCard', chunk: 250 },
  'js/features/stall-inventory.js.orig': { folder: 'js/features/stall-inventory', ns: '__stallInv', chunk: 300 },
  'js/core/menu.js.orig': { folder: 'js/core/menu', ns: '__menu', chunk: 280 },
  'js/features/sync/sync-bases.js.orig': { folder: 'js/features/sync/sync-bases', ns: '__syncBases', chunk: 250 },
  'js/features/view-list.js.orig': { folder: 'js/features/view-list', ns: '__viewList', chunk: 250 },
  'js/features/notifications.js.orig': { folder: 'js/features/notifications', ns: '__notif', chunk: 250 },
  'js/features/view-cow.js.orig': { folder: 'js/features/view-cow', ns: '__viewCow', chunk: 280 },
  'js/features/lists.js.orig': { folder: 'js/features/lists', ns: '__lists', chunk: 250 },
  'js/features/analytics.js.orig': { folder: 'js/features/analytics', ns: '__analytics', chunk: 250 },
  'js/core/users.js.orig': { folder: 'js/core/users', ns: '__users', chunk: 250 },
  'js/features/export-import.js.orig': { folder: 'js/features/export-import', ns: '__exportImport', chunk: 280 },
  'js/features/chat-data-context.js.orig': { folder: 'js/features/chat-data-context', ns: '__chatCtx', chunk: 280 },
  'js/features/protocols.js.orig': { folder: 'js/features/protocols', ns: '__protocols', chunk: 280 },
  'js/core/app.js.orig': { folder: 'js/core/app', ns: '__app', chunk: 280 },
};

for (const [origRel, cfg] of Object.entries(configs)) {
  const orig = path.join(root, origRel);
  const target = orig.replace('.orig', '');
  if (!fs.existsSync(orig)) continue;
  fs.copyFileSync(orig, target);
  const folder = path.join(root, cfg.folder);
  if (fs.existsSync(folder)) fs.rmSync(folder, { recursive: true });
  console.log('Resplit', target);
  execSync(`node "${splitScript}" "${origRel.replace('.orig', '')}" "${cfg.folder}" "${cfg.ns}" ${cfg.chunk}`, {
    cwd: root, stdio: 'inherit',
  });
}

execSync('node scripts/fix-exports-sm.js', { cwd: root, stdio: 'inherit' });
console.log('Done resplit-all');
