/**
 * Модуль для работы с осеменением
 * Функции: автоматический расчёт попытки, добавление данных осеменения
 */

// Глобальная переменная для хранения записей (предполагается, что она уже объявлена)
// let entries = []; // Удалено: уже объявлено в storage.js

/**
 * Возвращает номер попытки осеменения для коровы в текущей лактации.
 * inseminationHistory сбрасывается при отёле, поэтому содержит только осеменения текущей лактации.
 * @param {string} cattleId - номер коровы
 * @param {number} [currentLactation] - не используется (оставлен для совместимости вызовов)
 * @returns {number} - следующий номер попытки
 */
function getInseminationAttempt(cattleId, currentLactation) {
  var list = (typeof window !== 'undefined' && window.entries) ? window.entries : (typeof entries !== 'undefined' ? entries : []);
  if (!Array.isArray(list)) return 1;
  var entry = list.find(function (e) { return e.cattleId === cattleId; });
  if (!entry || !Array.isArray(entry.inseminationHistory)) return 1;
  return entry.inseminationHistory.length + 1;
}

/**
 * Автоматически заполняет номер попытки при выборе номера коровы и даты осеменения
 */
function autoFillAttempt() {
  const cattleId = document.getElementById('cattleId')?.value.trim();
  const lactation = parseInt(document.getElementById('lactation')?.value) || 1;
  const inseminationDate = document.getElementById('inseminationDate')?.value;

  if (cattleId && inseminationDate) {
    const attempt = getInseminationAttempt(cattleId, lactation);
    document.getElementById('attemptNumber').value = attempt;
  }
}

// Добавляем слушатели для автоматического заполнения попытки на основном экране
if (document.getElementById('cattleId') && document.getElementById('inseminationDate')) {
  document.getElementById('cattleId').addEventListener('change', autoFillAttempt);
  document.getElementById('inseminationDate').addEventListener('change', autoFillAttempt);
}

/**
 * Заполняет список коров для автодополнения
 */
function populateCattleAutocomplete(inputId, listId) {
  const input = document.getElementById(inputId);
  const listEl = document.getElementById(listId);
  if (!input || !listEl) return;

  // Очищаем список
  listEl.innerHTML = '';

  const filter = input.value.toLowerCase();
  const entriesList = (typeof window !== 'undefined' && window.entries) ? window.entries : entries;
  const matchingEntries = (Array.isArray(entriesList) ? entriesList : []).filter(function (entry) {
    var id = entry.cattleId != null ? String(entry.cattleId).toLowerCase() : '';
    return id.indexOf(filter) !== -1 || (entry.nickname && String(entry.nickname).toLowerCase().indexOf(filter) !== -1);
  }).slice(0, 10);

  matchingEntries.forEach(entry => {
    const li = document.createElement('li');
    li.textContent = `${entry.cattleId} (${entry.nickname || '—'})`;
    li.dataset.value = entry.cattleId;
    li.addEventListener('click', () => {
      input.value = entry.cattleId;
      listEl.innerHTML = '';
      // Синхронизируем со скрытым селектором
      const select = document.getElementById('cattleIdInsem');
      if (select) {
        select.value = entry.cattleId;
      }
      // Вызываем авто-заполнение попытки напрямую
      autoFillInseminationAttempt();
    });
    listEl.appendChild(li);
  });
}

/**
 * Legacy: автодополнение для старых id cattleIdInsemInput (если разметка ещё есть).
 * Не вешает глобальный document.click — иначе накапливаются слушатели и ломается фокус в Electron.
 */
function initCattleAutocomplete() {
  const input = document.getElementById('cattleIdInsemInput');
  if (!input) return;
  input.removeEventListener('input', input._legacyInsemPopulate);
  input._legacyInsemPopulate = function () {
    populateCattleAutocomplete('cattleIdInsemInput', 'cattleIdInsemList');
  };
  input.addEventListener('input', input._legacyInsemPopulate);
}

// Заменяем populateCattleSelect на использование автодополнения
function populateCattleSelect() {
  // Теперь используем автодополнение, оставляем для обратной совместимости
  initCattleAutocomplete();
}

/**
 * Автоматически заполняет номер попытки на экране ввода осеменения
 */
function autoFillInseminationAttempt() {
  // Пробуем получить ID из обоих полей (input и select)
  const cattleIdInput = document.getElementById('cattleIdInsemInput');
  const cattleIdSelect = document.getElementById('cattleIdInsem');
  const cattleId = (cattleIdInput?.value.trim() || cattleIdSelect?.value.trim()) || '';
  const inseminationDate = document.getElementById('inseminationDateInsem')?.value;

  if (cattleId && inseminationDate) {
    const list2 = (typeof window !== 'undefined' && window.entries) ? window.entries : entries;
    const entry = Array.isArray(list2) ? list2.find(e => e.cattleId === cattleId) : null;
    const lactation = entry?.lactation || 1;
    
    const attempt = getInseminationAttempt(cattleId, lactation);
    const attemptField = document.getElementById('attemptNumberInsem');
    if (attemptField) {
      attemptField.value = attempt;
    }
  }
}

