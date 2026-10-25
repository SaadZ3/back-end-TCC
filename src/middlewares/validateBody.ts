import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';

/**
 * Middleware genérico de validação de body com Zod.
 * Uso: router.post('/rota', validateBody(meuSchema), controller.metodo)
 */
export function validateBody(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    // parse() lança ZodError se inválido, que é capturado pelo errorHandler
    req.body = schema.parse(req.body);
    next();
  };
}
