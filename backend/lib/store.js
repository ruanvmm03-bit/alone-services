/**
 * AMDS - Persistência simples em arquivo JSON.
 * Guarda pedidos (orders), pagamentos e projetos gerados.
 * Não requer banco de dados externo para rodar.
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const ACCOUNTS_FILE = path.join(DATA_DIR, 'accounts.json');

const EMPTY_DB = { orders: [], payments: [], projects: [], users: [] };

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readDb() {
  ensureDir();
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(EMPTY_DB, null, 2));
    return { ...EMPTY_DB };
  }
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(raw || '{}');
    return {
      orders: parsed.orders || [],
      payments: parsed.payments || [],
      projects: parsed.projects || [],
      users: parsed.users || [],
    };
  } catch (err) {
    return { ...EMPTY_DB };
  }
}

function writeDb(db) {
  ensureDir();
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function generateId(prefix) {
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}${random}`;
}

function readAccounts() {
  ensureDir();
  if (!fs.existsSync(ACCOUNTS_FILE)) {
    const legacyAccounts = readDb().users;
    const accounts = { accounts: legacyAccounts };
    fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(accounts, null, 2));
    return accounts;
  }

  try {
    const raw = fs.readFileSync(ACCOUNTS_FILE, 'utf-8');
    const parsed = JSON.parse(raw || '{}');
    const accounts = Array.isArray(parsed.accounts) ? parsed.accounts : [];
    if (!accounts.length) {
      const legacyAccounts = readDb().users;
      if (legacyAccounts.length) {
        const migrated = { accounts: legacyAccounts };
        fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(migrated, null, 2));
        return migrated;
      }
    }
    return { accounts };
  } catch (err) {
    return { accounts: [] };
  }
}

function writeAccounts(database) {
  ensureDir();
  const temporaryFile = `${ACCOUNTS_FILE}.tmp`;
  fs.writeFileSync(temporaryFile, JSON.stringify(database, null, 2));
  fs.renameSync(temporaryFile, ACCOUNTS_FILE);
}

// ----- Orders -----
function listOrders() {
  return readDb().orders;
}

function getOrder(id) {
  return readDb().orders.find((o) => o.id === id) || null;
}

function createOrder(order) {
  const db = readDb();
  const record = {
    id: generateId('ord'),
    createdAt: new Date().toISOString(),
    status: 'pending_payment',
    ...order,
  };
  db.orders.push(record);
  writeDb(db);
  return record;
}

function updateOrder(id, patch) {
  const db = readDb();
  const idx = db.orders.findIndex((o) => o.id === id);
  if (idx === -1) return null;
  db.orders[idx] = { ...db.orders[idx], ...patch, updatedAt: new Date().toISOString() };
  writeDb(db);
  return db.orders[idx];
}

// ----- Payments -----
function createPayment(payment) {
  const db = readDb();
  const record = {
    id: generateId('pay'),
    createdAt: new Date().toISOString(),
    status: 'pending',
    ...payment,
  };
  db.payments.push(record);
  writeDb(db);
  return record;
}

function getPayment(id) {
  return readDb().payments.find((p) => p.id === id) || null;
}

function updatePayment(id, patch) {
  const db = readDb();
  const idx = db.payments.findIndex((p) => p.id === id);
  if (idx === -1) return null;
  db.payments[idx] = { ...db.payments[idx], ...patch, updatedAt: new Date().toISOString() };
  writeDb(db);
  return db.payments[idx];
}

// ----- Projects (gerados pelo agente) -----
function createProject(project) {
  const db = readDb();
  const record = {
    id: generateId('prj'),
    createdAt: new Date().toISOString(),
    ...project,
  };
  db.projects.push(record);
  writeDb(db);
  return record;
}

function getProject(id) {
  return readDb().projects.find((p) => p.id === id || p.projectId === id) || null;
}

function listProjects() {
  return readDb().projects;
}

function updateProject(projectId, patch) {
  const db = readDb();
  const idx = db.projects.findIndex((project) => project.projectId === projectId || project.id === projectId);
  if (idx === -1) return null;
  db.projects[idx] = { ...db.projects[idx], ...patch, updatedAt: new Date().toISOString() };
  writeDb(db);
  return db.projects[idx];
}

// ----- Users (autenticação) -----
function listUsers() {
  return readAccounts().accounts;
}

function getUserById(id) {
  return readAccounts().accounts.find((u) => u.id === id) || null;
}

function getUserByEmail(email) {
  const normalized = String(email || '').trim().toLowerCase();
  return readAccounts().accounts.find((u) => u.email === normalized) || null;
}

function createUser(user) {
  const database = readAccounts();
  const record = {
    id: generateId('usr'),
    createdAt: new Date().toISOString(),
    role: 'customer',
    tokenVersion: 0,
    ...user,
    email: String(user.email).trim().toLowerCase(),
  };
  database.accounts.push(record);
  writeAccounts(database);
  return record;
}

function updateUser(id, patch) {
  const database = readAccounts();
  const idx = database.accounts.findIndex((u) => u.id === id);
  if (idx === -1) return null;
  database.accounts[idx] = { ...database.accounts[idx], ...patch, updatedAt: new Date().toISOString() };
  writeAccounts(database);
  return database.accounts[idx];
}

module.exports = {
  readDb,
  generateId,
  listOrders,
  getOrder,
  createOrder,
  updateOrder,
  createPayment,
  getPayment,
  updatePayment,
  createProject,
  getProject,
  listProjects,
  updateProject,
  listUsers,
  getUserById,
  getUserByEmail,
  createUser,
  updateUser,
};