// AMDS - Lógica do frontend
// Cuida do catálogo, orçamento em tempo real, checkout e acompanhamento de pedidos.

const API = window.location.protocol === 'file:' ? 'http://localhost:3000' : ''; // suporta arquivo local e mesma origem
let CATALOG = null;
let currentOrder = null;
let quoteTimer = null;

if (document.body.classList.contains('page-soft') && window.location.pathname.endsWith('/pedido.html')) {
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !event.target.matches('input, textarea, select')) {
      window.location.href = 'index.html';
    }
  });
}

const els = {
  catalog: document.getElementById('catalog'),
  typeSelector: document.getElementById('type-selector'),
  typeInput: document.getElementById('type'),
  features: document.getElementById('features'),
  urgency: document.getElementById('urgency'),
  complexity: document.getElementById('complexity'),
  revisions: document.getElementById('revisions'),
  revisionCost: document.getElementById('revision-cost'),
  summaryItems: document.getElementById('summary-items'),
  summaryTotal: document.getElementById('summary-total'),
  summaryDays: document.getElementById('summary-days'),
  orderForm: document.getElementById('order-form'),
  formError: document.getElementById('form-error'),
  ordersList: document.getElementById('orders-list'),
  projectsList: document.getElementById('projects-list'),
  orderSearch: document.getElementById('order-search'),
  refreshOrders: document.getElementById('refresh-orders'),
  modal: document.getElementById('modal'),
  modalContent: document.getElementById('modal-content'),
  toast: document.getElementById('toast'),
  year: document.getElementById('year'),
};

// -------------------- Helpers --------------------
function brl(value) {
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function showToast(message, ms = 3000) {
  if (!els.toast) return;
  els.toast.textContent = message;
  els.toast.hidden = false;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => { els.toast.hidden = true; }, ms);
}

function openModal(html) {
  els.modalContent.innerHTML = html;
  els.modal.hidden = false;
}
function closeModal() {
  els.modal.hidden = true;
  els.modalContent.innerHTML = '';
}

