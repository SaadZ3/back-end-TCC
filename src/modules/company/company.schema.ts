import { z } from 'zod';

export const createCompanySchema = z.object({
  name: z
    .string({ error: 'Nome da empresa é obrigatório' })
    .min(2, 'Nome deve ter pelo menos 2 caracteres')
    .max(255, 'Nome deve ter no máximo 255 caracteres'),
  cnpj: z
    .string({ error: 'CNPJ é obrigatório' })
    .regex(/^\d{14}$/, 'CNPJ deve conter exatamente 14 dígitos numéricos'),
  sector: z.string().max(100).optional(),
  size: z.enum(['MICRO', 'SMALL', 'MEDIUM', 'LARGE']).optional(),
});

export const updateCompanySchema = createCompanySchema.partial();

export type CreateCompanyInput = z.infer<typeof createCompanySchema>;
export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>;
