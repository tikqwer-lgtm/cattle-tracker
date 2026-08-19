/**
 * Non-interactive deploy via ssh2 (password from server/deploy.env).
 * Usage: node server/scripts/deploy-node.js
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { Client } = require('ssh2');

const scriptDir = __dirname;
const serverRoot = path.join(scriptDir, '..');
const projectRoot = path.join(serverRoot, '..');

const EXCLUDE = new Set([
  'node_modules',
  'data',
  'server-address.txt',
  'server-address.example.txt',
  'deploy.env',
  'deploy.env.example',
  'scripts',
]);

function readEnvFile(filePath) {
  const map = {};
  if (!fs.existsSync(filePath)) return map;
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 1) continue;
    let value = trimmed.slice(eq + 1).trim();
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }
    map[trimmed.slice(0, eq).trim()] = value;
  }
  return map;
}

function loadConfig() {
  const envMap = {};
  for (const p of [
    path.join(projectRoot, '.env'),
    path.join(projectRoot, '.env.local'),
    path.join(serverRoot, 'deploy.env'),
  ]) {
    Object.assign(envMap, readEnvFile(p));
  }

  const addrFile = path.join(serverRoot, 'server-address.txt');
  if (!fs.existsSync(addrFile)) {
    throw new Error('Create server/server-address.txt from server-address.example.txt');
  }
  const addrContent = fs.readFileSync(addrFile, 'utf8');
  const ipMatch = addrContent.match(/SERVER_IP=(.+)/);
  const userMatch = addrContent.match(/USER=(.+)/);
  const serverIp = ipMatch ? ipMatch[1].trim() : '';
  const user = userMatch ? userMatch[1].trim() : 'root';
  if (!serverIp) throw new Error('Set SERVER_IP= in server/server-address.txt');

  const password = envMap.CATTLE_TRACKER_SSH_PASSWORD || process.env.CATTLE_TRACKER_SSH_PASSWORD;
  if (!password) {
    throw new Error('Set CATTLE_TRACKER_SSH_PASSWORD in server/deploy.env');
  }

  return { serverIp, user, password };
}

function copyDeployTree(destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  for (const name of fs.readdirSync(serverRoot)) {
    if (EXCLUDE.has(name)) continue;
    fs.cpSync(path.join(serverRoot, name), path.join(destDir, name), { recursive: true });
  }
  const scriptsSrc = path.join(serverRoot, 'scripts');
  const scriptsDest = path.join(destDir, 'scripts');
  fs.mkdirSync(scriptsDest, { recursive: true });
  if (fs.existsSync(scriptsSrc)) {
    for (const file of fs.readdirSync(scriptsSrc)) {
      if (!file.endsWith('.js')) continue;
      fs.copyFileSync(path.join(scriptsSrc, file), path.join(scriptsDest, file));
    }
  }
}

function execRemote(conn, command) {
  return new Promise((resolve, reject) => {
    conn.exec(command, (err, stream) => {
      if (err) return reject(err);
      let stdout = '';
      let stderr = '';
      stream.on('close', (code) => {
        if (code !== 0) {
          const msg = [stderr, stdout].filter(Boolean).join('\n') || `exit ${code}`;
          reject(new Error(msg));
          return;
        }
        resolve(stdout);
      });
      stream.on('data', (d) => {
        stdout += d.toString();
        process.stdout.write(d);
      });
      stream.stderr.on('data', (d) => {
        stderr += d.toString();
        process.stderr.write(d);
      });
    });
  });
}

function withSftp(conn) {
  return new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => (err ? reject(err) : resolve(sftp)));
  });
}

function sftpMkdir(sftp, remotePath) {
  return new Promise((resolve, reject) => {
    sftp.mkdir(remotePath, (err) => {
      if (err && err.code !== 4) return reject(err);
      resolve();
    });
  });
}

async function uploadDir(sftp, localDir, remoteDir) {
  await sftpMkdir(sftp, remoteDir);
  for (const name of fs.readdirSync(localDir)) {
    const localPath = path.join(localDir, name);
    const remotePath = `${remoteDir}/${name}`.replace(/\\/g, '/');
    const stat = fs.statSync(localPath);
    if (stat.isDirectory()) {
      await uploadDir(sftp, localPath, remotePath);
    } else {
      await new Promise((resolve, reject) => {
        sftp.fastPut(localPath, remotePath, (err) => (err ? reject(err) : resolve()));
      });
    }
  }
}

async function main() {
  const { serverIp, user, password } = loadConfig();
  const remoteNew = '/root/cattle-tracker/server-new';
  const remotePath = '/root/cattle-tracker/server';
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cattle-deploy-'));

  console.log('Copying files (no node_modules, data)...');
  copyDeployTree(tempDir);
  const rootChangelog = path.join(projectRoot, 'CHANGELOG.md');
  if (fs.existsSync(rootChangelog)) {
    fs.copyFileSync(rootChangelog, path.join(tempDir, 'CHANGELOG.md'));
  }

  const conn = new Client();
  try {
    await new Promise((resolve, reject) => {
      conn
        .on('ready', resolve)
        .on('error', reject)
        .connect({
          host: serverIp,
          port: 22,
          username: user,
          password,
          readyTimeout: 30000,
        });
    });

    console.log(`Uploading to ${user}@${serverIp}...`);
    await execRemote(conn, `rm -rf ${remoteNew} && mkdir -p ${remoteNew}`);
    const sftp = await withSftp(conn);
    try {
      await uploadDir(sftp, tempDir, remoteNew);
    } finally {
      sftp.end();
    }

    console.log('Installing deps and restarting service on server...');
    const cmd =
      `cd ${remoteNew} && npm install --omit=dev && cp -r . ${remotePath}/ && rm -rf ${remoteNew} && systemctl restart cattle-tracker-api && systemctl status cattle-tracker-api --no-pager`;
    await execRemote(conn, cmd);
    console.log('Deploy done.');
  } finally {
    conn.end();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
