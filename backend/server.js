/**
 * AMDS - Servidor principal.
 * Serve a API REST e o frontend estático.
 *
 * Rotas:
 *   /api/catalog, /api/quote
 *   /api/orders
 *   /api/payments, /api/payment-methods
 *   /api/projects
 *   /generated/<projectId>/...  (projetos gerados pelo agente)
 *   /                            (frontend)
 */

require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const catalogRoutes = require('./routes/catalog');
const orderRoutes = require('./routes/orders');
const paymentRoutes = require('./routes/payments');
const generateRoutes = require('./routes/generate');
const authRoutes = require('./routes/auth');
const { GENERATED_DIR } = require('./lib/generator');

const app = express();
const PORT = process.env.PORT || 3000;

// Em produção, atrás de proxy/load balancer (Render, Heroku, Nginx etc.),
// necessário para cookies "secure" e rate-limit funcionarem com o IP real.
app.set('trust proxy', 1);

app.use(cors({ origin: process.env.CORS_ORIGIN || true, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

// Log simples de requisições
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    console.log(`${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - start}ms)`);
  });
  next();
});

// API
app.use('/api', authRoutes);
app.use('/api', catalogRoutes);
app.use('/api', orderRoutes);
app.use('/api', paymentRoutes);
app.use('/api', generateRoutes);

// Projetos gerados (preview navegável)
app.use('/generated', express.static(GENERATED_DIR));

// Frontend estático
const FRONTEND_DIR = path.join(__dirname, '..', 'frontend');
app.use(express.static(FRONTEND_DIR));

app.get('/', (req, res) => {
  res.sendFile(path.join(FRONTEND_DIR, 'index.html'));
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'AMDS', time: new Date().toISOString() });
});

// 404 para API
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Endpoint não encontrado.' });
});

// Handler de erros
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Erro interno do servidor.' });
});

app.listen(PORT, () => {
  console.log('');
  console.log('  ============================================');
  console.log('   AMDS - Agencia de desenvolvimento sob demanda');
  console.log('   Sites | Apps | Jogos');
  console.log('  ============================================');
  console.log('');
  console.log(`  Rodando em http://localhost:${PORT}`);
  console.log(`  Frontend:  http://localhost:${PORT}/`);
  console.log(`  API:       http://localhost:${PORT}/api/health`);
  console.log('');
});

module.exports = app;