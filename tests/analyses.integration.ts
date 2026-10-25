import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Server } from 'node:http';
import express from 'express';
import multer from 'multer';

const database = process.env.TEST_DATABASE_URL;
if (!database) throw new Error('Defina TEST_DATABASE_URL para um banco local terminado em _test.');
const target = new URL(database);
if (!['127.0.0.1', 'localhost'].includes(target.hostname) || !target.pathname.endsWith('_test'))
  throw new Error('Os testes só escrevem em banco local com nome terminado em _test.');
Object.assign(process.env, {
  DATABASE_URL: database, NODE_ENV: 'test', TOKEN_SECRET: randomBytes(32).toString('hex'),
  TOKEN_EXPIRATION: '1d', APP_ORIGINS: 'http://127.0.0.1:5173',
  INFERENCE_TIMEOUT_MS: '1000', UPLOAD_TIMEOUT_MS: '1000', MAX_UPLOAD_BYTES: '2048',
});
let prisma: typeof import('../src/lib/prisma.js').prisma;
let recover: typeof import('../src/modules/analysis/analysis.service.js').recoverInterruptedAnalyses;
let server: Server, python: Server;
let base: string, storage: string, ownerId: string, otherId: string;
let cookie: string, otherCookie: string;
let successfulId: string;
let revisedId: string;
let mode = 'ok';
let calls = 0;
let release: (() => void) | undefined;
const origin = 'http://127.0.0.1:5173';
const content = 'Coletamos dados para prestar serviços.';
async function listen(app: express.Express) {
  const listener = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => listener.once('listening', resolve));
  const address = listener.address();
  assert.ok(address && typeof address === 'object');
  return { listener, url: 'http://127.0.0.1:' + address.port };
}
function upload(options: { name?: string; data?: string | Uint8Array; scope?: string; cookie?: string; extra?: boolean; previous?: string; profile?: string } = {}) {
  const body = new FormData();
  body.append('file', new Blob([typeof options.data === 'string' ? options.data : new Uint8Array(options.data ?? Buffer.from(content))]),
    options.name ?? 'politica.txt');
  body.append('language', 'pt');
  body.append('document_scope', options.scope ?? 'full_document');
  if (options.extra) body.append('user_id', otherId);
  if (options.profile) body.append('profile_id', options.profile);
  if (options.previous) body.append('supersedes_analysis_id', options.previous);
  return fetch(base + '/api/analyses', { method: 'POST', body,
    headers: { Origin: origin, Cookie: options.cookie ?? cookie } });
}
function get(suffix: string, session = cookie) {
  return fetch(base + '/api/analyses' + suffix, { headers: { Cookie: session } });
}

