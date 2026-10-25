import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../../middlewares/auth.js';
import { prisma } from '../../lib/prisma.js';
import { receiveUpload } from './upload.js';
import { createAnalysis, deleteAnalysis, ownedAnalysis, privateFilePath, serialize } from './analysis.service.js';
import { AnalysisError } from './analysis.error.js';

let busy = false;
const router = Router();
router.use(authMiddleware);
router.post('/', async (req, res, next) => {
  if (busy) {
    res.status(503).json({ error: { code: 'INFERENCE_UNAVAILABLE', message: 'Há uma análise em andamento. Aguarde e tente novamente.' } });
    return;
  }
  busy = true;
  try {
    await receiveUpload(req, res);
    const response = await createAnalysis(req.userId!, req.body, req.file);
    res.status(201).json(response);
  } catch (error) {
    if (!res.headersSent) res.setHeader('Connection', 'close');
    next(error);
  } finally { busy = false; }
});

const pagination = z.strictObject({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  page_size: z.coerce.number().int().min(1).max(50).default(20),
});
router.get('/', async (req, res) => {
  const { page, page_size } = pagination.parse(req.query);
  const where = { user_id: req.userId!, result_schema_version: 2 };
  const [rows, total] = await prisma.$transaction([
    prisma.policyAnalysis.findMany({ where, orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * page_size, take: page_size,
      select: { id: true, original_filename: true, created_at: true, status: true, result_schema_version: true, supersedes_analysis_id: true } }),
    prisma.policyAnalysis.count({ where }),
  ]);
  res.json({ items: rows.map(row => ({ analysis_id: row.id, original_filename: row.original_filename,
    created_at: row.created_at.toISOString(), status: row.status,
    schema_version: row.result_schema_version, supersedes_analysis_id: row.supersedes_analysis_id })), page, page_size, total });
});
const idSchema = z.uuid();
router.delete('/:id', async (req, res) => {
  await deleteAnalysis(idSchema.parse(req.params.id), req.userId!);
  res.status(204).end();
});
router.get('/:id/file', async (req, res, next) => {
  const row = await ownedAnalysis(idSchema.parse(req.params.id), req.userId!);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.download(privateFilePath(row.storage_key), row.original_filename, {
    headers: { 'Content-Type': 'application/octet-stream', 'Cache-Control': 'no-store' },
  }, error => {
    if (!error) return;
    if (res.headersSent) { res.destroy(); return; }
    next(new AnalysisError('NOT_FOUND', 'Arquivo indisponível.', 404));
  });
});
router.get('/:id', async (req, res) => {
  const row = await ownedAnalysis(idSchema.parse(req.params.id), req.userId!);
  res.json(serialize(row));
});
export default router;
