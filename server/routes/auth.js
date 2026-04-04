/**
 * Auth routes: register, login, logout, me, check-username.
 */
const express = require('express');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const router = express.Router();
const db = require('../db');
const { signToken, requireAuth } = require('../auth');

/**
 * Только POST /login — успешные ответы (200) в квоту не входят (защита от перебора паролей без блокировки после удачного входа).
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: function (req, res) {
    res.status(429).json({ error: 'Слишком много попыток входа. Попробуйте через 15 минут.' });
  }
});

/** Регистрации: успешные 201 не считаются в лимит неудачных попыток. */
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: function (req, res) {
    res.status(429).json({ error: 'Слишком много регистраций с этого адреса. Попробуйте позже.' });
  }
});

router.get('/check-username', (req, res) => {
  const username = (req.query.username || '').trim();
  if (!username) {
    return res.json({ available: true });
  }
  const exists = !!db.findUserByUsername(username);
  res.json({ available: !exists });
});

router.post('/register', registerLimiter, (req, res) => {
  const { username, password, role } = req.body || {};
  const u = (username || '').trim();
  const p = password || '';
  if (!u || !p) {
    return res.status(400).json({ error: 'Введите логин и пароль' });
  }
  if (db.findUserByUsername(u)) {
    return res.status(400).json({ error: 'Пользователь с таким логином уже есть' });
  }
  const id = 'u_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
  const passwordHash = bcrypt.hashSync(p, 10);
  const existingCount = db.countUsers();
  const allowedRoles = ['admin', 'operator', 'viewer'];
  let assignRole = String(role || 'operator').trim();
  if (!allowedRoles.includes(assignRole)) assignRole = 'operator';
  if (existingCount === 0) {
    assignRole = 'admin';
  } else if (assignRole === 'admin') {
    assignRole = 'operator';
  }
  db.createUser(id, u, passwordHash, assignRole);
  const user = { id, username: u, role: assignRole };
  const token = signToken(user);
  res.status(201).json({ ok: true, user, token });
});

router.post('/login', loginLimiter, (req, res) => {
  const { username, password } = req.body || {};
  const u = (username || '').trim();
  const p = password || '';
  if (!u || !p) {
    return res.status(400).json({ error: 'Введите логин и пароль' });
  }
  const row = db.findUserByUsername(u);
  if (!row || !bcrypt.compareSync(p, row.password_hash)) {
    return res.status(401).json({ error: 'Неверный логин или пароль' });
  }
  const user = { id: row.id, username: row.username, role: row.role };
  const token = signToken(user);
  res.json({ ok: true, user, token });
});

router.post('/logout', (req, res) => {
  // Stateless JWT: client discards token. Optionally maintain blacklist later.
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ ok: true, user: req.user });
});

module.exports = router;
