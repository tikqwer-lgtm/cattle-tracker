/**
 * UI журнала работ сервис-специалиста на экране «Список задач».
 */
import {
  usesServiceWorkTasksJournal,
  UZI_RESULT_LABELS,
  UZI_RESULT_KEYS,
  normalizeWorkTasksList,
  appendWorkTaskToBundle,
  checkDueDateFromWork,
  dateKey
} from './service-work-tasks.js';

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

function typeLabel(type) {
  return type === 'uzi' ? 'УЗИ' : 'Осеменение';
}

function formatAnimalsBrief(task) {
  var animals = task.animals || [];
  if (!animals.length) return escapeHtml(String(task.count)) + ' гол.';
  return animals
    .map(function (a) {
      var id = a.cattleId || '—';
      if (task.type === 'uzi') {
        return escapeHtml(id) + (a.result ? ' (' + escapeHtml(UZI_RESULT_LABELS[a.result] || a.result) + ')' : '');
      }
      var bits = [];
      if (a.bull) bits.push(a.bull);
      if (a.attempt != null) bits.push('п.' + a.attempt);
      return escapeHtml(id) + (bits.length ? ' (' + escapeHtml(bits.join(', ')) + ')' : '');
    })
    .join('; ');
}

function getCurrentUserMeta() {
  var u = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
  return {
    userName: (u && u.username) ? String(u.username) : '',
    userId: (u && u.id) ? String(u.id) : ''
  };
}

function loadBundleThen(cb) {
  var p =
    typeof window.ensureFarmCardLoaded === 'function'
      ? window.ensureFarmCardLoaded()
      : Promise.resolve(window.__farmCardBundle || { workTasks: [] });
  return p.then(function (b) {
    if (!window.__farmCardBundle) window.__farmCardBundle = b || { workTasks: [] };
    if (!Array.isArray(window.__farmCardBundle.workTasks)) {
      var local =
        typeof window.CattleTrackerWorkTasks !== 'undefined' &&
        typeof window.CattleTrackerWorkTasks.readWorkTasksLocal === 'function'
          ? window.CattleTrackerWorkTasks.readWorkTasksLocal()
          : [];
      window.__farmCardBundle.workTasks = local;
    }
    return cb(window.__farmCardBundle);
  });
}

function emitPregCheckNotification(task) {
  if (!task || task.type !== 'insemination' || !task.checkDueDate) return;
  if (typeof window.createNotification !== 'function') return;
  var due = task.checkDueDate <= todayIso();
  var msg =
    'Проверка на Ст: ' +
    task.count +
    ' гол. (осеменение ' +
    task.workDate +
    ', срок ' +
    task.checkDueDate +
    ')' +
    (due ? ' — ожидает результата' : '');
  window.createNotification(
    due ? 'warning' : 'info',
    msg,
    '',
    {
      kind: 'servicePregCheck',
      category: 'servicePregCheck',
      due: due,
      workTaskId: task.id,
      checkDueDate: task.checkDueDate,
      dedupeKey: 'servicePregCheck_' + task.id
    },
    { showToast: false, showSystem: false }
  );
}

function animalRowHtml(type, row) {
  row = row || {};
  if (type === 'uzi') {
    var opts = UZI_RESULT_KEYS.map(function (k) {
      return (
        '<option value="' +
        k +
        '"' +
        (row.result === k ? ' selected' : '') +
        '>' +
        escapeHtml(UZI_RESULT_LABELS[k]) +
        '</option>'
      );
    }).join('');
    return (
      '<tr class="swt-animal-row">' +
      '<td><input type="text" data-f="cattleId" value="' +
      escapeHtml(row.cattleId || '') +
      '" placeholder="№" /></td>' +
      '<td><select data-f="result"><option value="">—</option>' +
      opts +
      '</select></td>' +
      '<td><button type="button" class="small-btn swt-del-row">×</button></td>' +
      '</tr>'
    );
  }
  return (
    '<tr class="swt-animal-row">' +
    '<td><input type="text" data-f="cattleId" value="' +
    escapeHtml(row.cattleId || '') +
    '" placeholder="№" /></td>' +
    '<td><input type="text" data-f="bull" list="datalist-farm-bulls" value="' +
    escapeHtml(row.bull || '') +
    '" placeholder="Бык" /></td>' +
    '<td><input type="number" data-f="attempt" min="1" value="' +
    (row.attempt != null ? escapeHtml(String(row.attempt)) : '') +
    '" placeholder="Попытка" /></td>' +
    '<td><input type="text" data-f="protocol" value="' +
    escapeHtml(row.protocol || '') +
    '" placeholder="Протокол" /></td>' +
    '<td><input type="text" data-f="remark" value="' +
    escapeHtml(row.remark || '') +
    '" placeholder="Примечание" /></td>' +
    '<td><button type="button" class="small-btn swt-del-row">×</button></td>' +
    '</tr>'
  );
}

