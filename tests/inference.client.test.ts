import test from 'node:test';
import assert from 'node:assert/strict';

Object.assign(process.env, {
  DATABASE_URL: 'postgresql://test:test@127.0.0.1/test',
  TOKEN_SECRET: 'inference-test-secret', NODE_ENV: 'test',
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
