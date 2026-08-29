/**
 * Журнал работ сервис-специалиста (задачи с числом голов и необязательной описью).
 * Не пишет в карточки животных.
 */
export const UZI_RESULT_LABELS = {
  pregnant: 'Ст',
  open: 'холостая',
  doubtful: 'сомнительная',
  left: 'выбыла'
};

export const UZI_RESULT_KEYS = ['pregnant', 'open', 'doubtful', 'left'];

export const PREG_CHECK_DAYS = 32;

const LS_PREFIX = 'cattleTracker_workTasks_';

export function usesServiceWorkTasksJournal() {
  if (typeof window === 'undefined') return false;
  if (typeof window.getUiRole === 'function' && window.getUiRole() === 'service') return true;
  if (typeof window.hasCapability === 'function') {
    return !!window.hasCapability('serviceWorksInput') && !window.hasCapability('eventsInput');
  }
  return false;
}

export function dateKey(raw) {
  var s = String(raw || '').trim();
  if (!s) return '';
  var iso = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return iso[1] + '-' + iso[2] + '-' + iso[3];
  var ru = s.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (ru) {
    return ru[3] + '-' + String(ru[2]).padStart(2, '0') + '-' + String(ru[1]).padStart(2, '0');
  }
  return s.slice(0, 10);
}

