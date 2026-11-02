/** Verifica comunicação e falhas entre backend e Python para proteger o comportamento do TCC. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

Object.assign(process.env, {
  DATABASE_URL: 'postgresql://test:test@127.0.0.1/test',
  TOKEN_SECRET: 'inference-test-secret', NODE_ENV: 'test',
});

test('recusa caracteres nulos em respostas e erros antes do armazenamento', async t => {
  const { infer } = await import('../src/modules/analysis/inference.client.js');
  const file = { buffer: Buffer.from('teste'), size: 5, originalname: 'teste.txt' } as Express.Multer.File;
  const fetchMock = t.mock.method(globalThis, 'fetch');
  for (const body of [
    { result: { extraction: { text: 'Texto\u0000.' } } },
    { result: { extraction: { warnings: ['Aviso\u0000.'] } } },
    { result: { 'chave\u0000': 'valor' } },
    { error: { code: 'UNREADABLE_FILE', message: 'Erro\u0000.' } },
  ]) {
    fetchMock.mock.mockImplementation(async () => Response.json(body, { status: 'error' in body ? 422 : 200 }));
    await assert.rejects(infer(file, 'full_document'), {
      code: 'INFERENCE_UNAVAILABLE',
      message: 'O serviço de análise retornou caracteres incompatíveis com o armazenamento. Atualize o serviço de análise e reenvie o documento.',
    });
  }
});

test('aceita marcador de leitura e texto literal de escape sem modificar a resposta', async t => {
  const { infer } = await import('../src/modules/analysis/inference.client.js');
  const file = { buffer: Buffer.from('teste'), size: 5, originalname: 'teste.txt' } as Express.Multer.File;
  const body = JSON.parse(readFileSync(path.join(__dirname, 'fixtures/e4/partial.json'), 'utf8'));
  body.result.source.sha256 = createHash('sha256').update(file.buffer).digest('hex');
  body.result.source.byte_size = file.size;
  body.result.evaluation.policy_id = body.result.source.sha256;
  body.result.document_scope = 'full_document';
  body.result.extraction.status = 'partial';
  body.result.extraction.warnings = ['Caractere ilegível: �; texto literal: \\u0000.'];
  body.result.evaluation.score_blockers = ['extraction_partial'];
  t.mock.method(globalThis, 'fetch', async () => Response.json(body));
  assert.deepEqual(await infer(file, 'full_document'), body);
  assert.equal(body.result.evaluation.score, null);
});

test('distingue falha de conexão, resposta inválida e erro informado pela inferência', async t => {
  const { infer } = await import('../src/modules/analysis/inference.client.js');
  const file = { buffer: Buffer.from('teste'), size: 5, originalname: 'teste.txt' } as Express.Multer.File;
  const fetchMock = t.mock.method(globalThis, 'fetch', async (): Promise<Response> => {
    throw new TypeError('fetch failed');
  });
  await assert.rejects(infer(file, 'full_document'), {
    code: 'INFERENCE_UNAVAILABLE',
    message: 'Não foi possível conectar ao serviço de análise. Verifique se ele está iniciado e tente novamente.',
  });
  for (const response of [new Response('not json'), Response.json({ result: {} })]) {
    fetchMock.mock.mockImplementation(async () => response);
    await assert.rejects(infer(file, 'full_document'), {
      code: 'INFERENCE_UNAVAILABLE',
      message: 'Não foi possível validar a resposta do serviço de análise. Tente novamente.',
    });
  }
  fetchMock.mock.mockImplementation(async () => Response.json({
    error: { code: 'INFERENCE_UNAVAILABLE', message: 'Serviço ocupado.' },
  }, { status: 503 }));
  await assert.rejects(infer(file, 'full_document'), {
    code: 'INFERENCE_UNAVAILABLE', message: 'Serviço ocupado.',
  });
});
