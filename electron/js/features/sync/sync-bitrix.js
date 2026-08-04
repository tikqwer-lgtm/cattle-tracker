/** Битрикс24: настройки webhook, привязка компании, pull, очередь переноса. */
(function (global) {
  'use strict';

  function isAdmin() {
    if (typeof global.getCurrentUser !== 'function') return false;
    var u = global.getCurrentUser();
    if (!u) return false;
    if (typeof global.hasCapability === 'function') return global.hasCapability('adminUsersRoles', u);
    return u.role === 'admin';
  }

  function api() {
    return global.CattleTrackerApi;
  }

  function currentObjectId() {
    if (typeof global.getCurrentObjectId === 'function') return global.getCurrentObjectId() || '';
    return api() && typeof api().getCurrentObjectId === 'function' ? api().getCurrentObjectId() : '';
  }

  function setStatus(msg, kind) {
    var el = document.getElementById('syncBitrixStatus');
    if (!el) return;
    el.textContent = msg || '';
    el.className = 'sync-section-hint sync-bitrix-status' + (kind ? ' sync-bitrix-status--' + kind : '');
  }

  function renderPendingList(items) {
    var box = document.getElementById('syncBitrixPendingList');
    if (!box) return;
    if (!items || !items.length) {
      box.innerHTML = '<p class="sync-section-hint">Очередь пуста — правок для переноса в Битрикс нет.</p>';
      return;
    }
    var html = '<ul class="sync-bitrix-pending-ul">';
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (!it) continue;
      var summary =
        (it.payload && it.payload.summary) ||
        (it.kind === 'address' ? 'Адрес' : 'Специалист');
      var when = it.createdAt || '';
      try {
        if (when) when = new Date(when).toLocaleString('ru-RU');
      } catch (e) {}
      html +=
        '<li class="sync-bitrix-pending-item" data-id="' +
        String(it.id || '').replace(/"/g, '') +
        '">' +
        '<div class="sync-bitrix-pending-main">' +
        '<strong>' +
        escapeHtml(summary) +
        '</strong>' +
        '<span class="sync-section-hint">' +
        escapeHtml(it.kind || '') +
        (when ? ' · ' + escapeHtml(when) : '') +
        (it.objectId ? ' · база ' + escapeHtml(it.objectId) : '') +
        '</span></div>' +
        '<div class="sync-bitrix-pending-actions">' +
        '<button type="button" class="small-btn sync-bitrix-pending-done" data-id="' +
        escapeHtml(it.id) +
        '">Уже занесено</button> ' +
        '<button type="button" class="small-btn sync-bitrix-pending-dismiss" data-id="' +
        escapeHtml(it.id) +
        '">Не нужно</button>' +
        '</div></li>';
    }
    html += '</ul>';
    box.innerHTML = html;
    box.querySelectorAll('.sync-bitrix-pending-done').forEach(function (btn) {
      btn.onclick = function () {
        resolveItem(btn.getAttribute('data-id'), 'done');
      };
    });
    box.querySelectorAll('.sync-bitrix-pending-dismiss').forEach(function (btn) {
      btn.onclick = function () {
        resolveItem(btn.getAttribute('data-id'), 'dismiss');
      };
    });
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function resolveItem(id, action) {
    if (!id || !api() || typeof api().resolveBitrixPending !== 'function') return;
    api()
      .resolveBitrixPending(id, action)
      .then(function () {
        if (typeof global.showToast === 'function') {
          global.showToast(action === 'dismiss' ? 'Отмечено: не нужно' : 'Отмечено: занесено', 'success');
        }
        refreshPending();
      })
      .catch(function (err) {
        setStatus((err && err.message) || 'Ошибка', 'error');
      });
  }

  function refreshPending() {
    if (!api() || typeof api().listBitrixPending !== 'function') return;
    api()
      .listBitrixPending({ status: 'pending' })
      .then(function (data) {
        renderPendingList((data && data.items) || []);
      })
      .catch(function () {
        renderPendingList([]);
      });
  }

  function loadSettingsUi() {
    if (!api() || typeof api().getBitrixSettings !== 'function') return;
    api()
      .getBitrixSettings()
      .then(function (s) {
        var maskEl = document.getElementById('syncBitrixWebhookMasked');
        if (maskEl) {
          maskEl.textContent = s.configured
            ? 'Сохранён: ' + (s.webhookMasked || '***') + (s.fromEnv ? ' (из .env)' : '')
            : 'Не настроен';
        }
      })
      .catch(function () {});

    var oid = currentObjectId();
    var companyInp = document.getElementById('syncBitrixCompanyId');
    if (oid && api().getObjectBitrix && companyInp) {
      api()
        .getObjectBitrix(oid)
        .then(function (meta) {
          if (meta && meta.bitrixCompanyId != null) companyInp.value = meta.bitrixCompanyId;
          var synced = document.getElementById('syncBitrixSyncedAt');
          if (synced) {
            synced.textContent = meta && meta.bitrixSyncedAt
              ? 'Последняя загрузка: ' + formatDate(meta.bitrixSyncedAt)
              : '';
          }
        })
        .catch(function () {});
    }
  }

  function formatDate(iso) {
    try {
      return new Date(iso).toLocaleString('ru-RU');
    } catch (e) {
      return String(iso || '');
    }
  }

  function bindControls() {
    var saveWh = document.getElementById('syncBitrixWebhookSaveBtn');
    if (saveWh && !saveWh._bitrixBound) {
      saveWh._bitrixBound = true;
      saveWh.onclick = function () {
        var inp = document.getElementById('syncBitrixWebhookInput');
        var url = inp ? String(inp.value || '').trim() : '';
        if (!api() || !api().putBitrixSettings) return;
        setStatus('Сохранение…');
        api()
          .putBitrixSettings({ webhookUrl: url })
          .then(function (s) {
            if (inp) inp.value = '';
            setStatus('Webhook сохранён', 'ok');
            loadSettingsUi();
            if (typeof global.showToast === 'function') global.showToast('Webhook Битрикс сохранён', 'success');
          })
          .catch(function (err) {
            setStatus((err && err.message) || 'Ошибка сохранения', 'error');
          });
      };
    }

    var testBtn = document.getElementById('syncBitrixTestBtn');
    if (testBtn && !testBtn._bitrixBound) {
      testBtn._bitrixBound = true;
      testBtn.onclick = function () {
        var inp = document.getElementById('syncBitrixWebhookInput');
        var body = {};
        if (inp && String(inp.value || '').trim()) body.webhookUrl = String(inp.value).trim();
        if (!api() || !api().testBitrix) return;
        setStatus('Проверка связи…');
        api()
          .testBitrix(body)
          .then(function (r) {
            setStatus('Связь OK' + (r && r.name ? ': ' + r.name : ''), 'ok');
          })
          .catch(function (err) {
            setStatus((err && err.message) || 'Нет связи', 'error');
          });
      };
    }

    var searchBtn = document.getElementById('syncBitrixCompanySearchBtn');
    if (searchBtn && !searchBtn._bitrixBound) {
      searchBtn._bitrixBound = true;
      searchBtn.onclick = function () {
        var qEl = document.getElementById('syncBitrixCompanySearch');
        var q = qEl ? String(qEl.value || '').trim() : '';
        var listEl = document.getElementById('syncBitrixCompanyResults');
        if (!api() || !api().searchBitrixCompanies || !listEl) return;
        listEl.innerHTML = '<p class="sync-section-hint">Поиск…</p>';
        api()
          .searchBitrixCompanies(q)
          .then(function (data) {
            var items = (data && data.items) || [];
            if (!items.length) {
              listEl.innerHTML = '<p class="sync-section-hint">Ничего не найдено</p>';
              return;
            }
            var html = '<ul class="sync-bitrix-company-ul">';
            for (var i = 0; i < items.length; i++) {
              var it = items[i];
              html +=
                '<li><button type="button" class="link-btn sync-bitrix-pick-company" data-id="' +
                escapeHtml(it.id) +
                '">#' +
                escapeHtml(it.id) +
                ' — ' +
                escapeHtml(it.title || '') +
                '</button></li>';
            }
            html += '</ul>';
            listEl.innerHTML = html;
            listEl.querySelectorAll('.sync-bitrix-pick-company').forEach(function (btn) {
              btn.onclick = function () {
                var companyInp = document.getElementById('syncBitrixCompanyId');
                if (companyInp) companyInp.value = btn.getAttribute('data-id') || '';
              };
            });
          })
          .catch(function (err) {
            listEl.innerHTML =
              '<p class="sync-section-hint">' +
              escapeHtml((err && err.message) || 'Ошибка поиска') +
              '</p>';
          });
      };
    }

    var pullBtn = document.getElementById('syncBitrixPullBtn');
    if (pullBtn && !pullBtn._bitrixBound) {
      pullBtn._bitrixBound = true;
      pullBtn.onclick = function () {
        var oid = currentObjectId();
        if (!oid) {
          setStatus('Сначала выберите хозяйство (базу)', 'error');
          return;
        }
        var companyInp = document.getElementById('syncBitrixCompanyId');
        var companyId = companyInp ? String(companyInp.value || '').trim() : '';
        if (!api() || !api().pullBitrixFarmCard) return;
        setStatus('Загрузка из Битрикс…');
        var body = companyId ? { bitrixCompanyId: companyId } : {};
        var saveLink =
          companyId && api().putObjectBitrix
            ? api().putObjectBitrix(oid, { bitrixCompanyId: companyId })
            : Promise.resolve();
        saveLink
          .then(function () {
            return api().pullBitrixFarmCard(oid, body);
          })
          .then(function (result) {
            setStatus(
              'Загружено контактов: ' +
                ((result && result.contactsCount) != null ? result.contactsCount : '—'),
              'ok'
            );
            if (typeof global.showToast === 'function') {
              global.showToast('Карточка обновлена из Битрикс', 'success');
            }
            if (typeof global.ensureFarmCardLoaded === 'function') {
              global.ensureFarmCardLoaded().then(function () {
                if (typeof global.renderFarmCardPanel === 'function') global.renderFarmCardPanel();
              });
            }
            loadSettingsUi();
            refreshPending();
          })
          .catch(function (err) {
            setStatus((err && err.message) || 'Ошибка загрузки', 'error');
          });
      };
    }

    var refreshPend = document.getElementById('syncBitrixPendingRefreshBtn');
    if (refreshPend && !refreshPend._bitrixBound) {
      refreshPend._bitrixBound = true;
      refreshPend.onclick = function () {
        refreshPending();
      };
    }
  }

  function initSyncBitrixSection() {
    var section = document.getElementById('sync-bitrix-section');
    if (!section) return;
    var useApi = global.CATTLE_TRACKER_USE_API && api();
    var admin = isAdmin();
    section.style.display = useApi && admin ? '' : 'none';
    if (!useApi || !admin) return;
    bindControls();
    loadSettingsUi();
    refreshPending();
  }

  global.initSyncBitrixSection = initSyncBitrixSection;
})(typeof window !== 'undefined' ? window : globalThis);