export function addDaysIso(workDate, days) {
  var k = dateKey(workDate);
  if (!k) return null;
  var p = k.split('-').map(Number);
  var d = new Date(p[0], p[1] - 1, p[2]);
  if (isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + (parseInt(days, 10) || 0));
  return (
    d.getFullYear() +
    '-' +
    String(d.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(d.getDate()).padStart(2, '0')
  );
}

export function checkDueDateFromWork(workDate) {
  return addDaysIso(workDate, PREG_CHECK_DAYS);
}

export function newWorkTaskId() {
  return 'wt_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

function normalizeAnimalRow(raw, type) {
  if (!raw || typeof raw !== 'object') return null;
  var row = {
    cattleId: raw.cattleId != null ? String(raw.cattleId).trim() : '',
    result: '',
    bull: '',
    attempt: null,
    protocol: '',
    remark: ''
  };
  if (type === 'uzi') {
    var r = String(raw.result || '').trim();
    if (UZI_RESULT_KEYS.indexOf(r) !== -1) row.result = r;
    else if (/^ст/i.test(r) || /pregnant/i.test(r) || /стельн/i.test(r)) row.result = 'pregnant';
    else if (/холод/i.test(r) || /open/i.test(r) || /ялов/i.test(r) || /не стельн/i.test(r)) row.result = 'open';
    else if (/сомн/i.test(r) || /doubt/i.test(r)) row.result = 'doubtful';
    else if (/выб/i.test(r) || /left/i.test(r)) row.result = 'left';
  } else {
    row.bull = raw.bull != null ? String(raw.bull).trim() : '';
    var att = raw.attempt;
    if (att != null && att !== '') {
      var n = parseInt(att, 10);
      row.attempt = isNaN(n) ? null : n;
    }
    row.protocol = raw.protocol != null ? String(raw.protocol).trim() : '';
    row.remark = raw.remark != null ? String(raw.remark).trim() : '';
  }
  return row;
}

export function normalizeWorkTask(raw) {
  if (!raw || typeof raw !== 'object') return null;
  var type = raw.type === 'uzi' ? 'uzi' : raw.type === 'insemination' ? 'insemination' : '';
  if (!type) return null;
  var workDate = dateKey(raw.workDate);
  if (!workDate) return null;
  var count = parseInt(raw.count, 10);
  if (isNaN(count) || count < 1) count = 1;
  var animals = Array.isArray(raw.animals)
    ? raw.animals.map(function (a) {
        return normalizeAnimalRow(a, type);
      }).filter(Boolean)
    : [];
  var checkDue =
    type === 'insemination'
      ? dateKey(raw.checkDueDate) || checkDueDateFromWork(workDate)
      : null;
  return {
    id: raw.id != null && String(raw.id).trim() ? String(raw.id).trim() : newWorkTaskId(),
    type: type,
    workDate: workDate,
    count: count,
    userName: raw.userName != null ? String(raw.userName).trim() : '',
    userId: raw.userId != null ? String(raw.userId).trim() : '',
    note: raw.note != null ? String(raw.note).trim() : '',
    animals: animals,
    checkDueDate: checkDue,
    checkClosedByTaskId:
      raw.checkClosedByTaskId != null && String(raw.checkClosedByTaskId).trim()
        ? String(raw.checkClosedByTaskId).trim()
        : null
  };
}

export function normalizeWorkTasksList(list) {
  if (!Array.isArray(list)) return [];
  return list.map(normalizeWorkTask).filter(Boolean);
}

function objectIdNow() {
  if (typeof window !== 'undefined' && typeof window.getCurrentObjectId === 'function') {
    return window.getCurrentObjectId() || 'default';
  }
  return 'default';
}

export function workTasksLsKey(objectId) {
  return LS_PREFIX + (objectId || 'default');
}

export function readWorkTasksLocal(objectId) {
  try {
    var raw = localStorage.getItem(workTasksLsKey(objectId || objectIdNow()));
    if (!raw) return [];
    return normalizeWorkTasksList(JSON.parse(raw));
  } catch (e) {
    return [];
  }
}

export function writeWorkTasksLocal(objectId, list) {
  try {
    localStorage.setItem(
      workTasksLsKey(objectId || objectIdNow()),
      JSON.stringify(normalizeWorkTasksList(list))
    );
    return true;
  } catch (e) {
    return false;
  }
}

export function getWorkTasksFromBundle(bundle) {
  if (!bundle || typeof bundle !== 'object') return [];
  return normalizeWorkTasksList(bundle.workTasks);
}

export function ensureWorkTasksOnBundle(bundle) {
  var b = bundle && typeof bundle === 'object' ? bundle : {};
  if (!Array.isArray(b.workTasks)) b.workTasks = [];
  else b.workTasks = normalizeWorkTasksList(b.workTasks);
  return b;
}

/**
 * Закрытие проверок на Ст задачей УЗИ.
 * По пересечению номеров; если у УЗИ нет номеров — пакетно закрыть открытые с due <= даты УЗИ.
 */
export function closePregChecksWithUziTask(tasks, uziTask) {
  var list = normalizeWorkTasksList(tasks);
  var uzi = normalizeWorkTask(uziTask);
  if (!uzi || uzi.type !== 'uzi') return list;
  var uziIds = {};
  (uzi.animals || []).forEach(function (a) {
    if (a && a.cattleId) uziIds[a.cattleId] = true;
  });
  var hasIds = Object.keys(uziIds).length > 0;
  return list.map(function (t) {
    if (t.type !== 'insemination' || t.checkClosedByTaskId) return t;
    if (!t.checkDueDate) return t;
    var close = false;
    if (hasIds) {
      close = (t.animals || []).some(function (a) {
        return a && a.cattleId && uziIds[a.cattleId];
      });
    } else if (t.checkDueDate <= uzi.workDate) {
      close = true;
    }
    if (!close) return t;
    return Object.assign({}, t, { checkClosedByTaskId: uzi.id });
  });
}

export function listOpenPregChecks(tasks, asOfDate) {
  var asOf = dateKey(asOfDate) || dateKey(new Date().toISOString());
  return normalizeWorkTasksList(tasks).filter(function (t) {
    if (t.type !== 'insemination' || !t.checkDueDate || t.checkClosedByTaskId) return false;
    return true;
  }).map(function (t) {
    return Object.assign({}, t, { due: t.checkDueDate <= asOf });
  });
}

function uziResultLabel(key) {
  return UZI_RESULT_LABELS[key] || key || '';
}

function insemDetailsFromAnimal(a) {
  var parts = [];
  if (a.bull) parts.push('бык ' + a.bull);
  if (a.attempt != null) parts.push('попытка ' + a.attempt);
  if (a.protocol) parts.push('протокол ' + a.protocol);
  if (a.remark) parts.push(a.remark);
  return parts.join(', ');
}

/**
 * Опись/строки отчёта из задач (не из карточек).
 */
export function collectServiceWorkItemsFromTasks(tasks, opts) {
  opts = opts || {};
  var date = dateKey(opts.date);
  var username = opts.username || '';
  var types = opts.types || { insemination: true, uzi: true, protocol: true };
  var out = [];
  normalizeWorkTasksList(tasks).forEach(function (t) {
    if (date && t.workDate !== date) return;
    if (username && String(t.userName || '').trim().toLowerCase() !== String(username).trim().toLowerCase()) {
      return;
    }
    if (t.type === 'insemination' && types.insemination) {
      if (t.animals && t.animals.length) {
        t.animals.forEach(function (a) {
          var details = insemDetailsFromAnimal(a);
          out.push({
            cattleId: a.cattleId || '',
            action: 'Осеменение',
            details: details,
            workDate: t.workDate,
            group: '',
            result: '',
            quantity: 1
          });
          if (types.protocol && a.protocol) {
            out.push({
              cattleId: a.cattleId || '',
              action: 'Протокол',
              details: a.protocol,
              workDate: t.workDate,
              group: '',
              result: '',
              quantity: 1
            });
          }
        });
      } else {
        out.push({
          cattleId: '',
          action: 'Осеменение',
          details: t.note || t.count + ' гол.',
          workDate: t.workDate,
          group: '',
          result: '',
          quantity: t.count
        });
      }
    } else if (t.type === 'uzi' && types.uzi) {
      if (t.animals && t.animals.length) {
        t.animals.forEach(function (a) {
          var label = uziResultLabel(a.result);
          out.push({
            cattleId: a.cattleId || '',
            action: 'УЗИ',
            details: label,
            workDate: t.workDate,
            group: '',
            result: label === 'Ст' ? 'Стельная' : label === 'холостая' ? 'Не стельная' : label === 'сомнительная' ? 'Сомнительная' : label,
            quantity: 1
          });
        });
      } else {
        out.push({
          cattleId: '',
          action: 'УЗИ',
          details: t.note || t.count + ' гол.',
          workDate: t.workDate,
          group: '',
          result: '',
          quantity: t.count
        });
      }
    }
  });
  return out;
}

export function sumTaskQuantities(items) {
  var n = 0;
  (items || []).forEach(function (it) {
    var q = it && it.quantity != null ? Number(it.quantity) : 1;
    if (!isNaN(q) && q > 0) n += q;
    else n += 1;
  });
  return n;
}

/**
 * Сохранить задачу в bundle + localStorage; закрыть проверки при УЗИ.
 */
export function appendWorkTaskToBundle(bundle, taskInput) {
  var b = ensureWorkTasksOnBundle(bundle || {});
  var task = normalizeWorkTask(taskInput);
  if (!task) return { ok: false, error: 'Некорректная задача', bundle: b };
  var list = b.workTasks.slice();
  if (task.type === 'uzi') {
    list = closePregChecksWithUziTask(list, task);
  }
  list.push(task);
  b.workTasks = list;
  return { ok: true, task: task, bundle: b };
}

if (typeof window !== 'undefined') {
  window.CattleTrackerWorkTasks = {
    usesServiceWorkTasksJournal: usesServiceWorkTasksJournal,
    normalizeWorkTask: normalizeWorkTask,
    normalizeWorkTasksList: normalizeWorkTasksList,
    addDaysIso: addDaysIso,
    checkDueDateFromWork: checkDueDateFromWork,
    getWorkTasksFromBundle: getWorkTasksFromBundle,
    ensureWorkTasksOnBundle: ensureWorkTasksOnBundle,
    readWorkTasksLocal: readWorkTasksLocal,
    writeWorkTasksLocal: writeWorkTasksLocal,
    appendWorkTaskToBundle: appendWorkTaskToBundle,
    closePregChecksWithUziTask: closePregChecksWithUziTask,
    listOpenPregChecks: listOpenPregChecks,
    collectServiceWorkItemsFromTasks: collectServiceWorkItemsFromTasks,
    sumTaskQuantities: sumTaskQuantities,
    UZI_RESULT_LABELS: UZI_RESULT_LABELS,
    PREG_CHECK_DAYS: PREG_CHECK_DAYS
  };
}
