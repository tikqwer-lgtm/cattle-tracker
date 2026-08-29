/** Patch notes: парсинг CHANGELOG.md и модал «Список изменений». */
import {
  parseChangelogMarkdown,
  mergeChangelogEntries
} from './changelog-parse.js';

(function (global) {
  'use strict';

  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function getApiBase() {
    var api = global.CattleTrackerApi;
    if (api && typeof api.getBaseUrl === 'function') {
      return (api.getBaseUrl() || '').trim().replace(/\/$/, '');
    }
    return '';
  }

  function fetchText(url) {
    return fetch(url, { cache: 'no-cache' })
      .then(function (res) {
        if (res.ok) return res.text();
        return '';
      })
      .catch(function () {
        return '';
      });
  }

  function renderChangelogHtml(entries) {
    if (!entries || !entries.length) {
      return '<p class="changelog-empty">Список изменений пока пуст.</p>';
    }
    var html = '';
    for (var i = 0; i < entries.length; i++) {
      var e = entries[i];
      html +=
        '<section class="changelog-version-block">' +
        '<h3 class="changelog-version-title">Версия ' +
        escapeHtml(e.version) +
        '</h3>' +
        '<p class="changelog-version-date">' +
        escapeHtml(e.date) +
        '</p>';
      for (var j = 0; j < (e.sections || []).length; j++) {
        var sec = e.sections[j];
        html += '<h4 class="changelog-section-title">' + escapeHtml(sec.title) + '</h4><ul class="changelog-list">';
        for (var k = 0; k < (sec.items || []).length; k++) {
          html += '<li>' + escapeHtml(sec.items[k]) + '</li>';
        }
        html += '</ul>';
      }
      html += '</section>';
    }
    return html;
  }

  function fetchChangelogMarkdown() {
    var localP = fetchText('CHANGELOG.md');
    var base = getApiBase();
    if (!base) return localP;
    return Promise.all([fetchText(base + '/api/mobile/changelog'), localP]).then(function (pair) {
      var serverText = pair[0];
      var localText = pair[1];
      var merged = mergeChangelogEntries(
        parseChangelogMarkdown(serverText),
        parseChangelogMarkdown(localText)
      );
      if (merged.length) return { entries: merged, markdown: serverText || localText };
      return { entries: [], markdown: serverText || localText || '' };
    });
  }

  function restoreModalFocus(focusBefore) {
    if (focusBefore && typeof focusBefore.focus === 'function') {
      try {
        focusBefore.focus();
      } catch (e) {}
    }
  }

  function showChangelogViewerModal() {
    var focusBefore = document.activeElement;
    var overlay = document.createElement('div');
    overlay.className = 'confirm-overlay changelog-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'changelog-viewer-title');
    overlay.innerHTML =
      '<div class="confirm-modal confirm-modal--wide changelog-viewer-modal">' +
      '<h2 id="changelog-viewer-title" class="changelog-viewer-heading">Список изменений</h2>' +
      '<div class="changelog-viewer-body" aria-live="polite"><p class="changelog-loading">Загрузка…</p></div>' +
      '<div class="confirm-modal-actions">' +
      '<button type="button" class="btn primary changelog-viewer-close">Закрыть</button>' +
      '</div></div>';

    var bodyEl = overlay.querySelector('.changelog-viewer-body');
    var btnClose = overlay.querySelector('.changelog-viewer-close');
    var closed = false;

    function close() {
      if (closed) return;
      closed = true;
      overlay.remove();
      restoreModalFocus(focusBefore);
    }

    btnClose.addEventListener('click', close);
    overlay.addEventListener('click', function (ev) {
      if (ev.target === overlay) close();
    });
    overlay.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') {
        ev.preventDefault();
        close();
      }
    });

    document.body.appendChild(overlay);
    btnClose.focus();

    return fetchChangelogMarkdown().then(function (result) {
      var entries;
      if (result && result.entries) entries = result.entries;
      else entries = parseChangelogMarkdown(typeof result === 'string' ? result : '');
      if (bodyEl) bodyEl.innerHTML = renderChangelogHtml(entries);
    });
  }

  var IMPROVEMENT_DRAFTS_KEY = 'cattleTracker_improvementDrafts';
  var IMPROVEMENT_DRAFTS_MAX = 30;

  function loadImprovementDrafts() {
    try {
      var raw = global.localStorage && global.localStorage.getItem(IMPROVEMENT_DRAFTS_KEY);
      var arr = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(arr)) return [];
      return arr
        .map(function (item) {
          if (typeof item === 'string') return { id: String(Date.now()), text: item };
          if (item && typeof item.text === 'string') {
            return { id: String(item.id || Date.now()), text: item.text };
          }
          return null;
        })
        .filter(function (item) {
          return item && String(item.text).trim();
        });
    } catch (e) {
      return [];
    }
  }

  function saveImprovementDrafts(list) {
    try {
      if (global.localStorage) {
        global.localStorage.setItem(IMPROVEMENT_DRAFTS_KEY, JSON.stringify(list || []));
      }
    } catch (e) {}
    if (typeof global.syncHeaderReloadButton === 'function') {
      global.syncHeaderReloadButton();
    }
  }

  function prependImprovementDraft(text) {
    var message = String(text || '').trim();
    if (!message) return;
    var drafts = loadImprovementDrafts();
    drafts.unshift({ id: 'rev-' + Date.now() + '-' + String(Math.random()).slice(2, 8), text: message });
    if (drafts.length > IMPROVEMENT_DRAFTS_MAX) drafts = drafts.slice(0, IMPROVEMENT_DRAFTS_MAX);
    saveImprovementDrafts(drafts);
  }

  function getImprovementDraftCount() {
    return loadImprovementDrafts().length;
  }

  function showImprovementSuggestionModal(appVersion) {
    var focusBefore = document.activeElement;
    var overlay = document.createElement('div');
    overlay.className = 'confirm-overlay app-version-suggestion-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'app-version-suggestion-title');
    overlay.innerHTML =
      '<div class="confirm-modal app-version-suggestion-modal">' +
      '<h2 id="app-version-suggestion-title" class="app-version-actions-title">Предложения</h2>' +
      '<p class="app-version-suggestion-hint">Можно набрать несколько сообщений и отправить их все сразу. Закрытие окна список не стирает.</p>' +
      '<ul class="app-version-suggestion-queue" aria-label="Накопленные сообщения"></ul>' +
      '<p class="app-version-suggestion-queue-empty">Пока нет сохранённых сообщений.</p>' +
      '<label class="app-version-suggestion-label" for="appVersionSuggestionText">Новое сообщение</label>' +
      '<textarea id="appVersionSuggestionText" class="app-version-suggestion-text" rows="5" maxlength="4000"></textarea>' +
      '<div class="confirm-modal-actions confirm-modal-actions--stack">' +
      '<button type="button" class="btn app-version-suggestion-add">Добавить в список</button>' +
      '<button type="button" class="btn primary app-version-suggestion-send">Отправить все</button>' +
      '<button type="button" class="small-btn app-version-suggestion-cancel">Закрыть</button>' +
      '</div></div>';

    var textEl = overlay.querySelector('#appVersionSuggestionText');
    var queueEl = overlay.querySelector('.app-version-suggestion-queue');
    var emptyEl = overlay.querySelector('.app-version-suggestion-queue-empty');
    var btnAdd = overlay.querySelector('.app-version-suggestion-add');
    var btnSend = overlay.querySelector('.app-version-suggestion-send');
    var btnCancel = overlay.querySelector('.app-version-suggestion-cancel');
    var closed = false;
    var drafts = loadImprovementDrafts();

    function suggestionKindForCurrentUser() {
      var u = typeof global.getCurrentUser === 'function' ? global.getCurrentUser() : null;
      if (u && typeof global.hasCapability === 'function' && global.hasCapability('adminReleaseControls', u)) {
        return 'improvement';
      }
      if (u && String(u.role || '').trim().toLowerCase() === 'admin') return 'improvement';
      return 'suggestion';
    }

    function close() {
      if (closed) return;
      closed = true;
      overlay.remove();
      restoreModalFocus(focusBefore);
    }

    function currentText() {
      return textEl && textEl.value ? String(textEl.value).trim() : '';
    }

    function pendingMessages() {
      var list = drafts.map(function (d) {
        return String(d.text || '').trim();
      }).filter(Boolean);
      var extra = currentText();
      if (extra) list.push(extra);
      return list;
    }

    function renderQueue() {
      if (!queueEl) return;
      queueEl.innerHTML = '';
      for (var i = 0; i < drafts.length; i++) {
        var item = drafts[i];
        var li = document.createElement('li');
        li.className = 'app-version-suggestion-queue-item';
        li.innerHTML =
          '<span class="app-version-suggestion-queue-text"></span>' +
          '<button type="button" class="small-btn app-version-suggestion-queue-remove">Удалить</button>';
        li.querySelector('.app-version-suggestion-queue-text').textContent = item.text;
        li.querySelector('.app-version-suggestion-queue-remove').setAttribute('data-id', item.id);
        queueEl.appendChild(li);
      }
      if (emptyEl) emptyEl.hidden = drafts.length > 0;
      if (btnSend) btnSend.disabled = pendingMessages().length === 0;
    }

    function addCurrentToQueue() {
      var message = currentText();
      if (!message) {
        if (typeof global.showToast === 'function') global.showToast('Введите текст', 'error');
        return;
      }
      if (drafts.length >= IMPROVEMENT_DRAFTS_MAX) {
        if (typeof global.showToast === 'function') {
          global.showToast('Сначала отправьте накопленные сообщения', 'error');
        }
        return;
      }
      drafts.push({ id: String(Date.now()) + '-' + String(Math.random()).slice(2, 8), text: message });
      saveImprovementDrafts(drafts);
      if (textEl) textEl.value = '';
      renderQueue();
      if (textEl) textEl.focus();
    }

    btnCancel.addEventListener('click', close);
    overlay.addEventListener('click', function (ev) {
      if (ev.target === overlay) close();
    });
    overlay.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') {
        ev.preventDefault();
        close();
      }
    });
    queueEl.addEventListener('click', function (ev) {
      var btn = ev.target && ev.target.closest ? ev.target.closest('.app-version-suggestion-queue-remove') : null;
      if (!btn) return;
      var id = btn.getAttribute('data-id');
      drafts = drafts.filter(function (d) {
        return d.id !== id;
      });
      saveImprovementDrafts(drafts);
      renderQueue();
    });
    btnAdd.addEventListener('click', addCurrentToQueue);
    if (textEl) {
      textEl.addEventListener('input', function () {
        if (btnSend) btnSend.disabled = pendingMessages().length === 0;
      });
    }

    btnSend.addEventListener('click', function () {
      var messages = pendingMessages();
      if (!messages.length) {
        if (typeof global.showToast === 'function') global.showToast('Введите текст', 'error');
        return;
      }
      var api = global.CattleTrackerApi;
      if (!api || typeof api.submitReport !== 'function') {
        if (typeof global.showToast === 'function') global.showToast('Нет связи с сервером', 'error');
        return;
      }
      btnSend.disabled = true;
      btnAdd.disabled = true;
      var kind = suggestionKindForCurrentUser();
      var sent = 0;
      var chain = Promise.resolve();
      messages.forEach(function (message, index) {
        chain = chain.then(function () {
          return api.submitReport(message, {
            kind: kind,
            appVersion: appVersion || '',
            batchIndex: index + 1,
            batchTotal: messages.length
          }).then(function () {
            sent += 1;
          });
        });
      });
      chain
        .then(function () {
          saveImprovementDrafts([]);
          close();
          if (typeof global.showToast === 'function') {
            var n = messages.length;
            var ok =
              kind === 'suggestion'
                ? n === 1
                  ? 'Отправлено администратору'
                  : 'Отправлено администратору: ' + n
                : n === 1
                  ? 'Предложение отправлено'
                  : 'Отправлено сообщений: ' + n;
            global.showToast(ok, 'success');
          }
        })
        .catch(function (err) {
          var leftover = messages.slice(sent);
          drafts = leftover.map(function (text, i) {
            return { id: 'left-' + i + '-' + Date.now(), text: text };
          });
          saveImprovementDrafts(drafts);
          if (textEl) textEl.value = '';
          renderQueue();
          btnSend.disabled = pendingMessages().length === 0;
          btnAdd.disabled = false;
          var msg = err && err.message ? String(err.message) : 'Не удалось отправить';
          if (sent > 0) msg = 'Отправлено ' + sent + ' из ' + messages.length + '. ' + msg;
          if (typeof global.showToast === 'function') global.showToast(msg, 'error', 5000);
        });
    });

    document.body.appendChild(overlay);
    renderQueue();
    if (textEl) textEl.focus();
  }

  function showAppVersionActionsModal(state, options) {
    options = options || {};
    var focusBefore = document.activeElement;
    var localVer = (state && state.localVer) || '—';
    var hasUpdate = !!(state && state.hasUpdate);
    var canUpdate =
      hasUpdate && typeof options.onUpdate === 'function' && options.canUpdate !== false;

    var overlay = document.createElement('div');
    overlay.className = 'confirm-overlay app-version-actions-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'app-version-actions-title');

    var titleText = 'Версия ' + escapeHtml(localVer);
    if (hasUpdate) titleText += ' — доступно обновление';

    overlay.innerHTML =
      '<div class="confirm-modal app-version-actions-modal">' +
      '<h2 id="app-version-actions-title" class="app-version-actions-title">' +
      titleText +
      '</h2>' +
      '<div class="confirm-modal-actions confirm-modal-actions--stack">' +
      '<button type="button" class="btn primary app-version-action-update"' +
      (canUpdate ? '' : ' disabled aria-disabled="true"') +
      '>Обновить</button>' +
      '<button type="button" class="btn app-version-action-changelog">Посмотреть список изменений</button>' +
      '<button type="button" class="small-btn app-version-action-cancel">Закрыть</button>' +
      '</div></div>';

    var btnUpdate = overlay.querySelector('.app-version-action-update');
    var btnChangelog = overlay.querySelector('.app-version-action-changelog');
    var btnCancel = overlay.querySelector('.app-version-action-cancel');
    var closed = false;

    function close() {
      if (closed) return;
      closed = true;
      overlay.remove();
      restoreModalFocus(focusBefore);
    }

    btnCancel.addEventListener('click', close);
    overlay.addEventListener('click', function (ev) {
      if (ev.target === overlay) close();
    });
    overlay.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') {
        ev.preventDefault();
        close();
      }
    });

    btnUpdate.addEventListener('click', function () {
      if (!canUpdate) return;
      close();
      options.onUpdate();
    });

    btnChangelog.addEventListener('click', function () {
      close();
      showChangelogViewerModal();
    });

    document.body.appendChild(overlay);
    (canUpdate ? btnUpdate : btnChangelog).focus();
  }

  global.parseChangelogMarkdown = parseChangelogMarkdown;
  global.mergeChangelogEntries = mergeChangelogEntries;
  global.fetchChangelogMarkdown = fetchChangelogMarkdown;
  global.showChangelogViewerModal = showChangelogViewerModal;
  global.showAppVersionActionsModal = showAppVersionActionsModal;
  global.showImprovementSuggestionModal = showImprovementSuggestionModal;
  global.getImprovementDraftCount = getImprovementDraftCount;
  global.prependImprovementDraft = prependImprovementDraft;
})(typeof window !== 'undefined' ? window : this);

export {};
