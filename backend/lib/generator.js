/**
 * AMDS - Agente gerador de projetos.
 * A partir de um pedido pago, gera automaticamente um scaffold real
 * (HTML/CSS/JS) do projeto pedido: site, app ou jogo.
 * Os arquivos são salvos em /generated/<projectId>/.
 */

const fs = require('fs');
const path = require('path');

const GENERATED_DIR = path.join(__dirname, '..', '..', 'generated');

function ensureProjectDir(projectId) {
  const dir = path.join(GENERATED_DIR, projectId);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function escapeHtml(text = '') {
  const amp = String.fromCharCode(38);
  return String(text)
    .replace(/&/g, amp + 'amp;')
    .replace(/</g, amp + 'lt;')
    .replace(/>/g, amp + 'gt;')
    .replace(/"/g, amp + 'quot;');
}

function detectSitePlan(order, features) {
  const brief = `${order.title || ''} ${order.description || ''}`.toLowerCase();
  const matches = (words) => words.some((word) => brief.includes(word));
  const ecommerce = features.includes('ecommerce') || matches(['loja', 'venda', 'produto', 'comércio']);
  const blog = features.includes('blog') || matches(['blog', 'notícia', 'conteúdo']);

  if (matches(['restaurante', 'lanchonete', 'pizzaria', 'comida', 'café'])) {
    return {
      kind: 'food',
      eyebrow: 'Sabor que fica na memória',
      aboutTitle: 'Feito para dar água na boca',
      aboutText: 'Ingredientes selecionados, preparo cuidadoso e uma experiência pensada para você voltar.',
      servicesTitle: 'Nosso cardápio',
      cards: ['Pratos da casa', 'Opções para compartilhar', 'Entrega rápida'],
      primary: '#c2410c',
      secondary: '#fff7ed',
      ecommerce,
      blog,
    };
  }

  if (matches(['portfólio', 'portfolio', 'designer', 'fotógrafo', 'fotografo', 'freelancer'])) {
    return {
      kind: 'portfolio',
      eyebrow: 'Ideias transformadas em trabalho',
      aboutTitle: 'Um pouco do meu trabalho',
      aboutText: 'Projetos feitos com intenção, cuidado e atenção aos detalhes que fazem diferença.',
      servicesTitle: 'O que eu faço',
      cards: ['Identidade visual', 'Projetos sob medida', 'Acompanhamento próximo'],
      primary: '#0f766e',
      secondary: '#f0fdfa',
      ecommerce,
      blog,
    };
  }

  if (matches(['agência', 'agencia', 'consultoria', 'serviço', 'servico', 'empresa'])) {
    return {
      kind: 'business',
      eyebrow: 'Soluções para o próximo passo',
      aboutTitle: 'Experiência que gera resultado',
      aboutText: 'Entendemos o desafio, organizamos o caminho e entregamos uma solução clara para o seu negócio.',
      servicesTitle: 'Como podemos ajudar',
      cards: ['Estratégia', 'Execução', 'Suporte contínuo'],
      primary: '#1d4ed8',
      secondary: '#eff6ff',
      ecommerce,
      blog,
    };
  }

  return {
    kind: 'general',
    eyebrow: 'Uma presença digital do seu jeito',
    aboutTitle: 'Pensado para você',
    aboutText: order.description || 'Uma experiência digital clara, bonita e pronta para apresentar sua ideia ao mundo.',
    servicesTitle: 'O que você encontra aqui',
    cards: ['Qualidade', 'Praticidade', 'Atendimento próximo'],
    primary: '#6d28d9',
    secondary: '#f5f3ff',
    ecommerce,
    blog,
  };
}

function planSite(order, features) {
  const briefing = order.briefing || {};
  const plan = detectSitePlan(order, features);
  const colors = {
    orange: ['#c2410c', '#fff7ed'], red: ['#b91c1c', '#fef2f2'], yellow: ['#a16207', '#fefce8'],
    green: ['#15803d', '#f0fdf4'], blue: ['#1d4ed8', '#eff6ff'], pink: ['#be185d', '#fdf2f8'],
    purple: ['#6d28d9', '#f5f3ff'], black: ['#171717', '#f5f5f5'],
  };
  const objectiveCards = {
    sales: ['Produtos em destaque', 'Compra simples', 'Ofertas da semana'],
    leads: ['Atendimento rápido', 'Orçamento sob medida', 'Fale com a equipe'],
    booking: ['Serviços disponíveis', 'Horários flexíveis', 'Agende online'],
    content: ['Conteúdos recentes', 'Dicas e novidades', 'Conteúdo para você'],
  };
  const ctaLabels = { contact: 'Fale conosco', buy: 'Comprar agora', quote: 'Pedir orçamento', book: 'Agendar agora', learn: 'Conhecer o trabalho' };
  const styleEyebrows = { bold: 'Uma experiência que chama atenção', warm: 'Feito com cuidado para você', elegant: 'Clareza, presença e intenção', playful: 'Uma ideia com personalidade' };
  const selectedColors = colors[briefing.primaryColor];
  return {
    ...plan,
    primary: selectedColors ? selectedColors[0] : plan.primary,
    secondary: selectedColors ? selectedColors[1] : plan.secondary,
    ecommerce: plan.ecommerce || briefing.objective === 'sales',
    cards: objectiveCards[briefing.objective] || plan.cards,
    eyebrow: styleEyebrows[briefing.style] || plan.eyebrow,
    callToAction: ctaLabels[briefing.callToAction] || 'Fale conosco',
    audience: briefing.audience || 'pessoas que se identificam com esta ideia',
    needsAds: briefing.needsAds === true,
    needsSocial: briefing.needsSocial === true,
  };
}

// ---------------- SITE ----------------
function buildSite(order, meta) {
  const title = order.title || 'Meu Site';
  const description = order.description || 'Site criado pela plataforma AMDS.';
  const plan = planSite(order, meta.features);
  const hasEcommerce = plan.ecommerce;
  const hasBlog = plan.blog;

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="description" content="${escapeHtml(description)}" />
  <title>${escapeHtml(title)}</title>
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <header class="site-header">
    <div class="container">
      <a class="logo" href="#">${escapeHtml(title)}</a>
      <nav>
        <a href="#sobre">Sobre</a>
        <a href="#servicos">Serviços</a>
        ${hasBlog ? '<a href="#blog">Blog</a>' : ''}
        ${hasEcommerce ? '<a href="#loja">Loja</a>' : ''}
        <a href="#contato">Contato</a>
      </nav>
    </div>
  </header>

  <section class="hero">
    <div class="container">
      <h1>${escapeHtml(title)}</h1>
      <span class="eyebrow">${escapeHtml(plan.eyebrow)}</span>
      <p>${escapeHtml(description)}</p>
      <a class="btn" href="#contato">${escapeHtml(plan.callToAction)}</a>
    </div>
  </section>

  <section id="sobre" class="section">
    <div class="container">
      <h2>${escapeHtml(plan.aboutTitle)}</h2>
      <p>${escapeHtml(plan.aboutText)} Este projeto foi pensado para ${escapeHtml(plan.audience)}.</p>
    </div>
  </section>

  <section id="servicos" class="section alt">
    <div class="container">
      <h2>${escapeHtml(plan.servicesTitle)}</h2>
      <div class="cards">
        ${plan.cards.map((card) => `<div class="card"><h3>${escapeHtml(card)}</h3><p>Uma experiência criada especialmente para este projeto.</p></div>`).join('')}
      </div>
    </div>
  </section>

  ${hasBlog ? `<section id="blog" class="section">
    <div class="container">
      <h2>Blog</h2>
      <article class="post"><h3>Primeiro post</h3><p>Conteúdo do post.</p></article>
    </div>
  </section>` : ''}

  ${hasEcommerce ? `<section id="loja" class="section alt">
    <div class="container">
      <h2>Loja</h2>
      <div class="cards" id="produtos"></div>
    </div>
  </section>` : ''}

  ${plan.needsAds ? `<section class="promo-band"><div class="container"><span class="eyebrow">Oferta em destaque</span><h2>Uma condição especial para quem chegar agora</h2><p>Use este espaço para divulgar campanhas, lançamentos e promoções.</p><a class="btn" href="#contato">${escapeHtml(plan.callToAction)}</a></div></section>` : ''}

  ${plan.needsSocial ? `<section class="section social-section"><div class="container"><h2>Continue acompanhando</h2><p>Encontre novidades, bastidores e novidades nas nossas redes.</p><div class="social-links"><a href="#">Instagram</a><a href="#">Facebook</a><a href="#">WhatsApp</a></div></div></section>` : ''}

  <section id="contato" class="section">
    <div class="container">
      <h2>Contato</h2>
      <form id="form-contato">
        <input type="text" name="nome" placeholder="Seu nome" required />
        <input type="email" name="email" placeholder="Seu e-mail" required />
        <textarea name="mensagem" placeholder="Sua mensagem" required></textarea>
        <button class="btn" type="submit">Enviar</button>
      </form>
    </div>
  </section>

  <footer class="site-footer">
    <div class="container">
      <p>&copy; ${new Date().getFullYear()} ${escapeHtml(title)} — feito com AMDS</p>
    </div>
  </footer>

  <script src="script.js"></script>
</body>
</html>`;

  const css = `:root {
  --primary: ${plan.primary};
  --secondary: ${plan.secondary};
  --dark: #111827;
  --light: #f9fafb;
}
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; color: var(--dark); line-height: 1.6; }
.container { width: min(1100px, 92%); margin: 0 auto; }
.site-header { position: sticky; top: 0; background: #fff; border-bottom: 1px solid #eee; z-index: 10; }
.site-header .container { display: flex; justify-content: space-between; align-items: center; padding: 1rem 0; }
.logo { font-weight: 800; color: var(--primary); text-decoration: none; font-size: 1.25rem; }
nav a { margin-left: 1rem; color: var(--dark); text-decoration: none; }
nav a:hover { color: var(--primary); }
.hero { background: linear-gradient(135deg, var(--primary), color-mix(in srgb, var(--primary), #111 25%)); color: #fff; padding: 5rem 0; text-align: center; }
.eyebrow { display: block; margin-bottom: .75rem; font-size: .8rem; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; opacity: .82; }
.hero h1 { font-size: clamp(2rem, 5vw, 3.5rem); margin-bottom: 1rem; }
.hero p { max-width: 640px; margin: 0 auto 2rem; }
.btn { display: inline-block; background: #fff; color: var(--primary); padding: 0.85rem 1.75rem; border-radius: 999px; text-decoration: none; font-weight: 700; border: none; cursor: pointer; }
.section { padding: 4rem 0; }
.section.alt { background: var(--secondary); }
.promo-band { background: var(--primary); color: #fff; padding: 3.5rem 0; text-align: center; }
.promo-band h2 { margin: .4rem auto .75rem; max-width: 680px; }
.promo-band p { margin: 0 auto 1.25rem; max-width: 620px; }
.social-section { text-align: center; }
.social-links { display: flex; justify-content: center; gap: 1rem; flex-wrap: wrap; margin-top: 1rem; }
.social-links a { color: var(--primary); font-weight: 700; }
.section h2 { margin-bottom: 1rem; color: var(--primary); }
.cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1.5rem; margin-top: 1.5rem; }
.card { background: #fff; border: 1px solid #eee; border-radius: 12px; padding: 1.5rem; box-shadow: 0 2px 8px rgba(0,0,0,0.04); }
form { display: grid; gap: 1rem; max-width: 520px; }
form input, form textarea { padding: 0.85rem; border: 1px solid #ddd; border-radius: 8px; font: inherit; }
.site-footer { background: var(--dark); color: #9ca3af; padding: 2rem 0; text-align: center; }`;

  const js = `// Script do site gerado pela AMDS
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('form-contato');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      alert('Mensagem enviada! (integre com seu backend/e-mail para receber de verdade)');
      form.reset();
    });
  }
${hasEcommerce ? `  const produtos = [
    { nome: 'Produto 1', preco: 49.9 },
    { nome: 'Produto 2', preco: 89.9 },
    { nome: 'Produto 3', preco: 129.9 },
  ];
  const loja = document.getElementById('produtos');
  if (loja) {
    loja.innerHTML = produtos.map((p) =>
      '<div class="card"><h3>' + p.nome + '</h3><p>R$ ' + p.preco.toFixed(2) + '</p><button class="btn btn-buy" style="margin-top:.75rem;background:#6d28d9;color:#fff">Comprar</button></div>'
    ).join('');
  }` : ''}
});`;

  return { 'index.html': html, 'style.css': css, 'script.js': js };
}

// ---------------- APP ----------------
function buildApp(order, meta) {
  const title = order.title || 'Meu App';
  const description = order.description || 'Aplicativo criado pela plataforma AMDS.';
  const details = order.briefing?.typeDetails || {};
  const hasAuth = meta.features.includes('auth');
  const hasPayments = meta.features.includes('payments');

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <div class="app">
    <header class="app-bar">
      <span class="brand">${escapeHtml(title)}</span>
      ${hasAuth ? '<button id="btn-login" class="ghost">Entrar</button>' : ''}
    </header>

    <main class="app-main">
      <p class="lead">${escapeHtml(description)}</p>
      <p class="context">Fluxo principal: ${escapeHtml(details.mainFlow || 'organizar a experiência principal')} · Plataforma: ${escapeHtml(details.platform || 'web e mobile')}</p>

      <form id="task-form" class="row">
        <input id="task-input" type="text" placeholder="Nova tarefa..." autocomplete="off" required />
        <button type="submit">Adicionar</button>
      </form>

      <ul id="task-list" class="task-list"></ul>
      <p id="empty" class="empty">Nenhuma tarefa ainda.</p>

      ${hasPayments ? '<button class="pay">Assinar PRO</button>' : ''}
    </main>

    <nav class="tabbar">
      <span class="active">Início</span>
      <span>Perfil</span>
      <span>Config</span>
    </nav>
  </div>
  <script src="script.js"></script>
</body>
</html>`;

  const css = `:root { --primary:#2563eb; --bg:#f1f5f9; --dark:#0f172a; }
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; background: var(--bg); color: var(--dark); }
.app { max-width: 480px; margin: 0 auto; min-height: 100vh; background:#fff; display:flex; flex-direction:column; box-shadow:0 0 40px rgba(0,0,0,.08); }
.app-bar { display:flex; justify-content:space-between; align-items:center; padding:1rem 1.25rem; background:var(--primary); color:#fff; }
.brand { font-weight:800; }
.ghost { background:transparent; border:1px solid #fff; color:#fff; padding:.35rem .8rem; border-radius:999px; cursor:pointer; }
.app-main { flex:1; padding:1.25rem; }
.lead { color:#475569; margin-bottom:1rem; }
.row { display:flex; gap:.5rem; margin-bottom:1rem; }
.row input { flex:1; padding:.75rem; border:1px solid #cbd5e1; border-radius:10px; font:inherit; }
.row button { padding:.75rem 1rem; border:none; background:var(--primary); color:#fff; border-radius:10px; cursor:pointer; font-weight:600; }
.task-list { list-style:none; display:grid; gap:.5rem; }
.task-list li { display:flex; justify-content:space-between; align-items:center; padding:.75rem 1rem; background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; }
.task-list li.done span { text-decoration: line-through; color:#94a3b8; }
.task-list button { border:none; background:transparent; cursor:pointer; font-size:1rem; }
.empty { color:#94a3b8; text-align:center; margin-top:2rem; }
.pay { position:fixed; bottom:5rem; right:50%; transform:translateX(50%); background:#16a34a; color:#fff; border:none; padding:.85rem 1.5rem; border-radius:999px; font-weight:700; cursor:pointer; }
.tabbar { display:flex; justify-content:space-around; padding:.85rem; border-top:1px solid #e2e8f0; color:#94a3b8; }
.tabbar .active { color:var(--primary); font-weight:700; }`;

  const js = `// Lógica do app gerado pela AMDS
const STORAGE_KEY = 'amds_tasks_${order.id || 'app'}';
let tasks = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');

const list = document.getElementById('task-list');
const empty = document.getElementById('empty');
const form = document.getElementById('task-form');
const input = document.getElementById('task-input');

function render() {
  if (!list) return;
  list.innerHTML = tasks.map((t, i) =>
    '<li class="' + (t.done ? 'done' : '') + '"><span>' + t.text + '</span>' +
    '<span><button data-toggle="' + i + '">' + (t.done ? 'OK' : 'o') + '</button>' +
    '<button data-del="' + i + '">x</button></span></li>'
  ).join('');
  if (empty) empty.style.display = tasks.length ? 'none' : 'block';
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

if (form) {
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    tasks.push({ text, done: false });
    input.value = '';
    render();
  });
}

if (list) {
  list.addEventListener('click', (e) => {
    const toggle = e.target.getAttribute('data-toggle');
    const del = e.target.getAttribute('data-del');
    if (toggle !== null) { tasks[toggle].done = !tasks[toggle].done; render(); }
    if (del !== null) { tasks.splice(del, 1); render(); }
  });
}

${hasAuth ? `document.getElementById('btn-login')?.addEventListener('click', () => {
  alert('Tela de login — integre com um provedor de autenticação.');
});` : ''}

${hasPayments ? `document.querySelector('.pay')?.addEventListener('click', () => {
  alert('Checkout do app — integre com Google Play / App Store ou Stripe.');
});` : ''}

render();`;

  return { 'index.html': html, 'style.css': css, 'script.js': js };
}

// ---------------- GAME ----------------
function buildGame(order, meta) {
  const title = order.title || 'Meu Jogo';
  const description = order.description || 'Jogo criado pela plataforma AMDS.';
  const details = order.briefing?.typeDetails || {};
  const hasRanking = meta.features.includes('ranking');

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <div class="game-wrap">
    <h1>${escapeHtml(title)}</h1>
    <p class="sub">${escapeHtml(description)} · ${escapeHtml(details.genre || 'experiência interativa')} para ${escapeHtml(details.platform || 'navegador')}</p>
    <div class="hud">
      <span>Pontos: <strong id="score">0</strong></span>
      <span>Tempo: <strong id="time">30</strong>s</span>
      <button id="start">Jogar</button>
    </div>
    <canvas id="canvas" width="640" height="420"></canvas>
    ${hasRanking ? '<div class="ranking"><h2>Ranking</h2><ol id="ranking-list"></ol></div>' : ''}
  </div>
  <script src="script.js"></script>
</body>
</html>`;

  const css = `:root { --bg:#0b1020; --accent:#22d3ee; }
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; background: radial-gradient(circle at 50% 0%, #1e293b, var(--bg)); color:#e2e8f0; min-height:100vh; display:flex; justify-content:center; align-items:center; padding:1rem; }
.game-wrap { text-align:center; width:100%; max-width:680px; }
h1 { color:var(--accent); margin-bottom:.25rem; }
.sub { color:#94a3b8; margin-bottom:1rem; }
.hud { display:flex; justify-content:center; gap:1.5rem; align-items:center; margin-bottom:1rem; flex-wrap:wrap; }
.hud button { padding:.6rem 1.4rem; border:none; border-radius:10px; background:var(--accent); color:#04212b; font-weight:800; cursor:pointer; }
canvas { background:#050814; border:2px solid #1e293b; border-radius:12px; width:100%; height:auto; display:block; touch-action:none; }
.ranking { margin-top:1.5rem; text-align:left; }
.ranking h2 { color:var(--accent); font-size:1.1rem; margin-bottom:.5rem; }
.ranking ol { padding-left:1.25rem; color:#cbd5e1; }`;

  const js = `// Jogo gerado pela AMDS - colete os pontos fugindo dos blocos vermelhos
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const timeEl = document.getElementById('time');
const startBtn = document.getElementById('start');

let player, items, hazards, score, timeLeft, running, timer, raf;
const W = canvas.width, H = canvas.height;

function reset() {
  player = { x: W / 2, y: H - 40, r: 14, speed: 6 };
  items = [];
  hazards = [];
  score = 0; timeLeft = 30; running = true;
  scoreEl.textContent = '0'; timeEl.textContent = '30';
  for (let i = 0; i < 6; i++) spawnItem();
  for (let i = 0; i < 4; i++) spawnHazard();
  clearInterval(timer);
  timer = setInterval(() => {
    timeLeft--; timeEl.textContent = timeLeft;
    if (timeLeft <= 0) endGame();
  }, 1000);
  loop();
}

function spawnItem() {
  items.push({ x: rand(20, W - 20), y: rand(20, H - 60), r: 9 });
}
function spawnHazard() {
  hazards.push({ x: rand(20, W - 20), y: rand(20, H - 60), r: 14, vx: rand(-3, 3), vy: rand(-3, 3) });
}
function rand(min, max) { return Math.random() * (max - min) + min; }

function loop() {
  if (!running) return;
  ctx.clearRect(0, 0, W, H);
  update(); draw();
  raf = requestAnimationFrame(loop);
}

function update() {
  hazards.forEach((h) => {
    h.x += h.vx; h.y += h.vy;
    if (h.x < h.r || h.x > W - h.r) h.vx *= -1;
    if (h.y < h.r || h.y > H - h.r) h.vy *= -1;
    if (dist(h, player) < h.r + player.r) return endGame();
  });
  items = items.filter((it) => {
    if (dist(it, player) < it.r + player.r) {
      score += 10; scoreEl.textContent = score;
      spawnItem();
      return false;
    }
    return true;
  });
}

function draw() {
  ctx.fillStyle = '#22d3ee';
  ctx.beginPath(); ctx.arc(player.x, player.y, player.r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#facc15';
  items.forEach((it) => { ctx.beginPath(); ctx.arc(it.x, it.y, it.r, 0, Math.PI * 2); ctx.fill(); });
  ctx.fillStyle = '#ef4444';
  hazards.forEach((h) => { ctx.beginPath(); ctx.arc(h.x, h.y, h.r, 0, Math.PI * 2); ctx.fill(); });
}

function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

function endGame() {
  running = false;
  clearInterval(timer);
  cancelAnimationFrame(raf);
  alert('Fim de jogo! Pontos: ' + score);
${hasRanking ? `  saveRanking(score);` : ''}
}

${hasRanking ? `function saveRanking(value) {
  const list = document.getElementById('ranking-list');
  if (!list) return;
  const scores = JSON.parse(localStorage.getItem('amds_ranking_${order.id || 'game'}') || '[]');
  scores.push(value);
  scores.sort((a, b) => b - a);
  localStorage.setItem('amds_ranking_${order.id || 'game'}', JSON.stringify(scores.slice(0, 5)));
  list.innerHTML = scores.slice(0, 5).map((s) => '<li>' + s + ' pontos</li>').join('');
}

(function loadRanking() {
  const list = document.getElementById('ranking-list');
  if (!list) return;
  const scores = JSON.parse(localStorage.getItem('amds_ranking_${order.id || 'game'}') || '[]');
  list.innerHTML = scores.map((s) => '<li>' + s + ' pontos</li>').join('');
})();` : ''}

const keys = {};
document.addEventListener('keydown', (e) => { keys[e.key] = true; });
document.addEventListener('keyup', (e) => { keys[e.key] = false; });
function move() {
  if (!running || !player) return;
  if ((keys.ArrowLeft || keys.a) && player.x > player.r) player.x -= player.speed;
  if ((keys.ArrowRight || keys.d) && player.x < W - player.r) player.x += player.speed;
  if ((keys.ArrowUp || keys.w) && player.y > player.r) player.y -= player.speed;
  if ((keys.ArrowDown || keys.s) && player.y < H - player.r) player.y += player.speed;
}
setInterval(move, 16);

canvas.addEventListener('touchmove', (e) => {
  if (!running || !player) return;
  const rect = canvas.getBoundingClientRect();
  const t = e.touches[0];
  player.x = ((t.clientX - rect.left) / rect.width) * W;
  player.y = ((t.clientY - rect.top) / rect.height) * H;
}, { passive: true });

startBtn.addEventListener('click', reset);
reset();`;

  return { 'index.html': html, 'style.css': css, 'script.js': js };
}

// ---------------- BOT ----------------
function buildBot(order) {
  const title = order.title || 'Meu Bot';
  const description = order.description || 'Bot criado pela plataforma AMDS.';
  const details = order.briefing?.typeDetails || {};
  const channel = details.channel || 'seu canal de atendimento';
  const tasks = details.tasks || 'tirar dúvidas e encaminhar solicitações';
  const html = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>${escapeHtml(title)}</title><link rel="stylesheet" href="style.css" /></head>
<body><main class="bot-shell"><header><span class="status"></span><div><h1>${escapeHtml(title)}</h1><p>Bot para ${escapeHtml(channel)}</p></div></header><section class="bot-info"><strong>O que eu resolvo</strong><p>${escapeHtml(tasks)}</p></section><div id="messages" class="messages"><div class="message bot">Olá! Sou o assistente de ${escapeHtml(title)}. Como posso ajudar?</div></div><form id="chat-form"><input id="chat-input" placeholder="Digite sua mensagem..." required /><button>Enviar</button></form></main><script src="script.js"></script></body></html>`;
  const css = `:root{--primary:#0f766e;--bg:#f0fdfa;--dark:#14322e}*{box-sizing:border-box}body{margin:0;font-family:system-ui,sans-serif;background:var(--bg);color:var(--dark);min-height:100vh;display:grid;place-items:center;padding:1rem}.bot-shell{width:min(100%,520px);min-height:620px;background:#fff;border:1px solid #cce7e1;border-radius:18px;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 50px #0f766e1c}.bot-shell header{display:flex;gap:.8rem;align-items:center;padding:1.2rem;background:var(--primary);color:#fff}.bot-shell h1{font-size:1.15rem;margin:0}.bot-shell header p{margin:.15rem 0 0;color:#c9fff4;font-size:.8rem}.status{width:.7rem;height:.7rem;border-radius:50%;background:#86efac}.bot-info{padding:1rem;border-bottom:1px solid #e2f2ef}.bot-info p{margin:.25rem 0 0;color:#55716b;font-size:.9rem}.messages{flex:1;padding:1rem;display:grid;align-content:start;gap:.6rem}.message{max-width:85%;padding:.7rem .85rem;border-radius:12px;line-height:1.45;font-size:.9rem}.message.bot{background:#e8f7f4}.message.user{justify-self:end;background:var(--primary);color:#fff}#chat-form{display:flex;gap:.5rem;padding:1rem;border-top:1px solid #e2f2ef}#chat-input{flex:1;min-width:0;padding:.75rem;border:1px solid #b8dcd5;border-radius:10px;font:inherit}#chat-form button{border:0;border-radius:10px;background:var(--primary);color:#fff;padding:.75rem 1rem;font-weight:700}`;
  const js = `const form=document.getElementById('chat-form');const input=document.getElementById('chat-input');const messages=document.getElementById('messages');form.addEventListener('submit',(event)=>{event.preventDefault();const text=input.value.trim();if(!text)return;messages.insertAdjacentHTML('beforeend','<div class="message user">'+text.replace(/[&<>]/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))+'</div><div class="message bot">Recebi sua mensagem. Este protótipo já está conectado ao fluxo de ${escapeHtml(tasks)}.</div>');input.value='';messages.scrollTop=messages.scrollHeight;});`;
  return { 'index.html': html, 'style.css': css, 'script.js': js };
}

/**
 * Gera os arquivos do projeto e salva em disco.
 * @param {object} order pedido pago
 * @param {object} meta metadados (features)
 * @returns {object} info do projeto gerado
 */
function generateProject(order, meta = {}) {
  const type = order.type;
  const projectId = order.projectId || order.id;
  const dir = ensureProjectDir(projectId);
  const features = Array.isArray(meta.features) ? meta.features : [];

  let files;
  if (type === 'site') files = buildSite(order, { features });
  else if (type === 'app') files = buildApp(order, { features });
  else if (type === 'game') files = buildGame(order, { features });
  else if (type === 'bots') files = buildBot(order, { features });
  else if (type === 'outros') files = buildSite(order, { features });
  else {
    const err = new Error(`Não é possível gerar projeto do tipo: ${type}`);
    err.status = 400;
    throw err;
  }

  const written = [];
  for (const [name, content] of Object.entries(files)) {
    const filePath = path.join(dir, name);
    fs.writeFileSync(filePath, content);
    written.push(name);
  }

  return {
    projectId,
    type,
    directory: dir,
    files: written,
    previewUrl: `/generated/${projectId}/index.html`,
  };
}

function getProjectSize(projectId) {
  const dir = path.join(GENERATED_DIR, projectId);
  if (!fs.existsSync(dir)) return 0;
  return fs.readdirSync(dir).reduce((total, name) => {
    const filePath = path.join(dir, name);
    return total + (fs.statSync(filePath).isFile() ? fs.statSync(filePath).size : 0);
  }, 0);
}

module.exports = { generateProject, getProjectSize, GENERATED_DIR };