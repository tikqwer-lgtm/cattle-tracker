/**
 * Копирует веб-приложение из родительской папки в electron/ перед сборкой.
 * Запускается автоматически перед npm run dist.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dest = __dirname;

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

const copyFile = (src, d) => {
  const target = path.join(dest, d || path.basename(src));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(src, target);
};

const iconsDir = path.join(dest, 'icons');
if (fs.existsSync(iconsDir)) {
  fs.rmSync(iconsDir, { recursive: true });
  console.log('  (удалена старая electron/icons)');
}

for (const stale of ['js', 'lib']) {
  const staleDir = path.join(dest, stale);
  if (fs.existsSync(staleDir)) {
    fs.rmSync(staleDir, { recursive: true, force: true });
    console.log('  (удалена устаревшая electron/' + stale + ')');
  }
}

console.log('Копирование веб-приложения в electron/...');

const { execSync } = require('child_process');
try {
  execSync('npm run build', { cwd: root, stdio: 'inherit' });
} catch (e) {
  console.warn('  Предупреждение: сборка бандла не выполнена (npm run build в корне).');
}

const files = ['index.html', 'manifest.json', 'sw.js'];
const favicon = path.join(root, 'favicon.ico');
if (fs.existsSync(favicon)) files.push('favicon.ico');

for (const f of files) {
  const src = path.join(root, f);
  if (fs.existsSync(src)) {
    copyFile(src, f);
    console.log('  ', f);
  }
}

const electronIndex = path.join(dest, 'index.html');
if (fs.existsSync(electronIndex)) {
  let html = fs.readFileSync(electronIndex, 'utf8');
  html = html.replace(/src="dist\/app\.js"/g, 'src="web/app.js"');
  html = html.replace(/href="dist\/app\.css"/g, 'href="web/app.css"');
  fs.writeFileSync(electronIndex, html);
  console.log('  index.html: dist/app.js → web/app.js, dist/app.css → web/app.css');
}

const templatesSrc = path.join(root, 'assets', 'templates');
if (fs.existsSync(templatesSrc)) {
  copyDirTo('assets/templates', 'templates');
  console.log('  templates/ (акт Word)');
}

const rootDist = path.join(root, 'dist');
if (fs.existsSync(rootDist)) {
  const webDir = path.join(dest, 'web');
  fs.mkdirSync(webDir, { recursive: true });
  const appJs = path.join(rootDist, 'app.js');
  if (fs.existsSync(appJs)) {
    fs.copyFileSync(appJs, path.join(webDir, 'app.js'));
    console.log('  web/app.js (из dist/)');
  }
  const appCss = path.join(rootDist, 'app.css');
  if (fs.existsSync(appCss)) {
    fs.copyFileSync(appCss, path.join(webDir, 'app.css'));
    console.log('  web/app.css (из dist/)');
  }
}

if (fs.existsSync(path.join(root, 'icons'))) {
  copyDirTo('icons', 'app-icons');
  console.log('  ', 'app-icons/ (из icons/)');
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

console.log('Готово.');
