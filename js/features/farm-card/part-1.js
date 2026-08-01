/** __farmCard part 1 */
(function () {
  'use strict';
  var root = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this);
  var NS = root['__farmCard'] = root['__farmCard'] || {};
  var global = typeof window !== 'undefined' ? window : this;

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function newId(prefix) {
    return prefix + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  function emptyBundle() {
    return {
      contacts: [],
      addresses: [],
      specialists: [],
      metricDefinitions: [],
      metricValues: [],
      events: [],
      items: [],
      goals: [],
      notes: ''
    };
  }

  function defaultMetricDefinitions() {
    return [
      { id: 'm_herd_cows', label: 'Количество коров', valueType: 'int', source: 'computed', computedKey: 'herd_cows', sortOrder: 0 },
      { id: 'm_herd_calves', label: 'Количество телят', valueType: 'int', source: 'computed', computedKey: 'herd_calves', sortOrder: 1 },
      { id: 'm_cr', label: 'CR %', valueType: 'percent', source: 'computed', computedKey: 'cr_pct', sortOrder: 2 },
      { id: 'm_hdr', label: 'HDR %', valueType: 'percent', source: 'computed', computedKey: 'hdr_pct', sortOrder: 3 },
      { id: 'm_pr', label: 'PR %', valueType: 'percent', source: 'computed', computedKey: 'pr_pct', sortOrder: 4 }
    ];
  }

  function mergeDefaultMetrics(bundle) {
    var b = bundle || emptyBundle();
    if (!b.metricDefinitions || b.metricDefinitions.length === 0) {
      b.metricDefinitions = defaultMetricDefinitions();
    }
    return b;
  }

  function readFarmCardCache(objectId) {
    if (!objectId) return null;
    if (window.CattleTrackerObjectData && window.CattleTrackerObjectData.loadFarmProfileLocal) {
      return window.CattleTrackerObjectData.loadFarmProfileLocal(objectId);
    }
    try {
      var raw = localStorage.getItem(globalThis['__farmCard'].state.CACHE_PREFIX + objectId);
      if (!raw) {
        raw = localStorage.getItem('cattleTracker_farmCard_' + objectId);
      }
      if (!raw) return null;
      var p = JSON.parse(raw);
      if (!p || typeof p !== 'object') return null;
      return {
        contacts: Array.isArray(p.contacts) ? p.contacts : [],
        addresses: Array.isArray(p.addresses) ? p.addresses : [],
        specialists: Array.isArray(p.specialists) ? p.specialists : [],
        metricDefinitions: Array.isArray(p.metricDefinitions) ? p.metricDefinitions : [],
        metricValues: Array.isArray(p.metricValues) ? p.metricValues : [],
        events: Array.isArray(p.events) ? p.events : [],
        items: Array.isArray(p.items) ? p.items : [],
        goals: Array.isArray(p.goals) ? p.goals : []
      };
    } catch (e) {
      return null;
    }
  }

  function writeFarmCardCache(objectId, bundle) {
    if (!objectId) return;
    if (window.CattleTrackerObjectData && window.CattleTrackerObjectData.saveFarmProfileLocal) {
      window.CattleTrackerObjectData.saveFarmProfileLocal(objectId, bundle || emptyBundle());
      return;
    }
    try {
      localStorage.setItem(globalThis['__farmCard'].state.CACHE_PREFIX + objectId, JSON.stringify(bundle || emptyBundle()));
    } catch (e) {
      console.warn('writeFarmCardCache', e.message);
    }
  }

  function getObjectIdForFarm() {
    if (typeof window.getCurrentObjectId !== 'function') return 'default';
    var id = window.getCurrentObjectId();
    var pend = window.CattleTrackerApi && window.CattleTrackerApi.PENDING_OBJECT_ID;
    if (pend && id === pend) return '';
    return id || 'default';
  }

  function farmCardCanEdit() {
    var u = typeof window.getCurrentUser === 'function' ? window.getCurrentUser() : null;
    if (!u) return false;
    if (typeof window.hasCapability === 'function') return window.hasCapability('farmCardSettings', u);
    return u.role === 'admin';
  }

  function normalizeItem(raw, idx) {
    if (!raw || typeof raw !== 'object') return null;
    var type = String(raw.type || 'text');
    if (['text', 'number', 'date', 'image', 'geo'].indexOf(type) === -1) type = 'text';
    var value = raw.value;
    if (type === 'geo' && value && typeof value === 'object') {
      value = {
        lat: value.lat != null ? Number(value.lat) : null,
        lng: value.lng != null ? Number(value.lng) : null,
        label: value.label != null ? String(value.label) : '',
        navUrl: value.navUrl != null ? String(value.navUrl) : ''
      };
    } else if (type === 'number' && value != null && value !== '') {
      var n = Number(value);
      value = isNaN(n) ? value : n;
    } else if (value == null) {
      value = type === 'geo' ? { lat: null, lng: null, label: '', navUrl: '' } : '';
    }
    return {
      id: raw.id != null ? String(raw.id) : 'it_' + idx,
      label: raw.label != null ? String(raw.label) : '',
      type: type,
      value: value,
      updatedAt: raw.updatedAt != null ? String(raw.updatedAt) : '',
      sortOrder: raw.sortOrder != null ? Number(raw.sortOrder) || idx : idx,
      objectId: raw.objectId != null ? String(raw.objectId) : ''
    };
  }

  function normalizeGoal(raw, idx) {
    if (!raw || typeof raw !== 'object') return null;
    var status = String(raw.status || 'open');
    if (['open', 'done', 'overdue'].indexOf(status) === -1) status = 'open';
    return {
      id: raw.id != null ? String(raw.id) : 'g_' + idx,
      title: raw.title != null ? String(raw.title) : '',
      deadline: raw.deadline != null ? String(raw.deadline) : '',
      status: status,
      linkedItemIds: Array.isArray(raw.linkedItemIds) ? raw.linkedItemIds.map(String) : [],
      notes: raw.notes != null ? String(raw.notes) : ''
    };
  }

  function normalizeEvent(raw, idx) {
    if (!raw || typeof raw !== 'object') return null;
    return {
      id: raw.id != null ? String(raw.id) : 'ev_' + idx,
      eventType: raw.eventType != null ? String(raw.eventType) : 'info',
      eventDate: raw.eventDate != null ? String(raw.eventDate) : '',
      participants: raw.participants != null ? String(raw.participants) : '',
      description: raw.description != null ? String(raw.description) : '',
      task: raw.task != null ? String(raw.task) : '',
      goal: raw.goal != null ? String(raw.goal) : '',
      reminderAt: raw.reminderAt != null ? String(raw.reminderAt) : '',
      completed: !!raw.completed,
      notifyLocal: raw.notifyLocal !== false
    };
  }

  function refreshGoalStatuses(goals) {
    var today = new Date().toISOString().slice(0, 10);
    return (goals || []).map(function (g) {
      if (!g || g.status === 'done') return g;
      if (g.deadline && String(g.deadline) < today) {
        return Object.assign({}, g, { status: 'overdue' });
      }
      if (g.status === 'overdue' && (!g.deadline || String(g.deadline) >= today)) {
        return Object.assign({}, g, { status: 'open' });
      }
      return g;
    });
  }

  function normalizeBundle(raw) {
    var b = emptyBundle();
    if (!raw || typeof raw !== 'object') return mergeDefaultMetrics(b);
    b.contacts = Array.isArray(raw.contacts) ? raw.contacts : [];
    b.addresses = Array.isArray(raw.addresses) ? raw.addresses : [];
    b.specialists = Array.isArray(raw.specialists) ? raw.specialists : [];
    if (!b.specialists.length) b.specialists = [];
    b.notes = raw.notes != null ? String(raw.notes) : '';
    b.name = raw.name != null ? String(raw.name) : '';
    b.legalName = raw.legalName != null ? String(raw.legalName) : '';
    b.metricDefinitions = Array.isArray(raw.metricDefinitions) ? raw.metricDefinitions : [];
    b.metricValues = Array.isArray(raw.metricValues) ? raw.metricValues : [];
    b.events = (Array.isArray(raw.events) ? raw.events : [])
      .map(normalizeEvent)
      .filter(Boolean);
    b.items = (Array.isArray(raw.items) ? raw.items : [])
      .map(normalizeItem)
      .filter(Boolean);
    b.goals = refreshGoalStatuses(
      (Array.isArray(raw.goals) ? raw.goals : []).map(normalizeGoal).filter(Boolean)
    );
    return mergeDefaultMetrics(b);
  }

  /** Активные коровы: нет даты выбытия. */
  function countHerdCows(entries) {
    var n = 0;
    (entries || []).forEach(function (e) {
      if (!e) return;
      var ex = e.exitDate != null ? String(e.exitDate).trim() : '';
      if (!ex) n++;
    });
    return n;
  }

  /** Телята: лактация 0. */
  function countCalves(entries) {
    var n = 0;
    (entries || []).forEach(function (e) {
      if (!e) return;
      var l = e.lactation;
      if (l === 0 || l === '0') n++;
    });
    return n;
  }

  function computeFromEntries(entries) {
    var out = {
      herd_cows: String(countHerdCows(entries)),
      herd_calves: String(countCalves(entries)),
      cr_pct: '',
      hdr_pct: '',
      pr_pct: ''
    };
    if (typeof window.generateReport === 'function') {
      try {
        var rep = window.generateReport('year', '', '', 60, entries || []);
        if (rep) {
          out.cr_pct = rep.cr != null ? String(rep.cr) : '';
          out.hdr_pct = rep.hdr != null ? String(rep.hdr) : '';
          out.pr_pct = rep.pr != null ? String(rep.pr) : '';
        }
      } catch (e) {}
    }
    return out;
  }

  function getFarmCardBundleForExport() {
    var b = typeof window !== 'undefined' && window.__farmCardBundle ? window.__farmCardBundle : null;
    if (b) return JSON.parse(JSON.stringify(b));
    var oid = getObjectIdForFarm();
    if (!oid) return emptyBundle();
    if (window.CATTLE_TRACKER_USE_API && window.CattleTrackerApi) {
      var c = readFarmCardCache(oid);
      return c ? normalizeBundle(c) : emptyBundle();
    }
    return normalizeBundle(readFarmCardCache(oid));
  }

  function ensureFarmCardLoaded() {
    var myGen = ++globalThis['__farmCard'].state._farmGen;
    var oid = getObjectIdForFarm();
    if (!oid) {
      window.__farmCardBundle = emptyBundle();
      return Promise.resolve(window.__farmCardBundle);
    }
    if (window.CATTLE_TRACKER_USE_API && window.CattleTrackerApi && typeof window.CattleTrackerApi.getFarmCard === 'function') {
      return window.CattleTrackerApi.getFarmCard(oid).then(function (data) {
        if (myGen !== globalThis['__farmCard'].state._farmGen) return window.__farmCardBundle || emptyBundle();
        var b = normalizeBundle(data);
        window.__farmCardBundle = b;
        writeFarmCardCache(oid, b);
        if (typeof window.CattleTrackerEvents !== 'undefined') {
          window.CattleTrackerEvents.emit('farm-card:updated', b);
        }
        return b;
      }).catch(function () {
        var fallback = readFarmCardCache(oid);
        window.__farmCardBundle = normalizeBundle(fallback || emptyBundle());
        return window.__farmCardBundle;
      });
    }
    var local = readFarmCardCache(oid);
    window.__farmCardBundle = normalizeBundle(local || emptyBundle());
    if (typeof window.CattleTrackerEvents !== 'undefined') {
      window.CattleTrackerEvents.emit('farm-card:updated', window.__farmCardBundle);
    }
    return Promise.resolve(window.__farmCardBundle);
  }

  function saveFarmCardBundle(bundle) {
    var oid = getObjectIdForFarm();
    if (!oid) return Promise.reject(new Error('База не выбрана'));
    var b = normalizeBundle(bundle);
    window.__farmCardBundle = b;
    writeFarmCardCache(oid, b);
    var hasServerToken =
      window.CattleTrackerApi &&
      typeof window.CattleTrackerApi.getToken === 'function' &&
      !!window.CattleTrackerApi.getToken();
    var canSyncApi =
      window.CATTLE_TRACKER_USE_API &&
      hasServerToken &&
      window.CattleTrackerApi &&
      typeof window.CattleTrackerApi.putFarmCard === 'function';
    if (canSyncApi) {
      return window.CattleTrackerApi.putFarmCard(oid, b).then(function (data) {
        window.__farmCardBundle = normalizeBundle(data);
        writeFarmCardCache(oid, window.__farmCardBundle);
        if (typeof window.CattleTrackerEvents !== 'undefined') {
          window.CattleTrackerEvents.emit('farm-card:updated', window.__farmCardBundle);
          window.CattleTrackerEvents.emit('farm-goal:changed', window.__farmCardBundle.goals || []);
        }
        return window.__farmCardBundle;
      });
    }
    if (typeof window.CattleTrackerEvents !== 'undefined') {
      window.CattleTrackerEvents.emit('farm-card:updated', b);
      window.CattleTrackerEvents.emit('farm-goal:changed', b.goals || []);
    }
    return Promise.resolve(b);
  }

  function currentMetricSnapshot(values, metricId) {
    var list = (values || [])
      .filter(function (v) {
        return v && v.metricId === metricId;
      })
      .sort(function (a, b) {
        return String(a.valueDate).localeCompare(String(b.valueDate));
      });
    var today = new Date().toISOString().slice(0, 10);
    var best = null;
    for (var i = 0; i < list.length; i++) {
      if (String(list[i].valueDate) <= today) best = list[i];
    }
    if (best) return best;
    return list.length ? list[list.length - 1] : null;
  }

  var _activeTab = 'contacts';
  /** Индекс адреса в форме (−1 — новый). */
  var _addrEditIdx = -1;

  function formatAddressLine(a) {
    if (!a) return '';
    if (a.address && String(a.address).trim()) return String(a.address).trim();
    return [a.region, a.locality, a.street, a.house].filter(Boolean).join(', ');
  }

  function readAddrFormFields() {
    return {
      name: ((document.getElementById('farmCardAddrName') || {}).value || '').trim(),
      region: ((document.getElementById('farmCardAddrRegion') || {}).value || '').trim(),
      locality: ((document.getElementById('farmCardAddrLocality') || {}).value || '').trim(),
      address: ((document.getElementById('farmCardAddrLine') || {}).value || '').trim(),
      navUrl: ((document.getElementById('farmCardAddrNav') || {}).value || '').trim()
    };
  }

  function clearAddrFormFields() {
    ['farmCardAddrName', 'farmCardAddrRegion', 'farmCardAddrLocality', 'farmCardAddrLine', 'farmCardAddrNav'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.value = '';
    });
  }

  function renderFarmCardPanel() {
    if (typeof window._farmSuggestDocClose === 'function') {
      document.removeEventListener('click', window._farmSuggestDocClose, true);
      window._farmSuggestDocClose = null;
    }
    if (NS.state.addrSuggestTimer) {
      clearTimeout(NS.state.addrSuggestTimer);
      NS.state.addrSuggestTimer = null;
    }
    var root = document.getElementById('farmCardRoot');
    if (!root) return;
    var b = window.__farmCardBundle || emptyBundle();
    var canEdit = farmCardCanEdit();

    var tabs =
      '<div class="farm-card-tabs" role="tablist">' +
      '<button type="button" class="farm-card-tab' +
      (_activeTab === 'contacts' ? ' farm-card-tab--active' : '') +
      '" data-farm-tab="contacts">Контакты</button>' +
      '<button type="button" class="farm-card-tab' +
      (_activeTab === 'addresses' ? ' farm-card-tab--active' : '') +
      '" data-farm-tab="addresses">Адреса</button>' +
      '<button type="button" class="farm-card-tab' +
      (_activeTab === 'specialists' ? ' farm-card-tab--active' : '') +
      '" data-farm-tab="specialists">Специалисты</button>' +
      '<button type="button" class="farm-card-tab' +
      (_activeTab === 'items' ? ' farm-card-tab--active' : '') +
      '" data-farm-tab="items">Пункты</button>' +
      '<button type="button" class="farm-card-tab' +
      (_activeTab === 'metrics' ? ' farm-card-tab--active' : '') +
      '" data-farm-tab="metrics">Показатели</button>' +
      '<button type="button" class="farm-card-tab' +
      (_activeTab === 'goals' ? ' farm-card-tab--active' : '') +
      '" data-farm-tab="goals">Цели</button>' +
      '<button type="button" class="farm-card-tab' +
      (_activeTab === 'dynamics' ? ' farm-card-tab--active' : '') +
      '" data-farm-tab="dynamics">Динамика</button>' +
      '<button type="button" class="farm-card-tab' +
      (_activeTab === 'timeline' ? ' farm-card-tab--active' : '') +
      '" data-farm-tab="timeline">Лента событий</button>' +
      '</div>';

    var genetikaBlock = '';
    (b.contacts || []).forEach(function (c) {
      if (c.genetika) {
        genetikaBlock +=
          '<tr><td>' +
          escapeHtml(c.title) +
          '</td><td>' +
          escapeHtml(c.fullName) +
          '</td><td>' +
          escapeHtml((c.phones || []).join(', ')) +
          '</td><td>' +
          escapeHtml(c.note) +
          '</td></tr>';
      }
    });
    var genetikaSection =
      '<section class="farm-card-subsection"><h3 class="farm-card-h3">Закреплённые специалисты МК «Генетика»</h3>' +
      (genetikaBlock
        ? '<div class="farm-card-table-scroll"><table class="farm-card-table"><thead><tr><th>Должность</th><th>ФИО</th><th>Телефоны</th><th>Описание</th></tr></thead><tbody>' +
          genetikaBlock +
          '</tbody></table></div>'
        : '<p class="farm-settings-hint">Отметьте контакт как «МК Генетика» при редактировании.</p>') +
      '</section>';

    var contactsRows = (b.contacts || [])
      .map(function (c, idx) {
        return (
          '<tr data-contact-idx="' +
          idx +
          '"><td>' +
          escapeHtml(c.title) +
          '</td><td>' +
          escapeHtml(c.fullName) +
          '</td><td>' +
          escapeHtml((c.phones || []).join(', ')) +
          '</td><td>' +
          (c.genetika ? 'Да' : '—') +
          '</td><td>' +
          escapeHtml(c.note) +
          '</td>' +
          (canEdit
            ? '<td><button type="button" class="small-btn farm-card-row-edit" data-contact-idx="' +
              idx +
              '">Изм.</button> <button type="button" class="small-btn farm-card-row-del" data-contact-idx="' +
              idx +
              '">Удал.</button></td>'
            : '') +
          '</tr>'
        );
      })
      .join('');

    var contactsHtml =
      '<div class="farm-card-pane" id="farmCardPaneContacts" style="' +
      (_activeTab === 'contacts' ? '' : 'display:none') +
      '">' +
      genetikaSection +
      '<h3 class="farm-card-h3">Все контакты</h3>' +
      '<div class="farm-card-table-scroll"><table class="farm-card-table"><thead><tr><th>Должность</th><th>ФИО</th><th>Телефоны</th><th>МК Генетика</th><th>Описание</th>' +
      (canEdit ? '<th></th>' : '') +
      '</tr></thead><tbody>' +
      (contactsRows || '<tr><td colspan="99" class="farm-card-empty">Нет записей</td></tr>') +
      '</tbody></table></div>' +
      (canEdit
        ? '<div class="farm-card-form">' +
          '<h4 class="farm-card-h4">Новый контакт</h4>' +
          '<label>Должность <input type="text" id="farmCardNewContactTitle" class="farm-settings-inline-input" /></label>' +
          '<label>ФИО <input type="text" id="farmCardNewContactName" class="farm-settings-inline-input" /></label>' +
          '<label>Телефоны (через запятую) <input type="text" id="farmCardNewContactPhones" class="farm-settings-inline-input" /></label>' +
          '<label><input type="checkbox" id="farmCardNewContactGen" /> МК «Генетика»</label>' +
          '<label>Описание <textarea id="farmCardNewContactNote" class="farm-settings-textarea" rows="2"></textarea></label>' +
          '<button type="button" class="small-btn" id="farmCardAddContactBtn">Добавить контакт</button></div>'
        : '') +
      '</div>';

    var editingAddr =
      _addrEditIdx >= 0 && b.addresses && b.addresses[_addrEditIdx] ? b.addresses[_addrEditIdx] : null;

    var addrRows = (b.addresses || [])
      .map(function (a, idx) {
        var name = (a.name && String(a.name).trim()) || 'Без названия';
        var line = formatAddressLine(a);
        var placeBits = [a.region, a.locality].filter(Boolean).join(', ');
        var nav =
          a.navUrl ||
          (a.lat != null && a.lng != null
            ? 'https://yandex.ru/maps/?rtext=~' + a.lat + ',' + a.lng
            : '');
        var navCell = nav
          ? '<a class="farm-card-nav-link" href="' +
            escapeHtml(nav) +
            '" target="_blank" rel="noopener">Яндекс.Карты</a>'
          : '—';
        var rowClass = idx === _addrEditIdx ? ' class="farm-card-addr-row--editing"' : '';
        return (
          '<tr data-addr-idx="' +
          idx +
          '"' +
          rowClass +
          '><td>' +
          escapeHtml(name) +
          '</td><td>' +
          escapeHtml(placeBits || '—') +
          '</td><td>' +
          escapeHtml(line || '—') +
          '</td><td>' +
          navCell +
          '</td>' +
          (canEdit
            ? '<td><button type="button" class="small-btn farm-card-addr-edit" data-addr-idx="' +
              idx +
              '">Изм.</button> <button type="button" class="small-btn farm-card-addr-del" data-addr-idx="' +
              idx +
              '">Удал.</button></td>'
            : '') +
          '</tr>'
        );
      })
      .join('');

    var addrPickOptions =
      '<option value="">— Выберите локацию для правки —</option>' +
      (b.addresses || [])
        .map(function (a, idx) {
          var label = (a.name && String(a.name).trim()) || ('Локация ' + (idx + 1));
          return (
            '<option value="' +
            idx +
            '"' +
            (idx === _addrEditIdx ? ' selected' : '') +
            '>' +
            escapeHtml(label) +
            '</option>'
          );
        })
        .join('');

    var addressesHtml =
      '<div class="farm-card-pane" id="farmCardPaneAddresses" style="' +
      (_activeTab === 'addresses' ? '' : 'display:none') +
      '">' +
      '<div class="farm-card-table-scroll"><table class="farm-card-table"><thead><tr><th>Название</th><th>Область / НП</th><th>Адрес</th><th>Яндекс.Карты</th>' +
      (canEdit ? '<th></th>' : '') +
      '</tr></thead><tbody>' +
      (addrRows || '<tr><td colspan="5" class="farm-card-empty">Нет записей</td></tr>') +
      '</tbody></table></div>' +
      (canEdit
        ? '<div class="farm-card-form"><h4 class="farm-card-h4">' +
          (editingAddr ? 'Редактирование локации' : 'Новая локация') +
          '</h4>' +
          '<p class="farm-settings-hint">Поля необязательны — сохраняется то, что заполнено. Можно выбрать локацию из списка по названию и изменить.</p>' +
          ((b.addresses || []).length
            ? '<label>Выбрать по названию <select id="farmCardAddrPick" class="farm-settings-inline-input">' +
              addrPickOptions +
              '</select></label>'
            : '') +
          '<p class="farm-settings-hint farm-card-addr-suggest-hint" id="farmCardAddrSuggestHint" style="display:none;">Подсказки (Яндекс): введите населённый пункт или адрес и выберите из списка.</p>' +
          '<div class="farm-card-addr-suggest-wrap">' +
          '<label>Название локации <input type="text" id="farmCardAddrName" class="farm-settings-inline-input" value="' +
          escapeHtml(editingAddr && editingAddr.name ? editingAddr.name : '') +
          '" autocomplete="off" /></label>' +
          '<div class="farm-card-grid2">' +
          '<label>Область <input type="text" id="farmCardAddrRegion" class="farm-settings-inline-input" value="' +
          escapeHtml(editingAddr && editingAddr.region ? editingAddr.region : '') +
          '" autocomplete="address-level1" /></label>' +
          '<label>Населённый пункт <input type="text" id="farmCardAddrLocality" class="farm-settings-inline-input" value="' +
          escapeHtml(editingAddr && editingAddr.locality ? editingAddr.locality : '') +
          '" autocomplete="address-level2" /></label></div>' +
          '<label>Адрес (целиком) <input type="text" id="farmCardAddrLine" class="farm-settings-inline-input" value="' +
          escapeHtml(editingAddr ? formatAddressLine(editingAddr) : '') +
          '" autocomplete="street-address" /></label>' +
          '<ul id="farmCardAddrSuggestList" class="farm-card-addr-suggest-list" role="listbox" aria-label="Подсказки адреса" style="display:none;"></ul></div>' +
          '<label>Ссылка на Яндекс.Карты <input type="url" id="farmCardAddrNav" class="farm-settings-inline-input" placeholder="https://yandex.ru/maps/..." value="' +
          escapeHtml(editingAddr && editingAddr.navUrl ? editingAddr.navUrl : '') +
          '" /></label>' +
          '<div class="farm-card-actions-row">' +
          '<button type="button" class="small-btn" id="farmCardAddAddrBtn">' +
          (editingAddr ? 'Сохранить' : 'Добавить') +
          '</button>' +
          (editingAddr
            ? '<button type="button" class="small-btn" id="farmCardAddrCancelBtn">Отмена</button>'
            : '') +
          '</div></div>'
        : '') +
      '</div>';

    var specRows = (b.specialists || [])
      .map(function (s) {
        return (
          '<tr><td>' +
          escapeHtml(s.role) +
          '</td><td>' +
          escapeHtml(s.name) +
          '</td><td>' +
          escapeHtml(s.phone) +
          '</td><td>' +
          escapeHtml(s.email) +
          '</td>' +
          (canEdit
            ? '<td><button type="button" class="small-btn farm-card-spec-del" data-spec-id="' +
              escapeHtml(s.id) +
              '">Удал.</button></td>'
            : '') +
          '</tr>'
        );
      })
      .join('');

    var specialistsHtml =
      '<div class="farm-card-pane" id="farmCardPaneSpecialists" style="' +
      (_activeTab === 'specialists' ? '' : 'display:none') +
      '">' +
      '<div class="farm-card-table-scroll"><table class="farm-card-table"><thead><tr><th>Роль</th><th>ФИО</th><th>Телефон</th><th>Email</th>' +
      (canEdit ? '<th></th>' : '') +
      '</tr></thead><tbody>' +
      (specRows || '<tr><td colspan="5" class="farm-card-empty">Нет записей</td></tr>') +
      '</tbody></table></div>' +
      (canEdit
        ? '<div class="farm-card-form"><h4 class="farm-card-h4">Новый специалист</h4>' +
          '<label>Роль <input type="text" id="farmCardNewSpecRole" class="farm-settings-inline-input" placeholder="Ветврач, зоотехник…" /></label>' +
          '<label>ФИО <input type="text" id="farmCardNewSpecName" class="farm-settings-inline-input" /></label>' +
          '<label>Телефон <input type="tel" id="farmCardNewSpecPhone" class="farm-settings-inline-input" /></label>' +
          '<label>Email <input type="email" id="farmCardNewSpecEmail" class="farm-settings-inline-input" /></label>' +
          '<button type="button" class="small-btn" id="farmCardAddSpecBtn">Добавить</button></div>'
        : '') +
      '</div>';

    var computed = computeFromEntries(typeof window.entries !== 'undefined' ? window.entries : []);
    var metricsRows = (b.metricDefinitions || [])
      .map(function (def) {
        var snap = currentMetricSnapshot(b.metricValues, def.id);
        var display = snap ? snap.valueText : '—';
        var dateLine = snap ? snap.valueDate : '—';
        var hint =
          def.source === 'computed' && def.computedKey
            ? '<span class="farm-settings-hint">Сейчас из описи: ' + escapeHtml(computed[def.computedKey] || '—') + '</span>'
            : '';
        return (
          '<tr class="farm-card-metric-row" data-metric-id="' +
          escapeHtml(def.id) +
          '"><td>' +
          escapeHtml(def.label) +
          '<br/><small>' +
          (def.source === 'computed' ? 'из описи' : 'вручную') +
          '</small>' +
          hint +
          '</td><td>' +
          escapeHtml(display) +
          '</td><td>' +
          escapeHtml(dateLine) +
          '</td><td><button type="button" class="small-btn farm-card-metric-history" data-metric-id="' +
          escapeHtml(def.id) +
          '">История</button></td>' +
          (canEdit
            ? '<td><button type="button" class="small-btn farm-card-metric-addval" data-metric-id="' +
              escapeHtml(def.id) +
              '">Значение</button></td>'
            : '') +
          '</tr>' +
          '<tr class="farm-card-metric-history-row" id="farmCardHistRow_' +
          escapeHtml(def.id) +
          '" style="display:none"><td colspan="5"><div class="farm-card-history" id="farmCardHist_' +
          escapeHtml(def.id) +
          '"></div></td></tr>'
        );
      })
      .join('');

    var metricsHtml =
      '<div class="farm-card-pane" id="farmCardPaneMetrics" style="' +
      (_activeTab === 'metrics' ? '' : 'display:none') +
      '">' +
      '<p class="farm-settings-hint">Актуальное значение — последняя запись на дату не позже сегодня; иначе последняя в истории.</p>' +
      (canEdit
        ? '<div class="farm-card-actions-row">' +
          '<button type="button" class="small-btn" id="farmCardFillComputedBtn">Заполнить из описи на сегодня</button>' +
          '<button type="button" class="small-btn" id="farmCardAddMetricDefBtn">Новый показатель</button></div>'
        : '') +
      '<div class="farm-card-table-scroll"><table class="farm-card-table"><thead><tr><th>Показатель</th><th>Значение</th><th>Дата</th><th></th>' +
      (canEdit ? '<th></th>' : '') +
      '</tr></thead><tbody>' +
      metricsRows +
      '</tbody></table></div>' +
      '</div>';

    var evTypeLabels = { visit: 'Посещение', work: 'Работа', plan: 'План развития', info: 'Информация' };
    var sortState = window.__farmTimelineSort || { key: 'eventDate', dir: 'desc' };
    var evList = (b.events || []).slice();
    evList.sort(function (x, y) {
      var ax = String(x[sortState.key] || '');
      var ay = String(y[sortState.key] || '');
      var c = ax.localeCompare(ay);
      return sortState.dir === 'asc' ? c : -c;
    });
    var filtType = window.__farmTimelineFilterType || '';
    var filtText = window.__farmTimelineFilterText || '';
    var evRows = evList
      .filter(function (e) {
        if (filtType && String(e.eventType) !== filtType) return false;
        if (filtText) {
          var t = filtText.toLowerCase();
          var blob = [e.participants, e.description, e.task, e.goal].join(' ').toLowerCase();
          if (blob.indexOf(t) === -1) return false;
        }
        return true;
      })
      .map(function (e, idx) {
        var doneMark = e.completed ? ' ✓' : '';
        var rem = e.reminderAt ? String(e.reminderAt).slice(0, 16).replace('T', ' ') : '';
        return (
          '<tr class="' +
          (e.completed ? 'farm-card-ev--done' : '') +
          '"><td>' +
          escapeHtml(evTypeLabels[e.eventType] || e.eventType) +
          doneMark +
          '</td><td>' +
          escapeHtml(e.eventDate) +
          (rem ? '<br/><small>⏰ ' + escapeHtml(rem) + '</small>' : '') +
          '</td><td>' +
          escapeHtml(e.participants) +
          '</td><td>' +
          escapeHtml(e.description) +
          '</td><td>' +
          escapeHtml(e.task) +
          '</td><td>' +
          escapeHtml(e.goal) +
          '</td>' +
          (canEdit
            ? '<td><button type="button" class="small-btn farm-card-ev-toggle" data-ev-id="' +
              escapeHtml(e.id) +
              '">' +
              (e.completed ? 'Открыть' : 'Готово') +
              '</button> <button type="button" class="small-btn farm-card-ev-del" data-ev-id="' +
              escapeHtml(e.id) +
              '">Удал.</button></td>'
            : '') +
          '</tr>'
        );
      })
      .join('');

    var timelineHtml =
      '<div class="farm-card-pane" id="farmCardPaneTimeline" style="' +
      (_activeTab === 'timeline' ? '' : 'display:none') +
      '">' +
      '<div class="farm-card-filters">' +
      '<label>Тип <select id="farmCardEvFilterType"><option value="">Все</option>' +
      '<option value="visit"' +
      (filtType === 'visit' ? ' selected' : '') +
      '>Посещение</option>' +
      '<option value="work"' +
      (filtType === 'work' ? ' selected' : '') +
      '>Работа</option>' +
      '<option value="plan"' +
      (filtType === 'plan' ? ' selected' : '') +
      '>План</option>' +
      '<option value="info"' +
      (filtType === 'info' ? ' selected' : '') +
      '>Информация</option></select></label> ' +
      '<label>Поиск <input type="text" id="farmCardEvFilterText" value="' +
      escapeHtml(filtText) +
      '" class="farm-settings-inline-input" /></label> ' +
      '<button type="button" class="small-btn" id="farmCardEvFilterApply">Применить</button> ' +
      '<label>Сортировка по дате <select id="farmCardEvSortDir"><option value="desc"' +
      (sortState.dir === 'desc' ? ' selected' : '') +
      '>Новые сверху</option><option value="asc"' +
      (sortState.dir === 'asc' ? ' selected' : '') +
      '>Старые сверху</option></select></label></div>' +
      '<div class="farm-card-table-scroll"><table class="farm-card-table farm-card-table--wide"><thead><tr><th>Тип</th><th>Дата</th><th>Участники</th><th>Описание</th><th>Задача</th><th>Цель</th>' +
      (canEdit ? '<th></th>' : '') +
      '</tr></thead><tbody>' +
      (evRows || '<tr><td colspan="7" class="farm-card-empty">Нет событий</td></tr>') +
      '</tbody></table></div>' +
      (canEdit
        ? '<div class="farm-card-form"><h4 class="farm-card-h4">Новое событие</h4>' +
          '<label>Тип <select id="farmCardNewEvType">' +
          '<option value="visit">История посещений</option>' +
          '<option value="work">Проделанная работа</option>' +
          '<option value="plan">План развития</option>' +
          '<option value="info">Информация</option></select></label>' +
          '<label>Дата <input type="date" id="farmCardNewEvDate" /></label>' +
          '<label>Участники <input type="text" id="farmCardNewEvPart" class="farm-settings-inline-input" /></label>' +
          '<label>Описание <textarea id="farmCardNewEvDesc" class="farm-settings-textarea" rows="2"></textarea></label>' +
          '<label>Задача <input type="text" id="farmCardNewEvTask" class="farm-settings-inline-input" /></label>' +
          '<label>Цель <input type="text" id="farmCardNewEvGoal" class="farm-settings-inline-input" /></label>' +
          '<label>Напоминание <input type="datetime-local" id="farmCardNewEvReminder" class="farm-card-input-lg" /></label>' +
          '<label><input type="checkbox" id="farmCardNewEvNotify" checked /> Локальное уведомление</label>' +
          '<button type="button" class="small-btn" id="farmCardAddEvBtn">Добавить</button></div>'
        : '') +
      '</div>';

    var itemsHtml =
      typeof globalThis['__farmCard'].buildItemsPaneHtml === 'function'
        ? globalThis['__farmCard'].buildItemsPaneHtml(b, canEdit, _activeTab)
        : '';
    var goalsHtml =
      typeof globalThis['__farmCard'].buildGoalsPaneHtml === 'function'
        ? globalThis['__farmCard'].buildGoalsPaneHtml(b, canEdit, _activeTab)
        : '';
    var dynamicsHtml =
      typeof globalThis['__farmCard'].buildDynamicsPaneHtml === 'function'
        ? globalThis['__farmCard'].buildDynamicsPaneHtml(b, canEdit, _activeTab)
        : '';

    root.innerHTML =
      '<div class="farm-card-inner">' +
      tabs +
      '<div class="farm-card-body">' +
      contactsHtml +
      addressesHtml +
      specialistsHtml +
      itemsHtml +
      metricsHtml +
      goalsHtml +
      dynamicsHtml +
      timelineHtml +
      '</div>' +
      '<div class="farm-card-footer">' +
      '<button type="button" class="small-btn" id="farmCardPrintBtn">Печать A4</button> ' +
      (window.CATTLE_TRACKER_USE_API
        ? '<button type="button" class="small-btn" id="farmCardReloadBtn">Обновить с сервера</button> '
        : '') +
      (canEdit
        ? '<button type="button" class="action-btn" id="farmCardSaveAllBtn">Сохранить карточку</button>'
        : '<p class="farm-settings-hint">Только просмотр</p>') +
      '<span id="farmCardSaveStatus" class="farm-card-save-status" aria-live="polite"></span></div></div>';

    root.querySelectorAll('.farm-card-tab').forEach(function (btn) {
      btn.addEventListener('click', function () {
        _activeTab = btn.getAttribute('data-farm-tab') || 'contacts';
        renderFarmCardPanel();
      });
    });

    var today = new Date().toISOString().slice(0, 10);
    var dateEl = document.getElementById('farmCardNewEvDate');
    if (dateEl) dateEl.value = today;

    if (canEdit) {
      var addC = document.getElementById('farmCardAddContactBtn');
      if (addC) {
        addC.onclick = function () {
          var title = (document.getElementById('farmCardNewContactTitle') || {}).value || '';
          var fullName = (document.getElementById('farmCardNewContactName') || {}).value || '';
          var phonesRaw = (document.getElementById('farmCardNewContactPhones') || {}).value || '';
          var phones = phonesRaw
            .split(/[,;]/)
            .map(function (s) {
              return s.trim();
            })
            .filter(Boolean);
          var gen = document.getElementById('farmCardNewContactGen') && document.getElementById('farmCardNewContactGen').checked;
          var note = (document.getElementById('farmCardNewContactNote') || {}).value || '';
          if (!title && !fullName) {
            if (typeof showToast === 'function') showToast('Укажите должность или ФИО', 'error');
            return;
          }
          window.__farmCardBundle.contacts.push({
            id: newId('c_'),
            title: title,
            fullName: fullName,
            phones: phones,
            note: note,
            genetika: !!gen,
            sortOrder: window.__farmCardBundle.contacts.length
          });
          renderFarmCardPanel();
        };
      }
      root.querySelectorAll('.farm-card-row-del').forEach(function (btn) {
        btn.onclick = function () {
          var i = parseInt(btn.getAttribute('data-contact-idx'), 10);
          if (!isNaN(i)) window.__farmCardBundle.contacts.splice(i, 1);
          renderFarmCardPanel();
        };
      });
      root.querySelectorAll('.farm-card-row-edit').forEach(function (btn) {
        btn.onclick = function () {
          var i = parseInt(btn.getAttribute('data-contact-idx'), 10);
          var c = window.__farmCardBundle.contacts[i];
          if (!c) return;
          var title = prompt('Должность', c.title || '');
          if (title === null) return;
          var fullName = prompt('ФИО', c.fullName || '');
          if (fullName === null) return;
          var phones = prompt('Телефоны через запятую', (c.phones || []).join(', '));
          if (phones === null) return;
          var note = prompt('Описание', c.note || '');
          if (note === null) return;
          var gen = confirm('МК «Генетика»?');
          c.title = title;
          c.fullName = fullName;
          c.phones = phones
            .split(/[,;]/)
            .map(function (s) {
              return s.trim();
            })
            .filter(Boolean);
          c.note = note;
          c.genetika = gen;
          renderFarmCardPanel();
        };
      });

      function loadAddrIntoForm(idx) {
        if (!window.__farmCardBundle.addresses || !window.__farmCardBundle.addresses[idx]) {
          _addrEditIdx = -1;
          renderFarmCardPanel();
          return;
        }
        _addrEditIdx = idx;
        renderFarmCardPanel();
      }

      var addrPick = document.getElementById('farmCardAddrPick');
      if (addrPick) {
        addrPick.onchange = function () {
          var v = addrPick.value;
          if (v === '') {
            _addrEditIdx = -1;
            clearAddrFormFields();
            renderFarmCardPanel();
            return;
          }
          loadAddrIntoForm(parseInt(v, 10));
        };
      }

      var addA = document.getElementById('farmCardAddAddrBtn');
      if (addA) {
        addA.onclick = function () {
          var fields = readAddrFormFields();
          if (!fields.name && !fields.region && !fields.locality && !fields.address && !fields.navUrl) {
            if (typeof showToast === 'function') showToast('Заполните хотя бы одно поле', 'error');
            return;
          }
          if (!window.__farmCardBundle.addresses) window.__farmCardBundle.addresses = [];
          var payload = {
            name: fields.name,
            region: fields.region,
            locality: fields.locality,
            address: fields.address,
            navUrl: fields.navUrl,
            street: '',
            house: ''
          };
          if (_addrEditIdx >= 0 && window.__farmCardBundle.addresses[_addrEditIdx]) {
            var prev = window.__farmCardBundle.addresses[_addrEditIdx];
            window.__farmCardBundle.addresses[_addrEditIdx] = Object.assign({}, prev, payload);
          } else {
            window.__farmCardBundle.addresses.push(
              Object.assign(
                {
                  id: newId('a_'),
                  lat: null,
                  lng: null,
                  sortOrder: window.__farmCardBundle.addresses.length
                },
                payload
              )
            );
          }
          _addrEditIdx = -1;
          renderFarmCardPanel();
        };
      }
      var cancelAddr = document.getElementById('farmCardAddrCancelBtn');
      if (cancelAddr) {
        cancelAddr.onclick = function () {
          _addrEditIdx = -1;
          renderFarmCardPanel();
        };
      }
      root.querySelectorAll('.farm-card-addr-del').forEach(function (btn) {
        btn.onclick = function () {
          var i = parseInt(btn.getAttribute('data-addr-idx'), 10);
          if (!isNaN(i)) {
            window.__farmCardBundle.addresses.splice(i, 1);
            if (_addrEditIdx === i) _addrEditIdx = -1;
            else if (_addrEditIdx > i) _addrEditIdx -= 1;
          }
          renderFarmCardPanel();
        };
      });
      var addSpec = document.getElementById('farmCardAddSpecBtn');
      if (addSpec) {
        addSpec.onclick = function () {
          if (!window.__farmCardBundle.specialists) window.__farmCardBundle.specialists = [];
          window.__farmCardBundle.specialists.push({
            id: newId('sp_'),
            role: (document.getElementById('farmCardNewSpecRole') || {}).value || '',
            name: (document.getElementById('farmCardNewSpecName') || {}).value || '',
            phone: (document.getElementById('farmCardNewSpecPhone') || {}).value || '',
            email: (document.getElementById('farmCardNewSpecEmail') || {}).value || ''
          });
          renderFarmCardPanel();
        };
      }
      root.querySelectorAll('.farm-card-spec-del').forEach(function (btn) {
        btn.onclick = function () {
          var sid = btn.getAttribute('data-spec-id');
          window.__farmCardBundle.specialists = (window.__farmCardBundle.specialists || []).filter(function (s) {
            return s && s.id !== sid;
          });
          renderFarmCardPanel();
        };
      });
      root.querySelectorAll('.farm-card-addr-edit').forEach(function (btn) {
        btn.onclick = function () {
          var i = parseInt(btn.getAttribute('data-addr-idx'), 10);
          if (isNaN(i)) return;
          loadAddrIntoForm(i);
        };
      });

      var fillBtn = document.getElementById('farmCardFillComputedBtn');
      if (fillBtn) {
        fillBtn.onclick = function () {
          var entries = typeof window.entries !== 'undefined' ? window.entries : [];
          var comp = computeFromEntries(entries);
          var d = new Date().toISOString().slice(0, 10);
          (window.__farmCardBundle.metricDefinitions || []).forEach(function (def) {
            if (def.source !== 'computed' || !def.computedKey) return;
            var v = comp[def.computedKey];
            if (v === undefined || v === '') return;
            var vals = window.__farmCardBundle.metricValues;
            var replaced = false;
            for (var i = 0; i < vals.length; i++) {
              if (vals[i].metricId === def.id && vals[i].valueDate === d) {
                vals[i].valueText = v;
                vals[i].source = 'computed';
                replaced = true;
                break;
              }
            }
            if (!replaced) {
              vals.push({ id: null, metricId: def.id, valueDate: d, valueText: v, source: 'computed' });
            }
          });
          if (typeof showToast === 'function') showToast('Показатели из описи добавлены на ' + d, 'success');
          renderFarmCardPanel();
        };
      }
      var addDef = document.getElementById('farmCardAddMetricDefBtn');
      if (addDef) {
        addDef.onclick = function () {
          var label = prompt('Название показателя');
          if (!label) return;
          window.__farmCardBundle.metricDefinitions.push({
            id: newId('m_'),
            label: label,
            valueType: 'number',
            source: 'manual',
            computedKey: null,
            sortOrder: window.__farmCardBundle.metricDefinitions.length
          });
          renderFarmCardPanel();
        };
      }
      root.querySelectorAll('.farm-card-metric-addval').forEach(function (btn) {
        btn.onclick = function () {
          var mid = btn.getAttribute('data-metric-id');
          var val = prompt('Значение');
          if (val === null) return;
          var d = prompt('Дата (ГГГГ-ММ-ДД)', new Date().toISOString().slice(0, 10));
          if (!d) return;
          var vals = window.__farmCardBundle.metricValues;
          var replaced = false;
          for (var i = 0; i < vals.length; i++) {
            if (vals[i].metricId === mid && vals[i].valueDate === d) {
              vals[i].valueText = val;
              vals[i].source = 'manual';
              replaced = true;
              break;
            }
          }
          if (!replaced) vals.push({ id: null, metricId: mid, valueDate: d, valueText: val, source: 'manual' });
          renderFarmCardPanel();
        };
      });
      root.querySelectorAll('.farm-card-metric-history').forEach(function (btn) {
        btn.onclick = function () {
          var mid = btn.getAttribute('data-metric-id');
          var row = document.getElementById('farmCardHistRow_' + mid);
          var box = document.getElementById('farmCardHist_' + mid);
          if (!row || !box) return;
          var open = row.style.display !== 'table-row';
          root.querySelectorAll('.farm-card-metric-history-row').forEach(function (r) {
            r.style.display = 'none';
          });
          if (!open) return;
          row.style.display = 'table-row';
          var hist = (window.__farmCardBundle.metricValues || [])
            .filter(function (v) {
              return v.metricId === mid;
            })
            .sort(function (a, b) {
              return String(a.valueDate).localeCompare(String(b.valueDate));
            });
          box.innerHTML =
            hist.length === 0
              ? '<p class="farm-settings-hint">Нет истории</p>'
              : '<ul class="farm-card-history-list">' +
                hist
                  .map(function (h) {
                    return (
                      '<li>' +
                      escapeHtml(h.valueDate) +
                      ': <strong>' +
                      escapeHtml(h.valueText) +
                      '</strong> (' +
                      escapeHtml(h.source) +
                      ')</li>'
                    );
                  })
                  .join('') +
                '</ul>';
        };
      });

      var addEv = document.getElementById('farmCardAddEvBtn');
      if (addEv) {
        addEv.onclick = function () {
          var type = (document.getElementById('farmCardNewEvType') || {}).value || 'info';
          var eventDate = (document.getElementById('farmCardNewEvDate') || {}).value || today;
          var participants = (document.getElementById('farmCardNewEvPart') || {}).value || '';
          var description = (document.getElementById('farmCardNewEvDesc') || {}).value || '';
          var task = (document.getElementById('farmCardNewEvTask') || {}).value || '';
          var goal = (document.getElementById('farmCardNewEvGoal') || {}).value || '';
          window.__farmCardBundle.events.push({
            id: newId('ev_'),
            eventType: type,
            eventDate: eventDate,
            participants: participants,
            description: description,
            task: task,
            goal: goal,
            reminderAt: (function () {
              var rem = (document.getElementById('farmCardNewEvReminder') || {}).value || '';
              if (!rem) return '';
              try {
                return new Date(rem).toISOString();
              } catch (e) {
                return rem;
              }
            })(),
            completed: false,
            notifyLocal: !(
              document.getElementById('farmCardNewEvNotify') &&
              !document.getElementById('farmCardNewEvNotify').checked
            )
          });
          renderFarmCardPanel();
        };
      }
      root.querySelectorAll('.farm-card-ev-del').forEach(function (btn) {
        btn.onclick = function () {
          var id = btn.getAttribute('data-ev-id');
          window.__farmCardBundle.events = (window.__farmCardBundle.events || []).filter(function (e) {
            return e.id !== id;
          });
          renderFarmCardPanel();
        };
      });
      root.querySelectorAll('.farm-card-ev-toggle').forEach(function (btn) {
        btn.onclick = function () {
          var id = btn.getAttribute('data-ev-id');
          (window.__farmCardBundle.events || []).forEach(function (e) {
            if (e && e.id === id) e.completed = !e.completed;
          });
          renderFarmCardPanel();
        };
      });

      var fApply = document.getElementById('farmCardEvFilterApply');
      if (fApply) {
        fApply.onclick = function () {
          window.__farmTimelineFilterType = (document.getElementById('farmCardEvFilterType') || {}).value || '';
          window.__farmTimelineFilterText = (document.getElementById('farmCardEvFilterText') || {}).value || '';
          window.__farmTimelineSort = window.__farmTimelineSort || { key: 'eventDate', dir: 'desc' };
          window.__farmTimelineSort.dir = (document.getElementById('farmCardEvSortDir') || {}).value || 'desc';
          renderFarmCardPanel();
        };
      }

      var saveAll = document.getElementById('farmCardSaveAllBtn');
      if (saveAll) {
        saveAll.onclick = function () {
          var status = document.getElementById('farmCardSaveStatus');
          if (status) status.textContent = 'Сохранение…';
          saveFarmCardBundle(window.__farmCardBundle)
            .then(function () {
              if (status) status.textContent = 'Сохранено';
              if (typeof showToast === 'function') showToast('Карточка хозяйства сохранена', 'success');
            })
            .catch(function (e) {
              if (status) status.textContent = 'Ошибка';
              if (typeof showToast === 'function') showToast((e && e.message) || 'Ошибка', 'error');
            });
        };
      }
    }

    var reloadB = document.getElementById('farmCardReloadBtn');
    if (reloadB) {
      reloadB.onclick = function () {
        ensureFarmCardLoaded().then(function () {
          renderFarmCardPanel();
          if (typeof showToast === 'function') showToast('Обновлено', 'success');
        });
      };
    }

    if (canEdit) {
      globalThis['__farmCard'].bindFarmCardGeosuggest();
    }
    if (typeof globalThis['__farmCard'].bindCrmHandlers === 'function') {
      globalThis['__farmCard'].bindCrmHandlers(root, canEdit, renderFarmCardPanel);
    }
  }

  // register functions
  NS.escapeHtml = escapeHtml;
  NS.newId = newId;
  NS.emptyBundle = emptyBundle;
  NS.defaultMetricDefinitions = defaultMetricDefinitions;
  NS.mergeDefaultMetrics = mergeDefaultMetrics;
  NS.readFarmCardCache = readFarmCardCache;
  NS.writeFarmCardCache = writeFarmCardCache;
  NS.getObjectIdForFarm = getObjectIdForFarm;
  NS.farmCardCanEdit = farmCardCanEdit;
  NS.normalizeBundle = normalizeBundle;
  NS.normalizeItem = normalizeItem;
  NS.normalizeGoal = normalizeGoal;
  NS.normalizeEvent = normalizeEvent;
  NS.refreshGoalStatuses = refreshGoalStatuses;
  NS.countHerdCows = countHerdCows;
  NS.countCalves = countCalves;
  NS.computeFromEntries = computeFromEntries;
  NS.getFarmCardBundleForExport = getFarmCardBundleForExport;
  NS.ensureFarmCardLoaded = ensureFarmCardLoaded;
  NS.saveFarmCardBundle = saveFarmCardBundle;
  NS.currentMetricSnapshot = currentMetricSnapshot;
  NS.renderFarmCardPanel = renderFarmCardPanel;
})();
export {};
