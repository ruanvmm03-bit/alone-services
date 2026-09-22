/**
 * AMDS - Rota de pedidos (orders).
 * POST /api/orders            -> cria um pedido (calcula orçamento)
 * GET  /api/orders            -> lista pedidos
 * GET  /api/orders/:id        -> detalhe de um pedido
 */

const express = require('express');
const { calculateQuote, round2 } = require('../lib/catalog');
const store = require('../lib/store');
const { generateProject, getProjectSize } = require('../lib/generator');
const auth = require('../lib/auth');

const router = express.Router();

function supportReply(order, question) {
  const text = String(question || '').toLowerCase();
  const files = order.projectId ? `/generated/${order.projectId}/` : '/generated/';
  const details = order.briefing?.typeDetails || {};
  const typeLabel = String(order.typeLabel || order.type || 'projeto').toLowerCase();
  const projectFiles = {
    site: ['index.html', 'style.css', 'script.js'],
    app: ['index.html', 'style.css', 'script.js'],
    game: ['index.html', 'style.css', 'script.js'],
    bots: ['index.html', 'style.css', 'script.js'],
  }[order.type] || ['index.html', 'style.css', 'script.js'];
  const response = (answer, nextSteps, file = projectFiles[0]) => ({
    answer,
    nextSteps,
    file: `${files}${file}`,
    context: {
      type: typeLabel,
      audience: order.briefing?.audience || 'não informado',
      details,
      files: projectFiles.map((name) => `${files}${name}`),
    },
  });

  if (text.includes('pix') || text.includes('pagamento')) {
    return response(`Para adicionar o Pix ao ${typeLabel}, coloque a chave ou o link de checkout no fluxo de pagamento do projeto. Nesta versão local, o pagamento é demonstrativo e fica em script.js. Para receber de verdade, use um checkout seguro e valide o pagamento no backend.`, ['Definir a chave Pix ou provedor', 'Trocar o botão demonstrativo por checkout', 'Testar confirmação antes de publicar'], 'script.js');
  }
  if (text.includes('public') || text.includes('hosped') || text.includes('online')) {
    return response(`O projeto foi criado localmente em ${files}. Ele está organizado em ${projectFiles.join(', ')}. Para publicar, envie esses arquivos para uma hospedagem estática, configure o domínio e substitua as integrações de teste pelos serviços reais.`, ['Escolher hospedagem', 'Configurar domínio e HTTPS', 'Testar formulário e integrações em produção'], 'index.html');
  }
  if (text.includes('mudar') || text.includes('alterar') || text.includes('cor')) {
    return response(`Para alterar o ${typeLabel}, cores e layout ficam em ${files}style.css; conteúdo fica em ${files}index.html; comportamento fica em ${files}script.js. Descreva a mudança com o resultado esperado e eu gero uma nova versão.`, ['Descrever a mudança', 'Informar onde ela aparece', 'Revisar a nova prévia'], 'style.css');
  }
  const typePlans = {
    site: { focus: 'navegação, conteúdo e conversão', question: 'Quais páginas, textos ou ações você quer priorizar?', steps: ['Revisar navegação', 'Validar chamada principal', 'Testar contato no celular'] },
    app: { focus: `o fluxo ${details.mainFlow || 'principal do usuário'}`, question: 'Qual etapa do fluxo precisa ficar mais clara?', steps: ['Validar as telas principais', 'Testar estados vazio e erro', 'Definir autenticação e dados reais'] },
    game: { focus: `${details.genre || 'a mecânica'} e ${details.mechanic || 'a jogabilidade'}`, question: 'O que deve deixar o jogo mais divertido?', steps: ['Testar controles', 'Ajustar dificuldade', 'Definir pontuação e encerramento'] },
    bots: { focus: `${details.tasks || 'as tarefas de atendimento'} em ${details.channel || 'seu canal'}`, question: 'Qual pergunta ou tarefa o bot precisa resolver primeiro?', steps: ['Listar perguntas frequentes', 'Definir respostas de fallback', 'Conectar o canal e as integrações'] },
  };
  const plan = typePlans[order.type] || { focus: 'estrutura e conteúdo', question: 'Qual parte você quer melhorar?', steps: ['Revisar a prévia', 'Descrever uma melhoria', 'Testar a entrega'] };
  return response(`Estou acompanhando “${order.title}”, um ${typeLabel} para ${order.briefing?.audience || 'seu público'}. A primeira versão está focada em ${plan.focus}. ${plan.question}`, plan.steps, projectFiles[0]);
}

function applyFileWeight(order, quote, fileSizeBytes) {
  const sizeMb = fileSizeBytes / (1024 * 1024);
  const fileWeightFee = Math.max(10, round2(sizeMb * 120));
  const revisionFee = Number(order.revisionRequests?.length || 0);
  const items = [...quote.items, { key: 'file_weight', label: `Entrega do projeto (${(sizeMb * 1024).toFixed(1)} KB)`, price: fileWeightFee }];
  if (revisionFee > 0) items.push({ key: 'revisions', label: `${revisionFee} melhoria(s) solicitada(s)`, price: revisionFee });
  const total = round2(quote.total + fileWeightFee + revisionFee);
  return { ...quote, items, total, fileSizeBytes, fileWeightFee, revisionFee, subtotal: total, platformFee: round2(total * 0.1), developerPayout: round2(total * 0.9) };
}

