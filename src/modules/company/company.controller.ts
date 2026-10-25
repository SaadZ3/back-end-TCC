import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../lib/prisma.js';
import type { CreateCompanyInput, UpdateCompanyInput } from './company.schema.js';

class CompanyController {
  /**
   * GET /companies
   * Lista todas as empresas
   */
  async index(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companies = await prisma.company.findMany({
        include: {
          _count: {
            select: { assessments: true, users: true },
          },
        },
        orderBy: { created_at: 'desc' },
      });
      res.json(companies);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /companies/:id
   * Busca uma empresa por ID com suas avaliações
   */
  async show(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const company = await prisma.company.findUnique({
        where: { id },
        include: {
          assessments: {
            select: {
              id: true,
              status: true,
              overall_score: true,
              maturity_level: true,
              started_at: true,
              completed_at: true,
              questionnaire: {
                select: { title: true, category: true },
              },
            },
            orderBy: { created_at: 'desc' },
          },
          _count: {
            select: { users: true },
          },
        },
      });

      if (!company) {
        res.status(404).json({ errors: ['Empresa não encontrada'] });
        return;
      }

      res.json(company);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /companies
   * Cria uma nova empresa
   */
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = req.body as CreateCompanyInput;

      // Verificar CNPJ único
      const existing = await prisma.company.findUnique({ where: { cnpj: data.cnpj } });
      if (existing) {
        res.status(409).json({ errors: ['CNPJ já cadastrado'] });
        return;
      }

      const company = await prisma.company.create({ data });
      res.status(201).json(company);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /companies/:id
   * Atualiza uma empresa
   */
  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const data = req.body as UpdateCompanyInput;

      const existing = await prisma.company.findUnique({ where: { id } });
      if (!existing) {
        res.status(404).json({ errors: ['Empresa não encontrada'] });
        return;
      }

      // Se está alterando CNPJ, verificar unicidade
      if (data.cnpj && data.cnpj !== existing.cnpj) {
        const cnpjInUse = await prisma.company.findUnique({ where: { cnpj: data.cnpj } });
        if (cnpjInUse) {
          res.status(409).json({ errors: ['CNPJ já está em uso'] });
          return;
        }
      }

      const company = await prisma.company.update({
        where: { id },
        data,
      });

      res.json(company);
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /companies/:id
   * Remove uma empresa
   */
  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;

      const existing = await prisma.company.findUnique({ where: { id } });
      if (!existing) {
        res.status(404).json({ errors: ['Empresa não encontrada'] });
        return;
      }

      await prisma.company.delete({ where: { id } });
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
}

export const companyController = new CompanyController();