function formHtml(defaults) {
  defaults = defaults || {};
  var type = defaults.type || 'insemination';
  var date = defaults.workDate || todayIso();
  var count = defaults.count != null ? defaults.count : 1;
  var head =
    type === 'uzi'
      ? '<tr><th>Номер</th><th>Результат</th><th></th></tr>'
      : '<tr><th>Номер</th><th>Бык</th><th>Попытка</th><th>Протокол</th><th>Примечание</th><th></th></tr>';
  return (
    '<div class="swt-form" id="swtForm">' +
    '<h2 class="swt-form-title">Добавить работу</h2>' +
    '<label class="swt-field">Тип' +
    '<select id="swtType">' +
    '<option value="insemination"' +
    (type === 'insemination' ? ' selected' : '') +
    '>Осеменение</option>' +
    '<option value="uzi"' +
    (type === 'uzi' ? ' selected' : '') +
    '>УЗИ</option>' +
    '</select></label>' +
    '<label class="swt-field">Дата выполнения' +
    '<input type="date" id="swtDate" value="' +
    escapeHtml(date) +
    '" /></label>' +
    '<label class="swt-field">Количество голов' +
    '<input type="number" id="swtCount" min="1" step="1" value="' +
    escapeHtml(String(count)) +
    '" /></label>' +
    '<label class="swt-field">Примечание' +
    '<input type="text" id="swtNote" value="' +
    escapeHtml(defaults.note || '') +
    '" /></label>' +
    '<p class="farm-settings-hint">Опись животных необязательна. Можно указать только общее число.</p>' +
    '<div class="swt-animals-wrap">' +
    '<div class="list-actions list-actions-inline">' +
    '<button type="button" class="small-btn" id="swtAddRow">Добавить строку описи</button>' +
    '</div>' +
    '<div class="service-report-table-wrap"><table class="list-table swt-animals-table"><thead id="swtAnimalsHead">' +
    head +
    '</thead><tbody id="swtAnimalsBody"></tbody></table></div>' +
    '</div>' +
    '<div class="view-fields-actions">' +
    '<button type="button" class="action-btn" id="swtSave">Сохранить</button>' +
    '<button type="button" class="small-btn" id="swtCancel">Отмена</button>' +
    '</div></div>'
  );
}

function readAnimalsFromForm(root, type) {
  var rows = [];
  root.querySelectorAll('#swtAnimalsBody .swt-animal-row').forEach(function (tr) {
    var get = function (f) {
      var el = tr.querySelector('[data-f="' + f + '"]');
      return el ? el.value : '';
    };
    var cattleId = String(get('cattleId') || '').trim();
    if (type === 'uzi') {
      var result = String(get('result') || '').trim();
      if (!cattleId && !result) return;
      rows.push({ cattleId: cattleId, result: result });
    } else {
      var bull = String(get('bull') || '').trim();
      var attemptRaw = String(get('attempt') || '').trim();
      var protocol = String(get('protocol') || '').trim();
      var remark = String(get('remark') || '').trim();
      if (!cattleId && !bull && !attemptRaw && !protocol && !remark) return;
      rows.push({
        cattleId: cattleId,
        bull: bull,
        attempt: attemptRaw ? parseInt(attemptRaw, 10) : null,
        protocol: protocol,
        remark: remark
      });
    }
  });
  return rows;
}

