/**
 * Подстановка полей акта в шаблон Word и выдача файла.
 */
import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate';
import {
  amountWithWords,
  formatActHeaderDate,
  formatAmount,
  parseAmount,
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
  var sumStr = row && row.sum != null && String(row.sum).trim() !== '' ? formatAmount(parseAmount(row.sum)) : '';
  xml = replaceAll(xml, '{{svcSum}}', escapeXml(sumStr));
  return xml;
}

function expandServiceRows(xml, rows) {
  var re = /<w:tr\b[^>]*>[\s\S]*?\{\{svcName\}\}[\s\S]*?<\/w:tr>/;
  var m = String(xml || '').match(re);
  if (!m) throw new Error('В шаблоне акта нет строки услуг');
  var list = rows && rows.length ? rows : [{ name: '', unit: '', qty: '', sum: '' }];
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
    var sum = ((tr.querySelector('[data-act-field="sum"]') || {}).value || '').trim();
    if (!name && !unit && !qty && !sum) return;
    rows.push({ name: name, unit: unit, qty: qty, sum: sum });
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

function downloadActDocx(bytes, filename) {
  var blob = new Blob([bytes], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  });
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

function shareActDocx(bytes, filename) {
  var blob = new Blob([bytes], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  });
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      var file = new File([blob], filename, { type: blob.type });
      var can = typeof navigator.canShare !== 'function' || navigator.canShare({ files: [file] });
      if (can) {
        return navigator.share({
          title: filename,
          text: 'Акт об оказании услуг',
          files: [file]
        });
      }
    } catch (e) {}
  }
  downloadActDocx(bytes, filename);
  if (typeof showToast === 'function') {
    showToast('Файл сохранён. Откройте его в MAX', 'success');
  }
  return Promise.resolve('downloaded');
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
