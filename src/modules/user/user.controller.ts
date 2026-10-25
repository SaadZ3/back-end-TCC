import { Request, Response, NextFunction } from 'express';
import bcryptjs from 'bcryptjs';
import { prisma } from '../../lib/prisma.js';
import type { UpdateUserInput } from './user.schema.js';

// Campos seguros para retornar (sem password_hash)
const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  company_id: true,
  company: {
    select: { id: true, name: true },
  },
  created_at: true,
  updated_at: true,
} as const;

class UserController {
  /**
   * GET /users
   * Lista todos os usuários (admin only)
   */
  async index(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const users = await prisma.user.findMany({
        select: userSelect,
        orderBy: { created_at: 'desc' },
      });
      res.json(users);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /users/:id
   * Busca um usuário por ID
   */
  async show(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      if (req.userId !== id && req.userRole !== 'ADMIN') {
        res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Sem permissão.' } });
        return;
      }
      const user = await prisma.user.findUnique({
        where: { id },
        select: userSelect,
      });

      if (!user) {
        res.status(404).json({ errors: ['Usuário não encontrado'] });
        return;
      }

      res.json(user);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /users/:id
   * Atualiza um usuário
   */
  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const data = req.body as UpdateUserInput;

      // Verificar se o usuário existe
      const existingUser = await prisma.user.findUnique({ where: { id } });
      if (!existingUser) {
        res.status(404).json({ errors: ['Usuário não encontrado'] });
        return;
      }

      // Verificar permissão: só pode editar a si mesmo ou ser admin
      if (req.userId !== id && req.userRole !== 'ADMIN') {
        res.status(403).json({ errors: ['Sem permissão para editar este usuário'] });
        return;
      }

      // Se está alterando email, verificar unicidade
      if (data.email && data.email !== existingUser.email) {
        const emailInUse = await prisma.user.findUnique({ where: { email: data.email } });
        if (emailInUse) {
          res.status(409).json({ errors: ['Este email já está em uso'] });
          return;
        }
      }

      // Preparar dados de update
      const updateData: Record<string, unknown> = { name: data.name, email: data.email };

      // Hash da senha se foi alterada
      if (data.password) {
        updateData.password_hash = await bcryptjs.hash(data.password, 10);
        updateData.session_version = { increment: 1 };
      }

      const user = await prisma.user.update({
        where: { id },
        data: updateData,
        select: userSelect,
      });

      res.json(user);
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /users/:id
   * Remove um usuário (admin only)
   */
  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;

      const user = await prisma.user.findUnique({ where: { id } });
      if (!user) {
        res.status(404).json({ errors: ['Usuário não encontrado'] });
        return;
      }

      await prisma.user.delete({ where: { id } });

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /users/me
   * Retorna o perfil do usuário autenticado
   */
  async me(req: Request, res: Response): Promise<void> {
    res.json({
      user: req.authenticatedUser,
      expires_at: new Date(req.sessionExpiresAt! * 1000).toISOString(),
    });
  }

}

export const userController = new UserController();
