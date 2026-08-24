/**
 * Форма и просмотр отчёта специалиста (опись работ).
 */
import {
  collectServiceWorkItems,
  serializeReportText,
  parseReportItemsFromDescription,
  uziPrintDocumentHtml,
  uziPrintTableHtml,
  isUziReportItem,
  formatPrintDate,
  reportWordFilename,
  isDuplicateServiceReport,
  mokshaUziAoa,
  mokshaUziWorkbook,
  mokshaUziFilename,
  mokshaUziPreviewHtml,
  mokshaUziDocumentHtml
} from './service-work-report-build.js';

var XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

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

function getFarmName() {
  var id = typeof getCurrentObjectId === 'function' ? getCurrentObjectId() : '';
  var list = typeof getObjectsList === 'function' ? getObjectsList() : [];
  if (!Array.isArray(list)) return '';
  for (var i = 0; i < list.length; i++) {
    if (list[i] && String(list[i].id) === String(id)) return String(list[i].name || '').trim();
  }
  return '';
}

function getSelectedTemplate(root) {
  var el = root && root.querySelector('#serviceReportTemplate');
  return (el && el.value) || 'standard';
}

function isMokshaTemplate(root) {
  return getSelectedTemplate(root) === 'moksha';
}

function getMokshaSigners(root) {
  var leftEl = root && root.querySelector('#serviceReportSignerLeft');
  var rightEl = root && root.querySelector('#serviceReportSignerRight');
  return {
    signerLeft: (leftEl && leftEl.value) || '',
    signerRight: (rightEl && rightEl.value) || ''
  };
}

function itemsTableHtml(items) {
  if (!items || !items.length) return '<p class="list-empty">Нет работ за эту дату</p>';
  var uzi = items.filter(isUziReportItem);
  var other = items.filter(function (it) { return !isUziReportItem(it); });
  var html = '';
  if (uzi.length) {
    html += '<p class="farm-settings-hint">УЗИ — формат для печати (МТФ и результат)</p>';
    html += '<div class="service-report-table-wrap">' + uziPrintTableHtml(uzi, getFarmName()) + '</div>';
  }
  if (other.length) {
    var rows = other
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
    html +=
      (uzi.length ? '<p class="farm-settings-hint">Прочие работы</p>' : '') +
      '<div class="service-report-table-wrap"><table class="list-table service-report-table"><thead><tr>' +
      '<th>Номер</th><th>Манипуляция</th><th>Детали</th><th>Дата</th>' +
      '</tr></thead><tbody>' +
      rows +
      '</tbody></table></div>';
  }
  return html;
}

function mokshaPreviewHtml(items, date, signers) {
  if (!items || !items.length) return '<p class="list-empty">Нет УЗИ за эту дату</p>';
  var html = mokshaUziPreviewHtml({
    items: items,
    date: date,
    farmName: getFarmName(),
    signerLeft: signers && signers.signerLeft,
    signerRight: signers && signers.signerRight
  });
  return html || '<p class="list-empty">Нет УЗИ за эту дату</p>';
}

