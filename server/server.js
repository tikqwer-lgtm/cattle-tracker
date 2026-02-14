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
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');

const db = require('./db');
const authRoutes = require('./routes/auth');
const objectsRoutes = require('./routes/objects');
const entriesRoutes = require('./routes/entries');
const chatRoutes = require('./routes/chat');

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

// Ограничение запросов к авторизации (защита от перебора паролей)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: function (req, res) {
    res.status(429).json({ error: 'Слишком много попыток входа. Попробуйте через 15 минут.' });
  }
});
app.use('/api/auth', authLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/objects', objectsRoutes);
app.use('/api/objects', entriesRoutes);
app.use('/api', chatRoutes);

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
  await listenOnPort(app, PORT);
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
