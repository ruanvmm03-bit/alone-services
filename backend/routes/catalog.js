/**
 * AMDS - Rota de catálogo e orçamento.
 * GET  /api/catalog  -> lista tipos, features, urgências, complexidades
 * POST /api/quote    -> calcula orçamento de um pedido
 */

const express = require('express');
const { getCatalog, calculateQuote } = require('../lib/catalog');

const router = express.Router();

router.get('/catalog', (req, res) => {
  res.json(getCatalog());
});

router.post('/quote', (req, res) => {
  try {
    const quote = calculateQuote(req.body || {});
    res.json(quote);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

module.exports = router;