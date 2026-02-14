/**
 * Auth routes: register, login, logout, me, check-username.
 */
const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const db = require('../db');
const { signToken, requireAuth } = require('../auth');

router.get('/check-username', (req, res) => {
  const username = (req.query.username || '').trim();
  if (!username) {
    return res.json({ available: true });
  }
  const exists = !!db.findUserByUsername(username);
  res.json({ available: !exists });
});

router.post('/register', (req, res) => {
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
  db.createUser(id, u, passwordHash, role || 'admin');
  const user = { id, username: u, role: role || 'admin' };
  const token = signToken(user);
  res.status(201).json({ ok: true, user, token });
});

router.post('/login', (req, res) => {
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
