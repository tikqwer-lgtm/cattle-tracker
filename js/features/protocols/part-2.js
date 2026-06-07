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
  globalThis['__protocols'].addList(globalThis['__protocols'].getProtocols());
  globalThis['__protocols'].addList(globalThis['__protocols'].getProtocolsFromLocalStorage());
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
  if (sel.id === 'codeInsem') {
    var insSc = document.getElementById('insemination-screen');
    if (insSc && !insSc.classList.contains('active') && document.activeElement !== sel) return;
  }
  if (sel.id === 'code') {
    var addSc = document.getElementById('add-screen');
    if (addSc && !addSc.classList.contains('active') && document.activeElement !== sel) return;
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
  globalThis['__protocols'].addOpt('Охота', 'Охота');
  globalThis['__protocols'].addOpt('Датчик', 'Датчик');
  collectProtocolNamesForInseminationCode().forEach(function (name) {
    globalThis['__protocols'].addOpt(name, name);
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


  // register functions
  NS.getCurrentStepsFromForm = getCurrentStepsFromForm;
  NS.renderProtocolStepsList = renderProtocolStepsList;
  NS.collectProtocolNamesForInseminationCode = collectProtocolNamesForInseminationCode;
  NS.fillOneInseminationCodeSelect = fillOneInseminationCodeSelect;
  NS.fillAllInseminationCodeSelects = fillAllInseminationCodeSelects;
})();
export {};
