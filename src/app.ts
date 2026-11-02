/** Conecta proteção HTTP, autenticação e rotas da API Express. */
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { allowedOrigins } from './config/env.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { requireTrustedOrigin } from './middlewares/origin.js';
import authRoutes from './modules/auth/auth.routes.js';
import userRoutes from './modules/user/user.routes.js';
import analysisRoutes from './modules/analysis/analysis.routes.js';

const app = express();
app.disable('x-powered-by');
app.use(helmet());
app.use(cors({
  origin: (origin, callback) => callback(null, !origin || allowedOrigins.includes(origin)),
  credentials: true
}));
app.use('/api', requireTrustedOrigin);
app.use(express.json({ limit: '16kb' }));
app.use(cookieParser());
app.use('/api', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});
app.get('/api/health', (_req, res) => { res.json({ status: 'ok', service: 'tcc-back' }); });
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/analyses', analysisRoutes);
// A API expõe apenas as rotas do protótipo; tabelas legadas permanecem no banco.
app.use((_req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Recurso não encontrado.' } });
});
app.use(errorHandler);
export default app;
