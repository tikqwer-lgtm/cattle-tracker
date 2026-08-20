/**
 * Форма и просмотр отчёта специалиста (опись работ).
 */
import {
  collectServiceWorkItems,
  serializeReportText,
  parseReportItemsFromDescription
} from './service-work-report-build.js';

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function todayIso() {
  var d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function getUsername() {
  var u = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
  return (u && u.username) ? String(u.username) : '';
}

function getEntriesList() {
  var raw = typeof window.entries !== 'undefined' && Array.isArray(window.entries) ? window.entries : [];
  return typeof window.getVisibleEntries === 'function' ? window.getVisibleEntries(raw) : raw;
}

function closeReportModal() {
  var el = document.getElementById('serviceReportModal');
  if (el && el.parentNode) el.parentNode.removeChild(el);
}

function itemsTableHtml(items) {
  if (!items || !items.length) return '<p class="list-empty">Нет работ за эту дату</p>';
  var rows = items
    .map(function (it) {
      return (
        '<tr><td>' +
        escapeHtml(it.cattleId) +
        '</td><td>' +
        escapeHtml(it.action) +
        '</td><td>' +
        escapeHtml(it.details) +
        '</td><td>' +
        escapeHtml(it.workDate) +
        '</td></tr>'
      );
    })
    .join('');
  return (
    '<div class="service-report-table-wrap"><table class="list-table service-report-table"><thead><tr>' +
    '<th>Номер</th><th>Манипуляция</th><th>Детали</th><th>Дата</th>' +
    '</tr></thead><tbody>' +
    rows +
    '</tbody></table></div>'
  );
}

function collectFromForm(root) {
  var dateEl = root.querySelector('#serviceReportDate');
  var date = (dateEl && dateEl.value) || todayIso();
  var types = {
    insemination: !!(root.querySelector('#serviceReportTypeInsem') && root.querySelector('#serviceReportTypeInsem').checked),
    uzi: !!(root.querySelector('#serviceReportTypeUzi') && root.querySelector('#serviceReportTypeUzi').checked),
    protocol: !!(root.querySelector('#serviceReportTypeProtocol') && root.querySelector('#serviceReportTypeProtocol').checked)
  };
  return collectServiceWorkItems(getEntriesList(), {
    date: date,
    username: getUsername(),
    types: types
  });
}

function htmlToDataUrl(html) {
  var b64;
  try {
    b64 = btoa(unescape(encodeURIComponent(html)));
  } catch (e) {
    b64 = btoa(html);
  }
  return 'data:text/html;charset=utf-8;base64,' + b64;
}

function reportPrintHtml(items, date, username) {
  return (
    '<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"><title>Опись ' +
    escapeHtml(date) +
    '</title><style>body{font-family:sans-serif;padding:16px}h1{font-size:1.2rem}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:6px 8px;text-align:left}th{background:#f3f3f3}</style></head><body>' +
    '<h1>Опись работ специалиста</h1>' +
    '<p>' +
    escapeHtml(date || '') +
    (username ? ' · ' + escapeHtml(username) : '') +
    '</p>' +
    itemsTableHtml(items).replace('class="list-table service-report-table"', 'class="service-report-table"') +
    '</body></html>'
  );
}

function downloadReportFile(items, date) {
  var html = reportPrintHtml(items, date, getUsername());
  var blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  var filename = 'opis-' + (date || todayIso()) + '.html';
  if (typeof window.downloadBlob === 'function') {
    window.downloadBlob(blob, filename, html, 'Опись работ');
    return;
  }
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(function () { try { URL.revokeObjectURL(url); } catch (e) {} }, 2000);
  if (typeof showToast === 'function') showToast('Файл сохранён', 'success');
}

function newEventId() {
  return 'ev_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

function saveReport(items, date) {
  if (!items.length) {
    if (typeof showToast === 'function') showToast('Нет работ за эту дату', 'error');
    return Promise.resolve(false);
  }
  var load = typeof window.ensureFarmCardLoaded === 'function'
    ? window.ensureFarmCardLoaded()
    : Promise.resolve();
  return load.then(function () {
    if (!window.__farmCardBundle) window.__farmCardBundle = { events: [] };
    if (!window.__farmCardBundle.events) window.__farmCardBundle.events = [];
    var title = 'Отчёт ' + date + ' (' + items.length + ' гол.)';
    var html = reportPrintHtml(items, date, getUsername());
    window.__farmCardBundle.events.push({
      id: newEventId(),
      eventType: 'service_report',
      eventDate: date,
      title: title,
      participants: getUsername(),
      description: serializeReportText(items),
      reportItems: items,
      task: '',
      goal: '',
      reminderAt: '',
      completed: false,
      notifyLocal: true,
      attachments: [
        {
          id: 'att_report_' + Date.now(),
          name: 'opis-' + date + '.html',
          mime: 'text/html',
          size: html.length,
          dataUrl: htmlToDataUrl(html)
        }
      ]
    });
    if (typeof window.saveFarmCardBundle !== 'function') {
      if (typeof showToast === 'function') showToast('Не удалось сохранить карточку хозяйства', 'error');
      return false;
    }
    return window.saveFarmCardBundle(window.__farmCardBundle).then(function () {
      if (typeof showToast === 'function') showToast('Отчёт сохранён в ленту карточки хозяйства', 'success');
      closeReportModal();
      if (typeof window.renderFarmCardPanel === 'function' && document.getElementById('farm-card-screen') &&
          document.getElementById('farm-card-screen').classList.contains('active')) {
        window.renderFarmCardPanel();
      }
      return true;
    });
  }).catch(function (err) {
    if (err && err.alreadyToasted) return false;
    if (typeof showToast === 'function') showToast((err && err.message) || 'Ошибка сохранения отчёта', 'error');
    return false;
  });
}

function openServiceWorkReportForm() {
  closeReportModal();
  var date = todayIso();
  var modal = document.createElement('div');
  modal.id = 'serviceReportModal';
  modal.className = 'view-fields-modal active';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.innerHTML =
    '<div class="view-fields-modal-content service-report-modal">' +
    '<div class="view-fields-modal-header"><h2>Сформировать отчёт</h2>' +
    '<button type="button" class="small-btn" id="serviceReportCloseBtn">Закрыть</button></div>' +
    '<div class="view-fields-modal-body">' +
    '<label>Дата работы <input type="date" id="serviceReportDate" value="' + escapeHtml(date) + '" /></label>' +
    '<div class="service-report-types">' +
    '<label><input type="checkbox" id="serviceReportTypeInsem" checked /> Осеменение</label>' +
    '<label><input type="checkbox" id="serviceReportTypeUzi" checked /> УЗИ</label>' +
    '<label><input type="checkbox" id="serviceReportTypeProtocol" checked /> Протокол</label>' +
    '</div>' +
    '<div id="serviceReportPreview" class="service-report-preview"></div>' +
    '</div>' +
    '<div class="view-fields-actions">' +
    '<button type="button" class="action-btn" id="serviceReportRefreshBtn">Обновить опись</button>' +
    '<button type="button" class="action-btn" id="serviceReportPrintBtn">На печать</button>' +
    '<button type="button" class="action-btn" id="serviceReportSaveBtn">Сохранить в ленту</button>' +
    '</div></div>';
  document.body.appendChild(modal);

  function refreshPreview() {
    var items = collectFromForm(modal);
    var box = modal.querySelector('#serviceReportPreview');
    if (box) box.innerHTML = itemsTableHtml(items);
    modal._items = items;
  }
  refreshPreview();
  modal.querySelector('#serviceReportCloseBtn').addEventListener('click', closeReportModal);
  modal.addEventListener('click', function (ev) {
    if (ev.target === modal) closeReportModal();
  });
  ['serviceReportDate', 'serviceReportTypeInsem', 'serviceReportTypeUzi', 'serviceReportTypeProtocol'].forEach(function (id) {
    var el = modal.querySelector('#' + id);
    if (el) el.addEventListener('change', refreshPreview);
  });
  modal.querySelector('#serviceReportRefreshBtn').addEventListener('click', refreshPreview);
  modal.querySelector('#serviceReportPrintBtn').addEventListener('click', function () {
    var dateEl = modal.querySelector('#serviceReportDate');
    var d = (dateEl && dateEl.value) || todayIso();
    var items = modal._items || collectFromForm(modal);
    if (!items.length) {
      if (typeof showToast === 'function') showToast('Нет работ за эту дату', 'error');
      return;
    }
    downloadReportFile(items, d);
  });
  modal.querySelector('#serviceReportSaveBtn').addEventListener('click', function () {
    var dateEl = modal.querySelector('#serviceReportDate');
    var d = (dateEl && dateEl.value) || todayIso();
    var items = modal._items || collectFromForm(modal);
    saveReport(items, d);
  });
}

function openServiceReportViewer(evObj) {
  closeReportModal();
  if (!evObj) return;
  var items = Array.isArray(evObj.reportItems) && evObj.reportItems.length
    ? evObj.reportItems
    : parseReportItemsFromDescription(evObj.description);
  var modal = document.createElement('div');
  modal.id = 'serviceReportModal';
  modal.className = 'view-fields-modal active';
  modal.setAttribute('role', 'dialog');
  modal.innerHTML =
    '<div class="view-fields-modal-content service-report-modal">' +
    '<div class="view-fields-modal-header"><h2>' +
    escapeHtml(evObj.title || 'Отчёт специалиста') +
    '</h2>' +
    '<button type="button" class="small-btn" id="serviceReportCloseBtn">Закрыть</button></div>' +
    '<div class="view-fields-modal-body">' +
    '<p class="farm-settings-hint">Дата: ' + escapeHtml(evObj.eventDate || '—') +
    (evObj.participants ? ' · ' + escapeHtml(evObj.participants) : '') +
    '</p>' +
    itemsTableHtml(items) +
    '</div></div>';
  document.body.appendChild(modal);
  modal.querySelector('#serviceReportCloseBtn').addEventListener('click', closeReportModal);
  modal.addEventListener('click', function (ev) {
    if (ev.target === modal) closeReportModal();
  });
}

function syncServiceReportHubButton() {
  var wrap = document.getElementById('serviceReportHubWrap');
  if (!wrap) return;
  wrap.hidden = true;
}

function bindServiceReportUi() {
  var hubBtn = document.getElementById('serviceReportHubBtn');
  if (hubBtn && hubBtn.dataset.bound !== '1') {
    hubBtn.dataset.bound = '1';
    hubBtn.addEventListener('click', openServiceWorkReportForm);
  }
  syncServiceReportHubButton();
  document.addEventListener('cattle-tracker:navigate', function (ev) {
    var id = ev && ev.detail && ev.detail.screenId;
    if (id === 'herd-hub') syncServiceReportHubButton();
  });
}

if (typeof window !== 'undefined') {
  window.openServiceWorkReportForm = openServiceWorkReportForm;
  window.openServiceReportViewer = openServiceReportViewer;
  window.syncServiceReportHubButton = syncServiceReportHubButton;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindServiceReportUi);
  } else {
    bindServiceReportUi();
  }
}

export { openServiceWorkReportForm, openServiceReportViewer };
