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

function fillRowTemplate(tpl, row, index) {
  var xml = tpl;
  xml = replaceAll(xml, '{{rowNum}}', String(index + 1));
  xml = replaceAll(xml, '{{svcName}}', escapeXml((row && row.name) || ''));
  xml = replaceAll(xml, '{{svcUnit}}', escapeXml((row && row.unit) || ''));
  var qty = row && row.qty != null && String(row.qty).trim() !== '' ? String(row.qty).trim() : '';
  xml = replaceAll(xml, '{{svcQty}}', escapeXml(qty));
  var priceStr =
    row && row.price != null && String(row.price).trim() !== '' ? formatAmount(parseAmount(row.price)) : '';
  xml = replaceAll(xml, '{{svcPrice}}', escapeXml(priceStr));
  var sumVal = rowAmount(row);
  var sumStr = qty || priceStr ? formatAmount(sumVal) : '';
  xml = replaceAll(xml, '{{svcSum}}', escapeXml(sumStr));
  return xml;
}

function expandServiceRows(xml, rows) {
  var re = /<w:tr\b[^>]*>[\s\S]*?\{\{svcName\}\}[\s\S]*?<\/w:tr>/;
  var m = String(xml || '').match(re);
  if (!m) throw new Error('В шаблоне акта нет строки услуг');
  var list = rows && rows.length ? rows : [{ name: '', unit: '', qty: '', price: '' }];
  var built = list
    .map(function (row, i) {
      return fillRowTemplate(m[0], row, i);
    })
    .join('');
  return xml.replace(re, built);
}

function fillActDocumentXml(xml, data) {
  data = data || {};
  var rows = Array.isArray(data.rows) ? data.rows : [];
  var total = sumServiceRows(rows);
  var words = amountWithWords(total);
  var out = expandServiceRows(xml, rows);
  out = replaceAll(out, '{{actDate}}', escapeXml(data.actDate || ''));
  out = replaceAll(out, '{{executorFio}}', escapeXml(data.executorFio || ''));
  out = replaceAll(out, '{{customerFio}}', escapeXml(data.customerFio || ''));
  out = replaceAll(out, '{{totalWords}}', escapeXml(words.words));
  out = replaceAll(out, '{{total}}', escapeXml(words.digits));
  return out;
}

function collectActFormData(root, dateIso) {
  var executorEl = root && root.querySelector('#serviceActExecutorFio');
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
    customerFio: customerEl ? String(customerEl.value || '').trim() : '',
    rows: rows
  };
}

function actFilename(dateIso) {
  var d = String(dateIso || '').trim();
  var m = d.match(/^(\d{4})-(\d{2})-(\d{2})/);
  var stamp = m ? m[3] + '.' + m[2] + '.' + m[1] : d.replace(/[^\d.-]/g, '') || 'акт';
  return 'Акт об оказании услуг ' + stamp + '.docx';
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

function fetchActTemplateBytes() {
  function tryUrl(i) {
    if (i >= TEMPLATE_URLS.length) {
      return Promise.reject(new Error('Не найден шаблон акта'));
    }
    return fetch(TEMPLATE_URLS[i])
      .then(function (res) {
        if (!res || !res.ok) return tryUrl(i + 1);
        return res.arrayBuffer().then(function (buf) {
          return new Uint8Array(buf);
        });
      })
      .catch(function () {
        return tryUrl(i + 1);
      });
  }
  return tryUrl(0);
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

function getAppFilePlugin() {
  if (typeof window === 'undefined' || !window.Capacitor) return Promise.resolve(null);
  var C = window.Capacitor;
  var native =
    typeof C.isNativePlatform === 'function' &&
    C.isNativePlatform() &&
    typeof C.getPlatform === 'function' &&
    C.getPlatform() === 'android';
  if (!native) return Promise.resolve(null);
  return import('@capacitor/core').then(function (core) {
    return core.registerPlugin('AppFile', {
      web: {
        saveFile: function () {
          return Promise.reject(new Error('web'));
        },
        shareFile: function () {
          return Promise.reject(new Error('web'));
        }
      }
    });
  });
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

function downloadActDocx(bytes, filename) {
  var name = filename || 'акт.docx';
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
  return getAppFilePlugin().then(function (plugin) {
    if (plugin && typeof plugin.saveFile === 'function') {
      return plugin
        .saveFile({ filename: name, mime: DOCX_MIME, data: bytesToBase64(bytes) })
        .then(function (res) {
          return { canceled: !!(res && res.canceled) };
        });
    }
    if (typeof window !== 'undefined' && typeof window.showSaveFilePicker === 'function') {
      return window
        .showSaveFilePicker({
          suggestedName: name,
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
    fallbackDownload(bytes, name);
    return { canceled: false };
  });
}

function shareActDocx(bytes, filename) {
  var name = filename || 'акт.docx';
  return getAppFilePlugin().then(function (plugin) {
    if (plugin && typeof plugin.shareFile === 'function') {
      return plugin.shareFile({ filename: name, mime: DOCX_MIME, data: bytesToBase64(bytes) });
    }
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        var file = new File([bytes], name, { type: DOCX_MIME });
        var can = typeof navigator.canShare !== 'function' || navigator.canShare({ files: [file] });
        if (can) {
          return navigator.share({
            title: name,
            text: 'Акт об оказании услуг',
            files: [file]
          });
        }
      } catch (e) {}
    }
    if (typeof showToast === 'function') {
      showToast('Не удалось открыть MAX. Сохраните файл и отправьте вручную.', 'error', 5000);
    }
    return Promise.reject(new Error('share unavailable'));
  });
}

export {
  escapeXml,
  expandServiceRows,
  fillActDocumentXml,
  fillRowTemplate,
  collectActFormData,
  actFilename,
  buildActDocx,
  fetchActTemplateBytes,
  downloadActDocx,
  shareActDocx
};
