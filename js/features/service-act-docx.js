/**
 * Подстановка полей акта в шаблон Word и выдача файла.
 */
import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate';
import {
  amountWithWords,
  formatActHeaderDate,
  formatAmount,
  parseAmount,
  rowAmount,
  sumServiceRows
} from '../utils/number-to-words-ru.js';

var DOC_PATH = 'word/document.xml';
var TEMPLATE_URLS = ['templates/act-uslug.docx', 'assets/templates/act-uslug.docx'];
var MIN_SERVICE_ROWS = 3;

function escapeXml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function replaceAll(hay, needle, value) {
  return String(hay || '').split(needle).join(value == null ? '' : String(value));
}

function padServiceRows(rows) {
  var list = Array.isArray(rows) ? rows.slice() : [];
  while (list.length < MIN_SERVICE_ROWS) {
    list.push({ name: '', unit: '', qty: '', price: '' });
  }
  return list.slice(0, MIN_SERVICE_ROWS);
}

function fillIndexedRow(xml, row, n) {
  var i = String(n);
  var qty = row && row.qty != null && String(row.qty).trim() !== '' ? String(row.qty).trim() : '';
  var priceStr =
    row && row.price != null && String(row.price).trim() !== '' ? formatAmount(parseAmount(row.price)) : '';
  var sumStr = qty || priceStr ? formatAmount(rowAmount(row)) : '';
  xml = replaceAll(xml, '{{rowNum' + i + '}}', i);
  xml = replaceAll(xml, '{{svcName' + i + '}}', escapeXml((row && row.name) || ''));
  xml = replaceAll(xml, '{{svcUnit' + i + '}}', escapeXml((row && row.unit) || ''));
  xml = replaceAll(xml, '{{svcQty' + i + '}}', escapeXml(qty));
  xml = replaceAll(xml, '{{svcPrice' + i + '}}', escapeXml(priceStr));
  xml = replaceAll(xml, '{{svcSum' + i + '}}', escapeXml(sumStr));
  return xml;
}

function fillServiceTable(xml, rows) {
  var list = padServiceRows(rows);
  var i;
  for (i = 1; i <= MIN_SERVICE_ROWS; i++) {
    xml = fillIndexedRow(xml, list[i - 1], i);
  }
  return xml;
}

function fillActDocumentXml(xml, data) {
  data = data || {};
  var rows = Array.isArray(data.rows) ? data.rows : [];
  var total = sumServiceRows(rows);
  var words = amountWithWords(total);
  var out = fillServiceTable(xml, rows);
  out = replaceAll(out, '{{actDate}}', escapeXml(data.actDate || ''));
  out = replaceAll(out, '{{executorFio}}', escapeXml(data.executorFio || ''));
  out = replaceAll(out, '{{customerOrg}}', escapeXml(data.customerOrg || ''));
  out = replaceAll(out, '{{customerFio}}', escapeXml(data.customerFio || ''));
  out = replaceAll(out, '{{totalWords}}', escapeXml(words.words));
  out = replaceAll(out, '{{total}}', escapeXml(words.digits));
  return out;
}

function collectActFormData(root, dateIso) {
  var executorEl = root && root.querySelector('#serviceActExecutorFio');
  var orgEl = root && root.querySelector('#serviceActCustomerOrg');
  var customerEl = root && root.querySelector('#serviceActCustomerFio');
  var rowEls = root ? root.querySelectorAll('.service-act-row') : [];
  var rows = [];
  rowEls.forEach(function (tr) {
    var name = ((tr.querySelector('[data-act-field="name"]') || {}).value || '').trim();
    var unit = ((tr.querySelector('[data-act-field="unit"]') || {}).value || '').trim();
    var qty = ((tr.querySelector('[data-act-field="qty"]') || {}).value || '').trim();
    var price = ((tr.querySelector('[data-act-field="price"]') || {}).value || '').trim();
    if (!name && !unit && !qty && !price) return;
    rows.push({ name: name, unit: unit, qty: qty, price: price });
  });
  return {
    actDate: formatActHeaderDate(dateIso),
    executorFio: executorEl ? String(executorEl.value || '').trim() : '',
    customerOrg: orgEl ? String(orgEl.value || '').trim() : '',
    customerFio: customerEl ? String(customerEl.value || '').trim() : '',
    rows: rows
  };
}

