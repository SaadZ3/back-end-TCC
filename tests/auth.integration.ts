import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const database = process.env.TEST_DATABASE_URL;
if (!database) throw new Error('Defina TEST_DATABASE_URL para um banco local terminado em _test.');
const target = new URL(database);
if (!['127.0.0.1', 'localhost'].includes(target.hostname) || !target.pathname.endsWith('_test'))
  throw new Error('Os testes só escrevem em banco local com nome terminado em _test.');
const secret = randomBytes(32).toString('hex');
Object.assign(process.env, {
  DATABASE_URL: database, NODE_ENV: 'test', TOKEN_SECRET: secret,
  TOKEN_EXPIRATION: '1m', APP_ORIGINS: 'http://127.0.0.1:5173',
});

let prisma: typeof import('../src/lib/prisma.js').prisma;
let provisionUser: typeof import('../src/modules/auth/provision-user.js').provisionUser;
let updateUserSchema: typeof import('../src/modules/user/user.schema.js').updateUserSchema;

const origin = 'http://127.0.0.1:5173';
const password = randomBytes(18).toString('hex');
const email = 'p2-' + randomUUID() + '@example.test';
let userId: string;
let secondId: string;
let server: Server;
let base: string;
let cookie: string;
const registeredIds: string[] = [];

