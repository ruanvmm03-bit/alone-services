/**
 * AMDS - Script de teste de ponta a ponta.
 * Cria um pedido, gera cobrança PIX, confirma o pagamento e verifica
 * se o projeto foi gerado em /generated.
 */

const BASE = process.env.BASE_URL || 'http://localhost:3000';

async function call(path, options = {}) {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${path} -> ${res.status}: ${JSON.stringify(data)}`);
  return data;
}

function assert(cond, msg) {
  if (!cond) throw new Error('FALHOU: ' + msg);
  console.log('  OK - ' + msg);
}

(async () => {
  console.log('\n=== AMDS - teste end-to-end ===\n');

  // 1. Orçamento
  const quote = await call('/api/quote', {
    method: 'POST',
    body: JSON.stringify({ type: 'site', features: ['seo', 'ecommerce'], urgency: 'fast', complexity: 'standard' }),
  });
  console.log('1) Orçamento de site (seo+ecommerce, prioritário):', quote.total);
  assert(quote.total > 800, 'total calculado corretamente');

  // 2. Criar pedido
  const order = await call('/api/orders', {
    method: 'POST',
    body: JSON.stringify({
      type: 'game',
      title: 'Teste Jogo AMDS',
      description: 'Jogo de teste automatizado',
      features: ['ranking', 'levels'],
      urgency: 'normal',
      complexity: 'standard',
      customer: { name: 'Teste', email: 'teste@amds.com' },
    }),
  });
  console.log('2) Pedido criado:', order.id, '| total:', order.total, '| status:', order.status);
  assert(order.id && order.status === 'pending_payment', 'pedido criado com status pendente');

  // 3. Criar cobrança PIX
  const charge = await call('/api/payments', {
    method: 'POST',
    body: JSON.stringify({ orderId: order.id, method: 'pix' }),
  });
  console.log('3) Cobrança PIX:', charge.paymentId, '| valor:', charge.amount);
  assert(charge.pix && charge.pix.copyPaste, 'código PIX gerado');

  // 4. Confirmar pagamento (webhook simulado)
  const confirmed = await call(`/api/payments/${charge.paymentId}/confirm`, { method: 'POST' });
  console.log('4) Pagamento confirmado | projeto:', confirmed.project.projectId, '| preview:', confirmed.project.previewUrl);
  assert(confirmed.payment.status === 'paid', 'pagamento marcado como pago');
  assert(confirmed.project.projectId, 'projeto gerado automaticamente');

  // 5. Buscar pedido atualizado
  const updated = await call(`/api/orders/${order.id}`);
  console.log('5) Pedido atualizado | status:', updated.status, '| projectId:', updated.projectId);
  assert(updated.status === 'paid', 'pedido atualizado para pago');
  assert(updated.previewUrl, 'previewUrl definido');

  // 6. Buscar detalhe do projeto
  const project = await call(`/api/projects/${updated.projectId}`);
  console.log('6) Projeto | arquivos:', project.files.map((f) => f.name).join(', '));
  assert(project.files.length === 3, 'projeto tem index.html, style.css e script.js');

  console.log('\n=== TODOS OS TESTES PASSARAM ===\n');
})().catch((err) => {
  console.error('\nERRO:', err.message);
  process.exit(1);
});