/**
 * AMDS - Rota de projetos gerados pelo agente.
 * GET /api/projects            -> lista projetos gerados
 * GET /api/projects/:id        -> detalhe + arquivos de um projeto
 * POST /api/projects/:orderId/generate -> (re)gera um projeto manualmente
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const store = require('../lib/store');
const { generateProject, GENERATED_DIR } = require('../lib/generator');

const router = express.Router();

router.get('/projects', (req, res) => {
  const orders = store.listOrders();
  const projects = store.listProjects().map((project) => {
    const order = orders.find((item) => item.id === project.orderId);
    return {
      ...project,
      title: project.title || order?.title || 'Projeto sem nome',
      description: project.description || order?.description || 'Projeto criado a partir de uma ideia.',
      typeLabel: project.typeLabel || order?.typeLabel || project.type,
      previewUrl: project.previewUrl || order?.previewUrl,
    };
  });
  res.json(projects);
});

router.get('/projects/:id', (req, res) => {
  const project = store.getProject(req.params.id);
  if (!project) {
    const orders = store.listOrders().filter((o) => o.projectId === req.params.id);
    if (orders.length) {
      return res.json({
        projectId: orders[0].projectId,
        previewUrl: orders[0].previewUrl,
        orderId: orders[0].id,
      });
    }
    return res.status(404).json({ error: 'Projeto não encontrado.' });
  }

  const dir = path.join(GENERATED_DIR, project.projectId);
  const files = [];
  if (fs.existsSync(dir)) {
    for (const name of fs.readdirSync(dir)) {
      files.push({ name, url: `/generated/${project.projectId}/${name}` });
    }
  }

  res.json({ ...project, files });
});

router.post('/projects/:orderId/generate', (req, res) => {
  try {
    const order = store.getOrder(req.params.orderId);
    if (!order) return res.status(404).json({ error: 'Pedido não encontrado.' });
    if (order.status !== 'paid') {
      return res.status(402).json({ error: 'O pedido precisa estar pago para gerar o projeto.' });
    }

    const generated = generateProject(order, { features: order.features });
    store.updateOrder(order.id, {
      projectId: generated.projectId,
      previewUrl: generated.previewUrl,
    });

    res.json(generated);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

module.exports = router;