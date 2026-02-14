/**
 * Запускает приложение Electron с портом отладки для Playwright (CDP).
 * Путь к exe (по приоритету):
 * 1) переменная ELECTRON_EXE
 * 2) первая строка файла e2e/electron-exe-path.txt (папка или полный путь к exe)
 * 3) сборка electron/dist/win-unpacked/Учёт коров.exe
 */
const path = require('path');
const fs = require('fs');
const { spawn, execSync } = require('child_process');

const port = 9222;
const root = path.join(__dirname, '..');
const EXE_NAME = 'Учёт коров.exe';

let exe = process.env.ELECTRON_EXE;
if (!exe) {
  const pathFile = path.join(__dirname, 'electron-exe-path.txt');
  if (fs.existsSync(pathFile)) {
    const raw = fs.readFileSync(pathFile, 'utf8').replace(/\uFEFF/g, '');
    const line = raw.split(/\r?\n/)[0].trim();
    if (line) {
      exe = path.isAbsolute(line) ? line : path.resolve(root, line);
      if (process.platform === 'win32' && fs.existsSync(exe) && fs.statSync(exe).isDirectory()) {
        exe = path.join(exe, EXE_NAME);
      } else if (process.platform === 'win32' && !exe.endsWith('.exe') && fs.existsSync(path.join(exe, EXE_NAME))) {
        exe = path.join(exe, EXE_NAME);
      }
    }
  }
}
if (!exe) {
  if (process.platform === 'win32') {
    exe = path.join(root, 'electron', 'dist', 'win-unpacked', EXE_NAME);
  } else if (process.platform === 'darwin') {
    exe = path.join(root, 'electron', 'dist', 'mac', 'Учёт коров.app', 'Contents', 'MacOS', 'Учёт коров');
  } else {
    exe = path.join(root, 'electron', 'dist', 'linux-unpacked', 'учёт-коров');
  }
}

// Без shell — путь с кириллицей не искажается в cmd
const child = spawn(exe, ['--remote-debugging-port=' + port], {
  cwd: path.dirname(exe),
  stdio: 'inherit',
  shell: false,
});

child.on('error', (err) => {
  console.error('Не удалось запустить Electron:', err.message);
  console.error('Путь:', exe);
  console.error('Соберите приложение: npm run electron:dist (в корне проекта)');
  process.exit(1);
});

let exitTimer;
function killChild() {
  if (!child || child.killed) return;
  try {
    if (process.platform === 'win32') {
      // Electron на Windows — несколько процессов; /T убивает дерево (окно закроется)
      execSync(`taskkill /F /T /PID ${child.pid}`, { stdio: 'ignore', windowsHide: true });
    } else {
      child.kill('SIGTERM');
    }
  } catch (e) {
    try { child.kill('SIGKILL'); } catch (e2) {}
  }
}

function doExit(code) {
  if (exitTimer) clearTimeout(exitTimer);
  process.exit(code || 0);
}

child.on('exit', (code) => {
  doExit(code || 0);
});

process.on('SIGINT', () => {
  killChild();
  exitTimer = setTimeout(doExit, 2000);
});
process.on('SIGTERM', () => {
  killChild();
  // Если Electron не завершится за 2 с — выходим сами, чтобы Playwright не висел
  exitTimer = setTimeout(doExit, 2000);
});
process.on('exit', killChild);