function ensureDocxFilename(name) {
  var n = String(name == null ? '' : name).trim();
  n = n.replace(/\.docx\s*\((\d+)\)\s*$/i, ' ($1).docx');
  n = n.replace(/\.docx(\d+)\s*$/i, ' ($1).docx');
  if (!/\.docx$/i.test(n)) n = (n || 'акт') + '.docx';
  return n;
}

function actFilename(dateIso) {
  var d = String(dateIso || '').trim();
  var m = d.match(/^(\d{4})-(\d{2})-(\d{2})/);
  var stamp = m ? m[3] + '.' + m[2] + '.' + m[1] : d.replace(/[^\d.-]/g, '') || 'акт';
  return ensureDocxFilename('Акт об оказании услуг ' + stamp + '.docx');
}

function buildActDocx(templateBytes, data) {
  var bytes = templateBytes instanceof Uint8Array ? templateBytes : new Uint8Array(templateBytes);
  var unzipped = unzipSync(bytes);
  if (!unzipped[DOC_PATH]) throw new Error('Повреждён шаблон акта');
  var xml = fillActDocumentXml(strFromU8(unzipped[DOC_PATH]), data);
  unzipped[DOC_PATH] = strToU8(xml);
  var files = {};
  Object.keys(unzipped).forEach(function (k) {
    files[k] = unzipped[k];
  });
  return zipSync(files, { level: 6 });
}

var cachedActTemplateBytes = null;
var actTemplateFetchPromise = null;
var appFilePlugin = null;
var appFilePluginPromise = null;

function fetchActTemplateBytes() {
  if (cachedActTemplateBytes) return Promise.resolve(cachedActTemplateBytes);
  if (actTemplateFetchPromise) return actTemplateFetchPromise;
  function tryUrl(i) {
    if (i >= TEMPLATE_URLS.length) {
      return Promise.reject(new Error('Не найден шаблон акта'));
    }
    return fetch(TEMPLATE_URLS[i], { cache: 'force-cache' })
      .then(function (res) {
        if (!res || !res.ok) return tryUrl(i + 1);
        return res.arrayBuffer().then(function (buf) {
          var bytes = new Uint8Array(buf);
          if (!bytes.length) return tryUrl(i + 1);
          cachedActTemplateBytes = bytes;
          return bytes;
        });
      })
      .catch(function () {
        return tryUrl(i + 1);
      });
  }
  actTemplateFetchPromise = tryUrl(0).then(
    function (bytes) {
      actTemplateFetchPromise = null;
      return bytes;
    },
    function (err) {
      actTemplateFetchPromise = null;
      throw err;
    }
  );
  return actTemplateFetchPromise;
}

function prefetchActTemplate() {
  return fetchActTemplateBytes().catch(function () {
    return null;
  });
}

function getCachedActTemplateBytes() {
  return cachedActTemplateBytes;
}

function bytesToBase64(bytes) {
  var arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  var binary = '';
  var chunk = 0x8000;
  for (var i = 0; i < arr.length; i += chunk) {
    binary += String.fromCharCode.apply(null, arr.subarray(i, i + chunk));
  }
  return btoa(binary);
}

var DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

function isAndroidCapacitor() {
  try {
    var C = typeof window !== 'undefined' ? window.Capacitor : null;
    if (!C) return false;
    var native = typeof C.isNativePlatform === 'function' ? C.isNativePlatform() : false;
    var plat = typeof C.getPlatform === 'function' ? C.getPlatform() : '';
    return !!(native && plat === 'android');
  } catch (e) {
    return false;
  }
}

function getAppFilePlugin() {
  if (appFilePlugin) return Promise.resolve(appFilePlugin);
  if (appFilePluginPromise) return appFilePluginPromise;
  if (!isAndroidCapacitor()) return Promise.resolve(null);
  appFilePluginPromise = import('@capacitor/core')
    .then(function (core) {
      appFilePlugin = core.registerPlugin('AppFile', {
        web: {
          saveFile: function () {
            return Promise.reject(new Error('web'));
          },
          shareFile: function () {
            return Promise.reject(new Error('web'));
          }
        }
      });
      return appFilePlugin;
    })
    .catch(function () {
      appFilePluginPromise = null;
      return null;
    });
  return appFilePluginPromise;
}

