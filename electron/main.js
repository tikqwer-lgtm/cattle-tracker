/**
 * Electron main process — открывает окно с приложением Учёт коров.
 * Загружает index.html из родительской папки (cattle-tracker).
 * Для работы с API укажите адрес сервера в приложении (экран входа).
 */
const { app, BrowserWindow, Menu, dialog, ipcMain, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { pathToFileURL } = require('url');

const WINDOW_STATE_FILE = 'window-state.json';

function getWindowStatePath() {
  return path.join(app.getPath('userData'), WINDOW_STATE_FILE);
}

function loadWindowState() {
  try {
    const filePath = getWindowStatePath();
    if (!fs.existsSync(filePath)) return null;
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (!data || typeof data.width !== 'number' || typeof data.height !== 'number') return null;
    const width = Math.max(400, Math.min(data.width, 4096));
    const height = Math.max(400, Math.min(data.height, 4096));
    let x = typeof data.x === 'number' ? data.x : 0;
    let y = typeof data.y === 'number' ? data.y : 0;
    const primary = screen.getPrimaryDisplay();
    const work = primary.workArea;
    x = Math.max(work.x, Math.min(x, work.x + work.width - 100));
    y = Math.max(work.y, Math.min(y, work.y + work.height - 100));
    return { x, y, width, height };
  } catch (e) {
    return null;
  }
}

function saveWindowState(win) {
  if (!win || win.isDestroyed()) return;
  try {
    const bounds = win.getBounds();
    const filePath = getWindowStatePath();
    fs.writeFileSync(filePath, JSON.stringify({
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height
    }), 'utf8');
  } catch (e) {
    console.warn('Save window state failed:', e.message);
  }
}

let autoUpdater;
if (app.isPackaged) {
  try {
    autoUpdater = require('electron-updater').autoUpdater;
    autoUpdater.setFeedURL({ provider: 'github', owner: 'tikqwer-lgtm', repo: 'cattle-tracker' });
  } catch (e) {
    console.warn('electron-updater not available:', e.message);
  }
}

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
const rootDir = path.join(__dirname, '..');
const indexPath = isDev
  ? path.join(rootDir, 'index.html')
  : path.join(__dirname, 'index.html');

// Отключаем Service Worker — с file:// и в сборке он ломает загрузку (пустое окно, "Not allowed to load local resource")
app.commandLine.appendSwitch('disable-features', 'ServiceWorker');

let mainWindow;
/** Показывать пункт «Консоль разработчика» в меню только после входа (см. IPC cattle-tracker-auth-menu). */
let authenticatedForDevtoolsMenu = false;

const MAX_DEVTOOLS_DIAGNOSTICS = 1200;
const devtoolsDiagnosticsLog = [];
/** Логировать focus/blur окна только вскоре после событий DevTools (меньше шума). */
let lastDevtoolsRelatedActivityMs = 0;
function markDevtoolsRelatedActivity() {
  lastDevtoolsRelatedActivityMs = Date.now();
}

function recordDevtoolsDiagnostic(source, message, extra) {
  const entry = {
    ts: new Date().toISOString(),
    source: String(source || 'main'),
    message: String(message || ''),
    extra: extra !== undefined && extra !== null ? extra : null
  };
  devtoolsDiagnosticsLog.push(entry);
  if (devtoolsDiagnosticsLog.length > MAX_DEVTOOLS_DIAGNOSTICS) {
    devtoolsDiagnosticsLog.splice(0, devtoolsDiagnosticsLog.length - MAX_DEVTOOLS_DIAGNOSTICS);
  }
  if (source === 'webContents' && (message === 'devtools-opened' || message === 'devtools-closed')) {
    markDevtoolsRelatedActivity();
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    try {
      if (!mainWindow.webContents.isDestroyed()) {
        mainWindow.webContents.send('devtools-diagnostics-entry', entry);
      }
    } catch (e) {
      // ignore
    }
  }
}

ipcMain.handle('devtools-diagnostics-get-history', () => devtoolsDiagnosticsLog.slice());

ipcMain.on('devtools-diagnostics-clear', () => {
  devtoolsDiagnosticsLog.length = 0;
});

ipcMain.on('devtools-diagnostics-renderer-snapshot', (_event, data) => {
  if (!data || typeof data !== 'object') return;
  recordDevtoolsDiagnostic(
    'renderer→main',
    String(data.label || 'snapshot'),
    data.payload != null ? data.payload : null
  );
});

/** Не запускать второй flash, пока первый не завершился (иначе несколько closeDevTools подряд и лишние blur/focus). */
let devtoolsFlashWorkaroundInProgress = false;

/**
 * Кратко открыть и закрыть DevTools — тот же обход, что и через меню (≈1 с), восстанавливает ввод в упакованной сборке.
 * @param {import('electron').BrowserWindow} win
 * @param {number} delayBeforeOpenMs задержка перед открытием (мс), чтобы страница успела отрисоваться
 * @param {string} [reason] метка для диагностики
 */
function flashDevToolsHitTestWorkaround(win, delayBeforeOpenMs, reason) {
  if (!win || win.isDestroyed()) return;
  const why = reason || 'unspecified';
  if (devtoolsFlashWorkaroundInProgress) {
    recordDevtoolsDiagnostic('workaround', 'flashDevToolsHitTestWorkaround: пропуск (уже выполняется)', {
      reason: why,
      delayBeforeOpenMs
    });
    return;
  }
  devtoolsFlashWorkaroundInProgress = true;
  markDevtoolsRelatedActivity();
  recordDevtoolsDiagnostic('workaround', 'flashDevToolsHitTestWorkaround: scheduled', {
    reason: why,
    delayBeforeOpenMs,
    isPackaged: app.isPackaged,
    isDev
  });
  const releaseFlashLock = () => {
    setTimeout(() => {
      devtoolsFlashWorkaroundInProgress = false;
    }, 400);
  };
  const openAndClose = () => {
    if (win.isDestroyed()) {
      devtoolsFlashWorkaroundInProgress = false;
      return;
    }
    recordDevtoolsDiagnostic('workaround', 'flash: перед win.focus', snapshotWindowState(win));
    win.focus();
    recordDevtoolsDiagnostic('workaround', 'flash: после win.focus', snapshotWindowState(win));
    win.webContents.focus();
    recordDevtoolsDiagnostic('workaround', 'flash: после webContents.focus', snapshotWindowState(win));
    win.webContents.openDevTools({ mode: 'detach' });
    /* isDevToolsOpened() часто ещё false в тот же тик — это нормально, окно открывается асинхронно */
    setTimeout(() => {
      if (!win.isDestroyed()) {
        recordDevtoolsDiagnostic('workaround', 'flash: после openDevTools (тик 0)', snapshotWindowState(win));
      }
    }, 0);
    setTimeout(() => {
      if (win.isDestroyed()) {
        devtoolsFlashWorkaroundInProgress = false;
        return;
      }
      recordDevtoolsDiagnostic('workaround', 'flash: перед closeDevTools (через 1000 мс)', snapshotWindowState(win));
      win.webContents.closeDevTools();
      releaseFlashLock();
      setTimeout(() => {
        if (!win.isDestroyed()) {
          recordDevtoolsDiagnostic('workaround', 'flash: через 50 мс после closeDevTools', snapshotWindowState(win));
        }
      }, 50);
      setTimeout(() => {
        if (!win.isDestroyed()) {
          recordDevtoolsDiagnostic('workaround', 'flash: через 300 мс после closeDevTools', snapshotWindowState(win));
        }
      }, 300);
    }, 1000);
  };
  if (delayBeforeOpenMs > 0) {
    setTimeout(() => {
      if (win.isDestroyed()) {
        devtoolsFlashWorkaroundInProgress = false;
        return;
      }
      openAndClose();
    }, delayBeforeOpenMs);
  } else {
    openAndClose();
  }
}

function snapshotWindowState(win) {
  if (!win || win.isDestroyed()) return { destroyed: true };
  try {
    return {
      isFocused: win.isFocused(),
      bounds: win.getBounds(),
      devToolsOpened: win.webContents.isDevToolsOpened(),
      url: win.webContents.getURL()
    };
  } catch (e) {
    return { error: String(e && e.message) };
  }
}

function setupAutoUpdater() {
  if (!autoUpdater || !app.isPackaged) return;
  autoUpdater.autoDownload = false;
  const sendProgress = (data) => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('update-download-progress', data);
  };
  const sendPath = (downloadDir) => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('update-download-path', downloadDir);
  };
  autoUpdater.on('update-available', (info) => {
    const newVer = (info && info.version) ? String(info.version).trim() : '';
    const currentVer = app.getVersion() ? String(app.getVersion()).trim() : '';
    if (!newVer || newVer === currentVer) return;
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Обновление',
      message: 'Доступна новая версия ' + newVer + '. Разрешить скачивание?',
      buttons: ['Скачать', 'Позже']
    }).then(({ response }) => {
      if (response === 0) {
        sendPath(app.getPath('userData'));
        autoUpdater.downloadUpdate().catch((err) => console.warn('downloadUpdate error:', err));
      }
    }).catch(() => {});
  });
  autoUpdater.on('download-progress', (progress) => {
    sendProgress({
      percent: Math.round(progress.percent || 0),
      transferred: progress.transferred || 0,
      total: progress.total || 0,
      bytesPerSecond: progress.bytesPerSecond || 0
    });
  });
  autoUpdater.on('update-downloaded', () => {
    sendProgress({ percent: 100, done: true });
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Обновление',
      message: 'Обновление загружено. Перезапустить приложение сейчас?',
      buttons: ['Перезапустить', 'Позже']
    }).then(({ response }) => {
      if (response === 0) autoUpdater.quitAndInstall(false, true);
    }).catch(() => {});
  });
  autoUpdater.on('error', (err) => {
    console.warn('Auto-update error:', err);
  });
}