async function api(path, options = {}) {
  let res;
  try {
    res = await fetch(API + path, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
  } catch (err) {
    throw new Error('Não foi possível conectar ao servidor. Abra pelo endereço http://localhost:3000 e confirme que o backend está rodando.');
  }
  let data = null;
  try { data = await res.json(); } catch (e) { data = null; }
  if (!res.ok) {
    const msg = (data && data.error) || `Erro ${res.status}`;
    const error = new Error(msg);
    error.status = res.status;
    throw error;
  }
  return data;
}

function setupAuthHeader() {
  const header = document.querySelector('.topbar-inner');
  if (!header || header.querySelector('.auth-header-button')) return;
  const link = document.createElement('a');
  link.className = 'auth-header-button';
  link.href = 'conta.html';
  link.textContent = 'Log-in';
  header.appendChild(link);
  api('/api/auth/me').then((data) => {
    link.textContent = data.user?.name ? data.user.name.split(' ')[0] : 'Minha conta';
    link.classList.add('is-authenticated');
  }).catch(() => {});
}

setupAuthHeader();

// -------------------- Catálogo --------------------
async function loadCatalog() {
  try {
    CATALOG = await api('/api/catalog');
    if (els.catalog) renderCatalogCards();
    renderTypeSelector();
    renderSelectOptions();
    if (els.revisionCost) els.revisionCost.textContent = brl(CATALOG.revisionCost);
  } catch (err) {
    if (els.catalog) els.catalog.innerHTML = `<p class="muted">Não foi possível carregar o catálogo: ${err.message}</p>`;
    bindFallbackTypeSelector();
  }
}

function renderCatalogCards() {
  const projectTypes = getVisibleProjectTypes();
  els.catalog.innerHTML = projectTypes.map((t) => `
    <div class="card">
      <div class="card-icon">${t.icon}</div>
      <h3>${t.label}</h3>
      <p>${t.description}</p>
      <ul class="card-features">
        ${t.features.map((f) => `<li>• ${f.label}</li>`).join('')}
      </ul>
      <button class="btn btn-primary btn-sm" data-choose="${t.key}">Escolher ${t.label}</button>
    </div>
  `).join('');

  els.catalog.querySelectorAll('[data-choose]').forEach((btn) => {
    btn.addEventListener('click', () => {
      window.location.href = `pedido.html?type=${encodeURIComponent(btn.getAttribute('data-choose'))}`;
    });
  });
}

function getVisibleProjectTypes() {
  return CATALOG.projectTypes.filter((type) => ['site', 'app', 'game', 'bots'].includes(type.key));
}

function renderTypeSelector() {
  if (!els.typeSelector) return;
  const projectTypes = getVisibleProjectTypes();
  els.typeSelector.innerHTML = projectTypes.map((t) => `
    <button type="button" class="type-option ${t.key === 'game' ? 'jogo' : t.key}" data-type="${t.key}">
      <span class="icon">${t.icon}</span>
      <span class="name">${t.label}</span>
    </button>
  `).join('');

  els.typeSelector.querySelectorAll('.type-option').forEach((opt) => {
    opt.addEventListener('click', () => selectType(opt.getAttribute('data-type')));
  });

  const requestedType = new URLSearchParams(window.location.search).get('type');
  selectType(projectTypes.some((type) => type.key === requestedType) ? requestedType : projectTypes[0].key);
}

function bindFallbackTypeSelector() {
  if (!els.typeSelector) return;
  els.typeSelector.querySelectorAll('.type-option').forEach((opt) => {
    opt.addEventListener('click', () => {
      els.typeInput.value = opt.getAttribute('data-type');
      els.typeSelector.querySelectorAll('.type-option').forEach((item) => item.classList.remove('active'));
      opt.classList.add('active');
    });
  });
  const first = els.typeSelector.querySelector('.type-option');
  if (first) first.click();
}

function selectType(key) {
  els.typeInput.value = key;
  els.typeSelector.querySelectorAll('.type-option').forEach((opt) => {
    opt.classList.toggle('active', opt.getAttribute('data-type') === key);
  });
  renderFeatures(key);
  updateQuote();
}

function renderFeatures(typeKey) {
  const type = CATALOG.projectTypes.find((t) => t.key === typeKey);
  if (!type) return;
  renderTypeQuestions(typeKey);
  els.features.innerHTML = type.features.map((f) => `
    <label class="feature-item">
      <input type="checkbox" value="${f.key}" ${f.price === 0 ? 'checked disabled' : ''} />
      <span>${f.label}</span>
      <span class="f-price">${f.price === 0 ? 'grátis' : '+ ' + brl(f.price)}</span>
    </label>
  `).join('');

  els.features.querySelectorAll('input[type=checkbox]').forEach((cb) => {
    cb.addEventListener('change', updateQuote);
  });
}

function renderTypeQuestions(typeKey) {
  const grid = document.querySelector('.briefing-grid');
  if (!grid) return;
  let panel = document.getElementById('type-questions');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'type-questions';
    panel.className = 'type-questions';
    grid.appendChild(panel);
  }

  const questions = {
    site: [
      ['pages', 'Quais páginas precisa?', 'Ex.: início, sobre, serviços e contato'],
      ['reference', 'Tem alguma referência?', 'Cole um link ou descreva o que gostou'],
    ],
    app: [
      ['platform', 'Onde o app vai funcionar?', 'Ex.: celular Android, iPhone ou navegador'],
      ['mainFlow', 'Qual é o fluxo principal?', 'Ex.: entrar, criar pedido e acompanhar status'],
      ['users', 'Quem poderá usar?', 'Ex.: clientes e equipe interna'],
    ],
    game: [
      ['genre', 'Que tipo de jogo você imagina?', 'Ex.: plataforma, cartas, quiz ou corrida'],
      ['mechanic', 'O que o jogador fará?', 'Ex.: desviar, montar, competir ou resolver desafios'],
      ['platform', 'Onde o jogo será jogado?', 'Ex.: celular, navegador ou computador'],
    ],
    bots: [
      ['channel', 'Onde o bot vai atender?', 'Ex.: WhatsApp, site, Discord ou Telegram'],
      ['tasks', 'Quais tarefas ele deve resolver?', 'Ex.: tirar dúvidas, captar pedidos e encaminhar equipe'],
      ['integrations', 'Precisa conectar com algum serviço?', 'Ex.: planilha, CRM, agenda ou sistema próprio'],
    ],
  };

  panel.innerHTML = `
    <div class="type-questions-heading"><strong>Detalhes para ${typeKey === 'game' ? 'o jogo' : typeKey === 'bots' ? 'o bot' : `o ${typeKey}`}</strong><span>Ajude o agente a criar uma primeira versão mais precisa.</span></div>
    <div class="type-questions-grid">
      ${(questions[typeKey] || []).map(([key, label, placeholder]) => `
        <label class="field"><span>${label}</span><input type="text" data-type-detail="${key}" placeholder="${placeholder}" /></label>
      `).join('')}
    </div>
  `;
}

