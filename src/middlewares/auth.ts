/** Valida a sessão e disponibiliza o perfil autenticado às rotas privadas. */
import type { Request, Response, NextFunction } from 'express';
import { clearSession, currentSession, type PublicUser } from '../modules/auth/session.js';

declare module 'express-serve-static-core' {
  interface Request {
    userId?: string;
    userEmail?: string;
    userRole?: string;
    authenticatedUser?: PublicUser;
    sessionExpiresAt?: number;
  }
}

/** Recebe a requisição, valida a sessão e chama a próxima etapa ou responde 401. */
export async function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const session = await currentSession(req);
    if (!session) {
      clearSession(res);
      res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Sua sessão terminou. Entre novamente.' } });
      return;
    }
    req.userId = session.user.id;
    req.userEmail = session.user.email;
    req.userRole = session.user.role;
    req.authenticatedUser = session.user;
    req.sessionExpiresAt = session.claims.exp;
    next();
  } catch (error) { next(error); }
}
