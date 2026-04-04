/**
 * Хранение APK на сервере (каталог server/apk): манифест, latest, миграция.
 */
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const APK_NAME = 'cattle-tracker-latest.apk';
const VERSION_NAME = 'version.json';
const MANIFEST_NAME = 'manifest.json';

function getMobileDir() {
  const raw = process.env.APK_STORAGE_DIR;
  if (raw != null && String(raw).trim() !== '') {
    return path.resolve(String(raw).trim());
  }
  return path.join(__dirname, '..', 'apk');
}

function getApkPath() {
  return path.join(getMobileDir(), APK_NAME);
}

function getVersionPath() {
  return path.join(getMobileDir(), VERSION_NAME);
}

function getManifestPath() {
  return path.join(getMobileDir(), MANIFEST_NAME);
}

function readManifest() {
  try {
    const p = getManifestPath();
    if (!fs.existsSync(p)) return { items: [] };
    const j = JSON.parse(fs.readFileSync(p, 'utf8'));
    return j && Array.isArray(j.items) ? j : { items: [] };
  } catch (_) {
    return { items: [] };
  }
}

function writeManifest(m) {
  fs.writeFileSync(getManifestPath(), JSON.stringify({ items: m.items || [] }, null, 0), 'utf8');
}

function readVersionMeta() {
  try {
    const raw = fs.readFileSync(getVersionPath(), 'utf8');
    const j = JSON.parse(raw);
    const v = j && j.version != null ? String(j.version).trim() : '';
    return v || null;
  } catch (_) {
    return null;
  }
}

function writeVersionMeta(version) {
  if (!version) return;
  const p = getVersionPath();
  fs.writeFileSync(p, JSON.stringify({ version }, null, 0), 'utf8');
}

function migrateLegacyLatestIfNeeded() {
  const dir = getMobileDir();
  const latestPath = getApkPath();
  let m = readManifest();
  if (m.items.length > 0) return;
  if (!fs.existsSync(latestPath)) return;
  try {
    const st = fs.statSync(latestPath);
    const legacyName = `cattle-tracker-${Math.floor(st.mtimeMs)}-legacy.apk`;
    const legacyPath = path.join(dir, legacyName);
    if (!fs.existsSync(legacyPath)) {
      fs.renameSync(latestPath, legacyPath);
    } else {
      fs.copyFileSync(latestPath, legacyPath);
      try {
        fs.unlinkSync(latestPath);
      } catch (_) {}
    }
    fs.copyFileSync(legacyPath, latestPath);
    m.items = [{
      filename: legacyName,
      originalName: 'migrated.apk',
      size: st.size,
      uploadedAt: st.mtime.toISOString(),
      version: readVersionMeta()
    }];
    writeManifest(m);
  } catch (e) {
    console.error('mobile manifest migrate:', e);
  }
}

function sanitizeOriginal(name) {
  const base = path.basename(name || 'app.apk').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100);
  return (base && base.toLowerCase().endsWith('.apk')) ? base : ((base || 'app') + '.apk');
}

function syncLatestFromManifest(items) {
  const dir = getMobileDir();
  const latestPath = getApkPath();
  if (!items || items.length === 0) {
    try {
      if (fs.existsSync(latestPath)) fs.unlinkSync(latestPath);
    } catch (_) {}
    return;
  }
  const first = items[0];
  const src = path.join(dir, first.filename);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, latestPath);
  }
}

function createApkUploadMulter() {
  return multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => {
        cb(null, getMobileDir());
      },
      filename: (req, file, cb) => {
        cb(null, `.upload-${Date.now()}.apk`);
      }
    }),
    limits: { fileSize: 100 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      const ok =
        (file.originalname && file.originalname.toLowerCase().endsWith('.apk')) ||
        file.mimetype === 'application/vnd.android.package-archive' ||
        file.mimetype === 'application/octet-stream';
      if (!ok) {
        return cb(new Error('Ожидается файл .apk'));
      }
      cb(null, true);
    }
  });
}

module.exports = {
  APK_NAME,
  VERSION_NAME,
  MANIFEST_NAME,
  getMobileDir,
  getApkPath,
  getVersionPath,
  getManifestPath,
  readManifest,
  writeManifest,
  readVersionMeta,
  writeVersionMeta,
  migrateLegacyLatestIfNeeded,
  sanitizeOriginal,
  syncLatestFromManifest,
  createApkUploadMulter
};
