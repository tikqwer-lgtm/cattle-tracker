/**
 * Cattle Tracker API server.
 * Auth: POST /api/auth/register, /api/auth/login, /api/auth/logout, GET /api/auth/me
 * Objects: GET /api/objects, POST /api/objects
 * Entries: GET/POST /api/objects/:id/entries, GET/PUT/DELETE /api/objects/:id/entries/:cattleId
 */
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
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

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure data dir exists for SQLite
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

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
app.use('/api', adminRoutes);

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
        console.log('Cattle Tracker API listening on port', port);
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
