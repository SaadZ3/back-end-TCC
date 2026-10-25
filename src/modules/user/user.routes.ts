import { Router } from 'express';
import { userController } from './user.controller.js';
import { authMiddleware } from '../../middlewares/auth.js';

const router = Router();
router.use(authMiddleware);
router.get('/me', userController.me);
// O protótipo não expõe listagem, edição de perfil nem consulta por ID.
export default router;
