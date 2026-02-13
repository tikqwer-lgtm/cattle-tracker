/**
 * URL веб-приложения Google Apps Script для отправки данных.
 * Должен указывать на опубликованное веб-приложение.
 * @type {string}
 */
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxttaNc8sgtxgs8ndljPkssoJPyCjZPShh3-_6VecJ0O5EYSePn43Kl1EzAvwO0ds61/exec';

/**
 * URL CSV-экспорта Google Таблицы для загрузки данных.
 * @type {string}
 */
const GOOGLE_SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRKfT0qrSp0kFLg2VWfHHln2cN1S7syVtotWLQRSp_XJDHq7UDUPd91Ra3XHoXOjgMy6774jC_5VAEO/pub?output=csv';

/**
 * Флаг, предотвращающий параллельный запуск отправки неотправленных записей.
 * @type {boolean}
 */
let isSendingUnsynced = false;

/**
 * Отправляет запись в Google Таблицу.
 * @async
 * @param {Object} entry - Данные об осеменении.
 * @param {string} entry.cattleId - Номер коровы.
 * @param {string} entry.date - Дата осеменения.
 * @param {string} [entry.bull] - Бык.
 * @param {string|number} [entry.attempt] - Попытка.
 * @param {string} [entry.synchronization] - Схема СИНХ.
 * @param {string} [entry.note] - Примечание.
 * @param {string} entry.dateAdded - Дата добавления записи.
 * @param {boolean} entry.synced - Флаг синхронизации.
 */
async function saveToGoogle(entry) {
  try {
    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify(entry)
    });

    const text = await response.text();
    if (response.ok && text.includes('OK')) {
      const index = entries.findIndex(e => 
        e.cattleId === entry.cattleId && 
        e.date === entry.date && 
        e.dateAdded === entry.dateAdded
      );
      if (index !== -1) {
        entries[index].synced = true;
        saveLocally();
        updateList();
        document.getElementById('status').textContent = '✅ Отправлено в облако';
        setTimeout(() => document.getElementById('status').textContent = '', 3000);
      }
    } else {
      throw new Error('Ошибка ответа: ' + text);
    }
  } catch (error) {
    console.error('❌ Ошибка отправки:', error);
    document.getElementById('status').textContent = '⚠️ Не удалось отправить';
    setTimeout(() => document.getElementById('status').textContent = '', 5000);
  }
}

/**
 * Загружает данные из Google Таблицы и синхронизирует с локальными записями.
 * Сохраняет: все записи из облака + локальные неотправленные (если их нет в облаке).
 * Удаляет локальные записи, удалённые в облаке.
 * @async
 */
async function loadFromGoogle() {
  const status = document.getElementById('status');
  status.textContent = '🔄 Синхронизация...';

  try {
    const response = await fetch(GOOGLE_SHEET_CSV_URL + '&t=' + Date.now(), {
      method: 'GET',
      mode: 'cors',
      cache: 'no-cache',
      headers: {
        'Content-Type': 'text/csv',
      },
      redirect: 'follow'
    });
    const text = await response.text();
    const lines = text.trim().split('\n');

    if (lines.length < 2) {
      status.textContent = '⚠️ Таблица пуста';
      setTimeout(() => status.textContent = '', 3000);
      entries = entries.filter(e => !e.synced); // оставляем только неотправленные
      if (typeof window !== 'undefined') window.entries = entries;
      saveLocally();
      updateList();
      return;
    }

    const delimiter = lines[0].includes(';') ? ';' : ',';
    const cloudEntries = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const row = line.split(delimiter).map(cell => cell.replace(/^"(.*)"$/, '$1').trim());
      if (row.length >= 6) {
        cloudEntries.push({
          cattleId: row[0] || '',
          date: row[1] || '',
          bull: row[2] || '',
          attempt: row[3] || '',
          synchronization: row[4] || '',
          note: row[5] || '',
          synced: true,
          dateAdded: nowFormatted()
        });
      }
    }

    const cloudKeys = new Set(cloudEntries.map(e => e.cattleId + '|' + e.date));
    const unsyncedNew = entries
      .filter(e => !e.synced)
      .filter(e => !cloudKeys.has(e.cattleId + '|' + e.date));

    entries = [...cloudEntries, ...unsyncedNew];
    if (typeof window !== 'undefined') window.entries = entries;
    saveLocally();
    updateList();

    status.textContent = `✅ Синхронизация: ${cloudEntries.length} из облака`;
    setTimeout(() => status.textContent = '', 5000);
  } catch (error) {
    console.error('❌ Ошибка синхронизации:', error);
    status.textContent = '❌ Не удалось синхронизировать';
    setTimeout(() => status.textContent = '', 5000);
  }
}


