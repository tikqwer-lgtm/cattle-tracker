/** __viewCow part 1 */
(function () {
  'use strict';
  var root = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this);
  var NS = root['__viewCow'] = root['__viewCow'] || {};
  var global = typeof window !== 'undefined' ? window : this;

function escapeHtmlCard(text) {
  if (text === undefined || text === null) return '—';
  var s = String(text);
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatStallLine(entry) {
  if (!entry) return '—';
  var y = entry.stallYard != null && String(entry.stallYard).trim() !== '' ? String(entry.stallYard).trim() : '';
  var r = entry.stallRow;
  var p = entry.stallPlace;
  var rOk = r !== '' && r != null && !isNaN(parseInt(r, 10));
  var pOk = p !== '' && p != null && !isNaN(parseInt(p, 10));
  if (!y && !rOk && !pOk) return '—';
  var parts = [];
  if (y) parts.push('двор ' + escapeHtmlCard(y));
  if (rOk) parts.push('ряд ' + escapeHtmlCard(r));
  if (pOk) parts.push('место ' + escapeHtmlCard(p));
  return parts.join(', ');
}

/**
 * ПДО — дней от отёла до первой даты осеменения
 * @param {Object} entry — запись животного
 * @returns {number|string} — количество дней или '—'
 */
function getPDO(entry) {
  if (!entry) return '—';
  var calvingDate = entry.calvingDate;
  if (!calvingDate) return '—';
  var firstInsemDate = null;
  if (entry.inseminationHistory && entry.inseminationHistory.length > 0) {
    var dates = entry.inseminationHistory.map(function (h) { return h.date; }).filter(Boolean);
    if (dates.length > 0) {
      firstInsemDate = dates.reduce(function (a, b) { return a < b ? a : b; });
    }
  }
  if (!firstInsemDate && entry.inseminationDate) firstInsemDate = entry.inseminationDate;
  if (!firstInsemDate) return '—';
  var d1 = new Date(calvingDate);
  var d2 = new Date(firstInsemDate);
  if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return '—';
  var diff = Math.round((d2 - d1) / (24 * 60 * 60 * 1000));
  return diff >= 0 ? diff : '—';
}

/**
 * Дни стельности: от последнего осеменения до сегодня (только при статусе «Стельная»).
 * @param {Object} entry — запись животного
 * @returns {number|null} — количество дней или null
 */
function getDaysPregnant(entry) {
  if (!entry) return null;
  var status = (entry.status || '').toString();
  if (status.indexOf('Стельная') === -1) return null;
  var lastInsemDate = null;
  if (entry.inseminationHistory && entry.inseminationHistory.length > 0) {
    var dates = entry.inseminationHistory.map(function (h) { return h.date; }).filter(Boolean);
    if (dates.length > 0) {
      lastInsemDate = dates.reduce(function (a, b) { return a > b ? a : b; });
    }
  }
  if (!lastInsemDate && entry.inseminationDate) lastInsemDate = entry.inseminationDate;
  if (!lastInsemDate) return null;
  var d = new Date(lastInsemDate);
  var today = new Date();
  if (isNaN(d.getTime())) return null;
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  var diff = Math.round((today - d) / (24 * 60 * 60 * 1000));
  return diff >= 0 ? diff : null;
}

/**
 * Дни лактации: от даты отёла до сегодня.
 * @param {Object} entry — запись животного
 * @returns {number|null} — количество дней или null
 */
function getDaysInLactation(entry) {
  if (!entry || !entry.calvingDate) return null;
  var d = new Date(entry.calvingDate);
  var today = new Date();
  if (isNaN(d.getTime())) return null;
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  var diff = Math.round((today - d) / (24 * 60 * 60 * 1000));
  return diff >= 0 ? diff : null;
}

/**
 * Дней от последнего осеменения до сегодня (без фильтра по статусу).
 */
function getDaysSinceLastInsemination(entry) {
  if (!entry) return null;
  var lastInsemDate = null;
  if (entry.inseminationHistory && entry.inseminationHistory.length > 0) {
    var dates = entry.inseminationHistory.map(function (h) { return h.date; }).filter(Boolean);
    if (dates.length > 0) {
      lastInsemDate = dates.reduce(function (a, b) { return a > b ? a : b; });
    }
  }
  if (!lastInsemDate && entry.inseminationDate) lastInsemDate = entry.inseminationDate;
  if (!lastInsemDate) return null;
  var d = new Date(lastInsemDate);
  var today = new Date();
  if (isNaN(d.getTime())) return null;
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  var diff = Math.round((today - d) / (24 * 60 * 60 * 1000));
  return diff >= 0 ? diff : null;
}

/**
 * Парсит строку даты в timestamp (мс) для расчёта интервалов. Поддерживает YYYY-MM-DD, DD.MM.YYYY, DD.MM.YY.
 * @param {string} dateStr
 * @returns {number} timestamp или NaN
 */
function parseInseminationDateToTime(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return NaN;
  var s = dateStr.trim();
  if (!s) return NaN;
  var d = new Date(s);
  if (!isNaN(d.getTime())) return d.getTime();
  var dmY = s.match(/^(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})$/);
  if (dmY) {
    d = new Date(parseInt(dmY[3], 10), parseInt(dmY[2], 10) - 1, parseInt(dmY[1], 10));
    return isNaN(d.getTime()) ? NaN : d.getTime();
  }
  var dmYy = s.match(/^(\d{1,2})[.\/](\d{1,2})[.\/](\d{2})$/);
  if (dmYy) {
    var yy = parseInt(dmYy[3], 10);
    var year = yy <= 30 ? 2000 + yy : 1900 + yy;
    d = new Date(year, parseInt(dmYy[2], 10) - 1, parseInt(dmYy[1], 10));
    return isNaN(d.getTime()) ? NaN : d.getTime();
  }
  return NaN;
}

/**
 * Определяет номер лактации для осеменения.
 * Если у животного задана лактация (0, 1, 2, …) — возвращаем её. Иначе: по дате отёла до/после = 1 или 2.
 */
function getInseminationLactation(insemDate, calvingDate, entryLactation) {
  var lact = entryLactation !== undefined && entryLactation !== null && entryLactation !== '' ? parseInt(entryLactation, 10) : null;
  if (lact !== null && !isNaN(lact) && lact >= 0) return lact;
  if (!calvingDate || !insemDate) return 1;
  var tInsem = parseInseminationDateToTime(insemDate);
  var tCalv = parseInseminationDateToTime(calvingDate);
  if (isNaN(tInsem) || isNaN(tCalv)) return 1;
  return tInsem < tCalv ? 1 : 2;
}

/**
 * Строит список осеменений для одной записи (отсортированный по дате), с полем daysFromPrevious и lactation.
 * Интервал «дней от предыдущего» считается только внутри одной лактации.
 */
function getInseminationListForEntry(entry) {
  var list = [];
  if (entry.inseminationHistory && entry.inseminationHistory.length > 0) {
    list = entry.inseminationHistory.slice();
  } else if (entry.inseminationDate) {
    list = [{
      date: entry.inseminationDate,
      attemptNumber: entry.attemptNumber ?? 1,
      bull: entry.bull || '',
      inseminator: entry.inseminator || '',
      code: entry.code || ''
    }];
  }
  var hist = entry.actionHistory || [];
  for (var hi = 0; hi < hist.length; hi++) {
    var item = hist[hi];
    if (!item) continue;
    var eventType = (item.eventType || item.action || '').toString();
    if (eventType !== 'Осеменение') continue;
    var rawDt = (item.dateTime || '').toString().trim();
    var dateStr = rawDt.length >= 10 ? rawDt.slice(0, 10) : rawDt;
    if (!dateStr) continue;
    var dup = false;
    for (var di = 0; di < list.length; di++) {
      var ta = parseInseminationDateToTime(list[di].date);
      var tb = parseInseminationDateToTime(dateStr);
      if (!isNaN(ta) && !isNaN(tb) && ta === tb) {
        dup = true;
        break;
      }
    }
    if (dup) continue;
    list.push({
      date: dateStr,
      attemptNumber: item.attemptNumber !== undefined && item.attemptNumber !== null ? item.attemptNumber : '',
      bull: item.bull || '',
      inseminator: item.inseminator || '',
      code: item.code || ''
    });
  }
  list.sort(function (a, b) {
    var ta = parseInseminationDateToTime(a.date);
    var tb = parseInseminationDateToTime(b.date);
    if (isNaN(ta) && isNaN(tb)) return 0;
    if (isNaN(ta)) return 1;
    if (isNaN(tb)) return -1;
    return ta < tb ? -1 : ta > tb ? 1 : 0;
  });
  var calvingDate = entry.calvingDate || '';
  for (var i = 0; i < list.length; i++) {
    list[i].lactation = getInseminationLactation(list[i].date, calvingDate, entry.lactation);
    if (i === 0) {
      list[i].daysFromPrevious = '—';
    } else {
      if (list[i].lactation !== list[i - 1].lactation) {
        list[i].daysFromPrevious = '—';
      } else {
        var prevTime = parseInseminationDateToTime(list[i - 1].date);
        var currTime = parseInseminationDateToTime(list[i].date);
        if (!isNaN(prevTime) && !isNaN(currTime)) {
          list[i].daysFromPrevious = Math.round((currTime - prevTime) / (24 * 60 * 60 * 1000));
        } else {
          list[i].daysFromPrevious = '—';
        }
      }
    }
  }
  return list;
}

/**
 * Просмотр полной карточки животного
 */
function viewCow(cattleId) {
  const entry = entries.find(e => e.cattleId === cattleId);
  if (!entry) {
    console.warn('Животное не найдено:', cattleId);
    return;
  }

  if (typeof window !== 'undefined') {
    var menu = globalThis['__menu'];
    var current =
      menu && typeof menu.getCurrentScreenId === 'function' ? menu.getCurrentScreenId() : null;
    if (!window._viewCowReturnTo && current && current !== 'view-cow') {
      window._viewCowReturnTo = current;
    }
  }

  // Перейти на экран просмотра карточки (с cattleId для роутинга)
  navigate('view-cow', { cattleId: cattleId });

  // Заполнить карточку
  const card = document.getElementById('viewCowCard');
  if (!card) return;

  var pdoVal = getPDO(entry);
  var pdoStr = (pdoVal === '—' || pdoVal === '') ? '—' : String(pdoVal);
  var daysPreg = getDaysPregnant(entry);
  var daysPregStr = (daysPreg === null || daysPreg === undefined) ? '—' : String(daysPreg);
  var daysInLact = getDaysInLactation(entry);
  var daysInLactStr = (daysInLact === null || daysInLact === undefined) ? '—' : String(daysInLact);

  var insemList = getInseminationListForEntry(entry);
  var historyRows = insemList.map(function (row) {
    return (
      '<tr><td>' + (formatDate(row.date) || '—') + '</td><td>' + escapeHtmlCard(row.attemptNumber) + '</td><td>' + escapeHtmlCard(row.bull) + '</td><td>' + escapeHtmlCard(row.inseminator) + '</td><td>' + (row.daysFromPrevious !== undefined ? escapeHtmlCard(row.daysFromPrevious) : '—') + '</td><td>' + escapeHtmlCard(row.code) + '</td></tr>'
    );
  }).join('');
  var historyTableHtml = insemList.length > 0
    ? '<table class="cow-insemination-table"><thead><tr><th>Дата осеменения</th><th>Попытка</th><th>Бык</th><th>Техник ИО</th><th>Дней от предыдущего</th><th>Код</th></tr></thead><tbody>' + historyRows + '</tbody></table>'
    : '<p class="cow-insemination-empty">Нет данных об осеменениях.</p>';

  var rawId = (entry.cattleId || '');
  var safeCattleId = rawId.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;');
  var canMutate = typeof canEdit !== 'function' || canEdit();
  var actionRow = canMutate
    ? '<button type="button" onclick="editEntry(\'' + safeCattleId + '\');" class="small-btn" aria-label="Редактировать">✏️ Редактировать</button> ' +
      '<button type="button" onclick="window._prefillCattleId=\'' + safeCattleId + '\'; window._returnToViewCow=\'' + safeCattleId + '\'; navigate(\'dry\');" class="small-btn" aria-label="Запуск в сухостой">🐄 Запуск</button> ' +
      '<button type="button" onclick="window._prefillCattleId=\'' + safeCattleId + '\'; window._returnToViewCow=\'' + safeCattleId + '\'; navigate(\'calving\');" class="small-btn" aria-label="Отел">🐄 Отел</button> ' +
      '<button type="button" onclick="window._prefillCattleId=\'' + safeCattleId + '\'; window._returnToViewCow=\'' + safeCattleId + '\'; navigate(\'protocol-assign\');" class="small-btn" aria-label="На протокол">📋 На протокол</button> ' +
      '<button type="button" onclick="window._prefillCattleId=\'' + safeCattleId + '\'; window._returnToViewCow=\'' + safeCattleId + '\'; navigate(\'insemination\');" class="small-btn" aria-label="Осеменение">💉 Осеменение</button> ' +
      '<button type="button" onclick="window._prefillCattleId=\'' + safeCattleId + '\'; window._returnToViewCow=\'' + safeCattleId + '\'; navigate(\'uzi\');" class="small-btn" aria-label="УЗИ">🩺 УЗИ</button> '
    : '';
  actionRow +=
    '<button type="button" onclick="openViewCowActionHistory(\'' + safeCattleId + '\');" class="small-btn" aria-label="История действий">📜 История</button> ' +
    '<button type="button" onclick="if(window.viewCowBack)window.viewCowBack()" class="small-btn cow-card-back" aria-label="Назад">← Назад</button>';

  card.innerHTML =
    '<div class="cow-card">' +
    '<h2>Карточка животного №' + escapeHtmlCard(entry.cattleId) + '</h2>' +
    '<div class="cow-details-grid">' +
    '<div><strong>Кличка:</strong> ' + escapeHtmlCard(entry.nickname) + '</div>' +
    '<div><strong>Группа:</strong> ' + escapeHtmlCard(entry.group || '') + '</div>' +
    '<div><strong>Дата рождения:</strong> ' + (formatDate(entry.birthDate) || '—') + '</div>' +
    '<div><strong>Лактация:</strong> ' + escapeHtmlCard(entry.lactation) + '</div>' +
    '<div><strong>Дата отёла:</strong> ' + (formatDate(entry.calvingDate) || '—') + '</div>' +
    '<div><strong>Дата осеменения:</strong> ' + (formatDate(entry.inseminationDate) || '—') + '</div>' +
    '<div class="cow-details-cell-with-button"><strong>Номер попытки:</strong> ' + escapeHtmlCard(entry.attemptNumber) + ' <button type="button" class="small-btn cow-insemination-toggle" onclick="toggleViewCowInseminationHistory()">Все осеменения</button></div>' +
    '<div><strong>Бык:</strong> ' + escapeHtmlCard(entry.bull) + '</div>' +
    '<div><strong>Техник ИО:</strong> ' + escapeHtmlCard(entry.inseminator) + '</div>' +
    '<div><strong>Код:</strong> ' + escapeHtmlCard(entry.code) + '</div>' +
    '<div><strong>Статус:</strong> ' + escapeHtmlCard(entry.status) + '</div>' +
    '<div><strong>Дата выбытия:</strong> ' + (formatDate(entry.exitDate) || '—') + '</div>' +
    '<div><strong>Начало сухостоя:</strong> ' + (formatDate(entry.dryStartDate) || '—') + '</div>' +
    '<div><strong>Дни лактации:</strong> ' + daysInLactStr + '</div>' +
    '<div><strong>ПДО:</strong> ' + pdoStr + '</div>' +
    '<div><strong>Дни стельности:</strong> ' + daysPregStr + '</div>' +
    '<div><strong>Протокол:</strong> ' + escapeHtmlCard((entry.protocol && entry.protocol.name) || entry.protocolName) + '</div>' +
    '<div><strong>Начало протокола:</strong> ' + (formatDate((entry.protocol && entry.protocol.startDate) || entry.protocolStartDate) || '—') + '</div>' +
    '<div><strong>Примечание:</strong> ' + escapeHtmlCard(entry.note) + '</div>' +
    '<div><strong>Стойломесто:</strong> ' + formatStallLine(entry) + '</div>' +
    (canMutate
      ? '<div class="cow-stall-edit"><strong>Изменить стойломесто</strong>' +
        '<div class="cow-stall-edit-grid">' +
        '<label>Двор<input type="text" id="viewCowStallYard" inputmode="numeric" autocomplete="off" /></label>' +
        '<label>Ряд<input type="number" id="viewCowStallRow" min="1" max="200" /></label>' +
        '<label>Место<input type="number" id="viewCowStallPlace" min="1" max="200" /></label>' +
        '</div>' +
        '<button type="button" class="small-btn" id="viewCowStallSaveBtn">Сохранить стойломесто</button></div>'
      : '') +
    '<div><strong>Синхронизация:</strong> ' + (entry.synced ? '<span style="color:#16a34a">✅ Синхронизировано</span>' : '<span style="color:#ca8a04">🟡 Не синхронизировано</span>') + '</div>' +
    '<div><strong>Дата добавления:</strong> ' + escapeHtmlCard(entry.dateAdded) + '</div>' +
    '<div><strong>Изменено пользователем:</strong> ' + escapeHtmlCard(entry.lastModifiedBy) + '</div>' +
    '</div>' +
    '<div id="viewCowInseminationHistory" class="cow-insemination-history" style="display:none;">' + historyTableHtml + '</div>' +
    '<div class="cow-card-actions">' + actionRow + '</div>' +
    '</div>';

  if (canMutate) {
    var yIn = document.getElementById('viewCowStallYard');
    var rIn = document.getElementById('viewCowStallRow');
    var pIn = document.getElementById('viewCowStallPlace');
    var saveStall = document.getElementById('viewCowStallSaveBtn');
    if (yIn) yIn.value = entry.stallYard != null && String(entry.stallYard).trim() !== '' ? String(entry.stallYard) : '';
    if (rIn) rIn.value = entry.stallRow !== '' && entry.stallRow != null ? String(entry.stallRow) : '';
    if (pIn) pIn.value = entry.stallPlace !== '' && entry.stallPlace != null ? String(entry.stallPlace) : '';
    if (saveStall && !saveStall.dataset.bound) {
      saveStall.dataset.bound = '1';
      saveStall.addEventListener('click', function () {
        globalThis['__viewCow'].viewCowSaveStallFromCard(entry.cattleId);
      });
    }
  }
}


  // register functions
  NS.escapeHtmlCard = escapeHtmlCard;
  NS.formatStallLine = formatStallLine;
  NS.getPDO = getPDO;
  NS.getDaysPregnant = getDaysPregnant;
  NS.getDaysInLactation = getDaysInLactation;
  NS.getDaysSinceLastInsemination = getDaysSinceLastInsemination;
  NS.parseInseminationDateToTime = parseInseminationDateToTime;
  NS.getInseminationLactation = getInseminationLactation;
  NS.getInseminationListForEntry = getInseminationListForEntry;
  NS.viewCow = viewCow;
})();
export {};
