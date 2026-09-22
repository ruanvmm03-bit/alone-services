/**
 * AMDS - Rotas de autenticação.
 * POST /api/auth/register        -> cria conta (nome, e-mail, senha)
 * POST /api/auth/login           -> autentica e devolve cookie + token
 * POST /api/auth/logout          -> limpa o cookie de sessão
 * GET  /api/auth/me              -> dados do usuário autenticado
 * POST /api/auth/change-password -> troca a senha (exige senha atual)
 *
 * Segurança aplicada:
 *  - Senhas com hash bcrypt (nunca armazenadas em texto puro)
 *  - Rate limit agressivo em /login e /register (anti brute-force / spam)
 *  - Mensagens de erro genéricas no login (não revela se o e-mail existe)
 *  - Cookie httpOnly + SameSite=Lax (mitiga XSS/CSRF) + secure em produção
 *  - tokenVersion: "logout de todos os dispositivos" ao trocar a senha
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const store = require('../lib/store');
const auth = require('../lib/auth');
const mailer = require('../lib/mailer');

const router = express.Router();

const APP_URL = (process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/$/, '');
const SOCIAL_STATE_COOKIE = 'amds_oauth_state';
const SOCIAL_NEXT_COOKIE = 'amds_oauth_next';
const SOCIAL_PROVIDERS = {
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    profileUrl: 'https://openidconnect.googleapis.com/v1/userinfo',
    scope: 'openid email profile',
  },
  github: {
    clientId: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    authorizationUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    profileUrl: 'https://api.github.com/user',
    scope: 'read:user user:email',
  },
};

function socialRedirect(provider) {
  return `${APP_URL}/api/auth/${provider}/callback`;
}

function configuredProvider(provider) {
  const config = SOCIAL_PROVIDERS[provider];
  return config && config.clientId && config.clientSecret ? config : null;
}

function setStateCookie(res, state) {
  res.cookie(SOCIAL_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 10 * 60 * 1000,
    path: '/',
  });
}

function clearStateCookie(res) {
  res.clearCookie(SOCIAL_STATE_COOKIE, { httpOnly: true, sameSite: 'lax', path: '/' });
  res.clearCookie(SOCIAL_NEXT_COOKIE, { httpOnly: true, sameSite: 'lax', path: '/' });
}

function safeNext(value) {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') ? value : '/pedido.html';
}

async function responseJson(response) {
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error((data && (data.error_description || data.message || data.error)) || 'Falha no provedor social.');
  return data;
}

async function getSocialProfile(provider, code, redirectUri) {
  const config = SOCIAL_PROVIDERS[provider];
  const tokenResponse = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, code, redirect_uri: redirectUri }).toString(),
  });
  const token = await responseJson(tokenResponse);
  const accessToken = token.access_token;
  if (!accessToken) throw new Error('O provedor não devolveu um token de acesso.');

  const profileResponse = await fetch(config.profileUrl, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json', 'User-Agent': 'Alone-Auth' },
  });
  const profile = await responseJson(profileResponse);
  let email = profile.email;
  if (provider === 'github' && !email) {
    const emailsResponse = await fetch('https://api.github.com/user/emails', { headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json', 'User-Agent': 'Alone-Auth' } });
    const emails = await responseJson(emailsResponse);
    email = emails.find((item) => item.primary && item.verified)?.email || emails.find((item) => item.verified)?.email;
  }
  if (!email) throw new Error('Não foi possível obter um e-mail verificado da conta social.');
  return { id: String(profile.id || profile.sub), name: profile.name || profile.login || 'Usuário Alone', email: email.toLowerCase() };
}

function socialLogin(provider, profile, res) {
  let user = store.getUserByEmail(profile.email);
  if (!user) {
    user = store.createUser({ name: profile.name, email: profile.email, provider, providerId: profile.id, role: 'customer' });
  } else if (!user.provider) {
    user = store.updateUser(user.id, { provider, providerId: profile.id });
  }
  auth.setAuthCookie(res, auth.signToken(user));
  res.redirect('/conta.html?login=success');
}

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas tentativas de login. Tente novamente em alguns minutos.' },
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas tentativas de cadastro. Tente novamente mais tarde.' },
});

const verificationLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas tentativas de confirmação. Aguarde alguns minutos.' },
});

function createVerificationCode() {
  return String(crypto.randomInt(100000, 1000000));
}

async function prepareVerification(user) {
  const code = createVerificationCode();
  const codeHash = await auth.hashPassword(code);
  const updated = store.updateUser(user.id, {
    emailVerified: false,
    emailVerificationCodeHash: codeHash,
    emailVerificationExpiresAt: Date.now() + 10 * 60 * 1000,
    emailVerificationAttempts: 0,
  });
  const delivery = await mailer.sendVerificationCode(updated.email, code);
  return { user: updated, delivery, developmentCode: delivery.development ? code : undefined };
}

router.get('/auth/:provider/start', (req, res) => {
  const { provider } = req.params;
  if (!['google', 'github'].includes(provider)) {
    return res.redirect('/conta.html?login=error&message=Provedor%20de%20login%20indispon%C3%ADvel.');
  }
  const config = configuredProvider(provider);
  if (!config) return res.redirect(`/conta.html?login=error&message=${encodeURIComponent(`Login com ${provider} ainda não configurado.`)}`);

  const state = crypto.randomBytes(24).toString('hex');
  setStateCookie(res, state);
  res.cookie(SOCIAL_NEXT_COOKIE, safeNext(req.query.next), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 10 * 60 * 1000,
    path: '/',
  });
  const params = new URLSearchParams({ client_id: config.clientId, redirect_uri: socialRedirect(provider), response_type: 'code', scope: config.scope, state });
  res.redirect(`${config.authorizationUrl}?${params.toString()}`);
});

router.get('/auth/providers', (req, res) => {
  res.json({
    google: Boolean(configuredProvider('google')),
    github: Boolean(configuredProvider('github')),
  });
});

router.get('/auth/:provider/callback', async (req, res) => {
  const { provider } = req.params;
  if (!['google', 'github'].includes(provider)) {
    return res.redirect('/conta.html?login=error&message=Provedor%20de%20login%20indispon%C3%ADvel.');
  }
  const config = configuredProvider(provider);
  const { code, state, error } = req.query;
  const validState = state && req.cookies[SOCIAL_STATE_COOKIE] && state === req.cookies[SOCIAL_STATE_COOKIE];
  clearStateCookie(res);
  if (error) return res.redirect(`/conta.html?login=error&message=${encodeURIComponent('Login cancelado.')}`);
  if (!config || !code || !validState) return res.redirect(`/conta.html?login=error&message=${encodeURIComponent('Não foi possível validar o login social.')}`);

  try {
    const profile = await getSocialProfile(provider, code, socialRedirect(provider));
    let user = store.getUserByEmail(profile.email);
    if (!user) user = store.createUser({ name: profile.name, email: profile.email, provider, providerId: profile.id, role: 'customer', emailVerified: true });
    else if (!user.provider) user = store.updateUser(user.id, { provider, providerId: profile.id, emailVerified: true });
    auth.setAuthCookie(res, auth.signToken(user));
    res.redirect(safeNext(req.cookies[SOCIAL_NEXT_COOKIE]));
  } catch (err) {
    res.redirect(`/conta.html?login=error&message=${encodeURIComponent(err.message)}`);
  }
});

router.post('/auth/register', registerLimiter, async (req, res) => {
  try {
    const { name, email, password } = req.body || {};

    if (!name || String(name).trim().length < 2) {
      return res.status(400).json({ error: 'Informe seu nome completo.' });
    }
    if (!auth.validateEmail(email)) {
      return res.status(400).json({ error: 'Informe um e-mail válido.' });
    }
    if (!auth.validatePassword(password)) {
      return res.status(400).json({ error: 'A senha deve ter no mínimo 8 caracteres, com letras e números.' });
    }

    const existing = store.getUserByEmail(email);
    if (existing) {
      return res.status(409).json({ error: 'Este e-mail já está cadastrado.' });
    }

    const passwordHash = await auth.hashPassword(password);
    const user = store.createUser({
      name: String(name).trim(),
      email: String(email).trim().toLowerCase(),
      passwordHash,
      role: 'customer',
      emailVerified: false,
    });

    const verification = await prepareVerification(user);
    res.status(201).json({
      verificationRequired: true,
      email: user.email,
      developmentCode: verification.developmentCode,
      message: 'Enviamos um código de 6 dígitos para seu Gmail.',
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Erro ao criar conta.' });
  }
});

router.post('/auth/login', loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body || {};
    const genericError = { error: 'E-mail ou senha inválidos.' };

    if (!auth.validateEmail(email) || typeof password !== 'string' || !password) {
      return res.status(400).json(genericError);
    }

    const user = store.getUserByEmail(email);
    if (!user) return res.status(401).json(genericError);

    const ok = await auth.comparePassword(password, user.passwordHash);
    if (!ok) return res.status(401).json(genericError);
    if (user.emailVerified === false) {
      return res.status(403).json({ error: 'Confirme seu Gmail com o código de 6 dígitos antes de entrar.', verificationRequired: true, email: user.email });
    }

    const token = auth.signToken(user);
    auth.setAuthCookie(res, token);

    res.json({ user: auth.toPublicUser(user), token });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Erro ao autenticar.' });
  }
});

router.post('/auth/verify-email', verificationLimiter, async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const code = String(req.body?.code || '').trim();
    const user = store.getUserByEmail(email);
    if (!user || user.emailVerified !== false) return res.status(400).json({ error: 'Código inválido ou expirado.' });
    if (!/^\d{6}$/.test(code)) return res.status(400).json({ error: 'Digite o código de 6 dígitos.' });
    if (Number(user.emailVerificationAttempts || 0) >= 5) return res.status(429).json({ error: 'Limite de tentativas atingido. Solicite um novo código.' });
    if (!user.emailVerificationExpiresAt || Date.now() > user.emailVerificationExpiresAt) return res.status(400).json({ error: 'Código expirado. Solicite um novo código.' });

    const valid = await auth.comparePassword(code, user.emailVerificationCodeHash);
    if (!valid) {
      store.updateUser(user.id, { emailVerificationAttempts: Number(user.emailVerificationAttempts || 0) + 1 });
      return res.status(400).json({ error: 'Código inválido ou expirado.' });
    }

    const verified = store.updateUser(user.id, {
      emailVerified: true,
      emailVerificationCodeHash: null,
      emailVerificationExpiresAt: null,
      emailVerificationAttempts: 0,
    });
    const token = auth.signToken(verified);
    auth.setAuthCookie(res, token);
    res.json({ user: auth.toPublicUser(verified), token });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Não foi possível confirmar o e-mail.' });
  }
});

router.post('/auth/resend-verification', verificationLimiter, async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const user = store.getUserByEmail(email);
    if (!user || user.emailVerified !== false) return res.json({ ok: true, message: 'Se houver uma confirmação pendente, um novo código será enviado.' });
    const verification = await prepareVerification(user);
    res.json({ ok: true, email: user.email, developmentCode: verification.developmentCode, message: 'Um novo código foi enviado.' });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Não foi possível reenviar o código.' });
  }
});

router.post('/auth/logout', (req, res) => {
  auth.clearAuthCookie(res);
  res.json({ ok: true });
});

router.get('/auth/me', auth.requireAuth, (req, res) => {
  res.json({ user: auth.toPublicUser(req.user) });
});

router.post('/auth/change-password', auth.requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};

    const ok = await auth.comparePassword(currentPassword, req.user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Senha atual incorreta.' });

    if (!auth.validatePassword(newPassword)) {
      return res.status(400).json({ error: 'A nova senha deve ter no mínimo 8 caracteres, com letras e números.' });
    }

    const passwordHash = await auth.hashPassword(newPassword);
    const updated = store.updateUser(req.user.id, {
      passwordHash,
      tokenVersion: (req.user.tokenVersion || 0) + 1, // invalida sessões antigas
    });

    const token = auth.signToken(updated);
    auth.setAuthCookie(res, token);

    res.json({ user: auth.toPublicUser(updated), token });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Erro ao trocar a senha.' });
  }
});

module.exports = router;
