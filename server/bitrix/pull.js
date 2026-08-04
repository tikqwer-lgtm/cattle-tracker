/**
 * Pull: компания + контакты Битрикс → farm-card profile.
 */
const bitrixDb = require('../db/bitrix');
const farmCard = require('../db/farm-card');
const client = require('./client');
const map = require('./map');

function specialistKey(s) {
  if (!s || typeof s !== 'object') return '';
  if (s.bitrixContactId) return 'bx:' + String(s.bitrixContactId);
  if (s.id) return 'id:' + String(s.id);
  return '';
}

function mergeSpecialists(existing, fromBitrix, objectId) {
  const pending = bitrixDb.listPendingExports({ objectId: objectId, status: 'pending' });
  const locked = {};
  for (let i = 0; i < pending.length; i++) {
    const p = pending[i];
    if (p.kind !== 'specialist') continue;
    const pl = p.payload || {};
    if (pl.bitrixContactId) locked['bx:' + String(pl.bitrixContactId)] = true;
    if (pl.id) locked['id:' + String(pl.id)] = true;
  }

  const byBx = {};
  const localOnly = [];
  (Array.isArray(existing) ? existing : []).forEach(function (s) {
    if (!s || typeof s !== 'object') return;
    if (s.bitrixContactId) byBx[String(s.bitrixContactId)] = s;
    else localOnly.push(s);
  });

  const out = [];
  const seenBx = {};
  (Array.isArray(fromBitrix) ? fromBitrix : []).forEach(function (incoming) {
    const bxId = incoming.bitrixContactId ? String(incoming.bitrixContactId) : '';
    const key = bxId ? 'bx:' + bxId : specialistKey(incoming);
    if (key && locked[key]) {
      const prev = bxId && byBx[bxId] ? byBx[bxId] : null;
      if (prev) out.push(prev);
      else out.push(incoming);
      if (bxId) seenBx[bxId] = true;
      return;
    }
    if (bxId && byBx[bxId]) {
      const prev = byBx[bxId];
      out.push(
        Object.assign({}, prev, {
          name: incoming.name || prev.name,
          role: incoming.role != null ? incoming.role : prev.role,
          phones: incoming.phones && incoming.phones.length ? incoming.phones : prev.phones,
          phone: incoming.phone || prev.phone,
          email: incoming.email || prev.email,
          bitrixContactId: bxId,
          source: 'bitrix',
          id: prev.id || incoming.id
        })
      );
      seenBx[bxId] = true;
      return;
    }
    out.push(incoming);
    if (bxId) seenBx[bxId] = true;
  });

  // Локальные без bitrixContactId — всегда оставляем
  localOnly.forEach(function (s) {
    out.push(s);
  });

  // Специалисты с bitrixContactId, которых больше нет в Битрикс, но есть открытый pending — оставить
  Object.keys(byBx).forEach(function (bxId) {
    if (seenBx[bxId]) return;
    if (locked['bx:' + bxId]) out.push(byBx[bxId]);
  });

  return out;
}

async function pullObjectFarmCard(objectId, opts) {
  opts = opts || {};
  const webhook = bitrixDb.getWebhookUrl();
  if (!webhook) return { ok: false, error: 'Webhook Битрикс не настроен' };

  const profile = farmCard.getObjectProfile(objectId) || {};
  let companyId =
    opts.bitrixCompanyId != null && String(opts.bitrixCompanyId).trim()
      ? String(opts.bitrixCompanyId).trim()
      : profile.bitrixCompanyId != null
        ? String(profile.bitrixCompanyId).trim()
        : '';
  if (!companyId) {
    return { ok: false, error: 'Не указан ID компании Битрикс для хозяйства' };
  }

  const company = await client.callMethod(webhook, 'crm.company.get', { id: companyId });
  if (!company || !company.ID) {
    return { ok: false, error: 'Компания Битрикс не найдена' };
  }

  let contacts = [];
  let start = 0;
  for (let page = 0; page < 20; page++) {
    const rows = await client.callMethod(webhook, 'crm.contact.list', {
      filter: { COMPANY_ID: companyId },
      select: [
        'ID',
        'NAME',
        'LAST_NAME',
        'SECOND_NAME',
        'POST',
        'PHONE',
        'EMAIL',
        'COMPANY_ID'
      ],
      start: start
    });
    const list = Array.isArray(rows) ? rows : [];
    contacts = contacts.concat(list);
    if (list.length < 50) break;
    start += list.length;
  }

  const mapped = map.mapCompanyAndContacts(company, contacts);
  const prevBundle = farmCard.getFarmCardBundle(objectId);

  const addressLocked = bitrixDb.hasOpenPendingFor(objectId, function (p) {
    return p.kind === 'address';
  });

  const nextAddress = addressLocked
    ? prevBundle.addressInfo || mapped.addressInfo
    : mapped.addressInfo;

  const nextSpecialists = mergeSpecialists(
    prevBundle.specialists || [],
    mapped.specialists,
    objectId
  );

  const nextProfile = Object.assign({}, profile, {
    name: profile.name || mapped.title || '',
    legalName: profile.legalName || '',
    notes: profile.notes || '',
    contacts: Array.isArray(prevBundle.contacts) ? prevBundle.contacts : [],
    addresses: Array.isArray(prevBundle.addresses) ? prevBundle.addresses : [],
    addressInfo: nextAddress,
    specialists: nextSpecialists,
    metricDefinitions: Array.isArray(prevBundle.metricDefinitions)
      ? prevBundle.metricDefinitions
      : [],
    metricValues: Array.isArray(prevBundle.metricValues) ? prevBundle.metricValues : [],
    bullFertility: Array.isArray(prevBundle.bullFertility) ? prevBundle.bullFertility : [],
    events: Array.isArray(prevBundle.events) ? prevBundle.events : [],
    items: Array.isArray(prevBundle.items) ? prevBundle.items : [],
    goals: Array.isArray(prevBundle.goals) ? prevBundle.goals : [],
    bitrixCompanyId: companyId,
    bitrixSyncedAt: new Date().toISOString(),
    bitrixSnapshot: {
      addressInfo: mapped.addressInfo,
      specialists: mapped.specialists,
      title: mapped.title,
      pulledAt: new Date().toISOString()
    }
  });

  farmCard.putObjectProfile(objectId, nextProfile);
  return {
    ok: true,
    bundle: farmCard.getFarmCardBundle(objectId),
    bitrixCompanyId: companyId,
    contactsCount: mapped.specialists.length
  };
}

async function searchCompanies(query) {
  const webhook = bitrixDb.getWebhookUrl();
  if (!webhook) return { ok: false, error: 'Webhook Битрикс не настроен' };
  const q = String(query || '').trim();
  const params = {
    select: ['ID', 'TITLE', 'PHONE', 'EMAIL'],
    start: 0
  };
  if (q) {
    params.filter = { '%TITLE': q };
  }
  const result = await client.callMethod(webhook, 'crm.company.list', params);
  const rows = Array.isArray(result) ? result : [];
  return {
    ok: true,
    items: rows.map(function (c) {
      return {
        id: c.ID != null ? String(c.ID) : '',
        title: c.TITLE != null ? String(c.TITLE) : ''
      };
    })
  };
}

module.exports = {
  pullObjectFarmCard,
  searchCompanies,
  mergeSpecialists
};
