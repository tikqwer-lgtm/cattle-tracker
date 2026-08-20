/** __protocols part 2 */
(function () {
  'use strict';
  var root = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this);
  var NS = root['__protocols'] = root['__protocols'] || {};
  var global = typeof window !== 'undefined' ? window : this;

function getCurrentStepsFromForm() {
  var steps = [];
  var container = document.getElementById('protocol-steps-container');
  if (!container) return steps;
  var rows = container.querySelectorAll('.protocol-step-row');
  for (var i = 0; i < rows.length; i++) {
    var dayInput = rows[i].querySelector('.step-day');
    var drugInput = rows[i].querySelector('.step-drug');
    steps.push({
      day: dayInput ? (parseInt(dayInput.value, 10) || 0) : 0,
      drug: drugInput ? drugInput.value.trim() : ''
    });
  }
  return steps;
}

function renderProtocolStepsList(steps) {
  var container = document.getElementById('protocol-steps-container');
  if (!container) return;
  if (!Array.isArray(steps)) steps = [];
  var html = '';
  for (var i = 0; i < steps.length; i++) {
    var s = steps[i];
    html += '<div class="protocol-step-row">';
    html += '<label class="step-label">День</label>';
    html += '<input type="number" class="step-day" value="' + (s.day || 0) + '" min="0" step="1" />';
    html += '<label class="step-label">Препарат</label>';
    html += '<input type="text" class="step-drug" list="datalist-farm-drugs" autocomplete="off" value="' + (s.drug || '').replace(/"/g, '&quot;').replace(/</g, '&lt;') + '" placeholder="Название инъекции" />';
    html += '<button type="button" class="small-btn remove-step-btn" aria-label="Удалить этап">✕</button>';
    html += '</div>';
  }
  container.innerHTML = html;
  container.querySelectorAll('.remove-step-btn').forEach(function (btn, index) {
    btn.onclick = function () {
      var steps = getCurrentStepsFromForm();
      steps.splice(index, 1);
      renderProtocolStepsList(steps);
    };
  });
}
/**
 * Имена протоколов для «Код осеменения»: кэш/API + localStorage без дубликатов.
 */
function collectProtocolNamesForInseminationCode() {
  var seen = Object.create(null);
  var out = [];
  function addList(arr) {
    if (!Array.isArray(arr)) return;
    arr.forEach(function (p) {
      var name = (p && (p.name || p.id)) ? String(p.name || p.id).trim() : '';
      if (!name || name === 'Охота' || name === 'Датчик' || seen[name]) return;
      seen[name] = true;
      out.push(name);
    });
  }
  addList(globalThis['__protocols'].getProtocols());
  addList(globalThis['__protocols'].getProtocolsFromLocalStorage());
  out.sort(function (a, b) { return a.localeCompare(b, 'ru'); });
  return out;
}

/**
 * Заполнение списков «Код осеменения» (пакетный экран и карточка коровы).
 * Живёт здесь, чтобы всегда использовать актуальный globalThis['__protocols'].getProtocols().
 */
function fillOneInseminationCodeSelect(sel, preserveValue) {
  if (!sel || sel.tagName !== 'SELECT') return;
  /* Не пересобирать скрытые селекты при фоновой загрузке — меньше лишних мутаций DOM и срывов фокуса в Electron. */
  if (preserveValue === undefined) {
    if (sel.id === 'codeInsem') {
      var insSc = document.getElementById('insemination-screen');
      if (insSc && !insSc.classList.contains('active') && document.activeElement !== sel) return;
    }
    if (sel.id === 'code') {
      var addSc = document.getElementById('add-screen');
      if (addSc && !addSc.classList.contains('active') && document.activeElement !== sel) return;
    }
  }
  var ae = document.activeElement;
  var current = preserveValue !== undefined ? preserveValue : sel.value;
  sel.innerHTML = '';
  var optEmpty = document.createElement('option');
  optEmpty.value = '';
  optEmpty.textContent = '—';
  sel.appendChild(optEmpty);
  function addOpt(val, label) {
    var o = document.createElement('option');
    o.value = val;
    o.textContent = label || val;
    sel.appendChild(o);
  }
  addOpt('Охота', 'Охота');
  addOpt('Датчик', 'Датчик');
  collectProtocolNamesForInseminationCode().forEach(function (name) {
    addOpt(name, name);
  });
  if (current && Array.prototype.some.call(sel.options, function (o) { return o.value === current; })) {
    sel.value = current;
  }
  if (ae && ae !== sel && ae.isConnected && typeof ae.focus === 'function') {
    var el = ae;
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        if (!el || !el.isConnected) return;
        try {
          el.focus({ preventScroll: true });
        } catch (e) {
          try {
            el.focus();
          } catch (e2) {}
        }
      });
    });
  }
}

function fillAllInseminationCodeSelects() {
  fillOneInseminationCodeSelect(document.getElementById('codeInsem'));
  fillOneInseminationCodeSelect(document.getElementById('code'));
}

var _quickProtocolTargetSelectId = 'codeInsem';

