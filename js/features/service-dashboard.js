/**
 * Дашборд работ сервис-специалиста на экране «Работа со стадом».
 */
import { computeServiceDashboardStats } from './service-dashboard-calc.js';

var MODE_KEY = 'cattleTracker_serviceDashMode';
var MODE_DEFAULT = 'me_object';
var _bound = false;
var _lastStatsByCol = [];
var _loadGen = 0;

function isServiceUi() {
  return typeof getUiRole === 'function' && getUiRole() === 'service';
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getUsername() {
  var u = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
  return (u && u.username) ? String(u.username) : '';
}

function getMode() {
  try {
    var v = localStorage.getItem(MODE_KEY);
    if (v === 'me_object' || v === 'me_all' || v === 'compare_object_vs_all' || v === 'compare_me_vs_farm') return v;
  } catch (e) {}
  return MODE_DEFAULT;
}

function setMode(v) {
  try {
    localStorage.setItem(MODE_KEY, v);
  } catch (e) {}
}

function tagEntries(list, objectId) {
  return (list || []).map(function (e) {
    var copy = Object.assign({}, e);
    copy._objectId = objectId;
    return copy;
  });
}

function loadEntriesForObject(objectId, currentId) {
  if (objectId && currentId && objectId === currentId) {
    return Promise.resolve(window.entries || []);
  }
  if (typeof window.readApiEntriesCache === 'function') {
    var cached = window.readApiEntriesCache(objectId);
    if (cached && cached.length) return Promise.resolve(cached);
  }
  try {
    var raw = localStorage.getItem('cattleEntries_' + objectId);
    if (raw) {
      var parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) return Promise.resolve(parsed);
    }
  } catch (e) {}
  if (window.CattleTrackerApi && typeof window.CattleTrackerApi.loadEntries === 'function') {
    return window.CattleTrackerApi.loadEntries(objectId)
      .then(function (data) {
        var list = Array.isArray(data) ? data : [];
        if (typeof window.writeApiEntriesCache === 'function') window.writeApiEntriesCache(objectId, list);
        return list;
      })
      .catch(function () {
        return [];
      });
  }
  return Promise.resolve([]);
}

function loadScopeEntries(needAll) {
  var currentId = typeof getCurrentObjectId === 'function' ? getCurrentObjectId() : '';
  var current = tagEntries(window.entries || [], currentId);
  if (!needAll) return Promise.resolve({ current: current, all: current });
  var objects = typeof getObjectsList === 'function' ? getObjectsList() || [] : [];
  var jobs = objects.map(function (o) {
    var id = o && o.id;
    if (!id) return Promise.resolve([]);
    return loadEntriesForObject(id, currentId).then(function (list) {
      return tagEntries(list, id);
    });
  });
  return Promise.all(jobs).then(function (chunks) {
    var all = [];
    chunks.forEach(function (c) {
      all = all.concat(c);
    });
    if (!all.length) all = current;
    return { current: current, all: all };
  });
}

function statsFor(entries, mineOnly) {
  return computeServiceDashboardStats(entries, { username: getUsername(), mineOnly: mineOnly });
}

function formatDaysLine(rows) {
  if (!rows || !rows.length) return 'Нет разбивки по дням';
  return rows
    .map(function (r) {
      return r.days + ' дн. — ' + r.heads + ' гол.';
    })
    .join('\n');
}