function savePreview(order, quote) {
  const generated = generateProject(order, { features: order.features });
  const fileSizeBytes = getProjectSize(generated.projectId);
  const pricedQuote = applyFileWeight(order, quote, fileSizeBytes);
  const updated = store.updateOrder(order.id, {
    quote: pricedQuote,
    total: pricedQuote.total,
    status: 'preview_ready',
    projectId: generated.projectId,
    previewUrl: generated.previewUrl,
    previewSizeBytes: fileSizeBytes,
  });
  const existingProject = store.getProject(generated.projectId);
  if (!existingProject) {
    store.createProject({ projectId: generated.projectId, orderId: order.id, type: generated.type, typeLabel: order.typeLabel, title: order.title, description: order.description, files: generated.files, previewUrl: generated.previewUrl });
  } else {
    store.updateProject(generated.projectId, { description: order.description, files: generated.files, previewUrl: generated.previewUrl });
  }
  return updated;
}

router.post('/orders', auth.requireAuth, (req, res) => {
  try {
    const body = req.body || {};
    const { type, title, description, briefing = {}, features = [], urgency, complexity, revisions, customer = {} } = body;

    if (!title || String(title).trim().length < 2) {
      return res.status(400).json({ error: 'Informe um título para o projeto.' });
    }
    if (!type) {
      return res.status(400).json({ error: 'Escolha o tipo de projeto.' });
    }
    if (!description || String(description).trim().length < 10) {
      return res.status(400).json({ error: 'Descreva os detalhes do projeto (pelo menos 10 caracteres).' });
    }
    if (!briefing.audience || String(briefing.audience).trim().length < 2) {
      return res.status(400).json({ error: 'Informe quem você quer alcançar.' });
    }
    if (!customer.name || String(customer.name).trim().length < 2) {
      return res.status(400).json({ error: 'Informe nome e e-mail para contato.' });
    }
    if (!customer.email || !/^\S+@\S+\.\S+$/.test(String(customer.email).trim())) {
      return res.status(400).json({ error: 'Informe um e-mail válido para contato.' });
    }

    const quote = calculateQuote({
      type,
      features: Array.isArray(features) ? features : [],
      urgency,
      complexity,
      revisions,
    });

    const order = store.createOrder({
      type: quote.type,
      typeLabel: quote.typeLabel,
      title: String(title).trim(),
      description: description ? String(description).trim() : '',
      briefing: {
        objective: String(briefing.objective || 'presence'),
        audience: String(briefing.audience || '').trim(),
        style: String(briefing.style || 'clean'),
        primaryColor: String(briefing.primaryColor || 'auto'),
        callToAction: String(briefing.callToAction || 'contact'),
        needsAds: briefing.needsAds === true,
        needsSocial: briefing.needsSocial === true,
        typeDetails: briefing.typeDetails && typeof briefing.typeDetails === 'object' ? briefing.typeDetails : {},
      },
      features: Array.isArray(features) ? features : [],
      urgency: quote.urgency,
      complexity: quote.complexity,
      revisions: Number.isInteger(revisions) ? revisions : 0,
      customer: {
        name: String(customer.name).trim(),
        email: String(customer.email).trim(),
        company: customer.company ? String(customer.company).trim() : '',
      },
      userId: req.user.id,
      quote,
      total: quote.total,
      status: 'preview_generating',
    });

    res.status(201).json(savePreview(order, quote));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.post('/orders/:id/revisions', auth.requireAuth, (req, res) => {
  try {
    const order = store.getOrder(req.params.id);
    if (!order) return res.status(404).json({ error: 'Pedido não encontrado.' });
    if (order.userId !== req.user.id) return res.status(403).json({ error: 'Você não tem acesso a este pedido.' });
    if (order.status === 'paid' || order.status === 'payment_pending') return res.status(409).json({ error: 'Este pedido já está em finalização.' });
    const addition = String(req.body?.addition || '').trim();
    if (addition.length < 3) return res.status(400).json({ error: 'Escreva uma melhoria para o projeto.' });
    const description = `${order.description || ''}\n\nMelhoria solicitada: ${addition}`.trim();
    const revisionRequests = [...(order.revisionRequests || []), addition];
    const updatedDraft = { ...order, description, status: 'preview_generating', revisionRequests };
    const quote = calculateQuote({ type: order.type, features: order.features, urgency: order.urgency, complexity: order.complexity, revisions: order.revisions });
    store.updateOrder(order.id, { description, status: 'preview_generating', revisionRequests });
    const revisedOrder = store.getOrder(order.id);
    const updated = savePreview({ ...revisedOrder, ...updatedDraft, revisionRequests }, quote);
    res.json(updated);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.get('/orders', auth.requireAuth, (req, res) => {
  const orders = store.listOrders().filter((order) => order.userId === req.user.id);
  res.json(orders);
});

router.get('/orders/:id', auth.requireAuth, (req, res) => {
  const order = store.getOrder(req.params.id);
  if (!order) return res.status(404).json({ error: 'Pedido não encontrado.' });
  if (order.userId !== req.user.id) return res.status(403).json({ error: 'Você não tem acesso a este pedido.' });
  res.json(order);
});

router.post('/orders/:id/support', auth.requireAuth, (req, res) => {
  const order = store.getOrder(req.params.id);
  if (!order) return res.status(404).json({ error: 'Pedido não encontrado.' });
  if (order.userId !== req.user.id) return res.status(403).json({ error: 'Você não tem acesso a este pedido.' });
  const question = String(req.body?.question || '').trim();
  if (question.length < 2) return res.status(400).json({ error: 'Escreva uma dúvida para o suporte.' });
  res.json({ ...supportReply(order, question), local: true });
});

module.exports = router;