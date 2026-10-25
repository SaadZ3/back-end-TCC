import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Server } from 'node:http';

const database = process.env.TEST_DATABASE_URL;
const inference = process.env.TEST_INFERENCE_URL;
const source = process.env.TEST_POLICY_FILE;
if (!database || !inference || !source) throw new Error('Defina TEST_DATABASE_URL, TEST_INFERENCE_URL e TEST_POLICY_FILE.');
const target = new URL(database);
if (!['127.0.0.1', 'localhost'].includes(target.hostname) || !target.pathname.endsWith('_test'))
  throw new Error('Use somente PostgreSQL local com banco terminado em _test.');
if (!['127.0.0.1', 'localhost'].includes(new URL(inference).hostname)) throw new Error('Use inferência local para este teste.');
Object.assign(process.env, { DATABASE_URL: database, NODE_ENV: 'test', TOKEN_SECRET: randomBytes(32).toString('hex'),
  APP_ORIGINS: process.env.TEST_BROWSER_URL || 'http://127.0.0.1:5173', TOKEN_EXPIRATION: '1d', INFERENCE_URL: inference,
  INFERENCE_TIMEOUT_MS: '160000', MAX_UPLOAD_BYTES: '10485760', UPLOAD_TIMEOUT_MS: '30000' });
let prisma: typeof import('../src/lib/prisma.js').prisma;
let server: Server, base: string, cookie: string, userId: string, storage: string;
let previousId: string;
const output = process.env.TEST_E5_OUTPUT_DIR || process.env.TEST_E4_OUTPUT_DIR;
const origin = process.env.TEST_BROWSER_URL || 'http://127.0.0.1:5173';

before(async () => {
  if (output) await mkdir(output); // recusa sobrescrita de execução anterior
  assert.equal((await fetch(inference + '/health/ready')).status, 200);
  storage = await mkdtemp(path.join(tmpdir(), 'tcc-p5-real-'));
  process.env.UPLOAD_DIR = storage;
  const { default: app } = await import('../src/app.js');
  ({ prisma } = await import('../src/lib/prisma.js'));
  const { provisionUser } = await import('../src/modules/auth/provision-user.js');
  const email = 'p5-real-' + randomUUID() + '@example.test';
  const password = randomBytes(18).toString('hex');
  userId = (await provisionUser({ name: 'Teste real P5', email, password })).id;
  server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address();
  assert.ok(address && typeof address === 'object'); base = 'http://127.0.0.1:' + address.port;
  const response = await fetch(base + '/api/auth/login', { method: 'POST', headers: {
    Origin: origin, 'Content-Type': 'application/json',
  }, body: JSON.stringify({ email, password }) });
  assert.equal(response.status, 200);
  cookie = response.headers.get('set-cookie')!.split(';')[0];
});
after(async () => {
  if (server) await new Promise<void>(resolve => server.close(() => resolve()));
  if (prisma) {
    if (userId) {
      await prisma.policyAnalysis.deleteMany({ where: { user_id: userId } });
      await prisma.user.delete({ where: { id: userId } });
    }
    await prisma.$disconnect();
  }
  if (storage && path.dirname(storage) === path.resolve(tmpdir()) && path.basename(storage).startsWith('tcc-p5-real-'))
    await rm(storage, { recursive: true, force: true });
});
test('login → arquivo → modelo real Python → PostgreSQL → reabertura e arquivo', async () => {
  const buffer = await readFile(source!);
  const data = new FormData();
  data.append('file', new Blob([new Uint8Array(buffer)]), path.basename(source!));
  data.append('language', 'pt'); data.append('document_scope', 'full_document');
  const started = performance.now();
  const response = await fetch(base + '/api/analyses', { method: 'POST', headers: { Origin: origin, Cookie: cookie }, body: data });
  const body = await response.json();
  assert.equal(response.status, 201, JSON.stringify(body));
  assert.equal(body.status, 'completed');
  previousId = body.analysis_id;
  if (output) await writeFile(path.join(output,'analysis.json'),JSON.stringify(body,null,2));
  assert.ok(body.result.segments.length > 0);
  const restored = await fetch(base + '/api/analyses/' + body.analysis_id, { headers: { Cookie: cookie } });
  assert.deepEqual(await restored.json(), body);
  const record = await prisma.policyAnalysis.findUniqueOrThrow({ where: { id: body.analysis_id } });
  assert.deepEqual(record.result, body.result);
  const download = await fetch(base + '/api/analyses/' + body.analysis_id + '/file', { headers: { Cookie: cookie } });
  assert.deepEqual(Buffer.from(await download.arrayBuffer()), buffer);
  console.log(JSON.stringify({ seconds: (performance.now() - started) / 1000,
    segments: body.result.segments.length, pages: body.result.extraction.page_count,
    score: body.result.evaluation.score, status: body.result.evaluation.input_status }));
});

