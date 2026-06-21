/**
 * Синхронизирует версию из корневого package.json в:
 * - index.html (data-default-version)
 * - electron/package.json (version)
 * - android/app/build.gradle (versionName)
 *
 * Запуск: node scripts/sync-version.js
 * Версия — единственный источник правды: корневой package.json.
 */

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const pkgPath = path.join(root, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const version = pkg.version;
if (!version) {
  console.error('В корневом package.json нет поля version');
  process.exit(1);
}

// index.html (все вхождения data-default-version)
const indexPath = path.join(root, 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');
html = html.replace(/data-default-version="[^"]*"/g, `data-default-version="${version}"`);
fs.writeFileSync(indexPath, html);
console.log('index.html: data-default-version =', version);

// html/screens/menu.html — источник для assemble-html
const menuPath = path.join(root, 'html', 'screens', 'menu.html');
if (fs.existsSync(menuPath)) {
  let menuHtml = fs.readFileSync(menuPath, 'utf8');
  menuHtml = menuHtml.replace(/data-default-version="[^"]*"/g, `data-default-version="${version}"`);
  fs.writeFileSync(menuPath, menuHtml);
  console.log('html/screens/menu.html: data-default-version =', version);
}

// electron/package.json
const electronPkgPath = path.join(root, 'electron', 'package.json');
const electronPkg = JSON.parse(fs.readFileSync(electronPkgPath, 'utf8'));
electronPkg.version = version;
fs.writeFileSync(electronPkgPath, JSON.stringify(electronPkg, null, 2) + '\n');
console.log('electron/package.json: version =', version);

// android/app/build.gradle — только versionName (versionCode увеличивать вручную при релизе)
const gradlePath = path.join(root, 'android', 'app', 'build.gradle');
let gradle = fs.readFileSync(gradlePath, 'utf8');
gradle = gradle.replace(/versionName\s+"[^"]*"/, `versionName "${version}"`);
fs.writeFileSync(gradlePath, gradle);
console.log('android/app/build.gradle: versionName =', version);

console.log('Версия синхронизирована:', version);
