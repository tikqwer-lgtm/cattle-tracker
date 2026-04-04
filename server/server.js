/**
 * Cattle Tracker API server.
 * Auth: POST /api/auth/register, /api/auth/login, /api/auth/logout, GET /api/auth/me
 * Objects: GET /api/objects, POST /api/objects
 * Entries: GET/POST /api/objects/:id/entries, GET/PUT/DELETE /api/objects/:id/entries/:cattleId
 * Mobile: GET /api/mobile/info, GET /api/mobile/app.apk; admin APK: app.use('/api/admin', admin-mobile-apk)
 */
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const mobileApkStorage = require('./lib/mobile-apk-storage');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');

const bcrypt = require('bcryptjs');
const db = require('./db');
const authRoutes = require('./routes/auth');
const objectsRoutes = require('./routes/objects');
const entriesRoutes = require('./routes/entries');
const protocolsRoutes = require('./routes/protocols');
const chatRoutes = require('./routes/chat');
const adminRoutes = require('./routes/admin');
const adminMobileApkRoutes = require('./routes/admin-mobile-apk');
const mobileRoutes = require('./routes/mobile');

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure data dir exists for SQLite
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
// APK: по умолчанию server/apk; иначе APK_STORAGE_DIR в .env (см. README).
const apkDir = mobileApkStorage.getMobileDir();
if (!fs.existsSync(apkDir)) fs.mkdirSync(apkDir, { recursive: true });
if (process.env.APK_STORAGE_DIR && String(process.env.APK_STORAGE_DIR).trim()) {
  console.log('APK: APK_STORAGE_DIR →', apkDir);
}
const legacyMobileDir = path.join(dataDir, 'mobile');
function apkDirHasRealFiles(dir) {
  if (!fs.existsSync(dir)) return false;
  return fs.readdirSync(dir).some((name) => name !== '.gitkeep');
}
try {
  if (fs.existsSync(legacyMobileDir)) {
    const legacyFiles = fs.readdirSync(legacyMobileDir);
    if (legacyFiles.length > 0 && !apkDirHasRealFiles(apkDir)) {
      for (const name of legacyFiles) {
        fs.renameSync(path.join(legacyMobileDir, name), path.join(apkDir, name));
      }
      fs.rmSync(legacyMobileDir, { recursive: true, force: true });
      console.log('APK: перенесено из data/mobile в папку apk/');
    }
  }
} catch (e) {
  console.warn('APK: миграция из data/mobile пропущена:', e.message);
}

app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

// Лимиты только на POST /login и /register — см. routes/auth.js (не на /me и check-username, иначе общий IP и опросы съедают квоту).

app.use('/api/auth', authRoutes);
app.use('/api/objects', objectsRoutes);
app.use('/api/objects', entriesRoutes);
app.use('/api/objects', protocolsRoutes);
app.use('/api', chatRoutes);
app.use('/api/admin', adminMobileApkRoutes);
app.use('/api', adminRoutes);
app.use('/api', mobileRoutes);

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

app.use((err, req, res, next) => {
  console.error(err);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({ error: err.message || 'Внутренняя ошибка сервера' });
});

function listenOnPort(app, portStart) {
  return new Promise((resolve, reject) => {
    let port = portStart;
    const maxPort = portStart + 10;

    function tryListen() {
      const server = app.listen(port, () => {
        const addr = server.address();
        const p = typeof addr === 'object' && addr && addr.port != null ? addr.port : port;
        console.log('Cattle Tracker API listening on port', p);
        console.log('Клиентам: базовый URL API — http://127.0.0.1:' + p + ' (без суффикса /api)');
        const wanted = Number(process.env.PORT) || 3000;
        if (p !== wanted) {
          console.warn(
            'Порт ' +
              wanted +
              ' занят — слушаем ' +
              p +
              '. В приложении укажите именно этот порт, иначе запросы уйдут в другой процесс.'
          );
        }
        resolve(server);
      });
      server.on('error', (err) => {
        if (err.code === 'EADDRINUSE' && port < maxPort) {
          console.log('Port', port, 'in use, trying', port + 1, '...');
          server.close(() => {
            port++;
            tryListen();
          });
        } else {
          reject(err);
        }
      });
    }

    tryListen();
  });
}

async function start() {
  await db.initDb();
  db.initSchema();
  if (!db.findUserByUsername('Panko')) {
    const id = 'u_admin_panko';
    const passwordHash = bcrypt.hashSync('123456', 10);
    db.createUser(id, 'Panko', passwordHash, 'admin');
    console.log('Created default admin user Panko');
  }
  await listenOnPort(app, PORT);
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
