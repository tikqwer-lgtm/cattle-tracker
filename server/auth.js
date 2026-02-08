/**
 * JWT auth middleware and helpers.
 */
const jwt = require('jsonwebtoken');
const db = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'cattle-tracker-secret-change-in-production';
const JWT_OPTIONS = { expiresIn: '7d' };

function signToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    JWT_OPTIONS
  );
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (_) {
    return null;
  }
}

/**
 * Middleware: require valid JWT in Authorization: Bearer <token> or in cookie.
 * Sets req.user = { id, username, role }.
 */
function requireAuth(req, res, next) {
  let token = null;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }
  if (!token) {
    return res.status(401).json({ error: 'Требуется авторизация' });
  }
  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'Недействительный или истёкший токен' });
  }
  const user = db.findUserById(payload.id);
  if (!user) {
    return res.status(401).json({ error: 'Пользователь не найден' });
  }
  req.user = { id: user.id, username: user.username, role: user.role };
  next();
}

/**
 * Optional auth: if token present, set req.user; otherwise req.user = null.
 */
function optionalAuth(req, res, next) {
  let token = null;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }
  req.user = null;
  if (token) {
    const payload = verifyToken(token);
    if (payload) {
      const user = db.findUserById(payload.id);
      if (user) req.user = { id: user.id, username: user.username, role: user.role };
    }
  }
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Требуется авторизация' });
    if (roles.length && !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Недостаточно прав' });
    }
    next();
  };
}

module.exports = {
  signToken,
  verifyToken,
  requireAuth,
  optionalAuth,
  requireRole
};
