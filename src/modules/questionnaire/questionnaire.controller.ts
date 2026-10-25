import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../lib/prisma.js';
import type {
  CreateQuestionnaireInput,
  UpdateQuestionnaireInput,
  AddQuestionsInput,
} from './questionnaire.schema.js';

class QuestionnaireController {
  /**
   * GET /questionnaires
   * Lista todos os questionários (com contagem de perguntas)
   */
  async index(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const category = req.query.category as string | undefined;
      const active = req.query.active as string | undefined;

      const where: Record<string, unknown> = {};
      if (category) where.category = category;
      if (active !== undefined) where.is_active = active === 'true';

      const questionnaires = await prisma.questionnaire.findMany({
        where,
        include: {
          _count: {
            select: { questions: true, assessments: true },
          },
        },
        orderBy: { created_at: 'desc' },
      });

      res.json(questionnaires);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /questionnaires/:id
   * Busca um questionário com todas as perguntas
   */
  async show(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const questionnaire = await prisma.questionnaire.findUnique({
        where: { id },
        include: {
          questions: {
            orderBy: { order: 'asc' },
          },
          _count: {
            select: { assessments: true },
          },
        },
      });

      if (!questionnaire) {
        res.status(404).json({ errors: ['Questionário não encontrado'] });
        return;
      }

      res.json(questionnaire);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /questionnaires
   * Cria um novo questionário (admin only)
   */
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = req.body as CreateQuestionnaireInput;

      const questionnaire = await prisma.questionnaire.create({ data });
      res.status(201).json(questionnaire);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /questionnaires/:id
   * Atualiza um questionário (admin only)
   */
  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const data = req.body as UpdateQuestionnaireInput;

      const existing = await prisma.questionnaire.findUnique({ where: { id } });
      if (!existing) {
        res.status(404).json({ errors: ['Questionário não encontrado'] });
        return;
      }

      const questionnaire = await prisma.questionnaire.update({
        where: { id },
        data,
      });

      res.json(questionnaire);
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /questionnaires/:id
   * Remove um questionário (admin only)
   */
  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;

      const existing = await prisma.questionnaire.findUnique({ where: { id } });
      if (!existing) {
        res.status(404).json({ errors: ['Questionário não encontrado'] });
        return;
      }

      await prisma.questionnaire.delete({ where: { id } });
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /questionnaires/:id/questions
   * Adiciona perguntas a um questionário (admin only)
   */
  async addQuestions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const { questions } = req.body as AddQuestionsInput;

      const questionnaire = await prisma.questionnaire.findUnique({ where: { id } });
      if (!questionnaire) {
        res.status(404).json({ errors: ['Questionário não encontrado'] });
        return;
      }

      const created = await prisma.question.createMany({
        data: questions.map((q) => ({
          ...q,
          questionnaire_id: id,
        })),
      });

      res.status(201).json({
        message: `${created.count} pergunta(s) adicionada(s)`,
        count: created.count,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const questionnaireController = new QuestionnaireController();
