import { z } from 'zod';
const identifier = z.string().min(1);
const fraction = z.number().min(0).max(1);

export const documentScopeSchema = z.enum(['full_document', 'excerpt', 'unknown']);
const metadataSchema = z.strictObject({
  language: z.literal('pt'),
  document_scope: documentScopeSchema,
});

export const apiErrorSchema = z.object({
  code: z.enum([
    'INVALID_INPUT', 'INVALID_CREDENTIALS', 'UNAUTHORIZED', 'FORBIDDEN',
    'NOT_FOUND', 'TOO_MANY_REQUESTS', 'FILE_TOO_LARGE', 'UNSUPPORTED_FORMAT', 'UNREADABLE_FILE',
    'OCR_REQUIRED', 'INFERENCE_UNAVAILABLE', 'ANALYSIS_TIMEOUT', 'INTERNAL_ERROR',
  ]),
  message: z.string().min(1),
});
export const errorResponseSchema = z.object({ error: apiErrorSchema, analysis_id: identifier.optional() });

export const evidenceSchema = z.object({
  segment_id: identifier,
  start: z.number().int().nonnegative(),
  end: z.number().int().nonnegative(),
  quote: z.string(),
}).refine(value => value.end >= value.start, 'Intervalo de evidência inválido.');

export const resultFields = {
  document_scope: documentScopeSchema,
  source: z.object({
    filename: identifier,
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    format: z.enum(['pdf', 'txt']),
    byte_size: z.number().int().positive(),
  }).optional(),
  preprocessing: z.object({
    version: identifier,
    max_length: z.number().int().positive(),
    tokenizer_sha256: z.string().regex(/^[a-f0-9]{64}$/),
  }).optional(),
  extraction: z.object({
    status: z.enum(['ok', 'partial']), warnings: z.array(z.string()),
    text: z.string().optional(),
    page_count: z.number().int().positive().nullable().optional(),
    pages: z.array(z.object({
      page_number: z.number().int().positive().nullable(),
      char_start: z.number().int().nonnegative(),
      char_end: z.number().int().nonnegative(),
      status: z.enum(['ok', 'partial', 'empty', 'failed']),
    })).optional(),
  }),
  segments: z.array(z.object({
    segment_id: identifier,
    text: z.string().min(1),
    char_start: z.number().int().nonnegative().optional(),
    char_end: z.number().int().nonnegative().optional(),
    page_start: z.number().int().positive().nullable(),
    page_end: z.number().int().positive().nullable(),
    labels: z.array(identifier),
    probabilities: z.record(z.string(), fraction),
    n_tokens: z.number().int().nonnegative(),
    truncated: z.boolean(),
  })),
};
export { metadataSchema };
export const baseVersionsSchema = z.object({ model: identifier, preprocessing: identifier, scoring: identifier });
