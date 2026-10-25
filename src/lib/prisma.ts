import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { env } from '../config/env.js';

// Singleton do Prisma Client para evitar múltiplas conexões em dev (hot reload)
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

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
