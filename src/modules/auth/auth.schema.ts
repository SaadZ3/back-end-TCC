import { z } from 'zod';

export const emailSchema = z.string().trim().toLowerCase().email('E-mail inválido').max(254);
export const passwordSchema = z.string().min(8, 'A senha precisa ter pelo menos 8 caracteres.')
  .refine(value => Buffer.byteLength(value, 'utf8') <= 72, 'A senha excede o limite de 72 bytes.');

export const loginSchema = z.strictObject({
  email: emailSchema,
  password: z.string().min(1, 'Informe a senha.').max(200),
});

export const provisionUserSchema = z.strictObject({
  name: z.string().trim().min(3, 'Informe um nome com pelo menos 3 caracteres.').max(255, 'O nome deve ter até 255 caracteres.'),
  email: emailSchema,
  password: passwordSchema,
});
export const registerSchema = provisionUserSchema;
export type LoginInput = z.infer<typeof loginSchema>;
