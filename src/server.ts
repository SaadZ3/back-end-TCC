import { env } from './config/env.js';
import app from './app.js';
import { prisma } from './lib/prisma.js';
import { recoverInterruptedAnalyses } from './modules/analysis/analysis.service.js';

async function start() {
  await recoverInterruptedAnalyses();
  const server = app.listen(env.APP_PORT, () => {
    console.log('API de análise de políticas em http://localhost:' + env.APP_PORT);
  });
  server.requestTimeout = env.UPLOAD_TIMEOUT_MS + 5000;
  server.headersTimeout = Math.min(30000, server.requestTimeout);
  server.on('error', async () => {
    console.error('Não foi possível iniciar a API. Confira a porta.');
    await prisma.$disconnect();
    process.exitCode = 1;
  });
}
start().catch(async () => {
  console.error('Não foi possível iniciar a API. Confira conexão e migrations do banco.');
  await prisma.$disconnect();
  process.exitCode = 1;
});
