import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../lib/prisma.js';
import { MaturityLevel } from '@prisma/client';

class ReportController {
  /**
   * GET /reports
   * Lista todos os relatórios (filtráveis por empresa e nível de maturidade)
   */
  async index(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const company_id = req.query.company_id as string | undefined;
      const maturity_level = req.query.maturity_level as MaturityLevel | undefined;

      const assessmentFilter: Record<string, unknown> = {};

      if (company_id) {
        assessmentFilter.company_id = company_id;
      }
      if (maturity_level) {
        assessmentFilter.maturity_level = maturity_level;
      }

      // Não-admin só vê seus próprios relatórios
      if (req.userRole !== 'ADMIN') {
        assessmentFilter.user_id = req.userId;
      }

      const reports = await prisma.report.findMany({
        where: Object.keys(assessmentFilter).length > 0
          ? { assessment: assessmentFilter }
          : undefined,
        include: {
          assessment: {
            select: {
              id: true,
              overall_score: true,
              maturity_level: true,
              completed_at: true,
              company: { select: { id: true, name: true } },
              questionnaire: { select: { title: true, category: true } },
              user: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { generated_at: 'desc' },
      });

      res.json(reports);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /reports/:id
   * Busca um relatório completo por ID
   */
  async show(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const report = await prisma.report.findUnique({
        where: { id },
        include: {
          assessment: {
            include: {
              company: true,
              questionnaire: { select: { title: true, category: true, description: true } },
              user: { select: { id: true, name: true, email: true } },
              answers: {
                include: {
                  question: true,
                },
                orderBy: { question: { order: 'asc' } },
              },
            },
          },
        },
      });

      if (!report) {
        res.status(404).json({ errors: ['Relatório não encontrado'] });
        return;
      }

      // Verificar permissão
      if (report.assessment.user_id !== req.userId && req.userRole !== 'ADMIN') {
        res.status(403).json({ errors: ['Sem permissão para ver este relatório'] });
        return;
      }

      res.json(report);
    } catch (error) {
      next(error);
    }
  }
}

export const reportController = new ReportController();
