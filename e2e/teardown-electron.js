/**
 * Global teardown: принудительно завершает процесс на порту 9222 (Electron CDP).
 * Playwright вызывает эту функцию после всех тестов.
 */
const { execSync } = require('child_process');

const PORT = 9222;

function killProcessOnPort() {
  if (process.platform === 'win32') {
    try {
      const out = execSync('netstat -ano -p TCP', { encoding: 'utf8', windowsHide: true });
      const lines = out.split(/\r?\n/).filter((l) => l.includes(`:${PORT}`) && l.includes('LISTENING'));
      const pids = new Set();
      for (const line of lines) {
        const m = line.trim().split(/\s+/);
        const pid = m[m.length - 1];
        if (pid && /^\d+$/.test(pid)) pids.add(pid);
      }
      for (const pid of pids) {
        try {
          execSync(`taskkill /F /T /PID ${pid}`, { stdio: 'ignore', windowsHide: true });
        } catch (e) {}
      }
    } catch (e) {}
  } else {
    try {
      execSync(`lsof -ti:${PORT} | xargs kill -9 2>/dev/null`, { stdio: 'ignore' });
    } catch (e) {}
  }
}

module.exports = async function () {
  killProcessOnPort();
};