before(async () => {
  storage = await mkdtemp(path.join(tmpdir(), 'tcc-p5-tests-'));
  process.env.UPLOAD_DIR = storage;
  const fake = express();
  fake.post('/analyze', multer().single('file'), async (req, res) => {
    calls++;
    if (mode === 'blocked') await new Promise<void>(resolve => { release = resolve; });
    if (mode === 'timeout') await new Promise(resolve => setTimeout(resolve, 1400));
    if (mode === 'unavailable') { res.status(503).json({ error: { code: 'INFERENCE_UNAVAILABLE', message: 'Serviço ocupado.' } }); return; }
    if (mode === 'invalid') { res.json({ unexpected: true }); return; }
    if (mode === 'ocr') { res.status(422).json({ error: { code: 'OCR_REQUIRED', message: 'O PDF precisa de OCR.' } }); return; }
    const result = JSON.parse(await readFile(path.join(__dirname, 'fixtures/e4',
      req.body.document_scope === 'full_document' ? 'complete.json' : 'partial.json'), 'utf8'));
    result.result.source.sha256 = mode === 'wrong_source' ? '0'.repeat(64) : createHash('sha256').update(req.file!.buffer).digest('hex');
    result.result.source.byte_size = req.file!.size;
    result.result.document_scope = req.body.document_scope;
    result.result.evaluation.policy_id = result.result.source.sha256;
    res.json(result);
  });
  const upstream = await listen(fake);
  python = upstream.listener;
  process.env.INFERENCE_URL = upstream.url;
  const { default: app } = await import('../src/app.js');
  ({ prisma } = await import('../src/lib/prisma.js'));
  ({ recoverInterruptedAnalyses: recover } = await import('../src/modules/analysis/analysis.service.js'));
  const { provisionUser } = await import('../src/modules/auth/provision-user.js');
  const password = randomBytes(18).toString('hex');
  const email = 'p5-' + randomUUID() + '@example.test';
  ownerId = (await provisionUser({ name: 'Dono', email, password })).id;
  otherId = (await provisionUser({ name: 'Outro', email: 'other-' + email, password })).id;
  const backend = await listen(app);
  server = backend.listener; base = backend.url;
  async function login(address: string) {
    const response = await fetch(base + '/api/auth/login', { method: 'POST',
      headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: address, password }) });
    assert.equal(response.status, 200);
    return response.headers.get('set-cookie')!.split(';')[0];
  }
  cookie = await login(email); otherCookie = await login('other-' + email);
});
after(async () => {
  release?.();
  for (const listener of [server, python]) if (listener) await new Promise<void>(resolve => listener.close(() => resolve()));
  if (prisma) {
    await prisma.policyAnalysis.deleteMany({ where: { user_id: { in: [ownerId, otherId].filter(Boolean) } } });
    await prisma.user.deleteMany({ where: { id: { in: [ownerId, otherId].filter(Boolean) } } });
    await prisma.$disconnect();
  }
  // Diretório exclusivo criado por este teste, validado antes de apagar recursivamente.
  if (storage && path.dirname(storage) === path.resolve(tmpdir()) && path.basename(storage).startsWith('tcc-p5-tests-'))
    await rm(storage, { recursive: true, force: true });
});

test('exige sessão e origem antes de processar upload', async () => {
  assert.equal((await upload({ cookie: '' })).status, 401);
  assert.equal((await fetch(base + '/api/analyses', { method: 'POST', headers: { Cookie: cookie } })).status, 403);
  assert.equal(calls, 0);
});

