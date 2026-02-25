/**
 * admin.js — экран администрирования: список пользователей и отчёты (только для admin в режиме API).
 */
(function (global) {
  'use strict';

  function escapeHtml(s) {
    if (s == null) return '';
    var str = String(s);
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderAdminScreen() {
    var usersEl = document.getElementById('admin-users-container');
    var reportsEl = document.getElementById('admin-reports-container');
    if (!usersEl || !reportsEl) return;
    var api = global.CattleTrackerApi;
    if (!api || !api.getUsers || !api.getReports) {
      usersEl.innerHTML = '<p class="admin-message">API недоступен.</p>';
      reportsEl.innerHTML = '';
      return;
    }

    usersEl.innerHTML = '<p class="admin-loading">Загрузка…</p>';
    reportsEl.innerHTML = '<p class="admin-loading">Загрузка…</p>';

    var currentUser = (typeof getCurrentUser === 'function') ? getCurrentUser() : null;
    var currentUserId = currentUser ? currentUser.id : null;

    api.getUsers()
      .then(function (users) {
        if (!Array.isArray(users)) users = [];
        if (users.length === 0) {
          usersEl.innerHTML = '<p class="admin-message">Нет пользователей.</p>';
          return;
        }
        var html = '<table class="admin-table"><thead><tr><th>Логин</th><th>Роль</th><th>Дата регистрации</th><th></th></tr></thead><tbody>';
        for (var i = 0; i < users.length; i++) {
          var u = users[i];
          var canDelete = u.id !== currentUserId;
          var deleteBtn = canDelete
            ? '<button type="button" class="small-btn admin-delete-btn" data-user-id="' + escapeHtml(u.id) + '">Удалить</button>'
            : '<span class="admin-self-hint">(вы)</span>';
          html += '<tr><td>' + escapeHtml(u.username) + '</td><td>' + escapeHtml(u.role) + '</td><td>' + escapeHtml(u.created_at || '') + '</td><td>' + deleteBtn + '</td></tr>';
        }
        html += '</tbody></table>';
        usersEl.innerHTML = html;
        usersEl.querySelectorAll('.admin-delete-btn').forEach(function (btn) {
          btn.addEventListener('click', function () {
            var id = btn.getAttribute('data-user-id');
            if (!id) return;
            if (!confirm('Удалить пользователя? Это действие нельзя отменить.')) return;
            api.deleteUser(id).then(function () {
              if (typeof showToast === 'function') showToast('Пользователь удалён', 'info');
              renderAdminScreen();
            }).catch(function (err) {
              if (typeof showToast === 'function') showToast(err.message || 'Ошибка удаления', 'error', 5000);
            });
          });
        });
      })
      .catch(function (err) {
        usersEl.innerHTML = '<p class="admin-message admin-error">Ошибка: ' + escapeHtml(err.message || 'Не удалось загрузить список') + '</p>';
      });

    api.getReports()
      .then(function (reports) {
        if (!Array.isArray(reports)) reports = [];
        if (reports.length === 0) {
          reportsEl.innerHTML = '<p class="admin-message">Нет отчётов.</p>';
          return;
        }
        var html = '<div class="admin-reports-list">';
        for (var j = 0; j < reports.length; j++) {
          var r = reports[j];
          var payloadPreview = '';
          if (r.payload) {
            try {
              var pl = typeof r.payload === 'string' ? JSON.parse(r.payload) : r.payload;
              payloadPreview = '<pre class="admin-report-payload">' + escapeHtml(JSON.stringify(pl, null, 2)) + '</pre>';
            } catch (_) {
              payloadPreview = '<pre class="admin-report-payload">' + escapeHtml(r.payload) + '</pre>';
            }
          }
          html += '<div class="admin-report-item" data-report-id="' + escapeHtml(r.id) + '">' +
            '<div class="admin-report-meta">' + escapeHtml(r.createdAt || '') + ' — ' + escapeHtml(r.username) + '</div>' +
            '<div class="admin-report-message">' + escapeHtml(r.message) + '</div>' +
            payloadPreview +
            '<button type="button" class="small-btn admin-delete-report-btn" data-report-id="' + escapeHtml(r.id) + '">Удалить</button>' +
            '</div>';
        }
        html += '</div>';
        reportsEl.innerHTML = html;
        reportsEl.querySelectorAll('.admin-delete-report-btn').forEach(function (btn) {
          btn.addEventListener('click', function () {
            var id = btn.getAttribute('data-report-id');
            if (!id) return;
            if (!confirm('Удалить этот отчёт?')) return;
            api.deleteReport(id).then(function () {
              if (typeof showToast === 'function') showToast('Отчёт удалён', 'info');
              renderAdminScreen();
            }).catch(function (err) {
              if (typeof showToast === 'function') showToast(err.message || 'Ошибка удаления', 'error', 5000);
            });
          });
        });
      })
      .catch(function (err) {
        reportsEl.innerHTML = '<p class="admin-message admin-error">Ошибка: ' + escapeHtml(err.message || 'Не удалось загрузить отчёты') + '</p>';
      });
  }

  if (typeof global !== 'undefined') {
    global.renderAdminScreen = renderAdminScreen;
  }
})(typeof window !== 'undefined' ? window : this);