/**
 * Инициализирует слушатели событий для автоматического заполнения попытки
 * Вызывается при открытии экрана осеменения
 */
function initInseminationAttemptListeners() {
  const cattleIdInput = document.getElementById('cattleIdInsemInput');
  const cattleIdSelect = document.getElementById('cattleIdInsem');
  const inseminationDateField = document.getElementById('inseminationDateInsem');
  
  // Удаляем старые слушатели, если они есть
  if (cattleIdInput) {
    cattleIdInput.removeEventListener('input', autoFillInseminationAttempt);
    cattleIdInput.removeEventListener('change', autoFillInseminationAttempt);
    cattleIdInput.addEventListener('input', autoFillInseminationAttempt);
    cattleIdInput.addEventListener('change', autoFillInseminationAttempt);
  }
  
  if (cattleIdSelect) {
    cattleIdSelect.removeEventListener('change', autoFillInseminationAttempt);
    cattleIdSelect.addEventListener('change', autoFillInseminationAttempt);
  }
  
  if (inseminationDateField) {
    inseminationDateField.removeEventListener('change', autoFillInseminationAttempt);
    inseminationDateField.addEventListener('change', autoFillInseminationAttempt);
  }
}

// Инициализация слушателей при загрузке (если есть legacy-поля)
if (document.getElementById('cattleIdInsemInput') || document.getElementById('cattleIdInsem')) {
  initInseminationAttemptListeners();
}

/**
 * Применяет осеменение к записи (без saveLocally / API).
 */
function applyInseminationToEntry(entry, data) {
  if (!entry) throw new Error('Нет записи');
  var inseminationDate = data.inseminationDate;
  var attemptNumber = parseInt(data.attemptNumber, 10) || 1;
  var bull = data.bull || '';
  var inseminator = data.inseminator || '';
  var code = data.code || '';
  if (!entry.inseminationHistory) entry.inseminationHistory = [];
  entry.inseminationHistory.push({
    date: inseminationDate,
    attemptNumber: attemptNumber,
    bull: bull,
    inseminator: inseminator,
    code: code
  });
  entry.inseminationDate = inseminationDate;
  entry.attemptNumber = attemptNumber;
  entry.bull = bull;
  entry.inseminator = inseminator;
  entry.code = code;
  entry.status = 'Осеменена';
  entry.synced = false;
  var detailsStr = (inseminationDate ? 'Дата: ' + inseminationDate : '') + (attemptNumber ? ', попытка: ' + attemptNumber : '') + (bull ? ', бык: ' + bull : '') + (inseminator ? ', осеменатор: ' + inseminator : '') + (code ? ', код: ' + code : '');
  var _pushHist = typeof pushActionHistory === 'function' ? pushActionHistory : window.pushActionHistory;
  if (typeof _pushHist === 'function') _pushHist(entry, 'Осеменение', detailsStr, { eventType: 'Осеменение', attemptNumber: attemptNumber, bull: bull, inseminator: inseminator, code: code });
}

/**
 * Добавляет запись осеменения для существующей коровы
 */