async function request(path: string, options: RequestInit = {}) {
  return fetch(base + path, { ...options, headers: {
    Origin: origin, ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers,
  } });
}
async function login() {
  return request('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
}
function tokenHeader(token: string) { return 'tcc_session=' + token; }

before(async () => {
  const { default: app } = await import('../src/app.js');
  ({ prisma } = await import('../src/lib/prisma.js'));
  ({ provisionUser } = await import('../src/modules/auth/provision-user.js'));
  ({ updateUserSchema } = await import('../src/modules/user/user.schema.js'));
  const first = await provisionUser({ name: 'Pessoa de Teste', email, password });
  userId = first.id;
  secondId = (await provisionUser({ name: 'Outra Pessoa', email: 'other-' + email, password })).id;
  server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  base = 'http://127.0.0.1:' + address.port;
});
after(async () => {
  if (server) await new Promise<void>(resolve => server.close(() => resolve()));
  if (userId || secondId) await prisma.user.deleteMany({ where: { id: { in: [userId, secondId, ...registeredIds].filter(Boolean) } } });
  if (prisma) await prisma.$disconnect();
});

test('cria conta normal com hash e não sobrescreve conta existente', async () => {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  assert.equal(user.role, 'EVALUATOR');
  assert.notEqual(user.password_hash, password);
  assert.equal(await bcrypt.compare(password, user.password_hash), true);
  await assert.rejects(provisionUser({ name: 'Outro nome', email, password: 'outro-segredo' }));
  await assert.rejects(provisionUser({ name: 'Administrador', email: 'admin-' + email, password, role: 'ADMIN' }));
});

test('não expõe rotas sem prefixo nem módulos legados', async () => {
  for (const path of ['/auth/register']) {
    assert.equal((await request(path, { method: 'POST', body: JSON.stringify({ email, password, role: 'ADMIN' }) })).status, 404);
  }
  for (const path of ['/users', '/companies', '/questionnaires', '/assessments', '/reports'])
    assert.equal((await request(path)).status, 404);
});

test('cadastro público normaliza dados, cria hash e inicia sessão privada', async () => {
  const address = 'register-' + email;
  const response = await request('/api/auth/register', { method: 'POST', body: JSON.stringify({
    name: '  Nova Pessoa  ', email: '  ' + address.toUpperCase() + '  ', password,
  }) });
  assert.equal(response.status, 201);
  const data = await response.json(); registeredIds.push(data.user.id);
  assert.equal(data.user.name, 'Nova Pessoa'); assert.equal(data.user.email, address);
  assert.equal(data.user.role, 'EVALUATOR');
  assert.deepEqual(Object.keys(data.user).sort(), ['email', 'id', 'name', 'role']);
  assert.ok(Date.parse(data.expires_at) > Date.now());
  const header = response.headers.get('set-cookie')!;
  assert.match(header, /HttpOnly/); assert.match(header, /SameSite=Lax/);
  assert.equal((await request('/api/users/me', { headers: { Cookie: header.split(';')[0] } })).status, 200);
  const stored = await prisma.user.findUniqueOrThrow({ where: { id: data.user.id } });
  assert.ok(await bcrypt.compare(password, stored.password_hash));
  const duplicate = await request('/api/auth/register', { method: 'POST', body: JSON.stringify({ name: 'Outro Nome', email: address.toUpperCase(), password }) });
  assert.equal(duplicate.status, 409); assert.equal(duplicate.headers.get('set-cookie'), null);
  assert.deepEqual(await prisma.user.findUniqueOrThrow({ where: { id: data.user.id } }), stored);
});

test('cadastros simultâneos criam apenas uma conta por e-mail', async () => {
  const responses = await Promise.all([0, 1].map(() => request('/api/auth/register', {
    method: 'POST', body: JSON.stringify({ name: 'Pessoa Concorrente', email: 'race-' + email, password }),
  })));
  assert.deepEqual(responses.map(response => response.status).sort(), [201, 409]);
  for (const response of responses) if (response.status === 201) registeredIds.push((await response.json()).user.id);
});

test('cadastro rejeita privilégios, senha curta, senha longa em bytes e nome vazio', async () => {
  for (const invalid of [{ role: 'ADMIN' }, { password: 'curta' }, { password: 'é'.repeat(37) }, { name: '  ' }]) {
    const response = await request('/api/auth/register', { method: 'POST', body: JSON.stringify({ name: 'Pessoa', email: 'invalid-' + email, password, ...invalid }) });
    assert.equal(response.status, 400); assert.equal(response.headers.get('set-cookie'), null);
  }
  assert.equal(await prisma.user.count({ where: { email: 'invalid-' + email } }), 0);
});

test('índice do banco recusa e-mail legado com diferenças de caixa e espaços', async () => {
  await assert.rejects(prisma.user.create({ data: { name: 'Duplicado', email: ' ' + email.toUpperCase() + ' ', password_hash: 'unused' } }));
});

test('sem sessão e com Bearer antigo o perfil é negado', async () => {
  assert.equal((await request('/api/users/me')).status, 401);
  const old = jwt.sign({ id: userId, email }, secret);
  assert.equal((await request('/api/users/me', { headers: { Authorization: 'Bearer ' + old } })).status, 401);
});

test('credenciais inválidas não emitem cookie nem revelam usuário', async () => {
  for (const body of [{ email, password: 'errada' }, { email: 'ausente-' + email, password }]) {
    const response = await request('/api/auth/login', { method: 'POST', body: JSON.stringify(body) });
    assert.equal(response.status, 401);
    assert.equal(response.headers.get('set-cookie'), null);
    assert.equal((await response.json()).error.code, 'INVALID_CREDENTIALS');
  }
});

test('login emite cookie HttpOnly e apenas os campos públicos', async () => {
  const response = await request('/api/auth/login', { method: 'POST',
    body: JSON.stringify({ email: '  ' + email.toUpperCase() + '  ', password }) });
  assert.equal(response.status, 200);
  const header = response.headers.get('set-cookie')!;
  assert.match(header, /HttpOnly/);
  assert.match(header, /SameSite=Lax/);
  assert.match(header, /Path=\/api/);
  cookie = header.split(';')[0];
  const data = await response.json();
  assert.equal(data.user.id, userId);
  assert.deepEqual(Object.keys(data.user).sort(), ['email', 'id', 'name', 'role']);
  assert.equal(data.token, undefined);
  assert.ok(Date.parse(data.expires_at) > Date.now());
});

test('perfil pode ser restaurado com cookie e não é cacheável', async () => {
  const response = await request('/api/users/me', { headers: { Cookie: cookie } });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal((await response.json()).user.id, userId);
});

test('não consulta outro usuário nem modifica perfil ou empresa', async () => {
  for (const method of ['GET', 'PUT', 'DELETE']) {
    const response = await request('/api/users/' + secondId, {
      method, headers: { Cookie: cookie }, ...(method === 'PUT' ? { body: JSON.stringify({ role: 'ADMIN' }) } : {}),
    });
    assert.equal(response.status, 404);
  }
  assert.equal((await request('/api/users/me', {
    method: 'PATCH', headers: { Cookie: cookie }, body: JSON.stringify({ role: 'ADMIN' }),
  })).status, 404);
  assert.equal(updateUserSchema.safeParse({ role: 'ADMIN' }).success, false);
  assert.equal(updateUserSchema.safeParse({ company_id: randomUUID() }).success, false);
  assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).role, 'EVALUATOR');
});

