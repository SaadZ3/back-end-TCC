// Verificação somente de leitura; nunca imprime credenciais ou a URL.
require('dotenv').config({ quiet: true });
const { Client } = require('pg');

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('Defina DATABASE_URL no .env antes de verificar o banco.');
    process.exitCode = 1;
    return;
  }
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 5000,
  });
  try {
    await client.connect();
    const result = await client.query(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename",
    );
    console.log('PostgreSQL acessível. Tabelas públicas:', result.rows.map(row => row.tablename));
  } catch (error) {
    console.error('Não foi possível acessar o PostgreSQL. Código:', error.code || 'UNKNOWN');
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main().catch(() => { console.error('Falha ao encerrar verificação.'); process.exitCode = 1; });