test('modelo real: perfil → inferência → banco → recarga, reanálise e parcial', async () => {
  const buffer = await readFile(source!);
  const prior = await prisma.policyAnalysis.findUniqueOrThrow({where:{id:previousId}});
  const form = (scope: string, link=false, data=buffer) => {
    const body = new FormData(); body.append('file',new Blob([new Uint8Array(data)]),'e4-policy.txt');
    body.append('language','pt'); body.append('document_scope',scope); 
    if(link) body.append('supersedes_analysis_id',previousId);
    return body;
  };
  const headers = { Origin:origin, Cookie:cookie };
  const start = performance.now();
  const response = await fetch(base+'/api/analyses',{method:'POST',headers,body:form('full_document',true)});
  const body = await response.json();
  assert.equal(response.status,201,JSON.stringify(body));
  assert.equal(body.schema_version,2); assert.equal(body.supersedes_analysis_id,previousId);
  const saved = await (await fetch(base+'/api/analyses/'+body.analysis_id,{headers})).json();
  assert.deepEqual(saved,body);
  assert.deepEqual((await prisma.policyAnalysis.findUniqueOrThrow({where:{id:body.analysis_id}})).result,body.result);
  assert.deepEqual(await prisma.policyAnalysis.findUniqueOrThrow({where:{id:previousId}}),prior);
  const direct = await (await fetch(inference+'/analyze',{method:'POST',body:form('full_document')})).json();
  assert.deepEqual(direct.result,body.result); assert.deepEqual(direct.versions,body.versions);
  const manifest = await (await fetch(inference+'/manifest')).json();
  assert.deepEqual(manifest.versions,body.versions);
  assert.ok(manifest.recommendations.code_sha256);
  assert.ok(body.versions.recommendations?.startsWith('governance-recommendations-'));
  assert.ok(manifest.scoring.code_sha256['heuristics.py']); assert.ok(manifest.scoring.code_sha256['pipeline.py']);
  const partial = await (await fetch(base+'/api/analyses',{method:'POST',headers,body:form('excerpt')})).json();
  assert.equal(partial.result.evaluation.score,null); assert.equal(partial.result.evaluation.score_status,'blocked');
  const conflict = await (await fetch(base+'/api/analyses',{method:'POST',headers,
    body:form('full_document',false,Buffer.from('Coletamos nome. Não coletamos nome.'))})).json();
  assert.equal(conflict.result.evaluation.score,null);
  assert.ok(conflict.result.evaluation.recommendations.length > 0);
  assert.deepEqual((await (await fetch(base+'/api/analyses/'+conflict.analysis_id,{headers})).json()).result,conflict.result);
  assert.ok(conflict.result.evaluation.score_blockers.includes('inconclusive_questions'));
  const summary = {validation:'real_model_local_test_database',seconds:(performance.now()-start)/1000,
    segments:body.result.segments.length,score:body.result.evaluation.score,partial_score:partial.result.evaluation.score,
    conflict_score:conflict.result.evaluation.score,exact_python_node_database_reload:true};
  if(output) for(const [name,value] of Object.entries({analysis:body,partial,conflict,manifest,summary}))
    await writeFile(path.join(output,name+'.json'),JSON.stringify(value,null,2));
  console.log(JSON.stringify(summary));
});
