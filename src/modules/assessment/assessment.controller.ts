import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../lib/prisma.js';
import { calculateMaturity } from '../../utils/calculateMaturity.js';
import type { CreateAssessmentInput, SubmitAnswersInput } from './assessment.schema.js';

class AssessmentController {
  /**
   * GET /assessments
   * Lista avaliações do usuário logado (ou todas se admin)
   */
  async index(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const where = req.userRole === 'ADMIN' ? {} : { user_id: req.userId };

      const assessments = await prisma.assessment.findMany({
        where,
        include: {
          company: { select: { id: true, name: true, cnpj: true } },
          questionnaire: { select: { id: true, title: true, category: true } },
          user: { select: { id: true, name: true } },
          _count: { select: { answers: true } },
        },
        orderBy: { created_at: 'desc' },
      });

      res.json(assessments);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /assessments/:id
   * Busca uma avaliação com respostas e relatório
   */
  async show(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const assessment = await prisma.assessment.findUnique({
        where: { id },
        include: {
          company: true,
          questionnaire: {
            include: {
              questions: { orderBy: { order: 'asc' } },
            },
          },
          answers: {
            include: {
              question: { select: { text: true, domain: true, weight: true } },
            },
          },
          report: true,
          user: { select: { id: true, name: true, email: true } },
        },
      });

      if (!assessment) {
        res.status(404).json({ errors: ['Avaliação não encontrada'] });
        return;
      }

      // Verificar permissão: dono ou admin
      if (assessment.user_id !== req.userId && req.userRole !== 'ADMIN') {
        res.status(403).json({ errors: ['Sem permissão para ver esta avaliação'] });
        return;
      }

      res.json(assessment);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /assessments
   * Inicia uma nova avaliação
   */
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { company_id, questionnaire_id } = req.body as CreateAssessmentInput;

      // Verificar se a empresa existe
      const company = await prisma.company.findUnique({ where: { id: company_id } });
      if (!company) {
        res.status(404).json({ errors: ['Empresa não encontrada'] });
        return;
      }

      // Verificar se o questionário existe e está ativo
      const questionnaire = await prisma.questionnaire.findUnique({
        where: { id: questionnaire_id },
      });
      if (!questionnaire) {
        res.status(404).json({ errors: ['Questionário não encontrado'] });
        return;
      }
      if (!questionnaire.is_active) {
        res.status(400).json({ errors: ['Este questionário não está ativo'] });
        return;
      }

      const assessment = await prisma.assessment.create({
        data: {
          user_id: req.userId!,
          company_id,
          questionnaire_id,
        },
        include: {
          company: { select: { name: true } },
          questionnaire: { select: { title: true, category: true } },
        },
      });

      res.status(201).json(assessment);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /assessments/:id/answers
   * Submete respostas para uma avaliação (pode ser parcial)
   */
  async submitAnswers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const { answers } = req.body as SubmitAnswersInput;

      // Verificar se a avaliação existe e pertence ao usuário
      const assessment = await prisma.assessment.findUnique({ where: { id } });
      if (!assessment) {
        res.status(404).json({ errors: ['Avaliação não encontrada'] });
        return;
      }
      if (assessment.user_id !== req.userId && req.userRole !== 'ADMIN') {
        res.status(403).json({ errors: ['Sem permissão'] });
        return;
      }
      if (assessment.status === 'COMPLETED') {
        res.status(400).json({ errors: ['Avaliação já foi concluída'] });
        return;
      }

      // Verificar se as perguntas pertencem ao questionário
      const questionIds = answers.map((a) => a.question_id);
      const validQuestions = await prisma.question.findMany({
        where: {
          id: { in: questionIds },
          questionnaire_id: assessment.questionnaire_id,
        },
        select: { id: true },
      });
      const validIds = new Set(validQuestions.map((q) => q.id));
      const invalidIds = questionIds.filter((qid) => !validIds.has(qid));

      if (invalidIds.length > 0) {
        res.status(400).json({
          errors: [`Perguntas inválidas para este questionário: ${invalidIds.join(', ')}`],
        });
        return;
      }

      // Upsert respostas (permite atualizar respostas existentes)
      const results = await prisma.$transaction(
        answers.map((answer) =>
          prisma.answer.upsert({
            where: {
              assessment_id_question_id: {
                assessment_id: id,
                question_id: answer.question_id,
              },
            },
            create: {
              assessment_id: id,
              question_id: answer.question_id,
              score: answer.score,
              justification: answer.justification ?? null,
              evidence_url: answer.evidence_url ?? null,
            },
            update: {
              score: answer.score,
              justification: answer.justification ?? null,
              evidence_url: answer.evidence_url ?? null,
            },
          }),
        ),
      );

      res.json({
        message: `${results.length} resposta(s) salva(s)`,
        count: results.length,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /assessments/:id/complete
   * Finaliza a avaliação, calcula score e gera relatório
   */
  async complete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;

      // Buscar avaliação com respostas e perguntas
      const assessment = await prisma.assessment.findUnique({
        where: { id },
      });

      if (!assessment) {
        res.status(404).json({ errors: ['Avaliação não encontrada'] });
        return;
      }
      if (assessment.user_id !== req.userId && req.userRole !== 'ADMIN') {
        res.status(403).json({ errors: ['Sem permissão'] });
        return;
      }
      if (assessment.status === 'COMPLETED') {
        res.status(400).json({ errors: ['Avaliação já foi concluída'] });
        return;
      }

      // Buscar perguntas do questionário e respostas separadamente
      const questions = await prisma.question.findMany({
        where: { questionnaire_id: assessment.questionnaire_id },
        select: { id: true },
      });

      const answers = await prisma.answer.findMany({
        where: { assessment_id: id },
        include: {
          question: { select: { domain: true, weight: true } },
        },
      });

      // Verificar se todas as perguntas foram respondidas
      const totalQuestions = questions.length;
      const answeredQuestions = answers.length;

      if (answeredQuestions < totalQuestions) {
        res.status(400).json({
          errors: [`Faltam ${totalQuestions - answeredQuestions} pergunta(s) para responder. Respondidas: ${answeredQuestions}/${totalQuestions}`],
        });
        return;
      }

      // Calcular maturidade
      const maturityResult = calculateMaturity(answers);

      // Atualizar avaliação e criar relatório em transação
      const [updatedAssessment, report] = await prisma.$transaction([
        prisma.assessment.update({
          where: { id },
          data: {
            status: 'COMPLETED',
            overall_score: maturityResult.overallScore,
            maturity_level: maturityResult.maturityLevel,
            completed_at: new Date(),
          },
        }),
        prisma.report.create({
          data: {
            assessment_id: id,
            summary: maturityResult.summary as object,
            domain_scores: maturityResult.domainScores as unknown as object,
            recommendations: maturityResult.recommendations as unknown as object,
            gap_analysis: maturityResult.gapAnalysis as unknown as object,
          },
        }),
      ]);

      res.json({
        assessment: updatedAssessment,
        report,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const assessmentController = new AssessmentController();
