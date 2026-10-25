import type { Request, Response, NextFunction } from 'express';
import { allowedOrigins } from '../config/env.js';

// Cookie exige proteção também contra requisições de outra origem.
export function requireTrustedOrigin(req: Request, res: Response, next: NextFunction): void {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) { next(); return; }
  const origin = req.get('Origin');
  if (!origin || !allowedOrigins.includes(origin)) {
    res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Origem da requisição não permitida.' } });
    return;
  }
  next();
}
