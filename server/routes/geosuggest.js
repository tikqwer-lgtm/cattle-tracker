/**
 * Прокси подсказок адреса (Яндекс Geosuggest API v1).
 * Ключ: YANDEX_MAPS_API_KEY в server/.env
 * @see https://yandex.com/dev/geosuggest/doc/en/
 */
const express = require('express');
const router = express.Router();
const { requireAuth } = require('../auth');

function mapComponentsToFields(address) {
  const out = { region: '', locality: '', street: '', house: '' };
  if (!address || !Array.isArray(address.component)) return out;
  const regionBits = [];
  address.component.forEach((c) => {
    const name = (c.name != null ? String(c.name) : '').trim();
    if (!name) return;
    const kinds = Array.isArray(c.kind) ? c.kind : c.kind != null ? [c.kind] : [];
    kinds.forEach((rawK) => {
      const k = String(rawK || '').toLowerCase();
      if (k === 'country' || k === 'province' || k === 'region' || k === 'area') {
        regionBits.push(name);
      } else if (k === 'locality') {
        out.locality = out.locality ? `${out.locality}, ${name}` : name;
      } else if (k === 'district' || k === 'street' || k === 'hydro' || k === 'route' || k === 'station') {
        out.street = out.street ? `${out.street}, ${name}` : name;
      } else if (k === 'house') {
        out.house = name;
      }
    });
  });
  out.region = regionBits.join(', ');
  return out;
}

function normalizeYandexResults(body) {
  const raw = body && Array.isArray(body.results) ? body.results : [];
  return raw.map((item) => {
    const title = item.title && item.title.text != null ? String(item.title.text) : '';
    const subtitle = item.subtitle && item.subtitle.text != null ? String(item.subtitle.text) : '';
    const uri = item.uri != null ? String(item.uri) : '';
    let region = '';
    let locality = '';
    let street = '';
    let house = '';
    if (item.address && item.address.component) {
      const m = mapComponentsToFields(item.address);
      region = m.region;
      locality = m.locality;
      street = m.street;
      house = m.house;
    }
    if (!locality && !street && title) {
      locality = title;
    }
    return {
      title,
      subtitle,
      uri,
      region,
      locality,
      street,
      house,
      formatted: item.address && item.address.formatted_address ? String(item.address.formatted_address) : title
    };
  });
}

router.get('/geosuggest', requireAuth, async (req, res) => {
  const key = (process.env.YANDEX_MAPS_API_KEY || process.env.YANDEX_GEO_SUGGEST_KEY || '').trim();
  if (!key) {
    return res.status(503).json({ error: 'Подсказки адреса не настроены (YANDEX_MAPS_API_KEY в .env сервера).' });
  }
  const text = String(req.query.text || '').trim();
  if (!text || text.length < 2) {
    return res.json({ suggestions: [] });
  }
  const url = new URL('https://suggest-maps.yandex.ru/v1/suggest');
  url.searchParams.set('apikey', key);
  url.searchParams.set('text', text.slice(0, 500));
  url.searchParams.set('lang', 'ru_RU');
  url.searchParams.set('results', '8');
  url.searchParams.set('print_address', '1');
  url.searchParams.set('attrs', 'uri');
  try {
    const r = await fetch(url.toString(), {
      headers: {
        'User-Agent': 'CattleTracker/1.0 (geosuggest proxy; +https://github.com/)'
      }
    });
    const txt = await r.text();
    let data = {};
    try {
      data = JSON.parse(txt);
    } catch (_) {
      return res.status(502).json({ error: 'Некорректный ответ Яндекса' });
    }
    if (!r.ok) {
      const errMsg = (data && (data.message || data.error)) || `Ошибка Яндекса ${r.status}`;
      return res.status(r.status === 403 ? 502 : 502).json({ error: String(errMsg) });
    }
    res.json({ suggestions: normalizeYandexResults(data) });
  } catch (e) {
    console.error('geosuggest:', e.message);
    res.status(502).json({ error: 'Сеть или сервис подсказок недоступен' });
  }
});

module.exports = router;
