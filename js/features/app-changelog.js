/** Patch notes: парсинг CHANGELOG.md и модал «Список изменений». */
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

  function parseChangelogMarkdown(text) {
    var entries = [];
    if (!text) return entries;
    var lines = String(text).split(/\r?\n/);
    var current = null;
    var currentSection = null;
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var verMatch = line.match(/^## \[([^\]]+)\]\s*-\s*(.+)$/);
      if (verMatch) {
        if (current) entries.push(current);
        current = { version: verMatch[1].trim(), date: verMatch[2].trim(), sections: [] };
        currentSection = null;
        continue;
      }
      var secMatch = line.match(/^###\s+(.+)$/);
      if (secMatch && current) {
        currentSection = { title: secMatch[1].trim(), items: [] };
        current.sections.push(currentSection);
        continue;
      }
      var itemMatch = line.match(/^-\s+(.+)$/);
      if (itemMatch && currentSection) {
        currentSection.items.push(itemMatch[1].trim());
      }
    }
    if (current) entries.push(current);
    return entries;
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
    var base = getApiBase();
    if (base) {
      return fetch(base + '/api/mobile/changelog', { cache: 'no-cache' })
        .then(function (res) {
          if (res.ok) return res.text();
          return null;
        })
        .catch(function () {
          return null;
        })
        .then(function (serverText) {
          if (serverText && String(serverText).trim()) return serverText;
          return fetch('CHANGELOG.md', { cache: 'no-cache' })
            .then(function (r) {
              return r.ok ? r.text() : '';
            })
            .catch(function () {
              return '';
            });
        });
    }
    return fetch('CHANGELOG.md', { cache: 'no-cache' })
      .then(function (r) {
        return r.ok ? r.text() : '';
      })
      .catch(function () {
        return '';
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

    return fetchChangelogMarkdown().then(function (text) {
      var entries = parseChangelogMarkdown(text);
      if (bodyEl) bodyEl.innerHTML = renderChangelogHtml(entries);
    });
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
  global.fetchChangelogMarkdown = fetchChangelogMarkdown;
  global.showChangelogViewerModal = showChangelogViewerModal;
  global.showAppVersionActionsModal = showAppVersionActionsModal;
})(typeof window !== 'undefined' ? window : this);

export {};
