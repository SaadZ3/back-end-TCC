/** Entrega o perfil da sessão validada pelo middleware de autenticação. */
import type { Request, Response } from 'express';

/** Usa a sessão da requisição e retorna o perfil público e sua data de expiração. */
export async function me(req: Request, res: Response): Promise<void> {
  res.json({
    user: req.authenticatedUser,
    expires_at: new Date(req.sessionExpiresAt! * 1000).toISOString(),
  });
}
