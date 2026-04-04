/**
 * Публичная выдача последнего APK (без авторизации).
 * Админские маршруты загрузки/списка — в routes/admin.js (чтобы деплой admin не терял POST).
 */
const express = require('express');
const fs = require('fs');
const path = require('path');
const apk = require('../lib/mobile-apk-storage');

const router = express.Router();

router.get('/mobile/info', (req, res) => {
  apk.migrateLegacyLatestIfNeeded();
  const apkPath = apk.getApkPath();
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
      version: apk.readVersionMeta(),
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
