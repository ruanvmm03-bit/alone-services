# AMDS — Sites, Apps e Jogos sob demanda 💜

Plataforma onde **clientes pedem** sites, aplicativos ou jogos e a plataforma
**calcula o preço, recebe o pagamento e gera o projeto** automaticamente.

> ⚠️ **Demonstração:** os pagamentos são **simulados**. Para produção, troque o
> gateway em `backend/lib/payments.js` por Mercado Pago, Stripe, PagSeguro etc.

---

## 🚀 Como rodar

```bash
# 1. Instalar dependências do backend
npm install --prefix backend

# 2. Iniciar o servidor (API + frontend)
node backend/server.js
```

Depois acesse: **http://localhost:3000**

O frontend é servido pelo próprio backend, então não precisa de build.

---

## 🧭 Como funciona o fluxo

```
Cliente monta o pedido  →  POST /api/quote       (orçamento na hora)
        ↓
Cria o pedido           →  POST /api/orders      (status: pending_payment)
        ↓
Gera cobrança           →  POST /api/payments    (PIX / cartão / boleto)
        ↓
Confirma pagamento      →  POST /api/payments/:id/confirm
        ↓
🤖 Agente gera o projeto →  /generated/<projectId>/
```

---

## 💰 Tabela de preços (base)

| Tipo       | Base       | Exemplos de recursos                                                        |
|------------|------------|----------------------------------------------------------------------------|
| 🌐 Site    | R$ 800     | SEO (+300), CMS (+600), Loja (+1200), Blog (+350)                          |
| 📱 App     | R$ 2.500   | Login (+500), Push (+400), Offline (+700), Pagamentos (+900), API (+800)   |
| 🎮 Jogo    | R$ 3.000   | Multiplayer (+2500), Ranking (+600), Fases (+500), Arte (+1200)            |

**Modificadores:**
- **Prazo:** normal (×1), prioritário (×1.25), urgente (×1.6)
- **Complexidade:** simples (×0.8), padrão (×1), avançado (×1.5)
- **Revisão extra:** +R$ 150 cada
- **Taxa da plataforma:** 10% do total (o resto vai para o programador)

---

## 📚 API

| Método | Rota                              | Descrição                              |
|--------|-----------------------------------|----------------------------------------|
| GET    | `/api/health`                     | Health check                           |
| GET    | `/api/catalog`                    | Tipos, recursos, prazos e complexidades|
| POST   | `/api/quote`                      | Calcula orçamento                      |
| POST   | `/api/orders`                     | Cria pedido                            |
| GET    | `/api/orders`                     | Lista pedidos                          |
| GET    | `/api/orders/:id`                 | Detalhe do pedido                      |
| GET    | `/api/payment-methods`            | Métodos de pagamento                   |
| POST   | `/api/payments`                   | Cria cobrança                          |
| POST   | `/api/payments/:id/confirm`       | Confirma pagamento (webhook simulado)  |
| GET    | `/api/payments/:id`               | Detalhe do pagamento                   |
| GET    | `/api/projects`                   | Lista projetos gerados                 |
| GET    | `/api/projects/:id`               | Projeto + arquivos                     |
| POST   | `/api/projects/:orderId/generate` | Regera o projeto                       |

### Exemplo: criar pedido e pagar com PIX

```bash
# 1) Criar pedido
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "type": "site",
    "title": "Site da minha padaria",
    "features": ["seo", "ecommerce"],
    "urgency": "fast",
    "complexity": "standard",
    "customer": { "name": "Maria", "email": "maria@email.com" }
  }'

# 2) Criar cobrança PIX (use o id retornado acima)
curl -X POST http://localhost:3000/api/payments \
  -H "Content-Type: application/json" \
  -d '{ "orderId": "ord_xxxx", "method": "pix" }'

# 3) Confirmar pagamento (simula webhook) -> gera o projeto
curl -X POST http://localhost:3000/api/payments/pay_xxxx/confirm
```

---

## 🗂️ Estrutura do projeto

```
AMDS/
├── backend/
│   ├── server.js              # Servidor Express (API + frontend)
│   ├── .env                   # Configurações (porta, chave PIX)
│   ├── lib/
│   │   ├── catalog.js         # Tipos de projeto + cálculo de preço
│   │   ├── generator.js       # Agente que gera site/app/jogo
│   │   ├── payments.js        # Gateway de pagamentos (simulado)
│   │   └── store.js           # Persistência em JSON (data/db.json)
│   ├── routes/
│   │   ├── catalog.js         # /api/catalog, /api/quote
│   │   ├── orders.js          # /api/orders
│   │   ├── payments.js        # /api/payments
│   │   └── generate.js        # /api/projects
│   └── test-flow.js           # Teste end-to-end
├── frontend/
│   ├── index.html             # Página única
│   ├── style.css              # Estilos
│   └── script.js              # Catálogo, orçamento, checkout, pedidos
└── generated/                 # Projetos gerados pelo agente
    └── <projectId>/
        ├── index.html
        ├── style.css
        └── script.js
```

---

## 🧪 Testar

Com o servidor rodando:

```bash
node backend/test-flow.js
```

Saída esperada: **TODOS OS TESTES PASSARAM**.

---

## ⚙️ Configuração (`.env`)

| Variável                   | Descrição                                     |
|----------------------------|-----------------------------------------------|
| `PORT`                     | Porta do servidor (padrão `3000`)             |
| `PIX_KEY`                  | Chave PIX exibida no checkout                 |
| `MERCADOPAGO_ACCESS_TOKEN` | Token real (opcional — modo simulado por padrão) |
| `STRIPE_SECRET_KEY`        | Chave do Stripe (opcional)                    |

---

## 🔌 Integrando pagamento real

Em `backend/lib/payments.js`, substitua `createCharge` e `confirmPayment` por
chamadas reais ao gateway. O `confirmPayment` deve ser exposto como **webhook**
para que o projeto seja gerado quando o banco confirmar o pagamento.

---

## 🛡️ Próximos passos sugeridos

- Banco de dados real (PostgreSQL / MongoDB) em vez do `db.json`
- Autenticação de clientes e painel de administração
- Webhook real de pagamento (Mercado Pago / Stripe)
- Painel do programador para assumir pedidos e enviar entregas
- Upload de arquivos e conversas cliente/programador