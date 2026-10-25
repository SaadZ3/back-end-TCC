import { z } from 'zod';

// Reports são gerados automaticamente no assessment.complete
// Este schema é apenas para filtros de listagem
export const listReportsQuerySchema = z.object({
  company_id: z.string().uuid().optional(),
  maturity_level: z.enum(['INITIAL', 'DEVELOPING', 'DEFINED', 'MANAGED', 'OPTIMIZED']).optional(),
});

export type ListReportsQuery = z.infer<typeof listReportsQuerySchema>;
