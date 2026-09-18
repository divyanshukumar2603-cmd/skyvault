import { Router } from 'express';
import { body } from 'express-validator';
import * as productsController from './products.controller';
import { authenticate } from '../../middleware/auth';
import { AuthenticatedRequest } from '../../types';

const router = Router();
router.use(authenticate as any);

const auth = (handler: Function) => (req: any, res: any, next: any) => handler(req as AuthenticatedRequest, res, next);

router.get('/', auth(productsController.listProducts));
router.get('/categories', auth(productsController.getCategories));
router.get('/insights', auth(productsController.getInsights));
router.delete('/history', auth(productsController.resetHistory));

router.get('/:id', auth(productsController.getProduct));
router.post(
  '/:id/interactions',
  [
    body('type').isIn(['VIEW', 'CLICK', 'CART', 'PURCHASE']),
    body('rank').optional().isInt({ min: 1 }),
  ],
  auth(productsController.recordInteraction)
);

export default router;
