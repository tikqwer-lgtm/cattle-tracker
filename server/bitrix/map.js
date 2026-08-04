/**
 * Маппинг Company / Contact Битрикс → поля карточки хозяйства.
 */

function firstMulti(field) {
  if (field == null) return '';
  if (Array.isArray(field)) {
    for (let i = 0; i < field.length; i++) {
      const item = field[i];
      if (item == null) continue;
      if (typeof item === 'object' && item.VALUE != null) return String(item.VALUE).trim();
      if (typeof item === 'string' || typeof item === 'number') return String(item).trim();
    }
    return '';
  }
  if (typeof field === 'object' && field.VALUE != null) return String(field.VALUE).trim();
  return String(field).trim();
}

function allMulti(field) {
  const out = [];
  if (field == null) return out;
  const list = Array.isArray(field) ? field : [field];
  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    let v = '';
    if (item == null) continue;
    if (typeof item === 'object' && item.VALUE != null) v = String(item.VALUE).trim();
    else v = String(item).trim();
    if (v && out.indexOf(v) === -1) out.push(v);
  }
  return out;
}

function mapCompanyAddress(company) {
  const c = company && typeof company === 'object' ? company : {};
  const region =
    c.ADDRESS_REGION ||
    c.REG_ADDRESS_REGION ||
    c.UF_CRM_REGION ||
    '';
  const locality =
    c.ADDRESS_CITY ||
    c.REG_ADDRESS_CITY ||
    c.ADDRESS_PROVINCE ||
    '';
  const parts = [
    c.ADDRESS,
    c.ADDRESS_2,
    c.ADDRESS_STREET || c.STREET,
    c.ADDRESS_HOUSE
  ]
    .map(function (x) {
      return x != null ? String(x).trim() : '';
    })
    .filter(Boolean);
  const address = parts.join(', ') || (c.ADDRESS_LEGAL != null ? String(c.ADDRESS_LEGAL).trim() : '');
  return {
    region: region != null ? String(region).trim() : '',
    locality: locality != null ? String(locality).trim() : '',
    address: address
  };
}

function mapContactToSpecialist(contact) {
  const c = contact && typeof contact === 'object' ? contact : {};
  const id = c.ID != null ? String(c.ID) : '';
  const name = [c.LAST_NAME, c.NAME, c.SECOND_NAME]
    .map(function (x) {
      return x != null ? String(x).trim() : '';
    })
    .filter(Boolean)
    .join(' ');
  const phones = allMulti(c.PHONE);
  const emails = allMulti(c.EMAIL);
  return {
    id: id ? 'bx_c_' + id : 'bx_c_' + Date.now(),
    bitrixContactId: id,
    source: 'bitrix',
    role: c.POST != null ? String(c.POST).trim() : '',
    name: name || (c.FULL_NAME != null ? String(c.FULL_NAME).trim() : ''),
    phones: phones,
    phone: phones[0] || '',
    email: emails[0] || firstMulti(c.EMAIL),
    geoId: '',
    note: ''
  };
}

function mapCompanyAndContacts(company, contacts) {
  const specialists = (Array.isArray(contacts) ? contacts : [])
    .map(mapContactToSpecialist)
    .filter(function (s) {
      return s && (s.name || s.email || (s.phones && s.phones.length));
    });
  const addressInfo = mapCompanyAddress(company);
  const title = company && company.TITLE != null ? String(company.TITLE).trim() : '';
  return {
    title: title,
    addressInfo: addressInfo,
    specialists: specialists,
    bitrixCompanyId:
      company && company.ID != null ? String(company.ID) : ''
  };
}

module.exports = {
  firstMulti,
  allMulti,
  mapCompanyAddress,
  mapContactToSpecialist,
  mapCompanyAndContacts
};
