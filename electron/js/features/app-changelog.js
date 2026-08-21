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

  function isAppAdminUser() {
    if (typeof global.getCurrentUser !== 'function') return false;
    var u = global.getCurrentUser();
    if (!u) return false;
    if (typeof global.hasCapability === 'function' && global.hasCapability('adminReleaseControls', u)) {
      return true;
    }
    var role = String(u.role || '').trim().toLowerCase();
    return role === 'admin';
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
      '<h2 id="app-version-suggestion-title" class="app-version-actions-title">Предложение по улучшению</h2>' +
      '<label class="app-version-suggestion-label" for="appVersionSuggestionText">Текст</label>' +
      '<textarea id="appVersionSuggestionText" class="app-version-suggestion-text" rows="6" maxlength="4000"></textarea>' +
      '<div class="confirm-modal-actions confirm-modal-actions--stack">' +
      '<button type="button" class="btn primary app-version-suggestion-send">Отправить</button>' +
      '<button type="button" class="small-btn app-version-suggestion-cancel">Отмена</button>' +
      '</div></div>';

    var textEl = overlay.querySelector('#appVersionSuggestionText');
    var btnSend = overlay.querySelector('.app-version-suggestion-send');
    var btnCancel = overlay.querySelector('.app-version-suggestion-cancel');
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

    btnSend.addEventListener('click', function () {
      var message = textEl && textEl.value ? String(textEl.value).trim() : '';
      if (!message) {
        if (typeof global.showToast === 'function') global.showToast('Введите текст', 'error');
        return;
      }
      var api = global.CattleTrackerApi;
      if (!api || typeof api.submitReport !== 'function') {
        if (typeof global.showToast === 'function') global.showToast('Нет связи с сервером', 'error');
        return;
      }
      btnSend.disabled = true;
      api
        .submitReport(message, { kind: 'improvement', appVersion: appVersion || '' })
        .then(function () {
          close();
          if (typeof global.showToast === 'function') global.showToast('Предложение отправлено', 'success');
        })
        .catch(function (err) {
          btnSend.disabled = false;
          var msg = err && err.message ? String(err.message) : 'Не удалось отправить';
          if (typeof global.showToast === 'function') global.showToast(msg, 'error', 5000);
        });
    });

    document.body.appendChild(overlay);
    if (textEl) textEl.focus();
  }

  function showAppVersionActionsModal(state, options) {
    options = options || {};
    var focusBefore = document.activeElement;
    var localVer = (state && state.localVer) || '—';
    var showUpdate = isAppAdminUser();

    var overlay = document.createElement('div');
    overlay.className = 'confirm-overlay app-version-actions-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'app-version-actions-title');

    var titleText = 'Версия ' + escapeHtml(localVer);
    var updateBtnHtml = showUpdate
      ? '<button type="button" class="btn primary app-version-action-update">Обновить</button>'
      : '';

    overlay.innerHTML =
      '<div class="confirm-modal app-version-actions-modal">' +
      '<h2 id="app-version-actions-title" class="app-version-actions-title">' +
      titleText +
      '</h2>' +
      '<div class="confirm-modal-actions confirm-modal-actions--stack">' +
      updateBtnHtml +
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

    if (btnUpdate) {
      btnUpdate.addEventListener('click', function () {
        close();
        showImprovementSuggestionModal(localVer);
      });
    }

    btnChangelog.addEventListener('click', function () {
      close();
      showChangelogViewerModal();
    });

    document.body.appendChild(overlay);
    (btnUpdate || btnChangelog).focus();
  }

  global.parseChangelogMarkdown = parseChangelogMarkdown;
  global.mergeChangelogEntries = mergeChangelogEntries;
  global.fetchChangelogMarkdown = fetchChangelogMarkdown;
  global.showChangelogViewerModal = showChangelogViewerModal;
  global.showAppVersionActionsModal = showAppVersionActionsModal;
  global.showImprovementSuggestionModal = showImprovementSuggestionModal;
})(typeof window !== 'undefined' ? window : this);

export {};
