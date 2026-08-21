/**
 * Сборка debug APK (Capacitor + Gradle) и загрузка на сервер POST /api/admin/mobile-apk.
 * Сервер заменяет предыдущие файлы в манифесте (см. server/routes/admin-mobile-apk.js).
 *
 * Переменные окружения (или файлы .env, .env.local, mobile-installer.env в корне — не в git):
 *   CATTLE_TRACKER_API_BASE — база API без хвоста /api (например http://31.130.155.149:3000)
 *   CATTLE_TRACKER_APK_UPLOAD_TOKEN — JWT администратора (Bearer), либо пара:
 *   CATTLE_TRACKER_APK_UPLOAD_USER + CATTLE_TRACKER_APK_UPLOAD_PASSWORD — вход POST /api/auth/login (нужна роль admin)
 *
 * Если CATTLE_TRACKER_API_BASE не задан, читается server/server-address.txt (SERVER_IP=…),
 * порт: CATTLE_TRACKER_API_PORT или 3000.
 *
 * Только загрузка уже собранного APK (без vite/cap/gradle):
 *   node scripts/mobile-installer.js --upload-only
 *   или CATTLE_TRACKER_MOBILE_UPLOAD_ONLY=1
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');

function readPackageVersion() {
  const j = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  return String(j.version || '').trim() || '0.0.0';
}

function stripBom(s) {
  if (!s || s.charCodeAt(0) !== 0xfeff) return s;
  return s.slice(1);
}

function applyEnvFile(raw) {
  raw = stripBom(String(raw || ''));
  for (const line of raw.split(/\r?\n/)) {
    if (/^\s*#/.test(line)) continue;
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    const k = m[1];
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (process.env[k] == null || process.env[k] === '') process.env[k] = v;
  }
}

/** Локальные секреты для агента/CI: не коммитить. Порядок — от общего к частному. */
function loadLocalEnvFiles() {
  const files = [
    path.join(root, '.env'),
    path.join(root, '.env.local'),
    path.join(root, 'mobile-installer.env'),
  ];
  for (const p of files) {
    if (!fs.existsSync(p)) continue;
    try {
      applyEnvFile(fs.readFileSync(p, 'utf8'));
    } catch (e) {
      console.warn('Не удалось прочитать', p, e.message);
    }
  }
}

function parseServerAddressFile() {
  const p = path.join(root, 'server', 'server-address.txt');
  if (!fs.existsSync(p)) return null;
  const raw = fs.readFileSync(p, 'utf8');
  const line = raw.split(/\r?\n/).find((l) => /^\s*SERVER_IP\s*=/.test(l));
  if (!line) return null;
  const m = line.match(/SERVER_IP\s*=\s*(\S+)/);
  return m ? m[1].trim() : null;
}

function getApiBase() {
  let base = (process.env.CATTLE_TRACKER_API_BASE || '').trim().replace(/\/$/, '');
  if (base.length >= 4 && base.slice(-4).toLowerCase() === '/api') {
    base = base.slice(0, -4).replace(/\/$/, '');
  }
  if (base) return base;
  const ip = parseServerAddressFile();
  if (!ip) {
    console.error(
      'Задайте CATTLE_TRACKER_API_BASE или создайте server/server-address.txt с строкой SERVER_IP=…'
    );
    process.exit(1);
  }
  const port = (process.env.CATTLE_TRACKER_API_PORT || '3000').trim();
  return `http://${ip}:${port}`;
}

/** Убирает zero-width и лишние \r (частая причина «неверный пароль» после копирования). */
function sanitizeLoginFields(username, password) {
  const zw = /[\u200B-\u200D\uFEFF]/g;
  const u = String(username || '').replace(zw, '').trim();
  let p = String(password || '').replace(zw, '');
  p = p.replace(/\r\n/g, '\n').replace(/\r/g, '');
  p = p.replace(/\n+$/g, '');
  return { username: u, password: p };
}

