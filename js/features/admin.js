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
      '<option value="inseminator">Осеменатор</option>' +
      '<option value="service">Сервис-специалист</option>' +
      '<option value="admin">Админ</option>' +
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
      var role = roleEl ? roleEl.value : 'inseminator';
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

  function roleOptionSelected(u, code) {
    var r = String((u && u.role) || '').toLowerCase();
    if (code === 'admin') return r === 'admin' || r === 'manager';
    if (code === 'service') return r === 'service' || r === 'viewer';
    return r === 'inseminator' || r === 'lite' || r === 'medium' || r === 'pro' || r === 'operator' || (!r);
  }

  function renderAdminAssignPanel(users, objects, api) {
    var assignable = (users || []).filter(function (u) {
      return u && u.role !== 'admin' && u.role !== 'manager';
    });
    if (!assignable.length) {
      return '<p class="admin-message">Нет пользователей для назначения (кроме администраторов).</p>';
    }
    var html =
      '<div class="admin-assign-layout">' +
      '<label class="admin-assign-user-label">Пользователь ' +
      '<select id="adminAssignUserSelect" aria-label="Пользователь для назначения объектов">';
    for (var i = 0; i < assignable.length; i++) {
      var u = assignable[i];
      html +=
        '<option value="' +
        escapeHtml(u.id) +
        '">' +
        escapeHtml(u.username) +
        '</option>';
    }
    html += '</select></label>';
    html += '<div id="adminAssignObjectsList" class="admin-assign-objects"></div>';
    html +=
      '<button type="button" class="action-btn" id="adminAssignSaveBtn">Сохранить подключение</button>' +
      '<p id="adminAssignStatus" class="admin-message" aria-live="polite"></p>' +
      '</div>';
    return html;
  }

  function fillAdminAssignObjects(container, objects, selectedIds) {
    var set = {};
    (selectedIds || []).forEach(function (id) {
      set[String(id)] = true;
    });
    if (!objects || !objects.length) {
      container.innerHTML = '<p class="admin-message">На сервере нет объектов.</p>';
      return;
    }
    var html = '';
    for (var i = 0; i < objects.length; i++) {
      var o = objects[i];
      var id = String(o.id || '');
      var checked = set[id] ? ' checked' : '';
      html +=
        '<label class="admin-assign-obj-row">' +
        '<input type="checkbox" class="admin-assign-obj-cb" value="' +
        escapeHtml(id) +
        '"' +
        checked +
        ' /> ' +
        escapeHtml(o.name || id) +
        '</label>';
    }
    container.innerHTML = html;
  }

  function bindAdminAssignPanel(assignEl, users, objects, api) {
    var select = document.getElementById('adminAssignUserSelect');
    var listEl = document.getElementById('adminAssignObjectsList');
    var saveBtn = document.getElementById('adminAssignSaveBtn');
    var statusEl = document.getElementById('adminAssignStatus');
    if (!select || !listEl || !saveBtn) return;

    function loadForUser(userId) {
      var u = (users || []).find(function (x) {
        return x && String(x.id) === String(userId);
      });
      var ids = (u && Array.isArray(u.objectIds) ? u.objectIds : null) || [];
      if (api.getUserObjects) {
        listEl.innerHTML = '<p class="admin-loading">Загрузка…</p>';
        api
          .getUserObjects(userId)
          .then(function (objectIds) {
            fillAdminAssignObjects(listEl, objects, objectIds);
          })
          .catch(function () {
            fillAdminAssignObjects(listEl, objects, ids);
          });
      } else {
        fillAdminAssignObjects(listEl, objects, ids);
      }
    }

    select.addEventListener('change', function () {
      loadForUser(select.value);
    });
    loadForUser(select.value);

    saveBtn.addEventListener('click', function () {
      var userId = select.value;
      if (!userId || !api.setUserObjects) return;
      var cbs = listEl.querySelectorAll('.admin-assign-obj-cb:checked');
      var objectIds = [];
      for (var i = 0; i < cbs.length; i++) objectIds.push(cbs[i].value);
      saveBtn.disabled = true;
      if (statusEl) statusEl.textContent = 'Сохранение…';
      api
        .setUserObjects(userId, objectIds)
        .then(function () {
          if (typeof showToast === 'function') showToast('Подключение сохранено', 'success');
          if (statusEl) statusEl.textContent = 'Сохранено.';
          var u = (users || []).find(function (x) {
            return x && String(x.id) === String(userId);
          });
          if (u) u.objectIds = objectIds.slice();
        })
        .catch(function (err) {
          if (typeof showToast === 'function') showToast(err.message || 'Ошибка сохранения', 'error', 5000);
          if (statusEl) statusEl.textContent = err.message || 'Ошибка';
        })
        .then(function () {
          saveBtn.disabled = false;
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
        '<option value="admin"' + (roleOptionSelected(u, 'admin') ? ' selected' : '') + '>Админ</option>' +
        '<option value="inseminator"' + (roleOptionSelected(u, 'inseminator') ? ' selected' : '') + '>Осеменатор</option>' +
        '<option value="service"' + (roleOptionSelected(u, 'service') ? ' selected' : '') + '>Сервис-специалист</option>' +
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
    var assignEl = document.getElementById('admin-assign-container');
    if (!usersEl || !reportsEl) return;
    var api = global.CattleTrackerApi;
    if (!api || !api.getUsers || !api.getReports) {
      usersEl.innerHTML = '<p class="admin-message">API недоступен.</p>';
      reportsEl.innerHTML = '';
      if (assignEl) assignEl.innerHTML = '';
      return;
    }

    usersEl.innerHTML = '<p class="admin-loading">Загрузка…</p>';
    reportsEl.innerHTML = '<p class="admin-loading">Загрузка…</p>';
    if (assignEl) assignEl.innerHTML = '<p class="admin-loading">Загрузка…</p>';

    var currentUser = (typeof getCurrentUser === 'function') ? getCurrentUser() : null;
    var currentUserId = currentUser ? currentUser.id : null;

    if (typeof global.renderSyncServerBasesList === 'function') {
      global.renderSyncServerBasesList();
    }

    var usersPromise = api.getUsers();
    var objectsPromise =
      api.getObjectsList && typeof api.getObjectsList === 'function'
        ? api.getObjectsList()
        : Promise.resolve([]);

    Promise.all([usersPromise, objectsPromise])
      .then(function (pair) {
        var users = pair[0];
        var objects = pair[1];
        if (!Array.isArray(users)) users = [];
        if (!Array.isArray(objects)) objects = [];
        usersEl.innerHTML = renderAdminUsersTable(users, api, currentUserId);
        bindAdminUsersTable(usersEl, api, currentUserId);
        if (assignEl) {
          assignEl.innerHTML = renderAdminAssignPanel(users, objects, api);
          bindAdminAssignPanel(assignEl, users, objects, api);
        }
      })
      .catch(function (err) {
        usersEl.innerHTML = '<p class="admin-message admin-error">Ошибка: ' + escapeHtml(err.message || 'Не удалось загрузить список') + '</p>';
        if (assignEl) assignEl.innerHTML = '';
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
