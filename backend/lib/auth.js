/**
 * AMDS - Autenticação.
 * Hash de senha (bcrypt), emissão/verificação de JWT e middlewares
 * de proteção de rotas. Token é entregue via cookie httpOnly (mais seguro
 * contra XSS do que guardar em localStorage) e também retornado no corpo
 * da resposta para clientes que preferirem enviar via Authorization header.
 */

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const store = require('./store');

const SALT_ROUNDS = 12;
const TOKEN_TTL = process.env.JWT_EXPIRES_IN || '7d';
const COOKIE_NAME = 'amds_token';

// Exige um segredo forte. Em desenvolvimento gera um aleatório (avisando no log)
// para nunca rodar com um segredo previsível "trocar-depois" tipo os exemplos por aí.
function getSecret() {
  const fromEnv = process.env.JWT_SECRET;
  if (fromEnv && fromEnv.length >= 16) return fromEnv;
  if (!getSecret._warned) {
    console.warn(
      '[auth] JWT_SECRET ausente ou fraco no .env — usando um segredo aleatório gerado em memória.\n' +
      '        Isso invalida todos os tokens a cada reinício do servidor. Defina JWT_SECRET no .env em produção.'
    );
    getSecret._warned = true;
  }
  if (!getSecret._fallback) {
    getSecret._fallback = crypto.randomBytes(48).toString('hex');
  }
  return getSecret._fallback;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateEmail(email) {
  return typeof email === 'string' && EMAIL_RE.test(email.trim());
}

/**
 * Senha forte: mínimo 8 caracteres, pelo menos 1 letra e 1 número.
 * Evita senhas triviais sem ser exagerado para uma demo.
 */
function validatePassword(password) {
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) return false;
  return /[A-Za-z]/.test(password) && /[0-9]/.test(password);
}

async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

async function comparePassword(password, hash) {
  if (!hash) return false;
  return bcrypt.compare(password, hash);
}

function signToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      tv: user.tokenVersion || 0,
    },
    getSecret(),
    { expiresIn: TOKEN_TTL }
  );
}

function verifyToken(token) {
  return jwt.verify(token, getSecret());
}

function cookieOptions() {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProd, // exige HTTPS em produção
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 dias
  };
}

function setAuthCookie(res, token) {
  res.cookie(COOKIE_NAME, token, cookieOptions());
}

function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, { ...cookieOptions(), maxAge: undefined });
}

function extractToken(req) {
  if (req.cookies && req.cookies[COOKIE_NAME]) return req.cookies[COOKIE_NAME];
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7).trim();
  return null;
}

/** Remove campos sensíveis antes de expor o usuário via API. */
function toPublicUser(user) {
  if (!user) return null;
  const { passwordHash, tokenVersion, ...publicUser } = user;
  return publicUser;
}

/**
 * Middleware: exige usuário autenticado.
 * Popula req.user com o registro completo do banco (já revalidado),
 * garantindo que tokens revogados (tokenVersion) ou usuários removidos
 * não continuem tendo acesso mesmo com um JWT ainda válido.
 */
function requireAuth(req, res, next) {
  try {
    const token = extractToken(req);
    if (!token) return res.status(401).json({ error: 'Não autenticado. Faça login para continuar.' });

    const payload = verifyToken(token);
    const user = store.getUserById(payload.sub);
    if (!user) return res.status(401).json({ error: 'Sessão inválida.' });
    if ((user.tokenVersion || 0) !== (payload.tv || 0)) {
      return res.status(401).json({ error: 'Sessão expirada. Faça login novamente.' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Sessão inválida ou expirada.' });
  }
}

/** Middleware: popula req.user se houver token válido, mas não bloqueia a rota. */
function optionalAuth(req, res, next) {
  try {
    const token = extractToken(req);
    if (!token) return next();
    const payload = verifyToken(token);
    const user = store.getUserById(payload.sub);
    if (user && (user.tokenVersion || 0) === (payload.tv || 0)) {
      req.user = user;
    }
    next();
  } catch (err) {
    next();
  }
}

/** Middleware factory: exige um dos papéis informados (ex.: requireRole('admin')). */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Não autenticado.' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Você não tem permissão para acessar este recurso.' });
    }
    next();
  };
}

module.exports = {
  COOKIE_NAME,
  validateEmail,
  validatePassword,
  hashPassword,
  comparePassword,
  signToken,
  verifyToken,
  setAuthCookie,
  clearAuthCookie,
  extractToken,
  toPublicUser,
  requireAuth,
  optionalAuth,
  requireRole,
};