/**
 * Отправляет все неотправленные записи в Google Таблицу.
 * Защищает от повторного нажатия и дублирования.
 * Блокирует кнопку на время отправки.
 * @async
 */
async function sendUnsynced() {
  // Защита от повторного запуска
  if (isSendingUnsynced) {
    document.getElementById('status').textContent = '⏳ Уже идёт отправка...';
    setTimeout(() => document.getElementById('status').textContent = '', 2000);
    return;
  }

  const status = document.getElementById('status');
  const button = document.querySelector('button[onclick="sendUnsynced()"]');
  const unsynced = entries.filter(e => !e.synced);

  if (unsynced.length === 0) {
    status.textContent = '✅ Нет неотправленных';
    setTimeout(() => status.textContent = '', 3000);
    return;
  }

  // Блокируем кнопку
  isSendingUnsynced = true;
  button.disabled = true;
  button.style.opacity = '0.6';
  status.textContent = `Отправка ${unsynced.length}...`;

  let successCount = 0;

  try {
    for (const entry of unsynced) {
      try {
        const response = await fetch(GOOGLE_SCRIPT_URL, {
          method: 'POST',
          mode: 'cors',
          cache: 'no-cache',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(entry)
        });

        const text = await response.text();
        if (response.ok && text.includes('OK')) {
          const index = entries.findIndex(e => 
            e.cattleId === entry.cattleId && 
            e.date === entry.date && 
            e.dateAdded === entry.dateAdded
          );
          if (index !== -1) {
            entries[index].synced = true;
            successCount++;
          }
        }
      } catch (err) {
        console.error('Ошибка отправки:', err);
      }
    }

    saveLocally();
    updateList();
    status.textContent = `✅ Отправлено: ${successCount} из ${unsynced.length}`;
  } finally {
    // Всегда разблокируем
    isSendingUnsynced = false;
    button.disabled = false;
    button.style.opacity = '1';
    setTimeout(() => status.textContent = '', 5000);
  }
}

/**
 * Обновляет отображение списка записей.
 * Определена в app.js для доступности при инициализации.
 */

// --- Синхронизация с сервером API ---
function updateSyncServerStatus(message, isError) {
  var el = document.getElementById('syncServerStatus');
  if (!el) return;
  el.textContent = message || '';
  el.className = 'sync-server-status' + (isError ? ' sync-server-status-error' : '');
}

/**
 * Обновить данные с сервера (режим API). Вызывается кнопкой «Обновить с сервера» и при событии online.
 */
function refreshFromServer() {
  if (typeof window === 'undefined' || !window.CATTLE_TRACKER_USE_API || !window.CattleTrackerApi || typeof window.loadLocally !== 'function') {
    return Promise.resolve();
  }
  updateSyncServerStatus('Обновление…');
  return window.loadLocally().then(function () {
    updateSyncServerStatus('Подключено к серверу: ' + (window.CattleTrackerApi.getBaseUrl ? window.CattleTrackerApi.getBaseUrl() : ''));
    if (typeof updateList === 'function') updateList();
    if (typeof updateHerdStats === 'function') updateHerdStats();
    if (typeof updateViewList === 'function') updateViewList();
  }).catch(function (err) {
    var msg = (err && err.message) ? err.message : 'Ошибка подключения';
    updateSyncServerStatus('Ошибка: ' + msg, true);
  });
}

/**
 * Проверка доступности сервера (GET /api/health) и обновление статуса на экране синхронизации.
 */
function updateSyncServerStatusFromHealth() {
  if (typeof window === 'undefined' || !window.CATTLE_TRACKER_USE_API || !window.CattleTrackerApi) return;
  var base = window.CattleTrackerApi.getBaseUrl ? window.CattleTrackerApi.getBaseUrl() : '';
  if (!base) return;
  updateSyncServerStatus('Проверка…');
  fetch(base + '/api/health').then(function (res) {
    if (res.ok) {
      updateSyncServerStatus('Подключено к серверу: ' + base);
    } else {
      updateSyncServerStatus('Ошибка подключения (код ' + res.status + ')', true);
    }
  }).catch(function (err) {
    updateSyncServerStatus('Ошибка: ' + (err && err.message ? err.message : 'нет связи'), true);
  });
}