function getTypeDetails() {
  return Array.from(document.querySelectorAll('[data-type-detail]')).reduce((details, input) => {
    details[input.getAttribute('data-type-detail')] = input.value.trim();
    return details;
  }, {});
}

function renderSelectOptions() {
  if (!els.urgency || !els.complexity) return;
  els.urgency.innerHTML = CATALOG.urgencies.map((u) => `
    <option value="${u.key}" ${u.key === 'normal' ? 'selected' : ''}>${u.label}${u.multiplier > 1 ? ` (+${Math.round((u.multiplier - 1) * 100)}%)` : ''}</option>
  `).join('');

  els.complexity.innerHTML = CATALOG.complexities.map((c) => `
    <option value="${c.key}" ${c.key === 'standard' ? 'selected' : ''}>${c.label}${c.multiplier !== 1 ? ` (${c.multiplier > 1 ? '+' : ''}${Math.round((c.multiplier - 1) * 100)}%)` : ''}</option>
  `).join('');
}

// -------------------- Orçamento --------------------
function getSelectedFeatures() {
  return Array.from(els.features.querySelectorAll('input[type=checkbox]:checked'))
    .map((cb) => cb.value);
}

function getQuotePayload() {
  return {
    type: els.typeInput.value,
    features: getSelectedFeatures(),
    urgency: els.urgency.value,
    complexity: els.complexity.value,
    revisions: parseInt(els.revisions?.value, 10) || 0,
  };
}

function updateQuote() {
  clearTimeout(quoteTimer);
  quoteTimer = setTimeout(doQuote, 120);
}

async function doQuote() {
  if (!els.typeInput.value) return;
  try {
    const quote = await api('/api/quote', {
      method: 'POST',
      body: JSON.stringify(getQuotePayload()),
    });
    if (!els.summaryItems || !els.summaryTotal || !els.summaryDays) return;
    els.summaryItems.innerHTML = quote.items.map((item) => `
      <li><span>${item.label}</span><span>${brl(item.price)}</span></li>
    `).join('') || '<li class="muted">Sem itens</li>';
    els.summaryTotal.textContent = brl(quote.total);
    els.summaryDays.textContent = quote.estimatedDays + ' dias';
  } catch (err) {
    if (!els.summaryItems || !els.summaryTotal) return;
    els.summaryItems.innerHTML = `<li class="muted">${err.message}</li>`;
    els.summaryTotal.textContent = brl(0);
  }
}

