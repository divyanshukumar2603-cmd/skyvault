import { Router } from 'express';
import * as replicationController from './replication.controller';
import { authenticate } from '../../middleware/auth';
import { AuthenticatedRequest } from '../../types';

const router = Router();
router.use(authenticate as any);

const auth = (handler: Function) => (req: any, res: any, next: any) => handler(req as AuthenticatedRequest, res, next);

router.get('/status', auth(replicationController.getStatus));
router.post('/trigger', auth(replicationController.triggerSync));

export default router;