function createAppMenu() {
  const devtoolsAccelerator = process.platform === 'darwin' ? 'Alt+Command+I' : 'Control+Shift+I';
  const helpSubmenu = [];
  if (authenticatedForDevtoolsMenu) {
    helpSubmenu.push({
      label: 'Восстановить ввод: консоль 1 с',
      accelerator: devtoolsAccelerator,
      click: () => {
        const win = BrowserWindow.getFocusedWindow() || mainWindow;
        markDevtoolsRelatedActivity();
        recordDevtoolsDiagnostic('nativeMenu', 'клик: «Восстановить ввод: консоль 1 с»', snapshotWindowState(win));
        flashDevToolsHitTestWorkaround(win, 0, 'native-menu-vosstanovit-vvod');
      }
    });
    helpSubmenu.push({ type: 'separator' });
  }
  helpSubmenu.push({
    label: 'Проверить обновления',
    click: () => {
      if (autoUpdater && app.isPackaged) {
        const currentVer = app.getVersion();
        autoUpdater.checkForUpdates().then((r) => {
          const newVer = r && r.updateInfo && r.updateInfo.version ? String(r.updateInfo.version).trim() : '';
          const hasNewer = newVer && isVersionNewer(newVer, currentVer);
          if (hasNewer) {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'Обновление',
              message: 'Доступна новая версия ' + newVer + '. Разрешите скачивание в следующем окне.'
            }).catch(() => {});
          } else {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'Обновления',
              message: 'Установлена последняя версия.'
            }).catch(() => {});
          }
        }).catch(() => {
          dialog.showMessageBox(mainWindow, {
            type: 'info',
            title: 'Обновления',
            message: 'Не удалось проверить обновления.'
          }).catch(() => {});
        });
      } else {
        dialog.showMessageBox(mainWindow, {
          type: 'info',
          title: 'Обновления',
          message: 'В режиме разработки проверка обновлений недоступна.'
        }).catch(() => {});
      }
    }
  });

  const template = [
    { role: 'fileMenu' },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    {
      label: 'Справка',
      submenu: helpSubmenu
    }
  ];
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function createWindow() {
  const primary = screen.getPrimaryDisplay();
  const work = primary.workArea;
  const state = loadWindowState();
  const width = state ? state.width : Math.min(900, work.width);
  const height = state ? state.height : Math.min(700, work.height);
  const x = state ? state.x : work.x + Math.max(0, Math.floor((work.width - width) / 2));
  const y = state ? state.y : work.y + Math.max(0, Math.floor((work.height - height) / 2));

  mainWindow = new BrowserWindow({
    x: x,
    y: y,
    width: width,
    height: height,
    minWidth: 400,
    minHeight: 400,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      preload: path.join(__dirname, 'preload.js'),
      backgroundThrottling: false
    },
    title: 'Учёт коров',
    icon: path.join(isDev ? rootDir : __dirname, 'favicon.ico')
  });

  mainWindow.webContents.on('devtools-opened', () => {
    recordDevtoolsDiagnostic('webContents', 'devtools-opened', snapshotWindowState(mainWindow));
  });
  mainWindow.webContents.on('devtools-closed', () => {
    recordDevtoolsDiagnostic('webContents', 'devtools-closed', snapshotWindowState(mainWindow));
  });
  mainWindow.on('focus', () => {
    if (Date.now() - lastDevtoolsRelatedActivityMs < 45000) {
      recordDevtoolsDiagnostic('BrowserWindow', 'focus', { isFocused: true });
    }
  });
  mainWindow.on('blur', () => {
    if (Date.now() - lastDevtoolsRelatedActivityMs < 45000) {
      recordDevtoolsDiagnostic('BrowserWindow', 'blur', { isFocused: false });
    }
  });

  mainWindow.webContents.on('context-menu', (event, params) => {
    mainWindow.focus();
    mainWindow.webContents.focus();
    var x = params.x;
    var y = params.y;
    if (typeof x !== 'number' || typeof y !== 'number') return;
    var script =
      '(function(){' +
      'var x=' + x + ',y=' + y + ';' +
      'function rep(){try{if(typeof window.softRepaintCattleTrackerView==="function")window.softRepaintCattleTrackerView();}catch(e){}}' +
      'function tryFocus(){' +
      'var el=document.elementFromPoint(x,y);' +
      'if(!el)return;' +
      'var t=el.closest&&el.closest("input:not([type=hidden]):not([type=button]):not([type=submit]):not([type=reset]),textarea,select");' +
      'if(t){t.focus({preventScroll:true});rep();return;}' +
      'if(el.isContentEditable){el.focus({preventScroll:true});rep();}' +
      '}' +
      'tryFocus();' +
      'setTimeout(tryFocus,0);' +
      'if(typeof requestAnimationFrame==="function")requestAnimationFrame(tryFocus);' +
      '})();';
    mainWindow.webContents.executeJavaScript(script).catch(function () {});
  });

  mainWindow.on('maximize', () => {
    const display = screen.getDisplayMatching(mainWindow.getBounds());
    mainWindow.setBounds(display.workArea);
  });

  mainWindow.on('close', () => {
    saveWindowState(mainWindow);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  ipcMain.on('set-window-mode', (_event, _mode) => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.setMaximumSize(16384, 16384);
  });

  const ses = mainWindow.webContents.session;
  ses.clearStorageData({ storages: ['serviceworkers', 'cachestorage'] }).then(() => {
    mainWindow.loadFile(indexPath).catch((err) => {
      console.error('loadFile failed:', err);
      mainWindow.loadURL(pathToFileURL(indexPath).href);
    });
  });

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  createAppMenu();
  setupAutoUpdater();
}

