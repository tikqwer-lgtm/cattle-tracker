/**
 * Запуск e2e для Electron с сохранением полного лога в файл.
 * Лог: test-results/e2e-log.txt (удобно передать или приложить к отчёту).
 * Использование: npm run e2e:electron:log
 *               npm run e2e:electron:log -- --reporter=line
 */
process.env.E2E_ELECTRON = '1';
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const root = path.join(__dirname, '..');
const logDir = path.join(root, 'test-results');
const logFile = path.join(logDir, 'e2e-log.txt');

if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
const logStream = fs.createWriteStream(logFile, { flags: 'w' });

const stamp = () => new Date().toISOString();
logStream.write(`=== E2E Electron, запуск ${stamp()} ===\n\n`);
console.log('Лог пишется в:', logFile);

const args = ['playwright', 'test', '--project=electron'];
const rest = process.argv.slice(2);
if (!rest.includes('--ui') && !rest.some(a => a.startsWith('--reporter'))) {
  args.push('--reporter=list');
}
args.push(...rest);

const child = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', args, {
  stdio: ['inherit', 'pipe', 'pipe'],
  shell: true,
});

function write(data, out) {
  const s = data.toString();
  logStream.write(s);
  out.write(s);
}

child.stdout.on('data', (d) => write(d, process.stdout));
child.stderr.on('data', (d) => write(d, process.stderr));

child.on('close', (code) => {
  logStream.write(`\n=== Завершение ${stamp()}, код ${code} ===\n`);
  logStream.end();
  process.exit(code || 0);
});
child.on('error', (err) => {
  logStream.write(`Ошибка: ${err.message}\n`);
  logStream.end();
  process.exit(1);
});