function bindForm(containerEl, onDone) {
  var form = containerEl.querySelector('#swtForm');
  if (!form) return;

  function refreshHead() {
    var type = (containerEl.querySelector('#swtType') || {}).value || 'insemination';
    var head = containerEl.querySelector('#swtAnimalsHead');
    if (head) {
      head.innerHTML =
        type === 'uzi'
          ? '<tr><th>Номер</th><th>Результат</th><th></th></tr>'
          : '<tr><th>Номер</th><th>Бык</th><th>Попытка</th><th>Протокол</th><th>Примечание</th><th></th></tr>';
    }
    var body = containerEl.querySelector('#swtAnimalsBody');
    if (body) body.innerHTML = '';
  }

  var typeEl = containerEl.querySelector('#swtType');
  if (typeEl) typeEl.addEventListener('change', refreshHead);

  var addBtn = containerEl.querySelector('#swtAddRow');
  if (addBtn) {
    addBtn.addEventListener('click', function () {
      var type = (containerEl.querySelector('#swtType') || {}).value || 'insemination';
      var body = containerEl.querySelector('#swtAnimalsBody');
      if (!body) return;
      body.insertAdjacentHTML('beforeend', animalRowHtml(type, {}));
      var countEl = containerEl.querySelector('#swtCount');
      if (countEl) {
        var n = body.querySelectorAll('.swt-animal-row').length;
        if (n > parseInt(countEl.value, 10) || !countEl.value) countEl.value = String(n);
      }
    });
  }

  containerEl.addEventListener('click', function (e) {
    var t = e.target;
    if (t && t.classList && t.classList.contains('swt-del-row')) {
      var tr = t.closest('tr');
      if (tr) tr.remove();
    }
  });

  var cancel = containerEl.querySelector('#swtCancel');
  if (cancel) cancel.addEventListener('click', function () { onDone(false); });

  var save = containerEl.querySelector('#swtSave');
  if (save) {
    save.addEventListener('click', function () {
      var type = (containerEl.querySelector('#swtType') || {}).value || 'insemination';
      var workDate = dateKey((containerEl.querySelector('#swtDate') || {}).value);
      var count = parseInt((containerEl.querySelector('#swtCount') || {}).value, 10);
      var note = String((containerEl.querySelector('#swtNote') || {}).value || '').trim();
      if (!workDate) {
        if (typeof showToast === 'function') showToast('Укажите дату', 'error');
        return;
      }
      if (isNaN(count) || count < 1) {
        if (typeof showToast === 'function') showToast('Укажите количество голов', 'error');
        return;
      }
      var animals = readAnimalsFromForm(containerEl, type);
      if (animals.length && animals.length > count) count = animals.length;
      var meta = getCurrentUserMeta();
      var draft = {
        type: type,
        workDate: workDate,
        count: count,
        note: note,
        userName: meta.userName,
        userId: meta.userId,
        animals: animals,
        checkDueDate: type === 'insemination' ? checkDueDateFromWork(workDate) : null,
        checkClosedByTaskId: null
      };
      loadBundleThen(function (bundle) {
        var result = appendWorkTaskToBundle(bundle, draft);
        if (!result.ok) {
          if (typeof showToast === 'function') showToast(result.error || 'Ошибка', 'error');
          return Promise.resolve(false);
        }
        window.__farmCardBundle = result.bundle;
        var oid = typeof getCurrentObjectId === 'function' ? getCurrentObjectId() : 'default';
        if (window.CattleTrackerWorkTasks && window.CattleTrackerWorkTasks.writeWorkTasksLocal) {
          window.CattleTrackerWorkTasks.writeWorkTasksLocal(oid, result.bundle.workTasks);
        }
        var saveP =
          typeof window.saveFarmCardBundle === 'function'
            ? window.saveFarmCardBundle(window.__farmCardBundle)
            : Promise.resolve(window.__farmCardBundle);
        return saveP.then(function () {
          emitPregCheckNotification(result.task);
          if (typeof window.checkUpcomingEvents === 'function') {
            try { window.checkUpcomingEvents(); } catch (e) {}
          }
          if (typeof showToast === 'function') showToast('Работа сохранена', 'success');
          onDone(true);
          return true;
        });
      }).catch(function (err) {
        if (typeof showToast === 'function') showToast((err && err.message) || 'Ошибка сохранения', 'error');
      });
    });
  }
}

function monthBounds(year, month) {
  var from = year + '-' + String(month + 1).padStart(2, '0') + '-01';
  var last = new Date(year, month + 1, 0).getDate();
  var to = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(last).padStart(2, '0');
  return { from: from, to: to };
}

function formatMonthLabel(year, month) {
  try {
    return new Date(year, month, 1).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
  } catch (e) {
    return year + '-' + (month + 1);
  }
}