test('rotas antigas não executam avaliações', async () => {
  for (const retired of ['/api/v1/analyses', '/api/v2/analyses']) {
    assert.equal((await fetch(base + retired, { headers: { Cookie: cookie } })).status, 404);
    assert.equal((await fetch(base + retired, { method: 'POST', headers: { Cookie: cookie, Origin: origin } })).status, 404);
  }
  assert.equal(calls, 0);
});
test('rejeita formato, arquivo vazio, excesso de bytes e campos extras sem salvar', async () => {
  for (const [options, status] of [
    [{ name: 'arquivo.exe' }, 415], [{ data: '' }, 422], [{ data: 'x'.repeat(2049) }, 413], [{ extra: true }, 400],
  ] as const) assert.equal((await upload(options)).status, status);
  assert.equal(await prisma.policyAnalysis.count({ where: { user_id: ownerId } }), 0);
  assert.deepEqual(await readdir(storage), []);
});
test('persiste resultado antes de responder e permite reabrir/download privado', async () => {
  const response = await upload({ name: '../politica.txt' });
  assert.equal(response.status, 201);
  const body = await response.json();
  successfulId = body.analysis_id;
  assert.equal(body.status, 'completed');
  const row = await prisma.policyAnalysis.findUniqueOrThrow({ where: { id: successfulId } });
  assert.equal(row.status, 'completed');
  assert.equal(row.user_id, ownerId);
  assert.equal(row.original_filename, 'politica.txt');
  assert.match(row.storage_key, /^[a-f0-9-]{36}\.txt$/);
  assert.deepEqual(row.result, body.result);
  assert.deepEqual((await (await get('/' + successfulId)).json()), body);
  const download = await get('/' + successfulId + '/file');
  assert.equal(download.status, 200);
  assert.equal(await download.text(), content);
  assert.match(download.headers.get('content-disposition')!, /^attachment/);
  assert.equal(download.headers.get('cache-control'), 'no-store');
  assert.equal(await readFile(path.join(storage, row.storage_key), 'utf8'), content);
  assert.equal((await fetch(base + '/uploads/policies/' + row.storage_key)).status, 404);
});
test('outro usuário não consulta análise, arquivo ou histórico do dono', async () => {
  assert.equal((await get('/' + successfulId, otherCookie)).status, 404);
  assert.equal((await get('/' + successfulId + '/file', otherCookie)).status, 404);
  const list = await (await get('', otherCookie)).json();
  assert.equal(list.total, 0); assert.deepEqual(list.items, []);
});
test('lista com paginação e valida parâmetros/ID', async () => {
  const list = await (await get('?page=1&page_size=1')).json();
  assert.equal(list.total, 1); assert.equal(list.items[0].analysis_id, successfulId);
  assert.equal(list.items[0].result, undefined);
  for (const suffix of ['?page=0', '?page_size=51', '?page=1&page=2', '?user_id=outro', '/invalido'])
    assert.equal((await get(suffix)).status, 400);
});
test('trecho preserva score nulo e versões', async () => {
  const response = await upload({ scope: 'excerpt' });
  assert.equal(response.status, 201);
  const body = await response.json();
  assert.equal(body.result.evaluation.score, null);
  assert.equal(body.result.evaluation.input_status, 'partial_input');
  assert.ok(body.versions.model);
});
for (const [behavior, code, status] of [
  ['unavailable', 'INFERENCE_UNAVAILABLE', 503], ['invalid', 'INFERENCE_UNAVAILABLE', 503],
  ['wrong_source', 'INFERENCE_UNAVAILABLE', 503], ['ocr', 'OCR_REQUIRED', 422],
  ['timeout', 'ANALYSIS_TIMEOUT', 504],
] as const) test('salva falha: ' + behavior, async () => {
  mode = behavior;
  try {
    const response = await upload();
    assert.equal(response.status, status);
    const body = await response.json();
    assert.equal(body.error.code, code); assert.ok(body.analysis_id);
    const saved = await (await get('/' + body.analysis_id)).json();
    assert.equal(saved.status, 'failed'); assert.equal(saved.error.code, code);
    assert.equal(saved.result, null);
  } finally { mode = 'ok'; }
});
test('processing é consultável e concorrência não inicia outra inferência', async () => {
  mode = 'blocked'; release = undefined;
  const pending = upload();
  try {
    for (let i = 0; i < 100 && !release; i++) await new Promise(resolve => setTimeout(resolve, 5));
    assert.ok(release);
    const record = await prisma.policyAnalysis.findFirstOrThrow({ where: { user_id: ownerId, status: 'processing' } });
    assert.equal((await (await get('/' + record.id)).json()).status, 'processing');
    const before = calls;
    assert.equal((await upload()).status, 503); assert.equal(calls, before);
  } finally { release?.(); mode = 'ok'; }
  assert.equal((await pending).status, 201);
});
test('reinício marca pendência como falha sem alterar resultados concluídos', async () => {
  const record = await prisma.policyAnalysis.create({ data: {
    user_id: ownerId, storage_key: randomUUID() + '.txt', original_filename: 'interrompida.txt',
    file_sha256: '0'.repeat(64), byte_size: 1, document_scope: 'unknown',
    result_schema_version: 2, profile_id: 'core-14-v1',
  } });
  await recover();
  const restored = await (await get('/' + record.id)).json();
  assert.equal(restored.status, 'failed');
  assert.match(restored.error.message, /reinício/);
  assert.equal((await (await get('/' + successfulId)).json()).status, 'completed');
});

