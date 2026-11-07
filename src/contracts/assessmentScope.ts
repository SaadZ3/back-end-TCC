/** Registra o conjunto pedido, independentemente do conteúdo completo ou parcial. */
import { z } from 'zod';
export const categoryIds = ['collection', 'sharing', 'choice', 'access', 'retention', 'security', 'changes', 'dnt', 'audiences'] as const;
export const assessmentScopeSchema = z.strictObject({
  mode: z.enum(['all_categories', 'selected_categories']),
  category_ids: z.array(z.enum(categoryIds)).min(1).max(9),
}).superRefine((value, ctx) => {
  if (new Set(value.category_ids).size !== value.category_ids.length)
    ctx.addIssue({code:'custom',message:'Não repita categorias.'});
  if (value.mode === 'all_categories' && value.category_ids.length !== categoryIds.length)
    ctx.addIssue({code:'custom',message:'O modo Todas exige as nove categorias.'});
});
export type AssessmentScope = z.infer<typeof assessmentScopeSchema>;
export function resolveAssessmentScope(value?: AssessmentScope): AssessmentScope {
  return value ? {...value, category_ids: categoryIds.filter(id => value.category_ids.includes(id))}
    : {mode:'all_categories',category_ids:[...categoryIds]};
}
export const assessmentScopeUploadSchema = z.preprocess(value => {
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return null; }
}, assessmentScopeSchema);