export function renderServiceWorkTasksJournal(containerEl, fromDate, toDate) {
  if (!containerEl) return;
  var today = new Date();
  if (containerEl._tasksYear == null) containerEl._tasksYear = today.getFullYear();
  if (containerEl._tasksMonth == null) containerEl._tasksMonth = today.getMonth();
  if (!fromDate && !toDate) {
    var b0 = monthBounds(containerEl._tasksYear, containerEl._tasksMonth);
    fromDate = b0.from;
    toDate = b0.to;
  }

  loadBundleThen(function (bundle) {
    var tasks = normalizeWorkTasksList(bundle.workTasks || []).filter(function (t) {
      if (fromDate && t.workDate < fromDate) return false;
      if (toDate && t.workDate > toDate) return false;
      return true;
    });
    tasks.sort(function (a, b) {
      return String(b.workDate).localeCompare(String(a.workDate)) || String(b.id).localeCompare(String(a.id));
    });

    var html = '<div class="tasks-list-block swt-journal">';
    html +=
      '<div class="month-nav tasks-month-nav">' +
      '<button type="button" class="small-btn" id="tasksMonthPrev" aria-label="Предыдущий месяц">‹</button>' +
      '<span id="tasksMonthLabel" class="month-nav-label"></span>' +
      '<button type="button" class="small-btn" id="tasksMonthNext" aria-label="Следующий месяц">›</button>' +
      '</div>';
    html +=
      '<div class="list-actions list-actions-inline">' +
      '<button type="button" class="action-btn" id="swtAddWorkBtn">Добавить работу</button>' +
      '</div>';
    html += '<div id="swtFormHost"></div>';
    if (!tasks.length) {
      html += '<p class="tasks-empty">Нет выполненных работ за выбранный период.</p>';
    } else {
      html += '<ul class="tasks-date-list swt-list">';
      tasks.forEach(function (t) {
        html +=
          '<li class="tasks-item swt-item" data-task-id="' +
          escapeHtml(t.id) +
          '">' +
          '<div class="swt-item-main"><strong>' +
          escapeHtml(typeLabel(t.type)) +
          '</strong> · ' +
          escapeHtml(t.workDate) +
          ' · ' +
          escapeHtml(String(t.count)) +
          ' гол.' +
          (t.userName ? ' · ' + escapeHtml(t.userName) : '') +
          '</div>' +
          '<div class="swt-item-sub">' +
          formatAnimalsBrief(t) +
          (t.type === 'insemination' && t.checkDueDate
            ? ' · проверка на Ст: ' +
              escapeHtml(t.checkDueDate) +
              (t.checkClosedByTaskId ? ' (закрыта)' : '')
            : '') +
          '</div></li>';
      });
      html += '</ul>';
    }
    html += '</div>';
    containerEl.innerHTML = html;
    var label = containerEl.querySelector('#tasksMonthLabel');
    if (label) label.textContent = formatMonthLabel(containerEl._tasksYear, containerEl._tasksMonth);

    function shift(delta) {
      var m = containerEl._tasksMonth + delta;
      var y = containerEl._tasksYear;
      if (m < 0) {
        m = 11;
        y -= 1;
      } else if (m > 11) {
        m = 0;
        y += 1;
      }
      containerEl._tasksYear = y;
      containerEl._tasksMonth = m;
      var b = monthBounds(y, m);
      renderServiceWorkTasksJournal(containerEl, b.from, b.to);
    }
    var prev = containerEl.querySelector('#tasksMonthPrev');
    var next = containerEl.querySelector('#tasksMonthNext');
    if (prev) prev.addEventListener('click', function () { shift(-1); });
    if (next) next.addEventListener('click', function () { shift(1); });

    var addWork = containerEl.querySelector('#swtAddWorkBtn');
    if (addWork) {
      addWork.addEventListener('click', function () {
        var host = containerEl.querySelector('#swtFormHost');
        if (!host) return;
        host.innerHTML = formHtml({ workDate: todayIso(), type: 'insemination', count: 1 });
        bindForm(containerEl, function (ok) {
          if (ok) {
            var b = monthBounds(containerEl._tasksYear, containerEl._tasksMonth);
            renderServiceWorkTasksJournal(containerEl, b.from, b.to);
          } else {
            host.innerHTML = '';
          }
        });
      });
    }
  });
}

if (typeof window !== 'undefined') {
  window.renderServiceWorkTasksJournal = renderServiceWorkTasksJournal;
  window.usesServiceWorkTasksJournal = usesServiceWorkTasksJournal;
}
