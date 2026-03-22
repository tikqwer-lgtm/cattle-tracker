/**
 * Увеличивает patch-версию в package.json, versionCode в android (+1),
 * затем запускает sync-version.js для синхронизации versionName и др.
 * Запуск: node scripts/bump-version.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const pkgPath = path.join(root, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const ver = String(pkg.version || '0.0.0');
const parts = ver.split('.').map(function (s) { return parseInt(s, 10); });
while (parts.length < 3) parts.push(0);
parts[2] = (parts[2] || 0) + 1;
pkg.version = parts[0] + '.' + parts[1] + '.' + parts[2];
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
console.log('package.json version ->', pkg.version);

const gradlePath = path.join(root, 'android', 'app', 'build.gradle');
let gradle = fs.readFileSync(gradlePath, 'utf8');
gradle = gradle.replace(/versionCode\s+(\d+)/, function (_, code) {
  return 'versionCode ' + (parseInt(code, 10) + 1);
});
fs.writeFileSync(gradlePath, gradle);
console.log('android/app/build.gradle: versionCode +1');

execSync('node "' + path.join(__dirname, 'sync-version.js') + '"', { cwd: root, stdio: 'inherit' });
