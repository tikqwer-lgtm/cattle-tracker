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
  applyGroupFromHerd,
  isMokshaFarmName,
  mokshaUziAoa,
  mokshaUziMerges,
  mokshaUziFilename,
  mokshaUziPreviewHtml,
  DEFAULT_MOKSHA_SIGNERS
} from './service-work-report-build.js';
import {
  collectServiceWorkItemsFromTasks,
  sumTaskQuantities,
  usesServiceWorkTasksJournal
} from './service-work-tasks.js';
import { amountWithWords, rowAmount, sumServiceRows } from '../utils/number-to-words-ru.js';
import {
  collectActFormData,
  actFilename,
  buildActDocx,
  downloadActDocx,
  shareActDocx,
  prefetchActTemplate,
  getCachedActTemplateBytes
} from './service-act-docx.js';
import { loadActFio, saveActFio } from './service-act-fio.js';

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

function getObjectId() {
  return typeof getCurrentObjectId === 'function' ? String(getCurrentObjectId() || '').trim() : '';
}

function isMokshaTemplate(root) {
  var sel = root && root.querySelector('#serviceReportTemplate');
  if (sel && sel.value) return sel.value === 'moksha';
  return isMokshaFarmName(getFarmName());
}

function readMokshaSigners(root) {
  var saved = loadActFio(typeof localStorage !== 'undefined' ? localStorage : null, getObjectId());
  return {
    left: ((root && root.querySelector('#serviceMokshaSignerLeft')) || {}).value || saved.mokshaLeft || DEFAULT_MOKSHA_SIGNERS.left,
    right1: ((root && root.querySelector('#serviceMokshaSignerRight1')) || {}).value || saved.mokshaRight1 || DEFAULT_MOKSHA_SIGNERS.right1,
    right2: ((root && root.querySelector('#serviceMokshaSignerRight2')) || {}).value || saved.mokshaRight2 || DEFAULT_MOKSHA_SIGNERS.right2
  };
}

function persistFioFromForm(root) {
  if (!root) return;
  var data = {
    executorFio: ((root.querySelector('#serviceActExecutorFio') || {}).value || ''),
    customerOrg: ((root.querySelector('#serviceActCustomerOrg') || {}).value || ''),
    customerFio: ((root.querySelector('#serviceActCustomerFio') || {}).value || ''),
    mokshaLeft: ((root.querySelector('#serviceMokshaSignerLeft') || {}).value || ''),
    mokshaRight1: ((root.querySelector('#serviceMokshaSignerRight1') || {}).value || ''),
    mokshaRight2: ((root.querySelector('#serviceMokshaSignerRight2') || {}).value || '')
  };
  saveActFio(typeof localStorage !== 'undefined' ? localStorage : null, getObjectId(), data);
}

function applySavedFioToForm(root) {
  var saved = loadActFio(typeof localStorage !== 'undefined' ? localStorage : null, getObjectId());
  function setVal(id, value) {
    var el = root.querySelector('#' + id);
    if (el) el.value = value || '';
  }
  setVal('serviceActExecutorFio', saved.executorFio);
  setVal('serviceActCustomerOrg', saved.customerOrg);
  setVal('serviceActCustomerFio', saved.customerFio);
  setVal('serviceMokshaSignerLeft', saved.mokshaLeft);
  setVal('serviceMokshaSignerRight1', saved.mokshaRight1);
  setVal('serviceMokshaSignerRight2', saved.mokshaRight2);
}