function collectFromForm(root) {
  var dateEl = root.querySelector('#serviceReportDate');
  var date = (dateEl && dateEl.value) || todayIso();
  var moksha = isMokshaTemplate(root);
  var types = moksha
    ? { insemination: false, uzi: true, protocol: false }
    : {
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
  var farmName = getFarmName();
  var uziHtml = uziPrintDocumentHtml({
    items: items,
    date: date,
    farmName: farmName,
    username: username
  });
  var other = (items || []).filter(function (it) { return !isUziReportItem(it); });
  if (uziHtml && !other.length) return uziHtml;
  if (!uziHtml) {
    return (
      '<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"><title>Опись ' +
      escapeHtml(date) +
      '</title><style>body{font-family:sans-serif;padding:16px}h1{font-size:1.2rem}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:6px 8px;text-align:left}th{background:#f3f3f3}</style></head><body>' +
      '<h1>Опись работ специалиста</h1>' +
      '<p>' +
      escapeHtml(date || '') +
      (username ? ' · ' + escapeHtml(username) : '') +
      '</p>' +
      itemsTableHtml(items) +
      '</body></html>'
    );
  }
  return uziHtml.replace(
    '</body></html>',
    '<h2 style="margin-top:18px;font-size:13pt">Прочие работы</h2>' +
      itemsTableHtml(other) +
      '</body></html>'
  );
}

function asWordHtml(html) {
  return String(html || '').replace(
    '<html lang="ru">',
    '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" lang="ru">'
  );
}

function blobToBase64(blob) {
  return new Promise(function (resolve, reject) {
    var r = new FileReader();
    r.onload = function () {
      var s = String(r.result || '');
      var i = s.indexOf(',');
      resolve(i >= 0 ? s.slice(i + 1) : s);
    };
    r.onerror = function () {
      reject(r.error || new Error('read'));
    };
    r.readAsDataURL(blob);
  });
}

function isAndroidCapacitor() {
  try {
    var C = window.Capacitor;
    return !!(C && typeof C.getPlatform === 'function' && C.getPlatform() === 'android' &&
      typeof C.isNativePlatform === 'function' && C.isNativePlatform());
  } catch (e) {
    return false;
  }
}

function s2ab(s) {
  var buf = new ArrayBuffer(s.length);
  var view = new Uint8Array(buf);
  for (var i = 0; i < s.length; i++) view[i] = s.charCodeAt(i) & 0xFF;
  return buf;
}

function downloadViaAnchor(blob, filename) {
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(function () { try { URL.revokeObjectURL(url); } catch (e) {} }, 2000);
  if (typeof showToast === 'function') showToast('Файл сохранён', 'success');
}

function saveBlobWithPlugin(blob, filename, mime) {
  if (isAndroidCapacitor()) {
    return blobToBase64(blob).then(function (b64) {
      return import('@capacitor/core').then(function (core) {
        var SaveDocument = core.registerPlugin('SaveDocument', {
          web: {
            saveFile: function () {
              return Promise.reject(new Error('web'));
            }
          }
        });
        return SaveDocument.saveFile({
          filename: filename,
          mime: mime,
          base64: b64
        });
      });
    }).then(function (res) {
      if (res && res.cancelled) return;
      if (typeof showToast === 'function') showToast('Файл сохранён', 'success');
    }).catch(function () {
      downloadViaAnchor(blob, filename);
    });
  }
  downloadViaAnchor(blob, filename);
  return Promise.resolve();
}

function downloadReportFile(items, date) {
  var html = asWordHtml(reportPrintHtml(items, date, getUsername()));
  var filename = reportWordFilename(items, date, getFarmName());
  var blob = new Blob(['\ufeff' + html], { type: 'application/msword' });
  return saveBlobWithPlugin(blob, filename, 'application/msword');
}

function downloadMokshaExcel(items, date, signers) {
  if (typeof window.XLSX === 'undefined') {
    if (typeof showToast === 'function') showToast('Библиотека Excel не загружена', 'error');
    return Promise.resolve();
  }
  var farmName = getFarmName() || 'Мокша';
  var aoa = mokshaUziAoa(items, {
    farmName: farmName,
    signerLeft: signers && signers.signerLeft,
    signerRight: signers && signers.signerRight
  });
  var wb = mokshaUziWorkbook(aoa);
  if (!wb) {
    if (typeof showToast === 'function') showToast('Не удалось сформировать Excel', 'error');
    return Promise.resolve();
  }
  var filename = mokshaUziFilename(date, farmName);
  var binary = window.XLSX.write(wb, { bookType: 'xlsx', type: 'binary' });
  var blob = new Blob([s2ab(binary)], { type: XLSX_MIME });
  return saveBlobWithPlugin(blob, filename, XLSX_MIME);
}

function newEventId() {
  return 'ev_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

var _saveReportBusy = false;

function saveReport(items, date, opts) {
  opts = opts || {};
  if (_saveReportBusy) return Promise.resolve(false);
  if (!items.length) {
    if (typeof showToast === 'function') showToast('Нет работ за эту дату', 'error');
    return Promise.resolve(false);
  }
  _saveReportBusy = true;
  var load = typeof window.ensureFarmCardLoaded === 'function'
    ? window.ensureFarmCardLoaded()
    : Promise.resolve();
  return load.then(function () {
    if (!window.__farmCardBundle) window.__farmCardBundle = { events: [] };
    if (!window.__farmCardBundle.events) window.__farmCardBundle.events = [];
    if (isDuplicateServiceReport(window.__farmCardBundle.events, date, items)) {
      if (typeof showToast === 'function') showToast('Этот отчёт уже есть в ленте', 'info');
      return false;
    }
    var title = 'Отчёт ' + date + ' (' + items.length + ' гол.)';
    var farm = getFarmName();
    var html;
    var attName;
    if (opts.template === 'moksha') {
      html = mokshaUziDocumentHtml({
        items: items,
        date: date,
        farmName: farm,
        signerLeft: opts.signerLeft,
        signerRight: opts.signerRight
      });
      attName = mokshaUziFilename(date, farm || 'Мокша').replace(/\.xlsx$/i, '.html');
    } else {
      html = reportPrintHtml(items, date, getUsername());
      attName =
        (items.some(isUziReportItem) ? 'УЗИ' : 'opis') +
        (farm ? ' ' + farm : '') +
        ' ' +
        (formatPrintDate(date) || date) +
        '.html';
    }
    window.__farmCardBundle.events.push({
      id: newEventId(),
      eventType: 'service_report',
      eventDate: date,
      title: title,
      participants: getUsername(),
      description: serializeReportText(items),
      reportItems: items,
      reportTemplate: opts.template || 'standard',
      task: '',
      goal: '',
      reminderAt: '',
      completed: false,
      notifyLocal: true,
      attachments: [
        {
          id: 'att_report_' + Date.now(),
          name: attName,
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
  }).then(function (ok) {
    _saveReportBusy = false;
    return ok;
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
    '<label class="service-report-template-label">Шаблон ' +
    '<select id="serviceReportTemplate">' +
    '<option value="standard">Стандартный</option>' +
    '<option value="moksha">Мокша</option>' +
    '</select></label>' +
    '<div class="service-report-types" id="serviceReportTypes">' +
    '<label><input type="checkbox" id="serviceReportTypeInsem" checked /> Осеменение</label>' +
    '<label><input type="checkbox" id="serviceReportTypeUzi" checked /> УЗИ</label>' +
    '<label><input type="checkbox" id="serviceReportTypeProtocol" checked /> Протокол</label>' +
    '</div>' +
    '<div class="service-report-signers" id="serviceReportSigners" hidden>' +
    '<label>Подпись слева <input type="text" id="serviceReportSignerLeft" value="' +
    escapeHtml(getUsername()) +
    '" /></label>' +
    '<label>Подпись справа <input type="text" id="serviceReportSignerRight" value="" /></label>' +
    '</div>' +
    '<p class="farm-settings-hint" id="serviceReportHint">Для печати УЗИ: МТФ — группа животного, если пусто — название хозяйства. «Не стельная» в бланке пишется как «Яловая».</p>' +
    '<div id="serviceReportPreview" class="service-report-preview"></div>' +
    '</div>' +
    '<div class="view-fields-actions">' +
    '<button type="button" class="action-btn" id="serviceReportRefreshBtn">Обновить опись</button>' +
    '<button type="button" class="action-btn" id="serviceReportPrintBtn">На печать</button>' +
    '<button type="button" class="action-btn" id="serviceReportSaveBtn">Сохранить в ленту</button>' +
    '</div></div>';
  document.body.appendChild(modal);

  function syncTemplateUi() {
    var moksha = isMokshaTemplate(modal);
    var typesEl = modal.querySelector('#serviceReportTypes');
    var signersEl = modal.querySelector('#serviceReportSigners');
    var hintEl = modal.querySelector('#serviceReportHint');
    var printBtn = modal.querySelector('#serviceReportPrintBtn');
    if (typesEl) typesEl.hidden = moksha;
    if (signersEl) signersEl.hidden = !moksha;
    if (hintEl) {
      hintEl.textContent = moksha
        ? 'Шаблон «Мокша»: Excel без колонки результата, группировка по МТФ, две подписи внизу.'
        : 'Для печати УЗИ: МТФ — группа животного, если пусто — название хозяйства. «Не стельная» в бланке пишется как «Яловая».';
    }
    if (printBtn) printBtn.textContent = moksha ? 'Скачать Excel' : 'На печать';
  }

  function refreshPreview() {
    var dateEl = modal.querySelector('#serviceReportDate');
    var d = (dateEl && dateEl.value) || todayIso();
    var items = collectFromForm(modal);
    var box = modal.querySelector('#serviceReportPreview');
    if (box) {
      box.innerHTML = isMokshaTemplate(modal)
        ? mokshaPreviewHtml(items, d, getMokshaSigners(modal))
        : itemsTableHtml(items);
    }
    modal._items = items;
  }

  function onFormChange() {
    syncTemplateUi();
    refreshPreview();
  }

  syncTemplateUi();
  refreshPreview();
  modal.querySelector('#serviceReportCloseBtn').addEventListener('click', closeReportModal);
  modal.addEventListener('click', function (ev) {
    if (ev.target === modal) closeReportModal();
  });
  [
    'serviceReportDate',
    'serviceReportTemplate',
    'serviceReportTypeInsem',
    'serviceReportTypeUzi',
    'serviceReportTypeProtocol',
    'serviceReportSignerLeft',
    'serviceReportSignerRight'
  ].forEach(function (id) {
    var el = modal.querySelector('#' + id);
    if (!el) return;
    el.addEventListener('change', onFormChange);
    if (el.tagName === 'INPUT' && el.type === 'text') {
      el.addEventListener('input', refreshPreview);
    }
  });
  modal.querySelector('#serviceReportRefreshBtn').addEventListener('click', refreshPreview);
  modal.querySelector('#serviceReportPrintBtn').addEventListener('click', function () {
    var dateEl = modal.querySelector('#serviceReportDate');
    var d = (dateEl && dateEl.value) || todayIso();
    var items = modal._items || collectFromForm(modal);
    if (!items.length) {
      if (typeof showToast === 'function') {
        showToast(isMokshaTemplate(modal) ? 'Нет УЗИ за эту дату' : 'Нет работ за эту дату', 'error');
      }
      return;
    }
    if (isMokshaTemplate(modal)) {
      downloadMokshaExcel(items, d, getMokshaSigners(modal));
      return;
    }
    downloadReportFile(items, d);
  });
  modal.querySelector('#serviceReportSaveBtn').addEventListener('click', function () {
    var btn = modal.querySelector('#serviceReportSaveBtn');
    if (btn) btn.disabled = true;
    var dateEl = modal.querySelector('#serviceReportDate');
    var d = (dateEl && dateEl.value) || todayIso();
    var items = modal._items || collectFromForm(modal);
    var signers = getMokshaSigners(modal);
    saveReport(items, d, {
      template: getSelectedTemplate(modal),
      signerLeft: signers.signerLeft,
      signerRight: signers.signerRight
    }).then(function (ok) {
      if (!ok && btn && btn.isConnected) btn.disabled = false;
    });
  });
}

function openServiceReportViewer(evObj) {
  closeReportModal();
  if (!evObj) return;
  var items = Array.isArray(evObj.reportItems) && evObj.reportItems.length
    ? evObj.reportItems
    : parseReportItemsFromDescription(evObj.description);
  var isMoksha = evObj.reportTemplate === 'moksha';
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
    (isMoksha ? ' · шаблон Мокша' : '') +
    '</p>' +
    (isMoksha
      ? mokshaPreviewHtml(items, evObj.eventDate || '', {
          signerLeft: evObj.participants || '',
          signerRight: ''
        })
      : itemsTableHtml(items)) +
    '</div>' +
    '<div class="view-fields-actions">' +
    '<button type="button" class="action-btn" id="serviceReportPrintBtn">' +
    (isMoksha ? 'Скачать Excel' : 'На печать') +
    '</button>' +
    '</div></div>';
  document.body.appendChild(modal);
  modal.querySelector('#serviceReportCloseBtn').addEventListener('click', closeReportModal);
  var printBtn = modal.querySelector('#serviceReportPrintBtn');
  if (printBtn) {
    printBtn.addEventListener('click', function () {
      var d = evObj.eventDate || todayIso();
      if (isMoksha) {
        downloadMokshaExcel(items, d, {
          signerLeft: evObj.participants || getUsername(),
          signerRight: ''
        });
        return;
      }
      downloadReportFile(items, d);
    });
  }
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