if (typeof window !== 'undefined') {
  getAppFilePlugin();
  prefetchActTemplate();
}

function fallbackDownload(bytes, filename) {
  var blob = new Blob([bytes], { type: DOCX_MIME });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(function () {
    try {
      URL.revokeObjectURL(url);
    } catch (e) {}
  }, 2000);
}

function shareViaWebApi(bytes, filename) {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') {
    return null;
  }
  try {
    var file = new File([bytes], filename, { type: DOCX_MIME });
    var can = typeof navigator.canShare !== 'function' || navigator.canShare({ files: [file] });
    if (!can) return null;
    return navigator.share({
      title: filename,
      text: 'Акт об оказании услуг',
      files: [file]
    });
  } catch (e) {
    return null;
  }
}

function saveViaFilePicker(bytes, filename) {
  if (typeof window === 'undefined' || typeof window.showSaveFilePicker !== 'function') {
    return null;
  }
  return window
    .showSaveFilePicker({
      suggestedName: filename,
      types: [
        {
          description: 'Word',
          accept: { [DOCX_MIME]: ['.docx'] }
        }
      ]
    })
    .then(function (handle) {
      return handle.createWritable();
    })
    .then(function (writable) {
      return writable.write(new Blob([bytes], { type: DOCX_MIME })).then(function () {
        return writable.close();
      });
    })
    .then(function () {
      return { canceled: false };
    })
    .catch(function (err) {
      if (err && err.name === 'AbortError') return { canceled: true };
      throw err;
    });
}

function downloadActDocx(bytes, filename) {
  var name = ensureDocxFilename(filename || 'акт.docx');
  if (typeof window !== 'undefined' && window.electronAPI && typeof window.electronAPI.saveBytesDialog === 'function') {
    return window.electronAPI
      .saveBytesDialog({
        filename: name,
        mime: DOCX_MIME,
        data: bytesToBase64(bytes)
      })
      .then(function (res) {
        if (res && res.canceled) return { canceled: true };
        if (res && res.ok === false) throw new Error(res.error || 'Не удалось сохранить');
        return { canceled: false };
      });
  }
  if (appFilePlugin && typeof appFilePlugin.saveFile === 'function') {
    return appFilePlugin
      .saveFile({ filename: name, mime: DOCX_MIME, data: bytesToBase64(bytes) })
      .then(function (res) {
        return { canceled: !!(res && res.canceled) };
      });
  }
  var picker = saveViaFilePicker(bytes, name);
  if (picker) return picker;
  var shared = shareViaWebApi(bytes, name);
  if (shared) {
    return shared.then(function () {
      return { canceled: false };
    }).catch(function (err) {
      if (err && err.name === 'AbortError') return { canceled: true };
      fallbackDownload(bytes, name);
      return { canceled: false };
    });
  }
  fallbackDownload(bytes, name);
  return Promise.resolve({ canceled: false });
}

function shareActDocx(bytes, filename) {
  var name = ensureDocxFilename(filename || 'акт.docx');
  if (appFilePlugin && typeof appFilePlugin.shareFile === 'function') {
    return appFilePlugin.shareFile({ filename: name, mime: DOCX_MIME, data: bytesToBase64(bytes) });
  }
  var shared = shareViaWebApi(bytes, name);
  if (shared) return shared;
  if (typeof showToast === 'function') {
    showToast('Не удалось открыть MAX. Сохраните файл и отправьте вручную.', 'error', 5000);
  }
  return Promise.reject(new Error('share unavailable'));
}

export {
  escapeXml,
  MIN_SERVICE_ROWS,
  padServiceRows,
  fillServiceTable,
  fillActDocumentXml,
  fillIndexedRow,
  collectActFormData,
  actFilename,
  ensureDocxFilename,
  buildActDocx,
  fetchActTemplateBytes,
  downloadActDocx,
  shareActDocx,
  prefetchActTemplate,
  getCachedActTemplateBytes
};
