/**
 * Увеличивает версию в package.json (major.minor.patch), versionCode в android (+1),
 * затем запускает sync-version.js для синхронизации versionName и др.
 * Правило: в каждом разряде не более двух цифр (0–99): 0.5.99 → 0.6.0, 0.99.99 → 1.0.0.
 * Запуск: node scripts/bump-version.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const MAX_SEGMENT = 99;

function bumpVersionString(ver) {
  var parts = String(ver || '0.0.0')
    .split('.')
    .map(function (s) {
      var n = parseInt(s, 10);
      return Number.isFinite(n) ? n : 0;
    });
  while (parts.length < 3) parts.push(0);
  var major = parts[0];
  var minor = parts[1];
  var patch = parts[2];
  if (patch < MAX_SEGMENT) {
    patch++;
  } else if (minor < MAX_SEGMENT) {
    minor++;
    patch = 0;
  } else {
    major++;
    minor = 0;
    patch = 0;
  }
  return major + '.' + minor + '.' + patch;
}

const root = path.resolve(__dirname, '..');
const pkgPath = path.join(root, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
pkg.version = bumpVersionString(pkg.version);
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