test('limita corpo multipart sem Content-Length e upload lento', async () => {
  const { request } = await import('node:http');
  async function streamed(large: boolean): Promise<{ status: number; body: string }> {
    return new Promise((resolve, reject) => {
      const req = request(base + '/api/analyses', { method: 'POST', headers: {
        Origin: origin, Cookie: cookie, 'Content-Type': 'multipart/form-data; boundary=tccboundary',
      } }, res => {
        let body = '';
        res.on('data', chunk => { body += chunk; });
        res.on('end', () => { resolve({ status: res.statusCode!, body }); req.destroy(); });
      });
      req.on('error', reject);
      req.write('--tccboundary\r\nContent-Disposition: form-data; name="file"; filename="a.txt"\r\n\r\n');
      if (large) req.write('x'.repeat(70000));
      // Não encerra o corpo: o servidor deve responder sem aguardar o cliente.
    });
  }
  const oversized = await streamed(true);
  assert.equal(oversized.status, 413);
  assert.equal(JSON.parse(oversized.body).error.code, 'FILE_TOO_LARGE');
  const slow = await streamed(false);
  assert.equal(slow.status, 504);
  assert.equal(JSON.parse(slow.body).error.code, 'ANALYSIS_TIMEOUT');
  assert.equal((await upload()).status, 201);
});
test('não responde sucesso quando a gravação final falha', async () => {
  const original = prisma.policyAnalysis.updateMany;
  prisma.policyAnalysis.updateMany = (() => { throw new Error('storage unavailable'); }) as typeof original;
  let failedId: string;
  try {
    const response = await upload();
    assert.equal(response.status, 500);
    const body = await response.json();
    failedId = body.analysis_id;
    assert.ok(failedId);
    assert.equal((await prisma.policyAnalysis.findUniqueOrThrow({ where: { id: failedId } })).status, 'processing');
  } finally { prisma.policyAnalysis.updateMany = original; }
  await recover();
  assert.equal((await (await get('/' + failedId!)).json()).status, 'failed');
});

test('salva cálculo e evidências; reanálise mantém resultado anterior imutável', async () => {
  const prior = await prisma.policyAnalysis.findUniqueOrThrow({ where: { id: successfulId } });
  const response = await upload({ previous: successfulId });
  const body = await response.json();
  assert.equal(response.status, 201, JSON.stringify(body));
  revisedId = body.analysis_id;
  assert.equal(body.schema_version, 2);
  assert.equal(body.profile_id, 'core-14-v1');
  assert.equal(body.supersedes_analysis_id, successfulId);
  const row = await prisma.policyAnalysis.findUniqueOrThrow({ where: { id: revisedId } });
  assert.equal(row.result_schema_version, 2);
  assert.deepEqual(row.result, body.result);
  assert.deepEqual(row.versions, body.versions);
  assert.deepEqual(await (await get('/'+revisedId, cookie)).json(), body);
  assert.deepEqual(await prisma.policyAnalysis.findUniqueOrThrow({ where: { id: successfulId } }), prior);
  assert.equal((await get('/'+successfulId, cookie)).status, 200);
  assert.equal(await (await get('/'+revisedId+'/file', cookie)).text(), content);
});
test('filtra histórico legado, protege origem e arquivo por proprietário', async () => {
  const all = await (await get('', cookie)).json();
  assert.ok(all.items.some((x: { schema_version: number }) => x.schema_version === 2));
  assert.ok(all.items.every((x: { schema_version: number }) => x.schema_version === 2));
  for (const suffix of ['/'+revisedId, '/'+revisedId+'/file']) assert.equal((await get(suffix, otherCookie)).status, 404);
  const before = await prisma.policyAnalysis.count({ where: { user_id: otherId } });
  assert.equal((await upload({ previous: successfulId, cookie: otherCookie })).status, 404);
  assert.equal(await prisma.policyAnalysis.count({ where: { user_id: otherId } }), before);
  assert.equal((await upload({ profile:'custom' })).status, 400);
});

