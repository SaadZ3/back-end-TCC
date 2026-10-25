import { z } from 'zod';
import { emailSchema, passwordSchema } from '../auth/auth.schema.js';

// Mantido para o controller legado; perfil e empresa nunca são editáveis aqui.
export const updateUserSchema = z.strictObject({
  name: z.string().trim().min(3).max(255).optional(),
  email: emailSchema.optional(),
  password: passwordSchema.optional(),
});
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
