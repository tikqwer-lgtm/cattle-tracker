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

router.get('/register-status', (req, res) => {
  res.json({ allowed: db.countUsers() === 0 });
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
  const existingCount = db.countUsers();
  if (existingCount > 0) {
    return res.status(403).json({ error: 'Создание аккаунтов доступно только администратору' });
  }
  const { username, password } = req.body || {};
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
  const assignRole = 'admin';
  db.createUser(id, u, passwordHash, assignRole, p);
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
  const user = {
    id: row.id,
    username: row.username,
    role: db.normalizeAppRole ? db.normalizeAppRole(row.role) : row.role
  };
  const token = signToken(user);
  const roleCapabilities = db.getRoleCapabilities ? db.getRoleCapabilities() : undefined;
  const userCapabilities = db.getUserCapabilityOverlay ? db.getUserCapabilityOverlay(user.id) : undefined;
  res.json({ ok: true, user, token, roleCapabilities, userCapabilities });
});

router.post('/logout', (req, res) => {
  // Stateless JWT: client discards token. Optionally maintain blacklist later.
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  const roleCapabilities = db.getRoleCapabilities ? db.getRoleCapabilities() : undefined;
  const userCapabilities = db.getUserCapabilityOverlay ? db.getUserCapabilityOverlay(req.user && req.user.id) : undefined;
  res.json({ ok: true, user: req.user, roleCapabilities, userCapabilities });
});

const accessRequestLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  handler: function (req, res) {
    res.status(429).json({ error: 'Слишком много заявок. Попробуйте позже.' });
  }
});

router.post('/access-request', accessRequestLimiter, (req, res) => {
  const body = req.body || {};
  const kindRaw = String(body.kind || '').trim();
  const kind = kindRaw === 'forgot_password' ? 'forgot_password' : 'request_credentials';
  const username = (body.username || '').trim();
  const contact = (body.contact || '').trim();
  const comment = (body.comment || '').trim();
  if (kind === 'forgot_password' && !username) {
    return res.status(400).json({ error: 'Укажите логин' });
  }
  if (!contact && !comment && !username) {
    return res.status(400).json({ error: 'Укажите логин, контакт или комментарий' });
  }
  if (username && db.countPendingByUsername(username, kind, 60) >= 3) {
    return res.status(429).json({ error: 'Уже есть недавние заявки по этому логину. Дождитесь ответа администратора.' });
  }
  const row = db.createAccessRequest({ kind, username, contact, comment });
  res.status(201).json({ ok: true, request: row });
});

module.exports = router;