// -------------------- Envio do pedido --------------------
if (els.orderForm) els.orderForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  els.formError.hidden = true;
  const submitButton = els.orderForm.querySelector('button[type="submit"]');

  const payload = {
    ...getQuotePayload(),
    title: document.getElementById('title').value.trim() || 'Minha nova criação',
    description: document.getElementById('description').value.trim(),
    briefing: {
      objective: document.getElementById('objective')?.value || 'presence',
      audience: document.getElementById('audience')?.value.trim() || '',
      style: document.getElementById('siteStyle')?.value || 'clean',
      primaryColor: document.getElementById('primaryColor')?.value || 'auto',
      callToAction: document.getElementById('callToAction')?.value || 'contact',
      needsAds: Boolean(document.getElementById('needsAds')?.checked),
      needsSocial: Boolean(document.getElementById('needsSocial')?.checked),
      typeDetails: getTypeDetails(),
    },
    customer: {
      name: document.getElementById('name').value.trim(),
      email: document.getElementById('email').value.trim(),
      company: document.getElementById('company')?.value.trim() || '',
    },
  };

  if (!payload.title) return showFormError('Informe um título para o projeto.');
  if (!payload.type) return showFormError('Escolha o tipo de projeto.');
  if (payload.description.length < 10) return showFormError('Descreva os detalhes do projeto com pelo menos 10 caracteres.');
  if (payload.briefing.audience.length < 2) return showFormError('Informe quem você quer alcançar.');
  if (!payload.customer.name || payload.customer.name.length < 2) return showFormError('Informe seu nome.');
  if (!/^\S+@\S+\.\S+$/.test(payload.customer.email)) return showFormError('Informe um e-mail válido.');

  submitButton.disabled = true;
  submitButton.classList.add('is-loading');
  submitButton.setAttribute('aria-busy', 'true');
  submitButton.innerHTML = '<span class="spinner" aria-hidden="true"></span><span>Criando visualização...</span>';

  try {
    showGenerationProgress(payload.title);
    const request = api('/api/orders', { method: 'POST', body: JSON.stringify(payload) });
    const minimumDisplayTime = new Promise((resolve) => setTimeout(resolve, 900));
    const [order] = await Promise.all([request, minimumDisplayTime]);
    currentOrder = order;
    window.location.href = `criacao.html?order=${encodeURIComponent(order.id)}`;
  } catch (err) {
    if (err.status === 401) {
      window.location.href = `conta.html?next=${encodeURIComponent('pedido.html')}`;
      return;
    }
    showFormError(err.message);
  } finally {
    submitButton.disabled = false;
    submitButton.classList.remove('is-loading');
    submitButton.removeAttribute('aria-busy');
    submitButton.innerHTML = 'Finalizar pedido <span aria-hidden="true">→</span>';
  }
});

function showGenerationProgress(title) {
  openModal(`
    <div class="generation-progress" role="status" aria-live="polite">
      <span class="generation-spinner spinner-dark" aria-hidden="true"></span>
      <span class="eyebrow">Criação local em andamento</span>
      <h3>Montando ${title}</h3>
      <p class="muted">O agente está preparando cada detalhe da sua criação.</p>
      <ol class="generation-steps">
        <li class="is-active"><span></span>Interpretando seu briefing</li>
        <li><span></span>Definindo a estrutura</li>
        <li><span></span>Gerando visual e conteúdo</li>
        <li><span></span>Preparando a prévia</li>
      </ol>
    </div>
  `);

  const steps = els.modalContent.querySelectorAll('.generation-steps li');
  steps.forEach((step, index) => {
    setTimeout(() => {
      steps[index - 1]?.classList.replace('is-active', 'is-done');
      step.classList.add('is-active');
    }, (index + 1) * 220);
  });
}

function showFormError(msg) {
  els.formError.textContent = msg;
  els.formError.hidden = false;
}

function showPreview(order) {
  openModal(`
    <span class="eyebrow">Primeira visualização</span>
    <h3>${order.title}</h3>
    <p class="muted">O agente criou uma primeira versão. Confira e peça melhorias antes de finalizar.</p>
    <div class="preview-frame"><iframe src="${order.previewUrl}" title="Prévia de ${order.title}"></iframe></div>
    <div class="revision-chat">
      <label for="revision-input">Quer adicionar ou melhorar alguma coisa?</label>
      <textarea id="revision-input" rows="3" placeholder="Ex.: deixe as cores mais claras e adicione uma seção de contato..."></textarea>
      <div id="revision-error" class="form-error" hidden></div>
      <p class="muted small">O valor final será calculado quando você aprovar esta versão. Cada melhoria solicitada acrescenta R$ 1,00.</p>
      <div class="actions-row"><button class="btn btn-ghost btn-sm" id="request-revision">Adicionar melhoria</button><button class="btn btn-primary btn-sm" id="finish-order">Finalizar e ver valor</button></div>
    </div>
  `);
  document.getElementById('request-revision').addEventListener('click', () => requestRevision(order));
  document.getElementById('finish-order').addEventListener('click', () => openCheckout(order));
}

async function requestRevision(order) {
  const input = document.getElementById('revision-input');
  const error = document.getElementById('revision-error');
  const button = document.getElementById('request-revision');
  const addition = input.value.trim();
  if (addition.length < 3) { error.textContent = 'Escreva pelo menos uma melhoria.'; error.hidden = false; return; }
  button.disabled = true;
  button.innerHTML = '<span class="spinner" aria-hidden="true"></span> Atualizando...';
  try {
    const updated = await api(`/api/orders/${order.id}/revisions`, { method: 'POST', body: JSON.stringify({ addition }) });
    currentOrder = updated;
    showPreview(updated);
  } catch (err) {
    error.textContent = err.message;
    error.hidden = false;
    button.disabled = false;
    button.textContent = 'Adicionar melhoria';
  }
}

