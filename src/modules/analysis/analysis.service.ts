import { randomUUID, createHash } from 'node:crypto';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { Prisma, type PolicyAnalysis } from '@prisma/client';
import { env } from '../../config/env.js';
import { prisma } from '../../lib/prisma.js';
import { analysisMetadataSchema, analysisResponseSchema } from '../../contracts/analysis.js';
import { AnalysisError } from './analysis.error.js';
import { infer } from './inference.client.js';
import { normalizeStoredResult } from '../../utils/scoreScale.js';

export function serialize(row: PolicyAnalysis) {
  const result = normalizeStoredResult(row.result);
  return analysisResponseSchema.parse({
    schema_version: 2, analysis_id: row.id, created_at: row.created_at.toISOString(),
    original_filename: row.original_filename, status: row.status, profile_id: row.profile_id,
    supersedes_analysis_id: row.supersedes_analysis_id, versions: row.versions, result, error: row.error,
  });

}

export async function recoverInterruptedAnalyses() {
  // Protótipo com uma instância Node. Executar antes de começar a aceitar requisições.
  return prisma.policyAnalysis.updateMany({ where: { status: 'processing', result_schema_version: 2 }, data: {
    status: 'failed', completed_at: new Date(), result: Prisma.DbNull, versions: Prisma.DbNull,
    error: { code: 'INFERENCE_UNAVAILABLE', message: 'Análise interrompida pelo reinício do servidor. Envie novamente.' },
  } });
}

export async function ownedAnalysis(id: string, userId: string) {
  const row = await prisma.policyAnalysis.findFirst({ where: { id, user_id: userId, result_schema_version: 2 } });
  if (!row) throw new AnalysisError('NOT_FOUND', 'Análise não encontrada.', 404);
  return row;
}

export function privateFilePath(key: string) {
  if (!/^[a-f0-9-]{36}\.(pdf|txt)$/.test(key)) throw new Error('Invalid storage key');
  return path.join(env.UPLOAD_DIR, key);
}

export async function deleteAnalysis(id: string, userId: string) {
  const row = await ownedAnalysis(id, userId);
  if (row.status === 'processing')
    throw new AnalysisError('ANALYSIS_PROCESSING', 'Aguarde o processamento terminar antes de excluir a análise.', 409);
  const location = privateFilePath(row.storage_key);
  const deleted = await prisma.policyAnalysis.deleteMany({
    where: { id, user_id: userId, result_schema_version: 2, status: { not: 'processing' } },
  });
  if (!deleted.count) throw new AnalysisError('NOT_FOUND', 'Análise não encontrada.', 404);
  // O registro é removido primeiro para que uma falha de disco nunca mantenha o arquivo acessível pela API.
  try { await unlink(location); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
      console.error('Falha ao remover arquivo de análise excluída:', row.id);
  }
}

export async function createAnalysis(userId: string, body: unknown, file?: Express.Multer.File) {
  const metadata = analysisMetadataSchema.parse(body);
  const profile = 'core-14-v1';
  const previous = metadata.supersedes_analysis_id ?? null;
  if (previous) await ownedAnalysis(previous, userId);
  if (!file || file.size === 0) throw new AnalysisError('UNREADABLE_FILE', 'Envie um arquivo não vazio.', 422);
  const filename = file.originalname.replace(/\\/g, '/').split('/').pop()!.replace(/[\x00-\x1f\x7f]/g, '').slice(0, 200);
  const extension = path.extname(filename).toLowerCase();
  if (!['.pdf', '.txt'].includes(extension)) throw new AnalysisError('UNSUPPORTED_FORMAT', 'Envie PDF com texto ou TXT UTF-8.', 415);
  file.originalname = filename;
  const id = randomUUID();
  const key = id + extension;
  await mkdir(env.UPLOAD_DIR, { recursive: true, mode: 0o700 });
  const location = privateFilePath(key);
  await writeFile(location, file.buffer, { flag: 'wx', mode: 0o600 });
  let row: PolicyAnalysis;
  try {
    row = await prisma.policyAnalysis.create({ data: {
      id, user_id: userId, original_filename: filename, storage_key: key,
      file_sha256: createHash('sha256').update(file.buffer).digest('hex'),
      byte_size: file.size, document_scope: metadata.document_scope, language: metadata.language,
      result_schema_version: 2, profile_id: profile, supersedes_analysis_id: previous,
    } });
  } catch (error) {
    await unlink(location).catch(() => undefined);
    throw error;
  }
  try {
    const response = await infer(file, metadata.document_scope);
    const updated = await prisma.policyAnalysis.updateMany({
      where: { id, status: 'processing' },
      data: { status: 'completed', completed_at: new Date(),
        versions: response.versions as Prisma.InputJsonValue,
        result: response.result as Prisma.InputJsonValue, error: Prisma.DbNull },
    });
    if (updated.count !== 1) throw new AnalysisError('INFERENCE_UNAVAILABLE', 'Análise interrompida. Envie novamente.', 503);
    return serialize(await ownedAnalysis(id, userId));
  } catch (failure) {
    const error = failure instanceof AnalysisError ? failure :
      new AnalysisError('INTERNAL_ERROR', 'Não foi possível concluir e salvar a análise.', 500);
    // Se o banco ficar indisponível aqui, o estado processing será recuperado no próximo início.
    try {
      await prisma.policyAnalysis.updateMany({ where: { id, status: 'processing' }, data: {
        status: 'failed', completed_at: new Date(), result: Prisma.DbNull, versions: Prisma.DbNull,
        error: { code: error.code, message: error.message },
      } });
    } catch {
      throw new AnalysisError('INTERNAL_ERROR', 'Falha ao salvar a análise. Consulte o histórico após restabelecer o serviço.', 500, row.id);
    }
    error.analysisId = row.id;
    throw error;
  }
}
