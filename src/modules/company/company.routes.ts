import { Router } from 'express';
import { companyController } from './company.controller.js';
import { validateBody } from '../../middlewares/validateBody.js';
import { authMiddleware, adminOnly } from '../../middlewares/auth.js';
import { createCompanySchema, updateCompanySchema } from './company.schema.js';

const router = Router();

router.use(authMiddleware);

router.get('/', companyController.index);
router.get('/:id', companyController.show);
router.post('/', validateBody(createCompanySchema), companyController.create);
router.put('/:id', validateBody(updateCompanySchema), companyController.update);
router.delete('/:id', adminOnly, companyController.delete);

export default router;
