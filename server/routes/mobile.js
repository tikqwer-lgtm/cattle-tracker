/**
 * Публичная выдача последнего APK (без авторизации).
 * Админские маршруты загрузки/списка — в routes/admin.js (чтобы деплой admin не терял POST).
 */
const express = require('express');
const fs = require('fs');
const path = require('path');
const apk = require('../lib/mobile-apk-storage');

const router = express.Router();

const CHANGELOG_CANDIDATES = [
  path.join(__dirname, '..', 'CHANGELOG.md'),
  path.join(__dirname, '..', '..', 'CHANGELOG.md'),
];

function readChangelogFile() {
  for (const p of CHANGELOG_CANDIDATES) {
    try {
      if (fs.existsSync(p)) {
        return fs.readFileSync(p, 'utf8');
      }
    } catch (e) {
      /* try next */
    }
  }
  return null;
}

router.get('/mobile/changelog', (req, res) => {
  try {
    const text = readChangelogFile();
    if (!text || !String(text).trim()) {
      return res.status(404).json({ error: 'CHANGELOG не найден на сервере' });
    }
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.send(text);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Не удалось прочитать CHANGELOG' });
  }
});

router.get('/mobile/info', (req, res) => {
  apk.migrateLegacyLatestIfNeeded();
  const apkPath = apk.getApkPath();
  const m = apk.readManifest();
  const first = m.items && m.items[0];
  try {
    if (!fs.existsSync(apkPath)) {
      return res.json({
        available: false,
        size: null,
        version: null,
        originalName: null,
        uploadedAt: null,
        filename: null,
        downloadPath: '/api/mobile/app.apk'
      });
    }
    const st = fs.statSync(apkPath);
    const versionMeta = apk.readVersionMeta();
    const version =
      (first && first.version != null && String(first.version).trim()) ||
      versionMeta ||
      null;
    res.json({
      available: true,
      size: st.size,
      version,
      originalName: first && first.originalName ? String(first.originalName) : null,
      uploadedAt: first && first.uploadedAt ? String(first.uploadedAt) : null,
      filename: first && first.filename ? String(first.filename) : null,
      downloadPath: '/api/mobile/app.apk'
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Не удалось прочитать данные о сборке' });
  }
});

router.get('/mobile/app.apk', (req, res) => {
  apk.migrateLegacyLatestIfNeeded();
  const apkPath = apk.getApkPath();
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

module.exports = router;