ipcMain.on('cattle-tracker-auth-menu', (_event, authenticated) => {
  authenticatedForDevtoolsMenu = !!authenticated;
  createAppMenu();
});

/** После входа в приложение: кратко открыть/закрыть DevTools (упакованная сборка). */
ipcMain.on('cattle-tracker-post-auth-flash', () => {
  markDevtoolsRelatedActivity();
  recordDevtoolsDiagnostic('ipc', 'cattle-tracker-post-auth-flash получен', {
    isDev,
    hasWindow: !!(mainWindow && !mainWindow.isDestroyed())
  });
  if (isDev || !mainWindow || mainWindow.isDestroyed()) return;
  flashDevToolsHitTestWorkaround(mainWindow, 150, 'ipc-post-auth');
});

ipcMain.handle('get-app-version', () => Promise.resolve(app.getVersion()));

ipcMain.handle('get-os-username', () => {
  try {
    return Promise.resolve((os.userInfo && os.userInfo().username) || process.env.USERNAME || process.env.USER || 'local');
  } catch (e) {
    return Promise.resolve('local');
  }
});

function isVersionNewer(newVer, currentVer) {
  if (!newVer || !currentVer) return false;
  const n = String(newVer).trim().split(/[.-]/).map((x) => parseInt(x, 10) || 0);
  const c = String(currentVer).trim().split(/[.-]/).map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(n.length, c.length); i++) {
    const a = n[i] || 0;
    const b = c[i] || 0;
    if (a > b) return true;
    if (a < b) return false;
  }
  return false;
}

ipcMain.handle('check-for-updates', () => {
  if (!app.isPackaged) return Promise.resolve({ ok: false, dev: true });
  if (!autoUpdater) return Promise.resolve({ ok: false, error: 'Модуль обновлений не загружен' });
  return autoUpdater.checkForUpdates().then((r) => {
    const currentVer = app.getVersion();
    if (r && r.updateInfo && r.updateInfo.version && isVersionNewer(r.updateInfo.version, currentVer)) {
      return { ok: true, version: r.updateInfo.version };
    }
    return { ok: true, current: true };
  }).catch((err) => ({
    ok: false,
    error: (err && err.message) ? err.message : 'Ошибка при проверке'
  }));
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) createWindow();
});
