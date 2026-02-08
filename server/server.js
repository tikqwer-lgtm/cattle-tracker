/**
 * Cattle Tracker API server.
 * Auth: POST /api/auth/register, /api/auth/login, /api/auth/logout, GET /api/auth/me
 * Objects: GET /api/objects, POST /api/objects
 * Entries: GET/POST /api/objects/:id/entries, GET/PUT/DELETE /api/objects/:id/entries/:cattleId
 */
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');

const db = require('./db');
db.initSchema();

const authRoutes = require('./routes/auth');
const objectsRoutes = require('./routes/objects');
const entriesRoutes = require('./routes/entries');

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

app.use('/api/auth', authRoutes);
app.use('/api/objects', objectsRoutes);
app.use('/api/objects', entriesRoutes);

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

app.listen(PORT, () => {
  console.log('Cattle Tracker API listening on port', PORT);
});
