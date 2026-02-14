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
  const template = [
    { role: 'fileMenu' },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    {
      label: 'Справка',
      submenu: [
        {
          label: 'Проверить обновления',
          click: () => {
            if (autoUpdater && app.isPackaged) {
              autoUpdater.checkForUpdates().then((r) => {
                if (r && r.updateInfo) {
                  dialog.showMessageBox(mainWindow, {
                    type: 'info',
                    title: 'Обновление',
                    message: 'Доступна версия ' + (r.updateInfo.version || '') + '. Скачивание…'
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
        }
      ]
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
      preload: path.join(__dirname, 'preload.js')
    },
    title: 'Учёт коров',
    icon: path.join(isDev ? rootDir : __dirname, 'favicon.ico')
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

  ipcMain.on('set-window-mode', (_event, mode) => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const primary = screen.getPrimaryDisplay();
    const work = primary.workArea;
    if (mode === 'menu') {
      const maxW = Math.min(560, work.width);
      const maxH = Math.min(680, work.height);
      mainWindow.setMaximumSize(maxW, maxH);
    } else {
      mainWindow.setMaximumSize(16384, 16384);
    }
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