function kpiColumnHtml(stats, title, colIndex) {
  var star =
    stats.doubtfulCount > 0
      ? '<button type="button" class="menu-calving-stat-star service-doubtful-star" data-service-doubtful-star data-col="' +
        colIndex +
        '" aria-label="Разбивка сомнительных">*</button>'
      : '';
  var titleHtml = title ? '<p class="service-dash-col-title">' + escapeHtml(title) + '</p>' : '';
  return (
    titleHtml +
    '<div class="herd-stats-header">' +
    '<div class="stat-value">' +
    escapeHtml(String(stats.inseminationCount)) +
    '</div>' +
    '<div class="stat-label">Всего осеменений</div>' +
    '</div>' +
    '<div class="herd-stats-table" role="group">' +
    '<div class="herd-stat-row">' +
    '<span class="herd-stat-label">Стельные</span>' +
    '<span class="herd-stat-num">' +
    escapeHtml(String(stats.pregnantCount)) +
    '</span>' +
    '<span class="herd-stat-pct">' +
    escapeHtml(String(stats.pregnantPct)) +
    '%</span>' +
    '</div>' +
    '<div class="herd-stat-row">' +
    '<span class="herd-stat-label">Сомнительные' +
    star +
    '</span>' +
    '<span class="herd-stat-num">' +
    escapeHtml(String(stats.doubtfulCount)) +
    '</span>' +
    '<span class="herd-stat-pct">' +
    escapeHtml(String(stats.doubtfulPct)) +
    '%</span>' +
    '</div>' +
    '<div class="herd-stat-row">' +
    '<span class="herd-stat-label">Погрешность УЗИ</span>' +
    '<span class="herd-stat-num">' +
    escapeHtml(String(stats.uziAccuracyNumerator)) +
    '/' +
    escapeHtml(String(stats.uziAccuracyDenominator)) +
    '</span>' +
    '<span class="herd-stat-pct">' +
    escapeHtml(String(stats.uziAccuracyPct)) +
    '%</span>' +
    '</div>' +
    '</div>'
  );
}

function closeOverlay(overlay) {
  if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
}

function showTextOverlay(title, bodyText, extraHtml) {
  var overlay = document.createElement('div');
  overlay.className = 'confirm-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.innerHTML =
    '<div class="confirm-modal confirm-modal--wide">' +
    '<h2 class="app-version-actions-title">' +
    escapeHtml(title) +
    '</h2>' +
    '<p class="confirm-modal-text">' +
    escapeHtml(bodyText) +
    '</p>' +
    (extraHtml || '') +
    '<div class="confirm-modal-actions">' +
    '<button type="button" class="btn primary" data-close>Закрыть</button>' +
    '</div></div>';
  function close() {
    closeOverlay(overlay);
  }
  overlay.addEventListener('click', function (ev) {
    if (ev.target === overlay) close();
  });
  overlay.querySelector('[data-close]').addEventListener('click', close);
  document.body.appendChild(overlay);
  return overlay;
}

function showDoubtfulList(stats) {
  var rows = (stats && stats.doubtfulList) || [];
  var currentId = typeof getCurrentObjectId === 'function' ? getCurrentObjectId() : '';
  var items = rows
    .map(function (r, idx) {
      var label =
        escapeHtml(r.cattleId || '—') +
        (r.group ? ' · ' + escapeHtml(r.group) : '') +
        ' · ' +
        (r.daysFromInsemination != null ? r.daysFromInsemination + ' дн.' : '—') +
        (r.uziDate ? ' · ' + escapeHtml(r.uziDate) : '');
      return (
        '<li><button type="button" data-doubt-idx="' +
        idx +
        '"><span>' +
        label +
        '</span></button></li>'
      );
    })
    .join('');
  var overlay = showTextOverlay(
    'Сомнительные сейчас',
    rows.length ? '' : 'Нет животных с актуальной меткой «Сомнительная».',
    rows.length ? '<ul class="service-doubtful-list">' + items + '</ul>' : ''
  );
  overlay.querySelectorAll('[data-doubt-idx]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var i = parseInt(btn.getAttribute('data-doubt-idx'), 10);
      var row = rows[i];
      closeOverlay(overlay);
      if (!row || !row.cattleId) return;
      if (row.objectId && currentId && row.objectId !== currentId) {
        if (typeof showToast === 'function') {
          showToast('Животное в другом объекте. Переключите хозяйство: ' + row.cattleId, 'info');
        }
        return;
      }
      if (typeof navigate === 'function') navigate('view-cow', { cattleId: row.cattleId });
      if (typeof viewCow === 'function') viewCow(row.cattleId);
    });
  });
}

