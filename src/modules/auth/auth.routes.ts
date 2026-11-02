/** Registra autenticação e seus limites de tentativas por endereço IP. */
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { register, login, logout } from './auth.controller.js';
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
    res.status(429).json({
      error: {
        code: 'TOO_MANY_REQUESTS',
        message: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.'
      }
    });
  },
});
router.post('/login', loginLimiter, validateBody(loginSchema), login);
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      error: {
        code: 'TOO_MANY_REQUESTS',
        message: 'Muitas tentativas de cadastro. Aguarde uma hora e tente novamente.'
      }
    });
  },
});
router.post('/register', registerLimiter, validateBody(registerSchema), register);
router.post('/logout', logout);
export default router;
