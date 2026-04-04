/**
 * Публичная выдача последнего APK, манифест версий на сервере и (для admin) загрузка/список/удаление.
 */
const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { requireAuth, requireRole } = require('../auth');

const APK_NAME = 'cattle-tracker-latest.apk';
const VERSION_NAME = 'version.json';
const MANIFEST_NAME = 'manifest.json';

/** Каталог APK у корня сервера: server/apk (не вложен в data). */
function getMobileDir() {
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

const router = express.Router();

router.get('/mobile/info', (req, res) => {
  migrateLegacyLatestIfNeeded();
  const apkPath = getApkPath();
  try {
    if (!fs.existsSync(apkPath)) {
      return res.json({
        available: false,
        size: null,
        version: null,
        downloadPath: '/api/mobile/app.apk'
      });
    }
    const st = fs.statSync(apkPath);
    res.json({
      available: true,
      size: st.size,
      version: readVersionMeta(),
      downloadPath: '/api/mobile/app.apk'
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Не удалось прочитать данные о сборке' });
  }
});

router.get('/mobile/app.apk', (req, res) => {
  migrateLegacyLatestIfNeeded();
  const apkPath = getApkPath();
  if (!fs.existsSync(apkPath)) {
    return res.status(404).json({ error: 'APK на сервере не размещён' });
  }
  res.setHeader('Content-Type', 'application/vnd.android.package-archive');
  res.setHeader('Content-Disposition', 'attachment; filename="cattle-tracker-latest.apk"');
  res.sendFile(path.resolve(apkPath), (err) => {
    if (err && !res.headersSent) {
      console.error(err);
      res.status(500).json({ error: 'Ошибка отдачи файла' });
    }
  });
});

router.get(
  '/admin/mobile-apk/list',
  requireAuth,
  requireRole('admin'),
  (req, res) => {
    migrateLegacyLatestIfNeeded();
    const m = readManifest();
    res.json({ ok: true, items: m.items });
  }
);

router.delete(
  '/admin/mobile-apk/:filename',
  requireAuth,
  requireRole('admin'),
  (req, res) => {
    migrateLegacyLatestIfNeeded();
    const name = path.basename((req.params.filename || '').trim());
    if (!name || name !== req.params.filename || name.indexOf('..') !== -1) {
      return res.status(400).json({ error: 'Некорректное имя файла' });
    }
    if (name === MANIFEST_NAME || name === VERSION_NAME) {
      return res.status(400).json({ error: 'Нельзя удалить служебный файл' });
    }
    const m = readManifest();
    const idx = m.items.findIndex((it) => it && it.filename === name);
    if (idx === -1) {
      return res.status(404).json({ error: 'Файл не найден в списке' });
    }
    const dir = getMobileDir();
    const filePath = path.join(dir, name);
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: 'Не удалось удалить файл' });
    }
    m.items.splice(idx, 1);
    writeManifest(m);
    syncLatestFromManifest(m.items);
    if (m.items.length === 0) {
      try {
        if (fs.existsSync(getVersionPath())) fs.unlinkSync(getVersionPath());
      } catch (_) {}
    }
    res.json({ ok: true });
  }
);

const upload = multer({
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

router.post(
  '/admin/mobile-apk',
  requireAuth,
  requireRole('admin'),
  (req, res, next) => {
    upload.single('apk')(req, res, (err) => {
      if (err) {
        const msg = err.message || 'Ошибка загрузки';
        const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
        return res.status(status).json({ error: msg });
      }
      next();
    });
  },
  (req, res) => {
    if (!req.file || !req.file.path) {
      return res.status(400).json({ error: 'Файл apk не получен (поле формы: apk)' });
    }
    migrateLegacyLatestIfNeeded();
    const tmpPath = req.file.path;
    const orig = sanitizeOriginal(req.file.originalname || 'app.apk');
    const storedName = `cattle-tracker-${Date.now()}-${orig}`;
    const dir = getMobileDir();
    const finalPath = path.join(dir, storedName);
    try {
      fs.renameSync(tmpPath, finalPath);
      const st = fs.statSync(finalPath);
      const ver = (req.body && req.body.version != null) ? String(req.body.version).trim() : '';
      if (ver) writeVersionMeta(ver);
      const m = readManifest();
      m.items.unshift({
        filename: storedName,
        originalName: orig,
        size: st.size,
        uploadedAt: new Date().toISOString(),
        version: ver || null
      });
      writeManifest(m);
      syncLatestFromManifest(m.items);
      res.status(201).json({
        ok: true,
        size: st.size,
        version: ver || readVersionMeta(),
        filename: storedName
      });
    } catch (e) {
      console.error(e);
      try {
        if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
        if (fs.existsSync(finalPath)) fs.unlinkSync(finalPath);
      } catch (_) {}
      res.status(500).json({ error: 'Не удалось сохранить APK' });
    }
  }
);

module.exports = router;
