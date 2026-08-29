/**
 * Assemble index.html from html/shell-start.html, html/screens/modals.html,
 * html/screens/stall-modals.html, html/shell-end.html.
 * Screen markup lives in html/screens/*.html and is injected by React LegacyHost.
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');

const parts = [
  'html/shell-start.html',
  'html/screens/modals.html',
  'html/screens/stall-modals.html',
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

const pkgPath = path.join(root, 'package.json');
if (fs.existsSync(pkgPath)) {
  try {
    const version = JSON.parse(fs.readFileSync(pkgPath, 'utf8')).version;
    if (version) {
      out = out.replace(/data-default-version="[^"]*"/g, `data-default-version="${version}"`);
    }
  } catch (e) {
    console.warn('assemble-html: не удалось прочитать version из package.json');
  }
}

fs.writeFileSync(path.join(root, 'index.html'), out.trimEnd() + '\n');
console.log('Assembled index.html from', parts.length, 'partials');
