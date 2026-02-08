/**
 * Electron main process — открывает окно с приложением Учёт коров.
 * Загружает index.html из родительской папки (cattle-tracker).
 * Для работы с API включите в index.html: CATTLE_TRACKER_USE_API = true и укажите CATTLE_TRACKER_API_BASE.
 */
const { app, BrowserWindow } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
const rootDir = path.join(__dirname, '..');
const indexPath = isDev
  ? path.join(rootDir, 'index.html')
  : path.join(__dirname, 'index.html');

// Отключаем Service Worker — с file:// и в сборке он ломает загрузку (пустое окно, "Not allowed to load local resource")
app.commandLine.appendSwitch('disable-features', 'ServiceWorker');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    minWidth: 400,
    minHeight: 400,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false
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
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) createWindow();
});
