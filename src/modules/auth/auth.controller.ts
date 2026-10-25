import type { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../../lib/prisma.js';
import type { LoginInput } from './auth.schema.js';
import { clearSession, publicUser, readSessionClaims, setSession } from './session.js';
import { createUser, EmailInUseError } from './provision-user.js';

const dummyHash = bcrypt.hashSync('conta-inexistente-para-comparacao', 12);

class AuthController {
  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await createUser(req.body);
      const expires_at = setSession(res, user);
      res.status(201).json({ user: publicUser(user), expires_at });
    } catch (error) {
      if (error instanceof EmailInUseError) {
        res.status(409).json({ error: { code: 'EMAIL_IN_USE', message: error.message } });
        return;
      }
      next(error);
    }
  }

  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password } = req.body as LoginInput;
      // Compatível com contas legadas sem normalização, mas recusa e-mails ambíguos.
      const matches = await prisma.user.findMany({
        where: { email: { equals: email, mode: 'insensitive' } }, take: 2,
      });
      const user = matches.length === 1 ? matches[0] : null;
      const passwordMatches = await bcrypt.compare(password, user?.password_hash ?? dummyHash);
      if (!user || !passwordMatches || Buffer.byteLength(password, 'utf8') > 72) {
        res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'E-mail ou senha incorretos.' } });
        return;
      }
      const expires_at = setSession(res, user);
      res.json({ user: publicUser(user), expires_at });
    } catch (error) { next(error); }
  }

  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const claims = readSessionClaims(req);
      if (claims) {
        // Uma coluna revoga todas as sessões da conta, sem tabela/serviço adicional.
        await prisma.user.updateMany({
          where: { id: claims.sub, session_version: claims.version },
          data: { session_version: { increment: 1 } },
        });
      }
      clearSession(res);
      res.status(204).end();
    } catch (error) { next(error); }
  }
}
export const authController = new AuthController();
