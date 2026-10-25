import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { authController } from './auth.controller.js';
import { validateBody } from '../../middlewares/validateBody.js';
import { loginSchema, registerSchema } from './auth.schema.js';

const router = Router();
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({ error: { code: 'TOO_MANY_REQUESTS', message: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.' } });
  },
});
router.post('/login', loginLimiter, validateBody(loginSchema), authController.login);
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({ error: { code: 'TOO_MANY_REQUESTS', message: 'Muitas tentativas de cadastro. Aguarde uma hora e tente novamente.' } });
  },
});
router.post('/register', registerLimiter, validateBody(registerSchema), authController.register);
router.post('/logout', authController.logout);
export default router;
