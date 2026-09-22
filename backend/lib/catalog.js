/**
 * AMDS - Catálogo de serviços e precificação.
 * Define os tipos de projeto (sites, apps, jogos) e seus preços em BRL.
 */

const PROJECT_TYPES = {
  site: {
    key: 'site',
    label: 'Site',
    description: 'Sites institucionais, landing pages, portfólios, blogs e lojas.',
    icon: '🌐',
    basePrice: 800,
    features: [
      { key: 'responsive', label: 'Design responsivo', price: 0 },
      { key: 'seo', label: 'Otimização SEO', price: 300 },
      { key: 'cms', label: 'Painel administrativo (CMS)', price: 600 },
      { key: 'ecommerce', label: 'Loja / carrinho de compras', price: 1200 },
      { key: 'blog', label: 'Blog integrado', price: 350 },
    ],
  },
  app: {
    key: 'app',
    label: 'Aplicativo',
    description: 'Apps web e mobile (Android / iOS) sob medida.',
    icon: '📱',
    basePrice: 2500,
    features: [
      { key: 'responsive', label: 'Layout responsivo', price: 0 },
      { key: 'auth', label: 'Login e cadastro de usuários', price: 500 },
      { key: 'push', label: 'Notificações push', price: 400 },
      { key: 'offline', label: 'Modo offline', price: 700 },
      { key: 'payments', label: 'Pagamentos no app', price: 900 },
      { key: 'api', label: 'API / integração externa', price: 800 },
    ],
  },
  game: {
    key: 'game',
    label: 'Jogo',
    description: 'Jogos 2D, protótipos e gamificação para web e mobile.',
    icon: '🎮',
    basePrice: 3000,
    features: [
      { key: 'multiplayer', label: 'Multijogador', price: 2500 },
      { key: 'ranking', label: 'Ranking / placar online', price: 600 },
      { key: 'levels', label: 'Sistema de fases', price: 500 },
      { key: 'achievements', label: 'Conquistas', price: 400 },
      { key: 'custom_art', label: 'Arte customizada', price: 1200 },
      { key: 'ads', label: 'Monetização com anúncios', price: 300 },
    ],
  },
  bots: {
    key: 'bots',
    label: 'Bots',
    description: 'Bots para atendimento, automações e integrações com serviços.',
    icon: '🤖',
    basePrice: 1800,
    features: [
      { key: 'automation', label: 'Automação de tarefas', price: 0 },
      { key: 'integrations', label: 'Integrações externas', price: 700 },
      { key: 'dashboard', label: 'Painel de acompanhamento', price: 600 },
    ],
  },
  outros: {
    key: 'outros',
    label: 'Outros',
    description: 'Projetos personalizados que não se encaixam nas outras categorias.',
    icon: '✨',
    basePrice: 1200,
    features: [
      { key: 'responsive', label: 'Entrega personalizada', price: 0 },
      { key: 'integrations', label: 'Integrações externas', price: 700 },
      { key: 'dashboard', label: 'Painel de acompanhamento', price: 600 },
    ],
  },
};

const URGENCY_LEVELS = {
  normal: { key: 'normal', label: 'Prazo normal', multiplier: 1, days: 30 },
  fast: { key: 'fast', label: 'Prioritário (2 semanas)', multiplier: 1.25, days: 14 },
  urgent: { key: 'urgent', label: 'Urgente (1 semana)', multiplier: 1.6, days: 7 },
};

const COMPLEXITY_LEVELS = {
  simple: { key: 'simple', label: 'Simples (MVP)', multiplier: 0.8 },
  standard: { key: 'standard', label: 'Padrão', multiplier: 1 },
  advanced: { key: 'advanced', label: 'Avançado', multiplier: 1.5 },
};

const PLATFORM_FEE_RATE = 0.1;
const REVISION_COST = 150;

function round2(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function calculateQuote(input = {}) {
  const type = PROJECT_TYPES[input.type];
  if (!type) {
    const err = new Error(`Tipo de projeto inválido: ${input.type}`);
    err.status = 400;
    throw err;
  }

  const urgency = URGENCY_LEVELS[input.urgency] || URGENCY_LEVELS.normal;
  const complexity = COMPLEXITY_LEVELS[input.complexity] || COMPLEXITY_LEVELS.standard;

  const selected = Array.isArray(input.features) ? input.features : [];
  const items = [];

  items.push({ key: 'base', label: `${type.label} - base`, price: type.basePrice });

  for (const featureKey of selected) {
    const feature = type.features.find((f) => f.key === featureKey);
    if (!feature) {
      const err = new Error(`Recurso inválido para ${type.label}: ${featureKey}`);
      err.status = 400;
      throw err;
    }
    if (feature.price > 0) {
      items.push({ key: feature.key, label: feature.label, price: feature.price });
    }
  }

  const featuresTotal = items.reduce((sum, item) => sum + item.price, 0);
  const withComplexity = featuresTotal * complexity.multiplier;
  const subtotal = withComplexity * urgency.multiplier;

  const revisions = Number.isInteger(input.revisions) && input.revisions > 0 ? input.revisions : 0;
  const revisionTotal = revisions * REVISION_COST;
  if (revisionTotal > 0) {
    items.push({ key: 'revisions', label: `${revisions}x rodada extra de revisão`, price: revisionTotal });
  }

  const total = round2(subtotal + revisionTotal);
  const platformFee = round2(total * PLATFORM_FEE_RATE);
  const developerPayout = round2(total - platformFee);

  return {
    type: type.key,
    typeLabel: type.label,
    urgency: urgency.key,
    urgencyLabel: urgency.label,
    complexity: complexity.key,
    complexityLabel: complexity.label,
    items,
    estimatedDays: urgency.days,
    subtotal: round2(subtotal + revisionTotal),
    platformFee,
    developerPayout,
    total,
    currency: 'BRL',
  };
}

function getCatalog() {
  return {
    projectTypes: Object.values(PROJECT_TYPES).map((t) => ({
      key: t.key,
      label: t.label,
      description: t.description,
      icon: t.icon,
      basePrice: t.basePrice,
      features: t.features,
    })),
    urgencies: Object.values(URGENCY_LEVELS),
    complexities: Object.values(COMPLEXITY_LEVELS),
    platformFeeRate: PLATFORM_FEE_RATE,
    revisionCost: REVISION_COST,
  };
}

module.exports = {
  PROJECT_TYPES,
  URGENCY_LEVELS,
  COMPLEXITY_LEVELS,
  PLATFORM_FEE_RATE,
  REVISION_COST,
  calculateQuote,
  getCatalog,
  round2,
};