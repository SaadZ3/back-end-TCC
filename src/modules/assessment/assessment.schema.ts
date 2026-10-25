import { z } from 'zod';

export const createAssessmentSchema = z.object({
  company_id: z.string().uuid('ID da empresa inválido'),
  questionnaire_id: z.string().uuid('ID do questionário inválido'),
});

export const submitAnswersSchema = z.object({
  answers: z
    .array(
      z.object({
        question_id: z.string().uuid('ID da pergunta inválido'),
        score: z
          .number()
          .int()
          .min(0, 'Score mínimo é 0')
          .max(5, 'Score máximo é 5'),
        justification: z.string().max(1000).optional(),
        evidence_url: z.string().url('URL de evidência inválida').optional(),
      }),
    )
    .min(1, 'Pelo menos uma resposta é obrigatória'),
});

export type CreateAssessmentInput = z.infer<typeof createAssessmentSchema>;
export type SubmitAnswersInput = z.infer<typeof submitAnswersSchema>;
