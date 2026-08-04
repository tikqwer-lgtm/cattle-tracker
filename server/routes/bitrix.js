/**
 * Admin API: Битрикс24 — настройки, pull, очередь ручного переноса.
 */
const express = require('express');
const router = express.Router();
const { requireAuth, requireRole, requireObjectAccess } = require('../auth');
const bitrixDb = require('../db/bitrix');
const farmCard = require('../db/farm-card');
const client = require('../bitrix/client');
const pull = require('../bitrix/pull');

router.get('/admin/bitrix/settings', requireAuth, requireRole('admin'), (req, res) => {
  const url = bitrixDb.getWebhookUrl();
  res.json({
    configured: !!url,
    webhookMasked: bitrixDb.maskWebhookUrl(url),
    fromEnv: !bitrixDb.getBitrixSetting('webhook_url') && !!process.env.BITRIX_WEBHOOK_URL
  });
});

router.put('/admin/bitrix/settings', requireAuth, requireRole('admin'), (req, res) => {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  if (body.webhookUrl != null) {
    const raw = String(body.webhookUrl).trim();
    if (raw && !/^https?:\/\//i.test(raw)) {
      return res.status(400).json({ error: 'Укажите полный URL webhook (https://…)' });
    }
    // Пустая строка — очистить DB (останется env, если есть)
    bitrixDb.setWebhookUrl(raw);
  }
  const url = bitrixDb.getWebhookUrl();
  res.json({
    configured: !!url,
    webhookMasked: bitrixDb.maskWebhookUrl(url)
  });
});

router.post('/admin/bitrix/test', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    let url = bitrixDb.getWebhookUrl();
    if (body.webhookUrl != null && String(body.webhookUrl).trim()) {
      url = String(body.webhookUrl).trim().replace(/\/?$/, '/');
    }
    if (!url) return res.status(400).json({ error: 'Webhook не задан' });
    const result = await client.testConnection(url);
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message || 'Ошибка проверки Битрикс' });
  }
});

router.get('/admin/bitrix/companies', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const result = await pull.searchCompanies(req.query.q || '');
    if (!result.ok) return res.status(400).json({ error: result.error });
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message || 'Ошибка поиска компаний' });
  }
});

router.get(
  '/objects/:objectId/bitrix',
  requireAuth,
  requireObjectAccess('objectId'),
  (req, res) => {
    const objectId = String(req.params.objectId || '').trim();
    const profile = farmCard.getObjectProfile(objectId) || {};
    res.json({
      bitrixCompanyId: profile.bitrixCompanyId != null ? String(profile.bitrixCompanyId) : '',
      bitrixSyncedAt: profile.bitrixSyncedAt != null ? String(profile.bitrixSyncedAt) : ''
    });
  }
);

router.put(
  '/objects/:objectId/bitrix',
  requireAuth,
  requireObjectAccess('objectId'),
  requireRole('admin'),
  (req, res) => {
    const objectId = String(req.params.objectId || '').trim();
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const profile = farmCard.getObjectProfile(objectId) || {};
    if (body.bitrixCompanyId != null) {
      profile.bitrixCompanyId = String(body.bitrixCompanyId).trim();
    }
    farmCard.putObjectProfile(objectId, profile);
    res.json({
      bitrixCompanyId: profile.bitrixCompanyId != null ? String(profile.bitrixCompanyId) : '',
      bitrixSyncedAt: profile.bitrixSyncedAt != null ? String(profile.bitrixSyncedAt) : ''
    });
  }
);

router.post(
  '/admin/bitrix/pull/:objectId',
  requireAuth,
  requireRole('admin'),
  requireObjectAccess('objectId'),
  async (req, res) => {
    try {
      const objectId = String(req.params.objectId || '').trim();
      const body = req.body && typeof req.body === 'object' ? req.body : {};
      if (body.bitrixCompanyId != null && String(body.bitrixCompanyId).trim()) {
        const profile = farmCard.getObjectProfile(objectId) || {};
        profile.bitrixCompanyId = String(body.bitrixCompanyId).trim();
        farmCard.putObjectProfile(objectId, profile);
      }
      const result = await pull.pullObjectFarmCard(objectId, {
        bitrixCompanyId: body.bitrixCompanyId
      });
      if (!result.ok) return res.status(400).json({ error: result.error });
      res.json(result);
    } catch (e) {
      res.status(400).json({ error: e.message || 'Ошибка загрузки из Битрикс' });
    }
  }
);

router.get('/admin/bitrix/pending', requireAuth, requireRole('admin'), (req, res) => {
  const status = req.query.status != null ? String(req.query.status) : 'pending';
  const objectId = req.query.objectId != null ? String(req.query.objectId) : '';
  res.json({
    items: bitrixDb.listPendingExports({
      status: status === 'all' ? '' : status,
      objectId: objectId
    })
  });
});

router.patch('/admin/bitrix/pending/:id', requireAuth, requireRole('admin'), (req, res) => {
  const id = String(req.params.id || '').trim();
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const action = String(body.action || body.status || '').trim();
  let status = 'done';
  if (action === 'dismiss' || action === 'dismissed') status = 'dismissed';
  else if (action === 'done') status = 'done';
  else return res.status(400).json({ error: 'Укажите action: done или dismiss' });
  const userId = req.user && req.user.id != null ? String(req.user.id) : null;
  const row = bitrixDb.resolvePendingExport(id, status, userId);
  if (!row) return res.status(404).json({ error: 'Запись не найдена' });
  res.json(row);
});

module.exports = router;