async function fetchLoginToken(apiBase, username, password) {
  const cred = sanitizeLoginFields(username, password);
  const url = `${apiBase.replace(/\/$/, '')}/api/auth/login`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: cred.username, password: cred.password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data.error || data.message || 'Ошибка входа ' + res.status;
    const err = new Error(msg);
    if (res.status === 401) {
      err.hint =
        'Проверьте логин/пароль учётки приложения (роль admin), URL ' +
        url +
        '. При сложном пароле используйте CATTLE_TRACKER_APK_UPLOAD_TOKEN или заключите пароль в кавычки в mobile-installer.env.';
    }
    throw err;
  }
  const token = data.token && String(data.token).trim();
  if (!token) throw new Error('В ответе login нет token');
  const role = data.user && data.user.role;
  if (role !== 'admin') {
    throw new Error('Для загрузки APK нужен пользователь с ролью admin (сейчас: ' + (role || '—') + ')');
  }
  return token;
}

async function resolveUploadToken(apiBase) {
  const t =
    (process.env.CATTLE_TRACKER_APK_UPLOAD_TOKEN || process.env.CATTLE_TRACKER_API_TOKEN || '').trim();
  if (t) return t;
  const u = (process.env.CATTLE_TRACKER_APK_UPLOAD_USER || '').trim();
  const p = (process.env.CATTLE_TRACKER_APK_UPLOAD_PASSWORD || '').trim();
  if (u && p) {
    console.log('Получение JWT через POST /api/auth/login…');
    return fetchLoginToken(apiBase, u, p);
  }
  const envPath = path.join(root, 'mobile-installer.env');
  if (fs.existsSync(envPath)) {
    const raw = stripBom(fs.readFileSync(envPath, 'utf8'));
    const hasUserKey = /^\s*CATTLE_TRACKER_APK_UPLOAD_USER\s*=/m.test(raw);
    const hasPassKey = /^\s*CATTLE_TRACKER_APK_UPLOAD_PASSWORD\s*=/m.test(raw);
    if ((hasUserKey || hasPassKey) && (!u || !p)) {
      console.error(
        'В mobile-installer.env указаны CATTLE_TRACKER_APK_UPLOAD_USER и/или PASSWORD, но значения пусты (проверьте строки KEY=значение без пробелов до/после =).'
      );
    }
  }
  console.error(
    'Нет учётных данных для загрузки APK. Укажите один из вариантов (в .env / .env.local / mobile-installer.env):'
  );
  console.error('  • CATTLE_TRACKER_APK_UPLOAD_TOKEN=<JWT администратора>');
  console.error('  • CATTLE_TRACKER_APK_UPLOAD_USER и CATTLE_TRACKER_APK_UPLOAD_PASSWORD (admin)');
  console.error('Образец: скопируйте mobile-installer.env.example → mobile-installer.env и заполните.');
  process.exit(1);
}

function run(name, command, args, opts) {
  const merged = {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
    shell: false,
    ...opts,
  };
  const r = spawnSync(command, args, merged);
  if (r.error) {
    console.error(name + ':', r.error.message);
    process.exit(1);
  }
  if (r.status !== 0) {
    console.error(name + ': код выхода', r.status);
    process.exit(r.status || 1);
  }
}

function runNpmApk() {
  if (process.platform === 'win32') {
    /* npm.cmd с shell:false даёт EINVAL — это не .exe, запускаем через cmd (как Gradle). */
    const cmdExe =
      process.env.ComSpec || path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'cmd.exe');
    const r = spawnSync(cmdExe, ['/d', '/s', '/c', 'npm run apk'], {
      cwd: root,
      stdio: 'inherit',
      env: process.env,
    });
    if (r.error) {
      console.error('npm run apk:', r.error.message);
      process.exit(1);
    }
    if (r.status !== 0) {
      console.error('npm run apk: код выхода', r.status);
      process.exit(r.status || 1);
    }
    return;
  }
  run('npm run apk', 'npm', ['run', 'apk'], { cwd: root });
}

function runGradleAssembleDebug() {
  const androidDir = path.join(root, 'android');
  if (process.platform === 'win32') {
    const cmdExe =
      process.env.ComSpec || path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'cmd.exe');
    /* Полный путь в кавычках для cmd /c даёт сломанную строку (\"…\"). cwd=android → достаточно gradlew.bat */
    const r = spawnSync(cmdExe, ['/d', '/s', '/c', 'gradlew.bat assembleDebug --no-daemon'], {
      cwd: androidDir,
      stdio: 'inherit',
      env: process.env,
    });
    if (r.error) {
      console.error('Gradle assembleDebug:', r.error.message);
      process.exit(1);
    }
    if (r.status !== 0) {
      console.error('Gradle assembleDebug: код выхода', r.status);
      process.exit(r.status || 1);
    }
    return;
  }
  run('Gradle assembleDebug', path.join(androidDir, 'gradlew'), ['assembleDebug', '--no-daemon'], {
    cwd: androidDir,
  });
}

