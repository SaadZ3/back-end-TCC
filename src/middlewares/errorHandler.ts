import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AnalysisError } from '../modules/analysis/analysis.error.js';

interface AppError extends Error { statusCode?: number; status?: number; type?: string; }

export function errorHandler(err: AppError, _req: Request, res: Response, _next: NextFunction): void {
  if (res.headersSent) { res.destroy(); return; }
  if (err instanceof AnalysisError) {
    res.status(err.statusCode).json({
      error: { code: err.code, message: err.message },
      ...(err.analysisId ? { analysis_id: err.analysisId } : {}),
    });
    return;
  }
  if (err instanceof z.ZodError) {
    res.status(400).json({ error: { code: 'INVALID_INPUT', message: err.issues[0]?.message ?? 'Dados inválidos.' } });
    return;
  }
  if (err.type === 'entity.parse.failed') {
    res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'JSON inválido.' } });
    return;
  }
  if (err.type === 'entity.too.large') {
    res.status(413).json({ error: { code: 'FILE_TOO_LARGE', message: 'Requisição acima do tamanho permitido.' } });
    return;
  }
  // Nunca registrar o objeto completo: bibliotecas podem carregar credenciais/SQL.
  console.error('Falha na API:', err.name);
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Não foi possível concluir. Tente novamente.' } });
}
