import { Router } from 'express';
import { assessmentController } from './assessment.controller.js';
import { validateBody } from '../../middlewares/validateBody.js';
import { authMiddleware } from '../../middlewares/auth.js';
import { createAssessmentSchema, submitAnswersSchema } from './assessment.schema.js';

const router = Router();

router.use(authMiddleware);

router.get('/', assessmentController.index);
router.get('/:id', assessmentController.show);
router.post('/', validateBody(createAssessmentSchema), assessmentController.create);
router.post('/:id/answers', validateBody(submitAnswersSchema), assessmentController.submitAnswers);
router.post('/:id/complete', assessmentController.complete);

export default router;