// -------------------- Checkout --------------------
async function openCheckout(order) {
  let methods = [];
  try { methods = await api('/api/payment-methods'); } catch (e) { methods = []; }

  openModal(`
    <h3>Finalizar pedido</h3>
    <p class="muted">${order.typeLabel} — <strong>${order.title}</strong><br/>Total: <strong>${brl(order.total)}</strong></p>
    <div class="pay-methods">
      ${methods.map((m) => `
        <div class="pay-method" data-method="${m.key}">
          <div>
            <div class="pm-title">${m.label}</div>
            <div class="pm-sub">${m.feeRate > 0 ? `taxa de ${(m.feeRate * 100).toFixed(2)}%` : 'sem taxas'}${m.daysToConfirm > 0 ? ` · confirma em ~${m.daysToConfirm} dia(s)` : ''}</div>
          </div>
        </div>
      `).join('')}
    </div>
    <div id="pay-area"></div>
  `);

  els.modalContent.querySelectorAll('.pay-method').forEach((el) => {
    el.addEventListener('click', () => {
      els.modalContent.querySelectorAll('.pay-method').forEach((x) => x.classList.remove('active'));
      el.classList.add('active');
      createCharge(order.id, el.getAttribute('data-method'));
    });
  });

  // Seleciona PIX por padrão
  const first = els.modalContent.querySelector('.pay-method');
  if (first) { first.classList.add('active'); createCharge(order.id, first.getAttribute('data-method')); }
}

async function createCharge(orderId, method) {
  const area = document.getElementById('pay-area');
  area.innerHTML = '<p class="muted">Gerando cobrança...</p>';
  try {
    const charge = await api('/api/payments', {
      method: 'POST',
      body: JSON.stringify({ orderId, method }),
    });
    renderCharge(charge);
  } catch (err) {
    area.innerHTML = `<p class="form-error">${err.message}</p>`;
  }
}

function renderCharge(charge) {
  const area = document.getElementById('pay-area');
  let body = '';

  if (charge.method === 'pix' && charge.pix) {
    body = `
      <p class="muted">Pague com PIX usando a chave ou o código copia e cola:</p>
      <div class="code-box">${charge.pix.copyPaste}</div>
      <p class="muted small">Chave: ${charge.pix.key}</p>
      <div class="actions-row">
        <button class="btn btn-ghost btn-sm" id="copy-pix">Copiar código</button>
        <button class="btn btn-success btn-sm" id="confirm-pay">Já paguei</button>
      </div>
    `;
  } else if (charge.method === 'boleto' && charge.boleto) {
    body = `
      <p class="muted">Pague o boleto até ${new Date(charge.boleto.dueDate).toLocaleDateString('pt-BR')}:</p>
      <div class="code-box">${charge.boleto.digitableLine}</div>
      <div class="actions-row">
        <button class="btn btn-success btn-sm" id="confirm-pay">Simular pagamento</button>
      </div>
    `;
  } else if (charge.method === 'card') {
    body = `
      <p class="muted">Pagamento no cartão (simulado). Clique para confirmar:</p>
      <div class="actions-row">
        <button class="btn btn-success btn-sm" id="confirm-pay">Pagar ${brl(charge.amount)}</button>
      </div>
    `;
  } else {
    body = '<p class="muted">Forma de pagamento indisponível.</p>';
  }

  area.innerHTML = body;

  const copyBtn = document.getElementById('copy-pix');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(charge.pix.copyPaste);
      showToast('Código PIX copiado!');
    });
  }

  const confirmBtn = document.getElementById('confirm-pay');
  if (confirmBtn) {
    confirmBtn.addEventListener('click', () => confirmPayment(charge.paymentId));
  }
}

async function confirmPayment(paymentId) {
  try {
    const result = await api(`/api/payments/${paymentId}/confirm`, { method: 'POST' });
    showToast('Pagamento confirmado! Gerando seu projeto...');
    renderSuccess(result);
    loadOrders();
  } catch (err) {
    showToast('Erro ao confirmar: ' + err.message);
  }
}

