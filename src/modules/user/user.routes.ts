/** Expõe somente a consulta do perfil da pessoa autenticada. */
import { Router } from 'express';
import { me } from './user.controller.js';
import { authMiddleware } from '../../middlewares/auth.js';

const router = Router();
router.use(authMiddleware);
router.get('/me', me);
// O protótipo não expõe listagem, edição de perfil nem consulta por ID.
export default router;