function buildMultipartApkBody(apkPath, version) {
  const boundary = '----CattleTrackerApk' + Date.now();
  const name = path.basename(apkPath);
  const fileBuf = fs.readFileSync(apkPath);
  const crlf = Buffer.from('\r\n');
  const parts = [];
  function appendField(fieldName, value) {
    const head = Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="${fieldName}"\r\n\r\n${value}\r\n`,
      'utf8'
    );
    parts.push(head);
  }
  appendField('version', version);
  const fileHead = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="apk"; filename="${name.replace(/"/g, '_')}"\r\nContent-Type: application/vnd.android.package-archive\r\n\r\n`,
    'utf8'
  );
  parts.push(fileHead, fileBuf, crlf);
  parts.push(Buffer.from(`--${boundary}--\r\n`, 'utf8'));
  return { contentType: `multipart/form-data; boundary=${boundary}`, body: Buffer.concat(parts) };
}

async function uploadApk(apkPath, version, apiBase, token) {
  const name = path.basename(apkPath);
  const url = `${apiBase.replace(/\/$/, '')}/api/admin/mobile-apk`;
  const { contentType, body } = buildMultipartApkBody(apkPath, version);

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': contentType,
    },
    body,
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (_) {
    data = { raw: text };
  }
  if (!res.ok) {
    console.error('Загрузка APK:', res.status, data);
    process.exit(1);
  }
  console.log(
    'APK загружен на сервер:',
    data.filename || name,
    data.version != null ? `(version meta: ${data.version})` : ''
  );
}

async function uploadChangelog(apiBase, token) {
  const changelogPath = path.join(root, 'CHANGELOG.md');
  if (!fs.existsSync(changelogPath)) {
    console.error('Нет CHANGELOG.md — список изменений на сервере не обновится.');
    process.exit(1);
  }
  const markdown = fs.readFileSync(changelogPath, 'utf8');
  const url = `${apiBase.replace(/\/$/, '')}/api/admin/changelog`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ markdown }),
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (_) {
    data = { raw: text };
  }
  if (!res.ok) {
    console.error('Загрузка CHANGELOG:', res.status, data);
    process.exit(1);
  }
  console.log('CHANGELOG.md загружен на сервер');
}

async function main() {
  if (process.argv.includes('--upload-only')) {
    process.env.CATTLE_TRACKER_MOBILE_UPLOAD_ONLY = '1';
  }
  loadLocalEnvFiles();

  const version = readPackageVersion();
  console.log('Версия приложения:', version);

  const uploadOnly = (process.env.CATTLE_TRACKER_MOBILE_UPLOAD_ONLY || '').trim() === '1';
  if (!uploadOnly) {
    runNpmApk();
    runGradleAssembleDebug();
  } else {
    console.log('Режим только загрузки (--upload-only / CATTLE_TRACKER_MOBILE_UPLOAD_ONLY=1), сборка APK пропущена.');
  }

  const apkPath = path.join(root, 'apk', `cattle-tracker-${version}-debug.apk`);
  if (!fs.existsSync(apkPath)) {
    console.error('APK не найден:', apkPath);
    console.error('Ожидался файл после assembleDebug (см. android/app/build.gradle, afterEvaluate).');
    process.exit(1);
  }

  const apiBase = getApiBase();
  const token = await resolveUploadToken(apiBase);
  console.log('API:', apiBase);
  await uploadApk(apkPath, version, apiBase, token);
  await uploadChangelog(apiBase, token);
}

main().catch((e) => {
  console.error(e && e.stack ? e.stack : e);
  if (e && e.hint) console.error(e.hint);
  /* После Gradle/npm с stdio: inherit мгновенный exit на Windows иногда даёт assert libuv. */
  setImmediate(() => process.exit(1));
});