function bindColumnActions(root, statsList) {
  var stars = root.querySelectorAll('[data-service-doubtful-star]');
  stars.forEach(function (btn) {
    var idx = parseInt(btn.getAttribute('data-col'), 10);
    var stats = statsList[idx] || statsList[0];
    btn.addEventListener('click', function () {
      var overlay = showTextOverlay(
        'Сомнительные по дням УЗИ1',
        formatDaysLine(stats.doubtfulByDays),
        '<div class="confirm-modal-actions service-doubtful-extra">' +
          '<button type="button" class="btn" data-open-list>Список сомнительных</button>' +
          '</div>'
      );
      var listBtn = overlay.querySelector('[data-open-list]');
      if (listBtn) {
        listBtn.addEventListener('click', function () {
          closeOverlay(overlay);
          showDoubtfulList(stats);
        });
      }
    });
  });
}

function renderColumns(scope) {
  var mode = getMode();
  var colsEl = document.getElementById('serviceDashColumns');
  if (!colsEl) return;
  var cols = [];
  if (mode === 'me_all') {
    cols = [{ title: '', stats: statsFor(scope.all, true) }];
  } else if (mode === 'compare_object_vs_all') {
    cols = [
      { title: 'Это хозяйство', stats: statsFor(scope.current, true) },
      { title: 'Все мои объекты', stats: statsFor(scope.all, true) }
    ];
  } else if (mode === 'compare_me_vs_farm') {
    cols = [
      { title: 'Я', stats: statsFor(scope.current, true) },
      { title: 'Все на хозяйстве', stats: statsFor(scope.current, false) }
    ];
  } else {
    cols = [{ title: '', stats: statsFor(scope.current, true) }];
  }
  _lastStatsByCol = cols.map(function (c) {
    return c.stats;
  });
  colsEl.className = 'service-dash-columns' + (cols.length > 1 ? ' service-dash-columns--compare' : '');
  colsEl.innerHTML = cols
    .map(function (c, i) {
      return '<div class="service-dash-col">' + kpiColumnHtml(c.stats, c.title, i) + '</div>';
    })
    .join('');
  bindColumnActions(colsEl, _lastStatsByCol);
}

function bindUi() {
  if (_bound) return;
  var sel = document.getElementById('serviceDashMode');
  if (!sel) return;
  _bound = true;
  sel.value = getMode();
  sel.addEventListener('change', function () {
    setMode(sel.value);
    updateServiceHerdDashboard();
  });
}

function setClassicVisible(showClassic) {
  var classic = document.querySelector('#herd-hub-screen .herd-stats:not(.service-herd-stats)');
  var service = document.getElementById('serviceHerdStats');
  if (classic) {
    classic.hidden = !showClassic;
    classic.style.display = showClassic ? '' : 'none';
  }
  if (service) {
    if (showClassic) {
      service.setAttribute('hidden', '');
      service.style.display = 'none';
    } else {
      service.removeAttribute('hidden');
      service.style.display = '';
    }
  }
}

function updateServiceHerdDashboard() {
  var service = isServiceUi();
  setClassicVisible(!service);
  if (!service) return;
  bindUi();
  var sel = document.getElementById('serviceDashMode');
  if (sel && sel.value !== getMode()) sel.value = getMode();
  var colsEl = document.getElementById('serviceDashColumns');
  var mode = getMode();
  var needAll = mode === 'me_all' || mode === 'compare_object_vs_all';
  var gen = ++_loadGen;
  if (colsEl && needAll) {
    var loading = document.createElement('p');
    loading.className = 'service-dash-loading';
    loading.textContent = 'Загрузка данных по объектам…';
    if (!colsEl.querySelector('.service-dash-loading')) colsEl.appendChild(loading);
  }
  loadScopeEntries(needAll).then(function (scope) {
    if (gen !== _loadGen) return;
    renderColumns(scope);
  });
}

if (typeof window !== 'undefined') {
  window.updateServiceHerdDashboard = updateServiceHerdDashboard;
}

export { updateServiceHerdDashboard };
