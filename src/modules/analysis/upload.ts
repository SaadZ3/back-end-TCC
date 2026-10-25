import multer from 'multer';
import type { Request, Response } from 'express';
import { env } from '../../config/env.js';
import { AnalysisError } from './analysis.error.js';

const parse = multer({
  storage: multer.memoryStorage(),
  // O navegador envia nomes de arquivo em UTF-8 no multipart.
  defParamCharset: 'utf8',
  limits: { fileSize: env.MAX_UPLOAD_BYTES, files: 1, fields: 4, parts: 6, fieldSize: 1024, fieldNameSize: 100 },
}).single('file');

export function receiveUpload(req: Request, res: Response): Promise<void> {
  if (!req.is('multipart/form-data')) return Promise.reject(new AnalysisError('INVALID_INPUT', 'Envie um arquivo em multipart/form-data.', 400));
  const maximum = env.MAX_UPLOAD_BYTES + 64 * 1024;
  if (Number(req.headers['content-length']) > maximum)
    return Promise.reject(new AnalysisError('FILE_TOO_LARGE', 'Arquivo acima do limite permitido.', 413));
  return new Promise((resolve, reject) => {
    let bytes = 0;
    let settled = false;
    const finish = (failure?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      req.off('data', count);
      req.off('aborted', aborted);
      if (failure) {
        req.unpipe();
        req.resume();
        reject(failure);
      } else resolve();
    };
    const count = (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > maximum) finish(new AnalysisError('FILE_TOO_LARGE', 'Arquivo acima do limite permitido.', 413));
    };
    const aborted = () => finish(new AnalysisError('INVALID_INPUT', 'Envio do arquivo interrompido.', 400));
    const timer = setTimeout(() => finish(new AnalysisError('ANALYSIS_TIMEOUT', 'Tempo limite de upload excedido.', 504)), env.UPLOAD_TIMEOUT_MS);
    req.on('data', count);
    req.once('aborted', aborted);
    parse(req, res, (failure: unknown) => {
      if (failure instanceof multer.MulterError) {
        const large = failure.code === 'LIMIT_FILE_SIZE';
        finish(new AnalysisError(large ? 'FILE_TOO_LARGE' : 'INVALID_INPUT',
          large ? 'Arquivo acima do limite permitido.' : 'Envie somente um arquivo e os campos language e document_scope.', large ? 413 : 400));
      } else if (failure) finish(new AnalysisError('INVALID_INPUT', 'Envio multipart inválido.', 400));
      else finish();
    });
  });
}
