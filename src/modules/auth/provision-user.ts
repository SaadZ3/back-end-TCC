import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { provisionUserSchema } from './auth.schema.js';
import { publicUser } from './session.js';

export class EmailInUseError extends Error {
  constructor() { super('Já existe uma conta com este e-mail. Entre na sua conta.'); }
}

export async function createUser(input: unknown) {
  const data = provisionUserSchema.parse(input);
  const exists = await prisma.user.findFirst({
    where: { email: { equals: data.email, mode: 'insensitive' } }, select: { id: true },
  });
  if (exists) throw new EmailInUseError();
  try { return await prisma.user.create({ data: {
    name: data.name, email: data.email,
    password_hash: await bcrypt.hash(data.password, 12),
    role: 'EVALUATOR',
  } }); } catch (error) {
    // O índice também impede duplicação quando dois cadastros chegam juntos.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
      throw new EmailInUseError();
    throw error;
  }
}

export async function provisionUser(input: unknown) {
  return publicUser(await createUser(input));
}
