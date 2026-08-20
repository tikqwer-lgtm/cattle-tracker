/**
 * backup.js — Резервное копирование и восстановление (ZIP bundle + legacy JSON)
 */
(function (global) {
  'use strict';

  var BACKUP_PREFIX = 'cattleTracker_backup_';
  var MAX_BACKUPS = 10;

  function getBundleApi() {
    return global.CattleTrackerBackupBundle || null;
  }

  function listBackups() {
    var keys = [];
    for (var i = 0; i < localStorage.length; i++) {
      var key = localStorage.key(i);
      if (key && key.indexOf(BACKUP_PREFIX) === 0) {
        keys.push(key);
      }
    }
    return keys.slice(0, MAX_BACKUPS * 2).map(function (key) {
      try {
        var raw = localStorage.getItem(key);
        var data = raw ? JSON.parse(raw) : {};
        return {
          key: key,
          createdAt: data.createdAt || key.replace(BACKUP_PREFIX, ''),
          count: (data.entries && data.entries.length) || 0
        };
      } catch (e) {
        return { key: key, createdAt: '', count: 0 };
      }
    }).sort(function (a, b) {
      return (b.createdAt || '').localeCompare(a.createdAt || '');
    });
  }

  function createBackup() {
    try {
      var entries = typeof global.entries !== 'undefined' ? global.entries : [];
      var stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      var key = BACKUP_PREFIX + stamp;
      var payload = {
        entries: JSON.parse(JSON.stringify(entries)),
        createdAt: new Date().toISOString(),
        count: entries.length
      };
      try {
        var oid = typeof global.getCurrentObjectId === 'function' ? global.getCurrentObjectId() : '';
        if (oid && global.CattleTrackerObjectData) {
          payload.stall_layout = global.CattleTrackerObjectData.loadStallLayoutLocal(oid);
        } else if (oid) {
          var lay = localStorage.getItem('cattleTracker_stallLayout_' + oid);
          if (lay) payload.stall_layout = JSON.parse(lay);
        }
      } catch (e2) {}
      localStorage.setItem(key, JSON.stringify(payload));
      trimBackups();
      return { ok: true, key: key, count: entries.length };
    } catch (e) {
      return { ok: false, message: e && e.message };
    }
  }

  function trimBackups() {
    var keys = [];
    for (var i = 0; i < localStorage.length; i++) {
      var key = localStorage.key(i);
      if (key && key.indexOf(BACKUP_PREFIX) === 0) keys.push(key);
    }
    if (keys.length <= MAX_BACKUPS) return;
    keys.sort();
    keys.slice(0, keys.length - MAX_BACKUPS).forEach(function (k) {
      try { localStorage.removeItem(k); } catch (e) {}
    });
  }

  function restoreBackup(backupKey) {
    try {
      var raw = localStorage.getItem(backupKey);
      if (!raw) return { ok: false, message: 'Резервная копия не найдена' };
      var data = JSON.parse(raw);
      if (!data.entries || !Array.isArray(data.entries)) {
        return { ok: false, message: 'Неверный формат копии' };
      }
      applyEntriesRestore(data.entries);
      try {
        var oidR = typeof global.getCurrentObjectId === 'function' ? global.getCurrentObjectId() : '';
        if (oidR && data.stall_layout && typeof data.stall_layout === 'object') {
          if (global.CattleTrackerObjectData) {
            global.CattleTrackerObjectData.saveStallLayoutLocal(oidR, data.stall_layout);
          } else {
            localStorage.setItem('cattleTracker_stallLayout_' + oidR, JSON.stringify(data.stall_layout));
          }
        }
      } catch (e3) {}
      refreshAfterRestore();
      return { ok: true, count: data.entries.length };
    } catch (e) {
      return { ok: false, message: e && e.message };
    }
  }

  function applyEntriesRestore(list) {
    if (typeof global.replaceEntriesWith === 'function') {
      global.replaceEntriesWith(list);
    } else if (typeof global.entries !== 'undefined') {
      global.entries.length = 0;
      list.forEach(function (e) { global.entries.push(e); });
    }
    if (typeof saveLocally === 'function') saveLocally();
  }

  function applyFarmCardRestore(data) {
    var oid = typeof global.getCurrentObjectId === 'function' ? global.getCurrentObjectId() : 'default';
    if (global.CattleTrackerObjectData) {
      global.CattleTrackerObjectData.saveFarmProfileLocal(oid, data);
    }
    if (typeof global.saveFarmCardBundle === 'function') {
      return global.saveFarmCardBundle(data);
    }
    global.__farmCardBundle = data;
    return Promise.resolve(data);
  }

  function applyFarmSettingsRestore(data) {
    var oid = typeof global.getCurrentObjectId === 'function' ? global.getCurrentObjectId() : 'default';
    var settings = {
      technicians: data.technicians || [],
      bulls: data.bulls || [],
      drugs: data.drugs || [],
      vwpDays: data.vwpDays != null ? data.vwpDays : 60
    };
    if (global.CattleTrackerObjectData) {
      global.CattleTrackerObjectData.saveFarmSettingsLocal(oid, settings);
    }
    if (Array.isArray(data.protocols) && global.CattleTrackerObjectData) {
      global.CattleTrackerObjectData.saveProtocolsLocal(oid, data.protocols);
      if (typeof global.saveProtocols === 'function') global.saveProtocols(data.protocols);
    }
    if (global.CATTLE_TRACKER_USE_API && global.CattleTrackerApi && global.CattleTrackerApi.putFarmSettings) {
      return global.CattleTrackerApi.putFarmSettings(oid, settings).catch(function () {});
    }
    return Promise.resolve();
  }

  function refreshAfterRestore() {
    if (typeof updateViewList === 'function') updateViewList();
    if (typeof updateList === 'function') updateList();
    if (typeof updateHerdStats === 'function') updateHerdStats();
    if (typeof global.refreshFarmDatalists === 'function') global.refreshFarmDatalists();
  }

  function downloadBlob(blob, filename, jsonFallback, shareTitle) {
    var isMobile = typeof global.isMobile === 'function' && global.isMobile();
    function revokeLater(url) {
      setTimeout(function () { try { URL.revokeObjectURL(url); } catch (e) {} }, 2000);
    }
    if (isMobile && typeof navigator !== 'undefined' && navigator.share) {
      try {
        var file = new File([blob], filename, { type: blob.type || 'application/zip' });
        var canShare = typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });
        if (canShare) {
          navigator.share({ title: shareTitle || filename || 'Файл', files: [file] }).then(function () {
            if (typeof showToast === 'function') showToast('Резервная копия передана', 'success');
          }).catch(function (err) {
            if (err && err.name !== 'AbortError' && jsonFallback) showBackupCopyFallback(jsonFallback, filename);
          });
          return;
        }
      } catch (e) {}
    }
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    revokeLater(url);
    if (typeof showToast === 'function') showToast('Файл сохранён', 'success');
    if (isMobile && jsonFallback) {
      setTimeout(function () { showBackupCopyFallback(jsonFallback, filename); }, 500);
    }
  }

  function exportBackupToFile() {
    var bundle = getBundleApi();
    if (!bundle) {
      if (typeof showToast === 'function') showToast('Модуль резервной копии не загружен', 'error');
      return;
    }
    var payload = bundle.collectBackupPayloadFromWindow(global);
    var zipBytes = bundle.buildBackupZip(payload);
    var filename = bundle.backupZipFilename(payload.objectName);
    var blob = new Blob([zipBytes], { type: 'application/zip' });
    downloadBlob(blob, filename, null);
  }

  function showBackupCopyFallback(jsonStr, filename) {
    var overlay = document.createElement('div');
    overlay.className = 'backup-copy-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-label', 'Скопировать резервную копию');
    overlay.innerHTML =
      '<div class="backup-copy-modal">' +
        '<h4>Если файл не сохранился</h4>' +
        '<p>Скопируйте данные в буфер обмена и сохраните вручную.</p>' +
        '<textarea class="backup-copy-textarea" readonly rows="6"></textarea>' +
        '<div class="backup-copy-actions">' +
          '<button type="button" class="action-btn" id="backupCopyToClipboardBtn">Скопировать в буфер</button>' +
          '<button type="button" class="small-btn" data-action="close">Закрыть</button>' +
        '</div>' +
      '</div>';
    var textarea = overlay.querySelector('.backup-copy-textarea');
    if (textarea) textarea.value = jsonStr;
    overlay.querySelector('[data-action="close"]').addEventListener('click', function () {
      overlay.remove();
    });
    overlay.querySelector('#backupCopyToClipboardBtn').addEventListener('click', function () {
      try {
        textarea.select();
        document.execCommand('copy');
        if (typeof showToast === 'function') showToast('Скопировано в буфер обмена', 'success');
      } catch (e) {
        if (typeof showToast === 'function') showToast('Не удалось скопировать', 'error');
      }
    });
    document.body.appendChild(overlay);
  }

  function reportRestoreResult(r) {
    var parts = [];
    if (r.applied && r.applied.length) parts.push('Применено: ' + r.applied.join(', '));
    if (r.skipped && r.skipped.length) parts.push('Пропущено: ' + r.skipped.join(', '));
    if (r.errors && r.errors.length) parts.push('Ошибки: ' + r.errors.join('; '));
    var msg = parts.length ? parts.join('. ') : (r.ok ? 'Восстановление завершено' : 'Ошибка восстановления');
    if (typeof showToast === 'function') showToast(msg, r.ok ? 'success' : 'error', 8000);
    else alert(msg);
    return r;
  }

  function buildRestoreApplyCallbacks() {
    return {
      applyFarmCard: function (data) {
        applyFarmCardRestore(data);
      },
      applyFarmSettings: function (data) {
        applyFarmSettingsRestore(data);
      },
      applyEntries: function (data) {
        if (Array.isArray(data)) applyEntriesRestore(data);
      },
      applyStallLayout: function (data) {
        var oid = typeof global.getCurrentObjectId === 'function' ? global.getCurrentObjectId() : 'default';
        if (global.CattleTrackerObjectData) {
          global.CattleTrackerObjectData.saveStallLayoutLocal(oid, data);
        } else {
          localStorage.setItem('cattleTracker_stallLayout_' + oid, JSON.stringify(data));
        }
        if (global.CATTLE_TRACKER_USE_API && global.CattleTrackerApi && global.CattleTrackerApi.putStallLayout) {
          global.CattleTrackerApi.putStallLayout(oid, data).catch(function () {});
        }
      }
    };
  }

  function confirmRestoreLayers(present) {
    var hasCard = present.indexOf('farm-card.json') !== -1;
    var hasSettings = present.indexOf('farm-settings.json') !== -1;
    var hasHerd = present.indexOf('herd/entries.json') !== -1 || present.indexOf('herd/stall-layout.json') !== -1;
    if (!hasCard && !hasSettings && !hasHerd) {
      return Promise.resolve({ farmCard: false, farmSettings: false, herd: false });
    }
    return new Promise(function (resolve) {
      var overlay = document.createElement('div');
      overlay.className = 'sync-replace-overlay backup-restore-overlay';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-label', 'Восстановление резервной копии');
      var herdChecked = hasHerd ? ' checked' : '';
      var cardChecked = hasCard ? ' checked' : '';
      var settingsChecked = hasSettings ? ' checked' : '';
      overlay.innerHTML =
        '<div class="sync-replace-modal">' +
        '<h4>Что восстановить из архива?</h4>' +
        '<p class="farm-settings-hint">Снимите галочки, чтобы не менять соответствующие данные текущей базы.</p>' +
        '<label class="backup-restore-check"><input type="checkbox" id="backupRestoreHerd"' + herdChecked + (hasHerd ? '' : ' disabled') + '> Стадо (записи и стойломеста)</label>' +
        '<label class="backup-restore-check"><input type="checkbox" id="backupRestoreSettings"' + settingsChecked + (hasSettings ? '' : ' disabled') + '> Настройки (техники, быки, препараты, протоколы)</label>' +
        '<label class="backup-restore-check"><input type="checkbox" id="backupRestoreCard"' + cardChecked + (hasCard ? '' : ' disabled') + '> Карточка хозяйства</label>' +
        '<div class="sync-replace-actions">' +
        '<button type="button" class="small-btn" data-action="cancel">Отмена</button> ' +
        '<button type="button" class="action-btn" data-action="ok">Восстановить</button>' +
        '</div></div>';
      function close() {
        overlay.remove();
        document.body.style.overflow = '';
      }
      overlay.querySelector('[data-action="cancel"]').onclick = function () {
        close();
        resolve(null);
      };
      overlay.querySelector('[data-action="ok"]').onclick = function () {
        resolve({
          herd: !!(document.getElementById('backupRestoreHerd') && document.getElementById('backupRestoreHerd').checked),
          farmSettings: !!(document.getElementById('backupRestoreSettings') && document.getElementById('backupRestoreSettings').checked),
          farmCard: !!(document.getElementById('backupRestoreCard') && document.getElementById('backupRestoreCard').checked)
        });
        close();
      };
      overlay.addEventListener('click', function (e) {
        if (e.target === overlay) {
          close();
          resolve(null);
        }
      });
      document.body.style.overflow = 'hidden';
      document.body.appendChild(overlay);
    });
  }

  function importBackupFromFile(file) {
    return new Promise(function (resolve) {
      var bundle = getBundleApi();
      if (!file || !bundle) {
        resolve({ ok: false, message: 'Файл или модуль резервной копии недоступен' });
        return;
      }
      var name = (file.name || '').toLowerCase();
      var reader = new FileReader();
      reader.onload = function () {
        try {
          if (name.endsWith('.zip')) {
            var buf = reader.result;
            var bytes = buf instanceof ArrayBuffer ? new Uint8Array(buf) : buf;
            var inspect = bundle.inspectBackupZip ? bundle.inspectBackupZip(bytes) : { ok: true, present: [] };
            if (!inspect.ok) {
              resolve({ ok: false, message: inspect.error || 'Ошибка чтения ZIP' });
              return;
            }
            confirmRestoreLayers(inspect.present || []).then(function (layerChoice) {
              if (!layerChoice) {
                resolve({ ok: false, message: 'Отменено' });
                return;
              }
              var callbacks = buildRestoreApplyCallbacks();
              callbacks.layers = layerChoice;
              var result = bundle.restoreBackupZip(bytes, callbacks);
              refreshAfterRestore();
              var count = 0;
              if (global.entries && Array.isArray(global.entries)) count = global.entries.length;
              resolve(reportRestoreResult(Object.assign({ ok: result.ok, count: count }, result)));
            });
            return;
          }
          var legacy = bundle.parseLegacyBackupJson(String(reader.result));
          if (!legacy.entries || !Array.isArray(legacy.entries)) {
            resolve({ ok: false, message: 'Неверный формат файла' });
            return;
          }
          applyEntriesRestore(legacy.entries);
          if (legacy.stall_layout) {
            var oidL = typeof global.getCurrentObjectId === 'function' ? global.getCurrentObjectId() : 'default';
            if (global.CattleTrackerObjectData) {
              global.CattleTrackerObjectData.saveStallLayoutLocal(oidL, legacy.stall_layout);
            }
          }
          if (legacy.farm_card) applyFarmCardRestore(legacy.farm_card);
          if (legacy.farm_settings || legacy.protocols) {
            applyFarmSettingsRestore({
              technicians: legacy.farm_settings && legacy.farm_settings.technicians,
              bulls: legacy.farm_settings && legacy.farm_settings.bulls,
              drugs: legacy.farm_settings && legacy.farm_settings.drugs,
              protocols: legacy.protocols || (legacy.farm_settings && legacy.farm_settings.protocols)
            });
          }
          refreshAfterRestore();
          resolve({ ok: true, count: legacy.entries.length, applied: ['legacy entries'], skipped: [], errors: [] });
        } catch (e) {
          resolve({ ok: false, message: e && e.message });
        }
      };
      reader.onerror = function () { resolve({ ok: false, message: 'Ошибка чтения файла' }); };
      if (name.endsWith('.zip')) reader.readAsArrayBuffer(file);
      else reader.readAsText(file, 'UTF-8');
    });
  }

  function deleteBackup(backupKey) {
    try {
      localStorage.removeItem(backupKey);
      return { ok: true };
    } catch (e) {
      return { ok: false, message: e && e.message };
    }
  }

  function renderBackupUI(containerId) {
    var container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML =
      '<div class="backup-actions-compact">' +
        '<button type="button" class="action-btn backup-btn" id="backupCreateBtn">Создать резервную копию</button>' +
        '<label class="action-btn backup-btn backup-restore-label" tabindex="0">Восстановить<input type="file" id="backupImportInput" accept=".zip,.json" style="display:none"></label>' +
      '</div>';
    var createBtn = document.getElementById('backupCreateBtn');
    var importInput = document.getElementById('backupImportInput');
    if (createBtn) {
      createBtn.addEventListener('click', exportBackupToFile);
    }
    if (importInput) {
      importInput.addEventListener('change', function () {
        var file = importInput.files && importInput.files[0];
        if (!file) return;
        importBackupFromFile(file).then(function (r) {
          if (!r.ok && r.message && typeof showToast === 'function') {
            showToast(r.message, 'error');
          }
          importInput.value = '';
        });
      });
    }
  }

  if (typeof global !== 'undefined') {
    global.downloadBlob = downloadBlob;
    global.createBackup = createBackup;
    global.listBackups = listBackups;
    global.restoreBackup = restoreBackup;
    global.exportBackupToFile = exportBackupToFile;
    global.importBackupFromFile = importBackupFromFile;
    global.renderBackupUI = renderBackupUI;
  }
})(typeof window !== 'undefined' ? window : this);
export {};
