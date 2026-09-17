import { Router } from 'express';
import * as versionsController from './versions.controller';
import { authenticate } from '../../middleware/auth';
import { AuthenticatedRequest } from '../../types';

const router = Router({ mergeParams: true });
router.use(authenticate as any);

const auth = (handler: Function) => (req: any, res: any, next: any) => handler(req as AuthenticatedRequest, res, next);

router.get('/', auth(versionsController.listVersions));
router.get('/:versionId', auth(versionsController.getVersionUrl));
router.post('/:versionId/restore', auth(versionsController.restoreVersion));

export default router;
