/**
 * Целые числа прописью (ru) и сумма строк акта.
 */

var UNITS_M = ['', 'один', 'два', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять'];
var UNITS_F = ['', 'одна', 'две', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять'];
var TEENS = [
  'десять',
  'одиннадцать',
  'двенадцать',
  'тринадцать',
  'четырнадцать',
  'пятнадцать',
  'шестнадцать',
  'семнадцать',
  'восемнадцать',
  'девятнадцать'
];
var TENS = [
  '',
  '',
  'двадцать',
  'тридцать',
  'сорок',
  'пятьдесят',
  'шестьдесят',
  'семьдесят',
  'восемьдесят',
  'девяносто'
];
var HUNDREDS = [
  '',
  'сто',
  'двести',
  'триста',
  'четыреста',
  'пятьсот',
  'шестьсот',
  'семьсот',
  'восемьсот',
  'девятьсот'
];

var MONTHS_GEN = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря'
];

function triad(n, feminine) {
  n = n % 1000;
  var parts = [];
  var h = Math.floor(n / 100);
  var t = Math.floor((n % 100) / 10);
  var u = n % 10;
  var units = feminine ? UNITS_F : UNITS_M;
  if (h) parts.push(HUNDREDS[h]);
  if (t === 1) {
    parts.push(TEENS[u]);
  } else {
    if (t) parts.push(TENS[t]);
    if (u) parts.push(units[u]);
  }
  return parts.join(' ');
}

function pluralRu(n, forms) {
  var n100 = Math.abs(n) % 100;
  var n10 = Math.abs(n) % 10;
  if (n100 >= 11 && n100 <= 14) return forms[2];
  if (n10 === 1) return forms[0];
  if (n10 >= 2 && n10 <= 4) return forms[1];
  return forms[2];
}

function numberToWordsRu(n) {
  n = Math.floor(Math.abs(Number(n) || 0));
  if (n === 0) return 'ноль';
  var parts = [];
  var millions = Math.floor(n / 1000000);
  var thousands = Math.floor((n % 1000000) / 1000);
  var rest = n % 1000;
  if (millions) {
    parts.push(triad(millions, false));
    parts.push(pluralRu(millions, ['миллион', 'миллиона', 'миллионов']));
  }
  if (thousands) {
    parts.push(triad(thousands, true));
    parts.push(pluralRu(thousands, ['тысяча', 'тысячи', 'тысяч']));
  }
  if (rest) parts.push(triad(rest, false));
  return parts.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
}

function rubleWord(n) {
  return pluralRu(Math.floor(Math.abs(Number(n) || 0)), ['рубль', 'рубля', 'рублей']);
}

function parseAmount(raw) {
  var s = String(raw == null ? '' : raw)
    .trim()
    .replace(/\s/g, '')
    .replace(',', '.');
  var n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

function formatAmount(n) {
  var v = Number(n);
  if (!Number.isFinite(v)) v = 0;
  if (Math.abs(v - Math.round(v)) < 1e-9) return String(Math.round(v));
  return v.toFixed(2).replace('.', ',');
}

function rowAmount(row) {
  var priceRaw = row && row.price;
  var hasPrice = priceRaw != null && String(priceRaw).trim() !== '';
  if (hasPrice) {
    return Math.round(parseAmount(row.qty) * parseAmount(priceRaw) * 100) / 100;
  }
  return parseAmount(row && row.sum);
}

function sumServiceRows(rows) {
  var sum = 0;
  (rows || []).forEach(function (row) {
    sum += rowAmount(row);
  });
  return Math.round(sum * 100) / 100;
}

function formatActHeaderDate(iso) {
  var s = String(iso || '').trim();
  var m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return s;
  var day = parseInt(m[3], 10);
  var month = parseInt(m[2], 10);
  var name = MONTHS_GEN[month - 1];
  if (!name) return s;
  return '«' + day + '» ' + name + ' ' + m[1];
}

function amountWithWords(n) {
  var rounded = Math.round(parseAmount(n));
  var words = numberToWordsRu(rounded);
  return {
    digits: formatAmount(rounded),
    words: words,
    rubleWord: rubleWord(rounded),
    display: formatAmount(rounded) + ' (' + words + ')'
  };
}

export {
  numberToWordsRu,
  rubleWord,
  parseAmount,
  formatAmount,
  sumServiceRows,
  rowAmount,
  formatActHeaderDate,
  amountWithWords,
  pluralRu
};
