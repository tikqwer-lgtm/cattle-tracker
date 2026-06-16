/**
 * Админ: загрузка/список/удаление APK.
 * Монтирование: app.use('/api/admin', router) → POST /api/admin/mobile-apk и т.д.
 */
const express = require('express');
const path = require('path');
const fs = require('fs');
const { requireAuth, requireRole } = require('../auth');
const apk = require('../lib/mobile-apk-storage');

const router = express.Router();
const apkUploadMulter = apk.createApkUploadMulter();

router.get('/mobile-apk/list', requireAuth, requireRole('admin'), (req, res) => {
  apk.migrateLegacyLatestIfNeeded();
  const m = apk.readManifest();
  res.json({ ok: true, items: m.items });
});

router.delete('/mobile-apk/:filename', requireAuth, requireRole('admin'), (req, res) => {
  apk.migrateLegacyLatestIfNeeded();
  const name = path.basename((req.params.filename || '').trim());
  if (!name || name !== req.params.filename || name.indexOf('..') !== -1) {
    return res.status(400).json({ error: 'Некорректное имя файла' });
  }
  if (name === apk.MANIFEST_NAME || name === apk.VERSION_NAME) {
    return res.status(400).json({ error: 'Нельзя удалить служебный файл' });
  }
  const m = apk.readManifest();
  const idx = m.items.findIndex((it) => it && it.filename === name);
  if (idx === -1) {
    return res.status(404).json({ error: 'Файл не найден в списке' });
  }
  const dir = apk.getMobileDir();
  const filePath = path.join(dir, name);
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Не удалось удалить файл' });
  }
  m.items.splice(idx, 1);
  apk.writeManifest(m);
  apk.syncLatestFromManifest(m.items);
  if (m.items.length === 0) {
    try {
      if (fs.existsSync(apk.getVersionPath())) fs.unlinkSync(apk.getVersionPath());
    } catch (_) {}
  }
  res.json({ ok: true });
});

router.post(
  '/mobile-apk',
  requireAuth,
  requireRole('admin'),
  (req, res, next) => {
    apkUploadMulter.single('apk')(req, res, (err) => {
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
    apk.migrateLegacyLatestIfNeeded();
    const tmpPath = req.file.path;
    const orig = apk.sanitizeOriginal(req.file.originalname || 'app.apk');
    const storedName = `cattle-tracker-${Date.now()}-${orig}`;
    const dir = apk.getMobileDir();
    const finalPath = path.join(dir, storedName);
    try {
      fs.renameSync(tmpPath, finalPath);
      const st = fs.statSync(finalPath);
      const ver = (req.body && req.body.version != null) ? String(req.body.version).trim() : '';
      if (ver) apk.writeVersionMeta(ver);
      const m = apk.readManifest();
      const previousItems = m.items.slice();
      const newEntry = {
        filename: storedName,
        originalName: orig,
        size: st.size,
        uploadedAt: new Date().toISOString(),
        version: ver || null
      };
      for (const it of previousItems) {
        if (!it || !it.filename) continue;
        const name = path.basename(String(it.filename).trim());
        if (!name || name === storedName) continue;
        const oldPath = path.join(dir, name);
        try {
          if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        } catch (e) {
          console.warn('APK: не удалось удалить предыдущий файл', name, e.message);
        }
      }
      m.items = [newEntry];
      apk.writeManifest(m);
      apk.syncLatestFromManifest(m.items);
      res.status(201).json({
        ok: true,
        size: st.size,
        version: ver || apk.readVersionMeta(),
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