test('login não aceita campos extras e trata JSON inválido', async () => {
  assert.equal((await request('/api/auth/login', { method: 'POST',
    body: JSON.stringify({ email, password, role: 'ADMIN' }) })).status, 400);
  assert.equal((await request('/api/auth/login', { method: 'POST', body: '{' })).status, 400);
});

test('bloqueia origens estranhas ou ausentes, inclusive no logout', async () => {
  for (const bad of ['https://outro.example', 'null']) {
    for (const path of ['/api/auth/login', '/api/auth/logout', '/api/auth/register']) {
      assert.equal((await request(path, { method: 'POST', headers: { Origin: bad, Cookie: cookie },
        body: JSON.stringify({ email, password }) })).status, 403);
    }
  }
  assert.equal((await fetch(base + '/api/auth/logout', { method: 'POST', headers: { Cookie: cookie } })).status, 403);
  assert.equal((await request('/api/users/me', { headers: { Cookie: cookie } })).status, 200);
});

test('tokens adulterados, expirados ou com formato antigo são rejeitados', async () => {
  for (const token of [
    'alterado',
    jwt.sign({ version: 0, exp: 1 }, secret, { subject: userId, issuer: 'tcc-back', audience: 'tcc-web' }),
    jwt.sign({ id: userId, email }, secret),
  ]) assert.equal((await request('/api/users/me', { headers: { Cookie: tokenHeader(token) } })).status, 401);
});

test('logout revoga também uma cópia do cookie e outras sessões da conta', async () => {
  const otherCookie = (await login()).headers.get('set-cookie')!.split(';')[0];
  const response = await request('/api/auth/logout', { method: 'POST', headers: { Cookie: cookie } });
  assert.equal(response.status, 204);
  assert.match(response.headers.get('set-cookie')!, /Expires=Thu, 01 Jan 1970/);
  for (const copied of [cookie, otherCookie])
    assert.equal((await request('/api/users/me', { headers: { Cookie: copied } })).status, 401);
  assert.equal((await request('/api/auth/logout', { method: 'POST' })).status, 204);
});

test('nova entrada funciona após logout', async () => {
  const response = await login();
  assert.equal(response.status, 200);
  const fresh = response.headers.get('set-cookie')!.split(';')[0];
  assert.equal((await request('/api/users/me', { headers: { Cookie: fresh } })).status, 200);
});

test('limita tentativas repetidas sem autenticação', async () => {
  let status = 0;
  for (let i = 0; i < 21; i++) {
    status = (await request('/api/auth/login', { method: 'POST',
      body: JSON.stringify({ email: 'ausente-' + email, password }) })).status;
    if (status === 429) break;
  }
  assert.equal(status, 429);
});

test('limita tentativas de cadastro sem criar contas', async () => {
  let status = 0;
  for (let i = 0; i < 11 && status !== 429; i++)
    status = (await request('/api/auth/register', { method: 'POST', body: '{}' })).status;
  assert.equal(status, 429);
});
