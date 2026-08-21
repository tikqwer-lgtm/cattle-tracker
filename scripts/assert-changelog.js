/**
 * Сборка без пользовательского описания текущей версии в CHANGELOG.md запрещена.
 * Запуск: node scripts/assert-changelog.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const version = String(pkg.version || '').trim();
const changelogPath = path.join(root, 'CHANGELOG.md');

if (!version) {
  console.error('В корневом package.json нет version');
  process.exit(1);
}
if (!fs.existsSync(changelogPath)) {
  console.error('Нет CHANGELOG.md');
  process.exit(1);
}

const text = fs.readFileSync(changelogPath, 'utf8');
const lines = String(text).split(/\r?\n/);
let current = null;
let currentSection = false;
const entries = [];
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const verMatch = line.match(/^## \[([^\]]+)\]\s*-\s*(.+)$/);
  if (verMatch) {
    if (current) entries.push(current);
    current = { version: verMatch[1].trim(), itemCount: 0 };
    currentSection = false;
    continue;
  }
  if (/^###\s+/.test(line) && current) {
    currentSection = true;
    continue;
  }
  if (/^-\s+.+/.test(line) && current) {
    current.itemCount += 1;
    currentSection = true;
  }
}
if (current) entries.push(current);

const found = entries.find((e) => e.version === version);
if (!found) {
  console.error('В CHANGELOG.md нет секции ## [' + version + '] — сначала описание для пользователя, потом сборка.');
  process.exit(1);
}
if (found.itemCount < 1) {
  console.error('Секция ## [' + version + '] в CHANGELOG.md пустая — нужен хотя бы один пункт.');
  process.exit(1);
}

console.log('CHANGELOG.md: секция', version, 'OK (' + found.itemCount + ')');