function canAddProtocolFromEvent() {
  if (typeof window.canInputServiceWorks === 'function') return window.canInputServiceWorks();
  return typeof window.hasCapability === 'function' && window.hasCapability('serviceWorksInput');
}

function syncQuickProtocolButtons() {
  var show = canAddProtocolFromEvent();
  ['addProtocolFromInsemBtn', 'addProtocolFromCowBtn'].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.style.display = show ? '' : 'none';
  });
}

function closeQuickProtocolModal() {
  var modal = document.getElementById('quickProtocolModal');
  if (!modal) return;
  modal.classList.remove('active');
  modal.setAttribute('aria-hidden', 'true');
}

function openQuickProtocolModal(selectId) {
  if (!canAddProtocolFromEvent()) return;
  _quickProtocolTargetSelectId = selectId || 'codeInsem';
  var modal = document.getElementById('quickProtocolModal');
  var input = document.getElementById('quickProtocolNameInput');
  if (!modal) return;
  if (input) input.value = '';
  modal.classList.add('active');
  modal.setAttribute('aria-hidden', 'false');
  if (input) {
    setTimeout(function () {
      try { input.focus(); } catch (e) {}
    }, 0);
  }
}

function submitQuickProtocol() {
  var input = document.getElementById('quickProtocolNameInput');
  var name = input ? String(input.value || '').trim() : '';
  if (!name) {
    if (typeof showToast === 'function') showToast('Введите название протокола', 'error');
    return;
  }
  var targetId = _quickProtocolTargetSelectId || 'codeInsem';
  var addFn = globalThis['__protocols'] && globalThis['__protocols'].addProtocol;
  if (typeof addFn !== 'function') {
    if (typeof showToast === 'function') showToast('Не удалось сохранить протокол', 'error');
    return;
  }
  var done = function () {
    var sel = document.getElementById(targetId);
    fillOneInseminationCodeSelect(sel, name);
    if (sel) sel.value = name;
    closeQuickProtocolModal();
    if (typeof showToast === 'function') showToast('Протокол добавлен', 'success');
  };
  var fail = function (err) {
    var msg = (err && err.message) ? err.message : 'Не удалось сохранить протокол';
    if (typeof showToast === 'function') showToast(msg, 'error');
  };
  var add = addFn({ name: name, steps: [] });
  if (add && typeof add.then === 'function') {
    add.then(done, fail);
  } else if (add) {
    done();
  } else {
    fail();
  }
}

function bindQuickProtocolUi() {
  syncQuickProtocolButtons();
  function bindOpen(btnId, selectId) {
    var btn = document.getElementById(btnId);
    if (!btn || btn.dataset.bound === '1') return;
    btn.dataset.bound = '1';
    btn.addEventListener('click', function () {
      openQuickProtocolModal(selectId);
    });
  }
  bindOpen('addProtocolFromInsemBtn', 'codeInsem');
  bindOpen('addProtocolFromCowBtn', 'code');
  var submitBtn = document.getElementById('quickProtocolSubmitBtn');
  var cancelBtn = document.getElementById('quickProtocolCancelBtn');
  var closeBtn = document.getElementById('quickProtocolCloseBtn');
  var modal = document.getElementById('quickProtocolModal');
  var nameInp = document.getElementById('quickProtocolNameInput');
  if (submitBtn && submitBtn.dataset.bound !== '1') {
    submitBtn.dataset.bound = '1';
    submitBtn.addEventListener('click', submitQuickProtocol);
  }
  function onCancel() {
    closeQuickProtocolModal();
  }
  if (cancelBtn && cancelBtn.dataset.bound !== '1') {
    cancelBtn.dataset.bound = '1';
    cancelBtn.addEventListener('click', onCancel);
  }
  if (closeBtn && closeBtn.dataset.bound !== '1') {
    closeBtn.dataset.bound = '1';
    closeBtn.addEventListener('click', onCancel);
  }
  if (modal && modal.dataset.overlayBound !== '1') {
    modal.dataset.overlayBound = '1';
    modal.addEventListener('click', function (e) {
      if (e.target === modal) closeQuickProtocolModal();
    });
  }
  if (nameInp && nameInp.dataset.enterBound !== '1') {
    nameInp.dataset.enterBound = '1';
    nameInp.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        submitQuickProtocol();
      }
    });
  }
  if (!document.documentElement.dataset.quickProtocolNavBound) {
    document.documentElement.dataset.quickProtocolNavBound = '1';
    document.addEventListener('cattle-tracker:navigate', syncQuickProtocolButtons);
  }
}

  // register functions
  NS.getCurrentStepsFromForm = getCurrentStepsFromForm;
  NS.renderProtocolStepsList = renderProtocolStepsList;
  NS.collectProtocolNamesForInseminationCode = collectProtocolNamesForInseminationCode;
  NS.fillOneInseminationCodeSelect = fillOneInseminationCodeSelect;
  NS.fillAllInseminationCodeSelects = fillAllInseminationCodeSelects;
  NS.bindQuickProtocolUi = bindQuickProtocolUi;
  NS.syncQuickProtocolButtons = syncQuickProtocolButtons;
  NS.openQuickProtocolModal = openQuickProtocolModal;
})();
export {};
