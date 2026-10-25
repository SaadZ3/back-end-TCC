import { createHash } from 'node:crypto';
import { env } from '../../config/env.js';
import { inferenceResponseSchema, errorResponseSchema } from '../../contracts/analysis.js';
import { AnalysisError } from './analysis.error.js';

const statuses: Record<string, number> = {
  INVALID_INPUT: 400, FILE_TOO_LARGE: 413, UNSUPPORTED_FORMAT: 415, UNREADABLE_FILE: 422,
  OCR_REQUIRED: 422, INFERENCE_UNAVAILABLE: 503, ANALYSIS_TIMEOUT: 504, INTERNAL_ERROR: 500,
};

export async function infer(file: Express.Multer.File, scope: string) {
  const signal = AbortSignal.timeout(env.INFERENCE_TIMEOUT_MS);
  const data = new FormData();
  data.append('file', new Blob([new Uint8Array(file.buffer)]), file.originalname);
  data.append('language', 'pt');
  data.append('document_scope', scope);
  let receivedResponse = false;
  try {
    const response = await fetch(new URL('/analyze', env.INFERENCE_URL), {
      method: 'POST', body: data, signal, redirect: 'error',
    });
    receivedResponse = true;
    const chunks: Uint8Array[] = [];
    let size = 0;
    const reader = response.body?.getReader();
    if (!reader) throw new Error('Empty response');
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 32 * 1024 * 1024) throw new Error('Response too large');
        chunks.push(value);
      }
    } finally { await reader.cancel(); }
    const body: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!response.ok) {
      const parsed = errorResponseSchema.safeParse(body);
      if (parsed.success && statuses[parsed.data.error.code]) {
        const { code, message } = parsed.data.error;
        throw new AnalysisError(code, message, statuses[code]);
      }
      throw new Error('Invalid upstream error');
    }
    const parsed = inferenceResponseSchema.parse(body);
    if (parsed.result.document_scope !== scope ||
        parsed.result.source?.sha256 !== createHash('sha256').update(file.buffer).digest('hex') ||
        parsed.result.source.byte_size !== file.size) throw new Error('Mismatched source');
    return parsed;
  } catch (error) {
    if (signal.aborted) throw new AnalysisError('ANALYSIS_TIMEOUT', 'O serviço de análise excedeu o tempo limite.', 504);
    if (error instanceof AnalysisError) throw error;
    throw new AnalysisError('INFERENCE_UNAVAILABLE', receivedResponse
      ? 'Não foi possível validar a resposta do serviço de análise. Tente novamente.'
      : 'Não foi possível conectar ao serviço de análise. Verifique se ele está iniciado e tente novamente.', 503);
  }
}
