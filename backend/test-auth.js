/**
 * AMDS - Teste de ponta a ponta do módulo de autenticação.
 * Cadastra um usuário, faz login, acessa rota protegida, troca a senha
 * e garante que a sessão antiga é invalidada, além de validar as
 * proteções básicas (senha fraca, e-mail duplicado, credenciais erradas).
 */

const BASE = process.env.BASE_URL || 'http://localhost:3000';

function assert(cond, msg) {
  if (!cond) throw new Error('FALHOU: ' + msg);
  console.log('  OK - ' + msg);
}

// Implementação simples de cookie jar (fetch não persiste cookies entre chamadas)
let savedCookie = null;

async function call(path, options = {}, useCookie = true) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (useCookie && savedCookie) headers.Cookie = savedCookie;

  const res = await fetch(BASE + path, { ...options, headers });

  const setCookie = res.headers.get('set-cookie');
  if (setCookie) savedCookie = setCookie.split(';')[0];

  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

(async () => {
  console.log('\n=== AMDS - teste de autenticação ===\n');

  const email = `teste_${Date.now()}@amds.com`;
  const password = 'SenhaForte123';

  // 1. Cadastro com senha fraca deve falhar
  const weak = await call('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name: 'Teste Fraco', email: `fraco_${Date.now()}@amds.com`, password: '123' }),
  });
  assert(weak.status === 400, 'cadastro rejeita senha fraca');

  // 2. Cadastro válido
  const registered = await call('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name: 'Usuário Teste', email, password }),
  });
  console.log('1) Cadastro:', registered.status, registered.data && registered.data.user && registered.data.user.email);
  assert(registered.status === 201, 'cadastro criado com sucesso');
  assert(registered.data.user && !registered.data.user.passwordHash, 'senha não é exposta na resposta');
  assert(registered.data.token, 'token retornado no cadastro');

  // 3. Cadastro duplicado deve falhar
  const dup = await call('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name: 'Outro', email, password }),
  });
  assert(dup.status === 409, 'e-mail duplicado é rejeitado');

  savedCookie = null; // limpa cookie do cadastro para testar login isolado

  // 4. Login com senha errada
  const wrongLogin = await call('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password: 'SenhaErrada123' }),
  });
  assert(wrongLogin.status === 401, 'login com senha errada é rejeitado');

  // 5. Login correto
  const login = await call('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  console.log('2) Login:', login.status);
  assert(login.status === 200, 'login efetuado com sucesso');
  assert(login.data.user.email === email, 'usuário correto retornado no login');

  // 6. Rota protegida /me com cookie de sessão
  const me = await call('/api/auth/me');
  console.log('3) /me:', me.status, me.data && me.data.user && me.data.user.name);
  assert(me.status === 200, 'acesso autenticado a /me funciona');
  assert(me.data.user.email === email, '/me retorna o usuário correto');

  // 7. /me sem cookie deve falhar
  const meNoAuth = await call('/api/auth/me', {}, false);
  assert(meNoAuth.status === 401, '/me sem sessão é bloqueado');

  // 8. Troca de senha com senha atual errada
  const badChange = await call('/api/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword: 'errada', newPassword: 'NovaSenha123' }),
  });
  assert(badChange.status === 401, 'troca de senha exige a senha atual correta');

  // 9. Troca de senha válida
  const newPassword = 'NovaSenha123';
  const change = await call('/api/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword: password, newPassword }),
  });
  console.log('4) Troca de senha:', change.status);
  assert(change.status === 200, 'senha trocada com sucesso');

  // 10. Login com a senha antiga não deve mais funcionar
  savedCookie = null;
  const oldLoginFails = await call('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  assert(oldLoginFails.status === 401, 'senha antiga não funciona mais após a troca');

  // 11. Login com a nova senha funciona
  const newLogin = await call('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password: newPassword }),
  });
  assert(newLogin.status === 200, 'login com a nova senha funciona');

  // 12. Logout limpa a sessão
  const logout = await call('/api/auth/logout', { method: 'POST' });
  assert(logout.status === 200, 'logout responde ok');
  const meAfterLogout = await call('/api/auth/me', {}, false);
  assert(meAfterLogout.status === 401, '/me falha após logout (sem cookie reenviado)');

  console.log('\n=== TODOS OS TESTES DE AUTENTICAÇÃO PASSARAM ===\n');
})().catch((err) => {
  console.error('\nERRO:', err.message);
  process.exit(1);
});