test('resultados do método retirado ficam fora de consultas, downloads e reanálises', async () => {
  const old = await prisma.policyAnalysis.create({ data: {
    user_id: ownerId, storage_key: randomUUID() + '.txt', original_filename: 'anterior.txt',
    file_sha256: '0'.repeat(64), byte_size: 1, document_scope: 'full_document',
    result_schema_version: 1, profile_id: null, status: 'completed',
  } });
  const list = await (await get('')).json();
  assert.ok(list.items.every((item: {analysis_id: string}) => item.analysis_id !== old.id));
  assert.equal((await get('/' + old.id)).status, 404);
  assert.equal((await get('/' + old.id + '/file')).status, 404);
  assert.equal((await upload({ previous: old.id })).status, 404);
  assert.equal((await prisma.policyAnalysis.findUniqueOrThrow({where: {id: old.id}})).status, 'completed');
});
test('mantém parcial nulo, versão em falhas e processamento', async () => {
  const partial = await (await upload({ scope:'excerpt' })).json();
  assert.equal(partial.result.evaluation.score, null);
  assert.ok(partial.result.evaluation.dimensions.every((d: { contribution: number | null }) => d.contribution === null));
  mode = 'unavailable';
  try {
    const failed = await (await upload({})).json();
    const saved = await (await get('/'+failed.analysis_id, cookie)).json();
    assert.equal(saved.schema_version, 2); assert.equal(saved.status, 'failed');
  } finally { mode = 'ok'; }
  mode = 'blocked'; release = undefined;
  const pending = upload({});
  try {
    for (let i=0;i<100 && !release;i++) await new Promise(resolve=>setTimeout(resolve,5));
    assert.ok(release);
    const row = await prisma.policyAnalysis.findFirstOrThrow({ where: { user_id: ownerId, status:'processing' } });
    assert.equal((await fetch(base + '/api/analyses/' + row.id, { method: 'DELETE', headers: { Origin: origin, Cookie: cookie } })).status, 409);
    const saved = await (await get('/'+row.id, cookie)).json();
    assert.equal(saved.schema_version, 2); assert.equal(saved.profile_id, 'core-14-v1');
    assert.equal((await upload()).status, 503);
  } finally { release?.(); mode = 'ok'; }
  assert.equal((await pending).status, 201);
});

test('exclusão exige sessão, origem e dono, sem revelar análises de outra conta', async () => {
  for (const [session, source, expected] of [['', origin, 401], [cookie, 'https://outro.example', 403], [otherCookie, origin, 404]]) {
    assert.equal((await fetch(base + '/api/analyses/' + successfulId, { method: 'DELETE', headers: { Cookie: session, Origin: source } })).status, expected);
  }
  assert.equal((await get('/' + successfulId)).status, 200);
  assert.equal((await fetch(base + '/api/analyses/invalido', { method: 'DELETE', headers: { Origin: origin, Cookie: cookie } })).status, 400);
});

test('exclui registro e arquivo, preserva reanálises e atualiza histórico', async () => {
  const row = await prisma.policyAnalysis.findUniqueOrThrow({ where: { id: successfulId } });
  const priorRevision = await prisma.policyAnalysis.findUniqueOrThrow({ where: { id: revisedId } });
  const total = (await (await get('')).json()).total;
  const remove = () => fetch(base + '/api/analyses/' + successfulId, { method: 'DELETE', headers: { Origin: origin, Cookie: cookie } });
  assert.equal((await remove()).status, 204);
  assert.equal(await prisma.policyAnalysis.findUnique({ where: { id: successfulId } }), null);
  assert.ok(!(await readdir(storage)).includes(row.storage_key));
  assert.equal((await get('/' + successfulId)).status, 404);
  assert.equal((await get('/' + successfulId + '/file')).status, 404);
  assert.equal((await remove()).status, 404);
  assert.equal((await (await get('')).json()).total, total - 1);
  const revision = await prisma.policyAnalysis.findUniqueOrThrow({ where: { id: revisedId } });
  assert.equal(revision.supersedes_analysis_id, null);
  assert.deepEqual(revision.result, priorRevision.result);
  assert.equal((await get('/' + revisedId + '/file')).status, 200);
});

test('exclui análise com falha mesmo se o arquivo já não existir', async () => {
  const row = await prisma.policyAnalysis.create({ data: {
    user_id: ownerId, storage_key: randomUUID() + '.txt', original_filename: 'ausente.txt',
    file_sha256: '0'.repeat(64), byte_size: 1, document_scope: 'full_document', status: 'failed',
  } });
  assert.equal((await fetch(base + '/api/analyses/' + row.id, { method: 'DELETE', headers: { Origin: origin, Cookie: cookie } })).status, 204);
});
