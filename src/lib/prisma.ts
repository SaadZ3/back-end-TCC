/** Compartilha o cliente PostgreSQL usado pelos serviços do backend. */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { env } from '../config/env.js';

// Reutiliza o cliente para evitar conexões extras quando o código recarrega no desenvolvimento.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/** Retorna um cliente PostgreSQL com limites de conexão e consulta. */
function createPrismaClient(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: env.DATABASE_URL, connectionTimeoutMillis: 10000, query_timeout: 15000 });
  return new PrismaClient({
    adapter,
    log: ['warn'], // Não registrar SQL/objetos de erro que possam incluir dados de políticas.
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
