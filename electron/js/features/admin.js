/**
 * admin.js — экран администрирования: пользователи, базы на сервере, отчёты (только admin в режиме API).
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

  function renderAdminCreateUserForm() {
    return (
      '<form id="admin-create-user-form" class="admin-create-user-form">' +
      '<label>Логин <input type="text" id="adminNewUsername" required autocomplete="off" /></label>' +
      '<label>Пароль <input type="text" id="adminNewPassword" required autocomplete="new-password" /></label>' +
      '<label>Роль <select id="adminNewRole">' +
      '<option value="lite">lite</option>' +
      '<option value="medium">medium</option>' +
      '<option value="pro">pro</option>' +
      '<option value="admin">admin</option>' +
      '</select></label>' +
      '<button type="submit" class="action-btn">Создать</button>' +
      '</form>'
    );
  }

  function bindAdminCreateUserForm(api) {
    var form = document.getElementById('admin-create-user-form');
    if (!form || form.dataset.bound === '1') return;
    form.dataset.bound = '1';
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var usernameEl = document.getElementById('adminNewUsername');
      var passwordEl = document.getElementById('adminNewPassword');
      var roleEl = document.getElementById('adminNewRole');
      var username = usernameEl ? String(usernameEl.value || '').trim() : '';
      var password = passwordEl ? String(passwordEl.value || '') : '';
      var role = roleEl ? roleEl.value : 'lite';
      if (!username || !password) {
        if (typeof showToast === 'function') showToast('Введите логин и пароль', 'error');
        return;
      }
      api.createUser(username, password, role).then(function () {
        if (typeof showToast === 'function') showToast('Пользователь создан', 'success');
        renderAdminScreen();
      }).catch(function (err) {
        if (typeof showToast === 'function') showToast(err.message || 'Ошибка создания', 'error', 5000);
      });
    });
  }

  function renderAdminUsersTable(users, api, currentUserId) {
    var html = renderAdminCreateUserForm();
    if (!Array.isArray(users) || users.length === 0) {
      html += '<p class="admin-message">Нет пользователей.</p>';
      return html;
    }
    html += '<table class="admin-table"><thead><tr>' +
      '<th>Логин</th><th>Пароль</th><th>Роль</th><th>Дата регистрации</th><th></th>' +
      '</tr></thead><tbody>';
    for (var i = 0; i < users.length; i++) {
      var u = users[i];
      var canDelete = u.id !== currentUserId;
      var deleteBtn = canDelete
        ? '<button type="button" class="small-btn admin-delete-btn" data-user-id="' + escapeHtml(u.id) + '">Удалить</button>'
        : '<span class="admin-self-hint">(вы)</span>';
      var roleSelect =
        '<select class="admin-role-select" data-user-id="' + escapeHtml(u.id) + '" aria-label="Роль пользователя">' +
        '<option value="admin"' + (u.role === 'admin' ? ' selected' : '') + '>admin</option>' +
        '<option value="pro"' + (u.role === 'pro' ? ' selected' : '') + '>pro</option>' +
        '<option value="medium"' + (u.role === 'medium' ? ' selected' : '') + '>medium</option>' +
        '<option value="lite"' + (u.role === 'lite' ? ' selected' : '') + '>lite</option>' +
        '</select>';
      var pwdVal = u.password_plain != null ? String(u.password_plain) : '';
      var pwdInput =
        '<input type="text" class="admin-password-input" data-user-id="' + escapeHtml(u.id) + '" ' +
        'data-prev-password="' + escapeHtml(pwdVal) + '" value="' + escapeHtml(pwdVal) + '" ' +
        'placeholder="—" autocomplete="off" aria-label="Пароль пользователя" />';
      html += '<tr><td>' + escapeHtml(u.username) + '</td><td>' + pwdInput + '</td><td>' + roleSelect +
        '</td><td>' + escapeHtml(u.created_at || '') + '</td><td>' + deleteBtn + '</td></tr>';
    }
    html += '</tbody></table>';
    return html;
  }

  function bindAdminUsersTable(usersEl, api, currentUserId) {
    bindAdminCreateUserForm(api);
    usersEl.querySelectorAll('.admin-role-select').forEach(function (sel) {
      sel.addEventListener('focus', function () {
        sel.setAttribute('data-prev-role', sel.value);
      });
      sel.addEventListener('change', function () {
        var id = sel.getAttribute('data-user-id');
        var newRole = sel.value;
        var prevRole = sel.getAttribute('data-prev-role') || sel.value;
        if (!id || !newRole) return;
        api.updateUserRole(id, newRole).then(function () {
          sel.setAttribute('data-prev-role', newRole);
          if (typeof showToast === 'function') showToast('Роль обновлена', 'success');
          if (id === currentUserId && typeof global.getCurrentUser === 'function') {
            var cur = global.getCurrentUser();
            if (cur) {
              cur.role = newRole;
              if (typeof global.saveCurrentUser === 'function') global.saveCurrentUser(cur);
              if (typeof global.updateAuthBar === 'function') global.updateAuthBar();
            }
          }
        }).catch(function (err) {
          if (typeof showToast === 'function') showToast(err.message || 'Не удалось сменить роль', 'error', 5000);
          sel.value = prevRole;
        });
      });
      sel.setAttribute('data-prev-role', sel.value);
    });
    usersEl.querySelectorAll('.admin-password-input').forEach(function (inp) {
      inp.addEventListener('blur', function () {
        var id = inp.getAttribute('data-user-id');
        var prev = inp.getAttribute('data-prev-password') || '';
        var val = String(inp.value || '');
        if (!id || val === prev) return;
        if (!val.trim()) {
          if (typeof showToast === 'function') showToast('Пароль не может быть пустым', 'error');
          inp.value = prev;
          return;
        }
        api.updateUser(id, { password: val }).then(function () {
          inp.setAttribute('data-prev-password', val);
          if (typeof showToast === 'function') showToast('Пароль обновлён', 'success');
        }).catch(function (err) {
          if (typeof showToast === 'function') showToast(err.message || 'Не удалось сменить пароль', 'error', 5000);
          inp.value = prev;
        });
      });
    });
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

    if (typeof global.renderSyncServerBasesList === 'function') {
      global.renderSyncServerBasesList();
    }

    api.getUsers()
      .then(function (users) {
        if (!Array.isArray(users)) users = [];
        usersEl.innerHTML = renderAdminUsersTable(users, api, currentUserId);
        bindAdminUsersTable(usersEl, api, currentUserId);
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
