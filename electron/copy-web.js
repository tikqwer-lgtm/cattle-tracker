/**
 * Копирует веб-приложение из родительской папки в electron/ перед сборкой.
 * Запускается автоматически перед npm run dist.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dest = __dirname;

const copyFile = (src, d) => {
  const target = path.join(dest, d || path.basename(src));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(src, target);
};

const copyDir = (dir) => {
  const srcDir = path.join(root, dir);
  const destDir = path.join(dest, dir);
  if (!fs.existsSync(srcDir)) return;
  fs.mkdirSync(destDir, { recursive: true });
  for (const name of fs.readdirSync(srcDir)) {
    const srcPath = path.join(srcDir, name);
    const destPath = path.join(destDir, name);
    if (fs.statSync(srcPath).isDirectory()) {
      copyDir(path.join(dir, name));
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
};

const files = ['index.html', 'manifest.json', 'sw.js'];
const favicon = path.join(root, 'favicon.ico');
if (fs.existsSync(favicon)) files.push('favicon.ico');

console.log('Копирование веб-приложения в electron/...');
for (const f of files) {
  const src = path.join(root, f);
  if (fs.existsSync(src)) {
    copyFile(src, f);
    console.log('  ', f);
  }
}
['css', 'js', 'lib', 'icons'].forEach(dir => {
  if (fs.existsSync(path.join(root, dir))) {
    copyDir(dir);
    console.log('  ', dir + '/');
  }
});
console.log('Готово.');