function formatServerDate(isoStr) {
  if (!isoStr) return '—';
  var d = new Date(isoStr);
  if (isNaN(d.getTime())) return isoStr;
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function renderSyncServerBasesList() {
  var container = document.getElementById('syncServerBasesList');
  if (!container || !window.CATTLE_TRACKER_USE_API || !window.CattleTrackerApi) return;
  container.innerHTML = '<p class="sync-loading">Загрузка списка…</p>';
  window.CattleTrackerApi.getObjectsList().then(function (list) {
    if (!list || !list.length) {
      container.innerHTML = '<p class="sync-empty">На сервере пока нет баз.</p>';
      return;
    }
    var html = '<table class="sync-bases-table"><thead><tr><th>Название</th><th>Дата создания</th><th>Действия</th></tr></thead><tbody>';
    list.forEach(function (obj) {
      var name = (obj.name || '').replace(/</g, '&lt;').replace(/"/g, '&quot;');
      var dateStr = formatServerDate(obj.created_at);
      html += '<tr><td>' + name + '</td><td>' + dateStr + '</td><td class="sync-bases-actions">';
      html += '<button type="button" class="small-btn" onclick="loadServerBaseIntoNewObject(\'' + String(obj.id).replace(/'/g, "\\'") + '\')">В новый объект</button> ';
      html += '<button type="button" class="small-btn" onclick="showReplaceBaseModal(\'' + String(obj.id).replace(/'/g, "\\'") + '\')">Заменить в существующем</button>';
      html += '</td></tr>';
    });
    html += '</tbody></table>';
    container.innerHTML = html;
  }).catch(function (err) {
    container.innerHTML = '<p class="sync-server-status-error">Ошибка загрузки списка: ' + (err && err.message ? err.message : '') + '</p>';
  });
}

function loadServerBaseIntoNewObject(sourceId) {
  if (!window.CATTLE_TRACKER_USE_API || !window.CattleTrackerApi) return;
  var name = prompt('Название нового объекта:', 'Копия базы');
  if (name === null || !String(name).trim()) return;
  name = String(name).trim();
  var statusEl = document.getElementById('syncServerStatus');
  if (statusEl) statusEl.textContent = 'Создание объекта и копирование записей…';
  window.CattleTrackerApi.createObject(name).then(function (newObj) {
    return window.CattleTrackerApi.loadEntries(sourceId).then(function (entries) {
      if (!entries || !entries.length) {
        if (statusEl) statusEl.textContent = 'Объект «' + name + '» создан (записей 0).';
        renderSyncServerBasesList();
        if (typeof window.loadLocally === 'function') window.loadLocally();
        return;
      }
      var i = 0;
      function next() {
        if (i >= entries.length) {
          if (statusEl) statusEl.textContent = 'Готово: объект «' + name + '», записей ' + entries.length + '.';
          renderSyncServerBasesList();
          if (typeof window.loadLocally === 'function') window.loadLocally();
          if (typeof window.updateObjectSwitcher === 'function') window.updateObjectSwitcher();
          return;
        }
        var entry = entries[i];
        window.CattleTrackerApi.createEntry(newObj.id, entry).then(function () { i++; next(); }).catch(function (err) {
          if (statusEl) statusEl.textContent = 'Ошибка: ' + (err && err.message ? err.message : ''); statusEl.className = 'sync-server-status sync-server-status-error';
        });
      }
      next();
    });
  }).catch(function (err) {
    if (statusEl) { statusEl.textContent = 'Ошибка: ' + (err && err.message ? err.message : ''); statusEl.className = 'sync-server-status sync-server-status-error'; }
  });
}

function showReplaceBaseModal(sourceId) {
  if (!window.CATTLE_TRACKER_USE_API || !window.CattleTrackerApi) return;
  window.CattleTrackerApi.getObjectsList().then(function (list) {
    var targets = list.filter(function (o) { return o.id !== sourceId; });
    if (!targets.length) { alert('Нет другого объекта для замены (нужна минимум ещё одна база).'); return; }
    var overlay = document.createElement('div');
    overlay.className = 'sync-replace-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-label', 'Выбор объекта для замены');
    var nameOpt = (list.filter(function (o) { return o.id === sourceId; })[0] || {}).name || sourceId;
    overlay.innerHTML = '<div class="sync-replace-modal">' +
      '<h4>Заменить данные в существующем объекте</h4>' +
      '<p>Источник: «' + String(nameOpt).replace(/</g, '&lt;') + '». Выберите объект, в котором заменить данные (текущие записи будут удалены):</p>' +
      '<select id="syncReplaceTargetSelect" class="sync-replace-select"></select>' +
      '<div class="sync-replace-actions">' +
      '<button type="button" class="small-btn" data-action="cancel">Отмена</button> ' +
      '<button type="button" class="action-btn" data-action="replace">Заменить</button>' +
      '</div></div>';
    var select = overlay.querySelector('#syncReplaceTargetSelect');
    targets.forEach(function (o) {
      var opt = document.createElement('option');
      opt.value = o.id;
      opt.textContent = o.name || o.id;
      select.appendChild(opt);
    });
    function close() {
      overlay.remove();
      document.body.style.overflow = '';
    }
    overlay.querySelector('[data-action="cancel"]').onclick = close;
    overlay.querySelector('[data-action="replace"]').onclick = function () {
      var targetId = select.value;
      if (!targetId) return;
      if (!confirm('Заменить все данные в выбранном объекте? Текущие записи будут удалены.')) return;
      close();
      replaceServerBaseInObject(sourceId, targetId);
    };
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
    document.body.style.overflow = 'hidden';
    document.body.appendChild(overlay);
  }).catch(function (err) { alert('Ошибка: ' + (err && err.message ? err.message : '')); });
}

function replaceServerBaseInObject(sourceId, targetId) {
  if (!window.CATTLE_TRACKER_USE_API || !window.CattleTrackerApi) return;
  var statusEl = document.getElementById('syncServerStatus');
  if (statusEl) statusEl.textContent = 'Загрузка и замена…';
  window.CattleTrackerApi.loadEntries(sourceId).then(function (sourceEntries) {
    return window.CattleTrackerApi.loadEntries(targetId).then(function (targetEntries) {
      var deleteNext = function (idx) {
        if (idx >= targetEntries.length) {
          var addNext = function (i) {
            if (i >= sourceEntries.length) {
              if (statusEl) statusEl.textContent = 'Готово: заменено записей ' + sourceEntries.length + '.';
              renderSyncServerBasesList();
              if (typeof window.loadLocally === 'function') window.loadLocally();
              return;
            }
            window.CattleTrackerApi.createEntry(targetId, sourceEntries[i]).then(function () { addNext(i + 1); }).catch(function (err) {
              if (statusEl) { statusEl.textContent = 'Ошибка: ' + (err && err.message ? err.message : ''); statusEl.className = 'sync-server-status sync-server-status-error'; }
            });
          };
          addNext(0);
          return;
        };
        window.CattleTrackerApi.deleteEntry(targetId, targetEntries[idx].cattleId).then(function () { deleteNext(idx + 1); }).catch(function (err) {
          if (statusEl) { statusEl.textContent = 'Ошибка удаления: ' + (err && err.message ? err.message : ''); statusEl.className = 'sync-server-status sync-server-status-error'; }
        });
      };
      deleteNext(0);
    });
  }).catch(function (err) {
    if (statusEl) { statusEl.textContent = 'Ошибка: ' + (err && err.message ? err.message : ''); statusEl.className = 'sync-server-status sync-server-status-error'; }
  });
}

function initSyncServerBlock() {
  var block = document.getElementById('sync-server-block');
  if (!block) return;
  var useApi = typeof window !== 'undefined' && window.CATTLE_TRACKER_USE_API && window.CattleTrackerApi;
  block.style.display = useApi ? '' : 'none';
  if (useApi) {
    updateSyncServerStatusFromHealth();
    renderSyncServerBasesList();
  }
}

if (typeof window !== 'undefined') {
  window.refreshFromServer = refreshFromServer;
  window.updateSyncServerStatusFromHealth = updateSyncServerStatusFromHealth;
  window.initSyncServerBlock = initSyncServerBlock;
  window.renderSyncServerBasesList = renderSyncServerBasesList;
  window.loadServerBaseIntoNewObject = loadServerBaseIntoNewObject;
  window.showReplaceBaseModal = showReplaceBaseModal;
  window.replaceServerBaseInObject = replaceServerBaseInObject;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSyncServerBlock);
  } else {
    initSyncServerBlock();
  }
}
