import { Router } from 'express';
import { questionnaireController } from './questionnaire.controller.js';
import { validateBody } from '../../middlewares/validateBody.js';
import { authMiddleware, adminOnly } from '../../middlewares/auth.js';
import {
  createQuestionnaireSchema,
  updateQuestionnaireSchema,
  addQuestionsSchema,
} from './questionnaire.schema.js';

const router = Router();

router.use(authMiddleware);

router.get('/', questionnaireController.index);
router.get('/:id', questionnaireController.show);
router.post('/', adminOnly, validateBody(createQuestionnaireSchema), questionnaireController.create);
router.put('/:id', adminOnly, validateBody(updateQuestionnaireSchema), questionnaireController.update);
router.delete('/:id', adminOnly, questionnaireController.delete);
router.post('/:id/questions', adminOnly, validateBody(addQuestionsSchema), questionnaireController.addQuestions);

export default router;
