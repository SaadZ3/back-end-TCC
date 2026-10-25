import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'node:path';

dotenv.config({ quiet: true });

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  INFERENCE_URL: z.string().url().default('http://127.0.0.1:8000').refine(value => {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password &&
      url.pathname === '/' && !url.search && !url.hash;
  }, 'Informe somente a origem HTTP(S) interna do serviço Python.'),
  INFERENCE_TIMEOUT_MS: z.coerce.number().int().min(1000).max(300000).default(160000),
  UPLOAD_TIMEOUT_MS: z.coerce.number().int().min(1000).max(60000).default(30000),
  MAX_UPLOAD_BYTES: z.coerce.number().int().min(1).max(10485760).default(10485760),
  UPLOAD_DIR: z.string().min(1).default('uploads/policies').transform(value => path.resolve(__dirname, '../..', value)),
  TOKEN_SECRET: z.string().min(8),
  TOKEN_EXPIRATION: z.string().regex(/^[1-9]\d*[mhd]$/).default('1d'),
  APP_PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  APP_ORIGINS: z.string().default('http://127.0.0.1:5173,http://localhost:5173'),
}).superRefine((value, context) => {
  const origins = value.APP_ORIGINS.split(',').map(item => item.trim());
  if (!origins.length || origins.some(origin => {
    try { const url = new URL(origin); return url.origin !== origin || !['http:', 'https:'].includes(url.protocol); }
    catch { return true; }
  })) context.addIssue({ code: 'custom', path: ['APP_ORIGINS'], message: 'Informe origens HTTP(S) completas, sem caminhos.' });
  const amount = Number.parseInt(value.TOKEN_EXPIRATION, 10);
  const unit = value.TOKEN_EXPIRATION.slice(-1);
  const seconds = amount * ({ m: 60, h: 3600, d: 86400 }[unit] ?? 0);
  if (!Number.isSafeInteger(seconds) || seconds < 60 || seconds > 604800)
    context.addIssue({ code: 'custom', path: ['TOKEN_EXPIRATION'], message: 'Use uma duração entre 1m e 7d.' });
  if (value.NODE_ENV === 'production') {
    if (value.TOKEN_SECRET.length < 32)
      context.addIssue({ code: 'custom', path: ['TOKEN_SECRET'], message: 'Produção exige segredo de pelo menos 32 caracteres.' });
    if (!process.env.APP_ORIGINS || origins.some(origin => !origin.startsWith('https://')))
      context.addIssue({ code: 'custom', path: ['APP_ORIGINS'], message: 'Configure explicitamente a origem HTTPS de produção.' });
  }
});
const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Configuração inválida:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}
export const env = parsed.data;
export const allowedOrigins = env.APP_ORIGINS.split(',').map(value => value.trim());
export const sessionTtlSeconds = Number.parseInt(env.TOKEN_EXPIRATION, 10) *
  ({ m: 60, h: 3600, d: 86400 }[env.TOKEN_EXPIRATION.slice(-1)] ?? 0);
