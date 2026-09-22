const API = window.location.protocol === 'file:' ? 'http://localhost:3000' : '';
const orderId = new URLSearchParams(window.location.search).get('order');
const state = document.getElementById('creation-state');
const content = document.getElementById('workspace-content');
let order = null;

async function api(path, options = {}) {
  const response = await fetch(API + path, { headers: { 'Content-Type': 'application/json' }, ...options });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(data?.error || `Erro ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return data;
}

function setupAuthHeader() {
  const header = document.querySelector('.topbar-inner');
  if (!header) return;
  const link = document.createElement('a');
  link.className = 'auth-header-button';
  link.href = 'conta.html';
  link.textContent = 'Log-in';
  header.appendChild(link);
  api('/api/auth/me').then((data) => { link.textContent = data.user?.name?.split(' ')[0] || 'Minha conta'; link.classList.add('is-authenticated'); }).catch(() => {});
}

setupAuthHeader();

function money(value) {
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
}

function advanceSteps() {
  const steps = document.querySelectorAll('.workspace-steps li');
  steps.forEach((step, index) => {
    setTimeout(() => {
      steps[index - 1]?.classList.replace('is-active', 'is-done');
      step.classList.add('is-active');
    }, (index + 1) * 650);
  });
}

async function loadOrder() {
  if (!orderId) throw new Error('Pedido não informado.');
  order = await api(`/api/orders/${encodeURIComponent(orderId)}`);
  setTimeout(renderWorkspace, 2800);
}

function renderWorkspace() {
  state.hidden = true;
  content.hidden = false;
  const suggestions = {
    site: ['Como publico este projeto?', 'Quero mudar uma cor', 'Como adiciono meu Pix aqui?'],
    app: ['Qual é o fluxo principal do app?', 'Como adiciono login?', 'Quero mudar uma tela'],
    game: ['Como ajusto a dificuldade?', 'Como adiciono fases?', 'Quero mudar a mecânica'],
    bots: ['Como conecto meu bot ao WhatsApp?', 'Quais respostas ele consegue dar?', 'Como adiciono meu Pix aqui?'],
  }[order.type] || ['Como publico este projeto?', 'Quero mudar uma cor', 'Como adiciono meu Pix aqui?'];
  content.innerHTML = `
    <div class="workspace-heading"><div><span class="eyebrow">Projeto criado</span><h1>${escapeHtml(order.title)}</h1><p class="muted">A primeira versão está pronta. Veja, converse com o agente e peça ajustes.</p></div><span class="workspace-status">Prévia pronta</span></div>
    <div class="workspace-grid">
      <section class="workspace-preview"><div class="panel-label"><span>Prévia navegável</span><a href="${order.previewUrl}" target="_blank" rel="noreferrer">Abrir em nova aba ↗</a></div><iframe src="${order.previewUrl}" title="Prévia de ${escapeHtml(order.title)}"></iframe></section>
      <aside class="support-panel"><div class="panel-label"><span>Suporte do agente</span><span class="online-dot">● online</span></div><div id="support-messages" class="support-messages"><div class="support-message agent">Projeto acabado de ser criado. Eu conheço o tipo, o briefing e os arquivos desta versão. Pergunte como alterar, publicar ou conectar qualquer parte.</div></div><form id="support-form" class="support-form"><input id="support-input" type="text" placeholder="Ex.: como adiciono meu Pix aqui?" autocomplete="off" required /><button class="btn btn-primary btn-sm" type="submit" aria-label="Enviar dúvida">Enviar</button></form><div class="support-suggestions">${suggestions.map((suggestion) => `<button type="button">${suggestion}</button>`).join('')}</div></aside>
    </div>
    <div class="workspace-actions"><div><strong>${escapeHtml(order.typeLabel)}</strong><span class="muted">Orçamento atual: ${money(order.total)}</span></div><button id="approve-button" class="btn btn-primary">Aprovar e ver pagamento <span>→</span></button></div>
    <div id="payment-area" class="payment-area" hidden></div>
  `;
  document.getElementById('support-form').addEventListener('submit', askSupport);
  document.querySelectorAll('.support-suggestions button').forEach((button) => button.addEventListener('click', () => askSupport({ question: button.textContent })));
  document.getElementById('approve-button').addEventListener('click', openPayment);
}

async function askSupport(event) {
  event?.preventDefault?.();
  const input = document.getElementById('support-input');
  const question = event?.question || input.value.trim();
  if (!question) return;
  const messages = document.getElementById('support-messages');
  messages.insertAdjacentHTML('beforeend', `<div class="support-message user">${escapeHtml(question)}</div><div class="support-message agent typing">Pensando no seu projeto...</div>`);
  input.value = '';
  messages.scrollTop = messages.scrollHeight;
  try {
    const reply = await api(`/api/orders/${encodeURIComponent(order.id)}/support`, { method: 'POST', body: JSON.stringify({ question }) });
    messages.querySelector('.typing')?.remove();
    const steps = reply.nextSteps?.length ? `<div class="support-next"><strong>Próximos passos</strong><ul>${reply.nextSteps.map((step) => `<li>${escapeHtml(step)}</li>`).join('')}</ul></div>` : '';
    const context = reply.context ? `<small>Contexto: ${escapeHtml(reply.context.type)} · público: ${escapeHtml(reply.context.audience)}</small>` : '';
    messages.insertAdjacentHTML('beforeend', `<div class="support-message agent">${escapeHtml(reply.answer)}${steps}${context}${reply.file ? `<a href="${reply.file}" target="_blank" rel="noreferrer">Abrir arquivo relacionado ↗</a>` : ''}</div>`);
  } catch (error) {
    messages.querySelector('.typing')?.remove();
    messages.insertAdjacentHTML('beforeend', `<div class="support-message agent">Não consegui consultar o projeto agora: ${escapeHtml(error.message)}</div>`);
  }
  messages.scrollTop = messages.scrollHeight;
}

async function openPayment() {
  const area = document.getElementById('payment-area');
  area.hidden = false;
  area.innerHTML = '<p class="muted">Carregando formas de pagamento...</p>';
  try {
    const methods = await api('/api/payment-methods');
    area.innerHTML = `<h2>Escolha como continuar</h2><p class="muted">Total do projeto: <strong>${money(order.total)}</strong></p><div class="pay-methods">${methods.map((method) => `<button class="pay-method" data-method="${method.key}">${method.label}</button>`).join('')}</div><div id="charge-result"></div>`;
    area.querySelectorAll('.pay-method').forEach((button) => button.addEventListener('click', () => createCharge(button.dataset.method)));
  } catch (error) {
    area.innerHTML = `<p class="form-error">${escapeHtml(error.message)}</p>`;
  }
}

async function createCharge(method) {
  const result = document.getElementById('charge-result');
  result.innerHTML = '<p class="muted">Gerando cobrança...</p>';
  try {
    const charge = await api('/api/payments', { method: 'POST', body: JSON.stringify({ orderId: order.id, method }) });
    result.innerHTML = `<div class="charge-card"><strong>${escapeHtml(charge.label || 'Cobrança criada')}</strong><p class="muted">${charge.pix ? `Código Pix: ${escapeHtml(charge.pix.copyPaste)}` : 'A cobrança foi criada para confirmação.'}</p></div>`;
  } catch (error) {
    result.innerHTML = `<p class="form-error">${escapeHtml(error.message)}</p>`;
  }
}

advanceSteps();
loadOrder().catch((error) => {
  if (error.status === 401) {
    window.location.href = `conta.html?next=${encodeURIComponent(`criacao.html?order=${orderId}`)}`;
    return;
  }
  state.innerHTML = `<span class="eyebrow">Não foi possível abrir</span><h1>Pedido não encontrado</h1><p class="muted">${escapeHtml(error.message)}</p><a class="btn btn-primary" href="pedido.html">Voltar ao pedido</a>`;
});
