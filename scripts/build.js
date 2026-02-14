/**
 * Сборка одного бандла приложения (конкатенация JS в порядке зависимостей).
 * Результат: dist/app.js. В index.html подключается один скрипт вместо множества.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const distDir = path.join(root, 'dist');
const outFile = path.join(distDir, 'app.js');

const scriptOrder = [
  'js/config.js',
  'js/utils/constants.js',
  'js/utils/utils.js',
  'js/core/events.js',
  'js/api/api-client.js',
  'js/storage/storage-objects.js',
  'js/storage/storage-entries.js',
  'js/storage/storage-integrity.js',
  'js/storage/storage.js',
  'js/core/core.js',
  'js/core/users.js',
  'js/ui/ui-helpers.js',
  'js/ui/cow-operations.js',
  'js/utils/voice-handler.js',
  'js/core/app.js',
  'js/features/sync.js',
  'js/features/export-import-parse.js',
  'js/features/export-import.js',
  'js/features/export-excel.js',
  'js/features/insemination.js',
  'js/features/view-cow.js',
  'js/ui/field-config.js',
  'js/features/search-filter.js',
  'js/features/notifications.js',
  'js/features/analytics-calc.js',
  'js/features/analytics.js',
  'js/features/backup.js',
  'js/features/view-list-fields.js',
  'js/features/view-list.js',
  'js/features/protocols.js',
  'js/core/menu.js'
];

if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

let out = '';
for (const rel of scriptOrder) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) {
    console.warn('Пропуск (не найден):', rel);
    continue;
  }
  const content = fs.readFileSync(full, 'utf8');
  out += '// === ' + rel + '\n' + content + '\n';
}

fs.writeFileSync(outFile, out, 'utf8');
console.log('Собрано:', outFile, '(' + (out.length / 1024).toFixed(1) + ' КБ)');