function renderSuccess(result) {
  const project = result.project || {};
  openModal(`
    <h3>Pagamento confirmado</h3>
    <p class="muted">Seu projeto foi gerado pelo nosso agente.</p>
    <div class="code-box">ID do projeto: ${project.projectId || '—'}</div>
    <div class="actions-row">
      <a class="btn btn-primary btn-sm" href="${project.previewUrl}" target="_blank" rel="noopener">Ver prévia do projeto</a>
      <button class="btn btn-ghost btn-sm" data-close>Fechar</button>
    </div>
  `);
  els.modalContent.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', closeModal));
}

// -------------------- Meus pedidos --------------------
async function loadOrders() {
  if (!els.ordersList) return;
  try {
    const search = els.orderSearch.value.trim();
    const orders = await api('/api/orders');
    const filtered = search
      ? orders.filter((o) => o.id.toLowerCase().includes(search.toLowerCase()))
      : orders;

    if (!filtered.length) {
      els.ordersList.innerHTML = '<p class="muted">Nenhum pedido encontrado.</p>';
      return;
    }

    els.ordersList.innerHTML = filtered.slice().reverse().map((o) => `
      <div class="order-card">
        <div class="oc-main">
          <h4>${o.title}</h4>
          <p>${o.typeLabel} · ID: ${o.id}</p>
          <span class="status-pill status-${o.status}">${statusLabel(o.status)}</span>
        </div>
        <div class="oc-right">
          <strong>${brl(o.total)}</strong><br/>
          ${o.previewUrl
            ? `<a class="btn btn-ghost btn-sm" href="${o.previewUrl}" target="_blank" rel="noopener">Ver projeto</a>`
            : `<button class="btn btn-primary btn-sm" data-pay-order="${o.id}">Pagar</button>`}
        </div>
      </div>
    `).join('');

    els.ordersList.querySelectorAll('[data-pay-order]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const order = filtered.find((o) => o.id === btn.getAttribute('data-pay-order'));
        if (order) { currentOrder = order; openCheckout(order); }
      });
    });
  } catch (err) {
    els.ordersList.innerHTML = `<p class="muted">Erro ao carregar pedidos: ${err.message}</p>`;
  }
}

async function loadProjects() {
  if (!els.projectsList) return;
  try {
    const projects = await api('/api/projects');
    if (!projects.length) {
      els.projectsList.innerHTML = '<p class="muted">Ainda não há projetos publicados.</p>';
      return;
    }
    els.projectsList.innerHTML = projects.slice().reverse().map((project) => `
      <article class="made-project">
        <div class="made-project-preview">
          <iframe src="${project.previewUrl}" title="Prévia de ${project.title}" loading="lazy"></iframe>
        </div>
        <div class="made-project-info">
          <span class="eyebrow">${project.typeLabel || project.type}</span>
          <h2>${project.title}</h2>
          <p>${project.description || 'Projeto criado a partir de uma ideia.'}</p>
          <a class="btn btn-primary btn-sm" href="${project.previewUrl}" target="_blank" rel="noopener">Abrir projeto <span aria-hidden="true">↗</span></a>
        </div>
      </article>
    `).join('');
  } catch (err) {
    els.projectsList.innerHTML = `<p class="form-error">Não foi possível carregar os projetos: ${err.message}</p>`;
  }
}

function statusLabel(status) {
  return {
    pending_payment: 'Aguardando pagamento',
    payment_pending: 'Pagamento em andamento',
    paid: 'Pago',
  }[status] || status;
}

// -------------------- Eventos gerais --------------------
if (els.revisions) els.revisions.addEventListener('input', updateQuote);
if (els.urgency) els.urgency.addEventListener('change', updateQuote);
if (els.complexity) els.complexity.addEventListener('change', updateQuote);
if (els.refreshOrders) els.refreshOrders.addEventListener('click', loadOrders);
if (els.orderSearch) els.orderSearch.addEventListener('input', () => loadOrders());

document.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', closeModal));
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

// Inicialização
if (els.year) els.year.textContent = new Date().getFullYear();
loadCatalog();
loadOrders();
loadProjects();