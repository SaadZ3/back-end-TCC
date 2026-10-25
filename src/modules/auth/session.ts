import type { CookieOptions, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { env, sessionTtlSeconds } from '../../config/env.js';
import { prisma } from '../../lib/prisma.js';

export const SESSION_COOKIE = 'tcc_session';
const claimsSchema = z.object({
  sub: z.string().uuid(), version: z.number().int().nonnegative(),
  exp: z.number().int().positive(),
});
export const cookieOptions: CookieOptions = {
  httpOnly: true, secure: env.NODE_ENV === 'production', sameSite: 'lax', path: '/api',
};
const userSelect = { id: true, name: true, email: true, role: true, session_version: true } as const;
export type PublicUser = { id: string; name: string; email: string; role: 'ADMIN' | 'EVALUATOR' };

export function publicUser(user: PublicUser): PublicUser {
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

export function readSessionClaims(req: Request) {
  const cookie: unknown = req.cookies?.[SESSION_COOKIE];
  if (typeof cookie !== 'string') return null;
  try {
    return claimsSchema.parse(jwt.verify(cookie, env.TOKEN_SECRET, {
      algorithms: ['HS256'], issuer: 'tcc-back', audience: 'tcc-web',
    }));
  } catch { return null; }
}

export async function currentSession(req: Request) {
  const claims = readSessionClaims(req);
  if (!claims) return null;
  const user = await prisma.user.findUnique({ where: { id: claims.sub }, select: userSelect });
  if (!user || user.session_version !== claims.version) return null;
  return { user: publicUser(user), claims };
}

export function setSession(res: Response, user: { id: string; session_version: number }): string {
  const expires = Math.floor(Date.now() / 1000) + sessionTtlSeconds;
  const token = jwt.sign({ version: user.session_version, exp: expires }, env.TOKEN_SECRET, {
    subject: user.id, algorithm: 'HS256', issuer: 'tcc-back', audience: 'tcc-web',
  });
  res.cookie(SESSION_COOKIE, token, { ...cookieOptions, maxAge: sessionTtlSeconds * 1000 });
  return new Date(expires * 1000).toISOString();
}

export function clearSession(res: Response): void {
  res.clearCookie(SESSION_COOKIE, cookieOptions);
}
