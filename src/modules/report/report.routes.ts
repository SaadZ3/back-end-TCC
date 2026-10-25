import { Router } from 'express';
import { reportController } from './report.controller.js';
import { authMiddleware } from '../../middlewares/auth.js';

const router = Router();

router.use(authMiddleware);

router.get('/', reportController.index);
router.get('/:id', reportController.show);

export default router;
