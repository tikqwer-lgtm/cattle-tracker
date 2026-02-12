const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  onUpdateDownloadProgress: (cb) => {
    ipcRenderer.on('update-download-progress', (_e, data) => cb(data));
  },
  onUpdateDownloadPath: (cb) => {
    ipcRenderer.on('update-download-path', (_e, path) => cb(path));
  },
  setWindowMode: (mode) => ipcRenderer.send('set-window-mode', mode)
});
