/**
 * Electron main process — открывает окно с приложением Учёт коров.
 * Загружает index.html из родительской папки (cattle-tracker).
 * Для работы с API укажите адрес сервера в приложении (экран входа).
 */
const { app, BrowserWindow, Menu, dialog, ipcMain } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');

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
  const sendProgress = (data) => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('update-download-progress', data);
  };
  const sendPath = (downloadDir) => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('update-download-path', downloadDir);
  };
  autoUpdater.on('update-available', () => {
    sendPath(app.getPath('userData'));
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Обновление',
      message: 'Доступна новая версия. Скачивание в фоне…'
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
  autoUpdater.checkForUpdates().catch(() => {});
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
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
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

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  createAppMenu();
  setupAutoUpdater();
}

ipcMain.handle('check-for-updates', () => {
  if (!app.isPackaged) return Promise.resolve({ ok: false, dev: true });
  if (!autoUpdater) return Promise.resolve({ ok: false, error: 'Модуль обновлений не загружен' });
  return autoUpdater.checkForUpdates().then((r) => {
    if (r && r.updateInfo) return { ok: true, version: r.updateInfo.version };
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
