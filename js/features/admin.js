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

  function renderAdminCreateUserForm(actor) {
    var canCreateAdmin = isPrimaryAdminUsername(actor && actor.username);
    return (
      '<form id="admin-create-user-form" class="admin-create-user-form">' +
      '<label>Логин <input type="text" id="adminNewUsername" required autocomplete="off" /></label>' +
      '<label>Пароль <input type="text" id="adminNewPassword" required autocomplete="new-password" /></label>' +
      '<label>Роль <select id="adminNewRole">' +
      '<option value="inseminator">Осеменатор</option>' +
      '<option value="service">Сервис-специалист</option>' +
      (canCreateAdmin ? '<option value="admin">Админ</option>' : '') +
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

  function isPrimaryAdminUsername(username) {
    return String(username || '').trim().toLowerCase() === 'panko';
  }

  function isAdminUserRole(role) {
    var r = String(role || '').toLowerCase();
    return r === 'admin' || r === 'manager';
  }

  var ROLE_CAP_FIELDS = [
    { key: 'cards', label: 'Карточки животных' },
    { key: 'eventsInput', label: 'Отёл, запуск, аборт, добавление животных' },
    { key: 'serviceWorksInput', label: 'Осеменение, УЗИ, постановка на протокол' },
    { key: 'workLists', label: 'Списки работ' },
    { key: 'stallMap', label: 'Схема стойломест' },
    { key: 'inventory', label: 'Инвентаризация стойломест' },
    { key: 'analytics', label: 'Аналитика' },
    { key: 'farmCardView', label: 'Карточка хозяйства — просмотр' },
    { key: 'farmCardEventsWrite', label: 'События в карточке хозяйства' },
    { key: 'farmCardSettings', label: 'Настройки хозяйства' },
    { key: 'multiBase', label: 'Переключение хозяйств' }
  ];

  function showAdminTab(tabId) {
    var tab = String(tabId || 'users').trim() || 'users';
    try {
      sessionStorage.setItem('cattleTracker_adminTab', tab);
    } catch (e) {}
    document.querySelectorAll('#admin-screen [data-admin-tab]').forEach(function (btn) {
      var on = btn.getAttribute('data-admin-tab') === tab;
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    document.querySelectorAll('#admin-screen [data-admin-panel]').forEach(function (panel) {
      var match = panel.getAttribute('data-admin-panel') === tab;
      if (match) panel.removeAttribute('hidden');
      else panel.setAttribute('hidden', '');
    });
  }

  function bindAdminTabs() {
    var screen = document.getElementById('admin-screen');
    if (!screen) return;
    var saved = 'users';
    try {
      saved = sessionStorage.getItem('cattleTracker_adminTab') || 'users';
    } catch (e1) {}
    showAdminTab(saved);
    if (screen.dataset.tabsBound === '1') return;
    screen.dataset.tabsBound = '1';
    screen.querySelectorAll('[data-admin-tab]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        showAdminTab(btn.getAttribute('data-admin-tab'));
      });
    });
  }

  function renderUserCapColumn(caps) {
    var html = '<div class="admin-role-cap-col">';
    ROLE_CAP_FIELDS.forEach(function (field) {
      var on = !!(caps && caps[field.key]);
      html +=
        '<label class="admin-role-cap-row">' +
        '<input type="checkbox" data-user-cap-key="' +
        escapeHtml(field.key) +
        '"' +
        (on ? ' checked' : '') +
        ' />' +
        '<span>' +
        escapeHtml(field.label) +
        '</span></label>';
    });
    html += '</div>';
    return html;
  }

  function bindUserCapToggles(host, api, state) {
    if (!host || !api || !api.putUserCapabilities) return;
    host.querySelectorAll('input[data-user-cap-key]').forEach(function (input) {
      input.addEventListener('change', function () {
        var key = input.getAttribute('data-user-cap-key');
        var userId = state.userId;
        if (!key || !userId) return;
        state.overlay = state.overlay && typeof state.overlay === 'object' ? state.overlay : {};
        state.overlay[key] = !!input.checked;
        input.disabled = true;
        api.putUserCapabilities(userId, state.overlay).then(function (saved) {
          if (saved && saved.overlay) state.overlay = saved.overlay;
          if (saved && saved.capabilities) state.capabilities = saved.capabilities;
          var me = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
          if (me && String(me.id) === String(userId) && typeof global.setUserCapabilities === 'function') {
            global.setUserCapabilities(state.overlay);
          }
          if (typeof showToast === 'function') showToast('Права сохранены', 'success');
          if (typeof globalThis.__menu !== 'undefined' && typeof globalThis.__menu.updateMenuGroupVisibility === 'function') {
            globalThis.__menu.updateMenuGroupVisibility();
          }
        }).catch(function (err) {
          input.checked = !input.checked;
          state.overlay[key] = !!input.checked;
          if (typeof showToast === 'function') showToast(err.message || 'Не удалось сохранить права', 'error', 5000);
        }).then(function () {
          input.disabled = false;
        });
      });
    });
  }

  function loadSelectedUserCapabilities(api, userId, host) {
    if (!host) return;
    if (!userId) {
      host.innerHTML = '<p class="admin-message">Выберите пользователя.</p>';
      return;
    }
    host.innerHTML = '<p class="admin-loading">Загрузка…</p>';
    api.getUserCapabilities(userId).then(function (data) {
      var state = {
        userId: userId,
        overlay: (data && data.overlay) || {},
        capabilities: (data && data.capabilities) || {}
      };
      host.innerHTML = renderUserCapColumn(state.capabilities);
      bindUserCapToggles(host, api, state);
    }).catch(function (err) {
      host.innerHTML = '<p class="admin-message admin-error">Ошибка: ' + escapeHtml(err.message || 'Не удалось загрузить права') + '</p>';
    });
  }

  function loadAdminRoleCapabilities(api) {
    var el = document.getElementById('admin-role-capabilities');
    if (!el) return;
    if (!api || !api.getUsers || !api.getUserCapabilities) {
      el.innerHTML = '<p class="admin-message">API недоступен.</p>';
      return;
    }
    el.innerHTML = '<p class="admin-loading">Загрузка…</p>';
    api.getUsers().then(function (users) {
      users = (users || []).filter(function (u) { return u && !isAdminUserRole(u.role); });
      if (!users.length) {
        el.innerHTML = '<p class="admin-message">Нет пользователей без роли администратора.</p>';
        return;
      }
      var savedId = '';
      try {
        savedId = sessionStorage.getItem('cattleTracker_adminCapUserId') || '';
      } catch (e) {}
      var selected = users.some(function (u) { return String(u.id) === String(savedId); }) ? savedId : String(users[0].id);
      var opts = users.map(function (u) {
        var roleLabel = String(u.role || '') === 'service' ? 'сервис' : 'осеменатор';
        return '<option value="' + escapeHtml(String(u.id)) + '"' +
          (String(u.id) === String(selected) ? ' selected' : '') +
          '>' + escapeHtml((u.username || '') + ' (' + roleLabel + ')') + '</option>';
      }).join('');
      el.innerHTML =
        '<label class="admin-cap-user-label">Пользователь ' +
        '<select id="adminCapUserSelect" class="admin-cap-user-select">' + opts + '</select></label>' +
        '<div id="admin-user-cap-fields" class="admin-role-cap-grid"></div>';
      var fields = document.getElementById('admin-user-cap-fields');
      var sel = document.getElementById('adminCapUserSelect');
      function persistAndLoad() {
        var id = sel ? sel.value : selected;
        try {
          sessionStorage.setItem('cattleTracker_adminCapUserId', id);
        } catch (e2) {}
        loadSelectedUserCapabilities(api, id, fields);
      }
      if (sel) sel.addEventListener('change', persistAndLoad);
      persistAndLoad();
    }).catch(function (err) {
      el.innerHTML = '<p class="admin-message admin-error">Ошибка: ' + escapeHtml(err.message || 'Не удалось загрузить права') + '</p>';
    });
  }

  function canDeleteAdminUser(actor, target) {
    if (!actor || !target) return false;
    if (String(actor.id) === String(target.id)) return false;
    if (isPrimaryAdminUsername(target.username)) return false;
    if (isAdminUserRole(target.role) && !isPrimaryAdminUsername(actor.username)) return false;
    return true;
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

  function renderAdminUsersTable(users, api, currentUser) {
    var currentUserId = currentUser ? currentUser.id : null;
    var actorIsPrimary = isPrimaryAdminUsername(currentUser && currentUser.username);
    var html = renderAdminCreateUserForm(currentUser);
    if (!Array.isArray(users) || users.length === 0) {
      html += '<p class="admin-message">Нет пользователей.</p>';
      return html;
    }
    html += '<table class="admin-table"><thead><tr>' +
      '<th>Логин</th><th>Пароль</th><th>Роль</th><th>Дата регистрации</th><th></th>' +
      '</tr></thead><tbody>';
    for (var i = 0; i < users.length; i++) {
      var u = users[i];
      var canDelete = canDeleteAdminUser(currentUser, u);
      var deleteBtn = canDelete
        ? '<button type="button" class="small-btn admin-delete-btn" data-user-id="' + escapeHtml(u.id) + '">Удалить</button>'
        : String(u.id) === String(currentUserId)
          ? '<span class="admin-self-hint">(вы)</span>'
          : isPrimaryAdminUsername(u.username)
            ? '<span class="admin-self-hint" title="Основной администратор">—</span>'
            : isAdminUserRole(u.role) && !actorIsPrimary
              ? '<span class="admin-self-hint" title="Удалять админов может только Panko">—</span>'
              : '';
      var roleLocked =
        isPrimaryAdminUsername(u.username) || (!actorIsPrimary && isAdminUserRole(u.role));
      var roleSelect;
      if (roleLocked) {
        roleSelect =
          '<span>' +
          (isAdminUserRole(u.role) ? 'Админ' : escapeHtml(String(u.role || ''))) +
          '</span>';
      } else {
        roleSelect =
          '<select class="admin-role-select" data-user-id="' +
          escapeHtml(u.id) +
          '" aria-label="Роль пользователя">';
        if (actorIsPrimary) {
          roleSelect +=
            '<option value="admin"' +
            (roleOptionSelected(u, 'admin') ? ' selected' : '') +
            '>Админ</option>';
        }
        roleSelect +=
          '<option value="inseminator"' +
          (roleOptionSelected(u, 'inseminator') ? ' selected' : '') +
          '>Осеменатор</option>' +
          '<option value="service"' +
          (roleOptionSelected(u, 'service') ? ' selected' : '') +
          '>Сервис-специалист</option></select>';
      }
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
        var msg = 'Удалить пользователя? Это действие нельзя отменить.';
        var confirmFn =
          typeof showConfirmModal === 'function'
            ? function () {
                return showConfirmModal(msg, { confirmText: 'Удалить', cancelText: 'Отмена' });
              }
            : function () {
                return Promise.resolve(window.confirm(msg));
              };
        confirmFn().then(function (ok) {
          if (!ok) return;
          api.deleteUser(id).then(function () {
            if (typeof showToast === 'function') showToast('Пользователь удалён', 'info');
            renderAdminScreen();
          }).catch(function (err) {
            if (typeof showToast === 'function') showToast(err.message || 'Ошибка удаления', 'error', 5000);
          });
        });
      });
    });
  }

  function bindAdminCreateObjectBtn() {
    var btn = document.getElementById('adminCreateObjectBtn');
    if (!btn || btn.dataset.bound === '1') return;
    btn.dataset.bound = '1';
    btn.addEventListener('click', function () {
      if (typeof global.handleAddObjectClick === 'function') {
        global.handleAddObjectClick();
      } else if (typeof global.showAddObjectModal === 'function') {
        global.showAddObjectModal();
      } else if (typeof showToast === 'function') {
        showToast('Создание объекта недоступно', 'error');
      }
    });
  }

  function kindLabel(kind) {
    if (kind === 'forgot_password') return 'Забыл пароль';
    if (kind === 'request_credentials') return 'Запросить логин/пароль';
    return kind || 'Заявка';
  }

  function renderAccessRequests(list, api) {
    var el = document.getElementById('admin-access-requests-container');
    if (!el) return;
    if (!Array.isArray(list) || list.length === 0) {
      el.innerHTML = '<p class="admin-access-requests-empty admin-message">Нет ожидающих заявок.</p>';
      return;
    }
    var html = '';
    for (var i = 0; i < list.length; i++) {
      var r = list[i];
      html +=
        '<div class="admin-access-request-card" data-request-id="' + escapeHtml(r.id) + '">' +
        '<p><strong>' + escapeHtml(kindLabel(r.kind)) + '</strong> · ' + escapeHtml(r.created_at || '') + '</p>' +
        '<p>Логин: ' + escapeHtml(r.username || '—') + '</p>' +
        '<p>Контакт: ' + escapeHtml(r.contact || '—') + '</p>' +
        '<p>Комментарий: ' + escapeHtml(r.comment || '—') + '</p>' +
        '<div class="admin-access-request-actions">' +
        '<button type="button" class="small-btn admin-access-done-btn" data-request-id="' + escapeHtml(r.id) + '">Отметить выполненным</button>' +
        '<button type="button" class="small-btn admin-access-reject-btn" data-request-id="' + escapeHtml(r.id) + '">Отклонить</button>' +
        '</div></div>';
    }
    el.innerHTML = html;
    el.querySelectorAll('.admin-access-done-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-request-id');
        if (!id || !api.resolveAccessRequest) return;
        api.resolveAccessRequest(id, 'done').then(function () {
          if (typeof showToast === 'function') showToast('Заявка отмечена выполненной', 'success');
          loadAccessRequests(api);
        }).catch(function (err) {
          if (typeof showToast === 'function') showToast(err.message || 'Ошибка', 'error', 5000);
        });
      });
    });
    el.querySelectorAll('.admin-access-reject-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-request-id');
        if (!id || !api.resolveAccessRequest) return;
        api.resolveAccessRequest(id, 'rejected').then(function () {
          if (typeof showToast === 'function') showToast('Заявка отклонена', 'info');
          loadAccessRequests(api);
        }).catch(function (err) {
          if (typeof showToast === 'function') showToast(err.message || 'Ошибка', 'error', 5000);
        });
      });
    });
  }

  function loadAccessRequests(api) {
    var el = document.getElementById('admin-access-requests-container');
    if (!el) return;
    if (!api || typeof api.getAccessRequests !== 'function') {
      el.innerHTML = '<p class="admin-message">API заявок недоступен.</p>';
      return;
    }
    el.innerHTML = '<p class="admin-loading">Загрузка…</p>';
    api.getAccessRequests('pending').then(function (list) {
      renderAccessRequests(list, api);
    }).catch(function (err) {
      el.innerHTML = '<p class="admin-message admin-error">Ошибка: ' + escapeHtml(err.message || 'Не удалось загрузить заявки') + '</p>';
    });
  }

  function renderAdminScreen() {
    var usersEl = document.getElementById('admin-users-container');
    var reportsEl = document.getElementById('admin-reports-container');
    var assignEl = document.getElementById('admin-assign-container');
    if (!usersEl || !reportsEl) return;
    var api = global.CattleTrackerApi;
    bindAdminCreateObjectBtn();
    bindAdminTabs();
    loadAdminRoleCapabilities(api);
    if (!api || !api.getUsers || !api.getReports) {
      usersEl.innerHTML = '<p class="admin-message">API недоступен.</p>';
      reportsEl.innerHTML = '';
      if (assignEl) assignEl.innerHTML = '';
      var arEmpty = document.getElementById('admin-access-requests-container');
      if (arEmpty) arEmpty.innerHTML = '';
      return;
    }

    usersEl.innerHTML = '<p class="admin-loading">Загрузка…</p>';
    reportsEl.innerHTML = '<p class="admin-loading">Загрузка…</p>';
    if (assignEl) assignEl.innerHTML = '<p class="admin-loading">Загрузка…</p>';
    loadAccessRequests(api);

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
        usersEl.innerHTML = renderAdminUsersTable(users, api, currentUser);
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
          var kindBadge = '';
          var statusBadge = '';
          var ringBlock = '';
          var payloadPreview = '';
          var acceptBtn = '';
          var parsedKind = '';
          var statusRu =
            r.status === 'done' ? 'сделано' : r.status === 'skipped' ? 'пропущено' : 'новое';
          statusBadge =
            '<span class="admin-report-status">' + escapeHtml(statusRu) + '</span> ';
          if (r.payload) {
            try {
              var pl = typeof r.payload === 'string' ? JSON.parse(r.payload) : r.payload;
              if (pl && typeof pl === 'object') {
                if (pl.kind) {
                  parsedKind = String(pl.kind);
                  var kindLabel =
                    pl.kind === 'improvement'
                      ? 'Предложение'
                      : pl.kind === 'suggestion'
                        ? 'На проверке'
                        : String(pl.kind);
                  kindBadge =
                    '<span class="admin-report-kind">' + escapeHtml(kindLabel) + '</span> ';
                }
                if (pl.ringLog) {
                  var ringText = String(pl.ringLog);
                  if (ringText.length > 8000) ringText = ringText.slice(-8000);
                  ringBlock =
                    '<details class="admin-report-ring"><summary>Лог (хвост)</summary>' +
                    '<pre class="admin-report-payload admin-report-ring-pre">' +
                    escapeHtml(ringText) +
                    '</pre></details>';
                }
                var plCopy = Object.assign({}, pl);
                delete plCopy.ringLog;
                payloadPreview =
                  '<pre class="admin-report-payload">' +
                  escapeHtml(JSON.stringify(plCopy, null, 2)) +
                  '</pre>';
              } else {
                payloadPreview =
                  '<pre class="admin-report-payload">' + escapeHtml(JSON.stringify(pl, null, 2)) + '</pre>';
              }
            } catch (_) {
              payloadPreview = '<pre class="admin-report-payload">' + escapeHtml(r.payload) + '</pre>';
            }
          }
          if (parsedKind === 'suggestion' && String(r.status || 'new') === 'new') {
            acceptBtn =
              '<button type="button" class="action-btn admin-accept-report-btn" data-report-id="' +
              escapeHtml(r.id) +
              '">Принять</button> ';
          }
          html +=
            '<div class="admin-report-item" data-report-id="' +
            escapeHtml(r.id) +
            '">' +
            '<div class="admin-report-meta">' +
            kindBadge +
            statusBadge +
            escapeHtml(r.createdAt || '') +
            ' — ' +
            escapeHtml(r.username) +
            '</div>' +
            '<div class="admin-report-message">' +
            escapeHtml(r.message) +
            '</div>' +
            ringBlock +
            payloadPreview +
            acceptBtn +
            '<button type="button" class="small-btn admin-delete-report-btn" data-report-id="' +
            escapeHtml(r.id) +
            '">Удалить</button>' +
            '</div>';
        }
        html += '</div>';
        reportsEl.innerHTML = html;
        reportsEl.querySelectorAll('.admin-accept-report-btn').forEach(function (btn) {
          btn.addEventListener('click', function () {
            var id = btn.getAttribute('data-report-id');
            if (!id || typeof api.acceptReportForAgent !== 'function') return;
            btn.disabled = true;
            api.acceptReportForAgent(id).then(function () {
              if (typeof showToast === 'function') showToast('Отправлено агенту', 'success');
              renderAdminScreen();
            }).catch(function (err) {
              btn.disabled = false;
              if (typeof showToast === 'function') showToast(err.message || 'Ошибка', 'error', 5000);
            });
          });
        });
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
