/**
 * Electron main process — открывает окно с приложением Учёт коров.
 * Загружает index.html из родительской папки (cattle-tracker).
 * Для работы с API включите в index.html: CATTLE_TRACKER_USE_API = true и укажите CATTLE_TRACKER_API_BASE.
 */
const { app, BrowserWindow } = require('electron');
const path = require('path');

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
const rootDir = path.join(__dirname, '..');
const indexUrl = isDev
  ? 'file://' + path.join(rootDir, 'index.html').replace(/\\/g, '/')
  : 'file://' + path.join(__dirname, 'index.html').replace(/\\/g, '/');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    minWidth: 400,
    minHeight: 400,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    },
    title: 'Учёт коров',
    icon: path.join(rootDir, 'favicon.ico')
  });

  mainWindow.loadURL(indexUrl).catch(() => {
    mainWindow.loadURL('file://' + path.join(rootDir, 'index.html'));
  });

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) createWindow();
});
