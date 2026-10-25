import { z } from 'zod';

export const createQuestionnaireSchema = z.object({
  title: z
    .string({ error: 'Título é obrigatório' })
    .min(3, 'Título deve ter pelo menos 3 caracteres')
    .max(255, 'Título deve ter no máximo 255 caracteres'),
  description: z.string().max(1000).optional(),
  category: z.enum(['LGPD', 'ISO_27701', 'PRIVACY_BY_DESIGN'], {
    error: 'Categoria deve ser LGPD, ISO_27701 ou PRIVACY_BY_DESIGN',
  }),
  version: z.number().int().positive().optional().default(1),
  is_active: z.boolean().optional().default(true),
});

export const updateQuestionnaireSchema = createQuestionnaireSchema.partial();

const questionItemSchema = z.object({
  text: z
    .string({ error: 'Texto da pergunta é obrigatório' })
    .min(10, 'Pergunta deve ter pelo menos 10 caracteres'),
  guidance: z.string().optional(),
  domain: z.enum([
    'GOVERNANCE',
    'DATA_PROCESSING',
    'DATA_SUBJECT_RIGHTS',
    'SECURITY',
    'INCIDENT_RESPONSE',
    'PRIVACY_DESIGN',
  ], {
    error: 'Domínio é obrigatório',
  }),
  weight: z.number().int().min(1).max(10).optional().default(1),
  order: z.number().int().min(1),
});

export const addQuestionsSchema = z.object({
  questions: z.array(questionItemSchema).min(1, 'Pelo menos uma pergunta é obrigatória'),
});

export type CreateQuestionnaireInput = z.infer<typeof createQuestionnaireSchema>;
export type UpdateQuestionnaireInput = z.infer<typeof updateQuestionnaireSchema>;
export type AddQuestionsInput = z.infer<typeof addQuestionsSchema>;
