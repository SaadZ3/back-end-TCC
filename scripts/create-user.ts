import { parseArgs } from 'node:util';
import { z } from 'zod';
import { prisma } from '../src/lib/prisma.js';
import { provisionUser } from '../src/modules/auth/provision-user.js';

const usage = 'Use: node --import tsx scripts/create-user.ts --name "Seu Nome" --email "seu-email@exemplo.com"';

async function main() {
  try {
    const { values } = parseArgs({ options: { name: { type: 'string' }, email: { type: 'string' } } });
    if (!values.name || !values.email) {
      console.error('Informe nome e e-mail. ' + usage);
      process.exitCode = 1;
      return;
    }
    const password = process.env.TCC_USER_PASSWORD;
    delete process.env.TCC_USER_PASSWORD;
    if (!password) throw new Error('Defina TCC_USER_PASSWORD temporariamente, conforme o README.');
    const user = await provisionUser({ name: values.name, email: values.email, password });
    console.log('Conta criada:', user.email, '(' + user.role + ')');
  } catch (error) {
    if (error instanceof Error && 'code' in error && typeof error.code === 'string' && error.code.startsWith('ERR_PARSE_ARGS_')) {
      console.error('Argumentos inválidos. ' + usage);
      process.exitCode = 1;
      return;
    }
    console.error(error instanceof z.ZodError ? error.issues.map(issue => issue.message).join(' ') :
      error instanceof Error && (error.message.startsWith('Já existe') || error.message === 'Defina TCC_USER_PASSWORD temporariamente, conforme o README.') ? error.message :
      'Não foi possível criar a conta. Confira os argumentos, a senha temporária e o banco.');
    process.exitCode = 1;
  } finally { await prisma.$disconnect(); }
}
void main();
