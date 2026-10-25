import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { once } from 'node:events';

Object.assign(process.env, {
  DATABASE_URL: 'postgresql://test:test@127.0.0.1/test',
  TOKEN_SECRET: 'upload-test-secret', NODE_ENV: 'test',
});

test('upload preserva nome UTF-8 e conteúdo enviados pelo navegador', async () => {
  const { receiveUpload } = await import('../src/modules/analysis/upload.js');
  const app = express();
  app.post('/', async (req, res) => {
    await receiveUpload(req, res);
    res.json({ name: req.file?.originalname, content: req.file?.buffer.toString('utf8') });
  });
  const server = app.listen(0, '127.0.0.1');
  try {
    await once(server, 'listening');
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    for (const name of ['Política de Privacidade e Cookie _ Itaú.pdf', 'política-🔒.txt', 'policy.txt']) {
      const data = new FormData();
      data.append('file', new Blob(['conteúdo de teste']), name);
      const response = await fetch(`http://127.0.0.1:${address.port}`, { method: 'POST', body: data });
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { name, content: 'conteúdo de teste' });
    }
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
