import { Router } from 'express';
import * as analyticsController from './analytics.controller';
import { authenticate } from '../../middleware/auth';
import { AuthenticatedRequest } from '../../types';

const router = Router();
router.use(authenticate as any);

const auth = (handler: Function) => (req: any, res: any, next: any) => handler(req as AuthenticatedRequest, res, next);

router.get('/', auth(analyticsController.getDashboard));
router.get('/overview', auth(analyticsController.getOverview));
router.get('/funnel', auth(analyticsController.getFunnel));
router.get('/top-products', auth(analyticsController.getTopProducts));
router.get('/categories', auth(analyticsController.getCategories));
router.get('/trend', auth(analyticsController.getTrend));
router.get('/ranking-effectiveness', auth(analyticsController.getEffectiveness));

export default router;
