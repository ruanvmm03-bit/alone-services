/**
 * AMDS - Gateway de pagamentos (simulado).
 * Gera cobranças PIX, boleto e cartão.
 * Em produção, substitua as funções "mock" por integrações reais
 * (Mercado Pago, Stripe, PagSeguro, etc.).
 */

const crypto = require('crypto');
const store = require('./store');

const PAYMENT_METHODS = {
  pix: { key: 'pix', label: 'PIX', feeRate: 0, daysToConfirm: 0 },
  card: { key: 'card', label: 'Cartão de crédito', feeRate: 0.0399, daysToConfirm: 0 },
  boleto: { key: 'boleto', label: 'Boleto bancário', feeRate: 0.015, daysToConfirm: 2 },
};

function round2(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Gera um código PIX "copia e cola" (formato simplificado, não é EMV real).
 */
function buildPixPayload(paymentId, amount) {
  const chave = process.env.PIX_KEY || 'amds@pagamentos.com.br';
  const txid = paymentId.replace(/[^A-Za-z0-9]/g, '').slice(0, 25).toUpperCase();
  return `00020126580014BR.GOV.BCB.PIX0136${chave}520400005303986540${amount.toFixed(2)}5802BR5909AMDS PAGO6009SAO PAULO62070503${txid}6304ABCD`;
}

/**
 * Cria uma cobrança para um pedido.
 */
function createCharge({ orderId, method = 'pix', amount, customer = {} }) {
  const m = PAYMENT_METHODS[method];
  if (!m) {
    const err = new Error(`Método de pagamento inválido: ${method}`);
    err.status = 400;
    throw err;
  }
  const value = round2(Number(amount));
  if (!Number.isFinite(value) || value <= 0) {
    const err = new Error('Valor de pagamento inválido.');
    err.status = 400;
    throw err;
  }

  const fee = round2(value * m.feeRate);
  const net = round2(value - fee);

  const payment = store.createPayment({
    orderId,
    method,
    methodLabel: m.label,
    amount: value,
    fee,
    net,
    customer,
    status: 'pending',
  });

  const response = {
    paymentId: payment.id,
    orderId,
    method,
    methodLabel: m.label,
    amount: value,
    fee,
    net,
    status: payment.status,
    createdAt: payment.createdAt,
  };

  if (method === 'pix') {
    response.pix = {
      key: process.env.PIX_KEY || 'amds@pagamentos.com.br',
      copyPaste: buildPixPayload(payment.id, value),
      expiresInSeconds: 3600,
    };
  } else if (method === 'boleto') {
    const barcode = crypto.randomBytes(24).toString('hex').toUpperCase();
    const dueDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    response.boleto = {
      barcode,
      digitableLine: barcode.match(/.{1,12}/g).join(' '),
      dueDate,
    };
  } else if (method === 'card') {
    response.card = {
      message: 'Envie os dados do cartão para /api/payments/:id/confirm-card',
    };
  }

  return response;
}

/**
 * Simula a confirmação de um pagamento.
 * Em produção, isso viria de um webhook do gateway.
 */
function confirmPayment(paymentId, extra = {}) {
  const payment = store.getPayment(paymentId);
  if (!payment) {
    const err = new Error('Pagamento não encontrado.');
    err.status = 404;
    throw err;
  }
  if (payment.status === 'paid') {
    return { payment, alreadyPaid: true };
  }

  const updated = store.updatePayment(paymentId, {
    status: 'paid',
    paidAt: new Date().toISOString(),
    ...extra,
  });

  return { payment: updated, alreadyPaid: false };
}

function getMethods() {
  return Object.values(PAYMENT_METHODS).map((m) => ({
    key: m.key,
    label: m.label,
    feeRate: m.feeRate,
    daysToConfirm: m.daysToConfirm,
  }));
}

module.exports = { PAYMENT_METHODS, createCharge, confirmPayment, getMethods };