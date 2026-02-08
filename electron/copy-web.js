/**
 * Копирует веб-приложение из родительской папки в electron/ перед сборкой.
 * Запускается автоматически перед npm run dist.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dest = __dirname;

// Удаляем старую папку icons (если осталась от прошлой сборки), чтобы electron-builder не падал
const iconsDir = path.join(dest, 'icons');
if (fs.existsSync(iconsDir)) {
  fs.rmSync(iconsDir, { recursive: true });
  console.log('  (удалена старая electron/icons)');
}

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
// Копируем icons как app-icons, чтобы electron-builder не принимал папку "icons" за иконки приложения (.ico)
['css', 'js', 'lib'].forEach(dir => {
  if (fs.existsSync(path.join(root, dir))) {
    copyDir(dir);
    console.log('  ', dir + '/');
  }
});
if (fs.existsSync(path.join(root, 'icons'))) {
  copyDirTo('icons', 'app-icons');
  console.log('  ', 'app-icons/ (из icons/)');
  // Обновляем ссылки в скопированных файлах
  const replaceIcons = (file) => {
    const p = path.join(dest, file);
    if (fs.existsSync(p)) {
      let s = fs.readFileSync(p, 'utf8');
      s = s.replace(/icons\//g, 'app-icons/');
      fs.writeFileSync(p, s);
    }
  };
  replaceIcons('index.html');
  replaceIcons('manifest.json');
  replaceIcons('sw.js');
}

function copyDirTo(srcSubdir, destSubdir) {
  const srcDir = path.join(root, srcSubdir);
  const destDir = path.join(dest, destSubdir);
  if (!fs.existsSync(srcDir)) return;
  fs.mkdirSync(destDir, { recursive: true });
  for (const name of fs.readdirSync(srcDir)) {
    const srcPath = path.join(srcDir, name);
    const destPath = path.join(destDir, name);
    if (fs.statSync(srcPath).isDirectory()) {
      copyDirTo(path.join(srcSubdir, name), path.join(destSubdir, name));
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

console.log('Готово.');