function itemsTableHtml(items, opts) {
  opts = opts || {};
  if (!items || !items.length) return '<p class="list-empty">Нет работ за эту дату</p>';
  var uzi = items.filter(isUziReportItem);
  var other = items.filter(function (it) { return !isUziReportItem(it); });
  var html = '';
  if (uzi.length) {
    if (opts.moksha) {
      html += mokshaUziPreviewHtml({
        items: uzi,
        farmName: getFarmName(),
        signers: opts.signers || readMokshaSigners(opts.root)
      });
    } else {
      html += '<p class="farm-settings-hint">УЗИ — формат для печати (МТФ и результат)</p>';
      html += '<div class="service-report-table-wrap">' + uziPrintTableHtml(uzi, getFarmName()) + '</div>';
    }
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
  var items;
  if (usesServiceWorkTasksJournal()) {
    var tasks = [];
    if (window.__farmCardBundle && Array.isArray(window.__farmCardBundle.workTasks)) {
      tasks = window.__farmCardBundle.workTasks;
    } else if (window.CattleTrackerWorkTasks && window.CattleTrackerWorkTasks.readWorkTasksLocal) {
      tasks = window.CattleTrackerWorkTasks.readWorkTasksLocal();
    }
    items = collectServiceWorkItemsFromTasks(tasks, {
      date: date,
      username: getUsername(),
      types: types
    });
  } else {
    items = collectServiceWorkItems(getEntriesList(), {
      date: date,
      username: getUsername(),
      types: types
    });
  }
  return applyGroupFromHerd(items, getEntriesList(), getFarmName());
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

function downloadMokshaExcel(items, date, signers) {
  var XLSX = typeof window !== 'undefined' ? window.XLSX : null;
  if (!XLSX || !XLSX.utils) {
    if (typeof showToast === 'function') showToast('Библиотека Excel не загружена', 'error');
    return;
  }
  var farm = getFarmName() || 'Мокша';
  var aoa = mokshaUziAoa(items, { farmName: farm, date: date, signers: signers });
  var ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!merges'] = mokshaUziMerges();
  ws['!cols'] = [{ wch: 10 }, { wch: 12 }, { wch: 16 }, { wch: 14 }];
  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Лист1');
  var filename = mokshaUziFilename(date, farm);
  if (typeof XLSX.writeFile === 'function') {
    XLSX.writeFile(wb, filename);
    if (typeof showToast === 'function') showToast('Файл сохранён', 'success');
    return;
  }
  var binary = XLSX.write(wb, { bookType: 'xlsx', type: 'binary' });
  var buf = new ArrayBuffer(binary.length);
  var view = new Uint8Array(buf);
  var i;
  for (i = 0; i < binary.length; i++) view[i] = binary.charCodeAt(i) & 0xff;
  var blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  if (typeof window.downloadBlob === 'function') {
    window.downloadBlob(blob, filename, null, 'УЗИ');
    return;
  }
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(function () { try { URL.revokeObjectURL(url); } catch (e) {} }, 2000);
}

function downloadReportFile(items, date, opts) {
  opts = opts || {};
  if (opts.moksha) {
    downloadMokshaExcel(items, date, opts.signers || {});
    return;
  }
  var html = reportPrintHtml(items, date, getUsername());
  var farm = getFarmName();
  var dPrint = formatPrintDate(date) || date || todayIso();
  var filename = (items.some(isUziReportItem) ? 'УЗИ' : 'opis') +
    (farm ? ' ' + farm : '') +
    ' ' +
    dPrint.replace(/\./g, '.') +
    '.html';
  var blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  if (typeof window.downloadBlob === 'function') {
    window.downloadBlob(blob, filename, html, 'УЗИ');
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
    var title = 'Отчёт ' + date + ' (' + sumTaskQuantities(items) + ' гол.)';
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
          name: (items.some(isUziReportItem) ? 'УЗИ' : 'opis') +
            (getFarmName() ? ' ' + getFarmName() : '') +
            ' ' +
            (formatPrintDate(date) || date) +
            '.html',
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

function actRowHtml() {
  return (
    '<tr class="service-act-row">' +
    '<td><input type="text" data-act-field="name" placeholder="Наименование" /></td>' +
    '<td><input type="text" data-act-field="unit" placeholder="гол" /></td>' +
    '<td><input type="number" inputmode="decimal" data-act-field="qty" min="0" step="any" /></td>' +
    '<td><input type="number" inputmode="decimal" data-act-field="price" min="0" step="any" /></td>' +
    '<td><input type="text" data-act-field="sum" readonly tabindex="-1" /></td>' +
    '<td><button type="button" class="small-btn service-act-del-row">Удалить</button></td>' +
    '</tr>'
  );
}

function actRowsHtml(count) {
  var n = count > 0 ? count : 3;
  var html = '';
  var i;
  for (i = 0; i < n; i++) html += actRowHtml();
  return html;
}

function actBlockHtml() {
  return (
    '<div class="service-act-block" id="serviceActBlock">' +
    '<p class="farm-settings-hint">Сумма строки = количество × цена. Итого считается само. В бланке три строки, как в образце.</p>' +
    '<div class="service-act-fields">' +
    '<label>В лице (исполнитель) <input type="text" id="serviceActExecutorFio" class="service-act-fio" autocomplete="name" /></label>' +
    '<label>Организация (заказчик) <input type="text" id="serviceActCustomerOrg" class="service-act-fio" autocomplete="organization" /></label>' +
    '<label>В лице (заказчик) <input type="text" id="serviceActCustomerFio" class="service-act-fio" autocomplete="name" /></label>' +
    '</div>' +
    '<div class="service-act-table-wrap"><table class="list-table service-act-table"><thead><tr>' +
    '<th>Наименование услуги</th><th>Ед. изм</th><th>Количество, гол</th><th>Цена</th><th>Сумма</th><th></th>' +
    '</tr></thead><tbody id="serviceActRows">' +
    actRowsHtml(3) +
    '</tbody></table></div>' +
    '<p class="service-act-total" id="serviceActTotalLine">Итого: 0 (ноль)</p>' +
    '<div class="service-act-actions">' +
    '<button type="button" class="action-btn" id="serviceActDownloadBtn">Скачать Word</button>' +
    '<button type="button" class="action-btn" id="serviceActMaxBtn">Отправить в MAX</button>' +
    '</div></div>'
  );
}

function refreshActTotal(root) {
  var data = collectActFormData(root, '');
  root.querySelectorAll('.service-act-row').forEach(function (tr) {
    var qty = ((tr.querySelector('[data-act-field="qty"]') || {}).value || '').trim();
    var price = ((tr.querySelector('[data-act-field="price"]') || {}).value || '').trim();
    var sumEl = tr.querySelector('[data-act-field="sum"]');
    if (!sumEl) return;
    if (!qty && !price) {
      sumEl.value = '';
      return;
    }
    var packed = amountWithWords(rowAmount({ qty: qty, price: price }));
    sumEl.value = packed.digits;
  });
  var total = sumServiceRows(data.rows);
  var packed = amountWithWords(total);
  var line = root.querySelector('#serviceActTotalLine');
  if (line) {
    line.textContent = 'Итого: ' + packed.digits + ' (' + packed.words + ') ' + packed.rubleWord;
  }
}

function currentActDate(root) {
  var dateEl = root.querySelector('#serviceReportDate');
  return (dateEl && dateEl.value) || todayIso();
}

function actFileFromForm(root) {
  persistFioFromForm(root);
  var data = collectActFormData(root, currentActDate(root));
  if (!data.rows.length) {
    if (typeof showToast === 'function') showToast('Добавьте хотя бы одну услугу в акт', 'error');
    return null;
  }
  var cached = getCachedActTemplateBytes();
  if (!cached) {
    prefetchActTemplate();
    if (typeof showToast === 'function') {
      showToast('Бланк ещё загружается. Нажмите ещё раз через секунду.', 'info', 4000);
    }
    return null;
  }
  try {
    return {
      bytes: buildActDocx(cached, data),
      filename: actFilename(currentActDate(root))
    };
  } catch (err) {
    if (typeof showToast === 'function') {
      showToast((err && err.message) || 'Не удалось собрать акт', 'error');
    }
    return null;
  }
}

function bindServiceActBlock(modal) {
  var tbody = modal.querySelector('#serviceActRows');
  modal.addEventListener('click', function (ev) {
    var btn = ev.target && ev.target.closest ? ev.target.closest('.service-act-del-row') : null;
    if (!btn || !tbody) return;
    var tr = btn.closest('tr');
    if (!tr) return;
    if (tbody.querySelectorAll('.service-act-row').length <= 3) {
      tr.querySelectorAll('input').forEach(function (inp) {
        inp.value = '';
      });
    } else {
      tr.parentNode.removeChild(tr);
    }
    refreshActTotal(modal);
  });
  modal.addEventListener('input', function (ev) {
    var t = ev.target;
    if (t && t.getAttribute && t.getAttribute('data-act-field')) refreshActTotal(modal);
    if (t && t.classList && t.classList.contains('service-act-fio')) persistFioFromForm(modal);
  });
  var dl = modal.querySelector('#serviceActDownloadBtn');
  if (dl) {
    dl.addEventListener('click', function () {
      var file = actFileFromForm(modal);
      if (!file) return;
      Promise.resolve(downloadActDocx(file.bytes, file.filename)).then(function (res) {
        if (res && res.canceled) return;
        if (typeof showToast === 'function') showToast('Акт сохранён', 'success');
      }).catch(function (err) {
        if (typeof showToast === 'function') {
          showToast((err && err.message) || 'Не удалось сохранить акт', 'error');
        }
      });
    });
  }
  var maxBtn = modal.querySelector('#serviceActMaxBtn');
  if (maxBtn) {
    maxBtn.addEventListener('click', function () {
      var file = actFileFromForm(modal);
      if (!file) return;
      Promise.resolve(shareActDocx(file.bytes, file.filename)).catch(function (err) {
        if (typeof showToast === 'function') {
          showToast((err && err.message) || 'Не удалось открыть MAX', 'error', 5000);
        }
      });
    });
  }
  refreshActTotal(modal);
  prefetchActTemplate();
}

function bindServiceReportTabs(modal) {
  var tabs = modal.querySelectorAll('.service-report-tab');
  if (!tabs.length) return;
  function showTab(id) {
    tabs.forEach(function (btn) {
      var on = btn.getAttribute('data-report-tab') === id;
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    modal.querySelectorAll('.service-report-tab-panel').forEach(function (panel) {
      var on = panel.getAttribute('data-report-panel') === id;
      if (on) panel.removeAttribute('hidden');
      else panel.setAttribute('hidden', '');
    });
    if (id === 'act') prefetchActTemplate();
  }
  tabs.forEach(function (btn) {
    btn.addEventListener('click', function () {
      showTab(btn.getAttribute('data-report-tab') || 'opis');
    });
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
    '<label>Шаблон описи <select id="serviceReportTemplate">' +
    '<option value="default">Обычный</option>' +
    '<option value="moksha"' + (isMokshaFarmName(getFarmName()) ? ' selected' : '') + '>Мокша</option>' +
    '</select></label>' +
    '<div class="service-report-tabs" role="tablist" aria-label="Разделы отчёта">' +
    '<button type="button" class="service-report-tab active" data-report-tab="opis" role="tab" aria-selected="true">Опись</button>' +
    '<button type="button" class="service-report-tab" data-report-tab="act" role="tab" aria-selected="false">Акт</button>' +
    '</div>' +
    '<div class="service-report-tab-panel" data-report-panel="opis" role="tabpanel">' +
    '<div class="service-report-types" id="serviceReportTypes">' +
    '<label><input type="checkbox" id="serviceReportTypeInsem" checked /> Осеменение</label>' +
    '<label><input type="checkbox" id="serviceReportTypeUzi" checked /> УЗИ</label>' +
    '<label><input type="checkbox" id="serviceReportTypeProtocol" checked /> Протокол</label>' +
    '</div>' +
    '<div class="service-moksha-signers" id="serviceMokshaSigners" hidden>' +
    '<p class="farm-settings-hint">Подписи внизу файла. Сохраняются для следующих описей и актов.</p>' +
    '<label>Слева <input type="text" id="serviceMokshaSignerLeft" class="service-act-fio" autocomplete="name" /></label>' +
    '<label>Справа (1) <input type="text" id="serviceMokshaSignerRight1" class="service-act-fio" autocomplete="name" /></label>' +
    '<label>Справа (2) <input type="text" id="serviceMokshaSignerRight2" class="service-act-fio" autocomplete="name" /></label>' +
    '</div>' +
    '<p class="farm-settings-hint" id="serviceReportHint">Для печати УЗИ: МТФ — группа животного, если пусто — название хозяйства. «Не стельная» в бланке пишется как «Яловая».</p>' +
    '<div id="serviceReportPreview" class="service-report-preview"></div>' +
    '<div class="view-fields-actions">' +
    '<button type="button" class="action-btn" id="serviceReportRefreshBtn">Обновить опись</button>' +
    '<button type="button" class="action-btn" id="serviceReportPrintBtn">На печать</button>' +
    '<button type="button" class="action-btn" id="serviceReportSaveBtn">Сохранить в ленту</button>' +
    '</div>' +
    '</div>' +
    '<div class="service-report-tab-panel" data-report-panel="act" role="tabpanel" hidden>' +
    actBlockHtml() +
    '</div>' +
    '</div></div>';
  document.body.appendChild(modal);
  bindServiceActBlock(modal);
  bindServiceReportTabs(modal);
  applySavedFioToForm(modal);

  function syncTemplateUi() {
    var moksha = isMokshaTemplate(modal);
    var typesEl = modal.querySelector('#serviceReportTypes');
    var signersEl = modal.querySelector('#serviceMokshaSigners');
    var hintEl = modal.querySelector('#serviceReportHint');
    var printBtn = modal.querySelector('#serviceReportPrintBtn');
    if (typesEl) typesEl.hidden = moksha;
    if (signersEl) signersEl.hidden = !moksha;
    if (hintEl) {
      hintEl.textContent = moksha
        ? 'Шаблон «Мокша»: Excel без колонки результата, группировка по МТФ, подписи внизу. МТФ — группа животного.'
        : usesServiceWorkTasksJournal()
          ? 'Опись собирается из журнала задач за дату: общее число голов и необязательные строки. Протокол в отчёте — только если указан в строке осеменения.'
          : 'Для печати УЗИ: МТФ — группа животного, если пусто — название хозяйства. «Не стельная» в бланке пишется как «Яловая».';
    }
    if (printBtn) printBtn.textContent = moksha ? 'Скачать Excel' : 'На печать';
  }

  function refreshPreview() {
    var items = collectFromForm(modal);
    var box = modal.querySelector('#serviceReportPreview');
    if (box) {
      box.innerHTML = itemsTableHtml(items, {
        moksha: isMokshaTemplate(modal),
        signers: readMokshaSigners(modal),
        root: modal
      });
    }
    modal._items = items;
  }
  var boot =
    typeof window.ensureFarmCardLoaded === 'function'
      ? window.ensureFarmCardLoaded()
      : Promise.resolve();
  boot.then(function () {
    syncTemplateUi();
    refreshPreview();
  }).catch(function () {
    syncTemplateUi();
    refreshPreview();
  });
  modal.querySelector('#serviceReportCloseBtn').addEventListener('click', closeReportModal);
  modal.addEventListener('click', function (ev) {
    if (ev.target === modal) closeReportModal();
  });
  ['serviceReportDate', 'serviceReportTypeInsem', 'serviceReportTypeUzi', 'serviceReportTypeProtocol', 'serviceReportTemplate'].forEach(function (id) {
    var el = modal.querySelector('#' + id);
    if (el) {
      el.addEventListener('change', function () {
        if (id === 'serviceReportTemplate') syncTemplateUi();
        refreshPreview();
      });
    }
  });
  ['serviceMokshaSignerLeft', 'serviceMokshaSignerRight1', 'serviceMokshaSignerRight2'].forEach(function (id) {
    var el = modal.querySelector('#' + id);
    if (el) el.addEventListener('input', function () { persistFioFromForm(modal); refreshPreview(); });
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
    persistFioFromForm(modal);
    downloadReportFile(items, d, {
      moksha: isMokshaTemplate(modal),
      signers: readMokshaSigners(modal)
    });
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
    '</div>' +
    '<div class="view-fields-actions">' +
    '<button type="button" class="action-btn" id="serviceReportPrintBtn">На печать</button>' +
    '</div></div>';
  document.body.appendChild(modal);
  modal.querySelector('#serviceReportCloseBtn').addEventListener('click', closeReportModal);
  var printBtn = modal.querySelector('#serviceReportPrintBtn');
  if (printBtn) {
    printBtn.addEventListener('click', function () {
      downloadReportFile(items, evObj.eventDate || todayIso());
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
