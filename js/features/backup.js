/**
 * backup.js — Резервное копирование и восстановление
 */
(function (global) {
  'use strict';

  var BACKUP_PREFIX = 'cattleTracker_backup_';
  var MAX_BACKUPS = 10;

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
      var entries = typeof window.entries !== 'undefined' ? window.entries : [];
      var stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      var key = BACKUP_PREFIX + stamp;
      var payload = {
        entries: JSON.parse(JSON.stringify(entries)),
        createdAt: new Date().toISOString(),
        count: entries.length
      };
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
      if (typeof window.entries !== 'undefined') {
        window.entries.length = 0;
        data.entries.forEach(function (e) { window.entries.push(e); });
      }
      if (typeof saveLocally === 'function') saveLocally();
      if (typeof updateViewList === 'function') updateViewList();
      if (typeof updateList === 'function') updateList();
      if (typeof updateHerdStats === 'function') updateHerdStats();
      return { ok: true, count: data.entries.length };
    } catch (e) {
      return { ok: false, message: e && e.message };
    }
  }

  function exportBackupToFile() {
    var entries = typeof window.entries !== 'undefined' ? window.entries : [];
    var payload = {
      entries: entries,
      exportedAt: new Date().toISOString(),
      count: entries.length
    };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'cattle-tracker-backup-' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  function importBackupFromFile(file) {
    return new Promise(function (resolve) {
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var data = JSON.parse(reader.result);
          var list = data.entries || (Array.isArray(data) ? data : []);
          if (!Array.isArray(list)) {
            resolve({ ok: false, message: 'Неверный формат файла' });
            return;
          }
          if (typeof window.entries !== 'undefined') {
            window.entries.length = 0;
            list.forEach(function (e) { window.entries.push(e); });
          }
          if (typeof saveLocally === 'function') saveLocally();
          if (typeof updateViewList === 'function') updateViewList();
          if (typeof updateList === 'function') updateList();
          if (typeof updateHerdStats === 'function') updateHerdStats();
          resolve({ ok: true, count: list.length });
        } catch (e) {
          resolve({ ok: false, message: e && e.message });
        }
      };
      reader.onerror = function () { resolve({ ok: false, message: 'Ошибка чтения файла' }); };
      reader.readAsText(file, 'UTF-8');
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
    var backups = listBackups();
    container.innerHTML =
      '<div class="backup-actions">' +
        '<button type="button" class="action-btn small" id="backupCreateBtn">Создать резервную копию</button>' +
        '<button type="button" class="action-btn small" id="backupExportBtn">Экспорт в файл</button>' +
        '<label class="backup-import-label">Импорт из файла <input type="file" id="backupImportInput" accept=".json" style="display:none"></label>' +
      '</div>' +
      '<div class="backup-list-header">Сохранённые копии (localStorage)</div>' +
      '<ul class="backup-list">' +
        (backups.length === 0
          ? '<li class="backup-item backup-empty">Нет сохранённых копий</li>'
          : backups.map(function (b) {
              return '<li class="backup-item">' +
                '<span class="backup-info">' + (b.createdAt || b.key) + ' — записей: ' + (b.count || 0) + '</span>' +
                '<div class="backup-item-actions">' +
                  '<button type="button" class="small-btn" data-restore="' + b.key + '">Восстановить</button>' +
                  '<button type="button" class="small-btn delete" data-delete="' + b.key + '">Удалить</button>' +
                '</div></li>';
            }).join('')) +
      '</ul>';
    var createBtn = document.getElementById('backupCreateBtn');
    var exportBtn = document.getElementById('backupExportBtn');
    var importInput = document.getElementById('backupImportInput');
    if (createBtn) {
      createBtn.addEventListener('click', function () {
        var r = createBackup();
        if (r.ok) {
          if (typeof showToast === 'function') showToast('Копия создана, записей: ' + r.count, 'success');
          else alert('Копия создана');
          renderBackupUI(containerId);
        } else {
          if (typeof showToast === 'function') showToast(r.message || 'Ошибка', 'error');
          else alert(r.message);
        }
      });
    }
    if (exportBtn) exportBtn.addEventListener('click', exportBackupToFile);
    if (importInput) {
      importInput.addEventListener('change', function () {
        var file = importInput.files && importInput.files[0];
        if (!file) return;
        importBackupFromFile(file).then(function (r) {
          if (r.ok) {
            if (typeof showToast === 'function') showToast('Восстановлено записей: ' + r.count, 'success');
            else alert('Восстановлено');
            renderBackupUI(containerId);
          } else {
            if (typeof showToast === 'function') showToast(r.message || 'Ошибка', 'error');
            else alert(r.message);
          }
          importInput.value = '';
        });
      });
    }
    container.querySelectorAll('[data-restore]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var key = btn.getAttribute('data-restore');
        function doRestore() {
          var r = restoreBackup(key);
          if (r.ok) {
            if (typeof showToast === 'function') showToast('Восстановлено записей: ' + r.count, 'success');
            else alert('Восстановлено');
            renderBackupUI(containerId);
          } else {
            if (typeof showToast === 'function') showToast(r.message || 'Ошибка', 'error');
            else alert(r.message);
          }
        }
        if (typeof showConfirmModal === 'function') {
          showConfirmModal('Восстановить эту копию? Текущие данные будут заменены.').then(function (ok) { if (ok) doRestore(); });
          return;
        }
        if (!confirm('Восстановить эту копию? Текущие данные будут заменены.')) return;
        doRestore();
      });
    });
    container.querySelectorAll('[data-delete]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var key = btn.getAttribute('data-delete');
        deleteBackup(key);
        renderBackupUI(containerId);
      });
    });
  }

  if (typeof window !== 'undefined') {
    window.createBackup = createBackup;
    window.listBackups = listBackups;
    window.restoreBackup = restoreBackup;
    window.exportBackupToFile = exportBackupToFile;
    window.importBackupFromFile = importBackupFromFile;
    window.renderBackupUI = renderBackupUI;
  }
})(typeof window !== 'undefined' ? window : this);
