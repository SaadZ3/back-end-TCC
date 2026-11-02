/** Preserva a validação legada de perfil coberta pelos testes de autorização. */
import { z } from 'zod';
import { emailSchema, passwordSchema } from '../auth/auth.schema.js';

// Mantido pelos testes que impedem alteração de papel e empresa; não há rota de edição.
export const updateUserSchema = z.strictObject({
  name: z.string().trim().min(3).max(255).optional(),
  email: emailSchema.optional(),
  password: passwordSchema.optional(),
});
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
