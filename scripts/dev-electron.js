/**
 * Запуск Electron с Vite HMR (нужен отдельно npm run dev на :5173).
 */
const { spawn } = require('child_process');
const path = require('path');

const env = { ...process.env, CATTLE_TRACKER_VITE_DEV: '1' };
const child = spawn('npm', ['run', 'electron'], {
  cwd: path.join(__dirname, '..'),
  env,
  stdio: 'inherit',
  shell: true
});
child.on('exit', (code) => process.exit(code || 0));
