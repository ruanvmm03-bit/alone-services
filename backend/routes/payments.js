/**
 * AMDS - Rota de pagamentos.
 * GET  /api/payment-methods          -> métodos disponíveis
 * POST /api/payments                 -> cria cobrança para um pedido
 * POST /api/payments/:id/confirm     -> simula confirmação (webhook)
 *      -> ao confirmar, o agente gera o projeto automaticamente
 */

const express = require('express');
const payments = require('../lib/payments');
const { generateProject } = require('../lib/generator');
const store = require('../lib/store');
const auth = require('../lib/auth');

const router = express.Router();

router.get('/payment-methods', (req, res) => {
  res.json(payments.getMethods());
});

router.post('/payments', auth.requireAuth, (req, res) => {
  try {
    const { orderId, method, customer = {} } = req.body || {};
    if (!orderId) return res.status(400).json({ error: 'Informe o orderId.' });

    const order = store.getOrder(orderId);
    if (!order) return res.status(404).json({ error: 'Pedido não encontrado.' });
    if (order.userId !== req.user.id) return res.status(403).json({ error: 'Você não tem acesso a este pedido.' });
    if (order.status === 'paid') {
      return res.status(409).json({ error: 'Este pedido já foi pago.' });
    }

    const charge = payments.createCharge({
      orderId,
      method,
      amount: order.total,
      customer,
    });

    store.updateOrder(orderId, { paymentId: charge.paymentId, status: 'payment_pending' });

    res.status(201).json(charge);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.post('/payments/:id/confirm', auth.requireAuth, (req, res) => {
  try {
    const { payment, alreadyPaid } = payments.confirmPayment(req.params.id, {
      confirmedBy: 'simulacao-webhook',
    });

    const order = store.getOrder(payment.orderId);
    if (!order) return res.status(404).json({ error: 'Pedido do pagamento não encontrado.' });
    if (order.userId !== req.user.id) return res.status(403).json({ error: 'Você não tem acesso a este pagamento.' });

    let generated = null;
    if (!order.projectId) {
      generated = generateProject(order, { features: order.features });
      store.updateOrder(order.id, {
        status: 'paid',
        paidAt: payment.paidAt,
        projectId: generated.projectId,
        previewUrl: generated.previewUrl,
      });
      store.createProject({
        projectId: generated.projectId,
        orderId: order.id,
        type: generated.type,
        typeLabel: order.typeLabel,
        title: order.title,
        description: order.description,
        files: generated.files,
        previewUrl: generated.previewUrl,
      });
    } else {
      store.updateOrder(order.id, { status: 'paid', paidAt: payment.paidAt });
    }

    res.json({
      payment,
      alreadyPaid,
      project: generated || { projectId: order.projectId, previewUrl: order.previewUrl },
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.get('/payments/:id', (req, res) => {
  const payment = store.getPayment(req.params.id);
  if (!payment) return res.status(404).json({ error: 'Pagamento não encontrado.' });
  res.json(payment);
});

module.exports = router;