function addInseminationEntry() {
  // Пробуем получить ID из обоих полей (для совместимости)
  const cattleIdInput = document.getElementById('cattleIdInsemInput');
  const cattleIdSelect = document.getElementById('cattleIdInsem');
  const cattleId = (cattleIdInput?.value.trim() || cattleIdSelect?.value.trim()) || '';
  const inseminationDate = document.getElementById('inseminationDateInsem')?.value;

  if (!cattleId) {
    if (typeof showToast === 'function') showToast('Заполните номер коровы!', 'error'); else alert('Заполните номер коровы!');
    return;
  }

  // Ищем корову в списке записей
  const list2 = (typeof window !== 'undefined' && window.entries) ? window.entries : entries;
  const entry = Array.isArray(list2) ? list2.find(e => e.cattleId === cattleId) : null;
  
  if (!entry) {
    if (typeof showToast === 'function') showToast('Корова с таким номером не найдена!', 'error'); else alert('Корова с таким номером не найдена!');
    return;
  }

  if (inseminationDate && typeof validateDateNotFuture === 'function') {
    var err = validateDateNotFuture(inseminationDate, 'Дата осеменения');
    if (err) {
      if (typeof showToast === 'function') showToast(err && err.message ? err.message : err, 'error'); else alert(err);
      return;
    }
  }

  const attemptNumber = parseInt(document.getElementById('attemptNumberInsem')?.value) || 1;
  const bull = document.getElementById('bullInsemBatch')?.value || document.getElementById('bullInsem')?.value || '';
  const inseminator = document.getElementById('inseminatorInsem')?.value || '';
  const codeEl = document.getElementById('codeInsem');
  const code = codeEl ? (codeEl.tagName === 'SELECT' ? codeEl.value : (codeEl.value || '')) : '';

  try {
    applyInseminationToEntry(entry, { inseminationDate: inseminationDate, attemptNumber: attemptNumber, bull: bull, inseminator: inseminator, code: code });
  } catch (e) {
    if (typeof showToast === 'function') showToast(e && e.message ? e.message : 'Ошибка', 'error'); else alert(e && e.message ? e.message : 'Ошибка');
    return;
  }

  // Сохраняем изменения
  try {
    saveLocally();
  } catch (error) {
    console.error('Ошибка сохранения:', error);
  }
  
  try {
    updateList(); // Обновляем список на экране добавления
  } catch (error) {
    console.error('Ошибка обновления списка:', error);
  }
  
  if (typeof updateViewList === 'function') {
    try {
      updateViewList(); // Обновляем список на экране просмотра
    } catch (error) {
      console.error('Ошибка обновления списка просмотра:', error);
    }
  }

  // Очищаем форму
  if (cattleIdInput) cattleIdInput.value = '';
  if (cattleIdSelect) cattleIdSelect.value = '';
  document.getElementById('inseminationDateInsem').value = '';
  const attInsem = document.getElementById('attemptNumberInsem');
  if (attInsem) attInsem.value = '1';
  const bullB = document.getElementById('bullInsemBatch');
  if (bullB) bullB.value = '';
  const bullO = document.getElementById('bullInsem');
  if (bullO) bullO.value = '';
  document.getElementById('inseminatorInsem').value = '';
  const codeE = document.getElementById('codeInsem');
  if (codeE) {
    if (codeE.tagName === 'SELECT') codeE.selectedIndex = 0;
    else codeE.value = '';
  }

  if (typeof showToast === 'function') showToast('Данные осеменения добавлены!', 'success'); else alert('Данные осеменения добавлены!');
  if (typeof window !== 'undefined' && window._returnToViewCow) {
    if (typeof navigate === 'function') navigate('view-cow');
    if (typeof viewCow === 'function') viewCow(cattleId);
    window._returnToViewCow = null;
  } else if (typeof navigate === 'function') navigate('menu');
}

/**
 * Инициализация модуля осеменения
 */
/**
 * Инициализация экрана ввода осеменения при навигации. Заполняет номер коровы из _prefillCattleId.
 */
function initInseminationScreen() {
  if (typeof window.initActionBatchInseminationScreen === 'function') {
    window.initActionBatchInseminationScreen();
    return;
  }
  initCattleAutocomplete();
  initInseminationAttemptListeners();
  if (typeof window !== 'undefined' && window._prefillCattleId) {
    var el = document.getElementById('cattleIdInsemInput');
    if (el) { el.value = window._prefillCattleId; }
    var sel = document.getElementById('cattleIdInsem');
    if (sel) { sel.value = window._prefillCattleId; }
    delete window._prefillCattleId;
  }
  autoFillInseminationAttempt();
}

function initInseminationModule() {
  if (document.getElementById('add-screen')?.classList.contains('active')) {
    autoFillAttempt();
  }
  var inseminationScreen = document.getElementById('insemination-screen');
  if (!inseminationScreen?.classList.contains('active')) return;
  // Пакетный экран: та же логика, что при navigate (action-batch + setupCattleAutocompleteFor)
  if (document.getElementById('inseminationBatchAddInput')) {
    if (typeof window.initActionBatchInseminationScreen === 'function') {
      window.initActionBatchInseminationScreen();
    }
    return;
  }
  initCattleAutocomplete();
  initInseminationAttemptListeners();
  autoFillInseminationAttempt();
}

document.addEventListener('DOMContentLoaded', initInseminationModule);

// Экспортируем функции, если используется модульная система
if (typeof window !== 'undefined') {
  window.applyInseminationToEntry = applyInseminationToEntry;
  window.getInseminationAttempt = getInseminationAttempt;
  window.initInseminationScreen = initInseminationScreen;
  window.initInseminationAttemptListeners = initInseminationAttemptListeners;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getInseminationAttempt, addInseminationEntry, applyInseminationToEntry };
}
export {};
